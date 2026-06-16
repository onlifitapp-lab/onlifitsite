import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { setCorsHeaders } from './_auth.js';

export default async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    console.log('WEBHOOK_RECEIVED');

    const rawBody = req.rawBody || (req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : (req.body || ''));
    const signature = req.headers['x-razorpay-signature'] || req.headers['X-Razorpay-Signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('Missing RAZORPAY_WEBHOOK_SECRET');
        return res.status(500).json({ error: 'Webhook configuration missing' });
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (!signature || expected !== signature) {
        console.warn('WEBHOOK_SIGNATURE_INVALID');
        return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log('WEBHOOK_SIGNATURE_VALID');

    const event = req.body?.event || req.body?.payload?.event || '';

    // Initialize supabase
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    try {
        let razorpay_order_id = null;
        let razorpay_payment_id = null;
        let amount = null;
        let currency = 'INR';

        // Extract common shapes
        if (req.body?.payload?.payment?.entity) {
            const p = req.body.payload.payment.entity;
            razorpay_payment_id = p.id;
            razorpay_order_id = p.order_id || null;
            amount = (p.amount || p.amount_paid) ? (Number(p.amount || p.amount_paid) / 100.0) : null;
            currency = p.currency || currency;
        } else if (req.body?.payload?.order?.entity) {
            const o = req.body.payload.order.entity;
            razorpay_order_id = o.id;
            // order.paid may include payments array
            if (o.payments && Array.isArray(o.payments) && o.payments.length > 0) {
                const p = o.payments[0];
                razorpay_payment_id = p.id || null;
                amount = (p.amount || 0) / 100.0;
                currency = p.currency || currency;
            }
        }

        // If no ids found, log and return 200 (avoid retries)
        if (!razorpay_order_id && !razorpay_payment_id) {
            await supabase.from('payment_webhook_logs').insert([{ event_id: req.body?.id || null, payload: req.body }]);
            console.warn('WEBHOOK_NO_IDS');
            return res.status(200).json({ ok: true });
        }

        // If payment already processed, return success
        if (razorpay_payment_id) {
            const { data: existingPayments } = await supabase.from('payments').select('*').eq('razorpay_payment_id', razorpay_payment_id).limit(1);
            if (Array.isArray(existingPayments) && existingPayments.length > 0) {
                console.log('PAYMENT_ALREADY_PROCESSED', razorpay_payment_id);
                return res.status(200).json({ ok: true });
            }
        }

        // Find booking by razorpay_order_id
        let booking = null;
        if (razorpay_order_id) {
            const { data: bdata } = await supabase.from('bookings').select('id').eq('razorpay_order_id', razorpay_order_id).limit(1);
            if (Array.isArray(bdata) && bdata.length > 0) booking = bdata[0];
        }

        if (!booking) {
            // No booking found — persist webhook for manual reconciliation and return 200
            await supabase.from('payment_webhook_logs').insert([{ event_id: req.body?.id || null, payload: req.body }]);
            console.warn('WEBHOOK_NO_BOOKING', razorpay_order_id);
            return res.status(200).json({ ok: true });
        }

        // Call finalize_payment RPC
        try {
            const rpcPayload = {
                _booking_id: booking.id,
                _razorpay_order_id: razorpay_order_id,
                _razorpay_payment_id: razorpay_payment_id,
                _amount: amount,
                _currency: currency,
                _payload: req.body
            };

            const { data: rpcData, error: rpcErr } = await supabase.rpc('finalize_payment', rpcPayload);
            if (rpcErr) {
                console.error('Finalize RPC error:', rpcErr);
                await supabase.from('payment_webhook_logs').insert([{ event_id: req.body?.id || null, payload: req.body }]);
                return res.status(500).json({ error: 'finalize failed' });
            }

            if (rpcData && rpcData.status === 'already_paid') {
                console.log('WEBHOOK_RETRY_IGNORED', razorpay_payment_id);
                return res.status(200).json({ ok: true });
            }

            console.log('PAYMENT_FINALIZED', { booking_id: booking.id, razorpay_payment_id });
            return res.status(200).json({ ok: true });
        } catch (e) {
            console.error('WEBHOOK_PROCESSING_ERROR', e?.message || e);
            await supabase.from('payment_webhook_logs').insert([{ event_id: req.body?.id || null, payload: req.body }]);
            return res.status(500).json({ error: 'processing error' });
        }

    } catch (err) {
        console.error('Webhook handler error:', err);
        return res.status(500).json({ error: 'internal error' });
    }
}
