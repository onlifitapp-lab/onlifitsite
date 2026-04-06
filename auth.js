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

        return { success: true, user: authData.user };
    } catch (error) {
        console.error("Signup error:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Sign in with Google
 */
async function signInWithGoogle() {
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/client-dashboard.html'
            }
        });
        if (error) throw error;
        // The redirect handles the rest. Profile creation must happen in an edge function 
        // or a post-login check, but for now this works natively.
    } catch (error) {
        console.error("Google sign in error:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Login an existing user
 */
async function login(email, password) {
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Fetch profile to get role (handle multiple results or no results)
        const { data: profiles, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', data.user.id);

        if (profileError) throw profileError;

        // If no profile exists, create one (fallback)
        if (!profiles || profiles.length === 0) {
            console.warn("No profile found, creating one...");
            const { data: newProfile } = await supabaseClient
                .from('profiles')
                .insert([{
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.user_metadata?.name || 'User',
                    role: data.user.user_metadata?.role || 'client',
                    phone: data.user.user_metadata?.phone || null
                }])
                .select()
                .single();
            
            return { success: true, user: { ...data.user, ...newProfile } };
        }

        // Use first profile if multiple exist
        const profile = profiles[0];

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
    await supabaseClient.auth.signOut();
    window.location.href = 'onlifit.html';
}

/**
 * Get the currently logged-in user and their profile
 */
async function getCurrentUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id);

    // Handle no profile or multiple profiles
    const profile = profiles && profiles.length > 0 ? profiles[0] : null;

    return profile ? { ...user, ...profile } : user;
}

/**
 * Update user profile (e.g., during onboarding)
 */
async function updateUserProfile(userId, data) {
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
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(redirectUrl || window.location.href);
        return null;
    }
    if (requiredRole && user.role !== requiredRole) {
        window.location.href = user.role === 'trainer' ? 'bookings.html' : 'client-dashboard.html';
        return null;
    }
    return user;
}

// ─── DATA ACCESS ──────────────────────────────────────────────────────────────

const DUMMY_TRAINERS = [
    { id: 'd1', name: 'Arjun Sharma', specialty: 'Strength & Conditioning', experience: '8+ years', rating: 4.9, review_count: 124, location: 'Mumbai', avatar_url: '🏋️', plans: { basic: {price: 999, label: '1 Session'}, standard: {price: 3499, label: '4 Sessions'} }, tags: ['Weight Loss', 'Hypertrophy'] },
    { id: 'd2', name: 'Priya Patel', specialty: 'Yoga & Flexibility', experience: '5+ years', rating: 4.8, review_count: 98, location: 'Online', avatar_url: '🧘‍♀️', plans: { basic: {price: 799, label: '1 Session'}, standard: {price: 2999, label: '4 Sessions'} }, tags: ['Mobility', 'Mindfulness'] },
    { id: 'd3', name: 'Vikram Singh', specialty: 'Athletic Performance', experience: '12+ years', rating: 5.0, review_count: 210, location: 'Delhi', avatar_url: '🏃', plans: { basic: {price: 1499, label: '1 Session'}, standard: {price: 4999, label: '4 Sessions'} }, tags: ['Explosive Power', 'Agility'] },
    { id: 'd4', name: 'Neha Gupta', specialty: 'HIIT & Fat Loss', experience: '4+ years', rating: 4.7, review_count: 85, location: 'Online', avatar_url: '🔥', plans: { basic: {price: 899, label: '1 Session'}, standard: {price: 3199, label: '4 Sessions'} }, tags: ['Cardio', 'Endurance'] }
];

async function getTrainers() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('role', 'trainer');
    
    if (!data || data.length === 0) {
        return DUMMY_TRAINERS;
    }
    return data;
}

async function getTrainerById(id) {
    const { data: trainer, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', id)
        .eq('role', 'trainer')
        .single();

    if (error || !trainer) {
        // Fallback to dummy data mapping
        const dummy = DUMMY_TRAINERS.find(t => t.id === id);
        if (dummy) return { ...dummy, reviews: [] };
        return null;
    }

    // Fetch reviews for this trainer
    const { data: reviews } = await supabaseClient
        .from('reviews')
        .select(`
            *,
            client:profiles!reviews_client_id_fkey(name)
        `)
        .eq('trainer_id', id)
        .order('created_at', { ascending: false });

    return { ...trainer, reviews: reviews || [] };
}

async function searchTrainers(query, location) {
    let q = supabaseClient
        .from('profiles')
        .select('*')
        .eq('role', 'trainer');

    if (query) {
        q = q.or(`name.ilike.%${query}%,specialty.ilike.%${query}%,bio.ilike.%${query}%`);
    }

    if (location) {
        q = q.ilike('location', `%${location}%`);
    }

    const { data, error } = await q;
    if (!data || data.length === 0) {
        // Fallback to dummy data
        let filtered = [...DUMMY_TRAINERS];
        if (query) {
            filtered = filtered.filter(t => t.name.toLowerCase().includes(query.toLowerCase()) || t.specialty.toLowerCase().includes(query.toLowerCase()));
        }
        if (location) {
            filtered = filtered.filter(t => t.location.toLowerCase().includes(location.toLowerCase()));
        }
        return filtered;
    }
    return data;
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
    const { data: { user } } = await supabaseClient.auth.getUser();
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
        const trainer = await getTrainerById(trainerId);
        const user = await getCurrentUser();

        const bookingData = {
            client_id: clientId,
            trainer_id: trainerId,
            plan_type: planType,
            plan_label: trainer?.plans?.[planType]?.label || planType,
            price: trainer?.plans?.[planType]?.price || 0,
            date: details?.date || new Date().toISOString().split('T')[0],
            time: details?.time || '10:00 AM',
            status: 'confirmed'
        };

        const { data, error } = await supabaseClient
            .from('bookings')
            .insert([bookingData])
            .select()
            .single();

        if (error) throw error;

        // Create Notification for trainer
        await supabaseClient.from('notifications').insert([{
            user_id: trainerId,
            type: 'booking',
            title: 'New Booking Request',
            message: `${user?.name || 'A client'} has requested a ${bookingData.plan_label} for ${bookingData.date}.`
        }]);

        return data;
    } catch (error) {
        console.error("Create booking error:", error.message);
        return null;
    }
}

// ─── NOTIFICATIONS & MESSAGES ─────────────────────────────────────────────────

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
        const { data, error } = await supabaseClient
            .from('messages')
            .insert([{ sender_id: senderId, receiver_id: receiverId, text }])
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

// ─── UI HELPERS ───────────────────────────────────────────────────────────────

async function renderAuthNav() {
    const user = await getCurrentUser();
    const navAuthContainer = document.getElementById('nav-auth');
    if (!navAuthContainer) return;

    if (user) {
        const notifications = await getNotifications(user.id);
        const unreadCount = notifications.filter(n => !n.read).length;

        navAuthContainer.innerHTML = `
            <div class="flex items-center gap-1 sm:gap-4">
                <a href="notifications.html" class="relative w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-all">
                    <span class="material-symbols-outlined text-[24px]">notifications</span>
                    ${unreadCount > 0 ? `<span class="absolute top-2 right-2 w-4 h-4 bg-primary text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white">${unreadCount}</span>` : ''}
                </a>
                <a href="messages.html" class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-all">
                    <span class="material-symbols-outlined text-[24px]">chat_bubble</span>
                </a>
                <div class="h-6 w-[1px] bg-outline-variant mx-1 hidden sm:block"></div>
                <a href="${user.role === 'trainer' ? 'bookings.html' : 'client-dashboard.html'}" 
                   class="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-primary transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">dashboard</span>
                    <span class="hidden lg:inline">Dashboard</span>
                </a>
                <div class="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low rounded-full">
                    <div class="w-7 h-7 rounded-full bg-primary-container flex items-center justify-center text-sm font-bold text-primary">
                        ${user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                </div>
                <button onclick="logout()" class="px-3 py-2 text-sm font-semibold text-on-surface-variant hover:text-error transition-all sm:inline hidden">Logout</button>
            </div>
        `;
    } else {
        navAuthContainer.innerHTML = `
            <a href="login.html" class="px-5 py-2 text-sm font-semibold text-on-surface-variant hover:text-primary transition-all">Login</a>
            <a href="login.html?tab=signup" class="px-6 py-2.5 text-sm font-bold bg-primary text-on-primary rounded-full shadow-lg shadow-primary/20 hover:opacity-90 transition-all">Sign Up</a>
        `;
    }
}

function initData() {
    // Supabase handles data persistence. This is a placeholder for legacy compatibility.
}

// Init on load
// Note: We don't call renderAuthNav here because it's async now.
// Pages should call as needed.
