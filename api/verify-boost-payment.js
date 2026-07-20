import { createHmac } from 'crypto';
import { getServiceSupabaseClient, resolveRequestAuth, setCorsHeaders } from './_auth.js';
import { logActivity } from './_analytics.js';

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = await resolveRequestAuth(req);
    if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const expectedSignature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const supabase = getServiceSupabaseClient();

    const { data: purchase } = await supabase
        .from('boost_purchases')
        .select('trainer_id')
        .eq('razorpay_order_id', razorpay_order_id)
        .maybeSingle();

    if (!purchase || purchase.trainer_id !== auth.userId) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const { data: result, error } = await supabase.rpc('activate_boost_purchase', {
        p_trainer_id: purchase.trainer_id,
        p_razorpay_order_id: razorpay_order_id,
        p_razorpay_payment_id: razorpay_payment_id
    });

    if (error) {
        console.error('activate_boost_purchase failed:', error);
        return res.status(500).json({ error: 'Failed to activate Boost' });
    }

    if (!result?.success) {
        return res.status(404).json({ error: 'Order not found', code: result?.code });
    }

    if (!result.idempotent_replay) {
        await logActivity(supabase, purchase.trainer_id, 'boost_purchase_paid', {
            boost_purchase_id: result.boost_purchase_id,
            expires_at: result.expires_at,
            invoice_number: result.invoice_number,
            razorpay_order_id,
            razorpay_payment_id
        });
    }

    return res.status(200).json({ success: true, ...result });
}
