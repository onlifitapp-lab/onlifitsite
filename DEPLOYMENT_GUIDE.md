# Deployment Guide — Onlifit RC1

*Companion to `DEPLOYMENT_CHECKLIST.md` (the checklist) and `SMOKE_TEST_CHECKLIST.md` (post-deploy verification). This document is the step-by-step process and the "what to do when it goes wrong" reference.*

## Architecture Summary (context for the steps below)

- **Frontend:** static HTML/vanilla JS, no build step, no bundler. Deployed as-is to Vercel.
- **Backend:** Vercel serverless functions under `api/`. No Supabase Edge Functions are used anywhere in this project.
- **Database:** one Supabase Postgres project (`lnbsgnfrhewdqhuqqotx`, region `ap-northeast-2`). **There is no built-in staging/production database separation** — `supabase-client.js` hardcodes the project URL and anon key directly in the client bundle. If a true staging environment (separate data) is wanted, a second Supabase project must be provisioned and a staging-specific build of `supabase-client.js` deployed to the staging domain — this is a manual process, not something the codebase does automatically.
- **Payments:** Razorpay, via server-side order creation + client Checkout.js + dual verification (client callback + webhook backup).

## Required Environment Variables

See `.env.example` for the template. Full list with where each is used:

| Variable | Used by | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `api/_auth.js`, build-time frontend config | |
| `VITE_SUPABASE_ANON_KEY` | Frontend (also hardcoded in `supabase-client.js` — see note below) | |
| `SUPABASE_SERVICE_ROLE_KEY` | Every `api/*.js` file via `getServiceSupabaseClient()` | Server-only, never expose client-side |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend Clerk fallback auth | |
| `CLERK_SECRET_KEY` | `api/_auth.js` (`resolveRequestAuth`) | |
| `RAZORPAY_KEY_ID` | `create-subscription-order.js`, `create-boost-order.js` | Public-safe, returned to client for Checkout.js |
| `RAZORPAY_KEY_SECRET` | Order creation, payment signature verification | Server-only |
| `RAZORPAY_WEBHOOK_SECRET` | `razorpay-subscription-webhook.js` | **Not in `.env.example` — must be set manually.** Falls back to `RAZORPAY_KEY_SECRET` if unset; confirm this matches what's actually registered in Razorpay's dashboard before relying on the fallback. |
| `ALLOWED_ORIGIN` | `api/_auth.js` (`setCorsHeaders`) | Defaults to `*` if unset — set explicitly for every environment |

**Note on `supabase-client.js`:** this file hardcodes the Supabase URL and publishable/anon key as plain strings (lines 2-3). This is intentional — Supabase anon keys are designed to be public and protected by RLS, not secrets. But it does mean **environment variables do not control which Supabase project the frontend talks to** — only the file's hardcoded values do. Changing environments means editing this file, not just setting env vars.

## Deployment Order

Follow this order strictly — later steps depend on earlier ones being correct.

1. **Verify migrations are in sync** (`DEPLOYMENT_CHECKLIST.md` §1). If deploying against the existing production Supabase project, no migration action is needed — everything is already applied. If deploying to a fresh project, apply all 19 migration files in filename order.
2. **Set environment variables** in Vercel (Project Settings → Environment Variables) for the target environment (Production / Preview / Development scopes as appropriate). Double-check `RAZORPAY_WEBHOOK_SECRET` and `ALLOWED_ORIGIN` specifically — both are easy to silently omit since neither is in `.env.example` today for the former, and the latter has a permissive default that won't error, just silently under-secure.
3. **Configure Supabase Auth** redirect URLs for the target domain (`DEPLOYMENT_CHECKLIST.md` §3).
4. **Configure Razorpay** — confirm test vs. live keys match the target environment, register/update the webhook URL and secret (`DEPLOYMENT_CHECKLIST.md` §4).
5. **Verify `system_settings` pricing** matches what's displayed in `pricing.html`'s static HTML — these are two independent sources of truth and can drift.
6. **Deploy via Vercel** (git push to the branch Vercel is configured to deploy, or `vercel --prod` / `vercel` for preview). No build command should be configured — this is a static-file + serverless-function deployment.
7. **Run `SMOKE_TEST_CHECKLIST.md` in full** against the deployed URL before telling anyone it's live.
8. **Only after smoke tests pass**, update DNS/domain routing if this is a new domain cutover, or announce the deployment if it's an existing domain.

## Rollback Procedure

**Frontend/API code:** Vercel keeps every deployment. Roll back via the Vercel dashboard → Deployments → select the last known-good deployment → "Promote to Production." This is instant and requires no code changes — do this first if something is visibly broken post-deploy, before investigating root cause.

**Database:** there is no automated rollback for migrations in this project — no "down" migrations exist. If a migration causes a problem:
1. Do **not** attempt to hand-write a reverse migration under pressure. Assess first: is the problem the schema itself, or application code that doesn't match it?
2. If it's application code (the far more common case in this project's history — see `PROJECT_HANDOFF.md`'s account of the `verification_status` rename regression), roll back the **frontend/API deployment** via Vercel first, since that's instant and safe. The schema can stay ahead of the code temporarily as long as the code being served doesn't depend on the new columns yet.
3. If the schema change itself must be reversed (e.g., a genuinely wrong migration), write a new forward-only migration that undoes it — never edit or delete the original migration file (see `MIGRATION_HISTORY.md`'s stated policy: applied migrations are immutable history).
4. For a truly catastrophic data issue, Supabase provides point-in-time recovery on paid plans — check the project's plan tier and PITR retention window before assuming this is available (`get_project` shows `release_channel: ga` but did not surface PITR configuration in this review; confirm directly in the Supabase dashboard).

## Verification Steps (post-deploy)

1. Run `SMOKE_TEST_CHECKLIST.md` completely.
2. Check Vercel's function logs for the first few minutes post-deploy — any 500s on `api/*` endpoints during real traffic should be investigated immediately, not just left for the next scheduled check (see `OPERATIONS_RUNBOOK.md`).
3. Check Supabase's `get_advisors` (security + performance) once post-deploy if any schema changed — confirms nothing new was introduced by the deploy itself.
4. Spot-check the Razorpay dashboard's webhook delivery log for the first real (or test) payment — confirms the webhook URL/secret are actually correct in production, not just believed to be.

## Common Issues

- **"Payment succeeded but nothing activated."** Check: is `RAZORPAY_WEBHOOK_SECRET` correct? A signature mismatch causes the webhook to reject with 400 and log nothing useful beyond that — check Vercel function logs for `Invalid webhook signature`. The client-side verify call (`verify-boost-payment.js`/`verify-subscription-payment.js`) is the fast path and should have activated it already in the vast majority of cases; if both failed, check both signature secrets.
- **"Boosted trainer isn't ranking higher."** This exact defect existed in an earlier RC and was fixed (see `RELEASE_NOTES_v1.md` — the `getTrainers()`/`searchTrainers()` select-list fix). If it recurs, check whether `auth.js`'s `selectBaseFull`/`selectBaseSlim` constants (there are two pairs, in `getTrainers()` and `searchTrainers()`) still include `boost_expires_at` and `subscription_plan` — this is the exact class of regression to watch for if either function is ever edited again.
- **"Trainer stuck in onboarding loop."** Check `profiles.onboarding_completed` — this column didn't exist for a period in this project's history and every login evaluated it as falsy; if a fresh environment is missing migration `20260716070020`/local file `20260101000006`, this will recur.
- **"CORS errors on API calls."** `ALLOWED_ORIGIN` is unset or doesn't match the actual request origin exactly (including `www` vs. non-`www`, and protocol).
- **"Admin can't approve a trainer / verification write silently fails."** The `trg_enforce_verification_admin_only` trigger blocks any non-admin write to verification columns. Confirm the admin's Supabase session is genuinely authenticated with `profiles.role = 'admin'` for that user id — the trigger checks `auth.uid()` against the `profiles` table live, not a cached/client-side flag.

## Recovery Steps (if a deploy causes a live incident)

1. **Roll back the Vercel deployment immediately** (see Rollback Procedure above) — this is the fastest lever and doesn't require diagnosing root cause first.
2. **Check Razorpay's dashboard directly** for any payment-related incident — Razorpay's own record of what was charged is the source of truth if the database and Razorpay ever disagree, since `boost_purchases`/`subscription_payments` are derived from Razorpay's webhooks/API, not the other way around.
3. **Do not manually edit `boost_purchases`/`subscription_payments`/`profiles` payment/expiry fields in the Supabase dashboard under time pressure** without first understanding `activate_boost_purchase()`'s extension logic (`GREATEST(current expiry, now()) + duration`) — a manual edit that doesn't follow this pattern can silently break future purchases' extension math for that trainer.
4. **If a webhook is failing broadly** (not one trainer, all of them): check Razorpay's webhook delivery log first — a wrong secret or a Vercel deployment issue affecting all `api/*` routes are the two most likely causes, in that order of likelihood based on this project's history.
5. **Escalate to whoever owns the Razorpay/Supabase account credentials** for anything requiring dashboard-level account access — this assistant/deployment process does not have standing access to either account's billing or account-recovery functions.
