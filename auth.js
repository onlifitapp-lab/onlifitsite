
// GLOBAL OAUTH CATCHER: Run this immediately on ANY page load.
// Important: do NOT strip `?code=` / `#access_token=` until a session is actually established,
// otherwise we can lose the ability to exchange the code and end up “stuck” on the homepage.
// Demo/preview mode disabled: always use real Supabase auth + data.
const AUTH_BYPASS = false;
const ONLIFIT_CLERK_KEY_STORAGE = 'onlifit_clerk_publishable_key';
const ONLIFIT_ROLE_STORAGE = 'onlifit_user_role';
const ONLIFIT_OAUTH_SIGNUP_SOURCE = 'oauth_signup_source';
const ONLIFIT_OAUTH_LOGIN_ROLE = 'oauth_login_role';
const ONLIFIT_OAUTH_LOGIN_SOURCE = 'oauth_login_source';
const ONLIFIT_OAUTH_INTENT = 'oauth_intent';

let _clerkLoadPromise = null;

function normalizeUserRole(value, defaultRole = 'client') {
    return value === 'trainer' || value === 'admin' || value === 'client'
        ? value
        : defaultRole;
}

function getStoredUserRole(defaultRole = 'client') {
    return normalizeUserRole(localStorage.getItem(ONLIFIT_ROLE_STORAGE), defaultRole);
}

function getClerkPrimaryEmail(clerkUser) {
    return clerkUser?.primaryEmailAddress?.emailAddress || clerkUser?.emailAddresses?.[0]?.emailAddress || '';
}

async function resolveClerkRole(clerkUser, roleHint) {
    const hintedRole = normalizeUserRole(roleHint, '');
    if (hintedRole) {
        localStorage.setItem(ONLIFIT_ROLE_STORAGE, hintedRole);
        return hintedRole;
    }

    const metadataRole = normalizeUserRole(
        clerkUser?.unsafeMetadata?.role || clerkUser?.publicMetadata?.role || clerkUser?.privateMetadata?.role,
        ''
    );
    if (metadataRole) {
        localStorage.setItem(ONLIFIT_ROLE_STORAGE, metadataRole);
        return metadataRole;
    }

    try {
        if (typeof supabaseClient !== 'undefined') {
            const clerkUserId = clerkUser?.id || '';

            if (clerkUserId) {
                const byClerkId = await supabaseClient
                    .from('profiles')
                    .select('role')
                    .eq('clerk_id', clerkUserId)
                    .limit(1);

                if (!byClerkId.error && Array.isArray(byClerkId.data) && byClerkId.data.length > 0) {
                    const resolvedByClerkId = normalizeUserRole(byClerkId.data[0].role, 'client');
                    localStorage.setItem(ONLIFIT_ROLE_STORAGE, resolvedByClerkId);
                    return resolvedByClerkId;
                }

                const clerkIdError = String(byClerkId.error?.message || '').toLowerCase();
                if (byClerkId.error && !clerkIdError.includes('clerk_id')) {
                    console.warn('Clerk role lookup by clerk_id failed:', byClerkId.error?.message || byClerkId.error);
                }
            }

            const primaryEmail = getClerkPrimaryEmail(clerkUser);
            if (primaryEmail) {
                const byEmail = await supabaseClient
                    .from('profiles')
                    .select('role')
                    .ilike('email', primaryEmail)
                    .limit(1);

                if (!byEmail.error && Array.isArray(byEmail.data) && byEmail.data.length > 0) {
                    const resolvedByEmail = normalizeUserRole(byEmail.data[0].role, 'client');
                    localStorage.setItem(ONLIFIT_ROLE_STORAGE, resolvedByEmail);
                    return resolvedByEmail;
                }
            }
        }
    } catch (error) {
        console.warn('Clerk role lookup failed, using local fallback.', error?.message || error);
    }

    const fallbackRole = 'client';
    localStorage.setItem(ONLIFIT_ROLE_STORAGE, fallbackRole);
    return fallbackRole;
}

function getConfiguredClerkPublishableKey() {
    if (typeof window === 'undefined') return '';

    const metaKey = document.querySelector('meta[name="clerk-publishable-key"]')?.content?.trim() || '';
    const windowKey = (window.CLERK_PUBLISHABLE_KEY || '').trim();
    const storedKey = (localStorage.getItem(ONLIFIT_CLERK_KEY_STORAGE) || '').trim();

    return windowKey || metaKey || storedKey;
}

async function ensureClerkLoaded() {
    if (typeof window === 'undefined') return null;

    const publishableKey = getConfiguredClerkPublishableKey();
    if (!publishableKey) return null;

    if (_clerkLoadPromise) return _clerkLoadPromise;

    _clerkLoadPromise = (async () => {
        if (!window.Clerk) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
                script.async = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load Clerk script'));
                document.head.appendChild(script);
            });
        }

        await window.Clerk.load({ publishableKey });
        return window.Clerk;
    })();

    try {
        return await _clerkLoadPromise;
    } catch (error) {
        _clerkLoadPromise = null;
        console.warn('Clerk init failed, falling back to Supabase auth only.', error?.message || error);
        return null;
    }
}

function buildClerkUser(clerkUser, roleHint) {
    const fullName = clerkUser.fullName || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'User';
    const primaryEmail = getClerkPrimaryEmail(clerkUser) || null;
    const primaryPhone = clerkUser.primaryPhoneNumber?.phoneNumber || null;
    const role = normalizeUserRole(roleHint, getStoredUserRole('client'));

    return {
        id: clerkUser.id,
        email: primaryEmail,
        name: fullName,
        phone: primaryPhone,
        avatar_url: clerkUser.imageUrl || null,
        role,
        auth_provider: 'clerk',
        user_metadata: {
            name: fullName,
            role
        }
    };
}

async function getCurrentClerkUser(roleHint) {
    const clerk = await ensureClerkLoaded();
    if (!clerk || !clerk.isSignedIn || !clerk.user) return null;
    const resolvedRole = await resolveClerkRole(clerk.user, roleHint);
    return buildClerkUser(clerk.user, resolvedRole);
}

async function getApiAccessToken() {
    if (AUTH_BYPASS) return null;

    try {
        const clerk = await ensureClerkLoaded();
        if (clerk?.isSignedIn && clerk.session?.getToken) {
            const clerkToken = await clerk.session.getToken();
            if (clerkToken) return clerkToken;
        }
    } catch (error) {
        console.warn('Clerk API token resolution failed, falling back to Supabase token.', error?.message || error);
    }

    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        return sessionData?.session?.access_token || null;
    } catch {
        return null;
    }
}

async function getApiAuthHeader() {
    const token = await getApiAccessToken();
    return token ? `Bearer ${token}` : null;
}

function inferTemporaryRole() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('bookings') || path.includes('trainer-onboarding') || path.includes('/trainer')) return 'trainer';
    if (path.includes('admin')) return 'admin';
    return 'client';
}

function supportsCleanRoutes() {
    if (typeof window === 'undefined') return false;
    if (window.location.protocol === 'file:') return false;

    const host = (window.location.hostname || '').toLowerCase();
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;

    return host.endsWith('onlifit.in') || host.endsWith('vercel.app');
}

function resolveAuthBaseUrl() {
    if (typeof window === 'undefined') return 'https://www.onlifit.in';

    const protocol = (window.location.protocol || '').toLowerCase();
    const hostname = (window.location.hostname || '').toLowerCase();

    if (protocol === 'https:' || protocol === 'http:') {
        if (hostname === 'onlifit.in' || hostname === 'www.onlifit.in') {
            // Keep auth callbacks on a single production origin so session storage is consistent.
            return 'https://www.onlifit.in';
        }
        return window.location.origin;
    }

    return 'https://www.onlifit.in';
}

function resolveAppPath(cleanPath, htmlFallback) {
    return supportsCleanRoutes() ? cleanPath : htmlFallback;
}

function getDashboardPathForRole(role) {
    const normalized = normalizeUserRole(role, 'client');
    if (normalized === 'admin') return 'admin-dashboard.html';
    if (normalized === 'trainer') return 'bookings.html';
    return 'client-dashboard.html';
}

function getMessagesPathForRole(role) {
    const normalized = normalizeUserRole(role, 'client');
    if (normalized === 'trainer') return resolveAppPath('/trainer/messages', 'messages.html');
    if (normalized === 'client') return resolveAppPath('/client/messages', 'messages.html');
    return 'messages.html';
}

function buildTemporaryUser(role = inferTemporaryRole(), overrides = {}) {
    const normalizedRole = role || 'client';
    const defaultName = normalizedRole === 'trainer'
        ? 'Trainer Preview'
        : normalizedRole === 'admin'
            ? 'Admin Preview'
            : 'Client Preview';
    const name = overrides.name || defaultName;

    return {
        id: overrides.id || `temp-${normalizedRole}`,
        email: overrides.email || `${normalizedRole}@preview.onlifit.local`,
        name,
        phone: overrides.phone || null,
        avatar_url: overrides.avatar_url || null,
        role: overrides.role || normalizedRole,
        user_metadata: {
            name,
            role: overrides.role || normalizedRole,
            ...(overrides.user_metadata || {})
        },
        ...overrides
    };
}

(async function () {
    try {
        const hasOAuthParams = window.location.hash.includes('access_token=') || window.location.search.includes('code=');
        if (!hasOAuthParams) return;

        console.log('GLOBAL OAUTH CATCHER: OAuth params detected in URL');
        await handleOAuthCallback({ redirectEverywhere: true });
    } catch (err) {
        console.error('Global oauth catcher failed:', err);
    }
})();


/**
 * Onlifit Auth & Data Module (Supabase Version)
 * ──────────────────────────────────────────
 * Handles: authentication, session management, trainer data, and bookings.
 * Powered by Supabase.
 */

// ─── AUTH FUNCTIONS ───────────────────────────────────────────────────────────

/**
 * Sign up a new user (Client or Trainer)
 */
async function signUp(name, email, password, role, trainerData, phone) {
    if (AUTH_BYPASS) {
        return { success: true, user: buildTemporaryUser(role, { name, email, phone }) };
    }

    try {
        console.log('=== AUTH.JS SIGNUP DEBUG ===');
        console.log('Received parameters:', { name, email, role, phone, trainerData });
        
        const signupData = {
            email,
            password,
            options: {
                data: { 
                    name, 
                    role,
                    phone,
                    // Include trainer data if role is trainer
                    ...(role === 'trainer' && trainerData ? {
                        specialty: trainerData.specialty || "Personal Training",
                        location: trainerData.location || "Online",
                        experience: trainerData.experience || "1+ years"
                    } : {})
                }
            }
        };
        
        console.log('Supabase signUp call with data:', signupData);
        
        // Sign up with Supabase Auth - profile will be created automatically by database trigger
        const { data: authData, error: authError } = await supabaseClient.auth.signUp(signupData);

        if (authError) throw authError;
        
        console.log('Auth signup successful, user ID:', authData.user?.id);
        console.log('User metadata:', authData.user?.user_metadata);

        // Profile is automatically created by database trigger - no manual insert needed!
        // Wait a moment for trigger to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        let mergedUser = authData.user;
        const normalizedSignupRole = normalizeUserRole(role, 'client');

        if (normalizedSignupRole === 'trainer') {
            localStorage.setItem(ONLIFIT_ROLE_STORAGE, 'trainer');
            localStorage.setItem('onlifit_trainer_intent', 'join-us');
            localStorage.setItem(ONLIFIT_OAUTH_SIGNUP_SOURCE, 'join-us');
            localStorage.setItem('oauth_role', 'trainer');
            localStorage.setItem(ONLIFIT_OAUTH_INTENT, 'join_us_trainer_signup');
        }

        try {
            const { data: profileRows, error: profileFetchError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .limit(1);

            if (!profileFetchError && Array.isArray(profileRows) && profileRows.length > 0) {
                let profile = profileRows[0];
                console.log('Profile fetched after signup:', { id: profile.id, role: profile.role });

                if (normalizedSignupRole === 'trainer' && profile.role !== 'trainer') {
                    console.log('Profile role is not trainer, updating...');
                    const { data: updatedRows, error: promoteError } = await supabaseClient
                        .from('profiles')
                        .update({ role: 'trainer' })
                        .eq('id', authData.user.id)
                        .select('*')
                        .limit(1);

                    if (!promoteError && Array.isArray(updatedRows) && updatedRows.length > 0) {
                        profile = updatedRows[0];
                        console.log('✅ Profile role updated to trainer');
                    }
                }

                mergedUser = { ...authData.user, ...profile };
                console.log('Merged user after profile sync:', { id: mergedUser.id, role: mergedUser.role });
            }
        } catch (profileSyncError) {
            console.warn('Unable to sync profile role after signup:', profileSyncError?.message || profileSyncError);
        }

        return { success: true, user: mergedUser };
    } catch (error) {
        const message = String(error?.message || '');
        if (/already registered|already exists|email.*in use/i.test(message)) {
            return {
                success: false,
                error: 'An account with this email already exists. Please sign in instead.'
            };
        }

        console.error("Signup error:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Sign in with Google (Supabase OAuth)
 */
async function signInWithGoogle(role = 'client', isSignup = false, options = {}) {
    if (AUTH_BYPASS) {
        return { success: true, user: buildTemporaryUser(role) };
    }

    try {
        const normalizedRole = normalizeUserRole(role, 'client');
        const signupSource = String(options?.signupSource || '').toLowerCase();

        if (isSignup && normalizedRole === 'trainer' && signupSource !== 'join-us') {
            return {
                success: false,
                error: 'Trainer signup is only available from the Join Us page.'
            };
        }

        console.log('Google auth initiated with role:', normalizedRole, 'isSignup:', isSignup, 'source:', signupSource);

        // Keep local intent bridge for signup/login role routing and onboarding enforcement.
        const joinUsTrainerSignup = isSignup && normalizedRole === 'trainer' && signupSource === 'join-us';
        const oauthIntent = joinUsTrainerSignup ? 'join_us_trainer_signup' : '';

        // Store intent for OAuth callback to use.
        if (isSignup) {
            localStorage.setItem('oauth_role', normalizedRole);
            localStorage.setItem('oauth_is_signup', 'true');
            localStorage.setItem(ONLIFIT_OAUTH_SIGNUP_SOURCE, signupSource || 'direct');
            if (oauthIntent) {
                localStorage.setItem(ONLIFIT_OAUTH_INTENT, oauthIntent);
            } else {
                localStorage.removeItem(ONLIFIT_OAUTH_INTENT);
            }
            localStorage.removeItem(ONLIFIT_OAUTH_LOGIN_ROLE);
            localStorage.removeItem(ONLIFIT_OAUTH_LOGIN_SOURCE);
        } else {
            localStorage.removeItem('oauth_role');
            localStorage.removeItem('oauth_is_signup');
            localStorage.removeItem(ONLIFIT_OAUTH_SIGNUP_SOURCE);
            localStorage.removeItem(ONLIFIT_OAUTH_INTENT);
            localStorage.setItem(ONLIFIT_OAUTH_LOGIN_ROLE, normalizedRole);
            localStorage.setItem(ONLIFIT_OAUTH_LOGIN_SOURCE, signupSource || 'direct');
        }

        const authBase = resolveAuthBaseUrl();
        const redirectTo = oauthIntent
            ? `${authBase}/login.html?oauth_intent=${encodeURIComponent(oauthIntent)}`
            : `${authBase}/login.html`;

        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        });

        if (error) throw error;
        return { success: true, user: data?.user || null };
    } catch (error) {
        console.error('Google sign in error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Login an existing user
 */
async function login(email, password) {
    if (AUTH_BYPASS) {
        const role = inferTemporaryRole();
        const name = email?.split('@')[0] || 'Guest';
        return { success: true, user: buildTemporaryUser(role, { name, email }) };
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        const hasTrainerIntent = localStorage.getItem('onlifit_trainer_intent') === 'join-us'
            || localStorage.getItem(ONLIFIT_ROLE_STORAGE) === 'trainer'
            || localStorage.getItem(ONLIFIT_OAUTH_SIGNUP_SOURCE) === 'join-us'
            || localStorage.getItem('oauth_role') === 'trainer'
            || localStorage.getItem(ONLIFIT_OAUTH_INTENT) === 'join_us_trainer_signup'
            || (
                localStorage.getItem(ONLIFIT_OAUTH_LOGIN_ROLE) === 'trainer'
                && localStorage.getItem(ONLIFIT_OAUTH_LOGIN_SOURCE) === 'join-us'
            );

        // Fetch profile to get role (handle multiple results or no results)
        const { data: profiles, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', data.user.id);

        if (profileError) throw profileError;

        // If no profile exists, create one (fallback)
        if (!profiles || profiles.length === 0) {
            console.warn("No profile found, creating one...");
            const fallbackRole = hasTrainerIntent ? 'trainer' : (data.user.user_metadata?.role || 'client');
            const { data: newProfile } = await supabaseClient
                .from('profiles')
                .insert([{
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.user_metadata?.name || 'User',
                    role: fallbackRole,
                    phone: data.user.user_metadata?.phone || null
                }])
                .select()
                .single();

            if (fallbackRole === 'trainer') {
                localStorage.setItem(ONLIFIT_ROLE_STORAGE, 'trainer');
                localStorage.setItem('onlifit_trainer_intent', 'join-us');
            }
            
            return { success: true, user: { ...data.user, ...newProfile } };
        }

        // Use first profile if multiple exist
        let profile = profiles[0];

        if (hasTrainerIntent && profile.role !== 'trainer') {
            const { data: updatedProfiles, error: promoteError } = await supabaseClient
                .from('profiles')
                .update({ role: 'trainer' })
                .eq('id', data.user.id)
                .select('*')
                .limit(1);

            if (!promoteError && Array.isArray(updatedProfiles) && updatedProfiles.length > 0) {
                profile = updatedProfiles[0];
            }
        }

        if (profile.role === 'trainer') {
            localStorage.setItem(ONLIFIT_ROLE_STORAGE, 'trainer');
            localStorage.setItem('onlifit_trainer_intent', 'join-us');
        }

        return { success: true, user: { ...data.user, ...profile } };
    } catch (error) {
        console.error("Login error:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Log out the current user
 */
async function logout() {
    if (AUTH_BYPASS) {
        window.location.href = 'onlifit.html';
        return;
    }

    const clerk = await ensureClerkLoaded();

    await Promise.allSettled([
        supabaseClient.auth.signOut(),
        clerk && clerk.isSignedIn ? clerk.signOut() : Promise.resolve()
    ]);

    window.location.href = 'onlifit.html';
}

/**
 * Get the currently logged-in user and their profile
 */
async function getCurrentUser(roleHint) {
    if (AUTH_BYPASS) {
        return buildTemporaryUser(roleHint || inferTemporaryRole());
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            const { data: profiles } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id);

            // Handle no profile or multiple profiles
            const profile = profiles && profiles.length > 0 ? profiles[0] : null;
            return profile ? { ...user, ...profile } : user;
        }
    } catch (error) {
        console.warn('Supabase getCurrentUser failed, trying Clerk fallback.', error?.message || error);
    }

    return await getCurrentClerkUser(roleHint);
}

/**
 * Handle OAuth callback - Check and set role from localStorage, then redirect
 */
async function handleOAuthCallback(options = {}) {
    if (AUTH_BYPASS) {
        const params = new URLSearchParams(window.location.search);
        if (params.has('code') || params.has('state') || window.location.hash.includes('access_token=')) {
            params.delete('code');
            params.delete('state');
            params.delete('error');
            params.delete('error_description');
            window.history.replaceState({}, document.title, window.location.pathname + (params.toString() ? `?${params.toString()}` : ''));
        }
        return;
    }

    const redirectEverywhere = !!options.redirectEverywhere;

    const oauthRoleRaw = localStorage.getItem('oauth_role');
    const oauthIsSignup = localStorage.getItem('oauth_is_signup') === 'true';
    const oauthRole = oauthIsSignup ? (oauthRoleRaw || 'client') : null;
    const oauthSignupSource = localStorage.getItem(ONLIFIT_OAUTH_SIGNUP_SOURCE) || '';
    const oauthLoginRole = localStorage.getItem(ONLIFIT_OAUTH_LOGIN_ROLE) || 'client';
    const oauthLoginSource = localStorage.getItem(ONLIFIT_OAUTH_LOGIN_SOURCE) || 'direct';

    const params = new URLSearchParams(window.location.search);
    const oauthIntentParam = params.get('oauth_intent') || localStorage.getItem(ONLIFIT_OAUTH_INTENT) || '';
    const joinUsTrainerIntent = oauthIntentParam === 'join_us_trainer_signup';
    const code = params.get('code');
    const hasAccessToken = window.location.hash.includes('access_token=');
    const hadOAuthParams = !!code || hasAccessToken;

    console.log('handleOAuthCallback invoked.', { hadOAuthParams, oauthIsSignup, oauthRole });

    // Helper: wait briefly for a session to appear (Supabase can finalize asynchronously).
    async function waitForSession(maxMs) {
        const start = Date.now();
        while (Date.now() - start < maxMs) {
            const stored = await supabaseClient.auth.getSession();
            const maybeSession = stored?.data?.session || null;
            if (maybeSession) return maybeSession;
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        return null;
    }

    let session = options._reuseSession || null;

    if (!hadOAuthParams) {
        // Normal visit (no oauth params). If already authenticated on /login, redirect out.
        if (!session && window.location.pathname.includes('login')) {
            const existing = await supabaseClient.auth.getSession();
            session = existing?.data?.session || null;
        }
        if (!session) return;
    } else {
        // OAuth return visit.
        if (!session && code) {
            console.log('Exchanging OAuth code for session...');
            const { data: exchangeData, error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
            if (exchangeError) {
                console.error('exchangeCodeForSession failed:', exchangeError);
            } else {
                session = exchangeData?.session || null;
            }
        }

        if (!session) {
            session = await waitForSession(6000);
        }

        if (!session) {
            console.warn('OAuth callback: no session established (leaving URL intact for retry).');
            return;
        }

        // Clean OAuth params only after session is confirmed.
        try {
            if (code) {
                params.delete('code');
                params.delete('state');
                params.delete('error');
                params.delete('error_description');
                params.delete('oauth_intent');
                const cleanUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
                window.history.replaceState({}, document.title, cleanUrl);
            }
            if (hasAccessToken) {
                const cleanUrl = window.location.pathname + window.location.search;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        } catch (e) {
            // Non-fatal
        }
    }

    const user = session.user;
    console.log('OAuth session established for user:', user?.id);

    // Fetch profile role (DB is the source of truth). Be tolerant of 0 or duplicate rows.
    let profile = null;
    try {
        const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, role, onboarding_completed, verification_status')
            .eq('id', user.id);
        profile = (profiles && profiles.length > 0) ? profiles[0] : null;
    } catch (e) {
        // Non-fatal
    }

    if (oauthIsSignup && oauthRole === 'trainer' && oauthSignupSource !== 'join-us') {
        localStorage.removeItem('oauth_role');
        localStorage.removeItem('oauth_is_signup');
        localStorage.removeItem(ONLIFIT_OAUTH_SIGNUP_SOURCE);
        localStorage.removeItem(ONLIFIT_OAUTH_INTENT);
        localStorage.removeItem(ONLIFIT_OAUTH_LOGIN_ROLE);
        localStorage.removeItem(ONLIFIT_OAUTH_LOGIN_SOURCE);

        await supabaseClient.auth.signOut();
        window.location.replace('join-us.html?auth=trainer_only');
        return;
    }

    // CRITICAL FIX: Detect existing user in signup mode (most common problem scenario)
    // When oauthIsSignup=true but profile already exists, this is an EXISTING user re-signing in via signup tab
    // Not a new signup. Treat as normal login and clear signup intent.
    const isExistingUserInSignupMode = oauthIsSignup && profile;
    if (isExistingUserInSignupMode) {
        console.log('OAuth in signup mode but profile exists: Existing user detected. Treating as login, not signup.');
    }

    // Create profile if missing (mainly for first-time OAuth signups)
    if (!profile) {
        try {
            const roleForNewProfile = joinUsTrainerIntent ? 'trainer' : (oauthRole || user.user_metadata?.role || 'client');
            const { data: insertedProfiles } = await supabaseClient
                .from('profiles')
                .insert([{
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
                    role: roleForNewProfile,
                    phone: null
                }])
                .select('id, role, onboarding_completed, verification_status');
            profile = (insertedProfiles && insertedProfiles.length > 0) ? insertedProfiles[0] : profile;
        } catch (e) {
            // Non-fatal
        }
    }

    // Hard guarantee: Join Us signup must always continue as trainer flow.
    if ((oauthIsSignup && oauthSignupSource === 'join-us') || joinUsTrainerIntent) {
        try {
            const { data: forcedProfiles } = await supabaseClient
                .from('profiles')
                .update({ role: 'trainer' })
                .eq('id', user.id)
                .select('id, role, onboarding_completed, verification_status');

            if (forcedProfiles && forcedProfiles.length > 0) {
                profile = forcedProfiles[0];
            } else {
                profile = { ...(profile || {}), role: 'trainer' };
            }
        } catch (e) {
            profile = { ...(profile || {}), role: 'trainer' };
        }
    }

    const shouldKeepTrainerIntent = joinUsTrainerIntent || profile?.role === 'trainer';
    if (shouldKeepTrainerIntent) {
        localStorage.setItem(ONLIFIT_ROLE_STORAGE, 'trainer');
        localStorage.setItem('onlifit_trainer_intent', 'join-us');
        if (joinUsTrainerIntent) {
            localStorage.setItem(ONLIFIT_OAUTH_INTENT, 'join_us_trainer_signup');
            localStorage.setItem(ONLIFIT_OAUTH_SIGNUP_SOURCE, 'join-us');
            localStorage.setItem('oauth_role', 'trainer');
        }
    } else {
        // Clean up oauth local storage (only after session exists)
        localStorage.removeItem('oauth_role');
        localStorage.removeItem('oauth_is_signup');
        localStorage.removeItem(ONLIFIT_OAUTH_SIGNUP_SOURCE);
        localStorage.removeItem(ONLIFIT_OAUTH_INTENT);
        localStorage.removeItem(ONLIFIT_OAUTH_LOGIN_ROLE);
        localStorage.removeItem(ONLIFIT_OAUTH_LOGIN_SOURCE);
    }

    const finalRole = joinUsTrainerIntent ? 'trainer' : (profile?.role || oauthRole || user.user_metadata?.role || 'client');
    const shouldRedirectNow = redirectEverywhere || window.location.pathname.includes('login');
    if (!shouldRedirectNow) return;

    console.log('Redirecting after OAuth. Role:', finalRole);
    if (finalRole === 'admin') {
        window.location.replace('admin-dashboard.html');
    } else if (finalRole === 'trainer') {
        const verificationStatus = String(profile?.verification_status || '').toLowerCase();
        const trainerApproved = verificationStatus === 'approved' || verificationStatus === 'verified';

        const onboardingUrl = (joinUsTrainerIntent || shouldKeepTrainerIntent)
            ? 'trainer-onboarding.html?role=trainer&source=join-us'
            : 'trainer-onboarding.html';

        if (!profile?.onboarding_completed) {
            window.location.replace(onboardingUrl);
        } else if (!trainerApproved) {
            window.location.replace(onboardingUrl);
        } else {
            // Trainer is fully approved; clear any leftover oauth intent.
            localStorage.removeItem('oauth_role');
            localStorage.removeItem('oauth_is_signup');
            localStorage.removeItem(ONLIFIT_OAUTH_SIGNUP_SOURCE);
            localStorage.removeItem(ONLIFIT_OAUTH_INTENT);
            localStorage.removeItem(ONLIFIT_OAUTH_LOGIN_ROLE);
            localStorage.removeItem(ONLIFIT_OAUTH_LOGIN_SOURCE);
            window.location.replace(getDashboardPathForRole('trainer'));
        }
    } else {
        // Client role redirect; clear any oauth intent.
        localStorage.removeItem('oauth_role');
        localStorage.removeItem('oauth_is_signup');
        localStorage.removeItem(ONLIFIT_OAUTH_SIGNUP_SOURCE);
        localStorage.removeItem(ONLIFIT_OAUTH_INTENT);
        localStorage.removeItem(ONLIFIT_OAUTH_LOGIN_ROLE);
        localStorage.removeItem(ONLIFIT_OAUTH_LOGIN_SOURCE);
        // Client role redirect
        // CRITICAL FIX: For existing users (profile exists), prioritize their completion status
        // Only send to onboarding if this is actually a NEW signup AND incomplete
        const actuallyNewSignup = oauthIsSignup && !profile?.id;  // New signup with no profile
        const isCompleted = profile?.onboarding_completed;
        
        console.log('Client redirect decision:', { oauthIsSignup, profileExists: !!profile?.id, onboardingCompleted: isCompleted });
        
        if (actuallyNewSignup && !isCompleted) {
            console.log('New signup client without onboarding, sending to onboarding.html');
            window.location.replace('onboarding.html');
        } else {
            console.log('Existing user or completed onboarding, sending to dashboard');
            window.location.replace(getDashboardPathForRole('client'));
        }
    }
}

/**
 * Upload avatar to Supabase Storage
 */
async function uploadAvatar(userId, file) {
    try {
        // Create unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        // Update profile with avatar URL
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', userId);

        if (updateError) throw updateError;

        return publicUrl;
    } catch (error) {
        console.error("Avatar upload error:", error.message);
        return null;
    }
}

/**
 * Get avatar public URL from storage path
 */
async function getAvatarUrl(path) {
    try {
        if (!path) return null;
        
        // If already a full URL, return it
        if (path.startsWith('http')) return path;

        // Get public URL from storage
        const { data } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(path);

        return data?.publicUrl || null;
    } catch (error) {
        console.error("Get avatar URL error:", error.message);
        return null;
    }
}

/**
 * Delete old avatar from storage
 */
async function deleteAvatar(userId) {
    try {
        // List all files for this user
        const { data: files, error: listError } = await supabaseClient.storage
            .from('avatars')
            .list(userId);

        if (listError) throw listError;

        if (files && files.length > 0) {
            // Delete all files in user folder
            const filesToDelete = files.map(file => `${userId}/${file.name}`);
            const { error: deleteError } = await supabaseClient.storage
                .from('avatars')
                .remove(filesToDelete);

            if (deleteError) throw deleteError;
        }

        return true;
    } catch (error) {
        console.error("Delete avatar error:", error.message);
        return false;
    }
}


/**
 * Update user profile (e.g., during onboarding or settings)
 */
async function updateUserProfile(userId, data) {
    if (AUTH_BYPASS && (!userId || String(userId).startsWith('temp-'))) {
        return { success: true };
    }

    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update(data)
            .eq('id', userId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Update profile error:", error.message);
        return { success: false, error: error.message };
    }
}

async function getUserById(id) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
    return data || null;
}

async function requireAuth(requiredRole, redirectUrl) {
    if (AUTH_BYPASS) {
        return getCurrentUser(requiredRole || inferTemporaryRole());
    }

    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(redirectUrl || window.location.href);
        return null;
    }
    if (requiredRole && user.role !== requiredRole) {
        window.location.href = getDashboardPathForRole(user.role);
        return null;
    }
    return user;
}

// ─── DATA ACCESS ──────────────────────────────────────────────────────────────

// NOTE: We intentionally do not ship any hardcoded/dummy trainer data.

function isMissingColumnError(error, columnName) {
    const msg = String(error?.message || '').toLowerCase();
    return msg.includes('does not exist') && msg.includes(String(columnName).toLowerCase());
}

function isLikelySupabaseUuid(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));
}

function normalizeTrainerList(list) {
    if (!Array.isArray(list)) return [];
    return list
        .filter(t => isLikelySupabaseUuid(t?.id))
        .map(t => (typeof window.normalizeTrainerBadges === 'function' ? window.normalizeTrainerBadges(t) : t));
}

let _cachedTrainers = null;
let _cachedTrainersTime = 0;

async function getTrainers(options = {}) {
    const onUpdate = typeof options === 'function' ? options : options?.onUpdate;
    const forceRefresh = Boolean(options?.forceRefresh);

    const emitUpdate = (list) => {
        if (typeof onUpdate !== 'function') return;
        try {
            onUpdate(list);
        } catch (callbackError) {
            console.error('getTrainers onUpdate callback failed:', callbackError);
        }
    };

    // 1. Check memory cache (fastest)
    if (!forceRefresh && _cachedTrainers && (Date.now() - _cachedTrainersTime < 300000)) {
        return _cachedTrainers;
    }

    // 2. Check localStorage cache
    const TRAINERS_CACHE_KEY = 'onlifit_trainers_cache_v2';
    const TRAINERS_CACHE_TIME_KEY = 'onlifit_trainers_time_v2';

    try {
        const stored = localStorage.getItem(TRAINERS_CACHE_KEY);
        const storedTime = localStorage.getItem(TRAINERS_CACHE_TIME_KEY);
        if (!forceRefresh && stored && storedTime && (Date.now() - parseInt(storedTime) < 300000)) {
            const parsed = JSON.parse(stored);
            const normalized = normalizeTrainerList(parsed);

            if (Array.isArray(parsed) && parsed.length > 0 && normalized.length === 0) {
                localStorage.removeItem(TRAINERS_CACHE_KEY);
                localStorage.removeItem(TRAINERS_CACHE_TIME_KEY);
            } else {
                _cachedTrainers = normalized;
                _cachedTrainersTime = parseInt(storedTime);
                return _cachedTrainers;
            }
        }
    } catch (e) {}

    const selectBase = 'id, name, avatar_url, rating, review_count, location, specialty, bio, plans, tags, latitude, longitude, kyc_verified, certificates_verified, verification_status, experience';
    const selectWithBadge = selectBase + ', has_black_status';

    try {
        // 3. Fast timeout for cold starts: return cached/empty quickly (no dummy data)
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ _timeout: true }), 2500));

        const fetchPromise = (async () => {
            // Try including the badge column; if the project hasn't been migrated yet, fall back gracefully.
            let res = await supabaseClient
                .from('profiles')
                .select(selectWithBadge)
                .eq('role', 'trainer');

            if (res?.error && isMissingColumnError(res.error, 'has_black_status')) {
                res = await supabaseClient
                    .from('profiles')
                    .select(selectBase)
                    .eq('role', 'trainer');
            }

            return res;
        })();

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (response._timeout) {
            console.warn('Supabase trainers query took >2.5s. Returning cached/empty and continuing fetch in background.');
            fetchPromise.then(res => {
                if (res?.data && res.data.length > 0) {
                    const normalized = normalizeTrainerList(res.data);
                    _cachedTrainers = normalized;
                    _cachedTrainersTime = Date.now();
                    localStorage.setItem(TRAINERS_CACHE_KEY, JSON.stringify(normalized));
                    localStorage.setItem(TRAINERS_CACHE_TIME_KEY, Date.now().toString());
                    emitUpdate(normalized);
                } else {
                    emitUpdate(_cachedTrainers || []);
                }
            }).catch(e => console.error('Background fetch error:', e));

            return _cachedTrainers || [];
        }

        const { data, error } = response;
        if (error) {
            console.error('getTrainers error:', error);
            return _cachedTrainers || [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        const normalized = normalizeTrainerList(data);

        // Save to cache
        _cachedTrainers = normalized;
        _cachedTrainersTime = Date.now();
        localStorage.setItem(TRAINERS_CACHE_KEY, JSON.stringify(normalized));
        localStorage.setItem(TRAINERS_CACHE_TIME_KEY, Date.now().toString());
        emitUpdate(normalized);
        return normalized;
    } catch (err) {
        console.error('getTrainers failed:', err);
        emitUpdate(_cachedTrainers || []);
        return _cachedTrainers || [];
    }
}

async function getTrainerById(id) {
    const { data: trainer, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', id)
        .eq('role', 'trainer')
        .single();

    if (error || !trainer) {
        return null;
    }

// Fetch reviews for this trainer
    let reviews = [];
    try {
        const { data } = await supabaseClient
            .from('reviews')
            .select(`
                *,
                client:profiles!reviews_client_id_fkey(name)
            `)
            .eq('trainer_id', id)
            .order('created_at', { ascending: false });
        // Fallback for missing foreign key reference relationship name in some setups
        if (!data) {
             const fallbackSearch = await supabaseClient
                 .from('reviews')
                 .select('*')
                 .eq('trainer_id', id)
                 .order('created_at', { ascending: false });
             reviews = fallbackSearch.data || [];
        } else {
             reviews = data;
        }
    } catch(e) {
         console.warn("Failed fetching reviews:", e);
    }

    const normalized = typeof window.normalizeTrainerBadges === 'function'
        ? window.normalizeTrainerBadges(trainer)
        : trainer;

    return { ...normalized, reviews: reviews || [] };
}

// ─── REVIEW FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * Submit a review for a trainer
 */
async function submitReview(trainerId, rating, text) {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Must be logged in to leave a review." };

    try {
        // Insert review
        const { data: reviewData, error: reviewError } = await supabaseClient.from('reviews').insert([{
            trainer_id: trainerId,
            client_id: user.id,
            rating: parseInt(rating),
            text: text
        }]);

        if (reviewError) throw reviewError;

        // Recalculate average rating for trainer
        const { data: allReviews } = await supabaseClient
            .from('reviews')
            .select('rating')
            .eq('trainer_id', trainerId);
        
        if (allReviews && allReviews.length > 0) {
            const sum = allReviews.reduce((acc, curr) => acc + curr.rating, 0);
            const avg = (sum / allReviews.length).toFixed(1);
            
            await supabaseClient.from('profiles').update({
                rating: parseFloat(avg),
                review_count: allReviews.length
            }).eq('id', trainerId);
        }

        return { success: true };
    } catch (e) {
        console.error("Failed to submit review:", e);
        return { success: false, error: e.message };
    }
}

async function searchTrainers(query, location) {
    // If we have cached trainers, pre-filter them locally for instant rendering
    if (_cachedTrainers && (Date.now() - _cachedTrainersTime < 300000)) {
        let filtered = _cachedTrainers;
        if (query) {
            const lowQ = query.toLowerCase();
            filtered = filtered.filter(t => 
                (t.name && t.name.toLowerCase().includes(lowQ)) || 
                (t.specialty && t.specialty.toLowerCase().includes(lowQ)) || 
                (t.bio && t.bio.toLowerCase().includes(lowQ))
            );
        }
        if (location) {
            filtered = filtered.filter(t => t.location && t.location.toLowerCase().includes(location.toLowerCase()));
        }
        return filtered;
    }

    const selectBase = 'id, name, avatar_url, rating, review_count, location, specialty, bio, plans, tags, latitude, longitude';
    const selectWithBadge = selectBase + ', has_black_status';

    const buildQuery = (selectStr) => {
        let q = supabaseClient
            .from('profiles')
            .select(selectStr)
            .eq('role', 'trainer');

        if (query) {
            q = q.or(`name.ilike.%${query}%,specialty.ilike.%${query}%,bio.ilike.%${query}%`);
        }

        if (location) {
            q = q.ilike('location', `%${location}%`);
        }

        return q;
    };

    let { data, error } = await buildQuery(selectWithBadge);
    if (error && isMissingColumnError(error, 'has_black_status')) {
        ({ data, error } = await buildQuery(selectBase));
    }

    if (error) {
        console.error('searchTrainers error:', error);
        return [];
    }

    return normalizeTrainerList(data || []);
}

async function getReviews(trainerId) {
    const { data, error } = await supabaseClient
        .from('reviews')
        .select('*')
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false });
    return data || [];
}

async function getBookings() {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabaseClient
        .from('bookings')
        .select('*')
        .or(`client_id.eq.${user.id},trainer_id.eq.${user.id}`)
        .order('date', { ascending: true });

    return data || [];
}

/**
 * Fetch all bookings for a specific user ID (Internal/Helper)
 */
async function getBookingsForUser(userId) {
    if (!userId) return [];
    const { data, error } = await supabaseClient
        .from('bookings')
        .select('*')
        .or(`client_id.eq.${userId},trainer_id.eq.${userId}`)
        .order('created_at', { ascending: false });
    return data || [];
}

async function createBooking(clientId, trainerId, planType, details) {
    try {
        const authHeader = await getApiAuthHeader();
        if (!authHeader) {
            throw new Error('You must be signed in to create a booking');
        }
        
        // Let's call our newly created secure API endpoint on Vercel
        const response = await fetch('/api/create-booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                trainerId: trainerId,
                planType: planType,
                details: details,
                authHeader: authHeader // Backward compatibility while APIs migrate
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to create secure booking');
        }

        return result.data;
    } catch (error) {
        console.error("Create booking error:", error.message);
        throw error;
    }
}

// ─── NOTIFICATIONS & MESSAGES ─────────────────────────────────────────────────

let _messageReadColumn = null;

async function resolveMessageReadColumn() {
    // The current messages schema has no read/is_read column.
    _messageReadColumn = null;
    return _messageReadColumn;
}

async function getNotifications(userId) {
    const { data, error } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    return data || [];
}

async function markNotificationAsRead(id) {
    await supabaseClient.from('notifications').update({ read: true }).eq('id', id);
}

/**
 * Real-time Subscription Helper
 */
function subscribeToTable(table, filter, callback) {
    return supabaseClient
        .channel(`public:${table}`)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: table,
            filter: filter 
        }, payload => {
            callback(payload);
        })
        .subscribe();
}

async function getMessages(u1, u2) {
    const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${u1},receiver_id.eq.${u2}),and(sender_id.eq.${u2},receiver_id.eq.${u1})`)
        .order('created_at', { ascending: true });
    return data || [];
}

async function sendMessage(senderId, receiverId, text) {
    try {
        const readColumn = await resolveMessageReadColumn();
        const messagePayload = { 
            sender_id: senderId, 
            receiver_id: receiverId, 
            text
        };
        if (readColumn) messagePayload[readColumn] = false;

        const { data, error } = await supabaseClient
            .from('messages')
            .insert([messagePayload])
            .select()
            .single();

        if (error) throw error;

        // Notify receiver
        const user = await getUserById(senderId);
        await supabaseClient.from('notifications').insert([{
            user_id: receiverId,
            type: 'message',
            title: 'New Message',
            message: `${user?.name || 'Someone'} sent you a message.`
        }]);

        return data;
    } catch (error) {
        console.error("Send message error:", error.message);
        return null;
    }
}

/**
 * Mark messages as read/delivered/seen
 */
async function updateMessageStatus(messageIds, status, read) {
    try {
        const updates = {};
        if (read !== undefined) {
            const readColumn = await resolveMessageReadColumn();
            if (readColumn) updates[readColumn] = read;
        }

        if (!Object.keys(updates).length) return true;

        const { error } = await supabaseClient
            .from('messages')
            .update(updates)
            .in('id', Array.isArray(messageIds) ? messageIds : [messageIds]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Update message status error:", error.message);
        return false;
    }
}

/**
 * Mark all messages from a sender as read
 */
async function markMessagesAsRead(senderId, receiverId) {
    try {
        const readColumn = await resolveMessageReadColumn();
        if (!readColumn) return true;
        const { error } = await supabaseClient
            .from('messages')
            .update({ [readColumn]: true })
            .eq('sender_id', senderId)
            .eq('receiver_id', receiverId)
            .eq(readColumn, false);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Mark messages as read error:", error.message);
        return false;
    }
}

/**
 * Get unread message count
 */
async function getUnreadCount(userId) {
    try {
        const readColumn = await resolveMessageReadColumn();
        if (!readColumn) return 0;
        const { count, error } = await supabaseClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', userId)
            .eq(readColumn, false);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error("Get unread count error:", error.message);
        return 0;
    }
}

// ─── CERTIFICATION MANAGEMENT ────────────────────────────────────────────────

/**
 * Upload trainer certification with metadata
 */
async function uploadCertification(trainerId, trainerName, file) {
    try {
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('File too large (max 5MB)');
        }

        // Create unique filename
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileName = `cert-${Date.now()}.${fileExt}`;
        const filePath = `${trainerId}/${fileName}`;

        // Upload to trainer_certifications bucket
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('trainer_certifications')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('trainer_certifications')
            .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        // Insert certification metadata into database
        const { data: certData, error: insertError } = await supabaseClient
            .from('certifications')
            .insert({
                trainer_id: trainerId,
                trainer_name: trainerName,
                file_name: file.name,
                file_url: publicUrl,
                file_type: fileExt,
                file_size: file.size
            })
            .select()
            .single();

        if (insertError) throw insertError;

        return { success: true, certification: certData };
    } catch (error) {
        console.error('Upload certification error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get trainer certifications
 */
async function getTrainerCertifications(trainerId) {
    try {
        const { data, error } = await supabaseClient
            .from('certifications')
            .select('*')
            .eq('trainer_id', trainerId)
            .order('uploaded_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get certifications error:', error);
        return [];
    }
}

/**
 * Delete certification
 */
async function deleteCertification(certId, trainerId) {
    try {
        // Get certification details first
        const { data: cert, error: fetchError } = await supabaseClient
            .from('certifications')
            .select('file_url, trainer_id')
            .eq('id', certId)
            .single();

        if (fetchError) throw fetchError;

        // Verify ownership
        if (cert.trainer_id !== trainerId) {
            throw new Error('Unauthorized');
        }

        // Extract file path from URL
        const urlParts = cert.file_url.split('/');
        const filePath = `${cert.trainer_id}/${urlParts[urlParts.length - 1]}`;

        // Delete from storage
        const { error: storageError } = await supabaseClient.storage
            .from('trainer_certifications')
            .remove([filePath]);

        if (storageError) console.warn('Storage deletion warning:', storageError);

        // Delete from database
        const { error: dbError } = await supabaseClient
            .from('certifications')
            .delete()
            .eq('id', certId);

        if (dbError) throw dbError;

        return { success: true };
    } catch (error) {
        console.error('Delete certification error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Set typing status
 */
async function setTypingStatus(userId, chatWithId, isTyping) {
    try {
        const { error } = await supabaseClient
            .from('typing_status')
            .upsert({
                user_id: userId,
                chat_with: chatWithId,
                is_typing: isTyping,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,chat_with'
            });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Set typing status error:", error.message);
        return false;
    }
}

/**
 * Subscribe to typing status
 */
function subscribeToTyping(userId, contactId, callback) {
    // Supabase Realtime `filter` supports a single condition (e.g. "col=eq.value").
    // We filter by the contact (user_id) and then narrow down to the active chat in code.
    return supabaseClient
        .channel(`typing:${contactId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'typing_status',
            filter: `user_id=eq.${contactId}`
        }, payload => {
            const row = payload.new;
            if (!row) return callback(false);
            if (row.chat_with !== userId) return; // Ignore typing meant for other conversations
            callback(!!row.is_typing);
        })
        .subscribe();
}

/**
 * Get last message for contacts
 */
async function getLastMessagesForContacts(userId, contactIds) {
    try {
        const lastMessages = {};
        
        for (const contactId of contactIds) {
            const { data, error } = await supabaseClient
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${userId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userId})`)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data && !error) {
                // Get unread count for this contact
                const { count } = await supabaseClient
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('sender_id', contactId)
                    .eq('receiver_id', userId)
                    .eq('read', false);

                lastMessages[contactId] = {
                    text: data.text,
                    timestamp: data.created_at,
                    unreadCount: count || 0,
                    isSender: data.sender_id === userId
                };
            }
        }

        return lastMessages;
    } catch (error) {
        console.error("Get last messages error:", error.message);
        return {};
    }
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────

// ─── PREMIUM BADGES (OnliFit Black + scalable) ─────────────────────────────────
const ONLIFIT_BADGE_DEFS = {
    verified: {
        id: 'verified',
        label: 'Verified',
        icon: 'verified',
        tooltip: 'KYC and certificates are approved by OnliFit.'
    },
    black: {
        id: 'black',
        label: 'OnliFit Black',
        icon: 'workspace_premium',
        tooltip: 'Top 10% Trainers on OnliFit based on performance, ratings, and results.'
    }
};

function ensureOnlifitBadgeStyles() {
    try {
        if (typeof document === 'undefined') return;
        if (document.getElementById('onlifit-badge-styles')) return;

        const style = document.createElement('style');
        style.id = 'onlifit-badge-styles';
        style.textContent = `
            .onlifit-badge{display:inline-flex;align-items:center;gap:6px;border-radius:9999px;line-height:1;font-weight:800;letter-spacing:.04em;text-transform:uppercase;user-select:none;white-space:nowrap}
            .onlifit-badge__icon{font-size:16px;line-height:1;opacity:.95}

            .onlifit-badge--verified{background:#111827;color:#ecfeff;box-shadow:0 0 0 1px rgba(6,182,212,.35),0 12px 24px rgba(6,182,212,.18)}
            .onlifit-badge--black{background:#000;color:#FFD700;box-shadow:0 0 0 1px rgba(255,215,0,.25),0 14px 28px rgba(0,0,0,.28),0 0 18px rgba(255,215,0,.18)}

            .onlifit-badge--xs{font-size:10px;padding:5px 9px}
            .onlifit-badge--sm{font-size:11px;padding:6px 10px}
            .onlifit-badge--md{font-size:12px;padding:7px 12px}

            .onlifit-badge--corner{position:absolute;top:12px;left:12px;z-index:5}

            .onlifit-tooltip{position:relative}
            .onlifit-tooltip::after{content:attr(data-tooltip);position:absolute;left:0;top:calc(100% + 10px);min-width:240px;max-width:320px;padding:10px 12px;border-radius:12px;background:rgba(17,17,17,.96);color:#fff;font-size:12px;font-weight:700;letter-spacing:0;text-transform:none;line-height:1.35;box-shadow:0 16px 40px rgba(0,0,0,.35);opacity:0;transform:translateY(6px);pointer-events:none;transition:opacity .18s ease,transform .18s ease}
            .onlifit-tooltip::before{content:"";position:absolute;left:18px;top:calc(100% + 2px);border:8px solid transparent;border-bottom-color:rgba(17,17,17,.96);opacity:0;transform:translateY(6px);pointer-events:none;transition:opacity .18s ease,transform .18s ease}
            .onlifit-tooltip:hover::after,.onlifit-tooltip:hover::before{opacity:1;transform:translateY(0)}

            @media (max-width: 640px){
                .onlifit-badge--corner{top:10px;left:10px}
                .onlifit-badge__icon{font-size:15px}
                .onlifit-badge--sm{font-size:10px;padding:5px 9px}
            }
        `;
        document.head.appendChild(style);
    } catch (e) {
        // Non-fatal
    }
}

function normalizeTrainerBadges(record) {
    if (!record || typeof record !== 'object') return record;
    const hasBlackStatus = Boolean(
        record.hasBlackStatus ??
        record.has_black_status ??
        record.has_black ??
        record.is_black
    );

    const verificationStatus = String(record.verification_status || '').toLowerCase();
    const isFullyVerified = verificationStatus === 'verified' || (Boolean(record.kyc_verified) && Boolean(record.certificates_verified));

    return { ...record, hasBlackStatus, isFullyVerified };
}

function getTrainerBadgeIds(trainer) {
    const t = normalizeTrainerBadges(trainer);
    const ids = [];
    if (t?.isFullyVerified) ids.push('verified');
    if (t?.hasBlackStatus) ids.push('black');
    return ids;
}

function renderOnlifitBadgeHtml(badgeId, options = {}) {
    ensureOnlifitBadgeStyles();

    const def = ONLIFIT_BADGE_DEFS[badgeId];
    if (!def) return '';

    const size = options.size || 'sm'; // xs|sm|md
    const variant = options.variant || 'inline'; // inline|corner

    const sizeClass = size === 'xs' ? 'onlifit-badge--xs' : size === 'md' ? 'onlifit-badge--md' : 'onlifit-badge--sm';
    const variantClass = variant === 'corner' ? 'onlifit-badge--corner' : '';

    const toneClass = badgeId === 'verified' ? 'onlifit-badge--verified' : 'onlifit-badge--black';

    return `
        <span class="onlifit-badge ${toneClass} ${sizeClass} ${variantClass} onlifit-tooltip" data-tooltip="${def.tooltip}" title="${def.tooltip}" role="note">
            <span class="material-symbols-outlined onlifit-badge__icon" style="font-variation-settings: 'FILL' 1;">${def.icon}</span>
            <span>${def.label}</span>
        </span>
    `;
}

function renderTrainerBadgesHtml(trainer, options = {}) {
    const ids = getTrainerBadgeIds(trainer);
    if (!ids.length) return '';
    return ids.map(id => renderOnlifitBadgeHtml(id, options)).join('');
}

// Make available to all pages
window.normalizeTrainerBadges = normalizeTrainerBadges;
window.renderOnlifitBadgeHtml = renderOnlifitBadgeHtml;
window.renderTrainerBadgesHtml = renderTrainerBadgesHtml;

const OFFLINE_LOCATION_CACHE_KEY = 'onlifit_offline_location_v1';
let offlineLocationRequestPromise = null;

async function resolveOfflineSearchLocation() {
    const cached = readOfflineLocationCache();
    if (cached?.label) return cached;
    if (offlineLocationRequestPromise) return offlineLocationRequestPromise;

    offlineLocationRequestPromise = (async () => {
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not available in this browser.');
        }

        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 6500,
                maximumAge: 300000
            });
        });

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const label = await reverseGeocodeOfflineLocation(lat, lng);
        const resolved = {
            lat,
            lng,
            label: label || 'Your area'
        };

        saveOfflineLocationCache(resolved);
        return resolved;
    })();

    try {
        return await offlineLocationRequestPromise;
    } finally {
        offlineLocationRequestPromise = null;
    }
}

async function reverseGeocodeOfflineLocation(lat, lng) {
    const url = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&limit=1&lang=en`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const feature = data?.features?.[0];
    const props = feature?.properties || {};
    const cityBits = [props.location].filter(Boolean);
    if (cityBits.length) {
        return cityBits.slice(0, 1).join(', ');
    }

    return props.name || props.state || props.country || null;
}

function readOfflineLocationCache() {
    try {
        return JSON.parse(sessionStorage.getItem(OFFLINE_LOCATION_CACHE_KEY) || 'null');
    } catch {
        return null;
    }
}

function saveOfflineLocationCache(value) {
    try {
        sessionStorage.setItem(OFFLINE_LOCATION_CACHE_KEY, JSON.stringify(value));
    } catch {
        // Non-fatal
    }
}

window.resolveOfflineSearchLocation = resolveOfflineSearchLocation;
window.getApiAccessToken = getApiAccessToken;
window.getApiAuthHeader = getApiAuthHeader;

async function renderAuthNav() {
    const user = await getCurrentUser();
    const navAuthContainer = document.getElementById('nav-auth') || document.getElementById('auth-nav');
    const mobileNavAuthContainer = document.getElementById('mobile-nav-auth');

    if (AUTH_BYPASS) {
        const dashboardHref = getDashboardPathForRole(user.role);
        const desktopHtml = `
            <div class="flex items-center gap-3">
                <a href="${dashboardHref}" class="text-sm font-bold text-on-surface-variant hover:text-primary transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined text-[20px]">grid_view</span>
                    <span>Dashboard</span>
                </a>
                <span class="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-surface-container text-on-surface-variant">Guest mode</span>
            </div>
        `;
        const mobileHtml = `
            <a href="${dashboardHref}" class="w-full text-center px-5 py-3 text-base font-bold border-2 border-outline-variant/50 rounded-xl text-on-surface hover:bg-surface-container transition-all flex justify-center items-center gap-2">
                <span class="material-symbols-outlined text-[20px]">grid_view</span> Dashboard
            </a>
            <span class="w-full text-center px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl bg-surface-container text-on-surface-variant">Guest mode</span>
        `;
        if (navAuthContainer) navAuthContainer.innerHTML = desktopHtml;
        if (mobileNavAuthContainer) mobileNavAuthContainer.innerHTML = mobileHtml;
        return;
    }

    if (user) {
        if (user.auth_provider === 'clerk') {
            const dashboardHref = user.role === 'admin'
                ? 'admin-dashboard.html'
                : user.role === 'trainer'
                    ? 'bookings.html'
                    : 'client-dashboard.html';

            const desktopHtml = `
                <div class="flex items-center gap-3">
                    <a href="${dashboardHref}" class="text-sm font-bold text-on-surface-variant hover:text-primary transition-all flex items-center gap-2">
                        <span class="material-symbols-outlined text-[20px]">grid_view</span>
                        <span>Dashboard</span>
                    </a>
                    <button onclick="logout()" class="px-4 py-2 text-sm font-bold rounded-lg bg-primary text-on-primary hover:opacity-90 transition-all">Logout</button>
                </div>
            `;

            const mobileHtml = `
                <a href="${dashboardHref}" class="w-full text-center px-5 py-3 text-base font-bold border-2 border-outline-variant/50 rounded-xl text-on-surface hover:bg-surface-container transition-all flex justify-center items-center gap-2">
                    <span class="material-symbols-outlined text-[20px]">grid_view</span> Dashboard
                </a>
                <button onclick="logout()" class="w-full text-center px-6 py-3 text-base font-bold rounded-xl bg-primary text-on-primary hover:opacity-90 transition-all">Logout</button>
            `;

            if (navAuthContainer) navAuthContainer.innerHTML = desktopHtml;
            if (mobileNavAuthContainer) mobileNavAuthContainer.innerHTML = mobileHtml;
            return;
        }

        const notifications = await getNotifications(user.id);
        const unreadCount = notifications.filter(n => !n.read).length;

        const dashboardHref = getDashboardPathForRole(user.role);
        const messagesHref = getMessagesPathForRole(user.role);

        const desktopHtml = `
            <div class="flex items-center justify-end gap-3 sm:gap-6 w-full">
                <!-- Notifications -->
                <a href="notifications.html" class="relative text-on-surface-variant hover:text-primary transition-all hidden sm:block">
                    <span class="material-symbols-outlined text-[24px]">notifications</span>
                    ${unreadCount > 0 ? `<span class="absolute -top-1 -right-0 w-4 h-4 bg-primary text-white text-[9px] font-black flex items-center justify-center rounded-full border border-white">${unreadCount}</span>` : ''}
                </a>

                <!-- Messages -->
                <a href="${messagesHref}" class="relative text-on-surface-variant hover:text-primary transition-all hidden sm:block">
                    <span class="material-symbols-outlined text-[24px]">chat_bubble</span>
                </a>

                <!-- Vertical Divider -->
                <div class="h-6 w-[1px] bg-outline-variant hidden sm:block"></div>

                <!-- Dashboard link (Grid + Text) -->
                <a href="${dashboardHref}" 
                   class="text-sm font-bold text-on-surface-variant hover:text-primary transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined text-[20px]">grid_view</span>
                    <span>Dashboard</span>
                </a>

                <!-- Name Initial / Avatar (S circle) -->
                <div class="w-8 h-8 rounded-full bg-surface-container border border-outline-variant shadow-sm flex items-center justify-center text-sm font-bold text-primary ml-1">
                    ${user.name?.charAt(0).toUpperCase() || 'U'}
                </div>

                <!-- Logout Button -->
                <button onclick="logout()" class="text-sm font-bold text-on-surface-variant hover:text-error transition-all ml-1">Logout</button>
            </div>
        `;
        
        const mobileHtml = `
            <!-- Dashboard link (Grid + Text) -->
            <a href="${dashboardHref}" 
                class="w-full text-center px-5 py-3 text-base font-bold border-2 border-outline-variant/50 rounded-xl text-on-surface hover:bg-surface-container transition-all flex justify-center items-center gap-2">
                <span class="material-symbols-outlined text-[20px]">grid_view</span> Dashboard
            </a>
            
            <!-- Logout Button -->
            <button onclick="logout()" class="w-full text-center px-6 py-3 text-base font-bold bg-error/10 text-error rounded-xl shadow-lg hover:opacity-90 transition-all duration-300">Logout</button>
        `;

        if (navAuthContainer) navAuthContainer.innerHTML = desktopHtml;
        if (mobileNavAuthContainer) mobileNavAuthContainer.innerHTML = mobileHtml;

    } else {
        const desktopLoggedOut = `
            <a href="login.html" class="px-5 py-2 text-sm font-semibold text-on-surface-variant hover:text-primary transition-all">Login</a>
            <a href="login.html?tab=signup" class="px-6 py-2.5 text-sm font-bold bg-primary text-on-primary rounded-full shadow-lg shadow-primary/20 hover:opacity-90 transition-all">Sign Up</a>
        `;
        const mobileLoggedOut = `
            <a href="login.html" class="w-full text-center px-5 py-3 text-base font-bold border-2 border-outline-variant/50 rounded-xl text-on-surface hover:bg-surface-container transition-all">Login</a>
            <a href="login.html?tab=signup" class="w-full text-center px-6 py-3 text-base font-bold bg-primary text-on-primary rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all duration-300">Sign Up</a>
        `;
        if (navAuthContainer) navAuthContainer.innerHTML = desktopLoggedOut;
        if (mobileNavAuthContainer) mobileNavAuthContainer.innerHTML = mobileLoggedOut;
    }
}

function initData() {
    // Supabase handles data persistence. This is a placeholder for legacy compatibility.
}

// Init on load
// Note: We don't call renderAuthNav here because it's async now.
// Pages should call as needed.

// Auto-refresh header/nav on auth changes (helps after OAuth redirects).
try {
    if (window.supabaseClient?.auth?.onAuthStateChange) {
        supabaseClient.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                if (typeof renderAuthNav === 'function') {
                    renderAuthNav();
                }
            }
        });
    }
} catch (e) {
    // Non-fatal
}
