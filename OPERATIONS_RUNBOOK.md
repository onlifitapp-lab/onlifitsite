# Operations Runbook — Onlifit RC1

*How to keep this running day-to-day after deployment. Written for whoever is on point for support/ops, not necessarily an engineer.*

## Monitoring

No dedicated APM/error-tracking tool (e.g. Sentry) was found wired into this codebase during review. Monitoring today is:
- **Vercel function logs** — the primary source of truth for API errors. Every `api/*.js` file logs errors via `console.error` on real failures (payment activation failures, webhook processing failures, etc.) — these are visible in Vercel's dashboard under the project's Functions/Logs tab.
- **Supabase dashboard** — database-level errors, slow queries, and the `get_advisors` security/performance linters (accessible via the Supabase MCP tools or dashboard directly).
- **Razorpay dashboard** — the authoritative record of every payment attempt, its status, and webhook delivery attempts/failures.

**Gap to be aware of:** there is no automated alerting. A silent failure (e.g., the webhook secret is wrong and every webhook is rejected) will not page anyone — it will only surface as "a trainer complained their Boost didn't activate" unless someone is actively checking Vercel logs or Razorpay's webhook delivery log.

## Daily Checks

- [ ] Vercel Functions log — scan for repeated 500s or error patterns, especially on `api/create-boost-order`, `api/verify-boost-payment`, `api/create-subscription-order`, `api/verify-subscription-payment`, `api/razorpay-subscription-webhook`.
- [ ] Razorpay dashboard — any payments stuck in a pending/uncaptured state longer than a few minutes.
- [ ] Supabase dashboard — database size/connection count trending normally, no unexpected spikes.
- [ ] Admin dashboard's Analytics and Boost Analytics tabs — sanity-check the numbers look plausible (a sudden zero or a wildly implausible spike is worth investigating before trusting it).

## Payment Monitoring

This is the highest-stakes area — real money moves through this system.

- **Reconciliation check (recommended weekly, more often at higher volume):** compare `boost_purchases`/`subscription_payments` rows with `status = 'paid'` against Razorpay's dashboard transaction list for the same period. They should match 1:1. A mismatch means either a webhook failure (Razorpay shows paid, database doesn't) or — much less likely given the idempotency design — a double-activation (database shows more activity than Razorpay's records support).
- **Stuck `'created'` rows:** a `boost_purchases`/`subscription_payments` row that's been `status = 'created'` for more than ~1 hour is an abandoned checkout, not a bug — this is expected and cosmetic (see `RELEASE_NOTES_v1.md`'s architecture notes). No action needed unless the *volume* of stuck rows is unusually high, which would suggest a checkout-flow problem worth investigating.
- **Failed payments:** check `failure_reason` on `boost_purchases` rows with `status = 'failed'` periodically — recurring failure reasons (e.g., a specific bank consistently declining) may indicate a Razorpay-side or card-network issue worth raising with Razorpay support, not something fixable in this codebase.
- **Refunds:** manual-only in RC1. When a refund is needed: process it in the Razorpay dashboard first (that's the actual money movement), then manually update the corresponding `boost_purchases`/`subscription_payments` row's status in Supabase, and manually assess whether `profiles.boost_expires_at`/`subscription_expires_at` needs correcting. There is no UI for this — it's a direct database action. Document every manual refund (who, when, why, what was changed) somewhere durable, since there's no automated audit trail for the correction step itself (the Razorpay-side refund and the original purchase row are both audited; the manual expiry correction is not).

## Database Health

- Row counts on high-write tables (`boost_purchases`, `subscription_payments`, `user_activity_log`, `client_enquiries`) growing at an expected rate for actual usage — a sudden flat line usually means something upstream (a form, an API endpoint) silently broke.
- `get_advisors` (security + performance) periodically, not just at deploy time — new Postgres/Supabase linter rules can surface findings on unchanged code as the platform itself evolves.
- Watch for RLS policies that predate this project's more careful recent work — several tables (`client_enquiries`, `payment_webhook_logs`, `payments`, `promo_code_usage`, `subscription_payments`, `system_settings`) have RLS enabled with **no policies at all**, meaning they're accessible only via service-role code paths. This is intentional (confirmed via the `security_stabilization` migration's own comments) — don't "fix" it by adding permissive policies without understanding why it's locked down this way.

## Error Handling

- API errors return JSON with an `error` field and an appropriate HTTP status — client code (`boost-payments.js`/`subscription-payments.js`) surfaces these via `alert()`. There is no toast/notification system; errors are blocking browser alerts by design in the current UI.
- Every payment-adjacent write is wrapped to fail loudly (`throw`/non-2xx response) rather than silently continuing with bad data — except analytics logging (`api/_analytics.js`'s `logActivity`), which is explicitly best-effort and swallows its own errors so a logging failure can never block a real payment. If Boost analytics ever look incomplete, check whether `logActivity` calls are silently failing (they log to console but don't alert) before assuming purchases themselves are failing.

## Incident Response

1. **Identify scope**: one user, or everyone? Check Vercel logs for whether errors are isolated or broad.
2. **If it's a payment-path issue**: cross-reference Razorpay's dashboard immediately — it's the ground truth for whether money actually moved, independent of what this app's database shows.
3. **If it's broad and code-related**: roll back the Vercel deployment first (`DEPLOYMENT_GUIDE.md` → Rollback Procedure), diagnose after service is restored, not before.
4. **If it's a webhook-specific issue**: check Razorpay's webhook delivery log for the HTTP status/response Razorpay received — a 400 (signature mismatch) vs. a 500 (server error) vs. a timeout point to different root causes (env var misconfiguration, a code bug, or a Vercel platform issue, respectively).
5. **Communicate**: there is no status page or user-facing incident communication mechanism built into this product. Any user-facing communication during an incident is a manual, out-of-band action (email, WhatsApp, etc.) — not something this system automates.

## Backup Strategy

- Supabase manages automated backups at the platform level; the specific retention/PITR window depends on the project's billing plan — **confirm this directly in the Supabase dashboard's Database → Backups settings**, it was not visible via the tools used in this review.
- No application-level backup/export process exists in this codebase beyond what Supabase provides natively.
- Before any manually-run, non-additive database operation (a correction, a bulk update, anything that isn't a reviewed migration file), export the affected rows first — this project's own history includes at least one instance of manually written SQL causing unintended side effects when run without first snapshotting the affected data (see `DATABASE_MIGRATION_PLAN.md`'s account of an earlier normalization migration that had to be made more defensive after a narrower version caused a production failure).

## Support Workflow

- The support ticket system (`support.html` → `/api/create-ticket` → `support_tickets`/`ticket_messages`) exists and is rate-limited (3 tickets per 15 minutes per user), but has **no admin reply UI built yet** (Phase 4 of the roadmap, not in RC1) — admin responses today would require direct database access, which is not a sustainable support workflow at any real volume.
- For payment disputes specifically: cross-reference the trainer's `boost_purchases`/`subscription_payments` row (via Supabase dashboard) against their claim, and against Razorpay's own transaction record, before taking any corrective action.
- For "my Boost isn't working" reports: check, in order — (1) is `boost_purchases` for that trainer `status = 'paid'`? (2) is `profiles.boost_expires_at` set and in the future? (3) does the trainer's search ranking actually reflect it against a comparable peer? Each of these three checks isolates a different possible failure point (payment didn't complete, activation didn't run, or — the defect fixed in this RC — ranking wasn't reading the field at all).
