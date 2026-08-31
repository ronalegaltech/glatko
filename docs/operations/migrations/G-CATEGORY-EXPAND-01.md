# G-CATEGORY-EXPAND-01 — Category system expansion

**Date applied:** 2026-05-10
**Project:** `glatko-prod` (`cjqappdfyxgytdyeytwv`)
**Branch / PR:** `hotfix/category-expand-01`

---

## Why

Helena's outreach to 22 founding majstor candidates surfaced 6 candidates whose services had no matching category in `glatko_service_categories`. Soft launch is May 13–14; the missing-category problem was a P0 launch-blocker since the wizard couldn't be completed without a primary category, and the front page / search results would surface no provider in those niches.

Rohat hand-wrote the brief on 2026-05-10 covering 22 changes across 7 main categories. Two slug pre-flight collisions were discovered during Phase 1 audit and resolved per Rohat's "Option C" call. Final shape: **20 ops** (18 inserts + 2 updates) in a single atomic transaction.

---

## Decisions

1. **Two slug collisions, Option C resolution:**
   - `carpet-washing` already existed (Halı Yıkama / Pranje tepiha). Brief intent was a label expansion → executed as **UPDATE** to broaden the label to "Halı Yıkama & Halı Derin Temizlik" / "Pranje tepiha i dubinsko čišćenje tepiha" / "Carpet washing & deep cleaning".
   - `auto-detailing` already existed (Oto kuaför/detay / Auto detailing/poliranje). Brief asked for "Auto Detailing" — only a Title Case difference vs. the existing label, no meaningful UX change → **skipped entirely**.
   - Result: brief's 22-op count → final 20-op count. The 22 → 20 reduction is the Option C scope (carpet stays UPDATE not INSERT, auto-detailing not touched).

2. **Tapetar TR translation:** Brief gave "Tapetar" but that's a Slavic loanword with limited TR recognition. Used **"Döşeme / Tapetör"** for `upholstery.name->'tr'` so Turkish users see the standard term first with the Slavic loanword as a hint. Other locales use Rohat's brief copy.

3. **`repair-service` (new main):**
   - icon: `"Wrench"` (Lucide-allowlisted at `lib/utils/categoryIcon.ts`)
   - is_p0: `true` (matches the other 7 main categories — features on homepage tile grid immediately)
   - hero_image_url: `NULL` for now. Rohat will produce a Midjourney image and add it via a separate one-line `UPDATE … SET hero_image_url = '/categories/repair-service.webp'` after the asset uploads.

4. **SR alphabet:** majority of new INSERT rows used **Latin SR** mirroring ME (matches dominant pattern in DB — sample of 12 random subs found 10 Latin / 2 Cyrillic). The exception is `carpet-washing`'s UPDATE — its existing SR was Cyrillic ("Прање тепиха") and per G-CATEGORY-DEDUPE-01 precedent, we **preserved the Cyrillic** rather than normalize alphabet here. Cross-table SR-Latin/Cyrillic standardization is deferred to the future `G-SR-LOCALE-AUDIT` sprint.

5. **`description` jsonb / `faqs` jsonb:** all new rows have `description = NULL` and `faqs = '[]'::jsonb` (matches all newly-added subs in prior G-FOUNDING-ONBOARD-01 / Phase 1.5 prior subs).

6. **Translation provenance:**
   - TR / EN / RU / ME — directly from Rohat's hand-written brief
   - SR — Latin-mirrors-ME for new rows (carpet-washing kept Cyrillic per #4 above)
   - DE / IT / UK / AR — Cursor-translated, native-quality where possible. Native review post-launch is pending and noted under "Pending" below.

---

## Final shape — 20 ops

### 2 UPDATEs

| target | id | change |
|---|---|---|
| `ac-installation` (Klima Montaj) | `256afb71-5fab-4adc-b4b5-3e629e70b4ff` | `name` jsonb relabeled in all 9 locales |
| `carpet-washing` | `7079885a-aded-4767-81e9-57f5f906bde7` | `name` jsonb expanded; SR stays Cyrillic |

### 1 NEW main category

`repair-service` — Tamir & Servis, Wrench icon, sort 15, is_p0=true, is_active=true.

### 17 NEW subcategories under existing or new parents

| slug | parent slug | sort_order |
|---|---|---|
| `ac-deep-cleaning` | renovation-construction | 18 |
| `upholstery` | renovation-construction | 19 |
| `facade-works` | renovation-construction | 20 |
| `rough-construction` | renovation-construction | 21 |
| `machine-plastering` | renovation-construction | 22 |
| `custom-furniture` | renovation-construction | 23 |
| `alu-pvc-joinery` | renovation-construction | 24 |
| `auto-body` | automotive | 19 |
| `auto-painting` | automotive | 20 |
| `electronics-repair` | repair-service | 1 |
| `phone-repair` | repair-service | 2 |
| `laptop-repair` | repair-service | 3 |
| `tv-repair` | repair-service | 4 |
| `console-repair` | repair-service | 5 |
| `car-rental` | moving-transport | 18 |
| `b2b-space-decoration` | events-wedding | 11 |
| `pressure-washing` | garden-pool | 11 |

### Atomic transaction summary

- 5 pre-flight guards (existing rows present, new slugs free, parents present)
- 2 UPDATE statements
- 1 CTE-binding INSERT (1 main + 5 children of repair-service)
- 1 multi-row INSERT (12 children under existing parents)
- 3 inline asserts before COMMIT (18 new rows present, 5 repair-service kids present, all 9-locale coverage verified)
- Single `COMMIT;`

---

## Post-run verification

All 7 SELECTs returned the expected shape; no hard-stops triggered.

### A. New main row
```
slug: repair-service | tr: Tamir & Servis | me: Popravke i servis
icon: Wrench | sort_order: 15 | is_p0: true | is_active: true
```

### B. 5 subs under repair-service
```
electronics-repair  | Elektronik Tamir   | sort 1
phone-repair        | Telefon Tamiri     | sort 2
laptop-repair       | Laptop Tamiri      | sort 3
tv-repair           | TV Tamiri          | sort 4
console-repair      | Oyun Konsolu Tamiri| sort 5
```

### C. Klima Montaj rename verified
```
slug: ac-installation
tr: Klima Montaj + Remont + Servis
me: Montaža, remont i servis klime
en: AC Installation, Repair, Service
```

### D. carpet-washing rename verified (SR Cyrillic preserved)
```
slug: carpet-washing
tr: Halı Yıkama & Halı Derin Temizlik
me: Pranje tepiha i dubinsko čišćenje tepiha
en: Carpet washing & deep cleaning
sr: Прање тепиха и дубинско чишћење тепиха
```

### E. Per-parent sub counts
| parent | before | after | delta |
|---|---|---|---|
| home-cleaning | 15 | 15 | 0 (carpet UPDATE only) |
| renovation-construction | 17 | 24 | +7 |
| automotive | 18 | 20 | +2 |
| moving-transport | 16 | 17 | +1 |
| events-wedding | 10 | 11 | +1 |
| garden-pool | 10 | 11 | +1 |
| repair-service (NEW) | — | 5 | +5 |
Total mains: 15 → 16.

### F. 9/9 locale coverage
20/20 rows in the verification window are complete (every locale key present). 0 incomplete.

### G. Founding pros service counts UNCHANGED
| # | name | services |
|---|---|---|
| 1 | OttoWin | 1 |
| 2 | Ela Hilal Pastacı | 1 |
| 3 | nana painter | 1 |
| 4 | ElektroEXPERT | 2 |
| 5 | Tobefit pilates studio | 2 |
| 6 | Zeze | 7 |
| 7 | Yat yap | 5 |
| 8 | Cleaning Service Morija | 6 |
| 9 | Dyt. Seren Hilalogullari… | 1 |
| 10 | Miloš Golubović | 4 |

Matches pre-sprint state byte-for-byte. No collateral damage.

---

## Rollback procedure

Two pre-run row dumps were saved before the transaction:
- [`rollback/G-CATEGORY-EXPAND-01-ac-installation-pre.json`](./rollback/G-CATEGORY-EXPAND-01-ac-installation-pre.json)
- [`rollback/G-CATEGORY-EXPAND-01-carpet-washing-pre.json`](./rollback/G-CATEGORY-EXPAND-01-carpet-washing-pre.json)

If a regression appears post-launch:

```sql
BEGIN;

-- Step 1: Delete 18 new rows by slug list
DELETE FROM glatko_service_categories
WHERE slug IN (
  'repair-service',
  'electronics-repair', 'phone-repair', 'laptop-repair', 'tv-repair', 'console-repair',
  'ac-deep-cleaning', 'upholstery', 'facade-works', 'rough-construction',
  'machine-plastering', 'custom-furniture', 'alu-pvc-joinery',
  'auto-body', 'auto-painting',
  'car-rental', 'b2b-space-decoration', 'pressure-washing'
);

-- Step 2: Restore ac-installation pre-state from the JSON dump
UPDATE glatko_service_categories
SET name = '<paste name jsonb from rollback file>'::jsonb
WHERE id = '256afb71-5fab-4adc-b4b5-3e629e70b4ff';

-- Step 3: Restore carpet-washing pre-state
UPDATE glatko_service_categories
SET name = '<paste name jsonb from rollback file>'::jsonb
WHERE slug = 'carpet-washing';

COMMIT;
```

If providers have already been linked to the new categories via `glatko_pro_services`, the `DELETE` on `glatko_service_categories` will hit the FK and fail. In that case the rollback first needs `DELETE FROM glatko_pro_services WHERE category_id IN (…)` for the affected categories — but that's the kind of rollback that should be re-decided with Rohat at the time, not pre-scripted.

---

## Pending

- **`/categories/repair-service.webp`** hero image: Rohat will produce via Midjourney post-launch and apply via:
  ```sql
  UPDATE glatko_service_categories
  SET hero_image_url = '/categories/repair-service.webp'
  WHERE slug = 'repair-service';
  ```
- **Native AR / DE / IT / UK speaker review** — translations are Cursor-generated to native-quality but should be eyeballed by a real speaker post-launch and corrected if needed (separate post-launch feedback sprint).

## Out of scope (separate sprints)

- `G-SR-LOCALE-AUDIT` — Cyrillic vs Latin SR consistency across the entire DB
- `G-CATEGORY-AUDIT-01` — sweep for other duplicate categories beyond office-moving
- Description JSONB content per category (post-launch SEO sprint)
- FAQ content per category (post-launch SEO sprint)
- Auto-detailing capitalization tweak (Option C deemed it not worth a sprint slot)
- Hero image generation for the other 13 main categories (separate creative sprint when Helena identifies gaps)
