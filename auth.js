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
        // 1. Sign up with Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { name, role }
            }
        });

        if (authError) throw authError;

        const userId = authData.user.id;

        // 2. Create the profile in the 'profiles' table
        const profileData = {
            id: userId,
            name,
            email,
            role,
            phone,
            avatar_url: role === 'trainer' ? "🏋️" : null,
            ...(role === 'trainer' ? {
                specialty: trainerData?.specialty || "Personal Training",
                location: trainerData?.location || "Online",
                experience: trainerData?.experience || "1+ years",
                plans: trainerData?.plans || {},
                tags: trainerData?.tags || [],
                certifications: trainerData?.certifications || [],
            } : {
                goal: null,
                age: null,
                gender: null
            })
        };

        const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert([profileData]);

        if (profileError) throw profileError;

        return { success: true, user: authData.user };
    } catch (error) {
        console.error("Signup error:", error.message);
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

        // Fetch profile to get role
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError) throw profileError;

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

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

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

async function getTrainers() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('role', 'trainer');
    return data || [];
}

async function getTrainerById(id) {
    const { data: trainer, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', id)
        .eq('role', 'trainer')
        .single();

    if (error || !trainer) return null;

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
    return data || [];
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
