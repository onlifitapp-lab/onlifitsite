# Project Handoff — Onlifit
*Last updated: 2026-07-17, end of Homepage V3 redesign session*

## 1. Project Overview

**What Onlifit is:** A two-sided marketplace connecting clients with independent personal trainers across India, for online or in-person sessions. Trainers set their own rates; clients discover trainers by search/goal/location, contact them directly on WhatsApp (no in-app messaging), and book/pay through the platform. Revenue comes from trainer subscriptions (free/pro/elite tiers via Razorpay), not per-booking commission.

**Current phase:** Frontend/UI-only polish phase. Backend, database, auth, and payments are feature-complete and were explicitly out of scope for the last several sessions (mobile audit → homepage SaaS audit → Homepage V2 → Homepage V3). No backend/API/schema changes were made in any of this UI work.

**Design philosophy:** Minimal, high-contrast black/white/gray palette (M3-inspired token names: `primary`, `on-surface`, `outline-variant`, etc.), Poppins for headlines + Inter for body, restrained "premium SaaS" aesthetic (Airbnb/Stripe/Linear reference points) rather than a busy fitness-template look. Homepage V3 additionally borrowed **structural/UX patterns** (not visuals) from Superprof.com — search-first hero, quick-filter goal chips, photo-first trainer cards, named testimonials — while keeping 100% of Onlifit's own colors/fonts/tokens.

## 2. Current Project Status

| Area | Status |
|---|---|
| Backend / Supabase | Stable, untouched this phase. Project `lnbsgnfrhewdqhuqqotx`, 6 migrations applied (see below). |
| Frontend | Homepage fully redesigned (V3). Other pages received only bug fixes (overflow, mojibake), not redesigns. |
| Authentication | Untouched. Supabase auth + `auth.js` shared helpers. |
| Payments | Untouched. Razorpay subscription flow (Phase 4/4.5) live. |
| Trainer flow | Previously approved (functional). Not touched this phase. |
| Client flow | Previously approved (functional). Not touched this phase. |
| Admin | Admin dashboard audited/fixed (dead buttons, XSS, duplicate listeners) two sessions ago. Not touched this phase. |
| Homepage | **Fully redesigned — see Section 3.** Live changes uncommitted (see Section 10). |
| Responsive status | Site-wide: 20 pages × 4–8 breakpoints (320–1440px) verified zero horizontal-overflow via automated headless-Chrome audits, most recently re-confirmed after this session's `styles.css` changes. |

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

## 4. Files Modified (this session, uncommitted)

| File | Why |
|---|---|
| `onlifit.html` | Full section rebuild described above — new goal-chips section, reordered sections, Onlifit Black exclusion/coming-soon logic, testimonial query + rendering rewrite, FAQ section + `toggleFaq()` function, gradient-text contrast fix, removed two filler sections. |
| `auth.js` | Two small, targeted changes to the **shared** `renderPremiumTrainerCardHTML()` function: (1) trainer card image aspect ratio changed from 16:9 to 4:3 for a more photo-first feel, (2) the "Message" button relabeled "WhatsApp" with an icon. Href/onclick logic unchanged. **This function is used by 5+ pages — see Section 5.** |
| `styles.css` | Hand-patched CSS additions only (no rebuild) — see Section 6/8 for why this is necessary. This session added ~25 new utility rules for classes newly used on the homepage (spacing, `lg:`/`md:`/`sm:` responsive variants, arbitrary widths, opacity colors). Purely additive; cannot break anything since it only adds rules for classes that previously had no effect. |

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

- **`styles.css` is a stale, non-reproducible compiled Tailwind build** (see Section 8 — this is the single most important thing for the next session to know).
- `reviews` table has 0 rows in production — testimonials are showing the (now-improved) dummy fallback everywhere. Real reviews will automatically flow through once they exist.
- Most trainers in the seed/current data have `rating: 0` and `featured: false` — the homepage's "Featured Trainers" filter falls back to showing any trainers (by design, added this session) rather than showing nothing.
- `trainer-onboarding.html` still writes to a `session_mode` field that doesn't exist in production (real column is `training_mode`) — pre-existing, unrelated to this phase, not fixed.
- `footer-component.js` duplicate-footer bug is confirmed fixed on the homepage only; other pages with rich footers of their own are unaudited (see Section 5).
- No admin-role account currently exists in production for testing (per prior handoff note — unverified if still true).
- Onlifit Black feature's long-term business status was previously "parked/undecided" per an earlier handoff note — the redesign treats it as a real feature (with a coming-soon fallback) but that's a presentation decision, not a business confirmation.

## 8. Technical Decisions — do not change without understanding why

- **`styles.css` is NOT a live Tailwind build — it's a one-time compiled snapshot from 2026-04-17, hand-patched ever since.** The Tailwind v4 CLI (`@tailwindcss/cli`) is not installed and this environment has no network access to install it. Every time new HTML introduces a Tailwind class that wasn't in use back on April 17, it silently does nothing (no error, just no styling) until someone notices and manually appends the correct compiled CSS rule to the end of `styles.css`. This has happened **repeatedly** across the last several sessions (trust-card grid, join-as-trainer badges, carousel card widths, ~80 hover/focus/group-hover states, and 25 more this session). **Any future session doing HTML/CSS work on this site should expect to hit this and know the fix pattern**: derive the exact rule using Tailwind's deterministic output format (verified against already-compiled rules elsewhere in the same file for consistent escaping/values), append it, verify via the browser's own `document.styleSheets` API (not string-matching, which has repeatedly produced false positives/negatives with backslash-escaping in shell commands). The real fix — getting a working Tailwind build pipeline into CI/deploy — remains unscoped and unscheduled.
- **The trainer-card component is intentionally shared** (`renderPremiumTrainerCardHTML` in `auth.js`) across public marketplace, dashboard, and blog contexts via an `options.context` parameter. Don't fork it per-page; extend the options pattern instead.
- **Contact flow is WhatsApp-only, gated through login.** `getDefaultMessageHref()` routes anonymous "public" context to `login.html?redirect=...` rather than directly to WhatsApp — this is deliberate (auth-gating pattern), not a bug, even though it means clicking "WhatsApp" on a card doesn't go straight to WhatsApp for a logged-out visitor.
- **No commission model** — Onlifit takes subscription revenue from trainers, not a cut of bookings. Copy/CTAs should stay consistent with this (avoid implying platform-mediated payments between client and trainer).

## 9. Next Recommended Tasks (priority order)

1. **Fix the Tailwind build pipeline properly** (install `@tailwindcss/cli` with network access, run a real build, diff against the hand-patched file) — this is infrastructure debt that will keep costing time on every future UI session until it's fixed once, properly.
2. **`trainers.html`** — the main trainer-browsing/search-results page. High traffic, likely benefits most from the same photo-first card treatment and structural polish just applied to the homepage.
3. **`trainer-profile.html`** — individual trainer detail page; first real "product page" a converting visitor sees after the homepage/search.
4. **`client-dashboard.html`** — logged-in client experience; explicitly deferred multiple sessions ago pending this homepage work.
5. **Footer-component.js duplicate-footer audit** across all other pages (quick, low-risk, same fix pattern already proven on the homepage).
6. **Reviews/testimonials real data** — not a code task, but flag to the business: the testimonial section is ready for real data the moment reviews start coming in.

## 10. Git Status

- **Modified, uncommitted:** `auth.js`, `onlifit.html`, `styles.css`, `PROJECT_HANDOFF.md` (this file).
- **Last commit:** `e5d2f25` — "feat: homepage SaaS conversion audit — card layout, footer, CSS gaps" (2026-07-16 16:31:47 +0530).
- **Branch:** `main`, 4 commits ahead of `origin/main` (not pushed): `12d5a25`, `d588307`, `63fc72d`, `e5d2f25`.
- **Testing done:** Full 20-page × 4-breakpoint automated overflow regression (clean). Manual functional verification of goal-chip search and FAQ toggle via headless Chrome. Visual verification via screenshots at 375/768/1440px. **Not done:** a human hasn't visually reviewed the live result yet — the user was about to do this when this handoff was requested instead.
- **Nothing has been committed or pushed this session** — that's the user's explicit call to make.

## 11. New Chat Prompt

Paste this into a new conversation to continue:

> Continue work on the Onlifit project. Read `PROJECT_HANDOFF.md` in the repo root for full context — it covers the just-completed Homepage V3 redesign (uncommitted: `auth.js`, `onlifit.html`, `styles.css`), the site's design system, and a critical technical note about `styles.css` being a stale hand-patched Tailwind build (not a real build pipeline) that every UI change needs to account for. First step: help me review the homepage changes live, then commit if approved. After that, the next priority is redesigning `trainers.html` using the same photo-first, structurally lean approach — but confirm with me before starting since it's a new page.
