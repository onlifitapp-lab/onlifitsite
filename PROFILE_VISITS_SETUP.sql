-- Profile Visits Tracking
-- Adds support for "Profile Visits (7d)" insight on the Trainer Dashboard.

CREATE TABLE IF NOT EXISTS profile_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visitor_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  visited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  referrer TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_profile_visits_trainer_visited_at
  ON profile_visits (trainer_id, visited_at DESC);

ALTER TABLE profile_visits ENABLE ROW LEVEL SECURITY;

-- Anyone can record a visit (including logged-out visitors) via anon key.
CREATE POLICY "Profile visits insertable by anyone"
  ON profile_visits FOR INSERT
  WITH CHECK (true);

-- Trainers can view their own visit counts.
CREATE POLICY "Trainers can view own profile visits"
  ON profile_visits FOR SELECT
  USING (auth.uid() = trainer_id);
