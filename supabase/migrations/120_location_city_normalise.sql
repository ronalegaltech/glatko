-- 120_location_city_normalise.sql
-- Normalise glatko_professional_profiles.location_city to the city SLUG.
--
-- DURUM: UYGULANDI — 2026-09-09, glatko-prod (cjqappdfyxgytdyeytwv), Supabase MCP
--   apply_migration, ad "120_location_city_normalise". (Dosyadaki BEGIN/COMMIT
--   sarmalayicisi olmadan gonderildi; apply_migration kendi islemini aciyor.
--   Post-condition DO blogu aynen kosturuldu ve gecti.)
--   CI migration kosturmuyor — bu dosyanin varligi tek basina uygulama demek degil.
--
-- UYGULAMA ONCESI OLCUM (2026-09-09, 08-16 ile ayni: uc haftada yeni sapma yok):
--   "Budva" 1 satir, "hercegNovi" 1 satir. Ikisi de is_active AND is_verified,
--   9 ve 7 hizmet kayitli — yani sayima GERCEKTEN giriyorlardi.
-- UYGULAMA SONRASI DOGRULAMA:
--   budva 12 → 13, herceg-novi 2 → 3. Off-slug yazim kalmadi.
--
-- ⚠ BASLIKTAKI ESIK IDDIASI BUGUNUN VERISIYLE TUTMUYOR (2026-09-09 olculdu):
--   Asagida "Herceg Novi ... may currently be one row short of pages it already
--   qualifies for" yaziyor. Olculdu: >= 3 esigini gecen TEK BIR kategori×sehir
--   kombinasyonu yok. hercegNovi satiri bir catering saglayicisi ve 7 catering
--   kategorisini 0 → 1 yapiyor; diger iki herceg-novi saglayicisiyla hicbir
--   kategoride ortusmuyor. Sayim hatasi GERCEK (sehir ikiye bolunuyordu) ama
--   bugun yayimlanan sayfa sayisini degistirmiyor. Kategoriler ortustugu anda
--   degistirecekti — onarim yine de dogru.
--
-- ⚠ YAZMA YOLU HALA NORMALLESTIRMIYOR: bu onarim bugunku veriyi duzeltir, ama
--   uretimdeki pro paneli profil sayfasinda sehir alani SERBEST METIN input
--   (app/[locale]/pro/dashboard/profile/page.tsx, HEAD) — normalizasyon yok.
--   Sapma yeniden olusabilir. Kalici cozum bu dalin (fix/location-city-slug-
--   normalisation) commit edilip deploy edilmesi; bkz. 121 baslgi.
--
-- WHY
--   The column is grouped on directly by the city-scoped RPCs (migration 060:
--   glatko_provider_count_by_category_city and glatko_liquid_combinations both
--   GROUP BY p.location_city). Anything that is not the canonical slug becomes
--   its own city, so one municipality's providers get counted as two — and the
--   count is what the >= 3 publishing threshold is measured against. This is a
--   threshold bug, not a cosmetic one.
--
--   Measured in production 2026-08-16, two rows are off-slug:
--     "Budva"       1 row  (display NAME)  alongside budva       12
--     "hercegNovi"  1 row  (i18n KEY)      alongside herceg-novi  2
--   So Budva is really 13 and Herceg Novi really 3 — and 3 is exactly the
--   publishing threshold, meaning Herceg Novi may currently be one row short of
--   pages it already qualifies for.
--
--   Root cause is in the write path, not the data: the forms disagree about what
--   they post. OnboardingForm and ProfileForm post `c.name`, the health
--   directory posts `c.slug`, and something posted `c.key`. The companion commit
--   adds lib/glatko/cities.ts toCitySlug() and applies it in the two server
--   actions that persist the column, so new rows cannot drift again.
--
-- SCOPE
--   Only the two known off-slug spellings are rewritten, by exact match. A blanket
--   lower(replace(...)) is deliberately avoided: the column is free text by design
--   (providers outside the 25 municipalities enter their own city) and a general
--   transform would silently rewrite those too.

BEGIN;

UPDATE glatko_professional_profiles SET location_city = 'budva'
 WHERE location_city = 'Budva';

UPDATE glatko_professional_profiles SET location_city = 'herceg-novi'
 WHERE location_city = 'hercegNovi';

-- Post-conditions: neither spelling may survive, and the two municipalities must
-- now be single groups.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM glatko_professional_profiles
   WHERE location_city IN ('Budva', 'hercegNovi');
  IF n <> 0 THEN RAISE EXCEPTION 'Normalize edilmemis % satir kaldi', n; END IF;

  SELECT count(*) INTO n FROM (
    SELECT lower(replace(location_city, '-', '')) AS folded
      FROM glatko_professional_profiles
     WHERE location_city IN ('budva', 'herceg-novi', 'Budva', 'hercegNovi')
     GROUP BY 1
  ) g;
  IF n <> 2 THEN RAISE EXCEPTION 'Beklenen 2 sehir grubu, bulunan %', n; END IF;
END $$;

COMMIT;
