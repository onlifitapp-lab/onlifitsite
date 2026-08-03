import { createHmac } from 'crypto';
import { getServiceSupabaseClient, resolveRequestAuth, setCorsHeaders } from './_auth.js';
import { logActivity } from './_analytics.js';

// Consolidated payment-verification endpoint for all Razorpay order types —
// merged from 5 separate files to stay under Vercel's Hobby-plan serverless
// function cap. Dispatch is on req.body.type; each branch is the untouched
// logic from its original file (verify-boost-payment.js,
// verify-subscription-payment.js, verify-client-payment.js,
// verify-gymowner-payment.js, verify-hiringpost-payment.js).

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = await resolveRequestAuth(req);
    if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

    const { type, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
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

    switch (type) {
        case 'boost':
            return verifyBoostPayment(res, supabase, auth, razorpay_order_id, razorpay_payment_id);
        case 'subscription':
            return verifySubscriptionPayment(res, supabase, auth, razorpay_order_id, razorpay_payment_id);
        case 'client':
            return verifyClientPayment(res, supabase, auth, razorpay_order_id, razorpay_payment_id);
        case 'gymowner':
            return verifyGymOwnerPayment(res, supabase, auth, razorpay_order_id, razorpay_payment_id);
        case 'hiringpost':
            return verifyHiringPostPayment(res, supabase, auth, razorpay_order_id, razorpay_payment_id);
        default:
            return res.status(400).json({ error: 'Unknown or missing order type' });
    }
}

async function verifyBoostPayment(res, supabase, auth, razorpay_order_id, razorpay_payment_id) {
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

async function verifySubscriptionPayment(res, supabase, auth, razorpay_order_id, razorpay_payment_id) {
    const { data: payment } = await supabase
        .from('subscription_payments')
        .select('trainer_id, plan, amount')
        .eq('razorpay_order_id', razorpay_order_id)
        .maybeSingle();

    if (!payment || payment.trainer_id !== auth.userId) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const { data: result, error } = await supabase.rpc('activate_subscription_payment', {
        p_trainer_id: payment.trainer_id,
        p_plan: payment.plan,
        p_razorpay_order_id: razorpay_order_id,
        p_razorpay_payment_id: razorpay_payment_id,
        p_amount: payment.amount
    });

    if (error) {
        console.error('activate_subscription_payment failed:', error);
        return res.status(500).json({ error: 'Failed to activate subscription' });
    }

    return res.status(200).json({ success: true, ...result });
}

async function verifyClientPayment(res, supabase, auth, razorpay_order_id, razorpay_payment_id) {
    const { data: payment } = await supabase
        .from('client_subscriptions')
        .select('client_id, amount_paid')
        .eq('razorpay_order_id', razorpay_order_id)
        .maybeSingle();

    if (!payment || payment.client_id !== auth.userId) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const { data: result, error } = await supabase.rpc('activate_client_subscription', {
        p_client_id: payment.client_id,
        p_razorpay_order_id: razorpay_order_id,
        p_razorpay_payment_id: razorpay_payment_id,
        p_amount: payment.amount_paid
    });

    if (error) {
        console.error('activate_client_subscription failed:', error);
        return res.status(500).json({ error: 'Failed to activate subscription' });
    }

    return res.status(200).json({ success: true, ...result });
}

async function verifyGymOwnerPayment(res, supabase, auth, razorpay_order_id, razorpay_payment_id) {
    const { data: access } = await supabase
        .from('gym_owner_city_access')
        .select('gym_owner_id, city, amount_paid')
        .eq('razorpay_order_id', razorpay_order_id)
        .maybeSingle();

    if (!access || access.gym_owner_id !== auth.userId) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const { data: result, error } = await supabase.rpc('activate_gym_owner_access', {
        p_gym_owner_id: access.gym_owner_id,
        p_city: access.city,
        p_razorpay_order_id: razorpay_order_id,
        p_razorpay_payment_id: razorpay_payment_id,
        p_amount: access.amount_paid
    });

    if (error) {
        console.error('activate_gym_owner_access failed:', error);
        return res.status(500).json({ error: 'Failed to activate gym owner access' });
    }

    return res.status(200).json({ success: true, ...result });
}

async function verifyHiringPostPayment(res, supabase, auth, razorpay_order_id, razorpay_payment_id) {
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
