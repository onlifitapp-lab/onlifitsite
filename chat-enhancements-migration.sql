-- Chat Enhancements Migration
-- Run this in your Supabase SQL Editor to add chat features
-- This adds: read receipts, message status, typing indicators, and more

-- 1. Add new columns to messages table
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- 2. Create typing status table
CREATE TABLE IF NOT EXISTS typing_status (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  chat_with UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_typing BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, chat_with)
);

-- 3. Enable RLS on typing_status
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

-- 4. Add policies for messages UPDATE
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages" ON messages FOR UPDATE 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 5. Add policies for typing_status
DROP POLICY IF EXISTS "Typing status viewable by participants" ON typing_status;
CREATE POLICY "Typing status viewable by participants" ON typing_status FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = chat_with);

DROP POLICY IF EXISTS "Users can manage own typing status" ON typing_status;
CREATE POLICY "Users can manage own typing status" ON typing_status FOR ALL 
USING (auth.uid() = user_id);

-- 6. Update realtime publication to include typing_status
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE messages, typing_status, notifications, bookings;
COMMIT;

-- 7. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_typing_status_chat ON typing_status(chat_with, is_typing) WHERE is_typing = TRUE;

-- 8. Create helper function to get last message for each conversation
CREATE OR REPLACE FUNCTION get_last_messages_for_user(user_uuid UUID)
RETURNS TABLE (
  contact_id UUID,
  last_message_text TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT,
  is_sender BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH user_messages AS (
    SELECT 
      CASE 
        WHEN sender_id = user_uuid THEN receiver_id
        ELSE sender_id
      END as other_user_id,
      text,
      created_at,
      sender_id = user_uuid as am_sender,
      read,
      ROW_NUMBER() OVER (
        PARTITION BY 
          CASE 
            WHEN sender_id = user_uuid THEN receiver_id
            ELSE sender_id
          END
        ORDER BY created_at DESC
      ) as rn
    FROM messages
    WHERE sender_id = user_uuid OR receiver_id = user_uuid
  )
  SELECT 
    um.other_user_id as contact_id,
    um.text as last_message_text,
    um.created_at as last_message_time,
    (
      SELECT COUNT(*)::BIGINT
      FROM messages m
      WHERE m.receiver_id = user_uuid 
        AND m.sender_id = um.other_user_id
        AND m.read = FALSE
    ) as unread_count,
    um.am_sender as is_sender
  FROM user_messages um
  WHERE um.rn = 1
  ORDER BY um.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Chat enhancements migration completed successfully!';
  RAISE NOTICE 'New features available:';
  RAISE NOTICE '  ✓ Message read status';
  RAISE NOTICE '  ✓ Message delivery status (sent/delivered/seen)';
  RAISE NOTICE '  ✓ Typing indicators';
  RAISE NOTICE '  ✓ Last message preview function';
  RAISE NOTICE '  ✓ Performance indexes';
END $$;
