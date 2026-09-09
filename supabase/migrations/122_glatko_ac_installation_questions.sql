-- ============================================================================
-- 122_glatko_ac_installation_questions.sql
-- Talep sihirbazı: 'ac-installation' için klimaya özel sorular.
--
-- SORUN (2026-09-09 ölçüldü):
--   glatko_get_request_questions('ac-installation') → 7 soru, ve bunlar kökün
--   ('renovation-construction') sorularının BİREBİR aynısı. Klima arayan
--   müşteriye sorulanlar: "Tip radova" (seçenekler arasında klima YOK —
--   električni/vodoinstalacije/krečenje/pločice/gips/podne obloge/kompletna
--   renovacija), "Površina radova (m²)", "Trenutno stanje prostora",
--   "Imate li potrebne dozvole?". Hiçbiri klima işini tarif etmiyor.
--
--   Aynı kusur 049'da açılmıştı: 'custom-furniture' ve 'furniture-restoration'
--   kendi sorularını aldı ama RPC kökünkini de EKLEDİĞİ için formlar
--   13 ve 12 soruya çıktı — masa ısmarlayan kişiye inşaat ruhsatı soruluyor.
--   049 bu birleşmeyi hiç hesaba katmamış.
--
-- BU MIGRATION İKİ ŞEY YAPAR:
--   1) RPC'nin devralma kuralını düzeltir: alt kategorinin KENDİ soruları
--      varsa yalnız onlar döner; yoksa eskisi gibi kökünkini devralır.
--   2) 'ac-installation' için 8 soruluk, kendi kendine yeten set ekler.
--
-- ETKİ ALANI (uygulamadan önce ölçüldü):
--   Soru taşıyan 16 kategoriden 14'ü KÖK → davranışları değişmez.
--   Yalnız iki alt kategori etkilenir, ikisinde de 0 talep var:
--     custom-furniture       13 → 6 soru   (0 talep)
--     furniture-restoration  12 → 5 soru   (0 talep)
--   ac-installation           7 → 8 soru   (2 talep, ikisi de bu değişimden
--                                           önce; details JSONB'si dokunulmaz)
--
-- İMZA DEĞİŞMİYOR: fonksiyon adı, argümanı ve RETURNS TABLE sütunları aynı.
--   Frontend değişikliği GEREKTİRMEZ (lib/supabase/glatko-questions.ts ve
--   StepDetails.tsx aynı şekli okur), bu yüzden "DB canlı ama frontend deploy
--   bekliyor" arasındaki boşlukta üretim düşmez.
--
-- UYGULANDI: 2026-09-09, glatko-prod (cjqappdfyxgytdyeytwv), Supabase MCP ile
--   iki migration olarak (bu dosyadaki BEGIN/COMMIT sarmalayicisi olmadan,
--   apply_migration kendi islemini actigi icin):
--     20260909113933  glatko_ac_installation_questions_rpc_inheritance  (bolum 1)
--     20260909114050  glatko_ac_installation_questions_seed             (bolum 2)
--   CI migration kosturmuyor; bu dosyayi eklemek tek basina uretimi degistirmez.
--
-- DOGRULANDI (uygulamadan sonra, canli):
--   - ac-installation → 8 soru, 4 zorunlu; kok sorusu sizmiyor
--   - 9 dilin hicbirinde eksik label/placeholder/help_text/option yok (0 eksik)
--   - canli sr formunda "Sta vam je potrebno / Tip uredaja / Broj jedinica"
--     goruntulendi; sihirbaz 3. ve 4. adima ilerliyor (zorunlu dogrulama calisiyor)
--   - custom-furniture 13→6, furniture-restoration 12→5; ikisinin de formu
--     dort adimi geciyor. painting gibi kendi sorusu olmayan alt kategoriler
--     kokunu devralmayi surduruyor (7→7).
--
-- Idempotent: CREATE OR REPLACE + ON CONFLICT DO NOTHING.
-- Rollback: dosyanın sonundaki yorum bloğu.
-- ============================================================================

BEGIN;

-- ─── 1. RPC: alt kategori kendi sorularını taşıyorsa kökünkini DEVRALMAZ ────

CREATE OR REPLACE FUNCTION public.glatko_get_request_questions(p_category_slug TEXT)
RETURNS TABLE (
  id UUID,
  question_key TEXT,
  question_type public.glatko_question_type,
  label JSONB,
  placeholder JSONB,
  help_text JSONB,
  options JSONB,
  validation JSONB,
  show_if JSONB,
  step_order INTEGER,
  field_order INTEGER,
  is_required BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH parent_slug_lookup AS (
    SELECT parent.slug AS slug
    FROM public.glatko_service_categories child
    LEFT JOIN public.glatko_service_categories parent ON parent.id = child.parent_id
    WHERE child.slug = p_category_slug
  ),
  has_own AS (
    SELECT EXISTS (
      SELECT 1 FROM public.glatko_request_questions
      WHERE category_slug = p_category_slug
    ) AS yes
  )
  SELECT
    q.id,
    q.question_key,
    q.question_type,
    q.label,
    q.placeholder,
    q.help_text,
    q.options,
    q.validation,
    q.show_if,
    q.step_order,
    q.field_order,
    q.is_required
  FROM public.glatko_request_questions q
  WHERE q.category_slug = p_category_slug
     OR (
          NOT (SELECT yes FROM has_own)
          AND q.category_slug = (SELECT slug FROM parent_slug_lookup)
        )
  ORDER BY q.step_order, q.field_order;
$$;

REVOKE ALL ON FUNCTION public.glatko_get_request_questions(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.glatko_get_request_questions(TEXT)
  TO anon, authenticated;

COMMENT ON FUNCTION public.glatko_get_request_questions IS
'Bir kategorinin sihirbaz sorularini (step_order, field_order) sirasiyla dondurur. Alt kategori KENDI sorularini tasiyorsa yalniz onlar doner; hic sorusu yoksa kokunun sorulari devralinir. (122: eskiden ikisi birlestiriliyor ve alt kategori formlari ilgisiz kok sorulariyla sisiyordu.)';

-- ─── 2. 'ac-installation' için 8 soru (9 dil eksiksiz) ─────────────────────
--
-- Adım düzeni 022'nin kuralına uyar: 1=işin özellikleri, 2=açıklama,
-- 3=tercih/koşullu, 4=dosya. Konum, aciliyet, bütçe-dışı ortak adımlar
-- sihirbazın kendi bileşeninden gelir, burada tohumlanmaz.
--
-- Bütçe aralıkları kökünkinden AYRI: kök 1.000–50.000 € aralıklarıyla inşaat
-- işine göre kurulmuş; klima işi o ölçekte değil, aralıklar buna göre yazıldı.

INSERT INTO public.glatko_request_questions
  (category_slug, question_key, question_type, label, placeholder, help_text,
   options, validation, show_if, step_order, field_order, is_required)
VALUES

('ac-installation', 'service_type', 'select',
  '{"me":"Šta vam je potrebno","sr":"Šta vam je potrebno","en":"What do you need","tr":"Neye ihtiyacınız var","de":"Was benötigen Sie","it":"Di cosa hai bisogno","ru":"Что вам нужно","ar":"ما الذي تحتاجه","uk":"Що вам потрібно"}'::jsonb,
  NULL, NULL,
  '[
    {"value":"installation","label":{"me":"Nova montaža","sr":"Nova montaža","en":"New installation","tr":"Yeni montaj","de":"Neuinstallation","it":"Nuova installazione","ru":"Новый монтаж","ar":"تركيب جديد","uk":"Новий монтаж"}},
    {"value":"repair","label":{"me":"Popravka kvara","sr":"Popravka kvara","en":"Repair a fault","tr":"Arıza onarımı","de":"Reparatur einer Störung","it":"Riparazione guasto","ru":"Ремонт неисправности","ar":"إصلاح عطل","uk":"Ремонт несправності"}},
    {"value":"maintenance","label":{"me":"Servis i čišćenje","sr":"Servis i čišćenje","en":"Service and cleaning","tr":"Bakım ve temizlik","de":"Wartung und Reinigung","it":"Manutenzione e pulizia","ru":"Сервис и чистка","ar":"صيانة وتنظيف","uk":"Сервіс і чищення"}},
    {"value":"refrigerant","label":{"me":"Dopuna freona","sr":"Dopuna freona","en":"Refrigerant refill","tr":"Gaz dolumu","de":"Kältemittel nachfüllen","it":"Ricarica del gas refrigerante","ru":"Заправка фреоном","ar":"تعبئة غاز التبريد","uk":"Заправка фреоном"}},
    {"value":"relocation","label":{"me":"Demontaža i premještanje","sr":"Demontaža i premeštanje","en":"Removal and relocation","tr":"Sökme ve yer değiştirme","de":"Demontage und Umsetzung","it":"Smontaggio e spostamento","ru":"Демонтаж и перенос","ar":"فك ونقل","uk":"Демонтаж і перенесення"}},
    {"value":"overhaul","label":{"me":"Remont","sr":"Remont","en":"Overhaul","tr":"Kapsamlı revizyon","de":"Generalüberholung","it":"Revisione completa","ru":"Капитальный ремонт","ar":"إصلاح شامل","uk":"Капітальний ремонт"}}
  ]'::jsonb,
  '{"required":true}'::jsonb, NULL, 1, 1, TRUE),

('ac-installation', 'unit_type', 'select',
  '{"me":"Tip uređaja","sr":"Tip uređaja","en":"Unit type","tr":"Cihaz tipi","de":"Gerätetyp","it":"Tipo di unità","ru":"Тип устройства","ar":"نوع الجهاز","uk":"Тип пристрою"}'::jsonb,
  NULL, NULL,
  '[
    {"value":"wall_split","label":{"me":"Zidni split","sr":"Zidni split","en":"Wall-mounted split","tr":"Duvar tipi split","de":"Wand-Split","it":"Split a parete","ru":"Настенный сплит","ar":"سبليت جداري","uk":"Настінний спліт"}},
    {"value":"multi_split","label":{"me":"Multi-split","sr":"Multi-split","en":"Multi-split","tr":"Multi split","de":"Multi-Split","it":"Multi-split","ru":"Мульти-сплит","ar":"مالتي سبليت","uk":"Мульти-спліт"}},
    {"value":"ducted","label":{"me":"Kanalski","sr":"Kanalski","en":"Ducted","tr":"Kanallı","de":"Kanalgerät","it":"Canalizzato","ru":"Канальный","ar":"مخفي بالقنوات","uk":"Канальний"}},
    {"value":"cassette","label":{"me":"Kasetni","sr":"Kasetni","en":"Cassette","tr":"Kaset tipi","de":"Kassettengerät","it":"A cassetta","ru":"Кассетный","ar":"كاسيت","uk":"Касетний"}},
    {"value":"window","label":{"me":"Prozorski","sr":"Prozorski","en":"Window unit","tr":"Pencere tipi","de":"Fenstergerät","it":"Da finestra","ru":"Оконный","ar":"شباك","uk":"Віконний"}},
    {"value":"portable","label":{"me":"Prenosivi","sr":"Prenosivi","en":"Portable","tr":"Portatif","de":"Mobiles Gerät","it":"Portatile","ru":"Мобильный","ar":"متنقل","uk":"Мобільний"}},
    {"value":"unknown","label":{"me":"Ne znam","sr":"Ne znam","en":"Not sure","tr":"Bilmiyorum","de":"Weiß ich nicht","it":"Non so","ru":"Не знаю","ar":"لا أعرف","uk":"Не знаю"}}
  ]'::jsonb,
  '{"required":true}'::jsonb, NULL, 1, 2, TRUE),

('ac-installation', 'unit_count', 'number',
  '{"me":"Broj jedinica","sr":"Broj jedinica","en":"Number of units","tr":"Cihaz sayısı","de":"Anzahl der Geräte","it":"Numero di unità","ru":"Количество блоков","ar":"عدد الوحدات","uk":"Кількість блоків"}'::jsonb,
  '{"me":"npr. 1","sr":"npr. 1","en":"e.g. 1","tr":"örn. 1","de":"z.B. 1","it":"es. 1","ru":"напр. 1","ar":"مثلاً 1","uk":"напр. 1"}'::jsonb,
  NULL, NULL,
  '{"required":true,"min":1,"max":20}'::jsonb, NULL, 1, 3, TRUE),

('ac-installation', 'outdoor_unit_access', 'select',
  '{"me":"Pristup vanjskoj jedinici","sr":"Pristup spoljnoj jedinici","en":"Access to the outdoor unit","tr":"Dış üniteye erişim","de":"Zugang zum Außengerät","it":"Accesso all''unità esterna","ru":"Доступ к наружному блоку","ar":"الوصول إلى الوحدة الخارجية","uk":"Доступ до зовнішнього блока"}'::jsonb,
  NULL,
  '{"me":"Visina i pristup utiču na opremu koja je potrebna","sr":"Visina i pristup utiču na opremu koja je potrebna","en":"Height and access affect the equipment needed","tr":"Yükseklik ve erişim gereken ekipmanı etkiler","de":"Höhe und Zugang beeinflussen die benötigte Ausrüstung","it":"Altezza e accesso influenzano l''attrezzatura necessaria","ru":"Высота и доступ влияют на необходимое оборудование","ar":"الارتفاع وإمكانية الوصول يؤثران على المعدات المطلوبة","uk":"Висота і доступ впливають на потрібне обладнання"}'::jsonb,
  '[
    {"value":"ground","label":{"me":"Prizemlje ili lako dostupna fasada","sr":"Prizemlje ili lako dostupna fasada","en":"Ground floor or easily reachable wall","tr":"Zemin kat veya kolay erişilen cephe","de":"Erdgeschoss oder gut erreichbare Fassade","it":"Piano terra o parete facilmente raggiungibile","ru":"Первый этаж или легкодоступный фасад","ar":"الطابق الأرضي أو واجهة يسهل الوصول إليها","uk":"Перший поверх або легкодоступний фасад"}},
    {"value":"up_to_3","label":{"me":"Do trećeg sprata","sr":"Do trećeg sprata","en":"Up to the third floor","tr":"Üçüncü kata kadar","de":"Bis zum dritten Stock","it":"Fino al terzo piano","ru":"До третьего этажа","ar":"حتى الطابق الثالث","uk":"До третього поверху"}},
    {"value":"above_3","label":{"me":"Iznad trećeg sprata","sr":"Iznad trećeg sprata","en":"Above the third floor","tr":"Üçüncü kat üzeri","de":"Über dem dritten Stock","it":"Sopra il terzo piano","ru":"Выше третьего этажа","ar":"فوق الطابق الثالث","uk":"Вище третього поверху"}},
    {"value":"balcony","label":{"me":"Balkon ili terasa","sr":"Balkon ili terasa","en":"Balcony or terrace","tr":"Balkon veya teras","de":"Balkon oder Terrasse","it":"Balcone o terrazza","ru":"Балкон или терраса","ar":"شرفة أو تراس","uk":"Балкон або тераса"}},
    {"value":"unknown","label":{"me":"Ne znam","sr":"Ne znam","en":"Not sure","tr":"Bilmiyorum","de":"Weiß ich nicht","it":"Non so","ru":"Не знаю","ar":"لا أعرف","uk":"Не знаю"}}
  ]'::jsonb,
  '{}'::jsonb,
  '{"question_key":"service_type","operator":"in","value":["installation","relocation"]}'::jsonb,
  1, 4, FALSE),

('ac-installation', 'service_description', 'textarea',
  '{"me":"Opis posla","sr":"Opis posla","en":"Job description","tr":"İş açıklaması","de":"Beschreibung der Arbeit","it":"Descrizione del lavoro","ru":"Описание работы","ar":"وصف العمل","uk":"Опис роботи"}'::jsonb,
  '{"me":"Model uređaja, šta se dešava, kada je počelo…","sr":"Model uređaja, šta se dešava, kada je počelo…","en":"Unit model, what is happening, when it started…","tr":"Cihaz modeli, ne oluyor, ne zaman başladı…","de":"Gerätemodell, was passiert, seit wann…","it":"Modello dell''unità, cosa succede, da quando…","ru":"Модель устройства, что происходит, когда началось…","ar":"طراز الجهاز، ما الذي يحدث، ومتى بدأ…","uk":"Модель пристрою, що відбувається, коли почалося…"}'::jsonb,
  NULL, NULL,
  '{"required":true,"minLength":30,"maxLength":2000}'::jsonb, NULL, 2, 1, TRUE),

('ac-installation', 'unit_supply', 'select',
  '{"me":"Uređaj","sr":"Uređaj","en":"The unit itself","tr":"Cihazın kendisi","de":"Das Gerät selbst","it":"L''unità stessa","ru":"Само устройство","ar":"الجهاز نفسه","uk":"Сам пристрій"}'::jsonb,
  NULL, NULL,
  '[
    {"value":"have_unit","label":{"me":"Imam uređaj","sr":"Imam uređaj","en":"I already have the unit","tr":"Cihazım var","de":"Gerät ist vorhanden","it":"Ho già l''unità","ru":"Устройство уже есть","ar":"لدي الجهاز بالفعل","uk":"Пристрій уже є"}},
    {"value":"need_purchase","label":{"me":"Treba mi i nabavka uređaja","sr":"Treba mi i nabavka uređaja","en":"I need the unit supplied too","tr":"Cihazın da temin edilmesi gerekiyor","de":"Gerät soll mitgeliefert werden","it":"Serve anche la fornitura dell''unità","ru":"Нужна и поставка устройства","ar":"أحتاج توريد الجهاز أيضاً","uk":"Потрібна також поставка пристрою"}},
    {"value":"need_advice","label":{"me":"Treba mi preporuka","sr":"Treba mi preporuka","en":"I need a recommendation","tr":"Öneriye ihtiyacım var","de":"Ich brauche eine Empfehlung","it":"Ho bisogno di un consiglio","ru":"Нужна рекомендация","ar":"أحتاج إلى توصية","uk":"Потрібна рекомендація"}}
  ]'::jsonb,
  '{}'::jsonb,
  '{"question_key":"service_type","operator":"eq","value":"installation"}'::jsonb,
  3, 1, FALSE),

('ac-installation', 'budget_estimate', 'select',
  '{"me":"Procjenjeni budžet","sr":"Procenjeni budžet","en":"Budget estimate","tr":"Tahmini bütçe","de":"Budgetschätzung","it":"Budget stimato","ru":"Ориентировочный бюджет","ar":"الميزانية التقديرية","uk":"Орієнтовний бюджет"}'::jsonb,
  NULL, NULL,
  '[
    {"value":"under_200","label":{"me":"Do 200 €","sr":"Do 200 €","en":"Under €200","tr":"€200 altı","de":"Unter 200 €","it":"Sotto €200","ru":"До 200 €","ar":"أقل من 200 €","uk":"До 200 €"}},
    {"value":"200_500","label":{"me":"200–500 €","sr":"200–500 €","en":"€200–500","tr":"€200–500","de":"200–500 €","it":"€200–500","ru":"200–500 €","ar":"200–500 €","uk":"200–500 €"}},
    {"value":"500_1000","label":{"me":"500–1.000 €","sr":"500–1.000 €","en":"€500–1,000","tr":"€500–1.000","de":"500–1.000 €","it":"€500–1.000","ru":"500–1 000 €","ar":"500–1,000 €","uk":"500–1 000 €"}},
    {"value":"1000_3000","label":{"me":"1.000–3.000 €","sr":"1.000–3.000 €","en":"€1,000–3,000","tr":"€1.000–3.000","de":"1.000–3.000 €","it":"€1.000–3.000","ru":"1 000–3 000 €","ar":"1,000–3,000 €","uk":"1 000–3 000 €"}},
    {"value":"over_3000","label":{"me":"Preko 3.000 €","sr":"Preko 3.000 €","en":"Over €3,000","tr":"€3.000 üstü","de":"Über 3.000 €","it":"Oltre €3.000","ru":"Свыше 3 000 €","ar":"أكثر من 3,000 €","uk":"Понад 3 000 €"}},
    {"value":"unsure","label":{"me":"Nisam siguran/na","sr":"Nisam siguran/na","en":"Not sure","tr":"Emin değilim","de":"Unsicher","it":"Non so","ru":"Не уверен(а)","ar":"غير متأكد","uk":"Не впевнений(а)"}}
  ]'::jsonb,
  '{}'::jsonb, NULL, 3, 2, FALSE),

('ac-installation', 'photos', 'file',
  '{"me":"Fotografije uređaja i mjesta","sr":"Fotografije uređaja i mesta","en":"Photos of the unit and the spot","tr":"Cihazın ve yerin fotoğrafları","de":"Fotos von Gerät und Montageort","it":"Foto dell''unità e del punto","ru":"Фото устройства и места","ar":"صور الجهاز والمكان","uk":"Фото пристрою та місця"}'::jsonb,
  NULL,
  '{"me":"Fotografija unutrašnje i vanjske jedinice ubrzava procjenu","sr":"Fotografija unutrašnje i spoljne jedinice ubrzava procenu","en":"A photo of the indoor and outdoor unit speeds up the estimate","tr":"İç ve dış ünitenin fotoğrafı değerlendirmeyi hızlandırır","de":"Ein Foto von Innen- und Außengerät beschleunigt die Einschätzung","it":"Una foto dell''unità interna ed esterna velocizza la valutazione","ru":"Фото внутреннего и наружного блока ускоряет оценку","ar":"صورة للوحدة الداخلية والخارجية تسرّع التقدير","uk":"Фото внутрішнього та зовнішнього блока пришвидшує оцінку"}'::jsonb,
  NULL,
  '{"maxFiles":8,"maxSizeMB":10,"allowedTypes":["image/jpeg","image/png","image/webp"]}'::jsonb,
  NULL, 4, 1, FALSE)

ON CONFLICT (category_slug, question_key) DO NOTHING;

COMMIT;

-- ============================================================================
-- ROLLBACK (elle çalıştır):
--
-- BEGIN;
-- DELETE FROM public.glatko_request_questions WHERE category_slug = 'ac-installation';
-- -- RPC'yi 021'deki birleştiren hâline döndür:
-- CREATE OR REPLACE FUNCTION public.glatko_get_request_questions(p_category_slug TEXT)
-- RETURNS TABLE (id UUID, question_key TEXT, question_type public.glatko_question_type,
--   label JSONB, placeholder JSONB, help_text JSONB, options JSONB, validation JSONB,
--   show_if JSONB, step_order INTEGER, field_order INTEGER, is_required BOOLEAN)
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--   WITH parent_slug_lookup AS (
--     SELECT parent.slug AS slug FROM public.glatko_service_categories child
--     LEFT JOIN public.glatko_service_categories parent ON parent.id = child.parent_id
--     WHERE child.slug = p_category_slug)
--   SELECT q.id, q.question_key, q.question_type, q.label, q.placeholder, q.help_text,
--          q.options, q.validation, q.show_if, q.step_order, q.field_order, q.is_required
--   FROM public.glatko_request_questions q
--   WHERE q.category_slug = p_category_slug
--      OR q.category_slug = (SELECT slug FROM parent_slug_lookup)
--   ORDER BY q.step_order, q.field_order; $$;
-- COMMIT;
-- ============================================================================
