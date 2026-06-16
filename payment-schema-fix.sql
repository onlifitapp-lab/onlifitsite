-- Migration: Add payment columns to bookings and create payments ledger
-- Run in Supabase SQL Editor (staging first)

-- 1) Add missing booking payment columns (non-destructive)
ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS transaction_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT,
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS order_receipt TEXT,
ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending';

-- 2) Ensure commission column exists
ALTER TABLE IF EXISTS bookings
ADD COLUMN IF NOT EXISTS commission DECIMAL(10,2) DEFAULT 0;
UPDATE bookings SET commission = 0 WHERE commission IS NULL;

-- 3) Create payments ledger table for immutable payment records
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  amount DECIMAL(10,2),
  currency TEXT,
  status TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);

-- 4) Optional: webhook logs table for future use
CREATE TABLE IF NOT EXISTS payment_webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT,
  payload JSONB,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
