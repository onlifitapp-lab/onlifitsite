import Razorpay from 'razorpay';
import { getServiceSupabaseClient, resolveRequestAuth, setCorsHeaders } from './_auth.js';

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = await resolveRequestAuth(req);
    if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

    const supabase = getServiceSupabaseClient();
    const clientId = auth.userId;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', clientId)
        .maybeSingle();

    if (!profile || profile.role !== 'client') {
        return res.status(403).json({ error: 'Only clients can purchase this subscription' });
    }

    const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'client_monthly_access_price_inr')
        .maybeSingle();

    const amountInr = Number(setting?.value) || 499;
    const amountPaise = Math.round(amountInr * 100);

    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        notes: { client_id: clientId, type: 'client_subscription' }
    });

    const { error: insertErr } = await supabase.from('client_subscriptions').insert([{
        client_id: clientId,
        razorpay_order_id: order.id,
        amount_paid: amountInr,
        status: 'created'
    }]);

    if (insertErr) {
        console.error('client_subscriptions insert failed:', insertErr);
        return res.status(500).json({ error: 'Failed to create order record' });
    }

    return res.status(201).json({
        success: true,
        orderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID
    });
}
