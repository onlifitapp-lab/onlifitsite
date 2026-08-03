import { createHmac } from 'crypto';
import { getServiceSupabaseClient, resolveRequestAuth, setCorsHeaders } from './_auth.js';

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

    const { data: post } = await supabase
        .from('gym_hiring_posts')
        .select('id, gym_owner_id, amount_paid')
        .eq('razorpay_order_id', razorpay_order_id)
        .maybeSingle();

    if (!post || post.gym_owner_id !== auth.userId) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const { data: result, error } = await supabase.rpc('activate_gym_hiring_post', {
        p_post_id: post.id,
        p_razorpay_order_id: razorpay_order_id,
        p_razorpay_payment_id: razorpay_payment_id,
        p_amount: post.amount_paid
    });

    if (error) {
        console.error('activate_gym_hiring_post failed:', error);
        return res.status(500).json({ error: 'Failed to activate hiring post' });
    }

    return res.status(200).json({ success: true, ...result });
}
