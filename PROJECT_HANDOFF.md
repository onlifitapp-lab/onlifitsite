# Project Handoff — Onlifit
*Last updated: 2026-07-17, end of trainers.html redesign + nav-fix session*

## 1. Project Overview

**What Onlifit is:** A two-sided marketplace connecting clients with independent personal trainers across India, for online or in-person sessions. Trainers set their own rates; clients discover trainers by search/goal/location, contact them directly on WhatsApp (no in-app messaging), and book/pay through the platform. Revenue comes from trainer subscriptions (free/pro/elite tiers via Razorpay), not per-booking commission.

**Current phase:** Frontend/UI-only polish phase. Backend, database, auth, and payments are feature-complete and were explicitly out of scope for the last several sessions (mobile audit → homepage SaaS audit → Homepage V2 → Homepage V3). No backend/API/schema changes were made in any of this UI work.

**Design philosophy:** Minimal, high-contrast black/white/gray palette (M3-inspired token names: `primary`, `on-surface`, `outline-variant`, etc.), Poppins for headlines + Inter for body, restrained "premium SaaS" aesthetic (Airbnb/Stripe/Linear reference points) rather than a busy fitness-template look. Homepage V3 additionally borrowed **structural/UX patterns** (not visuals) from Superprof.com — search-first hero, quick-filter goal chips, photo-first trainer cards, named testimonials — while keeping 100% of Onlifit's own colors/fonts/tokens.

## 2. Current Project Status

| Area | Status |
|---|---|
| Backend / Supabase | Stable, untouched this phase. Project `lnbsgnfrhewdqhuqqotx`, 6 migrations applied (see below). |
| Frontend | Homepage (V3) and `trainers.html` fully redesigned. Site-wide mobile header/nav bug fixed. Other pages received only bug fixes (overflow, mojibake), not redesigns. |
| Authentication | Untouched. Supabase auth + `auth.js` shared helpers, except a responsive-only fix to `renderAuthNav()` (see Section 3b) — no logic/routing changes. |
| Payments | Untouched. Razorpay subscription flow (Phase 4/4.5) live. |
| Trainer flow | Previously approved (functional). Not touched this phase. |
| Client flow | Previously approved (functional). Not touched this phase. |
| Admin | Admin dashboard audited/fixed (dead buttons, XSS, duplicate listeners) two sessions ago. Not touched this phase. |
| Homepage | Fully redesigned (V3, see Section 3). Committed and pushed: `1bd7902`. |
| Mobile navigation | **Site-wide overflow bug fixed this session — see Section 3b.** Committed and pushed: `0707b82`. |
| `trainers.html` | **Fully redesigned this session — see Section 3c.** Committed and pushed: `af845d1`. |
| Responsive status | Site-wide: 20 pages × 4–8 breakpoints (320–1440px) verified zero horizontal-overflow via automated audits. `trainers.html` additionally verified at 320/360/375/390/414/768/1024/1280px this session, including the corrected desktop 3-column grid. |

## 3. Homepage V3 Summary (this session)

Full section-by-section rebuild of `onlifit.html`, following a user-specified structure inspired by Superprof.com's UX patterns (not its visuals/code — see the "Superprof inspiration" discussion in this session's history for the explicit IP/consequences analysis that was done before any implementation).

**New section order:**
1. **Hero** — condensed to one punchy subline (was 3 lines), search bar remains the visual anchor, 4 trust chips inline.
2. **Popular Fitness Goals** *(new)* — chip row directly under the hero: Weight Loss, Muscle Gain, Strength, Yoga, CrossFit, Powerlifting, Calisthenics, Running, Home Workout, Women's Fitness. Each chip calls `onlifitSearchCategory(term)` → fills `#search-query` → calls `performSearch()`. Verified functionally (not just visually) that this triggers real search results.
3. **Featured Trainers** — moved to directly after the goal chips (was several sections lower, behind an abstract trust-card band). Cards use a taller 4:3 photo area (photo-first, was 16:9) and the contact button is now labeled "WhatsApp" with a chat icon (same underlying href/logic — see Section 5, this touches the shared card component).
4. **How Onlifit Works** — relabeled steps to match spec: Search → Choose Trainer → Contact on WhatsApp → Start Training.
5. **Browse Categories** — icon-card grid (Yoga, Weight Loss, Strength, CrossFit, Running, Home Workout), moved to after How It Works (was before it).
6. **Onlifit Black** — **real bug fixed here.** Previously this section could show the *exact same three trainers* as Featured Trainers above it (because its fallback logic reused `featured.slice(0,4)` with no exclusion). Now: (a) explicitly excludes any trainer ID already shown in Featured Trainers, (b) if zero Black-flagged trainers remain after exclusion, shows a genuine "Premium trainers coming soon" empty state instead of silently reusing inventory. Section background changed to solid black (`bg-on-surface`) so it visually reads as a distinct premium tier — previously it sat on the same plain gray as every other section.
7. **Testimonials ("Success Stories")** — now pulls `client_id`→(name, city) and `trainer_id`→(name, avatar_url) via a joined Supabase `select()` (no schema changes — just requesting related columns that already existed via existing FK relationships). Cards now show a real client name, location, and the *trainer's* photo with "Trained with [Trainer Name]" — previously showed only "Onlifit Member — Verified feedback" with no photo. The `reviews` table currently has 0 rows in production, so the dummy fallback (`renderDummyReviews()`) was upgraded to match the same richer format with named placeholder clients/cities/trainers, ready to be replaced by real data automatically once reviews exist.
8. **Become a Trainer** — unchanged content, but fixed a real contrast bug: the word "passion" used a black→near-white gradient-clip effect that was nearly invisible against the dark background photo. Replaced with solid white text + an underline accent.
9. **FAQ** *(new)* — 5 homepage-relevant questions, reusing the exact accordion component/JS pattern (`toggleFaq()`) already used on `pricing.html`, for consistency rather than inventing a new pattern.
10. **Footer** — unchanged, except the legacy `footer-component.js` script (which auto-injects a redundant link row + duplicate "Copyright" line into any page's `<footer>`) is now suppressed on the homepage via `<body data-hide-global-footer="true">` — a documented, built-in opt-out in that script, zero risk to other pages.

**Removed sections** (not in the user's 10-section spec, previously flagged as filler/redundant in a UX review done mid-session): the "Flexible Plans / Secure Payments" 2-card strip, and the mid-page "Browse All Trainers" CTA button.

## 3b. Mobile Navigation Fix (this session — commit `0707b82`)

**Root cause found:** `renderAuthNav()` in `auth.js` rendered one fixed-width desktop HTML block (notification bell, dashboard link, avatar, logout button) into every page's `#nav-auth`/`#auth-nav` container, with no responsive collapse. Only `onlifit.html` had a guard against this (`hidden sm:flex` + a separate `#mobile-nav-auth` block in its own mobile dropdown). Every other page that calls `renderAuthNav()` didn't. Reproduced live: at 320px, a logged-in user's header overflowed by 26px with the Logout button partially clipped off-screen.

**Fix, centralized in the shared component:** `renderAuthNav()`'s logged-in/guest/Clerk-auth markup now collapses to icon-only 44×44px controls below the `sm` (640px) breakpoint and expands back to the original icon+text layout at `sm` and up — purely additive Tailwind classes, no auth logic, hrefs, or routing touched. This one change fixes the bug on **every** page using `renderAuthNav()`: `trainers.html`, `trainer-profile.html`, `client-dashboard.html`, `bookings.html`, `about.html`, `pricing.html`, `faq.html`, `calculators.html`, `map.html`, `messages.html`, `notifications.html`, `settings.html`, `support.html`.

Also fixed per-page:
- `trainers.html` — added a mobile hamburger menu for About/Pricing/Join Us (previously had zero mobile fallback for those links), copied from the homepage's proven pattern. Nav padding `px-8` → `px-6 md:px-8` (desktop unchanged).
- `trainer-profile.html` — same padding fix (no hamburger needed, no hideable links on that page's nav).
- `client-dashboard.html` / `bookings.html` — sidebar/hamburger behavior was already correct and untouched; only tightened the `#nav-auth` gap so the now-compact icons sit cleanly next to the existing sidebar toggle.

Verified at 320/360/375/390/414/768px: no overflow, no logo/icon collisions, 44px touch targets, hamburger open/close works, desktop (≥640px) pixel-identical to before.

## 3c. `trainers.html` Redesign (this session — commit `af845d1`)

Photo-first, structurally-leaner redesign of the main trainer-browsing page, reusing the shared trainer-card component and search engine unchanged (no `auth.js` card changes, no Supabase query changes this pass).

- **Goal chips** — replaced the old 6-button specialty filter with the homepage's full goal vocabulary (Weight Loss, Muscle Gain, Strength, Yoga, CrossFit, Powerlifting, Calisthenics, Running, Home Workout, Women's Fitness, All). Wired to the existing free-text search path (fills `#search-query`, calls `applyAllFilters()`) rather than the old exact-match specialty filter, to avoid a chip returning zero results on a taxonomy mismatch.
- **New client-side filters** — price range and minimum rating, both using fields already fetched by `getTrainers()` (`plans.hourly.price`, `rating`). No new queries.
- **Onlifit Black** — checkbox+label replaced with a black pill toggle matching the homepage's Black section treatment.
- **Trust strip** — "`N+ verified trainers · X.X★ average rating · Pan-India`", computed entirely from already-loaded data.
- **Empty state** — now differentiates "no trainers yet" / "no matches for your search" / "no Black trainers right now" instead of one generic message.
- **"Most Experienced" sort — real bug fixed, not just a UX nit.** The `experience` column is a free-text string (e.g. `"5+ years"`); the old comparator did `(b.experience || 0) - (a.experience || 0)`, which is `NaN - NaN` on strings and silently no-op'd — the sort option existed in the UI but never actually reordered anything. Fixed with a `parseExperienceYears()` helper that extracts the leading number from the string. Verified against test data (10 → 8+ → 5+ → 2 years sorts correctly now).
- **Dead code removed** — ~9 unused functions/vars left over from before this page adopted the shared card component (`formatPrice`, `getTrainerMeta`, `normalizeTrainingMode`, `escapeHtml`, `renderTrainerAvatar`, `renderTrainerRatingChip`, `renderTrainerPriceLine`, `renderTrainerBadgeLine`, `renderTrainerOfferLine`) — confirmed zero call sites before deletion.
- **Accessibility** — `aria-pressed` on chips/Black toggle, `aria-label` on previously-unlabeled filter selects, `aria-live="polite"` on the result count, `aria-hidden` on decorative icons.
- **Desktop grid bug found during QA and fixed** — at desktop widths (≥1024px) the trainer grid was rendering 2 columns instead of the intended 3. Root cause: `styles.css` (see Section 8) had accumulated a **duplicate** `.md\:grid-cols-2` rule inside a separately hand-patched `@media (min-width:768px)` block, positioned *after* `.lg\:grid-cols-3` in file order. Since both rules have equal CSS specificity, the browser resolves the tie by source order — so the later duplicate `md:` rule was winning over `lg:` at all widths ≥1024px too. Fix was a single-line, purely subtractive removal of the one duplicate declaration; the correct `.md\:grid-cols-2` rule earlier in the file (inside the main `md:` block) was untouched, so `md:` behavior (768–1023px) is unchanged. Verified 1/2/3-column behavior at 320/768/1024/1280px after the fix.

Verified at 320/360/375/390/414/768/1024/1280px: no overflow, 44px touch targets throughout, correct 1→2→3 column grid progression.

## 4. Files Modified (cumulative across this session's commits)

| File | Commit | Why |
|---|---|---|
| `onlifit.html` | `1bd7902` | Full section rebuild — see Section 3. |
| `auth.js` | `1bd7902` | Trainer card image ratio 16:9→4:3, "Message"→"WhatsApp" label (Section 3, Section 5). |
| `auth.js` | `0707b82` | `renderAuthNav()` made responsive at `sm` breakpoint — see Section 3b. |
| `trainers.html` | `0707b82` | Mobile hamburger + nav padding fix (Section 3b). |
| `trainer-profile.html` | `0707b82` | Nav padding fix (Section 3b). |
| `client-dashboard.html` / `bookings.html` | `0707b82` | `#nav-auth` gap tightened (Section 3b). |
| `trainers.html` | `af845d1` | Full page redesign — see Section 3c. |
| `styles.css` | `1bd7902`, `0707b82`, `af845d1` | Hand-patched CSS additions across all three commits (see Section 8) — additive plus one duplicate-rule removal in `af845d1` (Section 3c). |

## 5. Important Shared Components — handle with care

- **`auth.js` → `renderPremiumTrainerCardHTML()`, `renderTrainerImageArea()`, `renderInlineBadges()`, `renderRatingBlock()`, `renderPriceLine()`, `renderOfferLine()`, `getDefaultMessageHref()`** — this is the single trainer-card template used by `onlifit.html`, `trainers.html`, `client-dashboard.html`, `trainer-profile.html`, `blog-post.html`, and `map.js`. **Any change here ripples to all of those pages simultaneously.** This was done deliberately in this session (with explicit user sign-off) for the photo-ratio and button-label changes — future sessions should get the same kind of explicit confirmation before editing it, since a change intended for the homepage will silently apply everywhere else too.
- **`footer-component.js`** — loaded on every single page in the site. It auto-appends a redundant nav-link row + copyright line into any `<footer>` it finds, unless the page's `<body>` has `data-hide-global-footer="true"`. Only `onlifit.html` currently has that flag. **Other pages with their own complete footer (if any) may have the same duplicate-footer visual bug this session fixed on the homepage — untested, worth auditing.**
- **`styles.css`** — see Section 8. Not a component exactly, but treat it as fragile: it's a stale, hand-patched compiled Tailwind file, not a real build output. Every session that touches HTML on this site risks introducing classes that silently do nothing until someone notices and hand-patches them (as happened 3 times this session alone).

## 6. Design System

- **Colors** (from `tailwind.config.js`, do not change without explicit request): `primary` `#000000`, `secondary` `#1A1A1A`, `tertiary` `#333333`, `on-surface` `#000000`, `on-surface-variant` `#666666`, `surface` `#FAFAFA`, `surface-container-lowest/low/high/highest` (white → `#CCCCCC` scale), `outline` `#D0D0D0`, `outline-variant` `#E8E8E8`. No accent/brand color beyond black — "primary" IS black.
- **Fonts:** `font-headline` = Poppins (headings, black/700 weight), `font-body`/`font-label` = Inter (everything else). Loaded via Google Fonts, weights trimmed to 400/600/700/900 (Poppins) and 400/600/700 (Inter) for performance.
- **Spacing:** Standard Tailwind scale (0.25rem increments). Sections typically `py-10` to `py-20` depending on visual weight; container is `max-w-7xl mx-auto px-6`.
- **Card style:** `rounded-2xl` (1.5rem, but note `borderRadius.DEFAULT` is overridden to `1rem` and `.lg`→`2rem`, `.xl`→`3rem` in the theme — arbitrary/named radius utilities may not match assumptions, check before using), `border border-outline-variant/30`, `shadow-sm` at rest, `hover:shadow-md hover:-translate-y-0.5` on interactive cards.
- **Buttons:** Primary = `bg-primary text-on-primary rounded-full` (pill shape). Secondary = `bg-secondary` or outlined. Consistent `hover:opacity-90` / `hover:scale-105` micro-interaction.
- **Shadows:** Custom named shadows defined per-page in a `<style>` block (`shadow-ambient-light`, `shadow-ambient-medium`, `shadow-elevated`) — these are NOT Tailwind utilities, they're hand-authored CSS classes local to each page's `<head>`. Don't assume they exist on a page unless you check.
- **Animations:** Subtle only — `transition-all duration-200/300`, `hover:-translate-y-0.5/1`, `active:scale-95`, a `card-appear` fade-in class, `animate-pulse` for loading/live indicators. Nothing flashy, consistent with the "premium SaaS not flashy" brief.

## 7. Known Issues

- **`styles.css` is a stale, non-reproducible compiled Tailwind build** (see Section 8 — this is the single most important thing for the next session to know). It has also accumulated genuine duplicate/conflicting rules from repeated hand-patching (one caused a real desktop bug, fixed this session — see Section 3c) — worth being alert to the possibility of more.
- `reviews` table has 0 rows in production — testimonials are showing the (now-improved) dummy fallback everywhere. Real reviews will automatically flow through once they exist.
- Most trainers in the seed/current data have `rating: 0` and `featured: false` — the homepage's "Featured Trainers" filter falls back to showing any trainers (by design, added this session) rather than showing nothing.
- `trainer-onboarding.html` still writes to a `session_mode` field that doesn't exist in production (real column is `training_mode`) — pre-existing, unrelated to this phase, not fixed.
- `footer-component.js` duplicate-footer bug is confirmed fixed on the homepage only; other pages with rich footers of their own are unaudited (see Section 5). `trainers.html` was checked this session and is **not** affected (it has no `<footer>` element, so the script takes its safe "create new footer" branch rather than the duplicate-append branch).
- No admin-role account currently exists in production for testing (per prior handoff note — unverified if still true).
- Onlifit Black feature's long-term business status was previously "parked/undecided" per an earlier handoff note — the redesign treats it as a real feature (with a coming-soon fallback) but that's a presentation decision, not a business confirmation.
- **Mobile-nav fix (Section 3b) was validated primarily via direct DOM/CSS measurement and markup injection, not a real logged-in session** — this sandbox has no network access to Supabase. `trainer-profile.html` and `bookings.html` in particular redirect/change state without a real auth session, so their fixes were verified by structural equivalence to the fully-tested `trainers.html`/`client-dashboard.html` cases rather than end-to-end. Worth a quick real-browser sanity check when convenient.
- `client-dashboard.html`'s `#sidebar-toggle` didn't open the sidebar when tested in the offline sandbox — most likely a sandbox artifact (page-level auth-check behaving differently without network), not something touched this session. Unconfirmed either way in a real browser.

## 8. Technical Decisions — do not change without understanding why

- **`styles.css` is NOT a live Tailwind build — it's a one-time compiled snapshot from 2026-04-17, hand-patched ever since.** The Tailwind v4 CLI (`@tailwindcss/cli`) is not installed and this environment has no network access to install it. Every time new HTML introduces a Tailwind class that wasn't in use back on April 17, it silently does nothing (no error, just no styling) until someone notices and manually appends the correct compiled CSS rule to the end of `styles.css`. This has happened **repeatedly** across the last several sessions (trust-card grid, join-as-trainer badges, carousel card widths, ~80 hover/focus/group-hover states, and 25 more this session). **Any future session doing HTML/CSS work on this site should expect to hit this and know the fix pattern**: derive the exact rule using Tailwind's deterministic output format (verified against already-compiled rules elsewhere in the same file for consistent escaping/values), append it, verify via the browser's own `document.styleSheets` API (not string-matching, which has repeatedly produced false positives/negatives with backslash-escaping in shell commands). The real fix — getting a working Tailwind build pipeline into CI/deploy — remains unscoped and unscheduled.
- **The trainer-card component is intentionally shared** (`renderPremiumTrainerCardHTML` in `auth.js`) across public marketplace, dashboard, and blog contexts via an `options.context` parameter. Don't fork it per-page; extend the options pattern instead.
- **Contact flow is WhatsApp-only, gated through login.** `getDefaultMessageHref()` routes anonymous "public" context to `login.html?redirect=...` rather than directly to WhatsApp — this is deliberate (auth-gating pattern), not a bug, even though it means clicking "WhatsApp" on a card doesn't go straight to WhatsApp for a logged-out visitor.
- **No commission model** — Onlifit takes subscription revenue from trainers, not a cut of bookings. Copy/CTAs should stay consistent with this (avoid implying platform-mediated payments between client and trainer).

## 9. Next Recommended Tasks (priority order)

1. **`trainer-profile.html`** — individual trainer detail page; first real "product page" a converting visitor sees after the homepage/search or the newly-redesigned `trainers.html`. Natural next step in the funnel now that discovery (homepage) and browsing (`trainers.html`) are both done. Its nav overflow bug is already fixed (Section 3b) — this would be a content/structure redesign pass, same scope-confirmation approach used for `trainers.html`.
2. **Fix the Tailwind build pipeline properly** (install `@tailwindcss/cli` with network access, run a real build, diff against the hand-patched file) — infrastructure debt that will keep costing time on every future UI session, and has now caused at least one real production bug (Section 3c), not just cosmetic gaps.
3. **`client-dashboard.html`** — logged-in client experience; explicitly deferred multiple sessions ago. Nav overflow bug already fixed (Section 3b); redesign scope not yet started.
4. **Footer-component.js duplicate-footer audit** across all other pages (quick, low-risk, same fix pattern already proven on the homepage; `trainers.html` confirmed unaffected this session).
5. **Real-browser sanity check** of the mobile-nav fix on `trainer-profile.html`/`bookings.html`/`client-dashboard.html` — this session's sandbox had no network access to Supabase, so those three were validated by structural equivalence rather than a live logged-in session (see Section 7).
6. **Reviews/testimonials real data** — not a code task, but flag to the business: the testimonial section is ready for real data the moment reviews start coming in.

## 10. Git Status

- **Working tree clean.** No uncommitted changes.
- **Branch:** `main`, up to date with `origin/main`.
- **Commits this overall arc (oldest → newest, all pushed):**
  - `1bd7902` — Homepage V3 redesign.
  - `0707b82` — Site-wide mobile header/nav overflow fix (Section 3b).
  - `af845d1` — `trainers.html` redesign + desktop grid CSS-ordering fix (Section 3c).
- **Testing done:** Full 20-page × 4-breakpoint automated overflow regression (homepage phase). `trainers.html` + nav-fix pages verified at 320/360/375/390/414/768/1024/1280px this session (Sections 3b, 3c) — overflow, touch targets, hamburger/toggle behavior, and the corrected desktop grid all confirmed. Filter/sort/reset logic on `trainers.html` verified via injected test data (no live Supabase in this sandbox).
- **Not done:** a human hasn't visually reviewed `trainers.html` or the nav fix live in a real browser with real data yet — all verification this session was automated/injected-data due to no network access in the sandbox.

## 11. New Chat Prompt

Paste this into a new conversation to continue:

> Continue work on the Onlifit project. Read `PROJECT_HANDOFF.md` in the repo root for full context — it covers the completed Homepage V3 redesign (`1bd7902`), the site-wide mobile-nav overflow fix (`0707b82`), and the `trainers.html` redesign + desktop grid bug fix (`af845d1`), all committed and pushed to `origin/main`. It also covers the design system and a critical technical note about `styles.css` being a stale hand-patched Tailwind build (not a real build pipeline) that has already caused one real production bug (a duplicate rule breaking the desktop grid) — every UI change needs to account for this. The next recommended priority is `trainer-profile.html` — but confirm scope with the user before starting, following the same approach used for `trainers.html`.
