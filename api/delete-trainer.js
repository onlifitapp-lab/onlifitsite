import { createClient } from '@supabase/supabase-js';

// Basic rate limiting map (ephemeral per serverless container)
const rateLimitCache = new Map();
const MAX_DELETES_PER_WINDOW = 10;
const WINDOW_DURATION_MS = 15 * 60 * 1000;

function getIp(req) {
    return req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
}

function extractBearerToken(req) {
    const header = req.headers?.authorization || '';
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
        return header.slice(7).trim();
    }
    return null;
}

function isIgnorableDbError(error) {
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    // Ignore missing table / relation errors for optional tables across installs
    return code === '42P01' || message.includes('does not exist');
}

function parseStorageObject(urlString) {
    try {
        const u = new URL(urlString);
        const parts = u.pathname.split('/').filter(Boolean);
        const objectIdx = parts.findIndex(p => p === 'object');
        if (objectIdx === -1) return null;

        const mode = parts[objectIdx + 1]; // public | sign
        if (mode !== 'public' && mode !== 'sign') return null;

        const bucket = parts[objectIdx + 2];
        const path = parts.slice(objectIdx + 3).join('/');
        if (!bucket || !path) return null;
        return { bucket, path };
    } catch {
        return null;
    }
}

async function safeDelete(builderPromise) {
    try {
        const { error } = await builderPromise;
        if (error && !isIgnorableDbError(error)) throw error;
        return true;
    } catch (err) {
        if (isIgnorableDbError(err)) return false;
        throw err;
    }
}

async function removeStorageFiles(supabase, urls) {
    const objects = [];
    for (const u of urls) {
        if (!u || typeof u !== 'string') continue;
        const obj = parseStorageObject(u);
        if (obj) objects.push(obj);
    }

    // Deduplicate
    const unique = new Map();
    for (const obj of objects) {
        unique.set(`${obj.bucket}:${obj.path}`, obj);
    }

    for (const { bucket, path } of unique.values()) {
        try {
            await supabase.storage.from(bucket).remove([path]);
        } catch {
            // Best effort cleanup; don't block deletion if storage removal fails
        }
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // --- RATE LIMITING ---
        const ip = getIp(req);
        const now = Date.now();
        if (rateLimitCache.has(ip)) {
            let userData = rateLimitCache.get(ip);
            userData.requests = userData.requests.filter(t => now - t < WINDOW_DURATION_MS);
            if (userData.requests.length >= MAX_DELETES_PER_WINDOW) {
                return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
            }
            userData.requests.push(now);
            rateLimitCache.set(ip, userData);
        } else {
            rateLimitCache.set(ip, { requests: [now] });
        }

        const { trainerId } = req.body || {};
        if (!trainerId) {
            return res.status(400).json({ error: 'Missing trainerId' });
        }

        const accessToken = extractBearerToken(req);
        if (!accessToken) {
            return res.status(401).json({ error: 'Missing admin access token' });
        }

        if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return res.status(500).json({ error: 'Server is missing Supabase environment variables' });
        }

        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { persistSession: false, autoRefreshToken: false } }
        );

        // Verify caller is an authenticated admin
        const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid admin session' });
        }

        const { data: callerProfile, error: callerProfileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (callerProfileError || !callerProfile || String(callerProfile.role || '').toLowerCase() !== 'admin') {
            return res.status(403).json({ error: 'Admin role required' });
        }

        // Fetch trainer profile (for validation and storage cleanup)
        const { data: trainer, error: trainerError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', trainerId)
            .single();

        if (trainerError || !trainer) {
            return res.status(404).json({ error: 'Trainer not found' });
        }

        // Best-effort storage cleanup
        const storageUrls = [];
        if (trainer.avatar_url) storageUrls.push(trainer.avatar_url);
        if (trainer.profile_photo_url) storageUrls.push(trainer.profile_photo_url);
        if (trainer.kyc_front_url) storageUrls.push(trainer.kyc_front_url);
        if (trainer.kyc_back_url) storageUrls.push(trainer.kyc_back_url);

        if (Array.isArray(trainer.certificate_urls)) {
            for (const c of trainer.certificate_urls) {
                if (c?.url) storageUrls.push(c.url);
            }
        }

        if (Array.isArray(trainer.certifications)) {
            for (const c of trainer.certifications) {
                if (typeof c === 'string' && c.startsWith('http')) storageUrls.push(c);
            }
        }

        await removeStorageFiles(supabase, storageUrls);

        // Delete dependent data that can block profile deletion (FK constraints)
        await safeDelete(supabase.from('bookings').delete().or(`client_id.eq.${trainerId},trainer_id.eq.${trainerId}`));
        await safeDelete(supabase.from('messages').delete().or(`sender_id.eq.${trainerId},receiver_id.eq.${trainerId}`));
        await safeDelete(supabase.from('typing_status').delete().or(`user_id.eq.${trainerId},chat_with.eq.${trainerId}`));
        await safeDelete(supabase.from('notifications').delete().eq('user_id', trainerId));
        await safeDelete(supabase.from('reviews').delete().or(`client_id.eq.${trainerId},trainer_id.eq.${trainerId}`));
        await safeDelete(supabase.from('user_activity_log').delete().eq('user_id', trainerId));

        // Support tickets are SET NULL on delete, but ticket_messages can also reference sender_id
        await safeDelete(supabase.from('ticket_messages').delete().eq('sender_id', trainerId));

        // Delete profile
        const { error: profileDeleteError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', trainerId);

        if (profileDeleteError) throw profileDeleteError;

        // Delete auth user (removes remaining auth record)
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(trainerId);
        if (authDeleteError) {
            return res.status(500).json({ error: `Profile deleted, but failed to delete auth user: ${authDeleteError.message}` });
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Delete Trainer Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
