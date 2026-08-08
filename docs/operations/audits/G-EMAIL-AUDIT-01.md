# G-EMAIL-AUDIT-01 — Signup → profiles.email integrity audit

**Date:** 2026-05-10
**Project:** `glatko-prod` (`cjqappdfyxgytdyeytwv`)
**Verdict:** **No production fix needed.** Migration file added for version control only.

---

## Problem

Phase 1.5 of the prior `G-HOTFIX-PRO-01` audit raised a red flag:

- `profiles.email` is declared `NOT NULL`
- The signup code at [`app/[locale]/register/page.tsx:47`](../../../app/[locale]/register/page.tsx) calls `supabase.from("profiles").upsert({ id, full_name })` — **no `email` field**
- `app/auth/callback/route.ts:59` (OAuth callback) does the same shape
- Yet 9 founding pros + Miloš (#10) had successfully signed up

How? Three possibilities (per the audit brief):

1. **Trigger pair on `auth.users` / `profiles` populates email automatically** ← the healthy hypothesis
2. The code path passes email somewhere we didn't see
3. The system is actually broken and signups have been quietly failing

The audit needed to determine which.

## Findings — Scenario 1 confirmed (defense-in-depth)

There are **two cooperating triggers** on `glatko-prod`:

### Trigger 1 — `on_auth_user_created` (AFTER INSERT on `auth.users`)

Calls `public.handle_new_user()`:

```sql
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
  new.id,
  new.email,
  COALESCE(new.raw_user_meta_data->>'full_name', 'Kurucu VIP'),
  'user'
);
```

This is the **primary mechanism**. When `supabase.auth.signUp(...)` lands a row in `auth.users`, this trigger immediately creates the matching `profiles` row with `email` pre-populated from `auth.users.email`. It also reads `raw_user_meta_data->>'full_name'` (which the registration code sets via `options.data.full_name`).

The function is `SECURITY DEFINER` so it bypasses RLS on the `profiles` table.

### Trigger 2 — `trg_populate_profile_email` (BEFORE INSERT on `profiles`)

Calls `public.glatko_populate_profile_email()`:

```sql
IF NEW.email IS NULL THEN
  SELECT email INTO NEW.email
  FROM auth.users
  WHERE id = NEW.id;
END IF;
```

This is **defense-in-depth**. If any code path INSERTs into `profiles` without `email` (e.g. a dashboard script, an admin tool, a code path that bypasses `auth.signUp`), this BEFORE INSERT trigger looks up `auth.users.email` by id and fills it in — before the `NOT NULL` constraint is enforced.

### Why both?

In the registration flow, trigger 1 runs first and produces a row with email already set. The subsequent client-side `supabase.from("profiles").upsert(...)` either UPSERT-UPDATEs the existing row (no email change) or, in the unlikely race that trigger 1 hasn't yet, falls back to INSERT and trigger 2 backfills email from `auth.users`. Either branch terminates with the row having a valid email.

## Empirical verification

Single-shot `auth.users` ↔ `profiles` consistency check, 2026-05-10:

| Metric | Value |
|---|---|
| Total `profiles` rows | 44 |
| Rows with email populated | **44** |
| Rows with NULL email | **0** |
| `auth.users` ↔ `profiles` `match` status | **44 / 44** |
| `profile_null` status | 0 |
| `auth_null` status | 0 |
| `mismatch` status | 0 |

Every signup that has ever happened on `glatko-prod` produced a profile with the correct email.

## Code paths reviewed

| File:line | Pattern | Why it works |
|---|---|---|
| [`app/[locale]/register/page.tsx:41`](../../../app/[locale]/register/page.tsx) | `supabase.auth.signUp(...)` | Triggers trigger 1 |
| [`app/[locale]/register/page.tsx:47`](../../../app/[locale]/register/page.tsx) | `profiles.upsert({id, full_name})` | UPSERT-UPDATE on the row trigger 1 already created |
| [`app/auth/callback/route.ts:59`](../../../app/auth/callback/route.ts) | `admin.from('profiles').upsert({id, full_name, updated_at})` | OAuth path; same shape |
| [`lib/actions/profile.ts:248`](../../../lib/actions/profile.ts) | `profiles.upsert(...)` | Settings page; row always pre-existing |

No code path bypasses the trigger contract. `is_founding_provider` and `founding_provider_number` paths (G-FOUNDING-ONBOARD-01) all flow through the same `profiles` row created by trigger 1.

## Hard-stop checks (per audit brief)

| Check | Result |
|---|---|
| Live signup test failed | n/a — skipped (44/44 evidence + 2-trigger redundancy ruled out additional value) |
| `profiles.email` NULL found | 0 NULLs |
| Orphans in `auth.users` (no profile) | 0 orphans |
| Trigger present but mismatch in 1.F | 0 mismatches |
| Signup endpoint errors | not surfaced |

## Decision

**No production fix.** The system is healthy and has been working for every signup ever.

For maintainability:
- Capture the trigger pair in `supabase/migrations/047_glatko_handle_new_user_trigger.sql` (idempotent CREATE OR REPLACE FUNCTION + DROP-then-CREATE TRIGGER) so fresh environments can replay it.
- Do **not** re-apply migration 047 to `glatko-prod` — the objects already exist there. The migration is for version control + replay, not deployment.

## Out of scope (separate sprints)

- **G-MIGRATION-LEDGER-AUDIT** — `supabase_migrations.schema_migrations` ledger is absent in this project. Migrations have been hand-applied via the dashboard for some objects (this trigger pair, possibly others). A backfill audit will reconcile what's in the repo vs what's actually in the DB.
- **G-CODE-DUPLICATE-PATTERNS** — the `register/page.tsx:47` profile upsert is now redundant given that `handle_new_user` creates the row. It's harmless (just a redundant UPDATE of `full_name`), but a future cleanup sprint could remove it. Not blocking; not breaking.
- **Future auth method additions** (Google OAuth, email/SMS OTP, magic links): all of these end with an `auth.users` INSERT, which means `handle_new_user` runs and the contract holds. No special-case work needed for the trigger pair, but new flows should respect this contract (i.e., don't bypass `auth.signUp` / OAuth callback to write directly to `profiles`).

## Re-running the audit

If you want to re-verify in the future:

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE p.email IS NOT NULL) AS with_email,
  COUNT(*) FILTER (WHERE p.email IS NULL) AS null_email,
  COUNT(*) FILTER (WHERE au.email = p.email) AS matched,
  COUNT(*) FILTER (WHERE au.email <> p.email OR (au.email IS NULL) <> (p.email IS NULL)) AS mismatched
FROM auth.users au
FULL OUTER JOIN public.profiles p ON au.id = p.id;
```

Should always read `total = with_email = matched`, `null_email = mismatched = 0`.
