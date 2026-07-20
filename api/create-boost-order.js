import Razorpay from 'razorpay';
import { getServiceSupabaseClient, resolveRequestAuth, setCorsHeaders } from './_auth.js';
import { logActivity } from './_analytics.js';

// Reuse window for an existing 'created' (unpaid) order instead of minting a
// duplicate Razorpay order every time a trainer opens the buy flow (e.g. a
// re-render, a retry after closing Checkout without paying). 1 hour balances
// "don't create junk orders for an abandoned tab" against "don't reuse a
// stale price if system_settings changes" — orders older than this get a
// fresh one at the current price instead.
const REUSE_WINDOW_MINUTES = 60;

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = await resolveRequestAuth(req);
    if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

    const durationDays = Number(req.body?.durationDays);
    if (![3, 7].includes(durationDays)) {
        return res.status(400).json({ error: 'durationDays must be 3 or 7' });
    }

    const supabase = getServiceSupabaseClient();
    const trainerId = auth.userId;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', trainerId)
        .maybeSingle();

    if (!profile || profile.role !== 'trainer') {
        return res.status(403).json({ error: 'Only trainers can purchase Boost' });
    }

    // Reuse a recent, still-unpaid order for the same duration instead of
    // creating a duplicate Razorpay order + boost_purchases row.
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

    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        // type: 'boost' tags the order/payment for observability in the
        // Razorpay dashboard. The webhook does NOT rely on this note being
        // present on the payment entity (Razorpay's propagation of order
        // notes onto the payment object is not guaranteed) — it determines
        // boost vs. subscription by looking the order id up in each table
        // directly, which is the actual source of truth. See
        // razorpay-subscription-webhook.js for that logic.
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
