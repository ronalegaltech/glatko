-- ═══════════════════════════════════════════════════════════════════════════
-- 117a — VIEW YETKİ KİLİDİ (güvenlik düzeltmesi, Bölüm A)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bu bir hijyen migration'ı DEĞİL. İki view'da gerçek bir RLS baypas yolu var:
--
--   SECURITY DEFINER (view sahibi postgres, rolbypassrls=true)
--   + otomatik güncellenebilir view (information_schema.views.is_updatable='YES')
--   + anon/authenticated'da INSERT/UPDATE/DELETE yetkisi
--   = taban tablonun RLS'i baypas edilerek yazma
--
-- Etkilenen iki view (2026-08-01 taraması):
--   · career_worker_showcase  — DEFINER, yazılabilir, anon SELECT+YAZMA
--   · glatko_request_feed     — DEFINER, yazılabilir, anon YAZMA
--     (087a yalnızca SELECT'i revoke etmişti; INSERT/UPDATE/DELETE kalmıştı)
--
-- KÖK SEBEP: public şemasının default ACL'i (pg_default_acl, sahip=postgres,
-- nesne tipi 'r' → tablo VE view) her yeni nesneyi anon/authenticated/service_role'e
-- `arwdDxtm` ile grant'lıyor. 087a bu tuzağı biliyordu ve iki view için açık
-- REVOKE yazmıştı — ama yalnızca SELECT için. 116 ise view'ları için hiç REVOKE
-- yazmadı. Bu migration ikisini de kapatır.
--
-- YAZMA ETKİSİ YOK: kod taraması (2026-08-01, tüm .ts/.tsx, node_modules hariç)
-- bu view'ların hiçbirine INSERT/UPDATE/DELETE/UPSERT yapmıyor — hepsi .select().
-- Dolayısıyla yazma yetkilerini kaldırmak hiçbir kod yolunu bozmaz.
--
-- KAPSAM SINIRI — TABLOLARA DOKUNULMUYOR:
-- public şemasındaki tabloların tamamı da aynı default ACL'i taşıyor, ama
-- hepsinde RLS AÇIK ve gerçek kapı RLS. Ayrıca anon'un bazı yetkileri işlevsel
-- olarak gerekli (misafir talep akışı — 026_glatko_anon_request_insert_policy).
-- Toplu tablo revoke'u bilinçli olarak KAPSAM DIŞI; ayrı bir denetim işidir.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. career_worker_showcase — TAMAMEN KAPATILIYOR (anon) ───────────────
--
-- KARAR: anon erişimi (SELECT dahil) tamamen kaldırılıyor.
-- Gerekçe: kariyer dikeyi production'da 404 (CAREER_VERTICAL_ENABLED=false,
-- middleware.ts:189-190), dolayısıyla anon kullanıcısı yok; view'ın içeriği ise
-- işçi profilleridir. Kullanıcısı olmayan bir yüzeyde kişi verisini anon'a açık
-- tutmanın hiçbir karşılığı yok.
--
-- GERİ AÇMA KOŞULU: kariyer dikeyi etkinleştirilirken anon SELECT ayrı ve
-- BİLİNÇLİ bir kararla, view'ın hangi kolonları gösterdiği denetlenerek geri
-- açılır. Otomatik default ACL ile değil, açık bir GRANT ile.
--
-- authenticated SELECT KORUNUYOR: admin sayfası okuyor
-- (app/[locale]/admin/career/page.tsx:88 — showcasedWorkers sayımı).

REVOKE ALL ON public.career_worker_showcase FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.career_worker_showcase FROM authenticated;
GRANT SELECT ON public.career_worker_showcase TO authenticated;


-- ─── 2. glatko_request_feed — anon tamamen, yazma herkesten ───────────────
--
-- 087a SELECT'i anon'dan almıştı ("Job-feed + matched-request are
-- authenticated-only"), ama yazma yetkileri default ACL'den kalmıştı.
-- Bu view yazılabilir + DEFINER olduğu için asıl risk oradaydı.
--
-- Not: bu view'ın bugün TEK BİR kod referansı yok (tarama 2026-08-01).
-- 087a'nın niyeti gereği authenticated SELECT korunuyor.

REVOKE ALL ON public.glatko_request_feed FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.glatko_request_feed FROM authenticated;
GRANT SELECT ON public.glatko_request_feed TO authenticated;


-- ─── 3. glatko_matched_request — anon tamamen, yazma herkesten ────────────
--
-- Güncellenebilir değil (is_updatable='NO'), yani yazma yolu zaten kapalıydı;
-- yine de yetki bırakmanın sebebi yok. authenticated SELECT KORUNUYOR:
-- pro lead listesi bunu okuyor (glatko.server.ts:359,
-- app/[locale]/pro/dashboard/leads/page.tsx:66).

REVOKE ALL ON public.glatko_matched_request FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.glatko_matched_request FROM authenticated;
GRANT SELECT ON public.glatko_matched_request TO authenticated;


-- ─── 4. glatko_public_professionals — SELECT KALIR, yazma kapanır ─────────
--
-- Bu view'ın anon SELECT'i KASITLIDIR (087a:73) ve işlevsel olarak gereklidir:
-- misafir kullanıcı talep sihirbazında sağlayıcı okuyor
-- (components/glatko/request-service/RequestServiceWizard.tsx:222 — client
-- bileşen), ayrıca dizin ve sağlayıcı profili sayfaları.
-- Yalnızca yazma yetkileri kaldırılıyor.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.glatko_public_professionals FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.glatko_public_professionals TO anon, authenticated;


-- ─── 5. 116'nın üç view'ı — anon tamamen, yazma herkesten ─────────────────
--
-- Üçü de security_invoker=true ve WHERE'de is_admin() kapısı taşıyor, yani
-- pratik sızıntı riski düşüktü. Ama 087a'nın kurduğu standart açık REVOKE'tur
-- ve 116 onu uygulamamıştı. Standart burada tamamlanıyor.

REVOKE ALL ON public.v_glatko_requests_never_dispatched        FROM anon, PUBLIC;
REVOKE ALL ON public.v_glatko_requests_never_dispatched_legacy FROM anon, PUBLIC;
REVOKE ALL ON public.v_glatko_dispatch_attempts_missing        FROM anon, PUBLIC;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.v_glatko_requests_never_dispatched        FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.v_glatko_requests_never_dispatched_legacy FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.v_glatko_dispatch_attempts_missing        FROM authenticated;

GRANT SELECT ON public.v_glatko_requests_never_dispatched        TO authenticated;
GRANT SELECT ON public.v_glatko_requests_never_dispatched_legacy TO authenticated;
GRANT SELECT ON public.v_glatko_dispatch_attempts_missing        TO authenticated;
