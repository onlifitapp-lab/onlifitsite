const fs = require('fs');
let code = fs.readFileSync('api/create-ticket.js', 'utf8');

const strToReplace = `        // 2. Add the Initial Message
        const { error: msgError } = await supabase
            .from('ticket_messages')
            .insert([{
                ticket_id: ticket.id,
                sender_id: userId,
                message: finalMessage,
                is_internal: false
            }]);

        if (msgError) throw msgError;

        return res.status(200).json({`;

const newStr = `        // 2. Add the Initial Message
        const { data: newMsg, error: msgError } = await supabase
            .from('ticket_messages')
            .insert([{
                ticket_id: ticket.id,
                sender_id: userId,
                message: finalMessage,
                is_internal: false
            }])
            .select()
            .single();

        if (msgError) throw msgError;

        // 3. Create Attachment Record if provided
        const { attachmentUrl, attachmentName, attachmentType } = req.body;
        
        if (attachmentUrl && attachmentName) {
            const { error: attachError } = await supabase
                .from('ticket_attachments')
                .insert([{
                    message_id: newMsg.id,
                    ticket_id: ticket.id,
                    file_url: attachmentUrl,
                    file_name: attachmentName,
                    file_type: attachmentType || 'unknown',
                    file_size: 0 // Optional unless calculated frontend
                }]);
                
            if (attachError) console.error('Attachment failed to link:', attachError);
        }

        return res.status(200).json({`;

code = code.replace(strToReplace, newStr);

fs.writeFileSync('api/create-ticket.js', code);
console.log('Modified api/create-ticket.js successfully with attachments logic.');
