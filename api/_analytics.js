// Best-effort activity logging into the existing user_activity_log table
// (already live, already RLS'd to owner+admin SELECT only, no schema change
// needed). A logging failure must never break a payment flow, so every
// call site awaits this but the function itself swallows its own errors.
export async function logActivity(supabase, userId, activityType, metadata) {
    try {
        await supabase.from('user_activity_log').insert([{
            user_id: userId,
            activity_type: activityType,
            description: metadata?.description || activityType,
            metadata: metadata || {}
        }]);
    } catch (error) {
        console.error(`Failed to log activity '${activityType}':`, error);
    }
}
