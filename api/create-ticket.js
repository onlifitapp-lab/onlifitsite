import { extractBearerToken, getServiceSupabaseClient, resolveRequestAuth } from './_auth.js';

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

        const {
            subject,
            category,
            message,
            guestEmail,
            attachmentPath,
            attachmentName,
            attachmentType,
            attachmentSize
        } = req.body || {};

        if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message are required' });
        }

        // Initialize Secure Backend Supabase Client
        const supabase = getServiceSupabaseClient();

        let userId = null;
        const token = extractBearerToken(req);

        // If a token is provided, it must be valid (Supabase or Clerk).
        if (token) {
            const auth = await resolveRequestAuth(req);
            if (!auth.authenticated) {
                return res.status(auth.status || 401).json({ error: auth.error || 'Unauthorized' });
            }
            userId = auth.userId;
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
        const { data: insertedMessage, error: msgError } = await supabase
            .from('ticket_messages')
            .insert([{
                ticket_id: ticket.id,
                sender_id: userId,
                message: finalMessage,
                is_internal: false
            }])
            .select('id')
            .single();

        if (msgError) throw msgError;

        // 3. Save attachment metadata (authenticated users only)
        if (userId && attachmentPath && attachmentName) {
            const normalizedPath = String(attachmentPath || '').trim();
            const expectedPrefix = `${userId}/`;

            if (!normalizedPath.startsWith(expectedPrefix)) {
                return res.status(400).json({ error: 'Invalid attachment path for current user' });
            }

            const { error: attachmentError } = await supabase
                .from('ticket_attachments')
                .insert([{
                    message_id: insertedMessage.id,
                    ticket_id: ticket.id,
                    file_url: normalizedPath,
                    file_name: String(attachmentName).slice(0, 255),
                    file_type: String(attachmentType || 'unknown').slice(0, 100),
                    file_size: Number.isFinite(Number(attachmentSize)) ? Number(attachmentSize) : null
                }]);

            if (attachmentError) throw attachmentError;
        }

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