-- ═══════════════════════════════════════════════════════════════════════════
-- 118 — DISPATCH ATTEMPTS: GEO KAPISI ÖLÇÜMÜ + ŞEHİR DAĞILIMI (E1 + E2)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Dayanak: 2026-08-01 dry-run ölçümü (docs/glatko-dispatch-status.md, Adım 3).
-- Üç senaryo BEGIN/ROLLBACK içinde çalıştırıldı ve iki şey ilk kez ölçüldü:
--
--   (1) GEO KAPISI FİİLEN DEVRE DIŞI. S1 ve S2'de eşleşmelerin %100'ü
--       dist_km = NULL ile geçti (8/8 ve 7/7). Eşleşen sağlayıcıların
--       hiçbirinde location_point yok — prod genelinde 42'nin 1'inde dolu.
--       Sonuç: service_radius_km 42/42 dolu ama ÖLÜ VERİ, çünkü
--       034:147-148'deki kapı `dist_km IS NULL OR …` koluyla koşulsuz geçiyor.
--
--   (2) EŞLEŞME COĞRAFİ SINIR TANIMIYOR. Budva'da açılan bir plumbing-renov
--       talebi 7 sağlayıcıya ulaştı: podgorica 5, tivat 1, bar 1, budva 0.
--       Yani "arz var talep yok" hücreleri bir arz açığı DEĞİL.
--
-- Bu iki gerçek bugün hiçbir yerde KAYDEDİLMİYOR. 116'nın kolonları
-- (candidate_pool_size, total_matches) elemenin OLDUĞUNU gösterir ama
-- NEREDEN geldiğini göstermez. Bu migration o ayrımı kalıcı hale getirir.
--
-- NEDEN ŞİMDİ — SPRINT D KAPISI:
-- Sprint D (location_point backfill) geo kapısını CANLANDIRACAK. O an bugün
-- 7 sağlayıcıya ulaşan Budva talebi 0'a düşebilir. Etkiyi ölçmenin tek yolu,
-- backfill ÖNCESİNDE oranın kayda geçmiş olmasıdır. Bugünkü taban: 100/0.
-- Sprint D'nin sert kapısı: docs/operations/dispatch-sprint-plan.md
--
-- SPRINT SINIRI — BU MIGRATION EŞLEŞTİRME DAVRANIŞINI DEĞİŞTİRMEZ:
-- yalnızca üç kolon ekler. Kimin bildirim aldığı AYNI kalır.
-- Kolonları dolduran kod A2'dedir ve ayrı PR'dır (bu dosyaya karışmaz).
--
-- TABLO BOŞ: glatko_dispatch_attempts 0 satır (2026-08-01), dolayısıyla
-- ADD COLUMN anlıktır ve backfill sorusu yoktur.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. E1 — geo kapısı ölçümü ────────────────────────────────────────────
--
-- NULL SEMANTİĞİ 116 İLE AYNI VE KASITLI:
--   NULL = ölçülemedi (RPC dönmedi / enstrümantasyon hesaplayamadı)
--   0    = gerçekten sıfır eşleşme bu koldan geçti
-- İkisini birleştirmek, 116'nın candidate_pool_size'da ayırmak için var
-- olduğu hatanın aynısını bir seviye aşağıda üretirdi.

ALTER TABLE public.glatko_dispatch_attempts
  ADD COLUMN IF NOT EXISTS matches_without_distance INTEGER NULL,
  ADD COLUMN IF NOT EXISTS matches_with_distance    INTEGER NULL,
  ADD COLUMN IF NOT EXISTS matched_cities           JSONB   NULL;


-- ─── 2. Kısıtlar ──────────────────────────────────────────────────────────
--
-- ADD CONSTRAINT'in IF NOT EXISTS'i yok; pg_constraint üzerinden guard.
--
-- SEMANTİK ÇAPRAZ KISIT YİNE EKLENMİYOR (116 karar 1 aynen geçerli):
-- beklenen ilişki `matches_with_distance + matches_without_distance
-- = total_matches`'tir, ama CHECK olarak yazılmaz — enstrümantasyon yazımı
-- try/catch içindedir ve bir CHECK ihlali, tam olarak kaydetmek için inşa
-- ettiğimiz satırı sessizce düşürür. Uygulama tarafında sağlanır.

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'glatko_dispatch_attempts_geo_counts_check') THEN
    ALTER TABLE public.glatko_dispatch_attempts
      ADD CONSTRAINT glatko_dispatch_attempts_geo_counts_check
      CHECK ((matches_without_distance IS NULL OR matches_without_distance >= 0)
         AND (matches_with_distance    IS NULL OR matches_with_distance    >= 0));
  END IF;

  -- matched_cities bir NESNE olmalı (dizi/skaler değil). Şekil garantisi:
  -- {"podgorica": 5, "tivat": 1}
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'glatko_dispatch_attempts_matched_cities_check') THEN
    ALTER TABLE public.glatko_dispatch_attempts
      ADD CONSTRAINT glatko_dispatch_attempts_matched_cities_check
      CHECK (matched_cities IS NULL OR jsonb_typeof(matched_cities) = 'object');
  END IF;
END
$mig$;


-- ─── 3. Belgeleme ─────────────────────────────────────────────────────────

COMMENT ON COLUMN public.glatko_dispatch_attempts.matches_without_distance IS
'E1: dist_km NULL olduğu için geo kapısından KOŞULSUZ geçen eşleşme sayısı
(034:147-148 fail-open kolu). NULL = ölçülemedi, 0 ile aynı şey DEĞİL.
2026-08-01 tabanı: eşleşmelerin %100''ü bu koldan geçiyordu (dry-run S1 8/8,
S2 7/7) çünkü 42 sağlayıcının 41''inde location_point NULL.
Sprint D backfill''i bu sayıyı düşürecek — düşüşün ölçüsü bu kolondur.';

COMMENT ON COLUMN public.glatko_dispatch_attempts.matches_with_distance IS
'E1: mesafesi fiilen hesaplanıp yarıçap kontrolünden geçen eşleşme sayısı.
NULL = ölçülemedi. 2026-08-01 tabanı: 0.
matches_with_distance / total_matches oranı, geo kapısının ne kadar canlı
olduğunun tek göstergesidir. Bugün 0/8 ve 0/7.';

COMMENT ON COLUMN public.glatko_dispatch_attempts.matched_cities IS
'E2: eşleşen sağlayıcıların ŞEHİR DAĞILIMI, örn. {"podgorica":5,"tivat":1,"bar":1}.
PII SINIRI: sağlayıcı id''si veya adı SAKLANMAZ — yalnızca şehir başına sayım.
request_city ile birlikte okunduğunda "talep hangi şehirden, teklif hangi
şehirden" sorusunu cevaplar; bu bilgi bugün hiçbir yerde tutulmuyor.
Şehir değerleri sağlayıcı tarafının HAM location_city''sidir (normalize
edilmeden) — request_city ile aynı gerekçe, sprint F öncesi/sonrası
karşılaştırılabilsin.
2026-08-01 dry-run: Budva''da açılan talep {"podgorica":5,"tivat":1,"bar":1}
üretti, budva 0 — arz açığı olmadığının kanıtı.';

COMMENT ON TABLE public.glatko_dispatch_attempts IS
'Sprint A: her eşleştirme-dispatch çağrısının kaydı. SIFIR EŞLEŞME DE SATIR
ÜRETİR — "hiç çalışmadı" ile "çalıştı, kimseyi bulamadı" ayrımı bu tabloyla
yapılır (öncesinde ikisi de sıfır satırdı ve ayırt edilemiyordu).
Sprint A/118: geo kapısı ölçümü (matches_with/without_distance) ve eşleşen
sağlayıcıların şehir dağılımı (matched_cities) eklendi — Sprint D''nin
etkisini ölçebilmek için taban veri.
Saklama niyeti: 24 ay. UYGULANMADI — karar Sprint A''da kayda geçti.
PII: alıcı bilgisi saklanmaz; sağlayıcı kimliği matched_cities''te de yoktur
(yalnızca şehir sayımı). Talep sahibi request_id üzerinden erişilebilir.';
