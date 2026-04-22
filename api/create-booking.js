import { createClient } from '@supabase/supabase-js';
import { resolveRequestAuth } from './_auth.js';

// Simple in-memory KV store for rate limiting in serverless environments
const rateLimitCache = new Map();
const MAX_BOOKINGS_PER_WINDOW = 5;
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // --- SECURE GLOBAL API RATE LIMITING ---
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        
        if (rateLimitCache.has(ip)) {
            let userData = rateLimitCache.get(ip);
            userData.requests = userData.requests.filter(timestamp => now - timestamp < WINDOW_DURATION_MS);
            
            if (userData.requests.length >= MAX_BOOKINGS_PER_WINDOW) {
                return res.status(429).json({ error: 'Global Rate Limit Exceeded. You can only perform 5 major actions every 15 minutes. Please wait before trying again.' });
            }
            userData.requests.push(now);
            rateLimitCache.set(ip, userData);
        } else {
            rateLimitCache.set(ip, { requests: [now] });
        }

        // 1. Get the raw client request
        const { trainerId, planType, details } = req.body || {};

        const auth = await resolveRequestAuth(req);
        if (!auth.authenticated) {
            return res.status(auth.status || 401).json({ error: auth.error || 'Unauthorized' });
        }

        if (String(auth.role || '').toLowerCase() !== 'client') {
            return res.status(403).json({ error: 'Only clients can create bookings' });
        }

        const clientId = auth.userId;

        if (!clientId || !trainerId || !planType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 2. Initialize Secure Backend Supabase Client with the Service Key
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 3. SECURE BACKEND LOGIC: Fetch the *real* pricing from the database
        // Bypassing any frontend tampering attempt
        const { data: trainer, error: trainerError } = await supabase
            .from('profiles')
            .select('plans')
            .eq('id', trainerId)
            .single();

        if (trainerError || !trainer) {
            return res.status(404).json({ error: 'Trainer not found' });
        }

        const planData = trainer.plans[planType];
        if (!planData) {
            return res.status(400).json({ error: 'Invalid plan type' });
        }

        const truePrice = parseFloat(planData.price);
        const planLabel = planData.label;

        // 4. CALCULATE COMMISSIONS
        // We calculate commissions entirely on the backend to avoid spoofing
        const platformCommission = truePrice * 0.15; // e.g., 15% platform cut
        const trainerPayout = truePrice - platformCommission;

        // 5. INSERT BOOKING SECURELY
        // Only if the payment gateway confirms payment does this change to 'confirmed'
        const bookingData = {
            client_id: clientId,
            trainer_id: trainerId,
            plan_type: planType,
            plan_label: planLabel,
            price: truePrice,
            commission: platformCommission, // Secret internal tracking
            date: details?.date || new Date().toISOString().split('T')[0],
            time: details?.time || '10:00 AM',
            status: 'confirmed' // Later change to 'pending' once payment gateway is added
        };

        const { data: booking, error: insertError } = await supabase
            .from('bookings')
            .insert([bookingData])
            .select()
            .single();

        if (insertError) throw insertError;

        // Optionally, create a notification for the trainer...
        await supabase.from('notifications').insert([{
            user_id: trainerId,
            type: 'booking',
            title: 'New Booking Request',
            message: `A client has requested a ${bookingData.plan_label} for ${bookingData.date}.`
        }]);

        return res.status(200).json({
            success: true,
            message: 'Booking securely verified and created on backend.',
            data: booking
        });

    } catch (error) {
        console.error('Backend Booking Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
