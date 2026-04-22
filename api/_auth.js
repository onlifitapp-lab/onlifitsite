import { createClient } from '@supabase/supabase-js';
import { createClerkClient, verifyToken } from '@clerk/backend';

let _serviceSupabase = null;
let _clerkClient = null;

function getSupabaseUrl() {
    return process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
}

function getSupabaseServiceKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function getClerkSecretKey() {
    return process.env.CLERK_SECRET_KEY || '';
}

export function getServiceSupabaseClient() {
    if (_serviceSupabase) return _serviceSupabase;

    const url = getSupabaseUrl();
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) {
        throw new Error('Server is missing Supabase environment variables');
    }

    _serviceSupabase = createClient(url, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });

    return _serviceSupabase;
}

function getClerkClient() {
    if (_clerkClient) return _clerkClient;

    const secretKey = getClerkSecretKey();
    if (!secretKey) return null;

    _clerkClient = createClerkClient({ secretKey });
    return _clerkClient;
}

export function extractBearerToken(req) {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }

    // Backward compatibility while frontend migrates to Authorization header.
    const bodyHeader = req.body?.authHeader;
    if (typeof bodyHeader === 'string' && bodyHeader.toLowerCase().startsWith('bearer ')) {
        return bodyHeader.slice(7).trim();
    }

    return null;
}

async function getProfileById(supabase, id) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, name')
        .eq('id', id)
        .maybeSingle();

    if (error) return null;
    return data || null;
}

async function getProfileForClerkUser(supabase, clerkUserId, email) {
    // Try optional clerk_id column if present.
    if (clerkUserId) {
        const byClerk = await supabase
            .from('profiles')
            .select('id, email, role, name')
            .eq('clerk_id', clerkUserId)
            .limit(1);

        if (!byClerk.error && Array.isArray(byClerk.data) && byClerk.data.length > 0) {
            return byClerk.data[0];
        }
    }

    if (!email) return null;

    const byEmail = await supabase
        .from('profiles')
        .select('id, email, role, name')
        .eq('email', email)
        .limit(1);

    if (byEmail.error || !Array.isArray(byEmail.data) || byEmail.data.length === 0) {
        return null;
    }

    return byEmail.data[0];
}

function primaryEmailFromClerkUser(clerkUser) {
    if (!clerkUser) return null;

    const primaryEmailId = clerkUser.primaryEmailAddressId || null;
    if (primaryEmailId && Array.isArray(clerkUser.emailAddresses)) {
        const primary = clerkUser.emailAddresses.find((entry) => entry.id === primaryEmailId);
        if (primary?.emailAddress) return primary.emailAddress;
    }

    return clerkUser.emailAddresses?.[0]?.emailAddress || null;
}

export async function resolveRequestAuth(req) {
    const token = extractBearerToken(req);
    if (!token) {
        return {
            authenticated: false,
            status: 401,
            error: 'Missing access token'
        };
    }

    let supabase;
    try {
        supabase = getServiceSupabaseClient();
    } catch (error) {
        return {
            authenticated: false,
            status: 500,
            error: error.message
        };
    }

    // First, try Supabase JWTs for backward compatibility.
    const { data: { user: supabaseUser }, error: supabaseAuthError } = await supabase.auth.getUser(token);
    if (!supabaseAuthError && supabaseUser) {
        const profile = await getProfileById(supabase, supabaseUser.id);
        return {
            authenticated: true,
            provider: 'supabase',
            userId: supabaseUser.id,
            email: supabaseUser.email || profile?.email || null,
            role: profile?.role || null,
            profile,
            rawUser: supabaseUser
        };
    }

    // Then, try Clerk session tokens.
    const clerkSecretKey = getClerkSecretKey();
    const clerkClient = getClerkClient();
    if (!clerkSecretKey || !clerkClient) {
        return {
            authenticated: false,
            status: 401,
            error: 'Invalid access token'
        };
    }

    let payload;
    try {
        payload = await verifyToken(token, { secretKey: clerkSecretKey });
    } catch {
        return {
            authenticated: false,
            status: 401,
            error: 'Invalid access token'
        };
    }

    const clerkUserId = payload?.sub;
    if (!clerkUserId) {
        return {
            authenticated: false,
            status: 401,
            error: 'Invalid access token'
        };
    }

    let clerkUser;
    try {
        clerkUser = await clerkClient.users.getUser(clerkUserId);
    } catch {
        return {
            authenticated: false,
            status: 401,
            error: 'Invalid access token'
        };
    }

    const email = primaryEmailFromClerkUser(clerkUser);
    const profile = await getProfileForClerkUser(supabase, clerkUserId, email);

    if (!profile) {
        return {
            authenticated: false,
            status: 403,
            error: 'No Onlifit profile is linked to this Clerk account yet'
        };
    }

    return {
        authenticated: true,
        provider: 'clerk',
        userId: profile.id,
        email: email || profile.email || null,
        role: profile.role || null,
        profile,
        clerkUserId,
        rawUser: clerkUser
    };
}
