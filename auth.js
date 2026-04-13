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
async function signInWithGoogle(role = 'client', isSignup = false) {
    try {
        console.log('Google OAuth initiated with role:', role, 'isSignup:', isSignup);
        
        // Determine redirect based on role and whether it's signup or login
        let redirectTo = window.location.origin;
        if (isSignup && role === 'trainer') {
            redirectTo += '/trainer-onboarding.html';
        } else if (isSignup && role === 'client') {
            redirectTo += '/onboarding.html';
        } else if (role === 'trainer') {
            redirectTo += '/bookings.html';
        } else {
            redirectTo += '/client-dashboard.html';
        }
        
        // Store role in localStorage so we can use it after OAuth redirect
        localStorage.setItem('oauth_role', role);
        localStorage.setItem('oauth_is_signup', isSignup ? 'true' : 'false');
        
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo,
                data: {
                    role: role
                }
            }
        });
        if (error) throw error;
        // The redirect handles the rest
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
 * Handle OAuth callback - Check and set role from localStorage, then redirect
 */
async function handleOAuthCallback() {
    const oauthRole = localStorage.getItem('oauth_role');
    const oauthIsSignup = localStorage.getItem('oauth_is_signup');
    
    // Get current user
    const user = await getCurrentUser();
    
    if (!user) {
        return; // No user logged in, nothing to do
    }
    
    // CASE 1: OAuth Signup (has localStorage data)
    if (oauthRole && oauthIsSignup === 'true') {
        console.log('OAuth SIGNUP detected. Role:', oauthRole);
        
        // Update profile with correct role
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role, onboarding_completed')
            .eq('id', user.id)
            .single();
        
        if (!profile || !profile.role || profile.role !== oauthRole) {
            console.log('Updating OAuth user role to:', oauthRole);
            await supabaseClient
                .from('profiles')
                .update({ role: oauthRole })
                .eq('id', user.id);
        }
        
        // Clear OAuth data
        localStorage.removeItem('oauth_role');
        localStorage.removeItem('oauth_is_signup');
        
        // Redirect new user to onboarding
        if (oauthRole === 'trainer') {
            console.log('Redirecting new trainer to onboarding');
            window.location.href = 'trainer-onboarding.html';
        } else {
            console.log('Redirecting new client to onboarding');
            window.location.href = 'onboarding.html';
        }
        return;
    }
    
    // CASE 2: OAuth Login (returning user, no localStorage or isSignup is false)
    // Check if we just came back from OAuth (user is logged in but we're on login page)
    if (window.location.pathname.includes('login.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        
        // If no specific mode/role in URL, this is a returning user login
        if (!urlParams.get('tab') && !oauthRole) {
            console.log('OAuth LOGIN detected for returning user');
            
            // Fetch user's role from database
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('role, onboarding_completed')
                .eq('id', user.id)
                .single();
            
            if (profile && profile.role) {
                console.log('User role:', profile.role);
                
                // Clear any leftover OAuth data
                localStorage.removeItem('oauth_role');
                localStorage.removeItem('oauth_is_signup');
                
                // Redirect based on actual role in database
                if (profile.role === 'trainer') {
                    console.log('Redirecting trainer to bookings dashboard');
                    window.location.href = 'bookings.html';
                } else {
                    console.log('Redirecting client to dashboard');
                    window.location.href = 'client-dashboard.html';
                }
                return;
            }
        }
    }
    
    // Clear OAuth data if present (cleanup)
    if (oauthRole) {
        localStorage.removeItem('oauth_role');
        localStorage.removeItem('oauth_is_signup');
    }
}

/**
 * Update user profile (e.g., during onboarding or settings)
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

    return { ...trainer, reviews: reviews || [] };
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
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData?.session?.access_token;
        
        // Let's call our newly created secure API endpoint on Vercel
        const response = await fetch('/api/create-booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientId: clientId,
                trainerId: trainerId,
                planType: planType,
                details: details,
                authHeader: `Bearer ${token}` // Pass the token to verify the user
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
            .insert([{ 
                sender_id: senderId, 
                receiver_id: receiverId, 
                text,
                status: 'sent',
                read: false
            }])
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
        if (status) updates.status = status;
        if (read !== undefined) updates.read = read;

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
        const { error } = await supabaseClient
            .from('messages')
            .update({ read: true, status: 'seen' })
            .eq('sender_id', senderId)
            .eq('receiver_id', receiverId)
            .eq('read', false);

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
        const { count, error } = await supabaseClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', userId)
            .eq('read', false);

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
    return supabaseClient
        .channel(`typing:${contactId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'typing_status',
            filter: `user_id=eq.${contactId},chat_with=eq.${userId}`
        }, payload => {
            callback(payload.new?.is_typing || false);
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
