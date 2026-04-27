# Onlifit - Project Handover & Architecture Guide

Welcome to the Onlifit codebase! This document serves as a comprehensive guide for any new developer joining the project. It outlines the technology stack, architectural decisions, feature implementations, and the exact changes that have transformed this application into its current production-ready state.

---

## 1. Core Technology Stack

This project was intentionally built to be incredibly fast and lightweight without relying on heavy frontend frameworks (like React or Next.js) while still maintaining modern Single Page Application (SPA) UX.

*   **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3.
*   **Styling**: Tailwind CSS (Recently optimized: transitioned from slow runtime CDN to pre-compiled, minified static CSS for instant load speeds).
*   **Backend & Database**: **Supabase** (PostgreSQL). Handles user authentication, database storage, and real-time WebSocket broadcasting.
*   **Hosting & CI/CD**: **Vercel**. Deployed continuously from the `main` branch.

---

## 2. Key Architectural Decisions (How it works under the hood)

### Vanilla JS Single Page Applications (SPA)
Instead of forcing full-page reloads, we converted the major dashboards (`bookings.html` for Trainers, `client-dashboard.html` for Clients) into SPAs using the native browser History API (`window.history.pushState`). 
*   **How it works:** When a user clicks a sidebar link (e.g., Dashboard, Settings, Bookings), javascript intercepts the click, hides the current `<section>`, unhides the target `<section>`, and updates the URL bar gracefully. 

### Vercel Routing Overrides (`vercel.json`)
Because we use virtual SPA URLs like `/trainer/settings`, Vercel needs to know how to handle these.
*   We use Vercel **rewrites** to point routes like `/trainer/:path*` directly to `/bookings.html`.
*   **Critical Fix Implemented:** We added `<base href="/">` to the `<head>` of all HTML files. This ensures that when a user is on a virtual path like `/trainer/settings`, the browser still correctly fetches CSS and JS scripts from the root directory instead of appending `/trainer/` and throwing 404 errors.

### Real-Time Data (Hybrid Architecture)
To make the application feel instantaneous, we utilize a two-pronged data updating strategy:
1.  **Optimistic UI Sync:** When a user edits their settings (e.g., changes their location), the local browser state and HTML DOM are updated *instantly* in 0.001s without waiting for the network response. The Supabase save happens invisibly in the background.
2.  **Supabase Realtime WebSockets:** We enabled PostgreSQL logical replication. If a client is browsing the `trainers.html` (Find Trainers) directory, and a trainer updates their pricing or location, a WebSocket payload is pushed to the client immediately mapping the new data to the trainer's card without the user refreshing the page.

**Realtime tables note:** realtime events only fire for tables included in the `supabase_realtime` publication. If you add new columns that must broadcast (e.g., `profiles.has_black_status`), re-add the table to the publication (drop/add) so new columns are included.

---

## 3. Major Features & Timeline of Changes

Here is the exact journey of what has been implemented to stabilize the platform up until today:

### Authentication & Sessions
*   Integrated **Google OAuth** alongside standard Email/Password via Supabase.
*   Hardcoded rigid Supabase OAuth callback URLs specifically routing back to the core host to ensure Vercel preview environments wouldn't break the authentication whitelist.
*   Fixed session loss issues: Previously, clicking certain links wiped session states. State management was moved tightly into `auth.js` via local storage syncing.
*   **Temporary auth pause:** login and signup were disabled while OTP auth is being built. `login.html` now acts as a notice page, and shared auth rendering falls back to a guest-mode dashboard link.
*   **Temporary bypass behavior:** `auth.js` now returns preview users so dashboards can load without a live Supabase session. `requireAuth()` no longer blocks the main app flow during this phase.
*   **Dashboard routing cleanup:** removed login redirects from `client-dashboard.html`, `bookings.html`, `onboarding.html`, `trainer-onboarding.html`, `trainer-profile.html`, and `admin-dashboard.html` so pages remain editable and usable without authentication.
*   **Join Us trainer flow hardened:** OAuth signup from Join Us now forces `profiles.role = 'trainer'`, preserves trainer intent until onboarding, and keeps trainer logins on trainer dashboards.

### Messaging & Notifications Stability
*   **Schema-safe messages:** production `messages` table does not include `read` or `status`, so message logic now avoids writing to those fields.
*   **Unread badge safety:** unread counts now gracefully skip when read columns are missing (prevents 400 loops).
*   **Notification page fix:** `notifications.html` now loads `supabase-client.js` + `auth.js` in-order and includes a Back button.
*   **SPA-safe messaging links:** message buttons now use hash-based routes (e.g., `client-dashboard.html#messages?id=...`, `bookings.html#messages?id=...`) to avoid Vercel 404s.

### Trainer Dashboard Overhaul
*   **Merged Settings**: Extracted `settings.html` and absorbed it physically into `bookings.html` so the UI doesn't force jarring "Open in New Tab" (`target="_blank"`) layouts.
*   **Dynamic Data Integration:** Located and stripped out all "fake/hardcoded" data (e.g., "98% Response Rate", "42 Bookings"). Wrote parsing algorithms utilizing `Array.filter` on incoming Supabase booking models to map true business numbers to the DOM elements using specific IDs (`#stat-total-bookings`, `#stat-upcoming`).
*   **New Profile Mechanics:** Added new fields allowing trainers to seamlessly toggle their **Mode (Online vs. Offline)**. When offline is triggered, dynamic JS fields reveal prompting for City/State/Address.

### Mobile Responsiveness & Layout
*   Restructured the sidebar navigation arrays down to horizontally scrolling tab-bars on mobile viewports.
*   Ensured `<main>` panels no longer squish or bleed out of the viewing frame by enforcing Tailwind flex-shrink behaviors and custom padding bounds.

### Premium Badge System: “OnliFit Black”
We added a premium trainer tier badge that can be used across multiple pages and is designed to be scalable for future badges (e.g., Coach+, Elite).

*   **DB field:** `public.profiles.has_black_status BOOLEAN DEFAULT FALSE`
    *   Toggle any trainer:
        ```sql
        update public.profiles set has_black_status = true where id = '<trainer_uuid>';
        ```
*   **Conditional UI:** badge renders only when `trainer.hasBlackStatus === true` (normalized from DB `has_black_status`).
*   **Where it shows:**
    *   `trainers.html` trainer cards (corner badge) + “Show only OnliFit Black” checkbox filter
    *   `client-dashboard.html` → Find Trainers (corner badge) + “Show only OnliFit Black” checkbox filter
    *   `trainer-profile.html` near trainer name + short description (“top 10%”)
    *   `onlifit.html` homepage “Premium Trainers” cards (corner badge)
*   **Implementation:** centralized in `auth.js`:
    *   `ONLIFIT_BADGE_DEFS`, `normalizeTrainerBadges()`, `renderTrainerBadgesHtml()`
    *   Styles are injected once via `ensureOnlifitBadgeStyles()` (avoids editing huge compiled CSS)

### Caching Note (important for badge visibility)
*   `auth.js` caches trainer lists in memory + `localStorage` for ~5 minutes (keys are versioned, currently `onlifit_trainers_cache_v2`).
*   `vercel.json` is configured so **images are long-cached**, but **CSS/JS are not immutable** (so new JS changes like the badge ship immediately).

### Storage & KYC Updates
*   Trainer KYC uploads now default to the `Trainers Kyc` bucket (with fallbacks for older buckets).
*   Support ticket attachments moved to private bucket with owner-scoped policies.

---

## 4. File Map: What Does What?

If you need to edit something, look here first:

*   **`auth.js`**: The central nervous system of the front end. Contains all core functions for `signInWithGoogle`, database user updates (`updateUserProfile`), catching OAuth tokens on load, and checking the current viewer's session. It also contains the premium badge helpers (OnliFit Black) and trainer list caching.
*   **`login.html`**: Temporary auth-disabled landing page while OTP auth is being implemented.
*   **`supabase-client.js`**: Contains the hard-coded API Keys and initialization strings for connecting to our specific Supabase instance.
*   **`onlifit.html`**: The effective homepage (Vercel rewrite `/` → `/onlifit.html`). Renders “Premium Trainers” dynamically via `getTrainers()`.
*   **`client-dashboard.html`**: The main hub for regular users viewing their upcoming sessions.
*   **`bookings.html`**: The main hub for **Trainers**. Includes the virtual SPA router (`DashboardRouter`) for jumping between Dashboard, Bookings list, and Profile Settings.
*   **`trainer.html` / `trainers.html`**: The public viewing portals for finding trainers. These pages render trainer cards dynamically and can listen to realtime updates.
*   **`trainer-profile.html`**: Public trainer profile page (supports OnliFit Black badge near the name).
*   **`messages.html`**: Standalone messages page (loads `supabase-client.js` + `auth.js` for realtime chat features).
*   **`admin-dashboard.html`** / **`admin-login.html`**: Admin access is temporarily bypassed for local editing access.
*   **`vercel.json`**: Controls the live hosting production environment parameters (rewrites, security headers, and cache controls; note CSS/JS are not set to immutable).

## 5. Helpful Commands & Scripts
We frequently utilized inline Node.js `cheerio` HTML parsers during development to dynamically inject IDs or classes safely across thousands of lines of HTML. While not in the active repos anymore, any repetitive mass HTML injection should ideally be done via small `.cjs` Node scripts.
