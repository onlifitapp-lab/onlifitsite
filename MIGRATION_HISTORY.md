# Migration History — Onlifit

*Written 2026-07-21. This document reconciles `supabase/migrations/` (the local filesystem) with `supabase_migrations.schema_migrations` (the authoritative record of what has actually been applied to production project `lnbsgnfrhewdqhuqqotx`). No already-applied migration's SQL body has been edited or renamed to produce this document — see "What was and wasn't changed" at the end.*

## Chronological migration history

| # | Version | Name | Local file | Applied? | Status |
|---|---|---|---|---|---|
| 1 | `20260101000001` | `phase1_marketplace_foundation` | ✅ exists, version matches | ✅ yes | Historical + partially current (see deep-dive below) |
| 2 | `20260101000002` | `phase1_6_email_verification_sync` | ✅ exists, version matches | ✅ yes | Current, no conflict |
| 3 | `20260101000003` | `phase2_client_enquiries` | ✅ exists, version matches | ✅ yes | Current, no conflict |
| 4 | `20260101000004` | `security_stabilization` | ✅ exists, version matches | ✅ yes | Current, no conflict |
| 5 | `20260716060847` | `phase4_subscription_payments` | ⚠️ exists as `20260101000005_phase4_subscription_payments.sql` — **version drift** | ✅ yes | Current, no conflict, but filename version ≠ recorded version |
| 6 | `20260716070020` | `add_onboarding_completed_column` | ⚠️ exists as `20260101000006_add_onboarding_completed_column.sql` — **version drift** | ✅ yes | Current, no conflict, but filename version ≠ recorded version |
| 7 | `20260719200550` | `add_boost_expires_at_to_profiles` | ✅ created 2026-07-21 (this session) | ✅ yes | Current |
| 8 | `20260719200609` | `create_boost_purchases_table` | ✅ created 2026-07-21 | ✅ yes | Current |
| 9 | `20260719200637` | `add_structured_taxonomy_to_profiles` | ✅ created 2026-07-21 | ✅ yes | Current |
| 10 | `20260719200656` | `add_availability_to_profiles` | ✅ created 2026-07-21 | ✅ yes | Current |
| 11 | `20260719200714` | `add_trainer_verification_lifecycle_to_profiles` | ✅ created 2026-07-21 | ✅ yes | Current — **supersedes** migration 1's `verification_status` section |
| 12 | `20260719200759` | `add_response_time_to_profiles` | ✅ created 2026-07-21 | ✅ yes | Historical only — its CHECK constraint was replaced by #16 the same day |
| 13 | `20260719200814` | `add_blog_metadata` | ✅ created 2026-07-21 | ✅ yes | Current |
| 14 | `20260719200908` | `add_search_keywords_to_profiles` | ✅ created 2026-07-21 | ✅ yes | Current |
| 15 | `20260719201056` | `lock_down_new_migration_functions` | ✅ created 2026-07-21 | ✅ yes | Current |
| 16 | `20260719201538` | `fix_response_time_constraint_to_match_live_form` | ✅ created 2026-07-21 | ✅ yes | Current — **supersedes** #12's constraint |
| 17 | `20260719201549` | `fix_black_eligibility_verification_value` | ✅ created 2026-07-21 | ✅ yes | Current — **supersedes** #1's `check_onlifit_black_eligibility()` body |

All 17 versions above are confirmed present in `supabase_migrations.schema_migrations` via the `list_migrations` tool, which reads that table directly — not inferred from file contents or dates.

## Which migrations have been superseded

Three supersession relationships exist, none of them a full file replacement — each is a narrow, specific override of one part of an earlier migration:

1. **#1's `verification_status` section (item 6 in that file) is superseded by #11.** #1 established `pending`/`approved`/`rejected` as the vocabulary; #11 renamed `approved`→`verified` and added `under_review`. Everything else in #1 (`system_settings`, `client_enquiries`, `profile_completion_score` trigger, `subscription_plan`/`status` foundations) is **not** superseded — still the live baseline.
2. **#1's `check_onlifit_black_eligibility()` function body is superseded by #17.** The original compared `verification_status = 'approved'`; after #11 renamed that value, #17 updated the comparison to `'verified'`. The function's other logic (elite plan, active subscription, experience/rating/review thresholds) is unchanged.
3. **#12's `profiles_response_time_check` CHECK constraint is superseded by #16.** #12 invented a vocabulary (`within_1_hour` etc.) that never matched the live `trainer-onboarding.html` form; #16 replaced the constraint with the form's real values (`'< 1h'`, `'< 2h'`, etc.) the same day, before any trainer had successfully submitted with the broken constraint in place.

## Which migrations are historical only

**#12 (`add_response_time_to_profiles`)** is historical only in the sense that its CHECK constraint is dead — no row was ever validated against it in a way that matters going forward, since #16 replaced the constraint before real onboarding traffic hit it. The `ALTER TABLE ... ADD COLUMN response_time text` line is still exactly correct and current; only the constraint clause is superseded. This is why #12 is not simply "current" like most of the list — part of it is live, part of it is dead.

No other migration is historical-only in the sense of "its column/table was later dropped" — everything else added by migrations 2–17 still exists in the live schema exactly as created.

## Version drift explanation

**Why #5 and #6 differ from their recorded production version numbers:** their local filenames use the `20260101000005`/`20260101000006` prefix — following the same January 1 placeholder-date convention as files #1–4 in that batch — but Supabase's CLI assigns the actual version number **at the moment a migration is pushed/applied**, not from whatever prefix the author wrote in the filename. When these two were actually pushed to production, they were recorded under real apply-time timestamps (`20260716060847`, `20260716070020` — both from 2026-07-16, consistent with when that work actually happened), not the `20260101...` placeholder the filenames still carry locally. The **content** of both files matches what's live (confirmed: `subscription_payments` table and `onboarding_completed` column both exist exactly as those files describe) — only the filename-to-recorded-version mapping is wrong.

This is pure bookkeeping drift, not a data or schema problem. But it has a concrete consequence: if `supabase db push` is run today, the CLI computes "already applied" by checking whether a **local file's version number** appears in `schema_migrations` — not by content hash or filename. Since `20260101000005` and `20260101000006` don't appear there (the table has `20260716060847`/`20260716070020` instead), the CLI would treat these two local files as **new, unapplied migrations** and attempt to run them again.

## How a fresh environment should be bootstrapped safely

**Do not** bootstrap a fresh environment (staging, disaster recovery, a teammate's local Supabase) by simply running every file in `supabase/migrations/` in order via `supabase db push` against an empty database, for two reasons documented above:

1. File #1, if it runs at all in a from-scratch context, is fine on its own — but the **repo as a whole**, taken literally in file order, now correctly reflects the superseding migrations (#11, #16, #17) later in the sequence, so a full `supabase db push` from an empty database, in order, **does** land on the correct final state, since #11/#16/#17 run after #1/#12 and override them. This is actually now safe **specifically because** this session created files #7–17 to close the gap that existed before this document was written. Before today, a from-scratch bootstrap would have stopped at file #6 and been missing 11 migrations' worth of schema (Boost, taxonomy, verification lifecycle, search) entirely.
2. The **only** remaining risk in a from-scratch bootstrap is files #5/#6's drifted version numbers — but since a *fresh* database has no prior `schema_migrations` rows at all, there's nothing for them to conflict with in that specific scenario; they'd simply be recorded under their local filename versions instead of the real production ones. That's a cosmetic mismatch (the fresh environment's migration history won't byte-for-byte match production's), not a schema-correctness problem.

**Recommended bootstrap procedure**, given the above:
1. Run `supabase db push` against the fresh target from this repo's `supabase/migrations/` folder, in full, in order. As of this document, that produces a schema matching production.
2. Do **not** treat the fresh environment's `schema_migrations` table as identical to production's — its version numbers for the #5/#6 content will differ from production's real ones. If exact parity of the history table itself (not just the schema) ever matters, reconcile with `supabase migration repair` (see below) before relying on it.
3. Re-run `get_advisors` (security + performance) against the fresh environment after bootstrap, the same way this session did against production, since a from-scratch database applies things in one pass rather than incrementally and could theoretically surface different linter results.

## Answering the four questions about `20260101000001_phase1_marketplace_foundation.sql`

1. **Recorded in `schema_migrations`?** Yes, confirmed directly (version `20260101000001`).
2. **Can it ever be replayed?** Not through `supabase db push`/`migration up` against *this* project — those commands are version-aware and skip anything already recorded. It could only run again via: (a) manually executing its raw SQL directly (bypassing the CLI entirely), (b) manually deleting its row from `schema_migrations` first, or (c) a from-scratch bootstrap of a *different*, empty database — which, per the section above, is now safe specifically because #11/#16/#17 exist locally to override its stale sections when run afterward in sequence.
3. **Historical state only?** Partially — see supersession item 1 above. The `verification_status` section is historical/dead; the rest of the file is still live and current.
4. **Could a future deployment accidentally execute it?** Against production specifically: no, it's tracked as applied. Against a new environment bootstrapped from this repo: it will execute, but that's now correct and expected, not accidental — as long as the bootstrap runs the **full** migration folder in order (including the 11 files added today), not a partial/stale copy.

## Supabase CLI's actual filename/version requirement (verified via `search_docs`, not inferred)

Per Supabase's own CLI reference documentation (`supabase-db-push`, `supabase-migration-repair`):

> "The first time this command is run, a migration history table will be created under `supabase_migrations.schema_migrations`. After successfully applying a migration, a new row will be inserted into the migration history table **with timestamp as its unique id**. Subsequent pushes will skip migrations that have already been applied."

This confirms: **yes, filename/version alignment matters.** `db push` and `migration list` determine "already applied" purely by matching a local file's version-timestamp prefix against the version column in `schema_migrations` — not by content, not by name similarity. This is exactly why #5/#6's drift is a real (if low-severity) issue, and exactly why the 11 new files in this commit needed to use their *real* recorded versions as filenames, not new timestamps.

Supabase also documents the sanctioned fix for drift: **`supabase migration repair <version> --status applied|reverted`**, which mutates only the `schema_migrations` bookkeeping table — it does not execute any migration SQL. This is the correct tool if #5/#6's drift is ever fixed by renaming, since a rename alone would make the CLI think those two versions were never applied (nothing in `schema_migrations` would match the new filename's version) — `migration repair` would be needed alongside any rename to tell the CLI "this content already ran, just under a different recorded version." **No rename has been performed** — per your instruction, this document only explains the mechanism so a future rename decision can be made correctly rather than by inference.

## What was and wasn't changed in this session

- **Created:** 11 new migration files (`20260719200550` through `20260719201549`), each a verbatim copy of SQL already applied to production, filed under its real recorded version.
- **Created:** this document.
- **Not touched:** the SQL body of any of the 6 pre-existing local migration files. Not renamed, not edited, not reordered.
- **Not touched:** `schema_migrations` itself — no `migration repair` call was made; nothing about the recorded history changed, only the local repo's description of it.
