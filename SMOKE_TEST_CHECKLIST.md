# Smoke Test Checklist — Onlifit RC1

*Run this against the deployed environment (staging or production) immediately after deploy, before declaring it live. Each item is a real user action — do it in a browser, not by reading code. Check off PASS/FAIL, note anything unexpected.*

## Client Flows

- [ ] **Search trainers** — from the homepage, search by name/keyword. Results return, ranked (verified/higher-quality trainers should appear above lower-quality ones — see `RELEASE_NOTES_v1.md` for the ranking algorithm).
- [ ] **Filter trainers** (`trainers.html`) — goal chips, price/rating filters, Onlifit Black toggle. Each filter actually narrows results (not just visually highlights).
- [ ] **View trainer profile** — click into a trainer card, confirm profile loads with real data (no "undefined" strings, no broken images falling back correctly to initials).
- [ ] **WhatsApp enquiry** — click the primary CTA on a trainer profile, confirm it opens WhatsApp (web or app) with the trainer's number and a sensible pre-filled message, and that a `client_enquiries` row is created (check via Supabase dashboard or ask an admin to check).

## Trainer Flows

- [ ] **Signup** — create a new trainer account (Google OAuth and/or email, whichever is enabled). Confirm redirect lands correctly post-auth.
- [ ] **Login** — log out, log back in. Session persists across a page refresh.
- [ ] **Complete profile (onboarding)** — fill `trainer-onboarding.html` fully, including the `response_time` dropdown (confirm no constraint-violation error on submit — this exact field broke once this arc, see `RELEASE_NOTES_v1.md`). Confirm `onboarding_completed` flips to true and the trainer isn't bounced back to onboarding on next login.
- [ ] **Subscription purchase** — from `pricing.html` or the dashboard, buy Pro or Elite with a Razorpay **test card**. Confirm: order created, Checkout opens, payment completes, `subscription_plan`/`subscription_status` update on the profile, dashboard reflects the new plan.
- [ ] **Boost purchase** — same flow for a 3-day or 7-day Boost. Confirm: `boost_purchases` row reaches `status = 'paid'`, `profiles.boost_expires_at` is set, the trainer's dashboard Boost card shows "Active" with a countdown, and — critically — the trainer now ranks higher in a search against a similar-quality non-boosted trainer (this is the exact defect fixed in RC1; re-verify it live, not just in code).
- [ ] **Dashboard** — `bookings.html` loads with correct stats (subscription tier, lead count, unread messages, profile visits), no console errors.
- [ ] **Purchase history** — both Subscription and Boost purchase history are visible and accurate; the Boost "View Invoice" button opens a correctly formatted invoice for a paid purchase.

## Admin Flows

- [ ] **Login** — `admin-login.html`, confirm only a real admin (`profiles.role = 'admin'`) can reach `admin-dashboard.html`; a non-admin session is redirected away.
- [ ] **View trainers** — trainer list loads in the admin panel with correct data and verification badges.
- [ ] **Approve trainers** — approve/reject a test trainer's KYC/certificates, confirm `verification_status` transitions correctly (`pending` → `verified`/`rejected`) and the trigger doesn't block a genuine admin action.
- [ ] **Analytics** — Analytics tab loads all sections (Revenue, User Growth, Bookings, Trainer Performance) without errors, date-range selector changes the displayed numbers.
- [ ] **Boost analytics** — the new Boost Analytics section shows non-error values (₹0 / 0 is fine on a fresh environment with no purchases yet; a JS error or "undefined" is not).

## Payment Flows

- [ ] **Successful payment** — a full Razorpay test-card purchase (subscription or Boost) completes and activates without manual intervention.
- [ ] **Failed payment** — use a Razorpay test card designed to fail. Confirm the UI shows a clear error (not a silent hang), and no partial/incorrect activation occurs (`boost_purchases`/`subscription_payments` status should reflect `failed`, not `paid`).
- [ ] **Webhook activation** — simulate the "client never gets the verify call" path: close the Checkout tab immediately after payment before the `handler` callback fires (or use Razorpay's webhook test-delivery tool from their dashboard). Confirm the webhook alone activates the purchase within a few seconds.
- [ ] **Duplicate webhook** — use Razorpay's dashboard to manually resend a `payment.captured` webhook for an already-processed payment. Confirm no double-activation (boost duration doesn't extend twice, subscription expiry doesn't advance twice) — this is the idempotency guarantee in `activate_boost_purchase()`/`activate_subscription_payment()`.
- [ ] **Refund status** — refunds are **manual-only in RC1** (see known limitations in `RELEASE_NOTES_v1.md`). This item is "confirm the limitation is understood by whoever handles support," not a UI flow to test — there is no self-serve refund button anywhere in the product by design.

## Cross-Cutting

- [ ] Open browser DevTools console on each page visited above — zero uncaught errors (warnings are acceptable if pre-existing and understood).
- [ ] Test on at least one real mobile device or a narrow browser viewport (< 400px) for the pages touched this arc: `pricing.html`, `bookings.html`, `admin-dashboard.html`.
- [ ] Confirm HTTPS padlock, no mixed-content warnings.
