import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import { resolveRequestAuth, setCorsHeaders } from './_auth.js';

// Basic rate limiting map
const rateLimitCache = new Map();
const MAX_ORDERS_PER_WINDOW = 5;
const WINDOW_DURATION_MS = 15 * 60 * 1000;

export default async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        if (rateLimitCache.has(ip)) {
            let userData = rateLimitCache.get(ip);
            userData.requests = userData.requests.filter(t => now - t < WINDOW_DURATION_MS);
            if (userData.requests.length >= MAX_ORDERS_PER_WINDOW) {
                return res.status(429).json({ error: 'Global Rate Limit Exceeded.' });
            }
            userData.requests.push(now);
            rateLimitCache.set(ip, userData);
        } else {
            rateLimitCache.set(ip, { requests: [now] });
        }

        const { trainerId, planType, details } = req.body || {};

        const auth = await resolveRequestAuth(req);
        if (!auth.authenticated) {
            return res.status(auth.status || 401).json({ error: auth.error || 'Unauthorized' });
        }

        if (String(auth.role || '').toLowerCase() !== 'client') {
            return res.status(403).json({ error: 'Only clients can create payment orders' });
        }

        const clientId = auth.userId;

        if (!clientId || !trainerId || !planType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Initialize Razorpay
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.error("Missing Razorpay environmental variables.");
            return res.status(500).json({ error: 'Payment gateway configuration missing.' });
        }
        
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // Initialize Supabase Secure Client
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Fetch TRUE pricing from the database to prevent client tampering
        const { data: trainer, error: trainerError } = await supabase
            .from('profiles')
            .select('plans')
            .eq('id', trainerId)
            .single();

        if (trainerError || !trainer || !trainer.plans || !trainer.plans[planType]) {
            return res.status(400).json({ error: 'Invalid trainer or plan pricing' });
        }

        const truePriceINR = trainer.plans[planType].price;
        const planLabel = trainer.plans[planType].label || planType;

        // Create the pending booking row securely in the database
        const platformCommission = truePriceINR * 0.15;
        const dateVal = details?.date || new Date().toISOString().split('T')[0];
        const timeVal = details?.time || '10:00 AM';

        // Idempotency: prevent duplicate pending bookings for same client/trainer/plan/date/time
        const { data: existingArr, error: existingErr } = await supabase
            .from('bookings')
            .select('*')
            .match({
                client_id: clientId,
                trainer_id: trainerId,
                plan_type: planType,
                date: dateVal,
                time: timeVal,
                status: 'pending_payment'
            })
            .limit(1);

        if (existingErr) {
            throw existingErr;
        }

        let pendingBooking = Array.isArray(existingArr) && existingArr.length > 0 ? existingArr[0] : null;

        if (!pendingBooking) {
            const { data: inserted, error: insertError } = await supabase
                .from('bookings')
                .insert([{
                    client_id: clientId,
                    trainer_id: trainerId,
                    plan_type: planType,
                    plan_label: planLabel,
                    price: truePriceINR,
                    commission: platformCommission,
                    date: dateVal,
                    time: timeVal,
                    status: 'pending_payment'
                }])
                .select();

            if (insertError) {
                throw insertError;
            }

            pendingBooking = Array.isArray(inserted) && inserted.length > 0 ? inserted[0] : inserted;
        }

        // Create the active Razorpay Order
        // Amount is in smallest currency unit (paise) over INR so 100 paise = 1 INR
        const options = {
            amount: truePriceINR * 100, 
            currency: "INR",
            receipt: `order_rcptid_${pendingBooking.id.substring(0,8)}`,
            notes: {
                booking_id: pendingBooking.id,
                plan_label: planLabel,
            }
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // Persist razorpay order id back to the booking for reconciliation
        try {
            await supabase
                .from('bookings')
                .update({ razorpay_order_id: razorpayOrder.id, order_receipt: options.receipt })
                .eq('id', pendingBooking.id);
        } catch (e) {
            console.warn('Failed to persist razorpay_order_id on booking:', e?.message || e);
        }

        // Return the required Razorpay checkout details back to the client
        return res.status(200).json({
            success: true,
            orderId: razorpayOrder.id,
            bookingId: pendingBooking.id,
            amount: options.amount,
            currency: options.currency,
            keyId: process.env.RAZORPAY_KEY_ID // Safe to expose PUBLIC key ID
        });

    } catch (error) {
        console.error('Create Order Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}