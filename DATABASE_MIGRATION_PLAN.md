# Database Migration Plan — Onlifit

*Status: ALL 8 MIGRATIONS APPLIED (2026-07-20) to production project `lnbsgnfrhewdqhuqqotx`, each verified individually after applying. Originally pulled from a live schema query on 2026-07-18, revised 2026-07-20 per user-requested architectural changes, approved, then executed the same day. See "Post-Apply Verification Log" at the end of this document for what was actually checked and the two real issues hit (and fixed) during rollout.*

**Tooling note for whoever picks this up:** this session has real, working access to a Supabase MCP server that can list tables/apply migrations directly against the live project (`project_id: lnbsgnfrhewdqhuqqotx`). If those tools aren't visible yet in a new conversation, they're deferred — search for them (they were surfaced via `ToolSearch` with a query for `apply_migration`, `list_migrations`, `list_tables`, `execute_sql`, `get_project` under a tool-name prefix `mcp__39099f97-d9ca-4498-88a7-bbd65dbea7d4__`).

## Current Production Schema (relevant tables, as of this snapshot)

### `profiles` (15 rows) — the single users/trainers/clients table
Relevant existing columns: `id`, `name`, `email`, `role` (default `'client'`), `phone`, `avatar_url`, `specialty`, `bio`, `location`, `city`, `state`, `address`, `rating`, `review_count`, `experience` (free text, e.g. "5+ years"), `plans` (jsonb), `certifications` (array, **deprecated**, use `certifications` table instead), `tags` (array — the general-purpose free-form taxonomy field used today), `goal`, `age`, `gender`, `kyc_front_url`, `kyc_back_url`, `kyc_verified`, `certificate_urls` (jsonb), `certificates_verified`, `verification_status` (check: `pending`/`approved`/`rejected`), `account_status`, `suspended_at`, `suspended_reason`, `last_login_at`, `total_spent`, `has_black_status`, `training_mode`, `email_verified`, `profile_completion_score`, `last_active_at`, `whatsapp_number`, `subscription_plan` (check: `free`/`pro`/`elite`), `subscription_status` (check: `none`/`active`/`grace_period`/`expired`), `subscription_expires_at`, `onboarding_completed`.

**Does NOT exist** (confirmed by direct column probe, not inference): `session_mode`, `training_approach`, `kyc_id_type`, `kyc_id_number`, `response_time`, `teaching_style`, `training_focus`, `profile_live`, `boost_expires_at`, `services`, `languages`, `target_audience`, `availability`, `response_rate`, `goals`, `training_styles`, `equipment`, `training_modes`, `specializations`, `search_keywords`, `verification_submitted_at`, `verification_verified_at`, `verification_rejected_reason`.

### `subscription_payments` (0 rows) — existing precedent for how payments are modeled
`id`, `trainer_id` (FK), `plan` (check: `pro`/`elite` only — does NOT include `boost`), `razorpay_order_id` (unique), `razorpay_payment_id` (unique), `amount`, `status` (check: `created`/`paid`/`failed`), `created_at`.

### `support_tickets` (0 rows) — already fully built, no migration needed
`id`, `ticket_number` (auto-increment, unique), `user_id` (FK), `subject`, `category` (check: `technical`/`billing`/`feature`/`bug`/`other`), `priority` (check: `low`/`medium`/`high`/`urgent`), `status` (check: `open`/`in_progress`/`resolved`/`closed`), `assigned_to` (FK to profiles, i.e. an admin), `created_at`, `updated_at`, `resolved_at`, `closed_at`.

### `ticket_messages` (0 rows) — already fully built, no migration needed
`id`, `ticket_id` (FK), `sender_id` (FK), `message`, `is_internal` (bool, for admin-only notes), `attachments` (jsonb array), `created_at`.

### `ticket_attachments` (0 rows) — already fully built, no migration needed
`id`, `message_id` (FK), `ticket_id` (FK), `file_url`, `file_name`, `file_type`, `file_size`, `created_at`.

### `blog_posts` (12 rows, real content) — CMS already functional
`id`, `slug` (unique), `title`, `category` (single text field, not multi), `image`, `description`, `content`, `read_time`, `is_published`, `created_by` (FK), `created_at`, `updated_at`.

### Other tables that exist and are relevant context
`bookings` (Razorpay fields already present: `razorpay_order_id`, `razorpay_payment_id`, `payment_status`, `amount_paid`), `payments`, `payment_webhook_logs`, `subscriptions` + `subscription_plans` (a more generic subscription model, separate from the simpler `subscription_plan`/`subscription_status` columns directly on `profiles` — worth understanding which one is actually load-bearing before extending either), `promo_codes` + `promo_code_usage`, `reviews` (0 rows in production), `certifications` (0 rows — the real, non-deprecated table), `client_enquiries`, `notifications` + `user_notifications`, `messages` (6 rows — legacy platform chat, deprecated per code comments in `auth.js`), `profile_visits`, `user_activity_log`, `system_settings`.

---

## Final Decisions (2026-07-20, approved)

1. **`reading_time` (integer) replaces `read_time` (text)** on `blog_posts` — single source of truth. `read_time` is backfilled into `reading_time` then dropped in this migration round, not kept alongside it.
2. **Verification fields are admin-controlled only.** Confirmed by directly reading live RLS policies (not inferred): `profiles` has a permissive "Users can update own profile" policy (`auth.uid() = id`, no column restriction) alongside a separate "Admins can update verification status" policy. With multiple permissive UPDATE policies, Postgres OR's them — meaning a trainer **can currently overwrite their own verification fields** the moment those columns exist, regardless of the admin-only policy also being present. RLS alone cannot express column-level restriction here; Migration 5 below adds a `BEFORE UPDATE` trigger that rejects any change to verification columns unless the acting user is an admin. Status vocabulary expanded to `pending` / `under_review` / `verified` / `rejected` (replacing the existing `pending`/`approved`/`rejected`, so `approved` is renamed to `verified` and a new `under_review` state is inserted).
3. **`goal` → `goals` migration, not just an additive column.** `goals` is backfilled from existing `goal` data and becomes the long-term source of truth. `goal` is kept temporarily (existing code/queries continue to work unchanged) but is now explicitly marked deprecated via a column comment, with removal planned for a later migration once all read/write paths move to `goals`.
4. **`response_time` and `response_rate` stay separate**, per the Migration 9 reasoning below — `response_time` (self-reported) ships now, `response_rate` (computed) is deferred until real enquiry/response instrumentation exists.
5. **`search_keywords` stays a generated column, now with normalization** — lowercased, underscores/whitespace collapsed to single spaces — so `"within_1_hour"` and `"Within 1 Hour"` both search consistently.

## Revision Notes (2026-07-20)

This revision replaces the original Migrations 3–6 (generic `services`/`languages`/`target_audience`/`availability` facets) and expands Migrations 1–2 and 7, per explicit user direction. Nothing below has been applied. Key changes from the original plan, and why:

1. **Structured taxonomy instead of generic tags-adjacent columns** — 8 dedicated `text[]` facet columns instead of 3, so each facet can have its own onboarding UI, filter UI, and vocabulary without overloading a single column's meaning. `tags` is kept, but demoted to backward-compatibility + derived-keyword role rather than a primary taxonomy field.
2. **Richer `availability` shape** — per-day, per-time-of-day granularity plus an explicit `timezone`, instead of a single flat `days`+`times` pair that couldn't express "different hours on different days."
3. **`boost_purchases` expanded for accounting/refunds** — the original 3-status model (`created`/`paid`/`failed`) had no way to represent a refund or record gateway-level failure detail, both of which are normal payment-operations requirements, not speculative scope creep.
4. **Verification lifecycle, not just a status flag** — `verification_status` already exists and is kept; three new timestamp/reason columns turn it into an auditable lifecycle (submitted → approved/rejected, with a reason) instead of a single mutable enum with no history.
5. **`search_keywords` derived column** — a single flattened, generated search-text column so full-text/`ILIKE` search across 8 array facets doesn't require checking 8 columns individually in every query.
6. **Blog metadata expanded** for editorial/SEO needs beyond the original SEO-fields-only scope (Migration 7 renamed accordingly).
7. **`response_time` vs `response_rate` resolved** — see Migration 9 below; decision made, not left open.
8. **RLS specified explicitly** for every new table — SELECT/INSERT/UPDATE/DELETE each called out, no reliance on "no policy = deny" being self-evident from omission.

---

## Proposed Migrations

### Migration 1 — `add_boost_expires_at_to_profiles`
```sql
ALTER TABLE profiles ADD COLUMN boost_expires_at timestamptz;
CREATE INDEX idx_profiles_boost_expires_at
  ON profiles(boost_expires_at)
  WHERE boost_expires_at IS NOT NULL;
```
**Why:** Fast denormalized read for the ranking algorithm — checking `boost_expires_at > now()` for every trainer on every search is far cheaper than joining a `boost_purchases` table on every read. Mirrors the existing `subscription_expires_at` pattern already on `profiles`.
**Already consuming this column:** `compareTrainersForRanking()` / `scoreTrainerForRanking()` in `auth.js` (committed in `2401f0a`) already reads `t.boost_expires_at` defensively — it's `undefined` today (safe, contributes 0 to score) and will activate automatically the moment this column exists, no further ranking code changes needed.
**Pages/code that will need updates once this lands:** `bookings.html` (trainer dashboard — show active boost + remaining time), `trainers.html` (results may visually indicate a boosted trainer, optional), the boost purchase-verification code path (writes this column after payment confirms).
**RLS impact:** none — existing `profiles` RLS already governs this column, no policy change needed for a plain column add.

---

### Migration 2 — `create_boost_purchases_table` (expanded for accounting/refunds)
```sql
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
  payment_status text, -- raw gateway status string, unvalidated, for support/debugging
  failure_reason text,
  refunded_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_boost_purchases_trainer_id ON boost_purchases(trainer_id);

ALTER TABLE boost_purchases ENABLE ROW LEVEL SECURITY;

-- SELECT: a trainer can read only their own boost purchase history
CREATE POLICY "boost_purchases_select_own" ON boost_purchases
  FOR SELECT USING (auth.uid() = trainer_id);

-- INSERT: no client-side inserts. Row creation happens only via the
-- service-role key inside api/create-boost-order.js. No permissive
-- INSERT policy is defined, so RLS denies all client-originated inserts.

-- UPDATE: no client-side updates. Status transitions (created -> paid /
-- failed / refunded) happen only via the service-role key inside
-- api/verify-boost-payment.js and any future refund-handling endpoint.
-- No permissive UPDATE policy is defined, so RLS denies all
-- client-originated updates.

-- DELETE: never deleted by any client or API path (audit trail must be
-- immutable for accounting purposes). No DELETE policy is defined, so
-- RLS denies all client-originated deletes. If historical cleanup is
-- ever needed, it should be a manual, audited operation via the
-- Supabase dashboard, not application code.
```
**Why:** Payment audit trail and source of truth for boost history — mirrors the existing `subscription_payments` table's shape, extended with fields a real accounting/support workflow needs: `gst_amount` (India requires GST line-item visibility on invoices), `invoice_number` (human-facing reference, distinct from internal `id`), `coupon_code` (promo tracking, mirrors the existing `promo_codes`/`promo_code_usage` pattern elsewhere in the schema), `payment_gateway` (future-proofs against adding a second gateway without a schema change to every payment-shaped table), `payment_status` (raw untranslated gateway string, kept alongside the validated `status` enum for support debugging when a gateway sends something unexpected), `refunded_at`/`failure_reason` (so refunds and failures are queryable without parsing free-text support tickets). `profiles.boost_expires_at` is kept in sync from this table (set on verified payment, cleared/left to lapse on expiry, cleared immediately on refund).
**Pages/code affected:** `pricing.html` (the two disabled "Coming Soon" Buy Boost buttons get re-enabled and wired to a real purchase flow), new `api/create-boost-order.js`, new `api/verify-boost-payment.js`, a Razorpay webhook (either extend `api/razorpay-subscription-webhook.js` to branch on payload type, or add `api/razorpay-boost-webhook.js`), `bookings.html` dashboard, and (new, not in original plan) a refund-handling path — no refund UI exists anywhere in the codebase yet, this is schema-only preparation, not a promise that refund UI ships in Phase 2.
**Expiry handling:** unchanged from original plan — compute "is boost active" as `boost_expires_at > now()` at read time everywhere; no cron/background job required for correctness.

---

### Migration 3 — `add_structured_taxonomy_to_profiles` (replaces original Migrations 3–5)
```sql
ALTER TABLE profiles ADD COLUMN goals text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN services text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN training_styles text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN languages text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN target_audience text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN equipment text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN training_modes text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN specializations text[] DEFAULT '{}';

CREATE INDEX idx_profiles_goals ON profiles USING GIN (goals);
CREATE INDEX idx_profiles_services ON profiles USING GIN (services);
CREATE INDEX idx_profiles_training_styles ON profiles USING GIN (training_styles);
CREATE INDEX idx_profiles_languages ON profiles USING GIN (languages);
CREATE INDEX idx_profiles_target_audience ON profiles USING GIN (target_audience);
CREATE INDEX idx_profiles_equipment ON profiles USING GIN (equipment);
CREATE INDEX idx_profiles_training_modes ON profiles USING GIN (training_modes);
CREATE INDEX idx_profiles_specializations ON profiles USING GIN (specializations);

-- Backfill: existing single-value `goal` becomes the first element of `goals`
UPDATE profiles
  SET goals = ARRAY[goal]
  WHERE goal IS NOT NULL AND goal <> '' AND (goals IS NULL OR goals = '{}');

COMMENT ON COLUMN profiles.goal IS
  'DEPRECATED as of 2026-07-20: superseded by goals text[]. Retained temporarily for backward compatibility with existing read/write paths. Plan removal in a later migration once all code reads/writes goals instead.';
```
**Why:** Per revised user direction — each facet is a first-class column with its own vocabulary and UI, rather than folding several distinct concepts into a shared `services`/`tags`-style column. GIN indexes added on every new array column since all are intended to be filtered on (`trainers.html` search), which the original plan's plain columns didn't specify.
**Relationship to existing `goal` (singular) and `tags`:** `goal` (existing, singular text) and the new `goals` (plural, array) are **not the same column** — this migration does not touch or deprecate the existing `goal` column, since doing so would be a breaking change to existing search/filter code that isn't in scope here. Recommend treating `goal` as legacy/primary-goal and `goals` as the full multi-select set once built, and revisiting whether `goal` should be backfilled from `goals[0]` or retired — **flagging this as a decision to make explicitly before Phase 3 UI work, not deciding it here.**
**`tags` role going forward:** kept as-is, untouched by this migration. Per user direction, it becomes backward-compatibility + a landing spot for derived search keywords (see Migration 8, `search_keywords`) rather than a primary taxonomy field. No existing data in `tags` is migrated or cleared by this migration.
**Pages/code that will need updates once this lands:** `trainer-onboarding.html` (8 new checkbox sections, one per facet — same pattern as existing "Training Areas" tags checkboxes), `settings.html` + `bookings.html` settings tab (both duplicated UIs need every field), `trainers.html` (new filters), `onlifit.html` (only if any of these become homepage quick-filter chips — not yet decided, raise before building), `trainer-profile.html` (display), shared trainer-card renderer in `auth.js` (display, optional).
**Open item carried over from original plan, still unresolved:** exact vocabulary (fixed list of allowed values) for all 8 facets must be locked down before onboarding UI is built — not part of this migration, a product/copy decision.

---

### Migration 4 — `add_availability_to_profiles` (expanded shape, replaces original Migration 6)
```sql
ALTER TABLE profiles ADD COLUMN availability jsonb DEFAULT '{
  "timezone": "Asia/Kolkata",
  "days": {
    "monday": [], "tuesday": [], "wednesday": [], "thursday": [],
    "friday": [], "saturday": [], "sunday": []
  }
}'::jsonb;

CREATE INDEX idx_profiles_availability ON profiles USING GIN (availability);
```
**Shape** (per revised user direction — per-day, per-time-of-day, not a flat days+times pair):
```json
{
  "timezone": "Asia/Kolkata",
  "days": {
    "monday": ["morning", "evening"],
    "tuesday": [],
    "wednesday": ["afternoon"],
    "thursday": [],
    "friday": ["morning"],
    "saturday": ["evening"],
    "sunday": []
  }
}
```
**Why:** Real per-day/per-slot scheduling signal without building a full booking calendar. The `timezone` field matters concretely: trainers may offer online sessions to clients outside India, and "morning" is meaningless without a timezone anchor. Fixed vocabulary for the time-of-day buckets: `morning`, `afternoon`, `evening`, `night` (4 values) — **locking this down now** (was an open question in the original plan) to avoid a future data migration on real trainer rows; recommend confirming this exact 4-value set with the user before onboarding UI is built, since changing it later is exactly the costly-migration scenario this plan is trying to avoid.
**Pages/code affected:** `trainer-onboarding.html`, both settings pages, `trainers.html` filter (e.g. "available Saturday evenings"), `trainer-profile.html` display.

---

### Migration 5 — `add_trainer_verification_lifecycle_to_profiles` (admin-controlled, expanded statuses)
```sql
-- Expand the status vocabulary: pending / under_review / verified / rejected
-- (previously pending / approved / rejected — 'approved' is renamed to
-- 'verified' and 'under_review' is a new intermediate state).
ALTER TABLE profiles DROP CONSTRAINT profiles_verification_status_check;
UPDATE profiles SET verification_status = 'verified' WHERE verification_status = 'approved';
ALTER TABLE profiles ADD CONSTRAINT profiles_verification_status_check
  CHECK (verification_status IN ('pending', 'under_review', 'verified', 'rejected'));

ALTER TABLE profiles ADD COLUMN verification_submitted_at timestamptz;
ALTER TABLE profiles ADD COLUMN verification_verified_at timestamptz;
ALTER TABLE profiles ADD COLUMN verification_rejected_reason text;

-- Admin-only enforcement: confirmed by reading live RLS policies that the
-- existing "Users can update own profile" policy (auth.uid() = id, no
-- column restriction) would otherwise let a trainer overwrite their own
-- verification fields directly, regardless of the separate admin policy.
-- RLS policies OR together and cannot express column-level restriction,
-- so this is enforced with a trigger instead.
CREATE OR REPLACE FUNCTION enforce_verification_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
    NEW.verification_submitted_at IS DISTINCT FROM OLD.verification_submitted_at OR
    NEW.verification_verified_at IS DISTINCT FROM OLD.verification_verified_at OR
    NEW.verification_rejected_reason IS DISTINCT FROM OLD.verification_rejected_reason
  ) AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'verification fields can only be modified by an admin';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_verification_admin_only
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_verification_admin_only();
```
**Why:** `verification_status` already existed but was a single mutable enum with no history and, per the live RLS read above, was writable by the trainer themself. Per explicit decision, this migration (a) admin-controls every verification field via a trigger rather than relying on RLS policy layering, and (b) expands the vocabulary to `pending`/`under_review`/`verified`/`rejected` so there's a distinct "admin is actively reviewing" state between submission and a final verdict.
**Consequence of admin-only enforcement:** trainers can no longer self-transition into `under_review` by submitting for review directly — that write now has to go through an admin-facing or service-role code path (e.g. a trainer clicking "Submit for review" calls an API endpoint that uses the service-role key to set `verification_status = 'under_review'` and `verification_submitted_at = now()`, rather than the client writing those columns directly). This is a deliberate consequence of "admin-controlled only," not an oversight — flagging so the submission-flow code isn't built assuming a direct client write will work.
**Not in scope here:** building the actual admin review UI — this migration only adds the columns/trigger; the admin-side approve/reject UI is a follow-up code task.
**Pages/code affected:** `admin-dashboard.html` (approve/reject UI, now also needs an "under review" state and must run as admin, which the trigger already permits since admins pass the `role = 'admin'` check), the trainer-facing submission entry point (needs to move to a server-side/service-role write, see above).
**RLS impact:** covered above — this is the one migration in this plan where "governed by existing RLS" was explicitly insufficient and required a trigger instead.

---

### Migration 6 — `create_boost_purchases_table`
*(merged into Migration 2 above — see there for the full table definition and RLS. Kept as a numbered placeholder removed to avoid renumbering confusion with the roadmap doc; Migration 2 is the authoritative definition.)*

---

### Migration 7 — `add_blog_metadata` (expanded, replaces original Migration 7)
```sql
ALTER TABLE blog_posts ADD COLUMN meta_title text;
ALTER TABLE blog_posts ADD COLUMN meta_description text;
ALTER TABLE blog_posts ADD COLUMN related_trainer_ids uuid[] DEFAULT '{}';
ALTER TABLE blog_posts ADD COLUMN featured boolean NOT NULL DEFAULT false;
ALTER TABLE blog_posts ADD COLUMN excerpt text;
ALTER TABLE blog_posts ADD COLUMN reading_time integer;
ALTER TABLE blog_posts ADD COLUMN author_name text;
ALTER TABLE blog_posts ADD COLUMN canonical_url text;

-- reading_time (integer) replaces read_time (free text) as the single
-- source of truth. Backfill by extracting the leading integer from the
-- existing free-text values (e.g. "5 min read" -> 5), then drop read_time.
UPDATE blog_posts
  SET reading_time = NULLIF(substring(read_time from '^\d+'), '')::integer
  WHERE read_time ~ '^\d+';

ALTER TABLE blog_posts DROP COLUMN read_time;

CREATE INDEX idx_blog_posts_featured ON blog_posts(featured) WHERE featured = true;
```
**Why:** Original scope (SEO fields + related-trainer linking) kept, expanded with editorial/SEO fields the user requested: `featured` (homepage/blog-index "pinned post" flag), `excerpt` (short teaser text distinct from the existing full `description`), `reading_time` (integer minutes, **now the sole source of truth per explicit decision** — `read_time`'s free-text values are backfilled into it and the old column is dropped in this same migration, not kept alongside it), `author_name` (byline — currently only `created_by`, a FK to an internal admin `profiles.id`, exists; a public-facing byline string is a distinct concern, e.g. a guest author with no platform account), `canonical_url` (SEO — for any post that's a cross-post or has a canonical source elsewhere).
**Display-string consequence:** any code currently rendering `read_time` directly (e.g. "5 min read" badges) needs to change to format `reading_time` client-side (e.g. `` `${reading_time} min read` ``) — this migration handles the data, not the display code; flagging as a follow-up UI change in `blog-post.html`/blog index cards.
**Note on `category`:** still a single text field, not multi-category, unchanged from original plan — the request didn't ask for multi-category.
**Pages/code affected:** `admin-dashboard.html` blog CMS form (add 7 new fields, remove the old `read_time` input in favor of a `reading_time` number input), `blog-post.html` and any blog index/card component (render `<meta>` tags, related-trainer cards, excerpt in previews, featured-post highlighting, byline, canonical link tag, and the reformatted reading-time display).
**RLS impact:** none — existing `blog_posts` RLS already governs these columns.

---

### Migration 8 — `add_search_keywords_to_profiles` (normalized) — APPLIED, with one real fix during rollout
```sql
CREATE OR REPLACE FUNCTION immutable_array_to_string(text[], text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT array_to_string($1, $2) $$;

ALTER TABLE profiles ADD COLUMN search_keywords text
  GENERATED ALWAYS AS (
    regexp_replace(
      trim(
        lower(
          immutable_array_to_string(
            COALESCE(goals, '{}') ||
            COALESCE(services, '{}') ||
            COALESCE(languages, '{}') ||
            COALESCE(equipment, '{}') ||
            COALESCE(training_styles, '{}') ||
            COALESCE(specializations, '{}') ||
            COALESCE(target_audience, '{}') ||
            COALESCE(training_modes, '{}'),
            ' '
          )
        )
      ),
      '[_\s]+', ' ', 'g'
    )
  ) STORED;

CREATE INDEX idx_profiles_search_keywords ON profiles USING GIN (to_tsvector('english', search_keywords));
```
**Why:** A single flattened, **database-generated** (not application-written) text column derived from all 8 new taxonomy facets, so full-text search doesn't require checking 8 array columns individually in every query. Using a Postgres `GENERATED ALWAYS ... STORED` column (not a trigger, not application code) guarantees it can never drift out of sync with the source columns and, per the user's explicit requirement, **cannot be edited directly** — any attempt to `UPDATE profiles SET search_keywords = ...` is rejected by Postgres itself, not just by application-level convention.
**Normalization, per explicit decision:** the expression lowercases everything and collapses underscores and repeated whitespace into single spaces, so a snake_case facet value like `within_1_hour` and a differently-cased/spaced equivalent both search consistently. Verified live: `services = ARRAY['Group_Classes','1-on-1 Coaching']` produced `search_keywords = 'group classes 1-on-1 coaching'`.
**Real issue hit during rollout:** the first attempt used the built-in `array_to_string()` directly and Postgres rejected the migration with `generation expression is not immutable` — `array_to_string` is marked `STABLE`, not `IMMUTABLE`, in `pg_proc` (confirmed by querying `provolatile` directly), even though its behavior is deterministic for `text[]` with a fixed separator. Generated columns require every function in the expression to be `IMMUTABLE`. Fixed with a one-line `IMMUTABLE` SQL wrapper function (`immutable_array_to_string`) around the same call — a standard, safe workaround since the underlying operation genuinely is deterministic for this use case, just conservatively labeled.
**Hard dependency:** this migration must run **after** Migration 3 (the 8 source columns must exist first) — sequencing constraint, not independent of taxonomy the way Boost/blog are independent of each other.
**Does not include `tags`:** the user's requested source list is exactly the 8 new facet columns; the existing free-form `tags` column is deliberately excluded from the generated expression since it's being demoted to a legacy/manual field, not part of the structured facets. If full-text search should also cover legacy `tags` data, that's a scope change to raise separately, not assumed here.
**Pages/code affected:** none required — this is a passive search-optimization column. `trainers.html` search backend query can optionally switch to querying `to_tsvector(search_keywords)` instead of checking 8 array columns with `&&`, as a performance improvement, but the existing array-column query approach continues to work unchanged (this migration is additive and non-breaking either way).

---

### Migration 9 — `response_time` vs `response_rate` — resolution
**Decision: both are needed, but they are not the same concept, and only one requires a schema change now.**
- **`response_rate`** — a **computed, behavioral** metric (e.g. "responds to 92% of inbound enquiries," expressed 0–1 or 0–100) already referenced defensively by `compareTrainersForRanking()` in `auth.js` as a dormant ranking input. This is data the platform would derive from real enquiry/response activity (e.g. `client_enquiries` timestamps vs. trainer reply timestamps) — **no column exists to store it, and no instrumentation exists yet to compute it.** Out of scope for this migration round: computing it requires deciding what "a response" means operationally (a WhatsApp click-through? a platform message? there's no in-app messaging per the business model in `PROJECT_HANDOFF.md` §1) before any column is meaningful. **Recommend deferring the `response_rate` column until that instrumentation question is answered** — adding an empty, never-populated column now would just recreate the exact "dormant column with no writer" pattern already flagged as debt elsewhere (`profile_live`, etc.).
- **`response_time`** — one of the 7 pre-existing "orphaned onboarding fields" (`PROJECT_HANDOFF.md` §18): a **self-reported expectation** a trainer sets at onboarding (e.g. "usually responds within an hour / same day / 24 hours"), meant for display on the trainer's profile as a trust signal, not a computed metric. This is a legitimate, distinct concept from `response_rate` and **should be added as a real column** rather than removed, since it's a reasonable onboarding field that was simply never given a backing column:
```sql
ALTER TABLE profiles ADD COLUMN response_time text
  CHECK (response_time IN ('within_1_hour', 'within_a_day', 'within_2_days', 'varies'));
```
**Net effect:** `response_time` gets a real column in this migration round (fixes one of the 7 orphaned-field bugs, in scope since it was explicitly raised in this conversation). `response_rate` does **not** get a column yet — it stays a defensive-read no-op in the ranking algorithm until enquiry-response instrumentation is designed, which is a separate, larger scoping conversation (not a database migration). This resolves the ambiguity without conflating a self-reported UI field with an unbuilt analytics feature.
**Pages/code affected:** `trainer-onboarding.html` (the `response_time` payload key already exists in the form per the original orphaned-fields finding — this migration just needs the matching column to exist so the existing schema-fallback retry loop stops silently dropping it), `trainer-profile.html` (display as a trust badge, optional), settings pages (edit after onboarding).

---

## RLS Summary — every new/changed object, explicit per-operation

| Object | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles.boost_expires_at` (Migration 1) | governed by existing `profiles` RLS | governed by existing `profiles` RLS | governed by existing `profiles` RLS | governed by existing `profiles` RLS |
| `boost_purchases` (Migration 2) | own row only (`auth.uid() = trainer_id`) | **denied to all clients** — service-role only, via API | **denied to all clients** — service-role only, via API | **denied to all clients** — no path, ever |
| `profiles.{goals,services,training_styles,languages,target_audience,equipment,training_modes,specializations}` (Migration 3) | governed by existing `profiles` RLS | governed by existing `profiles` RLS | governed by existing `profiles` RLS | governed by existing `profiles` RLS |
| `profiles.availability` (Migration 4) | governed by existing `profiles` RLS | governed by existing `profiles` RLS | governed by existing `profiles` RLS | governed by existing `profiles` RLS |
| `profiles.{verification_status,verification_submitted_at,verification_verified_at,verification_rejected_reason}` (Migration 5) | governed by existing `profiles` RLS (public read) | governed by existing `profiles` RLS | **admin-only, enforced by `trg_enforce_verification_admin_only` trigger** — confirmed via live policy read that RLS alone (`Users can update own profile`, no column restriction, ORs with the admin policy) would otherwise allow a trainer to overwrite these columns on their own row; the trigger closes that gap at the database level regardless of which RLS policy matched. | governed by existing `profiles` RLS |
| `blog_posts.{meta_title,meta_description,related_trainer_ids,featured,excerpt,reading_time,author_name,canonical_url}` (Migration 7) | governed by existing `blog_posts` RLS | governed by existing `blog_posts` RLS | governed by existing `blog_posts` RLS | governed by existing `blog_posts` RLS |
| `profiles.search_keywords` (Migration 8) | governed by existing `profiles` RLS | N/A — generated column, cannot be inserted directly | N/A — generated column, Postgres rejects direct writes | governed by existing `profiles` RLS |
| `profiles.response_time` (Migration 9) | governed by existing `profiles` RLS | governed by existing `profiles` RLS | governed by existing `profiles` RLS | governed by existing `profiles` RLS |

**Important caveat surfaced by this exercise:** "governed by existing `profiles` RLS" is stated confidently throughout this plan, but per `PROJECT_HANDOFF.md` §16/§20, **the actual `profiles` RLS policies have never been empirically read from the Supabase dashboard this arc** — every claim about them is inferred from code behavior (writes appear scoped to the authenticated user's own id), not confirmed by reading the policy definitions directly. The `verification_*` gap flagged above is a concrete example of why this matters: if `profiles` RLS currently allows a user to update *any* column on their own row, that's a real privilege issue for admin-only fields the moment Migration 5 lands, not a hypothetical one. **Recommend pulling actual RLS policy definitions via the Supabase MCP tools (they can be read, not just inferred) before Phase 1 executes**, to confirm this table-by-table rather than continuing to state it as an assumption.

---

## Explicitly NOT proposed

- **No migration for the support ticket system.** `support_tickets` + `ticket_messages` + `ticket_attachments` already fully support everything requested (create, thread, attach, assign to admin, status lifecycle). The only missing pieces are UI (floating widget, admin reply screen) and, if/when approved, an AI integration — neither needs a schema change.
- **No migration for Training Mode or Location filters** — already have real backing columns (`training_mode`, `location`/`city`/`state`). (Goals and Specializations are now covered by Migration 3's `goals`/`specializations` columns, superseding the original plan's reliance on `tags`/`goal`.)
- **No migration for the remaining 6 orphaned onboarding fields** (`training_approach`, `kyc_id_type`, `kyc_id_number`, `teaching_style`, `training_focus`, `profile_live`) — `response_time`, the 7th, is resolved in Migration 9 above; the other 6 remain a separate, pre-existing problem (see `PROJECT_HANDOFF.md` §18) needing their own decision (add columns vs. remove form fields) before a migration is written.
- **No `response_rate` column** — see Migration 9's reasoning; deferred pending an instrumentation design decision, not forgotten.
- **No AI-related schema** — deferred per explicit prior user decision.
- **No admin-only column-level enforcement migration yet** for the `verification_*` gap — flagged in the RLS Summary above as needing a decision (trigger vs. application-layer check vs. confirming existing RLS already handles it) before Migration 5 ships, not resolved unilaterally here.

## Sequencing Recommendation

- **Migration 8 depends on Migration 3** (generated column needs its 8 source columns to exist first) — these two must be applied together or 3-then-8, never 8 alone.
- Migrations 1–2 (Boost) are independent of 3+8 (taxonomy+search index), 4 (availability), 5 (verification lifecycle), 7 (blog), and 9 (`response_time`).
- Migration 9 (`response_time`) is independent of everything and trivial (single column, single check constraint) — could be applied first as a quick win that also closes out one of the 7 orphaned-field bugs.
- Before Migration 5 ships: resolve the admin-only write gap flagged in the RLS Summary.
- Before Migration 7 ships: resolve the `read_time`/`reading_time` conflict flagged in that migration's section.
- Before Phase 1 executes at all: pull actual `profiles`/`blog_posts` RLS policy definitions via Supabase MCP tools to confirm (not infer) the blanket "governed by existing RLS" claims throughout this document.

Suggest applying in the order the user wants to build in (see `IMPLEMENTATION_ROADMAP.md`), rather than all at once, so each feature's migration lands right before the code that depends on it.

---

## Post-Apply Verification Log (2026-07-20)

All 8 migrations applied in this order: 1, 2, 3, 4, 5, 9, 7, 8 (9 and 7 moved ahead of 8 since 8 has a hard dependency on 3's columns; sequencing otherwise as recommended above). Each was verified immediately after applying, before proceeding to the next — no migration was applied without confirming the previous one landed correctly.

| # | Migration | Verified by | Result |
|---|---|---|---|
| 1 | `add_boost_expires_at_to_profiles` | `information_schema.columns` | Column exists, `timestamptz` |
| 2 | `create_boost_purchases_table` | `pg_class.relrowsecurity`, `pg_policies` | Table exists, RLS enabled, only `boost_purchases_select_own` (SELECT) present — INSERT/UPDATE/DELETE correctly deny-by-default with no policy |
| 3 | `add_structured_taxonomy_to_profiles` | `information_schema.columns`, backfill count query | All 8 columns exist; both existing rows with a `goal` value were correctly backfilled into `goals` |
| 4 | `add_availability_to_profiles` | `information_schema.columns` | Column exists, `jsonb`, default shape confirmed |
| 5 | `add_trainer_verification_lifecycle_to_profiles` | `pg_get_constraintdef`, `information_schema.columns`, `pg_trigger` | Constraint now allows `pending`/`under_review`/`verified`/`rejected`; all 3 lifecycle columns exist; trigger `trg_enforce_verification_admin_only` present and enabled (`tgenabled = 'O'`) |
| 9 | `add_response_time_to_profiles` | `information_schema.columns` | Column exists, `text` |
| 7 | `add_blog_metadata` | `information_schema.columns`, live row query | `read_time` dropped, 8 new columns exist, all 12 existing posts backfilled into `reading_time` with no NULLs |
| 8 | `add_search_keywords_to_profiles` | live write + read (test value inserted then reverted) | `services = ARRAY['Group_Classes','1-on-1 Coaching']` produced `search_keywords = 'group classes 1-on-1 coaching'` — normalization confirmed, test write reverted immediately after |

**One migration failure, caught and fixed before proceeding (per instruction to stop on failure, not push through blindly):** Migration 8's first attempt used the built-in `array_to_string()` inside the generated-column expression and Postgres rejected it — `ERROR: 42P17: generation expression is not immutable`. Root cause confirmed by querying `pg_proc.provolatile` directly: `array_to_string` is marked `STABLE`, not `IMMUTABLE`, even though it's deterministic for this use case. Fixed with a one-line `IMMUTABLE`-declared SQL wrapper function (`immutable_array_to_string`), a standard workaround, then reapplied successfully.

**Post-apply security scan (`get_advisors`, type `security`):** run against the full project after all 8 migrations. Two findings were caused by this session's own migrations and fixed immediately:
- `enforce_verification_admin_only` (the Migration 5 trigger function) was flagged as a `SECURITY DEFINER` function directly callable via PostgREST RPC by `anon`/`authenticated` — it's trigger-only and was never meant to be invoked directly. Fixed: `REVOKE EXECUTE ... FROM public, anon, authenticated`, confirmed via `has_function_privilege('anon', ..., 'execute') = false`.
- `immutable_array_to_string` (the Migration 8 helper) was flagged for a mutable `search_path`. Fixed: `ALTER FUNCTION ... SET search_path = public`.

All other findings from the same scan (several pre-existing `rls_enabled_no_policy` tables, several pre-existing `SECURITY DEFINER` functions unrelated to this session, `auth_leaked_password_protection` disabled, public-bucket listing warnings on `avatars`/`blog-images`/`trainer_certifications`) **predate this session's changes and were not touched** — flagging them here for visibility since they surfaced during this scan, but they're pre-existing platform debt, not something introduced by tonight's migrations, and fixing them wasn't requested.
