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
    const { trainerId, planType, details, idempotencyKey } = req.body || {};
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

        // 6. CREATE ENQUIRY — atomic, idempotent, duplicate-protected, cap-enforced
        const { data: enquiryResult, error: enquiryErr } = await supabase
            .rpc('try_create_client_enquiry', {
                p_trainer_id: trainerId,
                p_client_id: clientId,
                p_plan_type: planType,
                p_source: 'whatsapp',
                p_idempotency_key: resolvedIdempotencyKey
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
                const clientName = auth.profile?.name || 'A client';
                await supabase.from('notifications').insert([{
                    user_id: trainerId,
                    type: 'booking',
                    title: 'New Enquiry Received!',
                    message: `${clientName} is interested in your ${planLabel} plan. Open WhatsApp to connect.`,
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
