// Simple in-memory KV store for rate limiting in serverless environments (Ephemeral but helps against burst spam per lambda container)
const rateLimitCache = new Map();
const MAX_TICKETS_PER_WINDOW = 3;
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // --- RATE LIMITING CHOKEPOINT ---
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        
        if (rateLimitCache.has(ip)) {
            let userData = rateLimitCache.get(ip);
            userData.requests = userData.requests.filter(timestamp => now - timestamp < WINDOW_DURATION_MS);
            
            if (userData.requests.length >= MAX_TICKETS_PER_WINDOW) {
                return res.status(429).json({ error: 'Rate limit exceeded. You can only create 3 support tickets every 15 minutes. Please try again later.' });
            }
            userData.requests.push(now);
            rateLimitCache.set(ip, userData);
        } else {
            rateLimitCache.set(ip, { requests: [now] });
        }

        const { subject, category, message, guestEmail, authHeader } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message are required' });
        }

        // Initialize Secure Backend Supabase Client
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        let userId = null;

        // If logged in, get their user ID
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (!authError && user) {
                userId = user.id;
            }
        }

        // Include guest email in the message if they aren't logged in
        const finalMessage = userId ? message : `[GUEST EMAIL: ${guestEmail || 'Not provided'}]\n\n${message}`;

        // 1. Create the Ticket
        const { data: ticket, error: ticketError } = await supabase
            .from('support_tickets')
            .insert([{
                user_id: userId,
                subject: subject,
                category: category || 'other',
                priority: 'medium',
                status: 'open'
            }])
            .select()
            .single();

        if (ticketError) throw ticketError;

        // 2. Add the Initial Message
        const { error: msgError } = await supabase
            .from('ticket_messages')
            .insert([{
                ticket_id: ticket.id,
                sender_id: userId,
                message: finalMessage,
                is_internal: false
            }]);

        if (msgError) throw msgError;

        return res.status(200).json({
            success: true,
            message: 'Support ticket successfully created',
            ticketId: ticket.id
        });

    } catch (error) {
        console.error('Ticket Creation Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}