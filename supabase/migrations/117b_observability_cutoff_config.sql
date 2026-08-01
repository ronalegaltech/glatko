-- ═══════════════════════════════════════════════════════════════════════════
-- 117b — GÖZLEMLENEBİLİRLİK KESME NOKTASI: KALICI ÇÖZÜM (Bölüm B)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- SORUN (116'nın B2 kusuru): kesme noktası fonksiyon GÖVDESİNE literal olarak
-- gömülüydü ve `CREATE OR REPLACE` ile yazılıyordu. Migration ikinci kez
-- çalıştırılsa değer NOW()'dan yeniden alınır, kesme noktası ileri kayar ve
-- iki çalıştırma arasında oluşmuş talepler "canlı" penceresinden "legacy"
-- penceresine düşerek KPI'dan sessizce çıkardı. Yani 116'nın geri kalanı
-- idempotent'ti, bu değildi.
--
-- ÇÖZÜM: değer tek satırlık bir config tablosunda yaşar; fonksiyon onu OKUR.
-- Tohumlama `ON CONFLICT DO NOTHING` — ikinci çalıştırma hiçbir şey değiştirmez.
--
-- MEVCUT DEĞER KORUNUYOR: tohum, elle yazılmış bir literal DEĞİL — halihazırda
-- uygulanmış fonksiyonun kendi dönüşünden okunuyor. Böylece transkripsiyon
-- hatası imkânsız. 2026-08-01'de 116 uygulandığındaki değer:
--   2026-08-01 09:28:03.357322+00
-- Fonksiyon hiç yoksa (temiz kurulum) NOW() kullanılır — doğru davranış.
--
-- SIRA KRİTİK: önce tablo, sonra tohum (ESKİ fonksiyonu okur), EN SON
-- fonksiyonun değiştirilmesi. Ters sırada tohum kendi kendini okurdu.
--
-- VOLATİLİTE DEĞİŞİYOR — IMMUTABLE → STABLE: tablo okuyan bir fonksiyon
-- IMMUTABLE olamaz; 116'daki hali planlayıcıya yalan söylüyordu. Üç view
-- fonksiyonu yalnızca WHERE'de çağırıyor, indeks ifadesinde kullanmıyor →
-- STABLE uyumlu.
--
-- SECURITY DEFINER: config tablosu service_role'e kilitli, ama fonksiyonu
-- authenticated admin de (security_invoker view'lar üzerinden) çağırabilmeli.
-- Fonksiyon yalnızca bir timestamp döndürür — veri sızıntısı yüzeyi yok.
--
-- ⚠ 117a DERSİ UYGULANDI: public şemasının default ACL'i yeni tabloyu
-- otomatik olarak anon/authenticated'a grant'lar. Bu dosya açık REVOKE yazar.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Config tablosu — tek satır garantili ──────────────────────────────
--
-- id BOOLEAN PRIMARY KEY DEFAULT true + CHECK (id): tabloda yalnızca `true`
-- anahtarlı TEK satır olabilir. İkinci INSERT primary key çakışmasına düşer,
-- ON CONFLICT DO NOTHING onu yutar. Kesme noktasının çoğullaşması yapısal
-- olarak imkânsız.

CREATE TABLE IF NOT EXISTS public.glatko_observability_config (
  id         BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  cutoff_at  TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.glatko_observability_config IS
'Sprint A gözlemlenebilirlik yapılandırması — tek satır (id = true).
cutoff_at: bu andan SONRA oluşan her talebin bir glatko_dispatch_attempts
satırı olmalıdır; öncesi pre-instrumentation''dır ve yalnızca *_legacy
view''ından okunur. 116''da fonksiyon gövdesine gömülüydü ve migration''ın
tekrar çalıştırılması değeri kaydırıyordu (B2); 117b onu buraya taşıdı.
DEĞER ELLE DEĞİŞTİRİLMEZ — kesme noktasını kaydırmak geçmiş KPI''ları
yeniden yorumlar.';

COMMENT ON COLUMN public.glatko_observability_config.cutoff_at IS
'116''nın gerçek uygulanma anı (2026-08-01 09:28:03.357322+00). Tohumlama
eski fonksiyonun dönüşünden okundu, elle yazılmadı.';


-- ─── 2. Tohumlama — mevcut değeri KORUR, ikinci çağrı no-op ───────────────

DO $mig$
DECLARE
  v_cutoff TIMESTAMPTZ;
BEGIN
  -- Halihazırda uygulanmış fonksiyonun kendi değerini oku (116'dan).
  IF to_regproc('public.glatko_observability_cutoff') IS NOT NULL THEN
    EXECUTE 'SELECT public.glatko_observability_cutoff()' INTO v_cutoff;
  END IF;

  -- Fonksiyon yoksa (temiz kurulum) migration anı kesme noktası olur.
  v_cutoff := COALESCE(v_cutoff, NOW());

  INSERT INTO public.glatko_observability_config (id, cutoff_at)
  VALUES (true, v_cutoff)
  ON CONFLICT (id) DO NOTHING;   -- ← B2'nin kalıcı çözümü
END
$mig$;


-- ─── 3. Fonksiyon artık tabloyu okuyor ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.glatko_observability_cutoff()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT cutoff_at FROM public.glatko_observability_config WHERE id $$;

COMMENT ON FUNCTION public.glatko_observability_cutoff() IS
'Sprint A gözlemlenebilirlik kesme noktası. 117b''den itibaren değer
glatko_observability_config tablosundan OKUNUR (116''da gövdeye gömülüydü).
STABLE: tablo okuduğu için IMMUTABLE olamaz. SECURITY DEFINER: config tablosu
service_role''e kilitli ama security_invoker view''lar authenticated admin
olarak çağırıyor. Tek satır garantisi tabloda (id BOOLEAN PK + CHECK).';

-- 116'nın yetki duruşu korunuyor (CREATE OR REPLACE ACL'i sıfırlamaz, yine de
-- açıkça yazılıyor ki dosya tek başına okunduğunda niyet belli olsun).
REVOKE ALL ON FUNCTION public.glatko_observability_cutoff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.glatko_observability_cutoff()
  TO authenticated, service_role;


-- ─── 4. Config tablosu kilidi (117a dersi) ────────────────────────────────
--
-- Default ACL bu tabloyu da otomatik grant'ladı; açıkça geri alınıyor.
-- Okuma yolu FONKSİYONDUR (SECURITY DEFINER), tablo değil.

ALTER TABLE public.glatko_observability_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.glatko_observability_config;
CREATE POLICY "service_role_all" ON public.glatko_observability_config
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.glatko_observability_config
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.glatko_observability_config TO service_role;
