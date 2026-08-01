-- Rollback for 116_glatko_observability_dispatch_attempts.sql
--
-- Uygulama öncesi durum (canlı DB'den 2026-08-01 alındı, glatko-prod):
--   public tablo: 31 · view: 4 · politika: 80 · fonksiyon: 184 · trigger: 23
--   izlenen migration: 65 (en yeni 20260729095808)
--   glatko_dispatch_request_notifications gövde md5: 9ccdde05d45ce2161e56490673a109ed
--
-- Bu dosya 116'yı tamamen geri alır:
--   1) dispatch RPC'sini 034'teki (candidate_pool_size ÖNCESİ) haline döndürür
--   2) üç view'ı düşürür
--   3) trigger + trigger fonksiyonunu düşürür
--   4) iki tabloyu düşürür (CASCADE — RLS politikaları ve indeksler onlarla gider)
--   5) kesme noktası fonksiyonunu düşürür
--
-- UYARI: tabloların DROP'u içlerindeki gözlemlenebilirlik verisini yok eder.
-- Geri alma gerekiyorsa önce veriyi dışa aktar.

-- ── 1. RPC'yi 034 haline döndür ───────────────────────────────────────────
-- pg_get_functiondef ile 116 uygulanmadan ÖNCE alınan birebir gövde.

CREATE OR REPLACE FUNCTION public.glatko_dispatch_request_notifications(p_request_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_match RECORD;
  v_notified_count INTEGER := 0;
  v_waitlist_count INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
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
    'dispatched_at', v_now
  );
END;
$function$;

-- 088'in kilidi korunur (034'ün authenticated GRANT'ı geri getirilmez).
REVOKE ALL ON FUNCTION public.glatko_dispatch_request_notifications(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.glatko_dispatch_request_notifications(UUID)
  TO service_role;

-- ── 2. View'lar ───────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_glatko_dispatch_attempts_missing;
DROP VIEW IF EXISTS public.v_glatko_requests_never_dispatched_legacy;
DROP VIEW IF EXISTS public.v_glatko_requests_never_dispatched;

-- ── 3. Trigger + trigger fonksiyonu ───────────────────────────────────────
DROP TRIGGER IF EXISTS trg_glatko_outbound_status_updated_at
  ON public.glatko_outbound_messages;
DROP FUNCTION IF EXISTS public.glatko_touch_outbound_status_updated_at();

-- ── 4. Tablolar (politikalar ve indeksler CASCADE ile gider) ──────────────
DROP TABLE IF EXISTS public.glatko_outbound_messages CASCADE;
DROP TABLE IF EXISTS public.glatko_dispatch_attempts CASCADE;

-- ── 5. Kesme noktası ──────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.glatko_observability_cutoff();
