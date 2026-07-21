# Project Handoff — Onlifit
*Last updated: end of the Phase 2 Lead Management / Trainer CRM foundation session (database + enhanced enquiry flow), tagged `v1.2.0-lead-crm-foundation`. This file supersedes all prior handoff notes. Read this file, `DATABASE_MIGRATION_PLAN.md`, `MIGRATION_HISTORY.md`, `IMPLEMENTATION_ROADMAP.md` and the five deployment docs listed in §12 before doing anything else.*

## 0. Read This First — Next Session Starting Point

**The single most important open question, carried forward and reconfirmed this session:** Vercel deployment status is still unconfirmed and this session directly verified it's stale. Live-checked `https://www.onlifit.in/trainer-profile.html` against production Supabase data during this session's smoke test and found it is **still serving the pre-Phase-2 build** — the old date/time booking modal (`#booking-date` present in the live DOM) rather than the new enquiry form (`#enquiry-name` absent). This means **not just Phase 2, but potentially the earlier `5ace2e9`/`43d0c27`/`50c65e9` commits from the previous session may also still be unconfirmed live** — no Vercel access exists in this environment (see §11), so deployment cannot be triggered or verified from here. **First action next session: confirm via the Vercel dashboard (or ask the user) which commit is actually live, trigger a redeploy if needed, then re-run the full smoke test in §9a against whatever is actually serving traffic.**

**Second open item, unresolved and unverifiable this session for the same reason:** an earlier session found `trainers.html`/homepage returning "0 trainers found" in production with a slow-query console warning. Still never re-verified against a confirmed-current deployment — see §9.

## 1. Project Overview

**What Onlifit is:** A two-sided marketplace connecting clients with independent personal trainers across India, online or in-person. Trainers set their own rates; clients discover trainers by search/goal/location and contact them directly on WhatsApp (no in-app messaging). Revenue comes from trainer subscriptions (Pro/Elite via Razorpay) and, as of this session, one-time "Boost" visibility purchases — **not** per-booking commission.

**Design philosophy:** Minimal, high-contrast black/white/gray palette (M3-inspired token names), Poppins headlines + Inter body, restrained "premium SaaS" aesthetic. Homepage V3 (`onlifit.html`) is the design-system reference for the whole site.

**Current phase:** Feature-complete for launch on the core marketplace + Boost + payment-gated onboarding. Just pushed a Release Candidate through a full audit → blocker fixes → deployment → smoke test → UX polish cycle. Not yet confirmed fully live/verified end-to-end in production — see §0.

## 2. Git Status (as of this handoff)

- **Branch:** `main`
- **Remote:** `origin` → `https://github.com/onlifitapp-lab/onlifitsite.git`
- **Push status:** all commits through `50c65e9` are pushed and confirmed present on `origin/main` (`git ls-remote origin main` returns `50c65e9...`, matching local `HEAD` exactly).
- **Working tree:** 5 untracked files, **not committed, not pushed**:
  `DEPLOYMENT_CHECKLIST.md`, `DEPLOYMENT_GUIDE.md`, `OPERATIONS_RUNBOOK.md`, `RELEASE_NOTES_v1.md`, `SMOKE_TEST_CHECKLIST.md` — all written this session (§12), never staged since they weren't explicitly requested to be committed. Decide next session whether to commit these.

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

1. **CONFIRMED THIS SESSION: Vercel production does NOT yet serve the Phase 2 build**, and by extension its status for the prior 3 commits (`5ace2e9`, `43d0c27`, `50c65e9`) remains unconfirmed too — see §0 and §9a. This is the first thing to check next session, now with direct evidence instead of just suspicion.
2. **UNRESOLVED: live production search showed "0 trainers found"** on both `trainers.html` and the homepage during a smoke test, with a recurring `Supabase trainers query took >2.5s. Returning cached/empty and continuing fetch in background.` console warning on every page load. This was found *before* the `onboarding_completed` filter (§4g) was added to the same query functions — that later change was verified safe against a snapshot of production data at the time, but the combination (pre-existing slow-query symptom + a new filter on the same query) has **not been re-verified live**. This is the highest-priority thing to re-test once deployment status (#1) is confirmed.
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

## 14. Recommended Next Session Order

1. Confirm actual Vercel deployment state (dashboard or authenticated CLI) — this session found production is **still serving the pre-Phase-2 build** (§0), so this is now more urgent than before, not less.
2. Once a current deployment is confirmed, re-run the search smoke test (`trainers.html`, homepage) — "0 trainers found" (§9) has never been re-verified against a build that's actually confirmed current.
3. Re-run §9a (this session's Phase 2 smoke test) end-to-end against the live UI once deployment is confirmed — this session could only verify the new enquiry flow at the database/RPC layer plus static/isolated-harness UI testing, not a real authenticated click-through in production (see §9a for exactly what was and wasn't covered).
4. Complete the rest of `SMOKE_TEST_CHECKLIST.md` (auth, onboarding, payments) with real or test credentials if available.
5. Decide on the 5 previously-uncommitted deployment docs — now committed as of `v1.2.0-lead-crm-foundation` (§15), so this is resolved, not open.
6. Raise the `'Trainers Kyc'` dead-bucket cleanup and the 7 orphaned onboarding fields as their own scoped decisions, per standing recommendation.
7. **Next milestone: Phase 3 — Trainer Lead Dashboard.** Build the trainer-facing Leads view (KPI cards, search/filter, lead cards, detail drawer with timeline/notes/status/follow-up) as a new route inside `bookings.html`'s existing SPA router, per the architecture agreed in §15. Do not start this until items 1–3 above are resolved — there is limited value in building on top of a foundation that hasn't been confirmed live.

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
