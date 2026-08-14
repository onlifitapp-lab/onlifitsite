import { getServiceSupabaseClient, resolveRequestAuth, setCorsHeaders } from './_auth.js';

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = await resolveRequestAuth(req);
    if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

    const clientId = auth.userId;
    const supabase = getServiceSupabaseClient();

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', clientId)
        .maybeSingle();

    if (!profile || profile.role !== 'client') {
        return res.status(403).json({ error: 'Only clients can leave a review' });
    }

    const trainerId = req.body?.trainer_id;
    const rating = Number(req.body?.rating);
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : null;

    if (!trainerId) {
        return res.status(400).json({ error: 'trainer_id is required' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
    }

    const { data: enquiry } = await supabase
        .from('client_enquiries')
        .select('id')
        .eq('client_id', clientId)
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!enquiry) {
        return res.status(403).json({ error: 'You can only review a trainer you have contacted' });
    }

    const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('client_id', clientId)
        .eq('trainer_id', trainerId)
        .maybeSingle();

    if (existingReview) {
        return res.status(409).json({ error: 'You have already reviewed this trainer' });
    }

    const { error: insertErr } = await supabase.from('reviews').insert([{
        client_id: clientId,
        trainer_id: trainerId,
        rating,
        text: text || null,
        enquiry_id: enquiry.id
    }]);

    if (insertErr) {
        // 23505 = unique_violation — covers the race between the check above
        // and this insert if two requests land at nearly the same time.
        if (insertErr.code === '23505') {
            return res.status(409).json({ error: 'You have already reviewed this trainer' });
        }
        console.error('reviews insert failed:', insertErr);
        return res.status(500).json({ error: 'Failed to submit review' });
    }

    return res.status(201).json({ success: true });
}
