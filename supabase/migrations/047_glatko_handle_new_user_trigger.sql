-- ═══════════════════════════════════════════════════════════════════════════
-- G-EMAIL-AUDIT-01 migration 047: signup → profile bridge (capture only)
-- ═══════════════════════════════════════════════════════════════════════════
-- Captured from glatko-prod 2026-05-10 via the G-EMAIL-AUDIT-01 audit.
-- Originally added via Supabase dashboard with no migration record; this
-- file captures the live state so:
--   1. Fresh environments (staging, local, future projects) can replay it.
--   2. There is an audit trail in the repo for the trigger pair.
--   3. Future code changes that touch signup flow can review the contract.
--
-- DO NOT re-apply to glatko-prod — these objects already exist there.
--
-- supabase_migrations.schema_migrations ledger is absent in this project
-- (the supabase CLI was not used as the canonical migration runner; SQL
-- has been hand-applied via the dashboard). Backfilling the ledger is
-- tracked separately as G-MIGRATION-LEDGER-AUDIT.
--
-- ── How the trigger pair works ──────────────────────────────────────────
--
-- profiles.email is NOT NULL but the application's register flow does not
-- pass `email` when it upserts into profiles. The two triggers below make
-- the constraint always succeed:
--
--   1. on_auth_user_created (AFTER INSERT on auth.users) → handle_new_user
--      Primary path: when supabase.auth.signUp creates an auth.users row,
--      this trigger immediately INSERTs the matching profiles row with
--      email pre-populated from auth.users.email.
--
--   2. trg_populate_profile_email (BEFORE INSERT on profiles)
--      → glatko_populate_profile_email
--      Defense-in-depth: if any code path INSERTs into profiles without
--      passing email (the register page does this), this trigger backfills
--      email from auth.users.email keyed on the new id, before the row
--      hits the NOT NULL constraint.
--
-- Together they form a no-NULL guarantee that the audit confirmed:
-- 44/44 profiles in production have email populated and matching their
-- auth.users.email.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. handle_new_user — primary signup → profile bridge.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Kurucu VIP'),
    'user'
  );
  RETURN NEW;
END;
$function$;

-- 2. glatko_populate_profile_email — defense-in-depth backfill on direct
--    profile inserts (e.g. dashboard scripts, or a code path that bypasses
--    auth.signUp).
CREATE OR REPLACE FUNCTION public.glatko_populate_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NEW.email IS NULL THEN
    SELECT email INTO NEW.email
    FROM auth.users
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Triggers — drop-then-create for idempotency.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_populate_profile_email ON public.profiles;
CREATE TRIGGER trg_populate_profile_email
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.glatko_populate_profile_email();
