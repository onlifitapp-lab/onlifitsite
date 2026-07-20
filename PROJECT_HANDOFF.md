# Project Handoff — Onlifit
*Last updated: 2026-07-18, end of Feature Completion planning session (before any Boost/taxonomy/support code was written)*

## 0. Read This First

This file, `DATABASE_MIGRATION_PLAN.md`, and `IMPLEMENTATION_ROADMAP.md` together replace all prior handoff notes. **No migrations have been applied. No Boost/taxonomy/support/blog-CMS code has been written.** The last session ended at a proposal stage — 7 migrations were proposed and two design questions were answered by the user, but the user then paused all further code/commits/pushes to have this documentation written instead. The next session's first job is to get explicit go-ahead on the migration plan, then execute in the order in `IMPLEMENTATION_ROADMAP.md`.

## 1. Project Overview

**What Onlifit is:** A two-sided marketplace connecting clients with independent personal trainers across India, for online or in-person sessions. Trainers set their own rates; clients discover trainers by search/goal/location, contact them directly on WhatsApp (no in-app messaging), and book/pay through the platform. Revenue comes from trainer subscriptions (free/pro/elite tiers via Razorpay), not per-booking commission. A "Boost" (paid temporary visibility) feature is planned but not yet built — see `DATABASE_MIGRATION_PLAN.md` and `IMPLEMENTATION_ROADMAP.md`.

**Current phase:** Transitioning from "UI polish" to "feature completion." Three major features are approved-in-concept but not started: Boost payments, an expanded search taxonomy, and a support-ticket widget (AI chat deferred — see decisions below).

**Design philosophy:** Minimal, high-contrast black/white/gray palette (M3-inspired token names: `primary`, `on-surface`, `outline-variant`, etc.), Poppins for headlines + Inter for body, restrained "premium SaaS" aesthetic (Airbnb/Stripe/Linear reference points). Homepage V3 borrowed **structural/UX patterns** (not visuals) from Superprof.com. **Homepage V3 is the design-system reference for the whole site** — every other page should match its logo, nav, spacing, colors, buttons, radius, shadows, typography, icon, and card conventions (this was explicitly restated in the most recent polish session — do not let other pages drift from it).

## 2. Git Status (as of this handoff)

- **Branch:** `main`
- **Working tree:** clean, nothing uncommitted
- **10 commits ahead of `origin/main`, none pushed:**
  ```
  2401f0a feat: rewrite search ranking as a weighted score, not a tier ladder
  5b06be7 fix: trainer onboarding missing 6 goal tags promised by homepage/trainers.html
  b7ba32f fix: pricing.html — dead Boost buttons and false marketing claims
  9543109 fix: homepage hero search icon overlap + red testimonial dot
  7e728eb fix: trainer onboarding wrote to nonexistent session_mode column
  f207898 chore: remove debug console.log trail from auth/OAuth flow
  0e64c82 fix: admin-dashboard.html fired data queries before auth check settled
  59212dc fix: trainer location field couldn't be edited after onboarding
  1705bbf fix: pricing.html mobile nav, missing script, and dead CSS rules
  f01376f fix: client-dashboard.html completely broken — two real syntax errors
  ```
  (Earlier, already-pushed history: `6545bb6` trainer-profile.html redesign, `5e9ffc6` docs, `af845d1` trainers.html redesign, `0707b82` mobile nav fix, `1bd7902` Homepage V3.)
- **Explicit instruction from the user: do not push these 10 commits until told to.**
- **Files changed across the 10 unpushed commits** (10 files, 198 insertions / 101 deletions total):
  `admin-dashboard.html`, `auth.js`, `bookings.html`, `client-dashboard.html`, `login-google.js`, `onlifit.html`, `pricing.html`, `settings.html`, `styles.css`, `trainer-onboarding.html`.

## 3. Completed Work (chronological, across this whole arc)

### 3a. Homepage V3 (`1bd7902`, pushed)
Full rebuild of `onlifit.html`: condensed hero, new "Popular Fitness Goals" chip row (Weight Loss, Muscle Gain, Strength, Yoga, CrossFit, Powerlifting, Calisthenics, Running, Home Workout, Women's Fitness — wired to real search), Featured Trainers moved up with 4:3 photo-first cards, relabeled "How Onlifit Works" steps, Onlifit Black section (fixed a real bug where it could show duplicate trainers already in Featured), richer testimonials with joined client/trainer data, contrast fix on "Become a Trainer" section, new FAQ, footer opt-out flag added. This is the **design-system reference** for the rest of the site.

### 3b. Site-wide mobile nav overflow fix (`0707b82`, pushed)
Root cause: `renderAuthNav()` in `auth.js` rendered a fixed-width desktop auth block into every page's nav with no responsive collapse; only the homepage had a guard. Centralized fix: the logged-in/guest nav markup now collapses to icon-only 44×44px controls below 640px. Fixed the same class of bug on 13+ pages from one function change, plus added a mobile hamburger to `trainers.html`.

### 3c. `trainers.html` redesign (`af845d1`, pushed)
Homepage-vocabulary goal chips, client-side price/rating filters, Onlifit Black pill toggle, trust strip, differentiated empty states, fixed a real bug where "Most Experienced" sort was comparing `NaN - NaN` on a free-text field (silently never sorted), removed ~9 dead functions, accessibility pass, and found+fixed a desktop grid bug (a **duplicate** `.md\:grid-cols-2` CSS rule, hand-patched into `styles.css` at some earlier point, sat *after* `.lg\:grid-cols-3` in file order and won the cascade at all widths ≥1024px — removed the one duplicate line).

### 3d. `trainer-profile.html` redesign (`6545bb6`, pushed)
Fixed a real conversion bug: the header "Contact / Book" CTA silently did nothing if no plan was pre-selected (`if (!selectedPlan) return;`). New `handlePrimaryCta()` now auto-selects a plan (opens booking directly if only one plan exists, scrolls + highlights if multiple, scrolls to pricing if none set). Added a sticky mobile action bar. Fixed two more real CSS bugs found during QA: `.lg\:sticky` and `.lg\:hidden` had no compiled rules in `styles.css` at all — the pricing sidebar never actually stuck, and (if untouched) the new sticky mobile bar would have shown on desktop too. Added modal accessibility (`role="dialog"`, focus management, Escape-to-close), visible disabled-button states, and a trust-building reviews empty state using only real trainer fields (no fabricated reviews).

### 3e. Production QA session 1 (`f01376f` → `f207898`, unpushed)
Four parallel background audits (auth flows, settings/uploads, dashboards/admin/nav, sitewide dead-code sweep) found:
- **CRITICAL, confirmed via `node --check`:** `client-dashboard.html`'s main script had **two separate genuine `SyntaxError`s** — a `catch` block with no matching `try` (from a prior edit that deleted the try-block and the actual auth-check logic along with a bug it was fixing, per an in-code comment), and `document.getElementById(...)?.innerHTML = '...'` (optional chaining cannot be an assignment target). **The entire script block failed to parse in every browser** — not just the dashboard init, but every function in that block, including the sidebar toggle (this fully explains a "sidebar-toggle didn't open, maybe a sandbox artifact" note from an even earlier handoff — it wasn't an artifact, the whole script was dead). Fixed both; restored the auth guard using the same `requireAuth('client', ...)` helper `bookings.html` already used correctly. Verified live against production Supabase: anonymous visitors now correctly redirect to `login.html`.
- `client-dashboard.html` had its own hand-written `<footer>` with no `data-hide-global-footer` flag → duplicate footer content injected by `footer-component.js`. Fixed.
- `pricing.html` had zero mobile nav fallback (no hamburger) and never loaded `supabase-client.js` at all (so `getCurrentUser()` silently fell through to a Clerk fallback path on every load). Both fixed.
- Trainer `location` field could be set at onboarding but had no edit UI anywhere afterward — added to both `settings.html` and `bookings.html`'s own (separate, duplicated) settings tab.
- `admin-dashboard.html`'s `loadDashboard()` fired admin data queries even when the auth check failed (redirect doesn't halt script execution) — gated behind `window.adminUser`.
- Extensive debug `console.log` trail in `auth.js`/`login-google.js` running on every login/signup for every user — removed (kept `console.error`/`console.warn`).
- Ran `node --check` against **every inline `<script>` block on every page plus every standalone `.js` file** — found zero other syntax errors sitewide (this is the strongest sitewide correctness check performed this arc).

### 3f. Production QA session 2 (`7e728eb`, unpushed)
Live schema introspection against production Supabase found `trainer-onboarding.html` was writing to `session_mode`, **a column that has never existed** (real column: `training_mode`, used everywhere else). It didn't hard-fail — a schema-fallback retry loop (`updateProfileWithSchemaFallback`) silently strips unknown columns and retries — so onboarding "succeeded" but `training_mode` has never actually been saved for any trainer who has ever onboarded. Fixed the one-line key mismatch (no schema change needed, `training_mode` already existed). **Six more onboarding payload keys point at columns confirmed not to exist** (`training_approach`, `kyc_id_type`, `kyc_id_number`, `response_time`, `teaching_style`, `training_focus`, `profile_live`) — **flagged, not fixed**, since each needs either a real migration or a product decision to remove the corresponding form field. Still outstanding — see §13.

### 3g. Product Polish sprint (`9543109` → `2401f0a`, unpushed)
- **Hero search icon overlap** (homepage): measured live — icon and typed text only 8px apart. Fixed the input padding, then discovered a sitewide `mobile-optimizations.css` rule (`input[type="text"] { padding: 12px 16px }` under 768px) silently collapsed the fix back down on mobile — exactly where the bug was most visible. Added a scoped override so the fix holds on mobile too.
- **Red pagination dot** on testimonials carousel: a CSS custom property (`--primary`) was never defined anywhere, so its fallback color (`#ff5a5f`, a coral/red not in Onlifit's palette) was always what rendered. Fixed to the real theme black.
- **Investigated the "Boost" feature before touching it**, per instructions: confirmed the "Buy Boost" buttons have zero `onclick`/handler, the "1 free day of Boost on signup" claim has zero backing logic, and — most importantly — the "How Search Ranking Works" box (Boosted > Elite > Pro > Free) was **false**: the real ranking function only ever used rating/reviews/completion/activity, no tier or boost signal at all. Fixed the dead buttons (disabled "Coming Soon" state), removed the false free-day claim, rewrote the false "14-day Pro trial" FAQ, and rewrote the false ranking-tier copy to describe the actual algorithm — all copy/UI fixes, no fake payment infrastructure built.
- **6 homepage/trainers.html goal chips had no matching onboarding checkbox** (CrossFit, Powerlifting, Calisthenics, Running, Home Workout, Women's Fitness) — a trainer could never tag themselves with these terms, so those chips could return zero real results. Added the 6 checkboxes using the existing flexible `tags` array — no schema change.
- **Rewrote `compareTrainersForRanking()`** as a weighted point score (not a tier ladder) — see §9 below for the full algorithm. This was committed as real, working code (not a proposal) because it needed no schema change and is fully backward-compatible (reads `boost_expires_at`/`response_rate` defensively; both are always `undefined` today and contribute 0 until their migrations land).

### 3h. Feature-completion planning (this session, no code written)
User wants Boost, ranking (done, see above), search taxonomy, and a support system **built**, not removed. Live schema was pulled from production before proposing anything (`list_tables` via the Supabase MCP tool — this session has real, working access to apply migrations directly, not just draft SQL files). Found `support_tickets` + `ticket_messages` + `ticket_attachments` **already exist in full** with threading, attachments, and status — no migration needed there. Presented a 7-migration proposal (`DATABASE_MIGRATION_PLAN.md`). User answered two design questions:
- **AI chat assistant: deferred.** Build the ticket creation/threading/admin-reply flow using the existing tables; add AI later once a provider/API key is chosen.
- **Taxonomy shape: "Services" gets its own `services text[]` column (not folded into `tags`); "Availability" becomes real structured scheduling (`availability jsonb`, days + time-of-day, not full calendar slots).**

Then the user paused everything to have this documentation written before any migration is applied or further code is written.

## 4. Current Project Architecture

- **Stack:** Static HTML pages (no build step, no framework) + vanilla JS + Supabase (Postgres + Auth + Storage) + Razorpay (subscriptions only, currently) + Clerk (fallback/legacy auth path referenced in `auth.js`, not the primary flow).
- **`auth.js`** is the shared library loaded on every page: `getCurrentUser()`, `requireAuth()`, `getTrainers()`/`getTrainerById()`, `renderAuthNav()`, the shared trainer-card renderer (`renderPremiumTrainerCardHTML` + helpers), badge/verification logic (`normalizeTrainerBadges`), and now `compareTrainersForRanking()`/`scoreTrainerForRanking()`.
- **`supabase-client.js`** initializes `window.supabaseClient`/`window.supabase` with a hardcoded (intentionally public) anon key — must be `<script src>`'d before `auth.js` on every page, or `getCurrentUser()` silently falls through to a broken Clerk-fallback path (this exact bug was found and fixed on `pricing.html` this arc — worth spot-checking other pages if odd auth warnings appear).
- **`footer-component.js`** auto-injects a footer into any page's `<footer>` element unless `data-hide-global-footer="true"` is set on `<body>`. Two pages currently opt out (`onlifit.html`, `client-dashboard.html`); other pages with no `<footer>` element get a safe auto-generated one instead — not a bug for those.
- **`styles.css` is a stale, hand-patched compiled Tailwind snapshot from 2026-04-17, NOT a live build.** No `@tailwindcss/cli` in this environment, no network access to install it. Every new Tailwind class used in HTML that wasn't in use back then silently does nothing until manually hand-patched in. **This has caused multiple real, confirmed production bugs this arc** (the trainers.html grid duplicate-rule bug, the trainer-profile.html sticky/hidden-class bugs, the pricing.html scale bug). The fix pattern is well-established now: derive the compiled rule format from an existing similar rule in the same file, append it, verify via `document.styleSheets` in a real browser — never trust plain string-matching in a shell command due to backslash-escaping issues. **Fixing this properly (a real build pipeline) remains unscoped infrastructure debt.**
- **Two separate, duplicated trainer-settings UIs exist**: `settings.html` (standalone page) and `bookings.html`'s embedded Settings tab (the trainer's actual dashboard). Both were kept in sync for the `location` field fix this arc, but this duplication is itself technical debt — any future settings field needs to be added to both, or the duplication should be resolved (shared component, or retire one of the two).
- **`bookings.html` is the trainer's dashboard** (page title: "Trainer Dashboard") — not a separate `trainer-dashboard.html` file. `client-dashboard.html` is the client's dashboard.

## 5. Homepage (`onlifit.html`) Status

Fully redesigned (V3) and further polished this arc (search icon overlap fixed, red dot fixed). This is the **design-system reference** for the rest of the site — other pages should match its logo/nav/spacing/colors, not diverge. No outstanding known bugs on the homepage itself. The "How Onlifit Works" section (interactivity/animation polish) and testimonials count/carousel improvements were requested in the polish sprint but **not done** — explicitly deferred due to time, not because they're low priority.

## 6. `trainers.html` Status

Fully redesigned. Goal chips now match the homepage vocabulary (10 terms + All) and are backed by real onboarding tags (the 6-tag gap was closed this arc). Price/rating filters, Onlifit Black toggle, trust strip, and the "Most Experienced" sort bug are all fixed and verified. Desktop grid CSS bug fixed. No known outstanding bugs.

## 7. `trainer-profile.html` Status

Fully redesigned. Primary CTA bug fixed and verified live against production data (both the multi-plan-select and single-plan-auto-open paths). Sticky mobile CTA bar added. Two real CSS bugs (`lg:sticky`, `lg:hidden`) fixed. Modal accessibility added. Reviews empty state now trust-building instead of a dead end. No known outstanding bugs.

## 8. Navigation Fixes (site-wide)

Centralized fix in `renderAuthNav()` (see §3b) resolved mobile overflow on every page using it. Individually verified per-page since: `client-dashboard.html`'s entire nav (and everything else on the page) was actually dead due to the syntax errors in §3e — now fixed and the anonymous-redirect path verified live. `pricing.html`'s missing hamburger fixed. No other known nav bugs, but **not every page has been individually re-verified live this session** — see §14.

## 9. Ranking Algorithm — IMPLEMENTED (not just proposed)

`compareTrainersForRanking()` in `auth.js` was rewritten as a weighted point score (max ~100), not a strict tier ladder — a strict ladder would let a boosted 1-star trainer outrank a non-boosted 5-star trainer, directly violating "paid features should never completely override quality." Full breakdown (also documented inline in the code):

**Quality signals — 71 pts max (attainable by every trainer, paid or not):**
- Rating: 0–25 (`rating/5 * 25`)
- Review count: 0–15, log-scaled (`log10(reviews+1) * 7`, capped at 15)
- Profile completion: 0–15 (`profile_completion_score/100 * 15`)
- Recent activity: 0–10 (full marks within 7 days, decays to 0 by 90+ days inactive)
- Experience: 0–6 (years parsed from the free-text `experience` field, capped at 10+ years)

**Paid/status signals — 26 pts max:**
- Verified trainer: +8 flat (`verification_status === 'approved'`)
- Active boost: +10 flat — **dormant today**, reads `t.boost_expires_at` which doesn't exist as a column yet; always contributes 0 until migration #1 in `DATABASE_MIGRATION_PLAN.md` lands, then activates automatically with no further code change
- Subscription tier: free=0, pro=+4, elite=+8

**Dormant — 3 pts max:**
- Response rate: 0–3 — **dormant today**, no `response_rate` column exists; same auto-activation pattern

Verified with concrete test scenarios (not just theory): a 5-star trainer with 120 reviews scores ~71; a 1-star trainer who is verified, boosted, AND on Elite scores ~47 — quality wins decisively. Among two *similar-quality* trainers, boost + Pro does give a real edge (tested: 65.7 vs 78.4) — so paid features aren't purely cosmetic either. This is genuinely done and committed (`2401f0a`), not a proposal — no further ranking work needed unless the weights themselves need retuning after real usage data exists.

## 10. Search Taxonomy — PROPOSED ONLY, not built

See `DATABASE_MIGRATION_PLAN.md` for the full migration list. Summary: Goals/Training Mode/Specializations/Location already have real columns and don't need new ones. Three new facets need new columns per the user's explicit design decision: `services text[]`, `languages text[]`, `target_audience text[]`, plus `availability jsonb` (days + time-of-day shape, not full calendar slots). None of these migrations have been applied. Once applied, every one of these pages needs updating and must stay synchronized: `trainer-onboarding.html` (capture), `settings.html` + `bookings.html` settings tab (edit after onboarding — remember, two duplicated UIs), `trainers.html` (filter UI), `onlifit.html` (if these become homepage filter facets too — not yet decided), `trainer-profile.html` (display), and the shared trainer-card renderer in `auth.js` (display on cards).

## 11. Boost System — PROPOSED ONLY, not built

See `DATABASE_MIGRATION_PLAN.md`. Summary: `profiles.boost_expires_at` (denormalized fast-read, mirrors the existing `subscription_expires_at` pattern) + a new `boost_purchases` table (payment audit trail, mirrors the existing `subscription_payments` table pattern). Ranking algorithm already reads `boost_expires_at` defensively and will activate automatically once the column exists — no ranking code changes needed when this ships. Still needed: `api/create-boost-order.js`, `api/verify-boost-payment.js`, a webhook (extend the existing Razorpay subscription webhook or add a new one), re-enabling the "Buy Boost" buttons on `pricing.html` (currently disabled "Coming Soon"), and a `bookings.html` dashboard section showing active boost + remaining time + automatic expiry.

## 12. Payment Architecture (existing, real, working)

Razorpay subscription payments (Pro/Elite plans) have real backend code in this repo: `api/create-subscription-order.js`, `api/verify-subscription-payment.js`, `api/razorpay-subscription-webhook.js`, backed by the `subscription_payments` and `subscriptions` tables (both real, confirmed via live schema query). This is a working precedent to follow for Boost payments — same shape, new table/columns. **Boost has zero backend wiring today** — see §11.

## 13. Blog CMS Status

**Admin CRUD is already fully functional** — `admin-dashboard.html` has real create/edit/delete/publish/unpublish wiring against a real `blog_posts` table (confirmed via code, not a mockup). `blog_posts` already has `slug`, `title`, `category` (singular), `image`, `description`, `content`, `read_time`, `is_published`. **Missing, per the user's explicit ask:** SEO fields (`meta_title`/`meta_description`) and a way to link related trainers for the "Find Trainer" CTA (`related_trainer_ids`) — see migration #7 in `DATABASE_MIGRATION_PLAN.md`. Not yet live-tested as an actual logged-in admin (no credentials available in this environment) — code inspection only.

## 14. Support Ticket Architecture (mostly exists already)

`support_tickets` (subject, category, priority, status: open/in_progress/resolved/closed, assigned_to) + `ticket_messages` (threaded replies, `is_internal` flag for admin-only notes, `attachments` jsonb) + `ticket_attachments` — all real, all already exist, confirmed via live schema query. `support.html` already POSTs to a real `/api/create-ticket` endpoint (rate-limited: 3 tickets per 15 minutes). **What's actually missing:** a floating widget UI (currently just a standalone form page, no bubble/launcher on other pages), and admin-side reply/resolve/close UI in `admin-dashboard.html` (not yet built or verified). AI chat layer explicitly deferred by the user — build ticket flow only, add AI later once a provider is chosen.

## 15. Storage Buckets & Upload Pipeline

Covered in an earlier QA session (not re-verified this session): avatar upload (`uploadAvatar(userId, file)` in `auth.js`) writes to a path scoped by the user's own id (`${userId}/${userId}-${timestamp}.ext`) — no cross-user collision risk found. `deleteAvatar()` existed but was never called before a re-upload (old files accumulated) — **fixed**, now called before every new upload. Broken/missing `avatar_url` is handled consistently everywhere it's rendered (checks for an `http` prefix, falls back to initials). Certificate upload/verification flow (`certifications` table + `certificate_urls` jsonb on `profiles`, marked deprecated in favor of the `certifications` table) was not deeply re-audited this arc.

## 16. Authentication Flow

Session persistence is correctly configured (`persistSession`/`autoRefreshToken`/`detectSessionInUrl` all `true` in `supabase-client.js`). `logout()` correctly calls `signOut()` and clears app storage keys. Protected-route guards were live-verified this arc for: `client-dashboard.html`, `bookings.html`, `settings.html`, `my-trainers.html`, `billing.html` (all → `login.html`), `admin-dashboard.html` (→ `admin-login.html`) — all correctly redirect anonymous users, zero console errors. Admin auth is real (queries `profiles.role === 'admin'` against the live session, not a client-side-only flag). **Not verified this arc:** an actual authenticated login/signup/onboarding-completion round trip — no test credentials available, and creating an account/entering credentials is outside what this assistant will do unilaterally. Cross-user data isolation was verified by code inspection (every write scoped by the authenticated user's own id) but **not by a live two-account test** — attempted read/write probes against production tables for security testing were correctly blocked by the environment's safety classifier.

## 17. Dashboard Status

- **`bookings.html`** (trainer dashboard): functional, has its own settings tab (see the duplication note in §4). Will need a new section for active Boost status once that's built.
- **`client-dashboard.html`**: was **completely broken** until this arc (see §3e) — now fixed and verified live (anonymous redirect works; full logged-in flow not live-tested, no credentials).
- **`admin-dashboard.html`**: functional, auth-gated correctly, blog CRUD works, now also correctly gates data queries behind a confirmed admin check (§3e fix). Will need a new ticket-management section (view/reply/resolve/close) once the support widget is built.

## 18. Known Technical Debt

- `styles.css` stale hand-patched Tailwind build — see §4. Root cause of at least 5 confirmed bugs this arc.
- Two duplicated trainer-settings UIs (`settings.html` vs `bookings.html`'s tab) — see §4.
- 7 onboarding form fields write to columns that don't exist (`training_approach`, `kyc_id_type`, `kyc_id_number`, `response_time`, `teaching_style`, `training_focus`, `profile_live`) — silently dropped every time via a schema-fallback retry loop, not hard failures. One (`session_mode`→`training_mode`) was fixed this arc because the real column already existed; **these seven still need a decision** (add columns, or remove the form fields) — not part of the current migration proposal, should be raised separately.
- No dedicated 404 page exists anywhere in the site.
- `messages.html` is confirmed fully dead code (zero inbound links, feature deprecated per code comments) — left in place, not deleted, pending an explicit decision to remove it.
- The `hover:scale-105` / `hover:translate-y-[-8px]` Tailwind utilities referenced in the design system docs appear to reference CSS custom properties that are never actually *set* anywhere in `styles.css` — found by accident, only the one concrete instance blocking the pricing-card fix was patched in isolation; this may mean these two hover micro-interactions have silently done nothing sitewide for some time. Flagged, not fixed — needs a dedicated pass with real visual verification.

## 19. Files Changed But Not Pushed

All 10 files listed in §2 — full diff detail already in the individual commit messages (`git log` / `git show <hash>` for any of them). Nothing is staged or uncommitted; everything is committed locally, just not pushed to `origin/main`.

## 20. Launch Blockers

**None that are within a single session's authority to fix and are currently unfixed.** The most severe bug found this entire arc (`client-dashboard.html`'s dead script) is fixed and verified. What remains before a confident public launch:
1. **A real human walkthrough** of signup → onboarding → dashboard for both trainer and client roles — every verification this arc has been code-inspection plus anonymous-path live testing; no authenticated round trip has been tested by an actual person or with real credentials.
2. **RLS policy confirmation directly in the Supabase dashboard** — inferred as likely-correct from code (every write is scoped by the authenticated user's id) but never empirically probed (probing was correctly blocked by this environment's safety guardrails).
3. **The 7 orphaned onboarding fields** (§18) — not a launch-blocking crash, but real, ongoing silent data loss for any trainer filling those fields today.
4. **The migration plan in `DATABASE_MIGRATION_PLAN.md`** needs explicit approval before any of it is applied — Boost, taxonomy, and blog SEO features are currently proposals only.

## 21. Recommended Implementation Order

See `IMPLEMENTATION_ROADMAP.md` for the detailed phase-by-phase plan. Short version: (1) get migration approval → apply migrations, (2) Boost payment flow end-to-end, (3) taxonomy sync across the 6 affected pages, (4) support ticket widget + admin reply UI (no AI), (5) blog CMS SEO/related-trainer fields, (6) the still-deferred polish items (How Onlifit Works animation, testimonials expansion, Join Us page, full 10-breakpoint QA sweep).
