import Razorpay from 'razorpay';
import { getServiceSupabaseClient, resolveRequestAuth, setCorsHeaders } from './_auth.js';

const PRICE_KEY_BY_COUNT = {
    1: 'gym_1post_price_inr',
    2: 'gym_2post_price_inr',
    3: 'gym_3post_price_inr'
};
const FALLBACK_PRICE_BY_COUNT = { 1: 1999, 2: 2999, 3: 3999 };

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = await resolveRequestAuth(req);
    if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

    const { postCount, speciality, experience_level, location, employment_type, gym_whatsapp, description } = req.body || {};

    const count = Number(postCount);
    if (![1, 2, 3].includes(count)) {
        return res.status(400).json({ error: 'postCount must be 1, 2, or 3' });
    }

    if (!speciality || !experience_level || !location || !employment_type || !gym_whatsapp) {
        return res.status(400).json({ error: 'speciality, experience_level, location, employment_type, and gym_whatsapp are required' });
    }

    if (!['full_time', 'part_time', 'both'].includes(employment_type)) {
        return res.status(400).json({ error: 'employment_type must be full_time, part_time, or both' });
    }

    const supabase = getServiceSupabaseClient();
    const gymOwnerId = auth.userId;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', gymOwnerId)
        .maybeSingle();

    if (!profile || profile.role !== 'gym_owner') {
        return res.status(403).json({ error: 'Only gym owners can post a hiring listing' });
    }

    const { data: gymProfile } = await supabase
        .from('gym_profiles')
        .select('id')
        .eq('owner_id', gymOwnerId)
        .maybeSingle();

    if (!gymProfile) {
        return res.status(404).json({ error: 'Gym profile not found for this account' });
    }

    const settingKey = PRICE_KEY_BY_COUNT[count];
    const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', settingKey)
        .maybeSingle();

    const amountInr = Number(setting?.value) || FALLBACK_PRICE_BY_COUNT[count];
    const amountPaise = Math.round(amountInr * 100);

    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        notes: { gym_owner_id: gymOwnerId, post_count: count, type: 'gym_hiring_post' }
    });

    const { data: post, error: insertErr } = await supabase.from('gym_hiring_posts').insert([{
        gym_owner_id: gymOwnerId,
        gym_profile_id: gymProfile.id,
        speciality,
        experience_level,
        location,
        employment_type,
        gym_whatsapp,
        description: description || null,
        post_count: count,
        razorpay_order_id: order.id,
        amount_paid: amountInr,
        status: 'draft'
    }]).select('id').single();

    if (insertErr) {
        console.error('gym_hiring_posts insert failed:', insertErr);
        return res.status(500).json({ error: 'Failed to create order record' });
    }

    return res.status(201).json({
        success: true,
        orderId: order.id,
        postId: post.id,
        amount: amountPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID
    });
}
