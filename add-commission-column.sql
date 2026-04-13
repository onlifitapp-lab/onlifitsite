-- ================================================================
-- ADD COMMISSION COLUMN TO BOOKINGS TABLE
-- Run this in Supabase SQL Editor
-- ================================================================

ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS commission DECIMAL(10,2) DEFAULT 0;

-- Optional: Update existing bookings to have a 0 commission instead of NULL
UPDATE bookings SET commission = 0 WHERE commission IS NULL;