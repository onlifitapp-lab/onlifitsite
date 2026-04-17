// Initialize the Supabase Client
const supabaseUrl = 'https://lnbsgnfrhewdqhuqqotx.supabase.co';
const supabaseKey = 'sb_publishable_aydGJpF-x6Rira9ZNyxqYw_ldbXVLZQ'; // Note: Ensure this is the correct 'anon public' key from Supabase

const _supabase = supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        // Make OAuth callbacks reliable across refreshes / redirects.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
    }
});
window.supabaseClient = _supabase;
window.supabase = _supabase; // Maintain 'supabase' as an alias for legacy scripts, but 'supabaseClient' is the primary.



// Helper to check connection
async function checkSupabase() {
    try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) throw error;
        console.log("Supabase connected successfully!");
    } catch (e) {
        console.error("Supabase connection failed:", e.message);
    }
}
