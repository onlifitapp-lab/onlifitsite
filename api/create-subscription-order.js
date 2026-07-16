import Razorpay from 'razorpay';
import { getServiceSupabaseClient, resolveRequestAuth, setCorsHeaders } from './_auth.js';

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = await resolveRequestAuth(req);
    if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

    const { plan } = req.body || {};
    if (!['pro', 'elite'].includes(plan)) {
        return res.status(400).json({ error: 'plan must be pro or elite' });
    }

    const supabase = getServiceSupabaseClient();
    const trainerId = auth.userId;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, email_verified')
        .eq('id', trainerId)
        .maybeSingle();

    if (!profile || profile.role !== 'trainer') {
        return res.status(403).json({ error: 'Only trainers can purchase a subscription' });
    }

    if (!profile.email_verified) {
        return res.status(403).json({
            error: 'Please verify your email before purchasing a subscription.',
            code: 'EMAIL_NOT_VERIFIED'
        });
    }

    await supabase.rpc('sync_subscription_expiry', { p_trainer_id: trainerId });

    const settingKey = plan === 'elite' ? 'elite_plan_price_inr' : 'pro_plan_price_inr';
    const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', settingKey)
        .maybeSingle();

    const amountInr = Number(setting?.value) || (plan === 'elite' ? 2999 : 999);
    const amountPaise = Math.round(amountInr * 100);

    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        notes: { trainer_id: trainerId, plan }
    });

    const { error: insertErr } = await supabase.from('subscription_payments').insert([{
        trainer_id: trainerId,
        plan,
        razorpay_order_id: order.id,
        amount: amountInr,
        status: 'created'
    }]);

    if (insertErr) {
        console.error('subscription_payments insert failed:', insertErr);
        return res.status(500).json({ error: 'Failed to create order record' });
    }

    return res.status(201).json({
        success: true,
        orderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        plan
    });
}
