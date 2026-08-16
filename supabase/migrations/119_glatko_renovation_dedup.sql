-- 119_glatko_renovation_dedup.sql
-- Renovation & Construction taxonomy dedup: 2 duplicate pairs merged.
--
-- FILES-ONLY: this migration is NOT applied to production by this commit.
-- Preconditions were verified against real prod data through PostgREST on
-- 2026-08-16 (counts below). Apply to prod only after explicit approval.
-- (Supabase MCP is not authorised in this session, so the BEGIN..ROLLBACK
--  dry-run that 085 used could not be run; the numbers below come from
--  reading the live tables instead, and the migration re-checks them itself.)
--
-- WHY
--   Migration 039 (G-CAT-6) bulk-inserted "89 missing subcategories across 10
--   parent categories". Its idempotency guard is
--       NOT EXISTS (SELECT 1 FROM glatko_service_categories WHERE slug = 'X')
--   which tests the SLUG only, never the name. Under renovation-construction the
--   trades it wanted to add already existed, so the new rows were given a
--   `-renov` suffix to dodge the slug collision — and the catalogue ended up with
--   two rows for the same trade, carrying the same display name:
--
--     plumbing   (P0, 2026-03-24)  "Plumbing"    ↔  plumbing-renov   (039, 2026-05-02) "Plumbing"
--     electrical (P0, 2026-03-24)  "Electrical"  ↔  electrical-renov (039, 2026-05-02) "Electrical"
--
--   Names are byte-identical in 6 of the 9 locales. The three that differ are not
--   a distinction either: `ar` differs only by the definite article
--   (سباكة / السباكة), `tr` only by capitalisation (Su Tesisatı / Su tesisatı),
--   `sr` only by script (Водоинсталација / Vodoinstalacija). Only the
--   electrical pair has a real near-synonym, me/sr Elektrika vs Elektroinstalacija
--   — still the same trade, both under the renovation root.
--
--   The decisive evidence that these are duplicates and not two concepts:
--   5 of the 7 plumbers and 5 of the 8 electricians are registered on BOTH rows.
--   That is what a provider does when the picker shows one label twice.
--
--   Live symptom (verified 2026-08-16, all four HTTP 200):
--     /en/services/electrical/podgorica       → "Electrical — Podgorica | Glatko"
--     /en/services/electrical-renov/podgorica → "Electrical — Podgorica | Glatko"
--     /en/services/plumbing/podgorica         → "Plumbing — Podgorica | Glatko"
--     /en/services/plumbing-renov/podgorica   → "Plumbing — Podgorica | Glatko"
--   Two indexable URLs per trade with identical title/H1, and the matcher splits
--   one trade's supply across two category ids.
--
-- SURVIVORS: the P0 originals (`plumbing`, `electrical`).
--   They are is_p0 = true, created 2026-03-24, and `electrical` is already the
--   slug the hand-written cost/FAQ content is keyed to. The companion commit
--   moves the `plumbing-renov` content keys onto `plumbing` (lib/glatko/pricing.ts
--   + dictionaries/*.json) so both survivors are consistent.
--
-- EFFECT ON THE LIQUIDITY GATE (prod numbers, 2026-08-16, threshold 3):
--   plumbing/podgorica     3 → 5   (plumbing-renov/podgorica was 5)
--   electrical/podgorica   6 → 6   (electrical-renov's 4 Podgorica pros are a
--                                   subset of electrical's 6)
--   Both survivors stay liquid, so no published page is lost — the two retired
--   URLs 308 to them (middleware.ts). Podgorica goes from 6 published service
--   pages to 4, and no trade loses coverage.
--
-- NOT TOUCHED
--   * Two more 039 duplicates of the same class exist under this root and are
--     deliberately left alone here: painting ↔ painter, tiling ↔ tile-ceramic.
--     Their names DO differ in 8-9 locales, so they do not produce the identical
--     -title symptom, and neither has a published city page today. They are a
--     separate editorial decision (which label is canonical), not a hotfix.
--   * search_text is GENERATED ALWAYS AS STORED (migration 014) — it recomputes
--     from name/description, so it is intentionally not written here.
--   * No name/description is edited. This migration only merges and retires.
--
-- REVERSIBILITY
--   The merge deletes the overlapping glatko_pro_services rows (the table has
--   UNIQUE(professional_id, category_id), so a plain repoint would violate it).
--   Those rows cannot be reconstructed afterwards, so PART 0 records every row
--   the migration removes or repoints into a backup table, and 119_rollback.sql
--   replays it. 085 had no such table; this is the one deliberate departure.

BEGIN;

-- ---------- PART 0: BACKUP (makes the rollback exact) ----------
CREATE TABLE IF NOT EXISTS glatko_taxonomy_merge_backup_119 (
  id            bigserial PRIMARY KEY,
  entity        text NOT NULL,           -- 'pro_service_deleted' | 'pro_service_moved' | 'service_request_moved'
  row_id        uuid,                    -- source row id where one exists
  professional_id uuid,
  dead_slug     text NOT NULL,
  survivor_slug text NOT NULL,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- PART A: MERGE THE 2 DUP PAIRS ----------
DO $$
DECLARE p RECORD; s_id uuid; d_id uuid; n_dup int; n_moved int; n_req int;
BEGIN
  FOR p IN SELECT * FROM (VALUES
      ('plumbing-renov',   'plumbing'),
      ('electrical-renov', 'electrical')
  ) AS t(dead, survivor) LOOP
    SELECT id INTO s_id FROM glatko_service_categories WHERE slug = p.survivor;
    SELECT id INTO d_id FROM glatko_service_categories WHERE slug = p.dead;
    IF s_id IS NULL OR d_id IS NULL THEN
      RAISE EXCEPTION 'Slug bulunamadi: % / %', p.survivor, p.dead;
    END IF;

    -- Guard: both rows must sit under the same parent, otherwise this is not the
    -- duplicate we diagnosed and the merge must not proceed silently.
    IF (SELECT parent_id FROM glatko_service_categories WHERE id = s_id)
       IS DISTINCT FROM
       (SELECT parent_id FROM glatko_service_categories WHERE id = d_id) THEN
      RAISE EXCEPTION 'Farkli ebeveyn: % ve % ayni kokun altinda degil', p.dead, p.survivor;
    END IF;

    -- A1. Providers registered on BOTH rows: the duplicate link is dropped.
    INSERT INTO glatko_taxonomy_merge_backup_119
           (entity, row_id, professional_id, dead_slug, survivor_slug)
    SELECT 'pro_service_deleted', ps.id, ps.professional_id, p.dead, p.survivor
      FROM glatko_pro_services ps
     WHERE ps.category_id = d_id
       AND EXISTS (SELECT 1 FROM glatko_pro_services x
                    WHERE x.professional_id = ps.professional_id
                      AND x.category_id = s_id);

    DELETE FROM glatko_pro_services ps
     WHERE ps.category_id = d_id
       AND EXISTS (SELECT 1 FROM glatko_pro_services x
                    WHERE x.professional_id = ps.professional_id
                      AND x.category_id = s_id);
    GET DIAGNOSTICS n_dup = ROW_COUNT;

    -- A2. Providers only on the dead row: repointed to the survivor.
    INSERT INTO glatko_taxonomy_merge_backup_119
           (entity, row_id, professional_id, dead_slug, survivor_slug)
    SELECT 'pro_service_moved', ps.id, ps.professional_id, p.dead, p.survivor
      FROM glatko_pro_services ps WHERE ps.category_id = d_id;

    UPDATE glatko_pro_services SET category_id = s_id WHERE category_id = d_id;
    GET DIAGNOSTICS n_moved = ROW_COUNT;

    -- A3. Existing requests follow the survivor so history stays reachable.
    INSERT INTO glatko_taxonomy_merge_backup_119
           (entity, row_id, dead_slug, survivor_slug)
    SELECT 'service_request_moved', sr.id, p.dead, p.survivor
      FROM glatko_service_requests sr WHERE sr.category_id = d_id;

    UPDATE glatko_service_requests SET category_id = s_id WHERE category_id = d_id;
    GET DIAGNOSTICS n_req = ROW_COUNT;

    -- A4. Retire the duplicate. Kept as a row (not deleted) so any FK we have not
    -- enumerated still resolves, and so the 308 in middleware.ts has something to
    -- point away from rather than a 404 in the catalogue.
    UPDATE glatko_service_categories
       SET is_active = false, sort_order = 999
     WHERE id = d_id;

    RAISE NOTICE '% -> % : % mukerrer link silindi, % link tasindi, % talep tasindi',
                 p.dead, p.survivor, n_dup, n_moved, n_req;
  END LOOP;
END $$;

-- ---------- PART B: POST-CONDITIONS (fail the transaction, not production) ----------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM glatko_service_categories
   WHERE slug IN ('plumbing-renov','electrical-renov') AND is_active;
  IF n <> 0 THEN RAISE EXCEPTION 'Retire edilmemis dup kaldi: %', n; END IF;

  SELECT count(*) INTO n FROM glatko_pro_services ps
    JOIN glatko_service_categories c ON c.id = ps.category_id
   WHERE c.slug IN ('plumbing-renov','electrical-renov');
  IF n <> 0 THEN RAISE EXCEPTION 'Dup kategoride % pro_services satiri kaldi', n; END IF;

  SELECT count(*) INTO n FROM glatko_service_requests sr
    JOIN glatko_service_categories c ON c.id = sr.category_id
   WHERE c.slug IN ('plumbing-renov','electrical-renov');
  IF n <> 0 THEN RAISE EXCEPTION 'Dup kategoride % talep kaldi', n; END IF;

  -- The whole point of the merge: no two ACTIVE siblings may share an en name.
  SELECT count(*) INTO n FROM (
    SELECT c.parent_id, c.name->>'en' AS en
      FROM glatko_service_categories c
     WHERE c.is_active AND c.parent_id IS NOT NULL
     GROUP BY 1,2 HAVING count(*) > 1
  ) dups WHERE dups.en IN ('Plumbing','Electrical');
  IF n <> 0 THEN RAISE EXCEPTION 'Ayni ebeveyn altinda hala mukerrer en ad var'; END IF;
END $$;

COMMIT;
