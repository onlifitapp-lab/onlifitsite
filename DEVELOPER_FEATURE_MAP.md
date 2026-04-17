# Onlifit Developer Feature Map

> **Purpose:** A quick reference guide for developers to quickly map UI features to the corresponding HTML/JS files. If you need to make changes to a specific feature, check this list first.

---

## 1. ðŸ”‘ Core Logic & Global Scripts
These files control the application state, authentication, and database connections. They run on almost every page.

- `supabase-client.js` -> Initializes the Supabase client connection.
- `auth.js` -> **The Core Auth Controller**. Handles login, signup, session validation, OAuth (Google), and dynamic navigation rendering (`renderAuthNav()`). Also provides `requireAuth()` middleware.
- `tailwind.config.js` / CDN Scripts -> Global styling framework.

---

## 2. ðŸ“± Single Page Applications (SPAs)
These pages are built as **Single Page Applications**. They use JavaScript to show/hide sections (`<section id="view-X">`) based on the URL hash (`#dashboard`, `#bookings`) instead of reloading the browser.

### Client Experience (`client-dashboard.html`)
- **Dashboard Overview:** `<div id="view-dashboard">` - Metrics, next session widgets, basic stats.
- **My Bookings:** `<div id="view-bookings">` - Past and upcoming sessions for the client.
- **Find Trainers:** Redirects explicitly to `trainers.html` (The full search directory).
- **Settings:** `<div id="view-settings">` - Client profile updating, avatars, and goals.
*Note: The sidebar is dynamically handled. Mobile padding and horizontal scrolling are applied for small screens.*

### Trainer Experience (`bookings.html`)
- **Dashboard Overview:** `<div id="view-dashboard">` - Pending actions, earnings, next client stats.
- **Client Roster:** `<div id="view-clients">` - View of clients currently training with them.
- **Availability / Schedule:** `<div id="view-schedule">` - Calendar setup.
- **Payouts:** `<div id="view-finances">` - Revenue tracking.
- **Settings:** `<div id="view-settings">` - Trainer profile customization.

### Admin Experience (`admin-dashboard.html`)
- **User Management:** `<div id="view-users">` - Banning/Approving users.
- **Verification:** `<div id="view-verifications">` - Checking trainer certs (`setup-admin-access.sql`).
- *Runs entirely on RBAC (Role-Based Access Control) enforced by Supabase.*

---

## 3. ðŸ—ºï¸ Public & Directory Pages
Accessible by logged-out (and logged-in) users.

- `onlifit.html` -> Main Landing Page / Homepage (Marketing, Hero, Value Proposition).
- `trainers.html` -> The **Find Trainers Directory**. Full browsing interface for clients to search trainers.
- `trainer-profile.html` -> Individual Trainer Profile pages (Loaded dynamically base on URL `?id=X`). Includes booking forms and direct message CTAs.
- `pricing.html` -> Platform pricing and commission tiers.
- `about.html`, `join-us.html`, `faq.html`, `privacy.html`, `terms.html` -> Static informational pages.

---

## 4. ðŸ”’ Authentication & Onboarding
- `login.html` -> Unified login view.
- `onboarding.html` -> Client-specific onboarding flow (collects fitness goals, demographic info).
- `trainer-onboarding.html` -> Trainer-specific signup flow (collects certifications, specialties, and bio).

---

## 5. ðŸ’¬ Communications & Add-ons
- `messages.html` -> Unified Chat System. Loaded directly via ID parameters `messages.html?id=X`.
- `notifications.html` -> Real-time system alerts and booking updates.
- `chatbot.js` -> Controls the AI assistant widget that floats in the bottom right corner across public pages.

---

## 6. âš™ï¸ Component Breakdown: Where to look?

| Feature / UI Element | File to Edit | Notes |
|----------------------|-------------|-------|
| Header Navigation (Desktop/Mobile) | `auth.js` -> `renderAuthNav()` | Controls the Logged in vs Logged out buttons globally. Targets `#nav-auth` and `#mobile-nav-auth`. |
| Client Sidebar Menu | `client-dashboard.html` | Look for `<aside>` and `<nav id="mobile-bottom-nav">`. |
| Trainer Sidebar Menu | `bookings.html` | Look for `<aside>` and `<nav id="mobile-bottom-nav">`. |
| Routing Logic (SPA) | In the `<script>` tag at the bottom of the SPA file | Look for `handleRoute()`. Controls which sections get the `hidden` class removed based on `window.location.hash`. |
| Stripe/Razorpay Payments | `api/create-order.js` / `verify-payment.js` | Serverless backend functions handling financial transactions. |

## 7. ðŸš§ Quick Troubleshooting Tips
- **User is mysteriously logged out when navigating?** Check the routing paths. Ensure `href`s point to the distinct file (e.g., `trainers.html`), NOT back to the app root (`onlifit.html#trainers`). Also check that the HTML file includes a `<div id="mobile-nav-auth"></div>` in its navbar so `auth.js` can attach the mobile state.
- **White screen on Dashboard?** Ensure all IDs mapped inside `const routes = { ... }` actually exist in the DOM as section containers (`<section id="view-X">`).
- **Database Row-Level Security (RLS) Errors?** See `FIX_RLS_ERROR.md` or check Supabase policies. Usually requires checking if `auth.uid()` matches the request.
