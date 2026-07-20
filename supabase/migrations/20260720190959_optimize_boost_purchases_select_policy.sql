-- ============================================================================
-- Caught by Supabase's performance advisor (get_advisors, type: performance)
-- during Phase 2 QA, immediately after wiring API code to boost_purchases:
-- the SELECT policy re-evaluated auth.uid() per row instead of once per
-- query. Standard fix per Supabase's own RLS performance guidance --
-- wrapping the function call in a subquery lets Postgres evaluate it once
-- and reuse the result, with identical semantics (same rows match).
-- ============================================================================

DROP POLICY IF EXISTS "boost_purchases_select_own" ON boost_purchases;
CREATE POLICY "boost_purchases_select_own" ON boost_purchases
  FOR SELECT USING ((select auth.uid()) = trainer_id);
