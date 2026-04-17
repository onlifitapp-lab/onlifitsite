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

---

## 3. Major Features & Timeline of Changes

Here is the exact journey of what has been implemented to stabilize the platform up until today:

### Authentication & Sessions
*   Integrated **Google OAuth** alongside standard Email/Password via Supabase.
*   Hardcoded rigid Supabase OAuth callback URLs specifically routing back to the core host to ensure Vercel preview environments wouldn't break the authentication whitelist.
*   Fixed session loss issues: Previously, clicking certain links wiped session states. State management was moved tightly into `auth.js` via local storage syncing.

### Trainer Dashboard Overhaul
*   **Merged Settings**: Extracted `settings.html` and absorbed it physically into `bookings.html` so the UI doesn't force jarring "Open in New Tab" (`target="_blank"`) layouts.
*   **Dynamic Data Integration:** Located and stripped out all "fake/hardcoded" data (e.g., "98% Response Rate", "42 Bookings"). Wrote parsing algorithms utilizing `Array.filter` on incoming Supabase booking models to map true business numbers to the DOM elements using specific IDs (`#stat-total-bookings`, `#stat-upcoming`).
*   **New Profile Mechanics:** Added new fields allowing trainers to seamlessly toggle their **Mode (Online vs. Offline)**. When offline is triggered, dynamic JS fields reveal prompting for City/State/Address.

### Mobile Responsiveness & Layout
*   Restructured the sidebar navigation arrays down to horizontally scrolling tab-bars on mobile viewports.
*   Ensured `<main>` panels no longer squish or bleed out of the viewing frame by enforcing Tailwind flex-shrink behaviors and custom padding bounds.

---

## 4. File Map: What Does What?

If you need to edit something, look here first:

*   **`auth.js`**: The central nervous system of the front end. Contains all core functions for `signInWithGoogle`, database user updates (`updateUserProfile`), catching OAuth tokens on load, and checking the current viewer's session.
*   **`supabase-client.js`**: Contains the hard-coded API Keys and initialization strings for connecting to our specific Supabase instance.
*   **`client-dashboard.html`**: The main hub for regular users viewing their upcoming sessions.
*   **`bookings.html`**: The main hub for **Trainers**. Includes the virtual SPA router (`DashboardRouter`) for jumping between Dashboard, Bookings list, and Profile Settings.
*   **`trainer.html` / `trainers.html`**: The public viewing portals for finding trainers. Both actively listen to WebSocket events for live adjustments.
*   **`vercel.json`**: Controls the live hosting production environment parameters (redirects, Security headers, HTTP Cache controls).

## 5. Helpful Commands & Scripts
We frequently utilized inline Node.js `cheerio` HTML parsers during development to dynamically inject IDs or classes safely across thousands of lines of HTML. While not in the active repos anymore, any repetitive mass HTML injection should ideally be done via small `.cjs` Node scripts.