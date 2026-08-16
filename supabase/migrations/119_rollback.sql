-- 119_rollback.sql — undo 119_glatko_renovation_dedup.sql
--
-- Exact, because 119 recorded every row it removed or repointed into
-- glatko_taxonomy_merge_backup_119. Run only if the merge has to be reverted;
-- the backup table is the only thing that makes the deleted duplicate
-- glatko_pro_services rows recoverable.
--
-- Note: this restores the DATA. The 308s in middleware.ts and the content-key
-- move in lib/glatko/pricing.ts + dictionaries/*.json are code and must be
-- reverted with the companion commit, otherwise /services/plumbing-renov/*
-- keeps redirecting to a page whose cost table has moved.

BEGIN;

-- 1. Reactivate the retired duplicates (sort_order restored to their 039 values).
UPDATE glatko_service_categories SET is_active = true, sort_order = 11 WHERE slug = 'plumbing-renov';
UPDATE glatko_service_categories SET is_active = true, sort_order = 12 WHERE slug = 'electrical-renov';

-- 2. Send the repointed rows back to the dead category.
DO $$
DECLARE b RECORD; d_id uuid;
BEGIN
  FOR b IN SELECT * FROM glatko_taxonomy_merge_backup_119 ORDER BY id LOOP
    SELECT id INTO d_id FROM glatko_service_categories WHERE slug = b.dead_slug;
    IF d_id IS NULL THEN RAISE EXCEPTION 'Slug bulunamadi: %', b.dead_slug; END IF;

    IF b.entity = 'pro_service_moved' THEN
      UPDATE glatko_pro_services SET category_id = d_id WHERE id = b.row_id;

    ELSIF b.entity = 'service_request_moved' THEN
      UPDATE glatko_service_requests SET category_id = d_id WHERE id = b.row_id;

    ELSIF b.entity = 'pro_service_deleted' THEN
      -- Re-create the link that was dropped for the UNIQUE(professional_id,
      -- category_id) constraint. id is reused so a second rollback is a no-op.
      INSERT INTO glatko_pro_services (id, professional_id, category_id)
      VALUES (b.row_id, b.professional_id, d_id)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- 3. The backup has been replayed; drop it so a later re-run cannot double-apply.
DROP TABLE glatko_taxonomy_merge_backup_119;

COMMIT;
