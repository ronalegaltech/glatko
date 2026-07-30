-- ═══════════════════════════════════════════════════════════════════════════
-- SPRINT A — GÖZLEMLENEBİLİRLİK KATMANI (A1)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Problem: bugün "dispatch hiç çalışmadı" ile "dispatch çalıştı ve kimseyi
-- bulamadı" birebir aynı gözlemlenebilir durum — glatko_request_notifications
-- tablosunda sıfır satır. 25 talebin 13'ü bu durumda ve ayrımı üç ay boyunca
-- kimse yapamadı. Bu migration o ayrımı kalıcı hale getirir.
--
-- Teşhis dayanağı: docs/notification-chain-diagnosis.md
--
-- SPRINT SINIRI — BU MIGRATION EŞLEŞTİRME DAVRANIŞINI DEĞİŞTİRMEZ:
--   · kategori join'ine dokunulmuyor          (sprint E)
--   · şehir normalizasyonuna dokunulmuyor     (sprint F)
--   · location_point backfill'i yapılmıyor    (sprint D)
--   · RLS politikaları değiştirilmiyor        (sprint B)
--   · tetikleme topolojisi değiştirilmiyor    (sprint C)
--   · hiçbir talep geri-dispatch edilmiyor
--   · mevcut tabloya ALTER yok — yalnızca ekleme
-- Kimin bildirim aldığı bu migration'dan SONRA da AYNI kalır. Yalnızca ne
-- olduğunu kaydediyoruz.
--
-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║ ⛔ SERT ENGEL — PREDİKAT ÇİFTLENMESİ (Sprint A / E1)                     ║
-- ║                                                                         ║
-- ║ Aday havuzu predikatı bu migration'dan sonra İKİ yerde yaşıyor:         ║
-- ║   1) 034_glatko_matching_algorithm.sql:140-141                          ║
-- ║      (glatko_get_request_matches — gerçek eşleştirme)                   ║
-- ║   2) bu dosya, glatko_dispatch_request_notifications içindeki sayım      ║
-- ║      (candidate_pool_size — yalnızca ölçüm)                             ║
-- ║                                                                         ║
-- ║ SPRINT E DoD ZORUNLU MADDESİ:                                           ║
-- ║   Kategori join'i değiştirilirse İKİSİ AYNI COMMIT'te güncellenecek.    ║
-- ║   Aksi halde candidate_pool_size sessizce yanlış olur ve gözlemlenebi-  ║
-- ║   lirlik katmanı yalan söylemeye başlar — yani bu sprintin öldürmek     ║
-- ║   için var olduğu hata sınıfı bir seviye yukarıda geri gelir.           ║
-- ║   Sprint E, iki predikat eşitlenmeden KAPANMAZ.                         ║
-- ║                                                                         ║
-- ║ Bugün ikisi her talep için aynı sonucu veriyor (25/25 ölçüldü). Bu      ║
-- ║ VERİNİN TESADÜFÜ, yapının garantisi DEĞİL: geo kapısı fail-open ve      ║
-- ║ 42 sağlayıcının 41'inde location_point NULL. Sprint D backfill'i geo    ║
-- ║ kapısını canlandırınca iki sayı ayrışır.                               ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
--
-- NUMARALANDIRMA NOTU: origin/main üzerindeki en yüksek migration 090'dır.
-- 091-115 aralığı, henüz merge edilmemiş health branch'ine (feat/health-
-- doktortakvimi-parity) ait olduğu için REZERVE edilmiştir. Bu dosya 116'dan
-- devam eder; 090 → 116 arasındaki boşluk kasıtlıdır ve zararsızdır (migration'lar
-- lexical sırayla ve elle küratörlü partiler halinde uygulanıyor, bkz.
-- docs/career/APPLY-TO-PROD-073-078.sql — bitişiklik gerekmiyor).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Gözlemlenebilirlik kesme noktası ──────────────────────────────────
--
-- EK 2 gereği: kesme noktası migration'ın GERÇEK çalışma zamanıdır, bugünün
-- gece yarısı değil. Aksi halde migration deploy'undan önce aynı gün gelen bir
-- talep legacy view'a girmez (created_at kesmeden sonra) ama canlı view'a girer
-- (attempt satırı yok) → birinci günden yanlış alarm, yani kesme noktasının
-- önlemek için var olduğu şey.
--
-- now() değeri BURADA yakalanıp fonksiyon gövdesine LİTERAL olarak gömülür.
-- View tanımında now() bırakılmaz — sorgu anında değerlendirilir ve pencere kayar.
-- Tek kaynak: üç view de bu fonksiyonu okur, kesme noktası ayrışamaz.

DO $mig$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW();
BEGIN
  EXECUTE format(
    $ddl$
    CREATE OR REPLACE FUNCTION public.glatko_observability_cutoff()
    RETURNS TIMESTAMPTZ
    LANGUAGE sql
    IMMUTABLE
    AS $body$ SELECT %L::TIMESTAMPTZ $body$;
    $ddl$,
    v_cutoff
  );
END
$mig$;

COMMENT ON FUNCTION public.glatko_observability_cutoff() IS
'Sprint A gözlemlenebilirlik kesme noktası — migration 116''nın gerçek çalışma
zamanı, literal olarak gömülü. Bu andan SONRA oluşan her talebin bir
glatko_dispatch_attempts satırı olmalıdır. Öncesi "pre-instrumentation"dır ve
yalnızca *_legacy view''ından okunur. IMMUTABLE: değer asla değişmez.';

REVOKE ALL ON FUNCTION public.glatko_observability_cutoff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.glatko_observability_cutoff()
  TO authenticated, service_role;


-- ─── 2. TABLO: glatko_dispatch_attempts ───────────────────────────────────
--
-- Her dispatch çağrısı bir satır. SIFIR EŞLEŞME DE SATIR ÜRETİR —
-- bu sprintin bütün noktası bu.

CREATE TABLE IF NOT EXISTS public.glatko_dispatch_attempts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  request_id           UUID NOT NULL
                         REFERENCES public.glatko_service_requests(id)
                         ON DELETE CASCADE,

  triggered_by         TEXT NOT NULL,
  triggered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- NULL = "RPC dönmedi, havuz bilinmiyor" (0 ile karıştırılmamalı).
  -- RPC hata verirse TS havuz boyutunu hiç öğrenemez; 0 uydurmak
  -- "havuz boştu" ile "havuz bilinmiyor"u birleştirir ve bu sprintin
  -- ayırmak için var olduğu iki durumu yeniden karıştırır.
  candidate_pool_size  INTEGER NULL,

  waitlist_count       INTEGER NOT NULL DEFAULT 0,
  total_matches        INTEGER NOT NULL DEFAULT 0,   -- geo kapısı + p_limit sonrası
  notified_count       INTEGER NOT NULL DEFAULT 0,   -- is_primary, en fazla 3

  emails_sent          INTEGER NOT NULL DEFAULT 0,
  emails_failed        INTEGER NOT NULL DEFAULT 0,

  outcome              TEXT NOT NULL,
  skip_reason          TEXT NULL,
  error_message        TEXT NULL,
  duration_ms          INTEGER NULL,

  -- Snapshot alanları: FK YOK, CHECK YOK. Kategori veya şehir sonradan
  -- değişirse/silinirse geçmiş analiz bozulmasın. request_city ham
  -- municipality değeridir ve NORMALİZE EDİLMEDEN yazılır — sprint F
  -- normalizasyonunun öncesi/sonrası karşılaştırılabilsin.
  request_category_id  UUID NULL,
  request_city         TEXT NULL,

  CONSTRAINT glatko_dispatch_attempts_triggered_by_check
    CHECK (triggered_by IN (
      'admin_moderation',   -- bugün kullanılan TEK değer
      'provider_signup',    -- sprint C, henüz üreticisi yok
      'manual_replay',      -- sprint C, henüz üreticisi yok
      'cron'                -- sprint C, henüz üreticisi yok
    )),

  CONSTRAINT glatko_dispatch_attempts_outcome_check
    CHECK (outcome IN (
      'notified',             -- satır yazıldı, e-postalar gitti
      'no_candidates',        -- RPC çalıştı, sıfır eşleşme (ESKİDEN SESSİZDİ)
      'notified_send_failed', -- satır yazıldı ama bağlam/e-posta düştü
      'skipped_status',       -- durum kapısı engelledi
      'error'                 -- RPC veya beklenmeyen hata
    )),

  CONSTRAINT glatko_dispatch_attempts_pool_nonneg_check
    CHECK (candidate_pool_size IS NULL OR candidate_pool_size >= 0),

  CONSTRAINT glatko_dispatch_attempts_counts_nonneg_check
    CHECK (waitlist_count  >= 0 AND total_matches >= 0
       AND notified_count  >= 0
       AND emails_sent     >= 0 AND emails_failed >= 0)

  -- SEMANTİK ÇAPRAZ KISIT BİLEREK EKLENMEDİ (Sprint A karar 1).
  -- Örn. "outcome='error' → error_message NOT NULL" gibi kurallar
  -- doğrudur ama CHECK olarak yazılmamalıdır: enstrümantasyon yazımı
  -- try/catch içindedir ve başarısızlıkta dispatch normal devam eder,
  -- dolayısıyla bir CHECK ihlali tam olarak kaydetmek için inşa
  -- ettiğimiz satırı sessizce düşürür. Beklenen ilişkiler:
  --   outcome='error'         → error_message dolu
  --   outcome='skipped_status'→ skip_reason dolu
  --   outcome='no_candidates' → notified_count = 0
  --   total_matches           = notified_count + waitlist_count
  -- Bunlar uygulama tarafında sağlanır, veritabanında zorlanmaz.
);

COMMENT ON TABLE public.glatko_dispatch_attempts IS
'Sprint A: her eşleştirme-dispatch çağrısının kaydı. SIFIR EŞLEŞME DE SATIR
ÜRETİR — "hiç çalışmadı" ile "çalıştı, kimseyi bulamadı" ayrımı bu tabloyla
yapılır (öncesinde ikisi de sıfır satırdı ve ayırt edilemiyordu).
Saklama niyeti: 24 ay. UYGULANMADI — karar Sprint A''da kayda geçti.
PII: alıcı bilgisi saklanmaz; talep sahibi request_id üzerinden erişilebilir.';

COMMENT ON COLUMN public.glatko_dispatch_attempts.candidate_pool_size IS
'Skorlama ÖNCESİ aday havuzu (kategori + verification_status). NULL = RPC
dönmedi, bilinmiyor — 0 ile aynı şey DEĞİL. Kaynak: glatko_dispatch_request_
notifications JSON''undaki candidate_pool_size. ⛔ E1: predikat 034:140-141
ile senkron tutulmalı.';

COMMENT ON COLUMN public.glatko_dispatch_attempts.total_matches IS
'Geo kapısı (034:188) ve p_limit=10 (034:204) sonrası döndürülen satır sayısı.
candidate_pool_size - total_matches = eleme. total_matches=10 ise eleme
limit kaynaklı, değilse geo kaynaklı.';

COMMENT ON COLUMN public.glatko_dispatch_attempts.request_city IS
'municipality alanının HAM değeri, normalize edilmeden (örn. hercegNovi,
Budva). Snapshot — FK/CHECK yok. Sprint F normalizasyonunun öncesi/sonrası
karşılaştırması için kasıtlı olarak ham bırakılır.';

CREATE INDEX IF NOT EXISTS idx_dispatch_attempts_triggered_at
  ON public.glatko_dispatch_attempts (triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_attempts_request
  ON public.glatko_dispatch_attempts (request_id);

-- (outcome) indeksi bilerek eklenmedi: tablo küçükken planner zaten
-- seq-scan seçer. Satır sayısı ~50k'yı geçtiğinde eklenmeli.


-- ─── 3. TABLO: glatko_outbound_messages ───────────────────────────────────
--
-- YALNIZCA HARİCİ KANALLAR (whatsapp/sms/viber). E-POSTA BU TABLOYA GİRMEZ.
--
-- Gerekçe: e-posta için giden durum katmanı ZATEN var ve çalışıyor —
-- public.email_events (645 satır: email_id, event_type, recipient,
-- bounce_type, bounce_message, tags, occurred_at), app/api/webhooks/resend/
-- route.ts tarafından besleniyor ve lib/email/send-email.ts hard-bounce
-- susturması için okuyor (yük taşıyor). E-postayı buraya kopyalamak, çalışan
-- tek kanal için iki doğruluk kaynağı yaratır — yani tam olarak kaçındığımız
-- körlüğü üretir. Bu kural provider CHECK'i ile VERİTABANI SEVİYESİNDE
-- zorlanır ('infobip' tek değer); yorum yeterli değildir.
--
-- Admin görünümü kanal × durum matrisini bu tablo ile email_events'i
-- BİRLEŞTİREREK gösterir (A3) — e-posta ayrı sekmede değil, aynı matriste.
-- Aksi halde körlüğü veritabanından arayüze taşımış oluruz.

CREATE TABLE IF NOT EXISTS public.glatko_outbound_messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- İki nullable FK + XOR. Polimorfik DEĞİL: gerçek referans bütünlüğü
  -- korunur, planlayıcı düzgün çalışır, konu tipi sayısı 2 ve sabittir.
  --
  -- notification_id → glatko_notifications: harici gönderimlerin GERÇEK
  --   id uzayı. dispatchExternalNotification (glatko.server.ts:1273)
  --   yalnızca bunu görür ve external_sent_at YALNIZCA bu tabloda vardır.
  -- request_notification_id → glatko_request_notifications: eşleşme
  --   kuyruğu satırı. Bugün yazılmıyor; sprint C'nin provider_signup
  --   yolu ve new_quote/status_change tipleri için hazır duruyor.
  notification_id         UUID NULL
                            REFERENCES public.glatko_notifications(id)
                            ON DELETE CASCADE,
  request_notification_id UUID NULL
                            REFERENCES public.glatko_request_notifications(id)
                            ON DELETE CASCADE,

  provider                TEXT NOT NULL,
  channel                 TEXT NOT NULL,

  -- Başarısız gönderimde sağlayıcı messageId dönmez → NULL olabilir.
  provider_message_id     TEXT NULL,

  status                  TEXT NOT NULL,
  -- Sağlayıcının ham statü adı (örn. PENDING_ENROUTE, DELIVERED_TO_HANDSET).
  -- raw payload YERİNE bu: ham payload alıcı telefonunu taşır
  -- (infobip.ts:59 messages[].to), allowlist redaksiyonu ise sonsuza kadar
  -- korunması gereken bir kural olurdu — Infobip bir alan ekler, sessizce
  -- PII sızar, kimse listeyi güncellemez. İhtiyaç duyulan her şey açık
  -- kolonlarda: status, provider_status_raw, error_code, error_description.
  provider_status_raw     TEXT NULL,

  status_updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  error_code              TEXT NULL,
  error_description       TEXT NULL,

  attempt_count           INTEGER NOT NULL DEFAULT 1,
  -- Kanal başına BİR satır. failover_seq = kaçıncı kanal denendi
  -- (1 = ilk tercih, 2 = fallback). attempt_count = aynı kanal içindeki
  -- tekrar. WhatsApp→SMS failover'ı İKİ satır üretir, bir satırda
  -- attempt_count=2 değil.
  failover_seq            INTEGER NOT NULL DEFAULT 1,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Tam olarak biri dolu (boolean XOR)
  CONSTRAINT glatko_outbound_messages_subject_xor_check
    CHECK ((notification_id IS NOT NULL) <> (request_notification_id IS NOT NULL)),

  CONSTRAINT glatko_outbound_messages_provider_check
    CHECK (provider IN ('infobip')),

  CONSTRAINT glatko_outbound_messages_channel_check
    CHECK (channel IN ('whatsapp','sms','viber')),

  CONSTRAINT glatko_outbound_messages_status_check
    CHECK (status IN (
      'queued',        -- sağlayıcı kuyruğuna kabul (Infobip groupId 1)
      'sent',
      'delivered',     -- Infobip groupId 3
      'read',
      'failed',
      'rejected',      -- Infobip groupId 5
      'expired',       -- Infobip groupId 4
      'undeliverable'  -- Infobip groupId 2
    )),

  CONSTRAINT glatko_outbound_messages_counts_check
    CHECK (attempt_count >= 1 AND failover_seq >= 1)
);

COMMENT ON TABLE public.glatko_outbound_messages IS
'Sprint A: giden HARİCİ mesaj kaydı (whatsapp/sms/viber), sağlayıcı messageId
ile. E-POSTA BURAYA GİRMEZ — public.email_events zaten çalışan katmandır ve
provider CHECK''i bunu veritabanı seviyesinde zorlar. Admin matrisi iki tabloyu
birleştirir.
PII: alıcı telefonu/e-postası SAKLANMAZ, ham sağlayıcı payload''ı SAKLANMAZ.
Alıcı bilgisi notification_id üzerinden erişilebilir.
Saklama niyeti: 24 ay. UYGULANMADI — karar Sprint A''da kayda geçti.';

COMMENT ON COLUMN public.glatko_outbound_messages.provider_message_id IS
'Sağlayıcı messageId''si. Teslim-raporu webhook''u BUNUNLA arar (partial UNIQUE).
Öncesinde yalnızca console.log''a yazılıp atılıyordu (external-dispatch.ts:306,
:329) — dolayısıyla hiçbir teslim raporu bildirime bağlanamıyordu.
Başarısız gönderimde NULL.';

-- Webhook bununla arıyor. UNIQUE: yinelenen teslim raporu çift veya
-- belirsiz satır üretmesin. Partial: başarısız gönderimlerde NULL olur ve
-- birden çok NULL UNIQUE'i ihlal etmez, ama niyeti açık yazıyoruz.
CREATE UNIQUE INDEX IF NOT EXISTS uq_outbound_provider_msgid
  ON public.glatko_outbound_messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outbound_notification
  ON public.glatko_outbound_messages (notification_id)
  WHERE notification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outbound_req_notification
  ON public.glatko_outbound_messages (request_notification_id)
  WHERE request_notification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outbound_channel_status
  ON public.glatko_outbound_messages (channel, status);

CREATE INDEX IF NOT EXISTS idx_outbound_created_at
  ON public.glatko_outbound_messages (created_at DESC);


-- ─── 4. status_updated_at bakımı (EK 3) ───────────────────────────────────
--
-- DEFAULT NOW() yalnızca INSERT'i kapsar. Webhook statüyü değiştirdiğinde
-- bu alan eskide kalırsa "delivered" satırının NE ZAMAN teslim olduğu
-- bilinmez ve teslim gecikmesi ölçülemez — sağlayıcı yanıt oranını anlamak
-- için tam olarak o gerekiyor.
--
-- Trigger tercih edildi (A2 DoD maddesi yerine): webhook'un tek yazıcı
-- kalacağı garantisi yok.
--
-- Yalnızca status GERÇEKTEN değiştiğinde dokunur — attempt_count bumpı gibi
-- ilgisiz UPDATE'ler teslim zaman damgasını sıfırlamasın.

CREATE OR REPLACE FUNCTION public.glatko_touch_outbound_status_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.glatko_touch_outbound_status_updated_at() IS
'Sprint A / EK 3: glatko_outbound_messages.status değiştiğinde
status_updated_at''i tazeler. Yalnızca status değişiminde — ilgisiz UPDATE''ler
teslim zaman damgasını bozmasın.';

DROP TRIGGER IF EXISTS trg_glatko_outbound_status_updated_at
  ON public.glatko_outbound_messages;

CREATE TRIGGER trg_glatko_outbound_status_updated_at
  BEFORE UPDATE ON public.glatko_outbound_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.glatko_touch_outbound_status_updated_at();


-- ─── 5. RLS ───────────────────────────────────────────────────────────────
--
-- Admin okur, service_role yazar. Müşteri ve sağlayıcı erişimi YOK.
--
-- Sprint B kusurunu tekrarlamama garantisi YAPISAL: admin politikası
-- FOR SELECT, FOR ALL DEĞİL. Postgres WITH CHECK'i SELECT'te hiç
-- değerlendirmediği için "with_check NULL → USING yazma kontrolü olur"
-- tuzağı burada OLUŞAMAZ. Yazma yolu yalnızca service_role ve orada
-- WITH CHECK açıkça yazılıdır.

ALTER TABLE public.glatko_dispatch_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glatko_outbound_messages  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.glatko_dispatch_attempts;
CREATE POLICY "service_role_all" ON public.glatko_dispatch_attempts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read" ON public.glatko_dispatch_attempts;
CREATE POLICY "admin_read" ON public.glatko_dispatch_attempts
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "service_role_all" ON public.glatko_outbound_messages;
CREATE POLICY "service_role_all" ON public.glatko_outbound_messages
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read" ON public.glatko_outbound_messages;
CREATE POLICY "admin_read" ON public.glatko_outbound_messages
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.glatko_dispatch_attempts FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.glatko_outbound_messages FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.glatko_dispatch_attempts TO authenticated;
GRANT SELECT ON TABLE public.glatko_outbound_messages TO authenticated;
GRANT ALL    ON TABLE public.glatko_dispatch_attempts TO service_role;
GRANT ALL    ON TABLE public.glatko_outbound_messages TO service_role;


-- ─── 6. VIEW: canlı metrik — hiç dispatch edilmemiş talepler ──────────────
--
-- Üç ay boyunca eksik olan metrik. 5 talebi haftasında yakalayacak olan sorgu.
--
-- security_invoker = true ZORUNLU: onsuz view sahibi postgres olur ve
-- glatko_service_requests RLS'ini BAYPAS eder — talep verisi authenticated
-- herkese açılır (Supabase'in bilinen tuzağı).
-- Ek olarak WHERE'de açık is_admin() kapısı var: security_invoker altında
-- bir müşteri, "Customers manage own requests" politikası sayesinde KENDİ
-- taleplerini görebilirdi. Şartname "müşteri ve sağlayıcı erişimi YOK"
-- dediği için view'ın kendisi de kapılanıyor (defense in depth).

CREATE OR REPLACE VIEW public.v_glatko_requests_never_dispatched
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.created_at,
  r.status,
  r.municipality,
  r.category_id,
  r.moderated_at
FROM public.glatko_service_requests r
WHERE public.is_admin()
  -- NULL-GÜVENLİ, KASITLI OLARAK "FAIL LOUD":
  -- status ve created_at prod'da NULLABLE'dır (status DEFAULT 'draft' ama
  -- NOT NULL değil). Düz "r.status NOT IN (...)" yazılsa NULL status için
  -- ifade NULL döner ve satır KPI'dan SESSİZCE düşerdi; düz
  -- "created_at >= cutoff" ise NULL created_at'i hem bu view'dan hem legacy
  -- view'dan düşürüp talebi ÜÇ view'da da görünmez yapardı. Bu, tam olarak
  -- Sprint A'nın ortadan kaldırmak için var olduğu körlük sınıfıdır.
  -- Bu yüzden bilinmeyen değer KPI'ya DAHİL edilir (sessizce yutulmaz).
  AND (r.created_at IS NULL OR r.created_at >= public.glatko_observability_cutoff())
  -- Moderasyonda reddedilen ve müşterinin iptal ettiği talepte dispatch
  -- OLMAMASI doğru davranıştır (teşhiste 2 red bu yüzden hataya sayılmadı).
  AND (r.status IS NULL OR r.status NOT IN ('rejected','cancelled'))
  AND NOT EXISTS (
    SELECT 1 FROM public.glatko_dispatch_attempts a
    WHERE a.request_id = r.id
  )
  -- AYRIKLIK: bildirim satırı varsa dispatch KESİN çalışmıştır, dolayısıyla
  -- bu bir "hiç dispatch edilmedi" vakası DEĞİL, bir enstrümantasyon kaybıdır
  -- ve v_glatko_dispatch_attempts_missing'e aittir. İki alarm ayrık tutulur:
  --   bu view       → talep eşleştiriciye hiç ulaşmadı   (operasyonel sorun)
  --   *_missing     → ölçüm katmanı satır kaybetti        (ölçüm sorunu)
  -- Aksi halde tek bir vaka iki alarmı birden yakar ve müdahale yanlış
  -- yere yönlendirilir.
  AND NOT EXISTS (
    SELECT 1 FROM public.glatko_request_notifications n
    WHERE n.request_id = r.id
  );

COMMENT ON VIEW public.v_glatko_requests_never_dispatched IS
'CANLI KPI. Kesme noktasından sonra oluşup hiç dispatch girişimi kaydı
olmayan talepler. rejected/cancelled dışlanır (orada dispatch yokluğu doğru
davranıştır). BU VIEW BOŞ KALMALIDIR; boş değilse bir talep eşleştirme
zincirine hiç girmemiştir. Admin panelinde sıfırdan büyükse görsel uyarı.';

GRANT SELECT ON public.v_glatko_requests_never_dispatched TO authenticated;


-- ─── 7. VIEW: legacy kanıt — pre-instrumentation 13 talep ─────────────────
--
-- glatko_dispatch_attempts'e BAKAMAZ: o tablo eski talepler için tanım gereği
-- boştur, dolayısıyla 13 değil 25 dönerdi ve dispatch eden 12 ile etmeyen 13'ü
-- yine karıştırırdı. Elimizdeki tek pre-instrumentation kanıtı bildirim
-- satırlarıdır.
--
-- rejected/cancelled BURADA dışlanmaz — kanıt bütünlüğü için; status kolonu
-- görünür durumda.

CREATE OR REPLACE VIEW public.v_glatko_requests_never_dispatched_legacy
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.created_at,
  r.status,
  r.municipality,
  r.category_id,
  r.moderated_at,
  -- R1 (dispatch hiç çağrılmadı) ile R2 (çağrıldı, onay anında arz yoktu)
  -- ayrımını taşır. Bkz. docs/notification-chain-diagnosis.md §4-5.
  (r.moderated_at IS NULL) AS never_moderated
FROM public.glatko_service_requests r
WHERE public.is_admin()
  -- Burada NULL created_at KASITLI olarak dışarıda kalır: legacy kapalı bir
  -- tarihsel kümedir ve bir talebin pre-instrumentation olduğu kanıtlanamıyorsa
  -- buraya ait değildir. Görünmez kalmaz — canlı view'ın "fail loud" kolu onu
  -- yakalar (bkz. v_glatko_requests_never_dispatched).
  AND r.created_at < public.glatko_observability_cutoff()
  AND NOT EXISTS (
    SELECT 1 FROM public.glatko_request_notifications n
    WHERE n.request_id = r.id
  );

COMMENT ON VIEW public.v_glatko_requests_never_dispatched_legacy IS
'VEKİL ÖLÇÜT, KPI DEĞİL. Canlı metrik için v_glatko_requests_never_dispatched
kullanılır.
Kesme noktasından ÖNCEKİ (pre-instrumentation) talepler; "dispatch edilmedi"
vekili olarak bildirim satırı yokluğu kullanılır, çünkü o dönemde
glatko_dispatch_attempts mevcut değildi. Bu vekil "hiç çalışmadı" ile
"çalıştı, kimseyi bulamadı"yı AYIRT EDEMEZ — Sprint A''nın var olma sebebi
tam olarak bu ayrımı mümkün kılmaktı. Kanıt olarak korunur, raporlamada
kullanılmaz.';

GRANT SELECT ON public.v_glatko_requests_never_dispatched_legacy TO authenticated;


-- ─── 8. VIEW: kayıp satır dedektörü (EK 1) ────────────────────────────────
--
-- Özyinelemeyi kapatır: enstrümantasyon yazımı try/catch içinde olduğu ve
-- başarısızlıkta dispatch devam ettiği için, yazım DÜŞERSE bunu kim öğrenecek?
-- Bugünkü cevap "console.log" olurdu — ve üç aydır kimsenin okumadığı şey tam
-- olarak console.log'du. Yani ölçüm katmanı için aynı kör noktayı bir seviye
-- yukarıda yeniden üretirdik.
--
-- Mantık: bildirim satırı VARSA dispatch mutlaka çalıştı. Attempt satırı
-- YOKSA enstrümantasyon yazımı düşmüştür. Bu, tablodan bağımsız tek
-- doğrulama kaynağıdır.

CREATE OR REPLACE VIEW public.v_glatko_dispatch_attempts_missing
WITH (security_invoker = true) AS
SELECT
  r.id                                   AS request_id,
  r.created_at,
  r.status,
  r.municipality,
  (SELECT COUNT(*)      FROM public.glatko_request_notifications n
     WHERE n.request_id = r.id)          AS notification_rows,
  (SELECT MIN(n.created_at) FROM public.glatko_request_notifications n
     WHERE n.request_id = r.id)          AS first_notification_at
FROM public.glatko_service_requests r
WHERE public.is_admin()
  -- Canlı view ile aynı NULL-güvenli "fail loud" mantığı: bilinmeyen
  -- created_at dedektörden düşmez.
  AND (r.created_at IS NULL OR r.created_at >= public.glatko_observability_cutoff())
  -- Bildirim satırı var → dispatch KESİN çalıştı
  AND EXISTS (
    SELECT 1 FROM public.glatko_request_notifications n
    WHERE n.request_id = r.id
  )
  -- Ama attempt satırı yok → enstrümantasyon yazımı düşmüş
  AND NOT EXISTS (
    SELECT 1 FROM public.glatko_dispatch_attempts a
    WHERE a.request_id = r.id
  );

COMMENT ON VIEW public.v_glatko_dispatch_attempts_missing IS
'KAYIP SATIR DEDEKTÖRÜ (Sprint A / EK 1). Bildirim satırı oluşmuş ama
glatko_dispatch_attempts satırı oluşmamış talepler → enstrümantasyon yazımı
düştü. Ölçüm katmanının kendisini doğrulayan, tablodan bağımsız tek kaynak.
BU VIEW BOŞ KALMALIDIR; boş kalmıyorsa gösterge panelinin kendisine
GÜVENİLMEZ. Admin panelinde v_glatko_requests_never_dispatched ile aynı önem
seviyesinde görsel uyarı.';

GRANT SELECT ON public.v_glatko_dispatch_attempts_missing TO authenticated;


-- ─── 9. RPC: candidate_pool_size eklenmesi ────────────────────────────────
--
-- CREATE OR REPLACE, RETURNS JSON imzası DEĞİŞMİYOR.
--
-- E2 doğrulaması: bu RPC'nin dönüşünü okuyan TEK TS tüketici
-- lib/notifications/match-dispatch.ts:172. Okuma biçimi (:192-196) düz bir
-- `as` cast'i ve tüm anahtarlar optional; zod yok, .strict() yok, generated
-- Database tipi bu RPC'yi tanımlamıyor. Anahtar eklemek ne derlemede ne
-- çalışma anında kırıyor. waitlist_count ve total_matches ZATEN dönüyordu
-- (034:270-276) ve TS okuyup atıyordu — tek YENİ anahtar candidate_pool_size.
--
-- DAVRANIŞ DEĞİŞMİYOR: DELETE, FOR döngüsü, INSERT'ler, sayaç bumpı ve
-- mevcut JSON anahtarları birebir aynı. Eklenen tek şey iki salt-okunur
-- SELECT ve bir JSON anahtarı. Kategori NULL ise havuz NULL kalır ve
-- glatko_get_request_matches kendi RAISE'ini eskisi gibi yapar (034:103) —
-- yani hata davranışı da aynı.

CREATE OR REPLACE FUNCTION public.glatko_dispatch_request_notifications(
  p_request_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_match RECORD;
  v_notified_count INTEGER := 0;
  v_waitlist_count INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_request_category_id UUID;
  v_candidate_pool_size INTEGER;
BEGIN
  -- ── Sprint A ölçümü (salt okunur, davranışı etkilemez) ──
  SELECT sr.category_id
  INTO v_request_category_id
  FROM public.glatko_service_requests sr
  WHERE sr.id = p_request_id;

  -- ⛔ E1: BU PREDİKAT 034_glatko_matching_algorithm.sql:140-141 İLE
  -- BİREBİR AYNI OLMALIDIR. Kategori join'i sprint E'de değişirse İKİSİ
  -- AYNI COMMIT'te güncellenecek, aksi halde candidate_pool_size sessizce
  -- yanlış olur. Kategori NULL ise sayım yapılmaz → havuz NULL kalır.
  IF v_request_category_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT p.id)
    INTO v_candidate_pool_size
    FROM public.glatko_professional_profiles p
    INNER JOIN public.glatko_pro_services ps ON ps.professional_id = p.id
    WHERE ps.category_id = v_request_category_id
      AND p.verification_status = 'approved';
  END IF;

  -- ── Buradan aşağısı 034 ile BİREBİR AYNI (davranış değişmiyor) ──

  -- Idempotent: clear any prior notification rows for this request
  DELETE FROM public.glatko_request_notifications
  WHERE request_id = p_request_id;

  FOR v_match IN
    SELECT *
    FROM public.glatko_get_request_matches(p_request_id, 10, 3)
  LOOP
    INSERT INTO public.glatko_request_notifications (
      request_id, professional_id, match_score, match_rank,
      is_primary, notified_at
    ) VALUES (
      p_request_id,
      v_match.professional_id,
      v_match.match_score,
      v_match.match_rank,
      v_match.is_primary,
      CASE WHEN v_match.is_primary THEN v_now ELSE NULL END
    );

    -- Bump pro's notification counter
    INSERT INTO public.glatko_pro_response_metrics (
      professional_id, total_notifications
    ) VALUES (v_match.professional_id, 1)
    ON CONFLICT (professional_id) DO UPDATE SET
      total_notifications = glatko_pro_response_metrics.total_notifications + 1,
      updated_at = v_now;

    IF v_match.is_primary THEN
      v_notified_count := v_notified_count + 1;
    ELSE
      v_waitlist_count := v_waitlist_count + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'request_id', p_request_id,
    'notified_count', v_notified_count,
    'waitlist_count', v_waitlist_count,
    'total_matches', v_notified_count + v_waitlist_count,
    'dispatched_at', v_now,
    -- Sprint A: YENİ anahtar. NULL = kategori yok / sayım yapılamadı.
    'candidate_pool_size', v_candidate_pool_size
  );
END;
$$;

COMMENT ON FUNCTION public.glatko_dispatch_request_notifications IS
'G-REQ-2: queues match results into glatko_request_notifications.
Top 3 get notified_at = NOW() (the email worker reads these). Wait-list
7 stay with notified_at = NULL until glatko_activate_waitlist flips them.
Idempotent — re-running clears prior queue entries first.
SPRINT A: candidate_pool_size (skorlama öncesi aday havuzu) JSON''a eklendi.
Eşleştirme davranışı DEĞİŞMEDİ. ⛔ E1: havuz predikatı
034_glatko_matching_algorithm.sql:140-141 ile senkron tutulmalıdır.';

-- Yetkiler: migration 088'in kilidi KORUNUR (034 authenticated'a da vermişti,
-- 088 geri almıştı — 034'ün GRANT'ını körlemesine kopyalamak güvenlik
-- gerilemesi olurdu).
REVOKE ALL ON FUNCTION public.glatko_dispatch_request_notifications(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.glatko_dispatch_request_notifications(UUID)
  TO service_role;
