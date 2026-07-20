# Implementation Roadmap — Onlifit Feature Completion

*Companion to `PROJECT_HANDOFF.md` (status/history) and `DATABASE_MIGRATION_PLAN.md` (schema detail). This file is the phase-by-phase execution plan for what comes next.*

## Where things stand right now

- 10 commits sitting locally on `main`, unpushed, working tree clean — see `PROJECT_HANDOFF.md` §2.
- Zero migrations applied. Zero Boost/taxonomy/support-widget/blog-CMS code written.
- The ranking algorithm (`compareTrainersForRanking`) is the one exception — it's **fully implemented and committed** (`2401f0a`), not just proposed, because it needed no schema change.
- The user paused all further code/commits/pushes specifically to get this documentation written before continuing.

## Before doing anything else in the next session

1. **Get explicit approval on `DATABASE_MIGRATION_PLAN.md`** — the user's own instruction was "verify before coding... only then implement." Don't apply any migration without a clear go-ahead in that conversation, even if this document exists — documentation isn't the same as approval, and schema changes to production with 15 real user rows are not reversible casually.
2. **Re-confirm push status** — the user has repeatedly said "do not push" across multiple turns. Don't push the existing 10 commits (or any new ones) without an explicit, fresh instruction to do so in the new conversation.
3. **Do not re-run the audits already done.** `PROJECT_HANDOFF.md` §3 documents four rounds of QA (auth flows, settings/uploads, dashboards/admin/nav, sitewide dead-code, sitewide syntax check, live schema introspection) already completed this arc. Re-running them wastes the user's time and this session's budget — trust the findings, spot-check only if something seems to have changed.

## Phase 1 — Apply approved migrations

Apply from `DATABASE_MIGRATION_PLAN.md` in the order the user confirms (see that file's "Sequencing Recommendation" — Boost and taxonomy are independent of each other, blog SEO is independent of both). Use the Supabase MCP tools (`apply_migration`, `project_id: lnbsgnfrhewdqhuqqotx`) directly against production — this session has real working access to do that, confirmed. After each migration: verify with `list_tables`/`execute_sql` (read-only) that the column/table exists as expected before writing any code against it.

## Phase 2 — Boost payment flow

1. `api/create-boost-order.js` — modeled on the existing `api/create-subscription-order.js`, creates a `boost_purchases` row (`status: 'created'`) + a Razorpay order for ₹499 (3-day) or ₹999 (7-day, current prices already shown on `pricing.html`).
2. `api/verify-boost-payment.js` — modeled on `api/verify-subscription-payment.js`, verifies the Razorpay signature, updates the `boost_purchases` row to `status: 'paid'`, sets `starts_at`/`expires_at`, and writes `profiles.boost_expires_at`.
3. Webhook: decide whether to extend `api/razorpay-subscription-webhook.js` or add a dedicated `api/razorpay-boost-webhook.js` — check whether Razorpay order `notes`/tags can distinguish a boost order from a subscription order to route correctly if sharing one webhook.
4. Re-enable the two "Coming Soon" buttons on `pricing.html` (`<button type="button" disabled title="Boost purchases are coming soon">Coming Soon</button>` — search for that exact string) — wire to the new order-creation endpoint, add a payment modal/flow (Razorpay checkout.js, same pattern as the existing subscription purchase flow in `subscription-payments.js` — reuse that pattern, don't invent a new one).
5. `bookings.html` dashboard: new section showing active boost status, remaining time (countdown from `boost_expires_at`), and "Boost Again" CTA once expired.
6. Verify end-to-end: purchase → webhook fires → `boost_expires_at` set → trainer appears with a higher rank in `trainers.html` search (already automatic once the column has a value, per the ranking algorithm) → dashboard reflects status immediately → after expiry, ranking naturally stops boosting them (no cleanup job required, see migration plan's expiry-handling note) and the dashboard shows the boost as expired.

**STATUS: implemented (2026-07-21).** Actual implementation deviated from the plan above in ways approved before coding: the webhook extends the existing `api/razorpay-subscription-webhook.js` (one URL) rather than adding a dedicated boost webhook, branching by looking the order id up directly in `boost_purchases`/`subscription_payments` rather than trusting `notes.type` propagation (Razorpay doesn't guarantee order notes carry onto the payment entity a webhook delivers); `create-boost-order.js` reuses a recent (<1h) unpaid order instead of minting a duplicate on every buy-flow open; `boost_purchases` gained purchase-history + invoice display (print-to-PDF, no new backend) in `bookings.html`; `admin-dashboard.html` gained a Boost Analytics section (revenue, active count, failures, expiries).

**Known limitation, by design, not an oversight:** refunds are a manual admin action only. `activate_boost_purchase()` does not automatically recompute `profiles.boost_expires_at` when one of several stacked purchases is refunded — correctly replaying the remaining valid purchases in order is materially harder than the activation path and isn't justified without real refund volume. If a refund is needed: an admin sets `boost_purchases.status = 'refunded'` + `refunded_at`, and must manually decide (by inspecting the trainer's other non-refunded purchases) whether `profiles.boost_expires_at` needs a manual correction. No UI exists for this yet — it's a direct database action today. Revisit if refund volume ever makes automation worth the complexity.

## Phase 3 — Search taxonomy sync

For each of the three new array columns (`services`, `languages`, `target_audience`) plus `availability`:
1. Lock down the exact vocabulary/values for each facet (a fixed list, matching the pattern already used for goal tags) **before** writing any UI — changing vocabulary after trainers have picked values means a data cleanup migration later.
2. Add checkbox/multi-select UI to `trainer-onboarding.html`.
3. Add the same UI to **both** `settings.html` and `bookings.html`'s settings tab (the duplication — see `PROJECT_HANDOFF.md` §4/§18 — means every field needs adding twice until that's resolved).
4. Add filter UI to `trainers.html`, matching the existing goal-chip/price/rating filter patterns already there.
5. Decide (with the user, don't assume) whether these new facets also become homepage (`onlifit.html`) quick-filter chips, or stay `trainers.html`-only.
6. Add display to `trainer-profile.html` and, if wanted, the shared trainer-card renderer in `auth.js`.
7. Test the full loop explicitly, the way the user asked: homepage/trainers.html search for a value → a trainer with that value actually appears → filtering by it actually narrows correctly.

## Phase 4 — Support ticket widget (no AI)

1. Floating widget UI — a button in the corner of every page (need a shared include pattern; there's no existing "shared header/footer partial" mechanism beyond `footer-component.js`'s auto-inject, so decide: a new `support-widget.js` that self-injects on every page the same way, or manual `<script>` tags added to every HTML file — the self-injecting-script approach matches the existing `footer-component.js` precedent and touches fewer files).
2. Widget opens to: a short static FAQ/help panel (no AI — answer the most common Onlifit questions with plain content) with a "Still need help? Create a ticket" fallback.
3. Ticket creation reuses the existing `/api/create-ticket` endpoint (already rate-limited, already writes to `support_tickets`) — don't duplicate that logic.
4. User-side: a way to view their own ticket(s) and the threaded replies (`ticket_messages` where `is_internal = false`) — probably a simple panel in the widget itself, or a link to a dedicated "My Tickets" view.
5. Admin-side: new section in `admin-dashboard.html` — list tickets (filter by status), open one to see the thread, reply (writes to `ticket_messages` with `sender_id` = admin, `is_internal = false` for a real reply or `true` for an internal note), and status controls (in_progress/resolved/closed — these map directly to the existing `support_tickets.status` check constraint, no new values needed).
6. AI layer: explicitly deferred. If picked back up, needs a provider decision (Anthropic/OpenAI/other), an API key in the environment, and a new endpoint (e.g. `api/support-chat.js`) with a system prompt scoped to Onlifit's actual real features — **do not let the AI describe features that don't exist**, the same false-advertising problem already found and fixed once on the pricing page this arc.

## Phase 5 — Blog CMS completion

1. Apply migration 7, add the 3 new fields to the admin blog form in `admin-dashboard.html`.
2. `blog-post.html`: render `<title>`/`<meta name="description">` from the new fields (fall back to existing `title`/`description` if empty, don't require every post to have them retroactively).
3. Related trainers: render using `related_trainer_ids` + the existing shared trainer-card component — don't build a new card renderer.
4. Verify "Find Trainer" CTA exists and points somewhere sensible (`trainers.html`) — check before assuming it needs to be built from scratch.

## Phase 6 — Still-deferred polish (lower priority than 1–5, but not forgotten)

From the Product Polish sprint, explicitly not done due to time:
- "How Onlifit Works" section: more interactive, tasteful (not overdone) animations.
- Testimonials: more of them, realistic (not obviously-AI-sounding) placeholder content, improved carousel.
- Join Us page: spacing/hierarchy fixes, Onlifit Black section repair/redesign, trim FAQs to only Onlifit-relevant ones.
- Full 10-breakpoint (320/360/375/390/414/768/1024/1280/1440 + tablet) QA sweep across every page — only `pricing.html`, `onlifit.html`, `trainers.html`, and `trainer-profile.html` have been thoroughly breakpoint-tested this arc.
- The 7 orphaned onboarding fields (`PROJECT_HANDOFF.md` §18) — needs its own decision, not bundled into any phase above.
- The `hover:scale-105`/`hover:translate-y-[-8px]` sitewide dead-CSS finding (`PROJECT_HANDOFF.md` §18) — needs a dedicated pass with real visual verification, not a blind bulk patch.
- A real human/authenticated walkthrough of signup → onboarding → dashboard (this assistant cannot do this itself — no credentials, and creating an account is out of scope for it to do unilaterally).
- RLS policy confirmation directly in the Supabase dashboard (this assistant's attempts to probe this live were correctly blocked by safety guardrails — needs a human with dashboard access).

---

## NEW CHAT BOOTSTRAP

Paste this into a new conversation to continue without repeating any of the work already done:

> Continue work on the Onlifit project. Read `PROJECT_HANDOFF.md`, `DATABASE_MIGRATION_PLAN.md`, and `IMPLEMENTATION_ROADMAP.md` in the repo root, in that order, before doing anything else.
>
> Current state: 10 commits sit locally on `main`, unpushed (working tree clean) — do not push without an explicit fresh instruction to do so. Zero database migrations have been applied yet; `DATABASE_MIGRATION_PLAN.md` is a proposal that needs explicit approval before any migration is run, even though this documentation exists. The ranking algorithm rewrite is the one feature that's actually done and committed (not just proposed) — everything else in the Feature Completion phase (Boost payments, search taxonomy, support ticket widget, blog CMS SEO fields) is planned but not built.
>
> Do not re-run the QA audits already documented in `PROJECT_HANDOFF.md` §3 (auth flows, settings/uploads, dashboards/admin/nav, sitewide dead-code sweep, sitewide `node --check` syntax verification, live production schema introspection) — trust those findings unless something looks like it's changed.
>
> Two design decisions were already made and should not be re-litigated: (1) no AI chatbot yet — build the support ticket widget and admin reply flow using the `support_tickets`/`ticket_messages` tables that already exist in production, add AI later once a provider/API key is chosen; (2) "Services" gets its own dedicated `services text[]` column (not folded into the existing `tags` array), and "Availability" becomes real day + time-of-day structured data (`availability jsonb`), not full calendar-slot scheduling.
>
> First step: confirm with the user whether to proceed with the migrations in `DATABASE_MIGRATION_PLAN.md` as written, then follow `IMPLEMENTATION_ROADMAP.md` phase by phase (migrations → Boost payment flow → taxonomy sync → support widget → blog CMS → deferred polish items). This session has real, working Supabase MCP tool access (`project_id: lnbsgnfrhewdqhuqqotx`) to apply migrations directly — they may be deferred tools requiring a `ToolSearch` call to surface if not already visible.
