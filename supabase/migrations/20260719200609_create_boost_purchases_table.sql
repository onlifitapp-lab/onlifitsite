-- ============================================================================
-- Recreated post-hoc on 2026-07-21 to bring supabase/migrations back in sync
-- with production history. This file was NOT run to produce this migration
-- (it was applied directly via the Supabase MCP apply_migration tool on
-- 2026-07-20); it is a faithful, unmodified copy of the SQL that was actually
-- executed, filed under its real recorded version so `supabase_migrations
-- .schema_migrations` and this repo agree. See MIGRATION_HISTORY.md.
-- ============================================================================

CREATE TABLE boost_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES profiles(id),
  duration_days integer NOT NULL CHECK (duration_days IN (3, 7)),
  amount numeric NOT NULL,
  gst_amount numeric DEFAULT 0,
  coupon_code text,
  invoice_number text UNIQUE,
  payment_gateway text NOT NULL DEFAULT 'razorpay' CHECK (payment_gateway IN ('razorpay')),
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text UNIQUE,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'refunded')),
  payment_status text,
  failure_reason text,
  refunded_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_boost_purchases_trainer_id ON boost_purchases(trainer_id);

ALTER TABLE boost_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boost_purchases_select_own" ON boost_purchases
  FOR SELECT USING (auth.uid() = trainer_id);
