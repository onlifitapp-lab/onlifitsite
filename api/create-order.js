import Razorpay from 'razorpay';
import { getServiceSupabaseClient, resolveRequestAuth, setCorsHeaders } from './_auth.js';
import { logActivity } from './_analytics.js';

// Consolidated order-creation endpoint for all Razorpay order types (boost,
// subscription, client, gym_owner, hiring_post) — merged from 5 separate
// files to stay under Vercel's Hobby-plan serverless function cap. Dispatch
// is on req.body.type; each branch is the untouched logic from its original
// file (create-boost-order.js, create-subscription-order.js,
// create-client-order.js, create-gymowner-order.js,
// create-hiringpost-order.js).

const REUSE_WINDOW_MINUTES = 60;

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = await resolveRequestAuth(req);
    if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

    const { type } = req.body || {};
    const supabase = getServiceSupabaseClient();
    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    switch (type) {
        case 'boost':
            return createBoostOrder(req, res, supabase, razorpay, auth);
        case 'subscription':
            return createSubscriptionOrder(req, res, supabase, razorpay, auth);
        case 'client':
            return createClientOrder(req, res, supabase, razorpay, auth);
        case 'gymowner':
            return createGymOwnerOrder(req, res, supabase, razorpay, auth);
        case 'hiringpost':
            return createHiringPostOrder(req, res, supabase, razorpay, auth);
        default:
            return res.status(400).json({ error: 'Unknown or missing order type' });
    }
}

async function createBoostOrder(req, res, supabase, razorpay, auth) {
    const durationDays = Number(req.body?.durationDays);
    if (![3, 7].includes(durationDays)) {
        return res.status(400).json({ error: 'durationDays must be 3 or 7' });
    }

    const trainerId = auth.userId;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', trainerId)
        .maybeSingle();

    if (!profile || profile.role !== 'trainer') {
        return res.status(403).json({ error: 'Only trainers can purchase Boost' });
    }

    const reuseCutoff = new Date(Date.now() - REUSE_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { data: existing } = await supabase
        .from('boost_purchases')
        .select('razorpay_order_id, amount, duration_days, created_at')
        .eq('trainer_id', trainerId)
        .eq('duration_days', durationDays)
        .eq('status', 'created')
        .gte('created_at', reuseCutoff)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existing?.razorpay_order_id) {
        return res.status(200).json({
            success: true,
            reused: true,
            orderId: existing.razorpay_order_id,
            amount: Math.round(Number(existing.amount) * 100),
            currency: 'INR',
            keyId: process.env.RAZORPAY_KEY_ID,
            durationDays
        });
    }

    const settingKey = durationDays === 7 ? 'boost_7day_price_inr' : 'boost_3day_price_inr';
    const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', settingKey)
        .maybeSingle();

    const amountInr = Number(setting?.value) || (durationDays === 7 ? 999 : 499);
    const amountPaise = Math.round(amountInr * 100);

    const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        notes: { trainer_id: trainerId, duration_days: String(durationDays), type: 'boost' }
    });

    const { error: insertErr } = await supabase.from('boost_purchases').insert([{
        trainer_id: trainerId,
        duration_days: durationDays,
        amount: amountInr,
        razorpay_order_id: order.id,
        status: 'created'
    }]);

    if (insertErr) {
        console.error('boost_purchases insert failed:', insertErr);
        return res.status(500).json({ error: 'Failed to create order record' });
    }

    await logActivity(supabase, trainerId, 'boost_purchase_created', {
        duration_days: durationDays,
        amount: amountInr,
        razorpay_order_id: order.id
    });

    return res.status(201).json({
        success: true,
        reused: false,
        orderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        durationDays
    });
}

async function createSubscriptionOrder(req, res, supabase, razorpay, auth) {
    const { plan } = req.body || {};
    if (!['pro', 'elite'].includes(plan)) {
        return res.status(400).json({ error: 'plan must be pro or elite' });
    }

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

    const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        notes: { trainer_id: trainerId, plan, type: 'subscription' }
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

async function createClientOrder(req, res, supabase, razorpay, auth) {
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

async function createGymOwnerOrder(req, res, supabase, razorpay, auth) {
    const { city } = req.body || {};
    if (!city) {
        return res.status(400).json({ error: 'city is required' });
    }

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

const HIRINGPOST_PRICE_KEY_BY_COUNT = {
    1: 'gym_1post_price_inr',
    2: 'gym_2post_price_inr',
    3: 'gym_3post_price_inr'
};
const HIRINGPOST_FALLBACK_PRICE_BY_COUNT = { 1: 1999, 2: 2999, 3: 3999 };

async function createHiringPostOrder(req, res, supabase, razorpay, auth) {
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

    const settingKey = HIRINGPOST_PRICE_KEY_BY_COUNT[count];
    const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', settingKey)
        .maybeSingle();

    const amountInr = Number(setting?.value) || HIRINGPOST_FALLBACK_PRICE_BY_COUNT[count];
    const amountPaise = Math.round(amountInr * 100);

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
