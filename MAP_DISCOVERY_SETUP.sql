-- Optional geo support for map-based trainer discovery
-- Safe to run on existing installs

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_profiles_trainer_geo
  ON profiles (latitude, longitude)
  WHERE role = 'trainer' AND latitude IS NOT NULL AND longitude IS NOT NULL;
