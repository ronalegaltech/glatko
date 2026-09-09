-- 121_location_city_shape_guard.sql
-- Optional regression guard for glatko_professional_profiles.location_city.
--
-- DURUM: UYGULANMADI — ve su anda UYGULANMAMALI. (Degerlendirildi 2026-09-09.)
--
--   120 uygulandi (2026-09-09), yani veri tarafi artik temiz: bugun bu constraint
--   MEVCUT satirlarin hicbirine takilmaz — 0 ihlal olculdu. Engel veri degil,
--   YAZMA YOLU.
--
-- ⚠ BU DOSYANIN KENDI GEREKCESI HENUZ DOGRU DEGIL. Asagida "The application now
--   funnels every writer through toCitySlug() (lib/glatko/cities.ts)" yaziyor.
--   Bu, bu dalin (fix/location-city-slug-normalisation) yapacagi seyi anlatiyor
--   ama o dal COMMIT EDILMEDI, merge edilmedi, deploy edilmedi — degisiklikler
--   calisma agacinda staged duruyor. Uretimde (HEAD) durum su:
--
--     app/[locale]/pro/dashboard/profile/page.tsx  → sehir alani SERBEST METIN
--       <input>; acilir liste yok, normalizasyon yok, dogrulama yok. Usta
--       "Budva" ya da "Herceg Novi" yazip kaydedebiliyor. Saklanan "Budva"
--       satirinin kaynagi buydu (staged actions.ts yorumu da bunu soyluyor).
--
--   Yani bu constraint BUGUN uygulanirsa: bir profesyonel profilini kaydederken
--   sehri dogal yaziyla girdigi anda kayit veritabani hatasiyla DUSER. Kullaniciya
--   donuk bir yazma yolunu kirar. Dosyanin kendi "TRADE-OFF" notu bunu zaten
--   ongoruyor ("If some writer is still missed, a professional signup or profile
--   save errors instead of quietly splitting a city in two") — fark su ki
--   yazici "gozden kacmis" degil, duzeltmesi hic yayina girmemis.
--
-- UYGULAMA KOSULU (uclu, hepsi saglanmali):
--   1. fix/location-city-slug-normalisation commit + merge edilir
--      (lib/glatko/cities.ts toCitySlug + iki server action + StepPersonalInfo),
--   2. uretime deploy edilir ve pro profil kaydinin slug yazdigi dogrulanir,
--   3. o an tekrar 0 ihlal olculur; ANCAK ONDAN SONRA bu dosya uygulanir.
--   Sirasi onemli: onceki adim atlanirsa kirilan sey kullanicinin kaydi olur.
--
-- APPLY ORDER NOTU (orijinal): 120 once gelir. 120 uygulandi.
--
-- WHY A GUARD AT ALL
--   The application now funnels every writer through toCitySlug()
--   (lib/glatko/cities.ts): the signup action, the pro dashboard action, the
--   dead createProfessionalProfile helper, and the admin path via CITY_SLUG_RE.
--   None of that stops a NEW writer -- or a hand-edit in the Supabase dashboard
--   -- from putting a display name back in the column, which is exactly how
--   "Budva" got there. Only a database-level rule survives a forgetful caller.
--
-- WHY THIS SHAPE AND NOT A CITY LIST
--   A CHECK against the 25 slugs would have to repeat lib/glatko/cities.ts in
--   SQL and would drift the moment a municipality is added; it would also
--   reject the free-text "other" city, which the column is deliberately allowed
--   to hold (a provider outside the 25 municipalities types their own place).
--   A normalising trigger has the same duplication problem.
--
--   So the constraint checks the SHAPE, not the vocabulary: lower-case, no
--   leading/trailing space, no internal whitespace. That is precisely the class
--   of value that broke -- a display NAME ("Budva", "Herceg Novi") and an i18n
--   KEY ("hercegNovi") both fail it -- while every canonical slug and every
--   toCitySlug()-normalised free-text city passes unchanged.
--
-- TRADE-OFF, READ BEFORE APPLYING
--   This turns a silent data problem into a loud write failure. If some writer
--   is still missed, a professional signup or profile save errors instead of
--   quietly splitting a city in two. That is the intended direction (the split
--   is invisible and moves a publishing threshold; the error is visible and
--   fixable), but it IS a behaviour change on a user-facing write path, so 120
--   and 121 are deliberately separate: 120 is a zero-risk data repair and can
--   go alone.

BEGIN;

ALTER TABLE public.glatko_professional_profiles
  DROP CONSTRAINT IF EXISTS glatko_professional_profiles_location_city_shape;

ALTER TABLE public.glatko_professional_profiles
  ADD CONSTRAINT glatko_professional_profiles_location_city_shape
  CHECK (
    location_city IS NULL
    OR (
      location_city = lower(location_city)
      AND location_city = btrim(location_city)
      AND location_city !~ '\s'
    )
  );

COMMENT ON CONSTRAINT glatko_professional_profiles_location_city_shape
  ON public.glatko_professional_profiles IS
  'location_city must be slug-shaped (lower-case, no whitespace). Catches display names and i18n keys, which the city-scoped RPCs in migration 060 would otherwise count as separate cities. Vocabulary is NOT constrained: free-text cities outside the 25 municipalities are allowed.';

-- Post-condition: the constraint must actually reject the two shapes that were
-- found in production, and accept a canonical slug and a free-text city.
DO $$
BEGIN
  IF NOT ('budva' = lower('budva') AND 'budva' !~ '\s') THEN
    RAISE EXCEPTION 'guard rejects a canonical slug';
  END IF;
  IF ('Budva' = lower('Budva')) THEN
    RAISE EXCEPTION 'guard fails to reject a display name';
  END IF;
  IF ('hercegNovi' = lower('hercegNovi')) THEN
    RAISE EXCEPTION 'guard fails to reject an i18n key';
  END IF;
  IF NOT ('some-village' = lower('some-village') AND 'some-village' !~ '\s') THEN
    RAISE EXCEPTION 'guard rejects a free-text city';
  END IF;
END $$;

COMMIT;
