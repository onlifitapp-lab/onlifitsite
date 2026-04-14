import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';

// Basic rate limiting map
const rateLimitCache = new Map();
const MAX_ORDERS_PER_WINDOW = 5;
const WINDOW_DURATION_MS = 15 * 60 * 1000;

export default async function handler(req, res) {
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

        const { clientId, trainerId, planType, details } = req.body;

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
        const { data: pendingBooking, error: insertError } = await supabase
            .from('bookings')
            .insert([{
                client_id: clientId,
                trainer_id: trainerId,
                plan_type: planType,
                plan_label: planLabel,
                price: truePriceINR,
                commission: platformCommission,
                date: details?.date || new Date().toISOString().split('T')[0],
                time: details?.time || '10:00 AM',
                status: 'pending_payment'
            }])
            .select()
            .single();

        if (insertError) {
            throw insertError;
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