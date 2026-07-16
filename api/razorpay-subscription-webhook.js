import { createHmac } from 'crypto';
import { getServiceSupabaseClient, setCorsHeaders } from './_auth.js';

// Webhook is the durable backup path if the client never calls
// verify-subscription-payment (tab closed, network drop). Safe on retries:
// activate_subscription_payment is idempotent on razorpay_payment_id.
export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    const rawBody = JSON.stringify(req.body);

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (signature !== expected) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body;
    if (event.event !== 'payment.captured') {
        return res.status(200).json({ received: true, ignored: true });
    }

    const paymentEntity = event.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;
    const amountPaise = paymentEntity?.amount;

    if (!orderId || !paymentId) {
        return res.status(400).json({ error: 'Malformed webhook payload' });
    }

    const supabase = getServiceSupabaseClient();

    const { data: payment } = await supabase
        .from('subscription_payments')
        .select('trainer_id, plan, amount')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

    if (!payment) {
        // Not a subscription order (could be a different order type) — ignore.
        return res.status(200).json({ received: true, ignored: true });
    }

    const { error } = await supabase.rpc('activate_subscription_payment', {
        p_trainer_id: payment.trainer_id,
        p_plan: payment.plan,
        p_razorpay_order_id: orderId,
        p_razorpay_payment_id: paymentId,
        p_amount: amountPaise ? amountPaise / 100 : payment.amount
    });

    if (error) {
        console.error('webhook activate_subscription_payment failed:', error);
        return res.status(500).json({ error: 'Failed to process webhook' });
    }

    return res.status(200).json({ received: true });
}
