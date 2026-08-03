import Razorpay from 'razorpay';
import { getServiceSupabaseClient, resolveRequestAuth, setCorsHeaders } from './_auth.js';

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = await resolveRequestAuth(req);
    if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

    const { city } = req.body || {};
    if (!city) {
        return res.status(400).json({ error: 'city is required' });
    }

    const supabase = getServiceSupabaseClient();
    const gymOwnerId = auth.userId;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', gymOwnerId)
        .maybeSingle();

    if (!profile || profile.role !== 'gym_owner') {
        return res.status(403).json({ error: 'Only gym owners can purchase city access' });
    }

    const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'gym_owner_city_unlock_price_inr')
        .maybeSingle();

    const amountInr = Number(setting?.value) || 1999;
    const amountPaise = Math.round(amountInr * 100);

    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        notes: { gym_owner_id: gymOwnerId, city, type: 'gym_owner_city_access' }
    });

    const { error: insertErr } = await supabase.from('gym_owner_city_access').insert([{
        gym_owner_id: gymOwnerId,
        city,
        razorpay_order_id: order.id,
        amount_paid: amountInr,
        status: 'created'
    }]);

    if (insertErr) {
        console.error('gym_owner_city_access insert failed:', insertErr);
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
