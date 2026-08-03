import { getServiceSupabaseClient, setCorsHeaders } from './_auth.js';

// Simple in-memory KV store for rate limiting in serverless environments
// (Ephemeral but helps against burst spam per lambda container) — same
// pattern as create-ticket.js.
const rateLimitCache = new Map();
const MAX_SIGNUPS_PER_WINDOW = 3;
const WINDOW_DURATION_MS = 60 * 60 * 1000; // 1 hour

export default async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // --- RATE LIMITING CHOKEPOINT ---
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const now = Date.now();

        if (rateLimitCache.has(ip)) {
            let userData = rateLimitCache.get(ip);
            userData.requests = userData.requests.filter(timestamp => now - timestamp < WINDOW_DURATION_MS);

            if (userData.requests.length >= MAX_SIGNUPS_PER_WINDOW) {
                return res.status(429).json({ error: 'Rate limit exceeded. You can only create 3 gym accounts every hour. Please try again later.' });
            }
            userData.requests.push(now);
            rateLimitCache.set(ip, userData);
        } else {
            rateLimitCache.set(ip, { requests: [now] });
        }

        const { gymName, ownerName, city, numberOfLocations, phone, email, password } = req.body || {};

        if (!gymName || !ownerName || !city || !email || !password) {
            return res.status(400).json({ error: 'Gym name, owner name, city, email, and password are required' });
        }

        if (String(password).length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        const supabase = getServiceSupabaseClient();

        // Create the auth user server-side (not a normal client-side signUp
        // call) so this rate limit is actually enforceable — role is set in
        // raw_user_meta_data, handle_new_user() picks it up automatically.
        const { data: created, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role: 'gym_owner', name: ownerName }
        });

        if (createError) {
            const isExisting = /already registered|already exists|email.*in use/i.test(String(createError.message || ''));
            if (isExisting) {
                return res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
            }
            throw createError;
        }

        const ownerId = created.user.id;

        const { error: gymProfileError } = await supabase.from('gym_profiles').insert([{
            owner_id: ownerId,
            gym_name: gymName,
            owner_name: ownerName,
            city,
            number_of_locations: Number(numberOfLocations) > 0 ? Number(numberOfLocations) : 1,
            phone: phone || null
        }]);

        if (gymProfileError) {
            // Roll back the orphaned auth user (and its trigger-created profiles
            // row, via ON DELETE CASCADE) so a failed signup doesn't leave a
            // half-created account with no matching gym_profiles row.
            try {
                await supabase.auth.admin.deleteUser(ownerId);
            } catch (cleanupError) {
                console.error('Failed to clean up orphaned auth user after gym_profiles insert failure:', cleanupError);
            }
            throw gymProfileError;
        }

        return res.status(200).json({
            success: true,
            message: 'Gym account created successfully'
        });

    } catch (error) {
        console.error('Gym Signup Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
