import { randomUUID } from 'crypto';
import { getServiceSupabaseClient, resolveRequestAuth, setCorsHeaders } from './_auth.js';

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 1. AUTHENTICATE
    const auth = await resolveRequestAuth(req);
    if (!auth.authenticated) {
        return res.status(auth.status || 401).json({ error: auth.error });
    }

    const clientId = auth.userId;

    // 2. VALIDATE INPUT
    const {
        trainerId, planType, idempotencyKey,
        clientName, phoneNumber, fitnessGoal, trainingMode, location,
        budget, preferredTime, message
    } = req.body || {};
    if (!trainerId || !planType) {
        return res.status(400).json({ error: 'trainerId and planType are required' });
    }

    // An idempotency key should be supplied by the client (generated once per
    // submit attempt) so retries/double-clicks can't consume multiple enquiry
    // credits. Falling back to a server-generated key keeps older callers
    // working, though it won't protect against client-side double-submits.
    const resolvedIdempotencyKey = typeof idempotencyKey === 'string' && idempotencyKey.trim()
        ? idempotencyKey.trim()
        : randomUUID();

    const supabase = getServiceSupabaseClient();

    try {
        // 3. FETCH TRAINER (with subscription info)
        const { data: trainer, error: trainerErr } = await supabase
            .from('profiles')
            .select('id, name, role, plans, whatsapp_number, phone, subscription_plan, subscription_status')
            .eq('id', trainerId)
            .eq('role', 'trainer')
            .maybeSingle();

        if (trainerErr || !trainer) {
            return res.status(404).json({ error: 'Trainer not found' });
        }

        // 4. RESOLVE PLAN PRICE FROM TRAINER'S PLANS
        let price = 0;
        let planLabel = planType;
        try {
            const plans = typeof trainer.plans === 'string' ? JSON.parse(trainer.plans) : trainer.plans;
            if (plans && typeof plans === 'object') {
                const planData = plans[planType];
                if (planData) {
                    price = Number(planData.price || planData.amount || 0);
                    planLabel = planData.label || planData.name || planType;
                }
            }
        } catch (e) {
            // Non-fatal — price stays 0
        }

        // 6. CREATE ENQUIRY — atomic, idempotent, duplicate-protected, cap-enforced.
        // source is 'marketplace' (acquisition origin), not the contact
        // channel — every enquiry today originates from browsing the
        // marketplace, even though the handoff itself happens on WhatsApp.
        const { data: enquiryResult, error: enquiryErr } = await supabase
            .rpc('try_create_client_enquiry', {
                p_trainer_id: trainerId,
                p_client_id: clientId,
                p_plan_type: planType,
                p_source: 'marketplace',
                p_idempotency_key: resolvedIdempotencyKey,
                p_client_name: clientName || null,
                p_phone_number: phoneNumber || null,
                p_fitness_goal: fitnessGoal || null,
                p_training_mode: trainingMode || null,
                p_location: location || null,
                p_budget: budget || null,
                p_preferred_time: preferredTime || null,
                p_message: message || null
            });

        if (enquiryErr) {
            console.error('Enquiry creation failed:', enquiryErr);
            return res.status(500).json({ error: 'Failed to create enquiry. Please try again.' });
        }

        if (!enquiryResult?.success) {
            if (enquiryResult?.code === 'ENQUIRY_LIMIT_REACHED') {
                return res.status(429).json({
                    error: 'This trainer has reached their monthly enquiry limit. Please try again next month or choose another trainer.',
                    code: 'ENQUIRY_LIMIT_REACHED'
                });
            }
            return res.status(500).json({ error: 'Failed to create enquiry. Please try again.' });
        }

        // 7. CREATE NOTIFICATION FOR TRAINER (skip on idempotent replay/duplicate
        // so a re-contacted or retried request doesn't spam the trainer again)
        if (!enquiryResult.idempotent_replay && !enquiryResult.duplicate) {
            try {
                const notifyingClientName = clientName || auth.profile?.name || 'A client';
                await supabase.from('notifications').insert([{
                    user_id: trainerId,
                    type: 'booking',
                    title: 'New Enquiry Received!',
                    message: `${notifyingClientName} is interested in your ${planLabel} plan. Open WhatsApp to connect.`,
                    read: false
                }]);
            } catch (e) {
                // Non-fatal
                console.warn('Notification insert failed:', e?.message);
            }
        }

        // 8. RETURN SUCCESS + WHATSAPP INFO
        const trainerPhone = (trainer.whatsapp_number || trainer.phone || '').replace(/\s|\+/g, '');
        const waMessage = encodeURIComponent(
            `Hi ${trainer.name || 'Trainer'}, I'm interested in your ${planLabel} plan on Onlifit. Can we discuss?`
        );
        const whatsappUrl = trainerPhone
            ? `https://wa.me/${trainerPhone}?text=${waMessage}`
            : null;

        // Log the moment the WhatsApp handoff link was generated (reusing
        // the Phase 1 event architecture — not a new tracking system). Best
        // effort: never block or fail the response over this.
        if (whatsappUrl && !enquiryResult.idempotent_replay) {
            try {
                await supabase.from('client_enquiry_events').insert([{
                    enquiry_id: enquiryResult.enquiry_id,
                    event_type: 'whatsapp_link_generated',
                    meta: { plan_type: planType },
                    actor_id: clientId
                }]);
            } catch (e) {
                console.warn('whatsapp_link_generated event insert failed:', e?.message);
            }
        }

        return res.status(201).json({
            success: true,
            leadId: enquiryResult.enquiry_id,
            trainerName: trainer.name,
            whatsappUrl,
            trainerPhone: trainerPhone || null,
            message: 'Enquiry created successfully! Contact the trainer on WhatsApp.'
        });

    } catch (err) {
        console.error('create-lead error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
