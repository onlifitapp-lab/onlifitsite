-- Onlifit Supabase Schema
-- Run this in your Supabase SQL Editor

-- 1. Create Profiles Table (Extends Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'client', -- 'client' or 'trainer'
  phone TEXT,
  address TEXT,
  avatar_url TEXT,
  
  -- Trainer-specific fields
  specialty TEXT,
  bio TEXT,
  location TEXT,
  rating DECIMAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  experience TEXT,
  plans JSONB, -- Stores hourly/monthly/premium plans
  certifications TEXT[],
  tags TEXT[],
  
  -- Client-specific fields
  goal TEXT,
  age INTEGER,
  gender TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Bookings Table
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES profiles(id),
  trainer_id UUID REFERENCES profiles(id),
  plan_type TEXT,
  plan_label TEXT,
  price DECIMAL,
  date DATE,
  time TEXT,
  status TEXT DEFAULT 'confirmed', -- 'pending', 'confirmed', 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Messages Table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id),
  receiver_id UUID REFERENCES profiles(id),
  text TEXT NOT NULL,
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'seen'
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3a. Create Typing Status Table
CREATE TABLE typing_status (
  user_id UUID REFERENCES profiles(id),
  chat_with UUID REFERENCES profiles(id),
  is_typing BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, chat_with)
);

-- 4. Create Notifications Table
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  type TEXT, -- 'booking', 'message', 'alert'
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Reviews Table
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID REFERENCES profiles(id),
  client_id UUID REFERENCES profiles(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 7. Policies (Simplified for development - Adjust for production)
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Bookings are viewable by participants" ON bookings FOR SELECT 
USING (auth.uid() = client_id OR auth.uid() = trainer_id);
CREATE POLICY "Clients can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Messages are viewable by participants" ON messages FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update own messages" ON messages FOR UPDATE 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Typing status viewable by participants" ON typing_status FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = chat_with);
CREATE POLICY "Users can manage own typing status" ON typing_status FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Notifications are viewable by owner" ON notifications FOR SELECT 
USING (auth.uid() = user_id);
CREATE POLICY "System/Users can create notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can mark own notifications as read" ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (true);
CREATE POLICY "Clients can leave reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = client_id);

-- 8. Enable Realtime (MANDATORY for the Real-time feature to work)
-- This allows the front-end to listen for changes to these tables.
BEGIN;
  -- Remove existing if any
  DROP PUBLICATION IF EXISTS supabase_realtime;
  -- Create publication for the tables we need real-time on
  CREATE PUBLICATION supabase_realtime FOR TABLE messages, typing_status, notifications, bookings;
COMMIT;

-- 9. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_typing_status_chat ON typing_status(chat_with, is_typing);

/**
 * 10. STORAGE (Optional - Run if you want to support avatar uploads)
 * Create a public bucket named 'avatars' in the Supabase Storage dashboard.
 * Then run the following to allow users to upload their own avatars:
 
 INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
 
 CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
 CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
 */
