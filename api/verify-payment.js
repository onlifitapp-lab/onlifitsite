import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { setCorsHeaders } from './_auth.js';

export default async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature, 
            booking_id
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !booking_id) {
            return res.status(400).json({ error: 'Missing security parameters' });
        }

        // 1. Verify Payment Security Signature (HMAC SHA256)
        // This math is exactly how Razorpay proves the payment wasn't faked
        const secret = process.env.RAZORPAY_KEY_SECRET;
        
        if (!secret) {
            console.error("Missing RAZORPAY_KEY_SECRET");
            return res.status(500).json({ error: 'Gateway configuration missing' });
        }

        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ error: "PAYMENT SIGNATURE MANIPULATION DETECTED" });
        }

        // 2. Initialize Secure Backend Supabase Client
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Use atomic server-side function to finalize payment and booking in one transaction
        // If webhook already processed this payment, short-circuit
        try {
            const { data: existingPayment } = await supabase.from('payments').select('id').eq('razorpay_payment_id', razorpay_payment_id).limit(1);
            if (Array.isArray(existingPayment) && existingPayment.length > 0) {
                console.log('PAYMENT_ALREADY_PROCESSED', razorpay_payment_id);
                return res.status(200).json({ success: true, message: 'Payment already processed' });
            }
        } catch (e) {
            // continue
        }

        try {
            const rpcPayload = {
                _booking_id: booking_id,
                _razorpay_order_id: razorpay_order_id,
                _razorpay_payment_id: razorpay_payment_id,
                _amount: null,
                _currency: 'INR',
                _payload: req.body
            };

            // Try to fetch booking price to pass amount (best-effort); ignore if missing
            try {
                const { data: bdata } = await supabase.from('bookings').select('price,payment_status').eq('id', booking_id).limit(1);
                if (Array.isArray(bdata) && bdata.length > 0) {
                    rpcPayload._amount = bdata[0].price;
                    if (bdata[0].payment_status === 'paid') {
                        console.log('BOOKING_ALREADY_PAID', booking_id);
                        return res.status(200).json({ success: true, message: 'Booking already marked paid' });
                    }
                }
            } catch (e) {
                // continue — RPC will still run
            }

            const { data: rpcData, error: rpcErr } = await supabase.rpc('finalize_payment', rpcPayload);

            if (rpcErr) {
                console.error('Finalization RPC error:', rpcErr);
                return res.status(500).json({ error: 'Database finalization failed' });
            }

            if (rpcData && rpcData.status === 'already_paid') {
                console.log('PAYMENT_ALREADY_PROCESSED', razorpay_payment_id);
                return res.status(200).json({ success: true, message: 'Payment already processed' });
            }

            console.log('PAYMENT_UPSERT_SUCCESS', { booking_id, razorpay_payment_id });

            // Fetch updated booking to include in response
            const { data: updatedArr } = await supabase.from('bookings').select('*').eq('id', booking_id).limit(1);
            const updatedBooking = Array.isArray(updatedArr) && updatedArr.length > 0 ? updatedArr[0] : null;

            // Notify trainer if booking updated and trainer_id present
            if (updatedBooking && updatedBooking.trainer_id) {
                try {
                    await supabase.from('notifications').insert([{
                        user_id: updatedBooking.trainer_id,
                        type: 'booking',
                        title: 'New Confirmed Booking!',
                        message: `A client has booked and paid for a ${updatedBooking.plan_label} session. Check your dashboard.`
                    }]);
                } catch (nerr) {
                    console.warn('Notification insertion failed:', nerr?.message || nerr);
                }
            }

            return res.status(200).json({ success: true, message: 'Payment finalized', data: updatedBooking });
        } catch (e) {
            console.error('Error during payment finalization:', e?.message || e);
            return res.status(500).json({ error: 'Internal server error processing payment' });
        }

    } catch (error) {
        console.error('Verify Order Error:', error);
        return res.status(500).json({ error: 'Internal server error processing payment' });
    }
}