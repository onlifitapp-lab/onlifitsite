# Project Handoff — Onlifit

**Commit**: `982900d8e0516b4a79a8e383b14b8c99b1010cc3`
(pushed, `main` == `origin/main`, working tree clean)

## Phase Completed
Functional verification complete: **Trainer Flow, Client Flow, Admin Flow** all approved. Production (`www.onlifit.in`) confirmed synchronized with this commit.

## Database Migrations
`supabase/migrations/` — 6 files, all applied to live project `lnbsgnfrhewdqhuqqotx`:
1. `20260101000001` — marketplace foundation (system_settings, client_enquiries, profile scoring)
2. `20260101000002` — email verification sync
3. `20260101000003` — client enquiry RPC
4. `20260101000004` — RLS + SECURITY DEFINER hardening
5. `20260101000005` — Phase 4 subscription payments schema
6. `20260101000006` — `profiles.onboarding_completed` (critical fix, backfilled)

## Production Deployment
Vercel deploying from `main` via GitHub push. Verified live: `normalizeVerificationStatus` fix, Phase 4.5 subscription UI, onboarding gating, search/filters, contact/enquiry RPC, admin dashboard.

## Remaining TODOs
- **Dashboard UI redesign** — explicitly deferred to a fresh conversation (per current instruction).
- System-settings editor UI for admin (pricing/caps/weights) — not built yet.
- Boost purchase flow (Phase 5) — not started.
- Admin subscription-management UI (view/force-activate) — not built.
- Cosmetic batch (Low/Medium, deferred all sessions): subscription card "Renew Plan" vs "Get Pro" label bug for free-plan trainers (`bookings.html`, `renderSubscriptionCard()`); checkbox touch-target padding on `trainers.html` (`#black-only`).

## Known Issues
- Pre-existing, unrelated to this work: `trainer-onboarding.html` writes to `session_mode`, a column that doesn't exist in production (real column is `training_mode`) — silent write failure, not yet fixed.
- `.env` contains a live Razorpay key in plaintext (gitignored, never leaked) — rotate as routine hygiene.
- No admin-role account exists in production; QA client account was temporarily promoted/reverted for testing (role is back to `client` now).
- Onlifit Black feature status still undecided (parked, per earlier discussion) — schema/function intact, not part of current business model docs.

## Next Recommended Phase
Per your instruction: **Dashboard UI redesign**, in a new conversation, covering trainer/client/admin dashboards' layout and spacing (explicitly not touched in this session — functional work only).

Secondary candidates after that: Phase 5 (Boost purchase flow), admin system-settings editor, fixing the `session_mode`/`training_mode` onboarding bug.

## Files Most Recently Modified
- `supabase/migrations/20260101000006_add_onboarding_completed_column.sql`
- `subscription-payments.js`, `pricing.html`, `bookings.html` (Phase 4.5 frontend)
- `api/create-subscription-order.js`, `api/verify-subscription-payment.js`, `api/razorpay-subscription-webhook.js` (Phase 4 backend)
