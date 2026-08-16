# G-CATEGORY-DEDUPE-01 — Merge duplicate "office-moving" categories

**Date applied:** 2026-05-10
**Project:** `glatko-prod` (`cjqappdfyxgytdyeytwv`)
**Author:** Rohat (decisions) + Claude (composition)
**Branch / PR:** `hotfix/category-dedupe-01`

---

## Problem

Two `glatko_service_categories` rows under the `moving-transport` root referred
to the same real-world service ("office moving") but with different slugs and
slightly different per-locale names. This would have caused two duplicate
category entries to surface on `/services/moving-transport`, fragmenting the
provider pool and confusing customers (who would see "Ofis Taşıma" twice).

| Field | A (kept) | B (dropped) |
|---|---|---|
| `id` | `a2e44973-dbc9-48a6-8904-310f3ac11dd2` | `46c24556-946e-4a3b-a928-06beeaf1bdfc` |
| `slug` | `office-moving` | `office-moving-mt` |
| `created_at` | 2026-04-30 | 2026-05-02 |
| `sort_order` | 2 | 10 |
| `icon` | `Building` | `null` |
| `is_p0` | true | false |
| `name->'me'` | `"Selidba ureda"` (formal) | `"Selidba kancelarije"` (everyday) |

---

## Decisions

1. **Canonical pick: A (`office-moving`).** Older, P0-flagged, has icon, lower sort order, verified translations in 4 locales.
2. **`name->'me'` patch on canonical:** `"Selidba ureda"` → `"Selidba kancelarije"` (Helena: everyday speech, ME+SR shared).
3. **`name->'sr'` left as Cyrillic** (`"Селидба канцеларија"`). SR alphabet consistency across the dictionary is unknown — separate `G-SR-LOCALE-AUDIT` sprint will normalize after a full audit.
4. **`glatko_service_packages` migration included defensively** even though the table was empty (Phase 1.E surfaced this FK; Rohat-approved to handle inline rather than leave dangling).

---

## Pre-flight audit (read-only, Phase 1)

| Surface | Result |
|---|---|
| Provider counts (`glatko_pro_services`) | 0 on A, 0 on B |
| Service request counts (`glatko_service_requests`) | 0 on each (table has 0 rows total) |
| Subcategories (parent_id) | 0 under either |
| Service packages (`glatko_service_packages`) | 0 on each (table has 0 rows total) |
| FK references to `glatko_service_categories.id` | 4 tables: `glatko_pro_services`, `glatko_service_categories.parent_id`, `glatko_service_packages`, `glatko_service_requests` |
| Frontend slug grep (`office-moving(-mt)?` in `app/`, `components/`, `lib/`, `dictionaries/`) | 0 hits |

No live data was migrated — the dedupe was a pure schema cleanup.
The migration was structured with full FK plumbing anyway so the same
template can be re-used when category rows have providers/requests/packages.

---

## SQL executed

```sql
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM glatko_service_categories WHERE id = '46c24556-946e-4a3b-a928-06beeaf1bdfc') THEN
    RAISE EXCEPTION 'Duplicate already gone — abort';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM glatko_service_categories WHERE id = 'a2e44973-dbc9-48a6-8904-310f3ac11dd2') THEN
    RAISE EXCEPTION 'Canonical missing — abort';
  END IF;
END $$;

UPDATE glatko_pro_services
SET category_id = 'a2e44973-dbc9-48a6-8904-310f3ac11dd2'
WHERE category_id = '46c24556-946e-4a3b-a928-06beeaf1bdfc'
  AND professional_id NOT IN (
    SELECT professional_id FROM glatko_pro_services
    WHERE category_id = 'a2e44973-dbc9-48a6-8904-310f3ac11dd2'
  );
DELETE FROM glatko_pro_services WHERE category_id = '46c24556-946e-4a3b-a928-06beeaf1bdfc';

UPDATE glatko_service_requests
SET category_id = 'a2e44973-dbc9-48a6-8904-310f3ac11dd2'
WHERE category_id = '46c24556-946e-4a3b-a928-06beeaf1bdfc';

UPDATE glatko_service_packages
SET category_id = 'a2e44973-dbc9-48a6-8904-310f3ac11dd2'
WHERE category_id = '46c24556-946e-4a3b-a928-06beeaf1bdfc';

UPDATE glatko_service_categories
SET name = jsonb_set(name, '{me}', '"Selidba kancelarije"'::jsonb)
WHERE id = 'a2e44973-dbc9-48a6-8904-310f3ac11dd2';

DELETE FROM glatko_service_categories WHERE id = '46c24556-946e-4a3b-a928-06beeaf1bdfc';

DO $$
DECLARE r INT;
BEGIN
  SELECT COUNT(*) INTO r FROM glatko_pro_services WHERE category_id = '46c24556-946e-4a3b-a928-06beeaf1bdfc';
  IF r > 0 THEN RAISE EXCEPTION 'glatko_pro_services still has % rows for duplicate', r; END IF;
  SELECT COUNT(*) INTO r FROM glatko_service_categories WHERE id = '46c24556-946e-4a3b-a928-06beeaf1bdfc';
  IF r > 0 THEN RAISE EXCEPTION 'duplicate category not deleted'; END IF;
END $$;

COMMIT;
```

Result: `Success. No rows returned`. Atomic; the inline assert pair before
the COMMIT would have rolled the whole transaction back if anything had
slipped through.

---

## Post-run verification

### V1 — Canonical row final state

```sql
SELECT id, slug, name->>'me' AS name_me, name->>'sr' AS name_sr,
       name->>'tr' AS name_tr, name->>'en' AS name_en,
       icon, sort_order, is_p0, is_active
FROM glatko_service_categories
WHERE id = 'a2e44973-dbc9-48a6-8904-310f3ac11dd2';
```

| id | slug | name_me | name_sr | name_tr | name_en | icon | sort_order | is_p0 | is_active |
|---|---|---|---|---|---|---|---|---|---|
| a2e44973-… | `office-moving` | **Selidba kancelarije** | Селидба канцеларија | Ofis Taşıma | Office Moving | Building | 2 | true | true |

`name_me` patched, all other fields unchanged. ✅

### V2 — Duplicate gone

```sql
SELECT COUNT(*) FROM glatko_service_categories
WHERE id = '46c24556-946e-4a3b-a928-06beeaf1bdfc';
```

Result: `0`. ✅

### V3 — Miloš's services intact (founding pro #10, sanity check)

```sql
SELECT sc.slug, sc.name->>'me' AS name_me, ps.is_primary
FROM glatko_pro_services ps
JOIN glatko_service_categories sc ON sc.id = ps.category_id
WHERE ps.professional_id = 'd550804c-e5f2-4046-ba77-f98857f719e0'
ORDER BY ps.is_primary DESC, sc.slug;
```

| slug | name_me | is_primary |
|---|---|---|
| home-moving | Selidba kuće | true |
| international-moving | Međunarodna selidba | false |
| local-moving | Selidba u gradu | false |
| single-item | Prevoz pojedinačnog komada | false |

4 rows, exactly 1 primary, no `office-moving-mt` (which Miloš never had anyway). ✅

---

## Rollback procedure

If a regression surfaces post-launch and the duplicate must be re-created:

1. The full row data of B at time of deletion is captured in
   [`rollback/G-CATEGORY-DEDUPE-01-duplicate-row.json`](./rollback/G-CATEGORY-DEDUPE-01-duplicate-row.json).
2. Rebuild the row with:
   ```sql
   INSERT INTO glatko_service_categories (
     id, parent_id, slug, name, description, icon, sort_order,
     is_active, hero_image_url, seasonal, active_months,
     badge_priority, is_p0, search_text, faqs, translation_status
   )
   SELECT
     id, parent_id, slug, name, description, icon, sort_order,
     is_active, hero_image_url, seasonal, active_months,
     badge_priority, is_p0, search_text, faqs, translation_status
   FROM jsonb_populate_record(NULL::glatko_service_categories, '<paste JSON>'::jsonb);
   ```
   (`created_at` regenerates with `now()`; the original 2026-05-02 stamp is in
   the JSON if you want to preserve it.)
3. Revert canonical `name->'me'`:
   ```sql
   UPDATE glatko_service_categories
   SET name = jsonb_set(name, '{me}', '"Selidba ureda"'::jsonb)
   WHERE id = 'a2e44973-dbc9-48a6-8904-310f3ac11dd2';
   ```

Since current state at time of merge is 0 providers / 0 requests / 0 packages
on either category, no row-migration reversal is needed — the rollback is
purely the row recreation + the `name->'me'` revert.

---

## Out of scope (separate sprints)

- **`G-SR-LOCALE-AUDIT`** — the wider question of whether `dictionaries/sr.json` and `glatko_service_categories.name->>'sr'` should standardize on Cyrillic or Latin script across all rows. A's sr is Cyrillic; the deleted B's sr was Latin. Held until the audit decides.
- **`G-CATEGORY-AUDIT-01`** — a full sweep for other duplicate categories. Rohat surfaced this one specifically; there may be more in the long tail (some auto-translated rows under different roots may also be near-duplicates).
- **`category_aliases` table** — proper schema-level handling of synonym/alias names, so future near-duplicates don't get re-introduced. Out of this hotfix's scope.
- **Frontend cleanup of either slug** — no cleanup needed (Phase 1.F: 0 hardcoded references).
