# Release Notes — Onlifit RC1

*Release Candidate 1, staged for deployment 2026-07-21. This is the first release covering the Boost payment system, alongside the pre-existing subscription/marketplace platform.*

## Features Included

**Marketplace core (pre-existing, carried into this release):**
- Trainer/client marketplace with search, filtering, goal-based discovery, WhatsApp-based contact (no in-app messaging by design).
- Trainer onboarding, profile management, KYC/certificate upload and admin verification workflow.
- Subscription payments (Free/Pro/Elite tiers) via Razorpay.
- Blog CMS with SEO fields, related-trainer linking, admin CRUD.
- Support ticket system (creation, threading, admin reply — no AI assistant in this release, by explicit decision).
- Admin dashboard: trainer management, blog CMS, analytics (revenue, users, bookings, trainer performance).

**New in RC1 — Boost payment system:**
- Trainers can purchase temporary search-ranking visibility (3-day / 7-day) via Razorpay.
- Ranking is a **weighted score, not a tier ladder**: quality signals (rating, reviews, profile completeness, recent activity, experience) cap at 71 of ~100 possible points; paid signals (verification, Boost, subscription tier) cap at 26; a small dormant "response rate" bucket caps at 3. A trainer with strong quality metrics always outranks a boosted-but-low-quality trainer — paid features move rank among peers of similar quality, they never override it.
- Purchasing Boost while one is already active **extends** the existing expiry rather than replacing or wastefully restarting it.
- Expired Boosts stop affecting ranking automatically — no cleanup job, ranking reads `boost_expires_at > now()` live on every query.
- Trainer-facing purchase history with a print-to-PDF invoice view.
- Admin-facing Boost analytics (revenue, active count, failures, expired count).
- Structured trainer taxonomy schema (`goals`, `services`, `training_styles`, `languages`, `target_audience`, `equipment`, `training_modes`, `specializations`, `availability`) — **schema only, no UI built yet**, see Future Roadmap.
- Trainer verification lifecycle (`pending` → `under_review` → `verified`/`rejected`, admin-only writes enforced by a database trigger, not just RLS).

## Major Architectural Decisions

1. **One shared Razorpay webhook endpoint** handles both subscription and Boost payments (`api/razorpay-subscription-webhook.js`), routing by looking the order id up directly in `boost_purchases`/`subscription_payments` — not by trusting Razorpay's `notes.type` tag, since Razorpay doesn't guarantee order notes propagate onto the payment entity a webhook delivers. `notes.type` is still set at order creation for dashboard-level observability.
2. **No cron/background jobs anywhere in this product.** Subscription grace periods, Boost expiry, and everything time-based is computed at read time (`expires_at > now()`) rather than requiring a scheduled cleanup process. This was a deliberate simplicity choice, not an oversight.
3. **Refunds are a manual admin action, not automated.** `activate_boost_purchase()` does not recompute `boost_expires_at` when a purchase is refunded — see Known Limitations.
4. **Static frontend, no build step.** Every page is a standalone `.html` file with vanilla JS; `auth.js` is the shared client library (auth, trainer queries, ranking, badge rendering). No React/Vue/bundler.
5. **Single Supabase project, no environment separation in code.** `supabase-client.js` hardcodes the project URL/anon key. Staging and production currently point at the same database unless a second project is provisioned — see `DEPLOYMENT_GUIDE.md`.

## Database Changes

19 migrations applied this arc (see `MIGRATION_HISTORY.md` for the full chronological reconciliation with production). Summary of what's new since the last stable baseline:
- `profiles`: `boost_expires_at`, 8 taxonomy array columns, `availability` (jsonb), verification lifecycle timestamps (`verification_submitted_at`/`verified_at`/`rejected_reason`), `response_time`, a generated `search_keywords` column, expanded `verification_status` vocabulary (`pending`/`under_review`/`verified`/`rejected`, replacing `pending`/`approved`/`rejected`).
- New table: `boost_purchases` (payment audit trail, mirrors `subscription_payments`' shape, extended with GST/coupon/invoice/refund fields).
- `blog_posts`: `read_time` (free text) replaced by `reading_time` (integer) as sole source of truth, plus `meta_title`/`meta_description`/`related_trainer_ids`/`featured`/`excerpt`/`author_name`/`canonical_url`.
- New database function `activate_boost_purchase()` (idempotent, row-locked, extends expiry from the later of current expiry or now — prevents both duplicate-activation and duration-stacking bugs).
- New trigger `trg_enforce_verification_admin_only` — closes a real gap where RLS alone would have let a trainer edit their own verification fields.

## Breaking Changes

- **`verification_status = 'approved'` no longer exists** — renamed to `'verified'` (existing rows migrated automatically). Any external tooling, reports, or saved queries referencing `'approved'` will silently match nothing and must be updated to `'verified'`.
- **`blog_posts.read_time` column no longer exists** — replaced by `reading_time` (integer minutes). Any external tooling reading `read_time` directly will break.
- **`profiles.goal` (singular) is deprecated but not removed.** `goals` (array) is now the long-term source of truth, backfilled from `goal` at migration time. `goal` still works for existing code paths but should not be used for new work.

## Known Limitations

- **Refunds are manual-only.** No self-serve refund UI exists. An admin must directly update `boost_purchases.status = 'refunded'` and manually decide whether `profiles.boost_expires_at` needs correction — the system does not automatically recompute expiry from remaining valid purchases. Not built due to zero refund volume to date; revisit if that changes.
- **No visible "Boosted" badge on trainer cards in search results.** Boost affects ranking position but nothing on the card itself currently signals *why* a trainer ranks where they do, to either the searching client or the paying trainer (beyond their own dashboard). Flagged as a product gap, not a defect.
- **`RAZORPAY_WEBHOOK_SECRET` is not documented in `.env.example`** and must be set manually in the deployment environment — see `DEPLOYMENT_GUIDE.md`.
- **7 orphaned onboarding form fields** predate this release and remain unresolved: `training_approach`, `kyc_id_type`, `kyc_id_number`, `teaching_style`, `training_focus`, `profile_live` write to columns that don't exist and are silently dropped by a schema-fallback retry loop (the 7th, `response_time`, was fixed this arc). Needs a product decision (add columns vs. remove form fields), not scoped into this release.
- **No authenticated end-to-end human walkthrough has been performed** by this assistant at any point in this arc — no test credentials were available, and account creation is outside what this assistant does unilaterally. Every verification claim in this document and its predecessors was either code-level, live-database-level, or a single anonymous-path browser check. The `SMOKE_TEST_CHECKLIST.md` items marked as trainer/admin flows have **not actually been run** — they are the checklist for the first human to do so.
- **Full 10-breakpoint responsive QA** has only been done for `pricing.html`, `onlifit.html`, `trainers.html`, and `trainer-profile.html` in earlier sessions. `bookings.html`'s new Boost card and `admin-dashboard.html`'s new analytics section follow established responsive class conventions but were not visually verified at every breakpoint.
- **RLS policies have been read directly from the database this arc** (not just inferred from code, as in earlier sessions) for `profiles`, `blog_posts`, and `boost_purchases` specifically. Other tables' RLS has not been re-audited this arc.

## Future Roadmap

From `IMPLEMENTATION_ROADMAP.md`, not yet started:
- **Phase 3 — Search taxonomy sync**: UI for the 8 taxonomy columns already in the schema (onboarding checkboxes, settings edit, `trainers.html` filters, profile display). Schema exists, no application code uses it yet.
- **Phase 4 — Support ticket floating widget**: currently a standalone form page (`support.html`); no site-wide launcher, no admin reply UI built yet (ticket creation and threading tables exist and work).
- **Phase 5 — Blog CMS admin UI for the SEO/related-trainer fields**: columns exist (`meta_title` etc.), admin form doesn't expose them yet.
- **Phase 6 — Deferred polish**: homepage "How Onlifit Works" animation, expanded testimonials, Join Us page cleanup, full breakpoint sweep, the 6 remaining orphaned onboarding fields, a sitewide dead-CSS finding (`hover:scale-105`/`hover:translate-y-[-8px]` utilities with no compiled rules backing them).
