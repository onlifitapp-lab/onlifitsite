-- Migration: Add uniqueness constraints and finalize_payment function
-- Run in Supabase SQL Editor (staging first)

-- 1) Unique indexes to enforce idempotency at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id_unique ON payments(razorpay_payment_id);

-- transaction_id column may be NULL for legacy rows; add unique index only if column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='transaction_id') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_transaction_id_unique ON bookings(transaction_id);
  END IF;
END$$;

-- 2) Atomic finalize function: insert payment (on conflict do nothing) and update booking only once
CREATE OR REPLACE FUNCTION finalize_payment(
  _booking_id UUID,
  _razorpay_order_id TEXT,
  _razorpay_payment_id TEXT,
  _amount NUMERIC,
  _currency TEXT,
  _payload JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing_payment_id UUID;
  v_already_paid BOOLEAN := FALSE;
BEGIN
  -- If booking already marked paid, short-circuit
  SELECT payment_status = 'paid' INTO v_already_paid FROM bookings WHERE id = _booking_id;
  IF v_already_paid THEN
    RETURN jsonb_build_object('status','already_paid','booking_id',_booking_id);
  END IF;

  -- Try to insert payment - if payment id already exists, do nothing (idempotent)
  INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, payload)
  VALUES (_booking_id, _razorpay_order_id, _razorpay_payment_id, _amount, _currency, 'paid', _payload)
  ON CONFLICT (razorpay_payment_id) DO UPDATE SET payload = payments.payload || EXCLUDED.payload
  RETURNING id INTO v_existing_payment_id;

  -- Update booking only if not already paid
  UPDATE bookings
  SET status = 'confirmed',
      transaction_id = _razorpay_payment_id,
      razorpay_payment_id = _razorpay_payment_id,
      razorpay_order_id = _razorpay_order_id,
      payment_status = 'paid',
      amount_paid = _amount
  WHERE id = _booking_id AND (payment_status IS NULL OR payment_status <> 'paid');

  RETURN jsonb_build_object('status','ok','payment_id',v_existing_payment_id,'booking_id',_booking_id);
END;
$$;
