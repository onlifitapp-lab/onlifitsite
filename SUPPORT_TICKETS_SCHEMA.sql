-- ================================================================
-- SUPPORT TICKETS & ATTACHMENTS SCHEMA
-- ================================================================

-- 1. Create support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, 
    subject TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create ticket messages table
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- For admin-only notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create ticket attachments table 
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES ticket_messages(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE, -- Denormalized for easier RLS
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Tickets Policies
CREATE POLICY "Users can view own tickets" ON support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all tickets" ON support_tickets FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Ticket Messages Policies
CREATE POLICY "Users can view msgs on own tickets" ON ticket_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = ticket_id AND support_tickets.user_id = auth.uid()) 
    AND is_internal = false
);
CREATE POLICY "Admins can view all msgs" ON ticket_messages FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Users can add msgs to own tickets" ON ticket_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = ticket_id AND support_tickets.user_id = auth.uid()) 
    AND sender_id = auth.uid()
);

-- Ticket Attachments Policies
CREATE POLICY "Users can view attachments on own tickets" ON ticket_attachments FOR SELECT USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = ticket_id AND support_tickets.user_id = auth.uid())
);
CREATE POLICY "Admins can view all attachments" ON ticket_attachments FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Enable realtime
BEGIN;
  DROP PUBLICATION IF EXISTS ticktes_realtime;
  CREATE PUBLICATION ticktes_realtime FOR TABLE support_tickets, ticket_messages;
COMMIT;

-- ================================================================
-- STORAGE BUCKET FOR TICKETS
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket_attachments', 'ticket_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Ticket attachments are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'ticket_attachments');
-- Anyone authenticated can technically upload (we validate their ticket association in client apps)
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ticket_attachments' AND auth.role() = 'authenticated');
