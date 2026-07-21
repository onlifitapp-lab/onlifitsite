# Deployment Checklist — Onlifit RC1

*Use this before every deploy to staging or production. Check items off in order — several depend on the ones above them.*

## 1. Database Migrations

- [ ] `supabase/migrations/` contains 19 files, matching `supabase_migrations.schema_migrations` on the target project exactly (verify with the Supabase MCP `list_migrations` tool, or `supabase migration list` if using the CLI) — see `MIGRATION_HISTORY.md` for the full reconciliation.
- [ ] If deploying to a **new** Supabase project (staging with its own DB, disaster recovery, etc.): run all 19 migrations in filename order. This is now safe end-to-end — earlier migrations that were superseded (see `MIGRATION_HISTORY.md`) are correctly overridden by later ones in the same sequence.
- [ ] If deploying against the **existing** production project: no migrations are pending — everything in `supabase/migrations/` is already applied there. Confirm with `list_migrations` before assuming otherwise.
- [ ] Do **not** run `20260101000005`/`20260101000006` in isolation against production — their filename version numbers don't match what's recorded in `schema_migrations` (documented drift, see `MIGRATION_HISTORY.md`); a naive `db push` could attempt to reapply them.

## 2. Environment Variables

Required (see `.env.example` — copy and fill for the target environment):

- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — **never** exposed client-side; Vercel serverless env only
- [ ] `VITE_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `RAZORPAY_KEY_ID`
- [ ] `RAZORPAY_KEY_SECRET`
- [ ] `RAZORPAY_WEBHOOK_SECRET` — **not currently in `.env.example`**; must be set explicitly in Vercel's dashboard. If unset, the webhook silently falls back to `RAZORPAY_KEY_SECRET` (`api/razorpay-subscription-webhook.js`), which will only work if Razorpay's dashboard webhook is (incorrectly) configured to sign with the API secret instead of a dedicated webhook secret. Confirm which one is actually registered in Razorpay before deploying.
- [ ] `ALLOWED_ORIGIN` — must be the real deployed domain (e.g. `https://www.onlifit.in` for production, the staging domain for staging). If left unset, CORS defaults to `*` on every API endpoint including payment endpoints (`api/_auth.js:64`).

## 3. Supabase Configuration

- [ ] Confirm target project ref matches intent (production is `lnbsgnfrhewdqhuqqotx`) — do not accidentally point staging at production or vice versa.
- [ ] Auth → URL Configuration: Site URL and Redirect URLs include the deployed domain (production: `https://www.onlifit.in`; staging: whatever staging domain is used).
- [ ] Auth → Email: confirm "Confirm email" is enabled if email verification is required before certain actions (trainer subscription purchase currently gates on `profile.email_verified` — see `api/create-subscription-order.js`).
- [ ] Auth → Providers → Google: Client ID/Secret configured, matching the Google Cloud OAuth consent screen's authorized redirect URIs for the deployed domain.
- [ ] Storage buckets exist with correct public/private flags (verified live): `avatars` (public), `blog-images` (public), `trainer_certifications` (public), `ticket_attachments` (private), `trainer-documents` (private), `Trainers Kyc` (private).
- [ ] Database → Extensions: `pgcrypto`/`uuid-ossp` (or equivalent for `gen_random_uuid()`) enabled — required by nearly every table's default.

## 4. Razorpay Configuration

- [ ] Confirm which key set is live: **test** (`rzp_test_...`) for staging, **production** (`rzp_live_...`) for the real deploy. Never mix — a staging deploy accidentally using live keys would process real charges.
- [ ] Webhook URL registered in Razorpay dashboard: `https://<domain>/api/razorpay-subscription-webhook` (same endpoint handles both subscription and Boost payments — see `RELEASE_NOTES_v1.md` for why).
- [ ] Webhook events subscribed: `payment.captured`, `payment.failed` (both are handled; other events are safely ignored with a 200 response).
- [ ] Webhook secret in Razorpay dashboard matches `RAZORPAY_WEBHOOK_SECRET` in the deployment environment.
- [ ] `system_settings` table has current pricing: `pro_plan_price_inr`, `elite_plan_price_inr`, `boost_3day_price_inr`, `boost_7day_price_inr` — confirm these match what's actually displayed on `pricing.html` before launch (both are independent sources of truth; `pricing.html`'s displayed price is static HTML, the charged amount comes from `system_settings` — a mismatch would mean the UI shows one price and Razorpay charges another).

## 5. Storage Permissions

- [ ] `avatars`, `blog-images`, `trainer_certifications` are public buckets by design (profile photos, blog images, and certificates need public URLs for display) — confirmed intentional, not a misconfiguration.
- [ ] `ticket_attachments`, `trainer-documents`, `Trainers Kyc` are private — confirm no public SELECT policy has been added to `storage.objects` for these bucket ids.
- [ ] Public buckets currently allow object **listing** (not just individual URL access) per Supabase's own advisor — pre-existing, not a blocker, but worth a conscious decision before launch (see `avatars`/`blog-images`/`trainer_certifications` policies).

## 6. Domain Configuration

- [ ] Production domain (`onlifit.in` / `www.onlifit.in`) DNS points at Vercel.
- [ ] Apex → `www` redirect configured (or vice versa) — `resolveAuthBaseUrl()` in `auth.js` hardcodes auth callbacks to `https://www.onlifit.in` specifically; if the apex domain doesn't redirect to `www`, users landing on the bare apex domain could see inconsistent auth callback behavior.
- [ ] Staging domain (if used) is a distinct hostname from production, registered separately in Supabase Auth redirect URLs and Google OAuth console — `resolveAuthBaseUrl()` falls back to `window.location.origin` for any non-production hostname, so this works automatically in code, but the *allow-lists* in Supabase/Google are manual config that must be added.

## 7. SSL / DNS

- [ ] Vercel-issued SSL certificate active for all configured domains (automatic via Vercel, verify in dashboard).
- [ ] `vercel.json`'s `Strict-Transport-Security` header (`max-age=31536000; includeSubDomains; preload`) is intentional — confirm the domain is ready for HSTS preload commitment (effectively irreversible for a year) before first production deploy.

## 8. Analytics

- [ ] Confirm whether any third-party analytics (Google Analytics, etc.) are wired — not found in this codebase during review; if analytics are expected for launch, that's a gap to raise separately, not something silently assumed present.
- [ ] `user_activity_log` (Boost purchase/paid/failed events) and the admin Analytics tab (`admin-dashboard.html`) are the only analytics currently in the product — confirm this is sufficient for launch reporting needs.

## 9. Vercel / Build Settings

- [ ] No build step exists (`package.json` has no `build` script) — this is a static site with Vercel serverless functions under `api/`. Confirm Vercel project settings have **no** build command configured that would fail (an empty/no-op build command is correct here).
- [ ] `vercel.json` rewrites (`/` → `onlifit.html`, `/trainer/:path*` → `bookings.html`, `/client/:path*` → `client-dashboard.html`) are the only routing logic — confirm these match intended URL structure.
- [ ] `cleanUrls: true` — confirm no page relies on an explicit `.html` extension in a shared link.

## 10. Pre-Deploy Sign-off

- [ ] `SMOKE_TEST_CHECKLIST.md` run once against the target environment after deploy, before declaring it live.
- [ ] Working tree clean, all commits reviewed (`git log`), nothing pushed until this checklist is complete.
