import { createHmac } from 'crypto';
import { getServiceSupabaseClient, setCorsHeaders } from './_auth.js';
import { logActivity } from './_analytics.js';

// Shared Razorpay webhook for BOTH subscription and Boost orders (one
// endpoint, per design decision — not split into separate webhook URLs).
// Durable backup path if the client never calls verify-subscription-payment
// / verify-boost-payment (tab closed, network drop). Safe on retries: both
// activation RPCs are idempotent on razorpay_payment_id.
//
// Branching is decided by looking the order id up directly in
// boost_purchases / subscription_payments — that table membership is the
// actual source of truth, not the order's notes.type tag. Razorpay does not
// guarantee that notes set on an Order are copied onto the Payment entity a
// webhook delivers, so parsing notes.type at webhook time would be fragile.
// notes.type is still set at order-creation time (create-boost-order.js,
// create-subscription-order.js) purely for observability in the Razorpay
// dashboard, not as this webhook's routing mechanism.
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
    const supabase = getServiceSupabaseClient();

    if (event.event === 'payment.captured') {
        return handlePaymentCaptured(supabase, event, res);
    }

    if (event.event === 'payment.failed') {
        return handlePaymentFailed(supabase, event, res);
    }

    return res.status(200).json({ received: true, ignored: true });
}

async function handlePaymentCaptured(supabase, event, res) {
    const paymentEntity = event.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;
    const amountPaise = paymentEntity?.amount;

    if (!orderId || !paymentId) {
        return res.status(400).json({ error: 'Malformed webhook payload' });
    }

    const { data: boostPurchase } = await supabase
        .from('boost_purchases')
        .select('trainer_id')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

    if (boostPurchase) {
        const { data: result, error } = await supabase.rpc('activate_boost_purchase', {
            p_trainer_id: boostPurchase.trainer_id,
            p_razorpay_order_id: orderId,
            p_razorpay_payment_id: paymentId
        });

        if (error) {
            console.error('webhook activate_boost_purchase failed:', error);
            return res.status(500).json({ error: 'Failed to process webhook' });
        }

        if (result?.success && !result.idempotent_replay) {
            await logActivity(supabase, boostPurchase.trainer_id, 'boost_purchase_paid', {
                razorpay_order_id: orderId,
                razorpay_payment_id: paymentId,
                expires_at: result.expires_at,
                invoice_number: result.invoice_number,
                source: 'webhook'
            });
        }

        return res.status(200).json({ received: true });
    }

    const { data: clientSub } = await supabase
        .from('client_subscriptions')
        .select('client_id')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

    if (clientSub) {
        const { error } = await supabase.rpc('activate_client_subscription', {
            p_client_id: clientSub.client_id,
            p_razorpay_order_id: orderId,
            p_razorpay_payment_id: paymentId,
            p_amount: amountPaise ? amountPaise / 100 : null
        });

        if (error) {
            console.error('webhook activate_client_subscription failed:', error);
            return res.status(500).json({ error: 'Failed to process webhook' });
        }

        return res.status(200).json({ received: true });
    }

    const { data: gymAccess } = await supabase
        .from('gym_owner_city_access')
        .select('gym_owner_id, city, amount_paid')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

    if (gymAccess) {
        const { error } = await supabase.rpc('activate_gym_owner_access', {
            p_gym_owner_id: gymAccess.gym_owner_id,
            p_city: gymAccess.city,
            p_razorpay_order_id: orderId,
            p_razorpay_payment_id: paymentId,
            p_amount: amountPaise ? amountPaise / 100 : gymAccess.amount_paid
        });

        if (error) {
            console.error('webhook activate_gym_owner_access failed:', error);
            return res.status(500).json({ error: 'Failed to process webhook' });
        }

        return res.status(200).json({ received: true });
    }

    const { data: hiringPost } = await supabase
        .from('gym_hiring_posts')
        .select('id, amount_paid')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

    if (hiringPost) {
        const { error } = await supabase.rpc('activate_gym_hiring_post', {
            p_post_id: hiringPost.id,
            p_razorpay_order_id: orderId,
            p_razorpay_payment_id: paymentId,
            p_amount: amountPaise ? amountPaise / 100 : hiringPost.amount_paid
        });

        if (error) {
            console.error('webhook activate_gym_hiring_post failed:', error);
            return res.status(500).json({ error: 'Failed to process webhook' });
        }

        return res.status(200).json({ received: true });
    }

    const { data: subPayment } = await supabase
        .from('subscription_payments')
        .select('trainer_id, plan, amount')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

    if (!subPayment) {
        // Not an order this platform recognizes — ignore.
        return res.status(200).json({ received: true, ignored: true });
    }

    const { error } = await supabase.rpc('activate_subscription_payment', {
        p_trainer_id: subPayment.trainer_id,
        p_plan: subPayment.plan,
        p_razorpay_order_id: orderId,
        p_razorpay_payment_id: paymentId,
        p_amount: amountPaise ? amountPaise / 100 : subPayment.amount
    });

    if (error) {
        console.error('webhook activate_subscription_payment failed:', error);
        return res.status(500).json({ error: 'Failed to process webhook' });
    }

    return res.status(200).json({ received: true });
}

async function handlePaymentFailed(supabase, event, res) {
    const paymentEntity = event.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const reason = paymentEntity?.error_description || paymentEntity?.error_reason || 'Payment failed';

    if (!orderId) {
        return res.status(200).json({ received: true, ignored: true });
    }

    // Only boost_purchases gets a 'failed' write path today — mirrors the
    // scope of this Phase (subscription_payments has no existing failure
    // handling to extend, and adding one is out of scope for Boost).
    const { data: boostPurchase } = await supabase
        .from('boost_purchases')
        .select('id, trainer_id, status')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

    if (boostPurchase && boostPurchase.status === 'created') {
        await supabase.from('boost_purchases')
            .update({
                status: 'failed',
                failure_reason: reason,
                payment_status: paymentEntity?.status || null
            })
            .eq('id', boostPurchase.id);

        await logActivity(supabase, boostPurchase.trainer_id, 'boost_purchase_failed', {
            razorpay_order_id: orderId,
            reason
        });
    }

    return res.status(200).json({ received: true });
}
