# Project Handoff — Onlifit
*Last updated: after a follow-on session that implemented the financial/business-model change flagged as pending in §0 item 4 below — three new revenue phases (trainer free trial, client ₹499/month subscription, gym hiring posts ₹1,999/₹2,999/₹3,999), plus several live-bug fixes found via a full feature audit. Full detail in §23. Everything below §23 is preserved from the prior session's handoff and is now historical context, not current state — §0 items 3 and 4 in particular are superseded, see §23 for what actually shipped. This file supersedes all prior handoff notes. Read this file, `DATABASE_MIGRATION_PLAN.md`, `MIGRATION_HISTORY.md`, `IMPLEMENTATION_ROADMAP.md` and the deployment docs listed in §12 before doing anything else.*

## 0. Read This First — Next Session Starting Point

**0. UNCOMMITTED WORK EXISTS — do not push without asking.** As of this handoff, `git status` shows real, tested, working changes not yet committed (full list in §2) plus one new untracked migration file **already applied to the live production Supabase project** (schema and code are in sync; only the git commit is missing). The user has explicitly said *"will push this later"* / *"push this later"* more than once this session — treat that as a standing hold. **Do not `git push` next session until the user explicitly says so again.** Committing locally is fine; pushing is not, until asked.

**1. THE `/trainer/*` `/client/*` ROUTING BUG IS PARTIALLY MITIGATED, NOT FIXED.** Prior sessions found that every `/trainer/:path*` and `/client/:path*` sub-path returns a Vercel platform-level `404` in production (full investigation history preserved below, was §0/§17 in the prior handoff). **Root cause was never found** — it needs Vercel dashboard/API access this environment has never had, in any session. This session did NOT get that access and did NOT fix the underlying Vercel config. **What this session did instead:** both dashboards' internal `DashboardRouter` (in `bookings.html` and `client-dashboard.html`) were rewritten to navigate via **URL hash** (`bookings.html#leads`, `client-dashboard.html#billing`) instead of generating `/trainer/leads`-style paths — since a hash never leaves the browser, this makes all *internal* navigation and **page refreshes while already on the dashboard** immune to the Vercel bug entirely (live-tested this session with a real `location.reload()`, confirmed working both before and after refresh, zero console errors). **What is still broken:** a **cold external link** straight to `onlifit.in/trainer/leads` (e.g. from an old bookmark, a shared link, an email) will still 404, because that's a fresh server request Vercel rejects before any of this app's JS ever runs. Two real, in-repo links were also found and fixed pointing at the wrong file (`terms.html`/`privacy.html`'s "Trainer Dashboard" footer link was pointing at `trainer.html`, the wrong page — fixed to point at `bookings.html`). **Next session, if you want this fully fixed:** get into the Vercel dashboard yourself (this assistant has never had access, in any session) and check what §17e (below) already isolated: which project the domain is attached to, that project's Root Directory setting, and whether a legacy dashboard-configured rewrite predates `vercel.json`.

**2. "0 TRAINERS FOUND" / SLOW-QUERY BUG — FOUND AND FIXED.** This was open since an early session (previously the #2 item in this section). Root cause, finally confirmed: the marketplace discoverability query (`role='trainer' AND onboarding_completed=true AND verification_status='verified' AND account_status='active' AND subscription_expires_at > now()`, run on every homepage/search/trainers.html load) had **zero index coverage** on any of those columns — every load was a full sequential scan of the entire `profiles` table (clients and trainers together). Combined with an **unbounded** query (no `.limit()`) and a 6-second client-side timeout that silently returns an empty cached list on timeout, this produced exactly the observed symptom. **Fixed:** added a partial index `idx_profiles_trainer_discoverability` (migration `supabase/migrations/20260729090000_add_trainer_discoverability_index.sql`, **already applied to the live production Supabase project**, confirmed via `EXPLAIN`/`list_migrations`) covering exactly the rows this query needs, plus a `.limit(200)` bound baked into the shared `applyDiscoverabilityFilter()` helper in `auth.js` and every raw fallback query that duplicates it. This is genuinely fixed at the database level, not a workaround — re-verify once more with real production traffic/row counts if the trainer base grows well past ~200, at which point `.limit(200)` should become real cursor/offset pagination instead of a raised number (comment left in the code to this effect).

**3. THE MARKETPLACE'S VERIFICATION MODEL WAS REDESIGNED THIS SESSION — read §18 before touching anything discoverability/verification-related.** Onlifit is now explicitly a *verified* trainer marketplace: a trainer is only discoverable if admin-verified (`verification_status='verified'`), not just paid. This replaced an earlier, looser model where payment alone made a trainer visible. Full detail in §18 — this is a foundational business-logic change, not a small tweak, and interacts with almost everything else in this document (payments, onboarding, admin dashboard, search).

**4. RESOLVED — the financial/business-model change flagged here has been built.** See §23 for the full writeup: trainer free trial (90 days, 5 leads/month cap), client ₹499/month subscription (WhatsApp gating), and a gym hiring-post system (₹1,999/₹2,999/₹3,999 one-time, 30-day listings). **§23 also has the exact commit command and current uncommitted-file list — read it before touching git.**

**Carried forward, unresolved, lower priority than the above:** the orphaned `trainer.html` file still exists and still shadows the bare `/trainer` and `/trainer/` paths via `cleanUrls` (unrelated to item 1's sub-path bug, never fixed, see original investigation preserved at the bottom of this section in §17e).

## 1. Project Overview

**What Onlifit is:** A two-sided marketplace connecting clients with independent personal trainers across India, online or in-person. Trainers set their own rates; clients discover trainers by search/goal/location and contact them directly on WhatsApp (no in-app messaging). Revenue comes from trainer subscriptions (Pro/Elite via Razorpay) and, as of this session, one-time "Boost" visibility purchases — **not** per-booking commission.

**Design philosophy:** Minimal, high-contrast black/white/gray palette (M3-inspired token names), Poppins headlines + Inter body, restrained "premium SaaS" aesthetic. Homepage V3 (`onlifit.html`) is the design-system reference for the whole site.

**Current phase:** Feature-complete for launch on the core marketplace + Boost + payment-gated onboarding. Just pushed a Release Candidate through a full audit → blocker fixes → deployment → smoke test → UX polish cycle. Not yet confirmed fully live/verified end-to-end in production — see §0.

## 2. Git Status (as of this handoff)

- **Branch:** `main`
- **Remote:** `origin` → `https://github.com/onlifitapp-lab/onlifitsite.git`
- **Push status (historical):** commits through `50c65e9` were the state as of the previous handoff. **Many more commits have landed on `origin/main` since** across the marketplace-verification redesign, UI passes, and bugfixes this session (`3934f87`, `964fff7`, `4b8f83f`, `a1e61e5` among them — see §18–§21 for what each covered). Run `git log --oneline -15` next session to get the exact current chain; this file intentionally doesn't re-list every hash from every phase to avoid drift.
- **Working tree as of THIS handoff — real, tested, deliberately uncommitted (§0 item 0 — do not push without asking):**
  - Modified: `auth.js`, `bookings.html`, `client-dashboard.html`, `my-trainers.html`, `privacy.html`, `settings.html`, `terms.html`, `trainer-profile.html`, `trainer.html`, `trainers.html` — this is the "0 trainers found" fix + the hash-based dashboard routing fix + the wrong-link fix (§0 items 1–2, detailed in §21).
  - Untracked: `supabase/migrations/20260729090000_add_trainer_discoverability_index.sql` — **already applied to production** via Supabase MCP (confirmed live in `list_migrations`); only the git commit recording it is missing. Safe/idempotent to commit and push whenever the user gives the go-ahead — it will be a no-op against production (`CREATE INDEX IF NOT EXISTS`) and is only "new" from git's perspective.
  - Also perpetually modified: `PROJECT_HANDOFF.md` itself (this file) — has carried uncommitted edits across multiple recent sessions per the prior handoff's own notes; same hold applies.

## 3. Latest Commit Hashes, Chronological (oldest → newest, this session)

Session started right after `2401f0a` (last commit in the previous handoff).

| Hash | Summary |
|---|---|
| `a3047b5` | fix: post-migration regressions from Phase 1 schema changes (verification_status rename, blog read_time→reading_time fallout) |
| `7310114` | docs(db): synchronize repository migration history with production (11 missing migration files recreated) |
| `dabc287` | docs: update project handoff, migration plan, and implementation roadmap |
| `4b76546` | feat(boost): backend order creation, verification, and activation |
| `91346a8` | feat(boost): branch shared Razorpay webhook between Boost and subscriptions |
| `1c93ac9` | feat(boost): enable Boost purchase flow on pricing.html |
| `2035967` | feat(boost): trainer dashboard Boost card, history, and invoice view |
| `d1cf9e1` | feat(boost): admin Boost analytics (revenue, active, failures, expiries) |
| `1318864` | chore(boost): QA pass — RLS perf fix, regression sweep, docs |
| `ea9637e` | fix(ranking): include boost_expires_at and subscription_plan in trainer search selects (**RC BLOCKER fix**) |
| `8131191` | fix(admin): render KYC documents via signed URLs instead of broken public URLs |
| `9c4dd84` | fix(admin): render trainer certificates via signed URLs (same defect as KYC) |
| `5ace2e9` | fix(ux): RC1 UX patch — search field, training area grid, nav buttons, pricing, WhatsApp field |
| `43d0c27` | feat(onboarding): payment-gated trainer flow for new registrations only |
| `50c65e9` | fix(ux): dashboard settings radio cards, bookings page polish, testimonial dots — **current HEAD** |

## 4. Completed Work This Session

### 4a. Boost payment system — fully built (`4b76546` → `1318864`)
- **Schema** (migrations, all applied to production, see `MIGRATION_HISTORY.md`): `profiles.boost_expires_at`, `boost_purchases` table (payment audit trail with GST/coupon/invoice/refund fields), 8 structured taxonomy columns (`goals`, `services`, `training_styles`, `languages`, `target_audience`, `equipment`, `training_modes`, `specializations` — schema only, **no UI built for these yet**), `availability` jsonb, trainer verification lifecycle (`pending`/`under_review`/`verified`/`rejected`, admin-only writes enforced by a new DB trigger `trg_enforce_verification_admin_only`), `response_time`, generated `search_keywords` column, `activate_boost_purchase()` RPC.
- **Backend:** `api/create-boost-order.js` (reuses a recent unpaid order instead of duplicating), `api/verify-boost-payment.js`, shared webhook extended (`api/razorpay-subscription-webhook.js` now branches Boost vs. subscription by table lookup, not by trusting Razorpay's `notes.type`), `api/_analytics.js` (best-effort event logging to the existing `user_activity_log` table).
- **Ranking:** `activate_boost_purchase()` extends expiry from `GREATEST(current expiry, now())` — live-tested against synthetic DB rows, confirmed correct stacking/idempotency math before any API code depended on it.
- **UI:** `pricing.html` Boost cards enabled (was "Coming Soon"), `bookings.html` trainer dashboard Boost card + purchase history + print-to-PDF invoice view, `admin-dashboard.html` Boost Analytics section (revenue, active count, failures, expired count).
- **Refunds are manual-only, by design** — no automated recompute of `boost_expires_at` on refund. Documented, not a defect.

### 4b. Migration history reconciliation (`7310114`)
Local `supabase/migrations/` had drifted from what was actually applied to production. Recreated the 11 missing migration files under their real recorded versions; documented version drift in two pre-existing files and the immutable-history policy in `MIGRATION_HISTORY.md`. **19 migrations total**, all confirmed applied and reconciled as of this session — no new schema changes since.

### 4c. Release Candidate audit → BLOCKER found and fixed (`ea9637e`)
A full production-readiness audit found one confirmed BLOCKER: `getTrainers()` and `searchTrainers()` in `auth.js` (the **only** two functions building marketplace search results, confirmed via repo-wide grep) never selected `boost_expires_at` or `subscription_plan` — meaning the entire Boost feature, and the pre-existing Pro/Elite ranking bonus, had **zero effect on real search ranking** despite being fully built. Fixed with a 4-line, surgical diff. Verified the fix reaches both `trainers.html` and the homepage (both call only these two functions).

### 4d. KYC and certificate document viewing — BLOCKER found and fixed (`8131191`, `9c4dd84`)
Traced end-to-end with direct DB/code evidence (not assumption): `trainer-onboarding.html`'s upload flow always falls through to the **private** `trainer-documents` bucket (the intended primary bucket, `'Trainers Kyc'`, has zero RLS policies and every upload against it silently fails). The stored URL is a `getPublicUrl()`-style URL, which per Supabase's own docs does not work for a private bucket. `admin-dashboard.html` rendered these raw, so **admins could never actually view KYC documents or certificates** for any real trainer. Fixed by generating short-lived signed URLs (`createSignedUrl`) at render time in `openTrainerModal()`, reusing one shared helper for both KYC and certificates. Verified against the 4 real KYC records in production and the live RLS policy (`bucket_id = 'trainer-documents' AND profiles.role = 'admin'`, no other restriction — already authorizes this for any admin).

### 4e. Deployment prep and first production deployment
- Produced 5 deployment documents (§12), all still uncommitted.
- Pushed to GitHub, deployed to Vercel (project `onlifit`, org `team_LWqZD7IDZfWL6HbvWp6WM1rS`), confirmed the production domain `https://www.onlifit.in` serves the correct app (nav, assets, routing all verified live).
- Ran a live smoke test against production — see §9 for what it found (not fully resolved).

### 4f. UX patch round 1 (`5ace2e9`)
1. **Homepage search field leak fixed** — clicking an autocomplete suggestion was inserting Material Symbols icon ligature text into the search box (e.g. `"monitor_weightWeight Loss"`) because the click handler read the whole button's `innerText`. Now reads a dedicated `data-value` attribute.
2. **Homepage goal selector removed** from the search dropdown entirely (kept the existing, already-correct "Popular Fitness Goals" chip row as the sole goal selector) — this also eliminated the bug above at its source.
3. **Join Us branding — investigated, not changed.** No stale/old logo exists anywhere in `join-us.html`, its nav, or `footer-component.js` — every branding instance already matches the current text wordmark. No defect found; nothing was fabricated to "fix."
4. **Trainer onboarding Training Area grid** — equal-height cells (`min-h-[52px]`), properly responsive column count (1/2/3 instead of jumping straight to 2 on mobile).
5. **Step navigation buttons** (Back/Next, all step pairs) — `flex-1` instead of `justify-between` so both buttons are equal width regardless of text length.
6. **Pricing step** — currency symbol clearance fixed (`pl-8`→`pl-9`), "Pricing Tips" box removed, field spacing increased.
7. **Mandatory WhatsApp Number field added** to onboarding Step 5, wired into the saved profile (`whatsapp_number` — an existing column, no schema change).

### 4g. Payment-gated trainer onboarding — new feature, new registrations only (`43d0c27`)
**New flow:** Signup → Complete profile (Steps 1–5, unchanged) → **Profile Review** (new Step 6, trainer-facing only, explicitly not admin approval) → **Choose Plan** (new Step 7, Pro/Elite only, no Free tier) → Razorpay Checkout (existing, unmodified `purchaseSubscription()`) → on success: profile activated → dashboard + marketplace visible.

- **No migration.** Reused the existing `onboarding_completed` boolean as the draft/active flag instead of adding a column.
- **Existing trainers provably unaffected** — verified directly against production data before writing code: 7 of 9 trainer rows already had `onboarding_completed = true` (the real, populated profiles); the 2 with `false` had zero real data (never actually live). The new marketplace-visibility filter changes nothing for any real trainer.
- **Draft persistence & resume:** `submitTrainerProfile()` now saves with `onboarding_completed: false` (draft) instead of `true`. If a trainer abandons checkout, the page's own `onload` handler detects `onboarding_completed === false && bio` (proof the form was already submitted) and jumps straight to the Choose Plan step on next login — no new column, no polling.
- **Marketplace gating:** added `.eq('onboarding_completed', true)` to `getTrainers()` and `searchTrainers()` in `auth.js` (the same two functions fixed in §4c). `getTrainerById()` (direct profile-by-id view) was deliberately left unchanged — different concern from search visibility.
- **Admin approval, KYC, certificates, Razorpay, subscription activation logic are all unmodified** — the only new write is a single client-side `onboarding_completed: true` update after the existing payment flow reports success.
- **Known pre-existing constraint, not introduced here:** `create-subscription-order.js` already requires `profile.email_verified` before creating an order. This now gates every new trainer's *first* payment, not just plan upgrades as before. Not changed, per instruction to leave subscription logic untouched — surfaced with a clear error message already, but worth knowing.

### 4h. UX patch round 2 (`50c65e9`)
1. **Settings → Training Mode** — replaced default browser radio circles with custom cards (equal height, accent border+background on selection, animated dot, hover lift). **Hand-written CSS, not new Tailwind utility classes** — see §5's `styles.css` warning, this was a deliberate choice to avoid the exact bug class that's hit this project repeatedly. Underlying `<input type="radio">` name/value/onchange are unchanged, so all existing read logic (`:checked` lookups) keeps working.
2. **Bookings page search bar** — fixed icon/placeholder overlap on mobile. Same root cause and fix pattern as an earlier homepage fix: `mobile-optimizations.css`'s blanket `input[type="text"] { padding: 12px 16px }` under 768px was collapsing the icon clearance back down. Scoped override added for `#bookings-search`.
3. **Bookings page polish** — smoother filter-tab hover transitions, richer container shadow, per-row hover highlight, status-colored badges (presentational only, no status values changed), redesigned empty state.
4. **Homepage testimonial dots** — live-inspected production (found the dots container currently empty, and the styling depending entirely on Tailwind utility classes that may not be compiled — the likely actual cause of the "oversized black indicator" report). Replaced with fully hand-written CSS: 6px dots, active dot expands to a 16px pill. Auto-slide and native touch-swipe (CSS scroll-snap) were already present and untouched.

## 5. Current Project Architecture

- **Stack:** Static HTML pages (no build step, no framework) + vanilla JS + Supabase (Postgres + Auth + Storage) + Razorpay (subscriptions + Boost) + Clerk (legacy/fallback auth, not primary).
- **`auth.js`** is the shared library: `getCurrentUser()`, `requireAuth()`, `getTrainers()`/`searchTrainers()`/`getTrainerById()` (the only three trainer-fetch paths in the codebase — confirmed by repo-wide search), `renderAuthNav()`, `compareTrainersForRanking()`/`scoreTrainerForRanking()`. `getTrainers()`/`searchTrainers()` now filter on `onboarding_completed = true` (§4g); `getTrainerById()` does not.
- **`supabase-client.js`** hardcodes the Supabase project URL and anon/publishable key directly (intentional — anon keys are meant to be public, and there's no build step to inject env vars into the browser anyway). **There is no staging/production environment separation in code** — any deploy of this codebase talks to the same live database unless this file is manually swapped.
- **`styles.css` is still a stale hand-patched Tailwind snapshot, not a live build.** This caused/nearly-caused at least two more bugs found this session (the testimonial dots, and was the reason the Training Mode radio cards were deliberately hand-written in plain CSS instead of new Tailwind classes). **This remains unscoped infrastructure debt** — every new page of UI work should assume new Tailwind classes silently do nothing until verified live.
- **`bookings.html` is the trainer's dashboard** — not a separate file. `client-dashboard.html` is the client's dashboard.
- **Storage buckets** (verified live): `avatars` (public), `blog-images` (public), `trainer_certifications` (public), `trainer-documents` (private, correctly RLS'd, this is where KYC/certificates actually land), `ticket_attachments` (private), `'Trainers Kyc'` (private, **zero RLS policies, functionally dead** — every upload against it fails and silently falls through to `trainer-documents`; recommend removing it from `trainer-onboarding.html`'s upload fallback list, not yet done — see §10).

## 6. Ranking Algorithm — implemented and now actually wired up

`compareTrainersForRanking()`/`scoreTrainerForRanking()` in `auth.js`: quality signals (rating/reviews/completion/activity/experience) cap at 71 of ~100 points; paid signals (verified badge, active Boost, subscription tier) cap at 26; a dormant response-rate bucket caps at 3. As of `ea9637e`, the trainer objects fed into this function actually contain `boost_expires_at` and `subscription_plan` — before that fix, both were always `undefined` in every real search result, silently zeroing out the entire paid-signals bucket. This is now fixed and reaches both `trainers.html` and the homepage.

## 7. Payments

- **Subscriptions (Pro/Elite):** working, real, unchanged this session except one call site addition (§4g) and one `notes.type` tag added for observability (§4a webhook branching).
- **Boost:** fully built this session (§4a). Purchase flow verified via live RPC testing against synthetic data; not yet verified via a real Razorpay test transaction (no test credentials in this environment at any point).
- **Shared webhook** (`api/razorpay-subscription-webhook.js`) handles both, routing by table lookup on the order id — not by trusting `notes.type` propagation (Razorpay doesn't guarantee that survives onto the payment entity a webhook delivers).
- **`RAZORPAY_WEBHOOK_SECRET` is still not documented in `.env.example`** — flagged repeatedly this session, never fixed (out of scope each time it came up — it's a deployment-config item, not a code change). Confirm it's actually set correctly in the Vercel production environment.

## 8. Trainer Onboarding & Verification

- **New registrations** go through the payment-gated flow (§4g): Complete profile → Profile Review → Choose Plan (Pro/Elite only) → Checkout → activation.
- **Existing trainers** are completely unaffected (verified against live data).
- KYC and certificate documents now correctly viewable by admins via signed URLs (§4d).
- Verification lifecycle (`pending`/`under_review`/`verified`/`rejected`) is admin-only, enforced by a DB trigger, not just RLS (a real gap — RLS alone would have let a trainer edit their own verification fields — closed this session, in the Boost-feature migration batch).
- **7 orphaned onboarding fields** carried over from before this session, still unresolved: `training_approach`, `kyc_id_type`, `kyc_id_number`, `teaching_style`, `training_focus`, `profile_live` write to columns that don't exist and are silently dropped (the 7th, `response_time`, was fixed in an earlier session). Needs a product decision — not touched this session, not part of any commit above.

## 9. Known Issues Still Remaining

*Historical note: items 1–2 below are preserved for the audit trail but are now stale/superseded — see §0 for the current, accurate status of both. Short version: item 1 (Vercel routing) is now partially mitigated (§0/§21), item 2 ("0 trainers found") is now fixed (§0/§21).*

1. ~~CONFIRMED THIS SESSION: Vercel production does NOT yet serve the Phase 2 build~~ — **superseded, see §0 item 1.**
2. ~~UNRESOLVED: live production search showed "0 trainers found"~~ — **superseded, see §0 item 2. Fixed this session.**

**Still genuinely open, carried forward + new from this session:**
- **Grandfathering decision for the new verification-gated visibility rule** (§18) — asked, not yet answered by the user.
- **Financial/business model change** — user is planning one, hasn't shared the plan yet (§0 item 4).
- **`pricing.html`/`trainer-onboarding.html` show hardcoded prices**, not read live from `system_settings` — a real desync risk the moment prices are changed in the DB (§22).
- **Dead `system_settings` keys** (`boost_3day_duration_days`, `boost_7day_duration_days`, `profile_completion_discovery_threshold`) — seeded, never read (§22).
- **Subscription-payment webhook failures aren't recorded/cleaned up** (only Boost failures are) — orphaned `created`-status rows possible (§22).
- **Clerk auth integration looks partially built/abandoned** — worth a dedicated look before relying on or removing it (§22).
3. **`RAZORPAY_WEBHOOK_SECRET` undocumented in `.env.example`**, unresolved across multiple mentions this session (§7).
4. **No staging/production Supabase separation** — documented as an architectural fact in `DEPLOYMENT_GUIDE.md`, not something to "fix" without a product decision to provision a second Supabase project.
5. **`'Trainers Kyc'` storage bucket is dead** (zero RLS policies, every upload silently fails and falls through) — recommended removing it from `trainer-onboarding.html`'s upload candidate list; not done, awaiting explicit go-ahead (this was raised and the user chose not to action it in the same turn KYC was fixed).
6. **7 orphaned onboarding fields** (§8) — pre-existing, still unresolved.
7. **No visible "Boosted" badge** on trainer cards in search results — Boost affects ranking position but nothing on the card itself signals why, to either the client or the paying trainer beyond their own dashboard. Flagged as a product gap in the RC audit, not fixed.
8. **Full end-to-end payment testing never performed** — no real or test Razorpay transaction was completed at any point this session (no credentials available). Boost and the new payment-gated onboarding checkout are both verified at the code/RPC level, not via an actual completed payment.
9. **RESOLVED this session:** the 5 deployment/ops documents are now committed as part of `v1.2.0-lead-crm-foundation` (§15).
10. **No authenticated human walkthrough has ever been performed** in this environment — signup, Google OAuth consent, onboarding completion, admin login — all carried over as an open item from every prior session too. Still the single biggest gap between "verified by an AI reading code and database state" and "actually confirmed working for a real user." **This session's Phase 2 smoke test (§9a) is the same class of gap, applied to the new enquiry flow specifically.**
11. **NEW this session — append-only trigger blocks cascade deletes.** Discovered live during the Phase 2 smoke test (§9a): `client_enquiry_events`'s `BEFORE UPDATE OR DELETE` trigger (added in the Phase 2 migration to guarantee immutable history) also blocks the `ON DELETE CASCADE` fired when a parent `client_enquiries` row is deleted, because the cascade issues a real `DELETE` against the child table that the trigger rejects — aborting the whole transaction. Practical effect: **a `client_enquiries` row can never be deleted once it has any event row**, which is true of virtually every enquiry (every one gets a `created` event immediately). Not a defect in the sense of anything being broken today — nothing in the app currently deletes enquiry rows — but it needs a decision before it becomes one: either (a) accept this as intentional (enquiries are permanent CRM records, deletion should never be a supported operation, only status changes), or (b) add a narrow, explicit "hard delete" path (e.g. a SECURITY DEFINER admin-only function that temporarily disables the trigger, the same manual technique used to clean up this session's test row) for legitimate cases like GDPR erasure requests. Not decided or fixed this session — flagged for the next product/architecture conversation.

## 9a. Phase 2 Smoke Test (this session)

Performed after implementation and the stabilization fix pass, before commit/tag/push, per explicit instruction. Split cleanly into what's verifiable from this environment and what isn't, rather than claiming end-to-end coverage that wasn't actually possible.

**Database layer — fully verified, passed:**
- ✓ Created a real enquiry via `try_create_client_enquiry()` against production Supabase with all new capture fields populated — row stored correctly, including `source = 'marketplace'` and `priority` defaulting to `'medium'`.
- ✓ Exactly one `created` timeline event was written, with correct `meta` (`source`, `plan_type`).
- ✓ Called the RPC again with the **same idempotency key** — confirmed it returned `idempotent_replay: true` with the **same** `enquiry_id`, and did **not** create a second row or a second event (duplicate submission correctly deduplicated at the database layer).
- ✓ Directly attempted to `UPDATE` an event row — confirmed the append-only trigger raised and blocked it (verified by re-reading the row afterward: `event_type` was still `created`, not the tampered value).
- ✓ Cleaned up the test row after — which is how the cascade-delete/append-only-trigger conflict in Known Issues item 11 was actually discovered, live, not theorized.

**Frontend/UI layer — blocked by an unresolved deployment gap, not by anything wrong with the code:**
- ✗ **Could not verify against live production** — navigated to `https://www.onlifit.in/trainer-profile.html` with a real trainer id and confirmed via direct DOM inspection (`#booking-date` present, `#enquiry-name` absent) that **production is still serving the old pre-Phase-2 booking modal**. This is the same Vercel-deployment-confirmation gap called out in every prior handoff (§0, §11) — it isn't something this session could resolve (no Vercel credentials in this environment, consistent with every prior session).
- ✓ Confirmed the *current* live page loads with zero console errors, real trainer data, and a correct mobile layout at 390px — a clean baseline to compare against once the new build actually deploys.
- ✓ Separately verified the new code itself (not live, but the actual file contents that will deploy): full inline-script syntax check passed; exhaustive grep confirmed zero dead element references anywhere in the file; interactive testing against an isolated extraction of the real markup+script confirmed chip selection, mode toggle, optional-panel expand, real-time validation (including the ARIA/highlight fixes from the stabilization pass), and correct layout at 320px/390px viewport widths. This is the same verification method used and disclosed in the Phase 2 code review and fix-pass reports.
- ✗ **Not tested:** an actual authenticated logged-in submit → WhatsApp-opens → lead-appears-in-database round trip through the real browser UI. This requires either a live deployment or real user credentials in this environment, neither of which exists here. The database-layer test above exercises the identical RPC call the UI makes, which is the strongest available substitute, but it is not the same as a real click-through.

**Conclusion:** the Phase 2 database and event system are proven correct against live production data. The Phase 2 frontend code is proven correct in isolation but **has not yet been exercised as a live user-facing feature**, because production has not yet deployed it. This is a deployment-pipeline gap, not a code-quality gap — see §0 for the required next step.

## 10. Files Modified This Session (31 files)

```
DATABASE_MIGRATION_PLAN.md          IMPLEMENTATION_ROADMAP.md           MIGRATION_HISTORY.md
PROJECT_HANDOFF.md                  admin-dashboard.html                api/_analytics.js
api/create-boost-order.js           api/create-subscription-order.js    api/razorpay-subscription-webhook.js
api/verify-boost-payment.js         auth.js                             blog-post.html
bookings.html                       boost-payments.js                   onlifit.html
pricing.html                        trainer-onboarding.html             trainer.html
supabase/migrations/ (11 new files, listed in MIGRATION_HISTORY.md)
```
Plus 5 new, uncommitted docs: `DEPLOYMENT_CHECKLIST.md`, `DEPLOYMENT_GUIDE.md`, `OPERATIONS_RUNBOOK.md`, `RELEASE_NOTES_v1.md`, `SMOKE_TEST_CHECKLIST.md`.

## 11. Deployment Access Notes

- **Vercel:** CLI installed (`v51.0.0`), project already linked (`.vercel/project.json`: `projectName: "onlifit"`, `orgId: team_LWqZD7IDZfWL6HbvWp6WM1rS`), but **no valid authentication token exists in this environment** — `vercel login` requires an interactive browser/device-code flow this assistant cannot complete. Same limitation applies every session unless the user authenticates the CLI themselves in this same environment/shell.
- **GitHub:** push succeeded this session after initial hangs — Git Credential Manager was trying to open an interactive prompt; forcing non-interactive mode surfaced the real (now resolved) auth issue. Push is confirmed working as of `50c65e9`.
- **Supabase:** MCP tool access is live and working throughout — used extensively for migrations, RLS verification, and live data checks.

## 12. Deployment Documentation (written in the prior session; committed as of `v1.2.0-lead-crm-foundation`, see §15)

- `DEPLOYMENT_CHECKLIST.md` — pre-deploy verification checklist (env vars, Supabase/Razorpay/Vercel config, storage permissions).
- `DEPLOYMENT_GUIDE.md` — step-by-step deploy process, rollback procedure, common issues.
- `OPERATIONS_RUNBOOK.md` — monitoring, payment reconciliation, incident response, support workflow.
- `RELEASE_NOTES_v1.md` — features, architecture decisions, breaking changes, known limitations.
- `SMOKE_TEST_CHECKLIST.md` — the exact checklist used for the live production smoke test in §9.

## 13. Production Readiness

- **Code/data layer:** thoroughly audited this session — one confirmed BLOCKER (ranking) and one confirmed BLOCKER (KYC/certificate viewing) were found through direct evidence (not assumption) and fixed, each independently re-verified afterward.
- **Live deployment:** confirmed reachable and serving a correct build at `https://www.onlifit.in`, but **not confirmed to be the latest commit** (§0), and the one thing that was smoke-tested live (search) **failed** and was never re-verified (§9, item 2).
- **Overall:** do not consider this "launched and healthy" until §0 and §9 item 2 are both resolved. Everything else — payments, auth, admin, Boost — is verified at the code/database level to a high degree of confidence but has never been exercised by an actual authenticated human in this environment.

## 14. Recommended Next Session Order (superseded — see below for current priority; original left for history)

*This ordering is from an earlier handoff and is now out of date (it predates §18–§22). Use this instead:*

1. **Ask the user for the financial/business-model plan** (§0 item 4) if they haven't already led with it — almost everything else is lower priority once that's on the table, since it may reshape the payment/subscription code this whole document describes.
2. **Get a decision on the grandfathering question** (§18) if it's still open — this affects real, currently-live trainers.
3. **Do not push the held commits** (§2) without the user explicitly saying so again.
4. If there's time before/around the above: get real Vercel dashboard access at least once, to finally resolve §0 item 1's root cause instead of just the hash-routing mitigation — this has now been an open item across many sessions.
5. Fix the `pricing.html`/`trainer-onboarding.html` hardcoded-price desync risk (§22) — small, well-scoped, low-risk.
6. Lower priority, long-standing, still open: the orphaned `trainer.html` bare-path collision, the `'Trainers Kyc'` dead storage bucket, the 7 orphaned onboarding fields, dead `system_settings` keys, unhandled subscription webhook failures, the Clerk integration's actual status.

## 15. Phase 2 — Lead Management / Trainer CRM Foundation (this session)

**Goal:** lay the database + enquiry-capture foundation for a full trainer CRM (tagged `v1.2.0-lead-crm-foundation`), without disturbing the existing, working enquiry pipeline (`client_enquiries`, `try_create_client_enquiry()`, `api/create-lead.js`, duplicate/idempotency/cap protection). Explicitly scoped to stop before building the trainer-facing dashboard itself (Phase 3).

### 15a. Database migration applied to production
Two migrations applied directly via Supabase MCP (both idempotent, both additive — no destructive changes, no data rewrites):
- `supabase/migrations/20260721110428_phase2_lead_management_crm.sql` — extends `client_enquiries` with 11 new nullable capture/CRM columns (`client_name`, `phone_number`, `fitness_goal`, `training_mode`, `location`, `budget`, `preferred_time`, `message`, `follow_up_date`, `updated_at`, `priority`), adds `idx_client_enquiries_trainer_status` and a partial index on `follow_up_date` (ready for a future reminder job with no further schema change), adds RLS SELECT policies (trainer sees own rows, admin sees all — the table previously had **zero** read policies, RPC-only), creates the new append-only `client_enquiry_events` table (timeline + notes history unified — a note is just an event of type `note_added`) with a hard `BEFORE UPDATE OR DELETE` trigger blocking mutation for every role including `service_role`, and extends `try_create_client_enquiry()` with the new capture fields as trailing optional params (backward compatible) plus a new ownership-checked `update_client_enquiry()` RPC that writes a timeline event for every effective field change.
- `supabase/migrations/20260721110515_phase2_drop_stale_enquiry_rpc_overload.sql` — cleanup migration. `CREATE OR REPLACE FUNCTION` with a different parameter list creates a Postgres **overload**, not a replacement; the first migration left both the old 5-arg and new 14-arg `try_create_client_enquiry` live simultaneously, with the old one silently bypassing all new logic. Caught via the Supabase security advisor and dropped.
- Ran `get_advisors` (security) after both migrations — no new findings introduced.

### 15b. Enhanced enquiry flow deployed (code, pending Vercel confirmation — see §0)
- `trainer-profile.html`: the old date/time booking modal replaced with a premium enquiry form — 5 required fields (Name, WhatsApp Number, Fitness Goal via chips, Training Mode via toggle, Location) + a collapsible optional section (Budget, Preferred Training Time via chips, Notes). Real-time validation, ARIA-complete custom controls (`aria-pressed` on chips/toggle, `aria-invalid`/`aria-describedby` on all 5 required fields), smart prefill from the logged-in user's profile, submit → success modal → auto-open WhatsApp with a visible fallback hint if the popup is blocked, 15s request timeout with a clear message.
- `api/create-lead.js`: passes the new capture fields into the extended RPC, corrected `source` from `'whatsapp'` (contact channel) to `'marketplace'` (acquisition origin — the column now means what the CRM's future `source` values, e.g. `qr_code`/`referral`, will need it to mean), logs a `whatsapp_link_generated` timeline event.
- **Duplicate/idempotency/cap protection, the RPC's core dup-window logic, and the API response shape are all byte-for-byte unchanged** from before this session.

### 15c. Event system active
`client_enquiry_events` is live and being written to by real code paths: `created` (on every new enquiry, from `try_create_client_enquiry`), `whatsapp_link_generated` (from `api/create-lead.js`), and `status_changed`/`priority_changed`/`follow_up_scheduled`/`note_added` (from `update_client_enquiry`, not yet called by any UI — ready for Phase 3). No AI features built on top of this yet, per instruction — the schema (generic `event_type` + `meta jsonb`) was deliberately kept open-ended so Phase 3+/AI features (lead scoring, follow-up suggestions, weekly summaries) are additive, not another migration.

### 15d. CRM foundation complete
Database and capture-flow layer are done. Nothing trainer-facing exists yet — no Leads dashboard, no way for a trainer to see, search, filter, or act on a lead beyond the existing (unchanged) new-enquiry notification. That's Phase 3.

### 15e. Known intentional limitations
- **No focus trap inside the modal** — confirmed pre-existing from before Phase 2, not a regression; not fixed this session (out of scope for a stabilization pass).
- **Phone validation is lenient** (`digits.length >= 10` after stripping non-digits) — matches the leniency level of every other phone field in this codebase; will reject some legitimate short international numbers entered without a country code. A deliberate consistency choice, not an oversight.
- **`whatsapp_link_generated` can fire more than once per enquiry row** — every resubmission within the 30-day duplicate window logs a fresh event against the same (reused) `enquiry_id`, since only true idempotent replays are excluded. Treated as correct semantics (each resubmission is a real new handoff moment) rather than a bug — flagged for confirmation if it's ever relied on for precise per-enquiry analytics.
- **No pre-submission funnel tracking** (`form_opened`) — the event architecture is enquiry-row-scoped by design (`enquiry_id` is a required FK), so there's no event to attach before a row exists. Deliberately not solved with a parallel tracking system; would need its own scoped schema addition (e.g. a nullable session id) if ever wanted.
- **`'Trainers Kyc'` dead storage bucket and the 7 orphaned onboarding fields** — pre-existing from before Phase 2, still unresolved, still awaiting their own scoped decisions (unchanged from prior handoffs).
- **Vercel deployment confirmation** — see §0. This is the most significant open item: everything in §15a–15d above is verified at the code/database level (migrations applied and confirmed live in Supabase; code syntax-checked and interactively verified via isolated harness testing) but **not yet confirmed exercised by a real user against a live, current deployment** — see §9a for exactly what this session's smoke test could and couldn't cover.

## 16. Phase 3 — Trainer Lead Dashboard (this session)

**Goal:** build the trainer-facing Leads CRM view on top of Phase 2's foundation, inside `bookings.html`'s existing SPA router. Implemented, code-reviewed, stabilized, and pushed — see §0 for why it's currently unreachable in production despite being correct and complete.

### 16a. What was built
- New `/trainer/leads` route inside the existing `DashboardRouter` (`bookings.html`) — `view-leads` section: 6 KPI cards (Total/New/Contacted/Converted/Active/Conversion Rate), search + status/priority filters (all pure in-memory over one cached fetch), lead cards, empty state.
- Lead detail drawer: client info, quick actions (WhatsApp, Copy Phone, Copy Details, Mark Contacted/Converted/Closed, Priority, Follow-up, Add Note), timeline (reuses `client_enquiry_events`, cached per-lead in `leadTimelineCache`, fetched once and reused on repeat opens), Previous/Next navigation with keyboard arrow support.
- New thin helpers added to `auth.js`: `getTrainerLeads()`, `getLeadEvents()`, `updateLead()` — wrap the existing tables/RPC, no new backend logic.
- Fixed a real, pre-existing sidebar bug while adding the new nav item: a "Leads" link existed but actually pointed at `/trainer/bookings` (mislabeled leftover). Renamed back to "Bookings", added the real `/trainer/leads` link. Also fixed the router's `supported` route set, which was silently missing `'messages'` and would have needed `'leads'` added regardless.
- Deliberately did **not** re-link Messages in the sidebar even though it briefly seemed related — found `window.ENABLE_PLATFORM_MESSAGING` is referenced everywhere but never set anywhere in the codebase, confirming platform chat is intentionally deprecated, not just hidden by oversight.

### 16b. Code review → stabilization pass (both done this session)
A dedicated review pass (before pushing) found and fixed 4 Must-Fix issues, all verified via an isolated interactive test harness (real markup + real logic extracted from the file, mocked Supabase calls — not just read for correctness):
1. **Stale drawer navigation** — status/priority/follow-up changes weren't recomputing Prev/Next state after the active lead's re-filtered position changed. Fixed with "Option A": if the active lead no longer matches the current filter after an edit, the drawer stays open, shows a notice, and disables Prev/Next rather than computing a wrong/arbitrary position.
2. **No double-submit protection** on drawer quick actions — fixed by disabling the relevant control(s) before every RPC call and re-enabling in a `finally` block, with an explicit already-in-flight guard (verified by forcing a real race with an artificial RPC delay: exactly 1 call, not 2, across every action).
3. **No focus management** on the drawer — fixed to match the Phase 2 enquiry modal's pattern exactly (focus moves into the drawer on open, restores to the trigger element on close).
4. **Drawer form labels not associated with their controls** (`for`/`id`) — fixed, verified via `label.control` resolution (the same API screen readers use).

### 16c. Known, accepted limitations (all explicitly reviewed, none blocking)
- No true Tab focus trap inside the drawer (same pre-existing gap as the Phase 2 modal).
- Mobile verification only directly done at 390px.
- "Active Leads" KPI = New + Contacted is an interpretation of an ambiguous spec, not an explicitly confirmed definition.
- Phone validation leniency, `whatsapp_link_generated` firing more than once per lead on resubmission — same accepted semantics as Phase 2.

## 17. Phase 4 — Admin Lead Dashboard + Production Routing Investigation (this session)

**Goal:** an operational, admin-facing view across every trainer's leads, built on the Phase 2/3 foundation — explicitly *not* a second CRM. Implemented, code-reviewed, stabilized, pushed to `origin/main` at `8b69027`. Deployment confirmed correct (see §17d) but **currently unreachable in production due to the routing bug in §0** — this is a hosting/config issue, not a defect in this work.

### 17a. Architecture decisions (both explicitly asked and answered before coding)
- **No router introduced into `admin-dashboard.html`.** Confirmed via investigation that this file has no client-side router at all (unlike `bookings.html`) — it's tab-switching (`data-tab`/`.tab-content`) for all ten tabs now, Leads included. Building a one-off URL router just for this tab was explicitly rejected in favor of matching the file's real, existing convention.
- **Admin drawer is a separate implementation, not a shared component with the trainer drawer.** Explicitly decided via a direct user choice: extracting a shared `lead-drawer.js` would have required editing `bookings.html`, which was frozen ("do not modify unless a critical bug is found"). The admin drawer mirrors the trainer drawer's structure/behavior closely but lives entirely in `admin-dashboard.html`, hand-written in this file's plain-CSS convention (no Tailwind here).
- **Trainer reassignment** extends `update_client_enquiry()` with one new optional parameter, `p_assigned_trainer_id` (not `p_trainer_id`, per explicit naming instruction) — admin-only (checked independently of the general ownership check), validates the target is `role='trainer'` (`INVALID_TRAINER` otherwise), writes a `trainer_reassigned` event. The old 5-arg RPC overload was dropped in the same migration (this project hit the "CREATE OR REPLACE with a new signature creates an overload, not a replacement" trap once already in Phase 2 — same fix pattern applied proactively this time).

### 17b. What was built
- `#leads` admin tab: two KPI rows (Total/New/Contacted/Converted/Closed/Conversion Rate, then Today/Week/Month), a filter bar (trainer/status/priority/mode/goal/date-range/search — all in-memory over one cached fetch, following the same "fetch once" discipline as Phase 3), a sortable table (Created/Trainer/Priority/Status columns), assignment-state badges (Assigned/Trainer Disabled/Subscription Expired/Unassigned — visible directly on each row, no drawer needed).
- Admin lead drawer: same interaction model as the trainer drawer (lazy-cached timeline, disable-before-RPC quick actions, stale-filter Option A handling, focus management), plus admin-only additions: trainer info panel (verification/account/subscription status), the reassignment dropdown, and a `Trainer Reassigned` timeline entry that resolves trainer names from the cached profile map.

### 17c. Stabilization pass (before push) — 2 Must-Fix items found and fixed
1. **Reassignment dropdown was scoped to only trainers who already had a lead** (sourced from the leads-derived cache) — a trainer with zero leads could never be a reassignment target, defeating the feature's purpose. Fixed with a dedicated, separately-cached fetch of all active trainer profiles (`ensureAllActiveTrainersLoaded()`, lazy on first drawer open, one query per admin session). While verifying this fix, also caught and fixed a direct consequence: reassigning to a trainer not yet in the leads-derived cache showed "Unknown"/"Unassigned" in the table/badge despite the reassignment succeeding — `alDrawerReassignTrainer()` now syncs the new trainer's profile into the leads-derived cache from the already-fetched all-trainers cache (no new query).
2. **Sortable table headers had no keyboard access** — fixed with `tabindex="0"`, `role="button"`, `aria-sort` (updates live), Enter/Space handlers, and a fix for a focus-loss bug found while implementing this (re-rendering the sorted table was dropping keyboard focus to `<body>` every time — now re-focuses the header's replacement node).

Both fixes verified via the same isolated-harness methodology as Phase 3, including a mock trainer with zero leads specifically to exercise the fixed code path.

### 17d. Deployment verification — code confirmed correct, routing confirmed broken
Direct raw-content `fetch()` against the live `admin-dashboard.html` and `bookings.html` on production confirmed **both files contain the exact, current, correct code** (every Phase 3/4 marker checked, including both stabilization fixes). GitHub's commit status shows Vercel reported a successful deploy of `8b69027`. **The deployed code is not in question.** What's broken is the URL routing layer in front of it — see §0 and the full investigation below.

### 17e. Production routing investigation — full findings
Systematically ruled out, with direct evidence (not assumption):
- **`vercel.json` corruption or drift**: ruled out. Byte-identical between local and `origin/main` (`git hash-object` = GitHub Contents API blob SHA, both `6d7f89f...`). Valid JSON, no BOM. Last actually modified in commit `8b35656`, nowhere near this session's work.
- **Wrong/stale deployment**: ruled out for content (§17d), though which *Vercel project* the domain is actually attached to remains unconfirmed (same open question as every prior session — see §11's `.vercel/project.json` vs. the GitHub-integration project mismatch noted after Phase 2).
- **Rewrite syntax error**: ruled out. `/trainer/:path*` and `/client/:path*` are syntactically standard, valid Vercel wildcard rewrites.
- **Confirmed via live routing matrix** (`fetch(..., {redirect:'manual'})`, full headers captured): `/`, `/bookings`, `/admin-dashboard`, `/client-dashboard` all `200`. Every `/trainer/*` and `/client/*` **sub-path** (`/trainer/dashboard`, `/trainer/bookings`, `/trainer/leads`, `/client/dashboard`, `/client/bookings`) returns a direct, non-redirecting `404` with `x-vercel-error: NOT_FOUND` — Vercel's own platform 404, generated before any app code runs.
- **One separate, smaller bug found in the same investigation**: `/trainer` and `/trainer/` (zero-segment only) return `200` — but not via the intended rewrite. A stray orphaned file `trainer.html` exists at repo root (title "Trainer Allocated | On…", clearly unrelated to the dashboard, from a much earlier commit `a3047b5`) and `cleanUrls` is resolving the bare path directly to it. This does **not** explain the sub-path failures — no colliding file exists for `/trainer/dashboard` etc., so per Vercel's documented precedence (static files checked before rewrites), the rewrite should still apply to those and doesn't.
- **Root cause not confirmed** — cannot be, without Vercel dashboard/API access. Leading hypothesis (explicitly marked as unconfirmed): a project-level configuration mismatch — wrong Root Directory, a legacy dashboard-configured rewrite/redirect predating `vercel.json` adoption, or the domain being attached to a different project/deployment than assumed. See §0 for the exact next steps to check this.

---

## 18. Marketplace Verification Workflow Redesign (this session)

**Business decision made and implemented:** Onlifit's discoverability rule changed from "paid = visible" to "paid AND admin-verified = visible." This was an explicit product decision the user made after an architecture review found the *previous* live behavior was: trainer completes onboarding → pays → **immediately discoverable**, with admin KYC/certificate verification happening in parallel but never actually gating visibility. The user considered that a trust/quality gap for a marketplace calling itself "verified."

**New workflow implemented:** Signup → complete profile → upload KYC & certifications → choose plan → pay → **Verification Pending** → admin reviews within ~24h → **Approved → discoverable** / **Rejected → stays hidden, trainer can re-upload and resubmit**.

**What changed, concretely:**
- **Discoverability filter** (`applyDiscoverabilityFilter()` in `auth.js`, the single shared helper every search surface uses — homepage, `trainers.html`, blog recommendations, similar-trainers) now requires ALL of: `onboarding_completed=true`, `verification_status='verified'`, `account_status='active'`, and (after the §21 performance fix) `subscription_expires_at > now()`. Previously only `onboarding_completed` was checked.
- **Trainer self-resubmission after rejection** — new, narrowly-scoped capability. Previously the DB trigger `trg_enforce_verification_admin_only` blocked a trainer from touching their own verification fields at all, even to resubmit. New migration (`supabase/migrations/20260728120000_trainer_self_resubmit_verification.sql`, applied to production) carves out exactly one exception: a trainer whose status is `rejected` can flip it to `pending` themselves (and only that transition) — they still can never set `verified` themselves or touch `verification_verified_at`/`verification_rejected_reason`. `trainer-onboarding.html` now detects a rejected trainer on load and routes them into a reworked resubmission flow (reuses the existing step-3 KYC/certificate upload UI rather than duplicating it) instead of the normal onboarding steps.
- **Admin rejection now captures a reason** — `admin-dashboard.html`'s `rejectKYC`/`rejectCertificates` previously discarded any reason; now prompts for one and writes it to `verification_rejected_reason` (a column that already existed but was write-only/unused before this session).
- **Trainer dashboard shows verification status** — `bookings.html` now has a status banner (Pending / Rejected + reason + resubmit link / nothing shown once Verified) that didn't exist before.
- **Grandfathering decision — NOT resolved, flagged explicitly to the user, no action taken either way:** any trainer who was already `onboarding_completed=true` but not yet admin-`verified` under the old rules will disappear from search the moment this logic is live in production, since the old rule never required verification. The user was asked whether to grandfather existing live trainers (e.g. bulk-set them to `verified`) or require everyone to clear the new bar, and has not yet answered. **This is a real, live-traffic-affecting decision still pending** — surface it again next session if not already resolved.
- **Related, unrelated-looking bug also found and fixed in passing:** `check_onlifit_black_eligibility()` was found to still compare `verification_status = 'approved'`, a value that no longer exists since an earlier session renamed it to `'verified'` — turned out to already be fixed by a pre-existing migration (`20260719201549_fix_black_eligibility_verification_value.sql`) applied before this session started; re-confirmed live rather than duplicating a fix that wasn't needed.

## 19. UI/Premium Design Pass — Trainer Onboarding + Homepage (this session)

Two separate rounds of visual-only work, explicitly scoped as "no business logic, no schema, no payment flow changes" both times.

**Round 1 — Trainer onboarding (`trainer-onboarding.html`):** custom-styled checkboxes (native checkboxes were rendering broken — inconsistent size/border-radius/stretching, root-caused to Tailwind's `@tailwindcss/forms` plugin colliding with a project-wide `borderRadius.DEFAULT` override), restyled training-area tag cards and pricing inputs (₹ symbol was overlapping entered text), unified all buttons on one `.ob-btn` system, and rebuilt the plan-selection step to actually show pricing (₹999/₹2,999 per month, matching live Razorpay checkout defaults — previously trainers reached checkout with zero visible pricing) plus a "what happens after you pay" trust section and a "no commission on your earnings" value prop.

**Round 2 — Homepage (`onlifit.html`):** the user first asked for a full "premium SaaS" redesign; the first attempt added an icon-mark logo, which the user then explicitly said to revert ("keep the original logo only") while keeping the rest of the visual redesign — logo reverted to plain text everywhere it had been touched (nav, footer, `footer-component.js`). Kept: a floating pill-style nav, a subtle dot-grid hero background, ghost-numeral "How It Works" steps, and consistent eyebrow labels above section headings. **Two real bugs were found and fixed during this pass, not just style:** (1) the ghost-numeral ("01/02/03/04") ranking numbers were rendering fully solid/black instead of faint, because `text-on-surface/[0.05]` is a Tailwind *arbitrary-value* opacity class that was never present anywhere else in the codebase, and — a fact worth remembering for all future UI work on this project — **`styles.css` is a frozen, precompiled Tailwind snapshot, not a live build**, so any class not already baked into that snapshot silently does nothing; fixed with inline `style="opacity:.12"` instead. (2) The "How It Works" and "Browse by specialty" card rows didn't actually scroll on mobile, same root cause (their width classes like `w-[78%]`/`w-[30%]` were also never-compiled arbitrary values) — fixed with hand-written CSS rules, matching a pattern (`.testimonial-card { min-width: 320px }`) that a much earlier session had already used for the identical reason. **Any future UI change to this codebase should assume new/unusual Tailwind classes do nothing until visually verified** — this has now bitten three separate sessions.

## 20. Homepage Search Fix + Site-Wide Logo Consistency Pass (this session)

**Search autocomplete bug, fixed:** the homepage's specialty/goal search box (`#search-query` in `onlifit.html`) was showing only location suggestions (Hyderabad/Kondapur/Bengaluru) no matter what was typed, because a prior session had removed the specialty suggestions from that dropdown to fix a different bug but left the location buttons behind, still wired to the wrong input. Replaced with a live-filtered specialty/service suggestion list (reusing the same tag vocabulary trainers pick from during onboarding), with mobile touch-target/scroll/keyboard improvements. Location remains a fully separate control (`#search-mode`/`#search-location`), untouched.

**Logo consistency audit, fixed:** every page's nav/footer brand link was audited against the homepage's actual current treatment and normalized — several pages had drifted (wrong color, missing font-weight class, non-clickable `<div>`/`<h3>` instead of a real link, two dashboard footers missing a brand element entirely, one page — `login.html` — using a fully custom hardcoded-hex CSS class instead of the shared design tokens). Deliberately chrome-less pages (`billing.html`, `my-trainers.html`, `onboarding.html`, `trainer-onboarding.html`, which intentionally hide nav/footer as a focused-funnel pattern) and the separate admin-tool CSS system (`admin-dashboard.html`, `admin-login.html`, plain CSS, no Tailwind) were deliberately left alone — flagged to the user rather than silently changed, since adding chrome there is a bigger UX call than a logo fix.

## 21. Dashboard Bugfixes + Performance Fix + Routing Mitigation (this session)

Covers §0 items 1 and 2 in detail.

**`setRandomQuote()` crash, fixed:** `client-dashboard.html`'s dashboard init was throwing `TypeError: Cannot set properties of null` on every single load, aborting initialization at the last step. Root cause: the quote widget's HTML (`#motivation-quote`/`#motivation-author`) had been removed from the page's markup at some point, but the JS calling it was never updated. Fixed with an existence check, not a try/catch — `renderAll()` now simply completes when the widget isn't present.

**`support.html` theme break, fixed:** its two main buttons and nav logo were using a hardcoded coral `#FF5A5F`, the pre-rebrand brand color, while every other page already uses the current black/white token system. This was a leftover never updated when the site rebranded to monochrome.

**"0 trainers found" performance bug — see §0 item 2 for the full writeup; this is the same fix.**

**`/trainer/*`/`/client/*` routing — see §0 item 1 for the full writeup.** In addition to the hash-routing rewrite, two genuinely broken links were found and fixed: `terms.html` and `privacy.html` both had a footer link literally labeled "Trainer Dashboard" pointing at `trainer.html` (a client-facing "your trainer has been allocated" confirmation page, not the dashboard) instead of `bookings.html` (the real dashboard, confirmed via `getDashboardPathForRole()` in `auth.js`).

## 22. Full Codebase Audit (this session, read-only, no code changed)

Performed at the user's request as groundwork before a financial/business-model change (see §0 item 4) — three parallel research passes covering file structure, database schema, and payment/API/config. Full results were given directly to the user in-chat; summarized here since that chat won't be available in a fresh session:

- **Stack confirmed:** static multi-page HTML/vanilla-JS (no framework, no build step) + Supabase (Postgres/Auth/Storage) + Razorpay + Vercel hosting. Two internal dashboards (`bookings.html`, `client-dashboard.html`) each have a lightweight hash-based router for in-page tabs only; every other page-to-page navigation is a normal full-page `<a href>` load.
- **28 live HTML pages** inventoried with audience + auth requirements (see chat history or re-run the audit if needed — not reproduced in full here to keep this file from ballooning).
- **Database:** `profiles` is the hub table for all three roles; `client_enquiries`/`client_enquiry_events` form the lead/CRM system (append-only timeline, DB-trigger-enforced); `subscription_payments`/`boost_purchases` track the two revenue products; `system_settings` is a key-value config store. Full column/function/trigger/RLS detail was produced but not persisted verbatim here — re-run a targeted audit if a fresh session needs it rather than trusting this summary for anything schema-precise.
- **Revenue model (as of this audit, before any change the user makes):** trainer subscriptions only (Pro ₹999/mo, Elite ₹2,999/mo via Razorpay) + optional Boost visibility purchases (₹499/3-day, ₹999/7-day). **No commission is taken on client-trainer transactions** — clients contact trainers directly via WhatsApp, Onlifit is never in that money flow.
- **RESOLVED in the follow-on session (§23):** `pricing.html` and `trainer-onboarding.html` previously displayed prices as static hardcoded text (and Elite was actually wrong — showed ₹2,499 while checkout charged ₹2,999). Both pages now load all prices live from `system_settings` at page load, with hardcoded fallbacks only if that fetch fails. Same pattern extended to the new `gym-landing.html`/`gym-dashboard.html` pages in §23.
- **Dead/unused `system_settings` keys found:** `boost_3day_duration_days`, `boost_7day_duration_days`, `profile_completion_discovery_threshold` are seeded in the database but have zero live readers anywhere in the code — editing them today would do nothing.
- **`messages.html` (platform chat) is confirmed fully deprecated**, gated behind a feature flag (`window.ENABLE_PLATFORM_MESSAGING`) that's hardcoded `false` everywhere; WhatsApp is the real contact mechanism. Both dashboards deliberately don't link to it.
- **No separate admin auth system** — `admin-login.html` uses the identical Supabase `signInWithPassword()` call as every other login, then just checks `profiles.role === 'admin'` afterward.
- **Clerk auth integration appears partially built/abandoned** — server-side token verification supports it, but the actual login form doesn't use it; worth a direct, dedicated look before building anything on top of it.
- **Subscription-payment webhook failures aren't handled** (only Boost failures are) — a failed subscription charge leaves an orphaned `created`-status row with no cleanup or trainer notification. Not fixed this session, just documented.

## 23. Trainer Free Trial + Client Subscription + Gym Hiring Posts (follow-on session)

This is the financial/business-model change flagged as pending in §0 item 4 / §22. Built and deployed across three phases in one continuous follow-on session, plus several live-bug fixes found via a full feature audit partway through. **Read this whole section before touching payments, `auth.js`, or any `gym-*`/`bookings.html`/`pricing.html`/`onlifit.html` file.**

### 23a. Revenue model as built

| Product | Price | Billing | Who pays |
|---|---|---|---|
| Trainer subscription (unchanged) | Pro ₹999/mo, Elite ₹2,999/mo | Recurring, manual renewal | Trainers |
| Boost (unchanged) | ₹499/3-day, ₹999/7-day | One-time | Trainers |
| **Trainer free trial (new)** | Free | 90 days from signup, then must subscribe | New trainers only |
| **Client subscription (new)** | ₹499/month | Recurring, manual renewal | Clients — gates WhatsApp contact |
| **Gym hiring posts (new)** | ₹1,999 (1 post) / ₹2,999 (2) / ₹3,999 (3) | One-time, 30-day listing | Gym owners |

No commission on any client-trainer or gym-trainer transaction anywhere — Onlifit is never in the WhatsApp money flow, consistent with the pre-existing model in §22.

### 23b. Phase 1 — Trainer free trial (90 days, 5 leads/month cap)

**What it does:** every new trainer signup gets a 90-day free trial (`subscription_status='free_trial'`) instead of needing to pay immediately, capped at 5 client enquiries/month during the trial (vs. 30 for Pro).

**Database** (`supabase/migrations/20260802100000_free_trial_system.sql`, `20260802110000_fix_free_trial_status_constraint.sql`):
- `system_settings`: `free_trial_duration_days`=90, `free_trial_monthly_lead_cap`=5.
- `profiles`: new columns `free_trial_started_at`, `free_trial_expires_at`.
- `handle_new_user()` rewritten (verified against live prod definition first) to set these + `subscription_plan='free'`/`subscription_status='free_trial'` for new trainers only, everything else in the trigger unchanged.
- `try_create_client_enquiry()` extended with an `ELSIF` branch enforcing the free-trial cap, reading `free_trial_monthly_lead_cap` live — Pro-plan branch and all idempotency/dedup logic byte-for-byte unchanged.
- **A real bug was caught and fixed mid-session:** `profiles_subscription_status_check` didn't originally allow `'free_trial'` as a value, meaning **every new trainer signup was failing** for the short window between the first migration and the fix. Caught via a live test signup, fixed same session (constraint now allows `none/active/grace_period/expired/free_trial`).
- **Grandfathering:** `supabase/migrations/20260803010000_grandfather_trainer_free_trials.sql` — one-time backfill granting a fresh 90-day trial to the 10 pre-existing trainers who had neither a trial nor an active subscription (root cause of a real "0 trainers visible" incident — the free-trial `OR` clause added to `applyDiscoverabilityFilter()` made zero difference to trainers who signed up before this migration existed, since their `free_trial_expires_at` was `NULL`).

**Frontend:** `auth.js`'s `applyDiscoverabilityFilter()` now uses `.or('subscription_expires_at.gt.NOW,free_trial_expires_at.gt.NOW')` instead of a hard `.gt()` on subscription alone. `bookings.html` has a new `renderFreeTrialCard()` banner (days-remaining + lead-counter, upgrade prompt on exhaustion), inserted between the verification banner and the (new, see 23c) gyms-hiring banner.

### 23c. Phase 2 — Client ₹499/month subscription (WhatsApp gating)

**What it does:** clients need an active ₹499/month subscription to contact a trainer on WhatsApp; unsubscribed clients see a "Pay ₹499/month" prompt instead.

**Database** (`supabase/migrations/20260802120000_client_subscription_system.sql`): `system_settings.client_monthly_access_price_inr`=499; new `client_subscriptions` table (`status` CHECK `created/paid/failed`); `activate_client_subscription()` — idempotent, same renewal-extends-from-current-expiry math as trainer subscriptions.

**API** (new): `api/create-client-order.js`, `api/verify-client-payment.js`. **Webhook branch added** to `api/razorpay-subscription-webhook.js` (Boost → client_subscriptions → trainer subscription_payments, in that order).

**Frontend:** `auth.js` gained `getActiveClientSubscription()`, a page-load-scoped subscription-status cache (`refreshCachedClientSubscriptionStatus`/`getCachedClientSubscriptionStatus`), and the shared checkout function `startClientSubscriptionCheckout()` (moved here from `trainer-profile.html` mid-session so `billing.html` could reuse it too — same Razorpay-flow pattern as every other checkout in this codebase). `trainer-profile.html`'s `openBookingModal()` gates on subscription status; `trainers.html`'s trainer cards (via the shared `renderPremiumTrainerCardHTML()`) show a lock icon + "Pay ₹499" instead of the WhatsApp button when the cached status says unsubscribed. `billing.html` (previously an empty placeholder) now shows real subscription status/expiry/renew.

### 23d. Bug-fix interlude (found via live production testing between phases)

Two real, currently-live bugs were found and fixed while testing the above, unrelated to any single phase:
1. **Carousel click-hijacking on `onlifit.html`** — `initCarousels()`'s drag-to-scroll logic called `car.setPointerCapture()` on every `pointerdown`, including a plain tap, which silently ate clicks on the featured-trainer cards underneath. Fixed: capture now only engages after >5px of real movement.
2. **`getTrainers()`/`searchTrainers()` referenced `latitude`/`longitude` columns that don't exist in `profiles`** — every trainer-listing page load wasted one guaranteed-failing request (silently falling back to a working candidate) before succeeding, contributing to occasional 6-second-timeout empty results. Fixed by dropping the two columns from both functions' richest `select()` candidate.
3. **Elite plan price mismatch** — `pricing.html` showed ₹2,499 for Elite while checkout actually charged ₹2,999 (`system_settings.elite_plan_price_inr`). Root-caused to hardcoded marketing-page text (the exact risk flagged in §22, now actually triggered). Fixed by making `pricing.html` and `trainer-onboarding.html` load all prices live from `system_settings`.

None of these three touched trainer subscriptions, Boost, free trial, or client subscription logic — pure bug fixes, each independently committed and deployed (see §23f for commit hashes).

### 23e. Phase 3 — Gym Hiring Post system

**What it does:** gym owners sign up, post a hiring listing (1/2/3 positions, ₹1,999/₹2,999/₹3,999 one-time), which goes live for 30 days on a public job board; any trainer (or anyone, logged in or not) can browse and contact the gym directly on WhatsApp. **This replaced an earlier "city unlock" design** (pay once to unlock all trainer contacts in a city) that was scrapped mid-session in favor of the hiring-post model — `gym_owner_city_access` table/`activate_gym_owner_access()` function from that earlier design **still exist in the database but are dead/unused**, left in place rather than dropped (per explicit instruction) — do not build anything new on top of them, and don't be confused by their presence.

**Database:**
- `supabase/migrations/20260803020000_gym_owner_system.sql` (superseded design, kept for history): `gym_profiles` table (still live/used), `gym_owner_city_access` table (**dead, unused**), `gym_requirements` table (**dead, unused — the actual requirement-matching flow was never built this way**), `activate_gym_owner_access()` (**dead, unused**).
- `supabase/migrations/20260803030000_gym_hiring_posts.sql` (the real, live design): `system_settings` — `gym_1post_price_inr`=1999, `gym_2post_price_inr`=2999, `gym_3post_price_inr`=3999, `gym_hiring_post_duration_days`=30. New table `gym_hiring_posts` (status CHECK `draft/active/expired/failed`, `post_count` CHECK `1/2/3`, `employment_type` CHECK `full_time/part_time/both`, FK to both `profiles` and `gym_profiles`) + partial index `idx_gym_hiring_posts_active` on `(status, expires_at DESC) WHERE status='active'`. New function `activate_gym_hiring_post()` — idempotent on `razorpay_payment_id`, sets `status='active'`, `posted_at=now()`, `expires_at=now()+30 days` (duration read live from `system_settings`).
- `handle_new_user()` needed **no changes** for the `gym_owner` role — confirmed by walking every branch: they all check specifically `role='trainer'` with `ELSE NULL`, so `gym_owner` already falls through identically to `client`, and `account_status`/`onboarding_completed` were never in that `INSERT`'s column list, so both already come from table defaults (`'active'`/`false`) — exactly what was needed.
- One real trigger-related gotcha hit again this session (same class of issue as Phase 1's constraint bug): `trg_enforce_verification_admin_only` blocked a raw SQL seed insert outside an authenticated session — had to be temporarily disabled/re-enabled around that one statement (documented technique, not a new pattern).

**API** (new): `api/create-gym-signup.js` (rate-limited 3/IP/hour, same in-memory `Map` pattern as `create-ticket.js`; creates the `auth.users` row server-side via `auth.admin.createUser()` — the **only** place in this codebase that does that, since normal signup is a direct client-side `supabaseClient.auth.signUp()` call with no server hop to rate-limit at; cleans up the orphaned auth user via `auth.admin.deleteUser()` if the subsequent `gym_profiles` insert fails), `api/create-hiringpost-order.js`, `api/verify-hiringpost-payment.js`. **Webhook branch added** to `api/razorpay-subscription-webhook.js`, inserted after the `gym_owner_city_access` branch (dead code, kept for the reasons above) and before the trainer `subscription_payments` fallback.

**New pages:**
- `gym-landing.html` — public marketing page. Nav/footer/fonts copied verbatim from `pricing.html`'s exact boilerplate. Copy updated mid-session from an initial "city unlock" pitch to the final hiring-post model ("Post a Job, Let Trainers Come to You"). 3-tier pricing cards, all loaded live from `system_settings` (`loadLiveGymPostPrices()`).
- `gym-onboarding.html` — signup form (gym name, owner name, city [Hyderabad only for now], locations, phone, email, password), posts to `api/create-gym-signup.js`, then calls `supabaseClient.auth.signInWithPassword()` itself (the signup endpoint never returns a session token by design) and redirects to `gym-dashboard.html`. Styled with `login.html`'s exact `.auth-shell`/`.auth-card`/`.auth-input`/`.primary-btn`/`.notice` classes verbatim, plus a few new supporting classes (`.auth-field`/`.auth-label`/`.auth-row`) since this form needs visible labels across 7 fields, unlike `login.html`'s placeholder-only inputs.
- `gym-jobs.html` — public job board (no auth required). Filter by speciality/employment-type/experience (client-side, in-memory, same pattern as `trainers.html`). Cards link to `gym-job-detail.html?id=...`. Only shows `status='active' AND expires_at > now()`.
- `gym-job-detail.html` — single listing detail + prominent WhatsApp CTA with a prefilled message. Handles not-found/expired as one unified state. Nav/footer/head copied verbatim from `gym-jobs.html`.
- `gym-dashboard.html` — gym owner's own dashboard. Sidebar copied class-for-class from `bookings.html`'s `#trainer-sidebar-panel`. Sections: Overview (stats + welcome card), Post a Job (post-count/price selector + job fields + Razorpay checkout via the new `startGymHiringCheckout()`), My Posts (status badges: Live/Draft/Expired + repost link), Settings (edit `gym_profiles` row). Auth-gated via `requireAuth('gym_owner', ...)`.
- **`auth.js` additions:** `normalizeUserRole()`/`getDashboardPathForRole()` extended with a `gym_owner` branch (`→ gym-dashboard.html`) — this was a real, confirmed gap (gym owners logging in through the general `login.html` would previously land on `client-dashboard.html`); `requireAuth()` itself needed no change, since it does a plain string comparison with no role allow-list. New shared function `startGymHiringCheckout()`, added immediately after `startClientSubscriptionCheckout()`, identical pattern (`{ orderBody, onSuccess, statusId }`), posts to `create-hiringpost-order`/`verify-hiringpost-payment`.

**Existing pages updated:**
- `onlifit.html` — "For Gyms" nav link (desktop + mobile, styled identically to existing links) → `gym-landing.html`; "Are you a trainer? See who's hiring →" link in the featured-trainers section → `gym-jobs.html`.
- `bookings.html` — new `#gyms-hiring-banner` (shown to trainers only, count of active hiring posts + "Browse Jobs →" link to `gym-jobs.html`), inserted between the free-trial banner and the Subscription card, same banner shape as the others on this page.
- `admin-dashboard.html` — **planned but not yet applied as of this handoff** (see §23g).

### 23f. Git state — what's committed, what isn't

**Committed and pushed** (confirmed live via GitHub commit-status API after each push):
```
1c1a90f  Phase 1 — free trial system for trainers
5ba967a  Phase 2 — client subscription system
31ed5e3  Fix — remove non-existent latitude/longitude columns (Boost of bug-fix interlude)
1f2d4d0  Homepage — add Browse All Trainers button
0b93d09  Fix — carousel click hijacking
7efaad2  Fix — load plan prices dynamically from system_settings
```

**On disk, uncommitted, needs a commit** (this is everything from Phase 3 §23e — the migration was applied to production Supabase directly via MCP, same as every prior phase, so the *database* is live and correct; only the git record is missing):
```
supabase/migrations/20260803020000_gym_owner_system.sql
supabase/migrations/20260803030000_gym_hiring_posts.sql
api/create-gym-signup.js
api/create-gymowner-order.js
api/create-hiringpost-order.js
api/verify-gymowner-payment.js
api/verify-hiringpost-payment.js
api/razorpay-subscription-webhook.js   (modified — gym hiring post branch added)
auth.js                                (modified — startGymHiringCheckout, gym_owner role support)
gym-landing.html
gym-onboarding.html
gym-jobs.html
gym-job-detail.html
gym-dashboard.html
onlifit.html                           (modified — For Gyms nav, hiring link)
bookings.html                          (modified — gyms-hiring banner)
```
Also still uncommitted from **before** this session even started (pre-existing, unrelated, carried forward across many handoffs — see §2 of the historical record below): `client-dashboard.html`, `my-trainers.html`, `privacy.html`, `settings.html`, `terms.html`, `trainer.html`, and this file (`PROJECT_HANDOFF.md`) itself.

**Exact commit command for everything in §23** (Phase 3 files only — deliberately excludes the pre-existing unrelated uncommitted files listed above, same discipline as every prior phase's commit in this session):
```bash
git add supabase/migrations/20260803020000_gym_owner_system.sql \
        supabase/migrations/20260803030000_gym_hiring_posts.sql \
        api/create-gym-signup.js \
        api/create-gymowner-order.js \
        api/create-hiringpost-order.js \
        api/verify-gymowner-payment.js \
        api/verify-hiringpost-payment.js \
        api/razorpay-subscription-webhook.js \
        auth.js \
        gym-landing.html \
        gym-onboarding.html \
        gym-jobs.html \
        gym-job-detail.html \
        gym-dashboard.html \
        onlifit.html \
        bookings.html

git commit -m "Phase 3 — gym hiring post system (₹1,999/₹2,999/₹3,999, job board, gym dashboard)"
```
**Not pushed** — same standing hold as every prior phase in this session; push only when the user explicitly says so again.

### 23g. What's still left before Phase 3 can be called complete

1. **`admin-dashboard.html` updates — planned, not yet written.** New "Gyms" tab (nav item + tab-content + `loadGyms()` function, following the exact existing per-tab convention): gym owner signup count, active hiring post count, hiring post payments list. Full before/after was reviewed and approved in-chat but not yet applied to the file as of this handoff — do this first in the next session if picking this up.
2. **No end-to-end payment test performed** — same structural gap as every prior phase in this repo's history (no real/test Razorpay credentials available in this environment, ever). `create-hiringpost-order.js`/`verify-hiringpost-payment.js`/`startGymHiringCheckout()` are code-complete and internally consistent but never exercised against a real Razorpay checkout.
3. **`create-gym-signup.js`'s rate limit is in-memory** — resets on every cold serverless invocation, same known limitation as `create-ticket.js`'s identical pattern (documented there already, not new to this session).
4. **No live browser walkthrough of the full gym flow** (signup → post a job → pay → see it on the job board → a trainer clicks through and WhatsApps) — verified piece-by-piece via code review and direct DB checks, not as one continuous real click-through.

### 23h. Known issues / watch-outs for a fresh session

- **`gym_owner_city_access` and `gym_requirements` tables, and `activate_gym_owner_access()`, are dead code from a scrapped earlier design.** Don't extend them; don't be confused if you see them in a schema dump. The live design is `gym_hiring_posts` + `activate_gym_hiring_post()`.
- **The free-trial constraint bug (§23b) is a pattern worth remembering:** any time a new enum-like value is introduced for an existing `CHECK`-constrained column, verify the constraint was actually updated to allow it — this broke all new trainer signups for a real (if short) window before being caught.
- **The admin-only verification trigger (`trg_enforce_verification_admin_only`) will block raw SQL writes to `verification_status` outside an authenticated admin session** — if you ever need to script-seed verified data again, the pattern is: `ALTER TABLE profiles DISABLE TRIGGER trg_enforce_verification_admin_only;` → do the write → `ALTER TABLE profiles ENABLE TRIGGER trg_enforce_verification_admin_only;` immediately after, in the same breath.
- **`styles.css` is still a frozen precompiled Tailwind snapshot** (documented repeatedly in prior sessions) — every new page/component built this session used only classes already proven to exist in it, or hand-written CSS where a new visual pattern was needed (e.g. `gym-dashboard.html`'s `.post-count-card`).
- **Fifteen synthetic seed trainers exist in production** (`@test.onlifit.in` emails, `ui-avatars.com` photos) — created earlier in this session to populate an empty marketplace for visual testing. They have real `auth.users` rows with unusable random passwords (can't practically log in) but are otherwise indistinguishable from real trainers in every query. Consider whether these need to be removed before a real public launch.
