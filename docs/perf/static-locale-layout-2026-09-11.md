# glatko.app: statik locale layout + CDN önbelleği — 2026-09-11

**Belirti:** Canlıda her sayfa (ana sayfa, /hizmetler, /pros/…, blog, statik
metin sayfaları dahil) `cache-control: private, no-cache, no-store` ile her
istekte serverless fonksiyonda render ediliyordu; `x-vercel-cache` hep MISS.

## Kök nedenler (ölçüldü)

| # | Bulgu | Kanıt |
|---|---|---|
| 1 | `app/layout.tsx` (kök layout) `headers()` ile `x-pathname` okuyup `<html lang>` seçiyordu → **bütün ağaç dinamik**. `next build` tablosu `[locale]` sayfalarını ● gösteriyor ama `.next/server/app` altında **0 HTML**, `prerender-manifest.json`'da yalnız robots+favicon. | build 2 çıktısı, `find .next/server/app -name "*.html" \| wc -l` = 0 |
| 2 | `app/[locale]/layout.tsx` cookie'li Supabase client ile `auth.getUser()` + profil/pro okuması yapıyordu (header linkleri, onboarding banner, Sentry, arama modalı için). | layout kaynağı |
| 3 | `[locale]` için `generateStaticParams` yoktu. | layout kaynağı |
| 4 | Herkese açık sayfalar (ana sayfa, /services, /services/[slug], /pros/[slug], /request-service) `createClient()` (cookie'li) ile veri okuyordu; `NEXT_PHASE` guard'ı build'de cookie'siz çalışsa da ISR yeniden üretiminde `cookies()` çağrısı istek bağlamı olmadan patlar. | `supabase/server.ts`, sayfa kaynakları |
| 5 | Ana sayfa `setRequestLocale` çağırmıyordu (next-intl statik render şartı). | sayfa kaynağı |

## Yapılanlar

1. **Kök layout = `app/(site)/[locale]/layout.tsx`.** `app/[locale]` ağacı `app/(site)/[locale]`'e
   taşındı (git rename), eski `app/layout.tsx`'in içeriği (fontlar, `<head>` consent
   script'leri, ThemeProvider/Toaster/Analytics/SpeedInsights/GTM/MetaPixel, ikon +
   verification metadata'sı) buraya katlandı; `<html lang>`/`dir` artık `headers()`
   yerine rota parametresinden (`URL_LOCALE_TO_HTML_LANG`). `/` yönlendirmesi ve
   locale'siz not-found `app/(root)/` grubunda kendi minimal kök layout'uyla.
   `app/error.tsx` → `app/(site)/[locale]/error.tsx`. `@/app/[locale]/…` server-action
   import'ları (33 dosya) yeni yola güncellendi.
2. **`generateStaticParams`** (9 locale) locale layout'unda.
3. **Auth istemciye taşındı:** `app/api/session/route.ts` (`force-dynamic`,
   `private, no-store`) `{userId,email,isPro,isAdmin,onboarding}` döner;
   `components/glatko/session/SessionProvider.tsx` hydration sonrası çeker,
   sessionStorage'daki son payload'ı önce uygular (sekme içi gezinmelerde
   misafir→kullanıcı flaşı yok), `onAuthStateChange` ile yeniler.
   `SessionBound.tsx` sarmalayıcıları: `HeaderBound`, `OnboardingBannerBound`,
   `SentryUserScopeBound`, `SearchModalBound`, `QuoteReviewsSectionBound`
   (profil sahibi kontrolü istemcide). `RequestServiceWizard` `userId`'yi
   provider'dan alır; oturum netleşene kadar loader gösterir (anonim taslak
   kalıcılığı / e-posta zorunluluğu form ortasında değişmesin diye).
   **Bilinçli trade-off:** ilk yüklemede header, oturum cevabı gelene kadar
   (~100–300 ms) misafir görünümünde; yetkilendirme hiçbir zaman bu payload'a
   dayanmıyor (server action'lar cookie'den okumaya devam ediyor).
4. **`createPublicClient()`** (`supabase/server.ts`): cookie'siz anon client.
   `glatko.server.ts`'te `getServiceCategories`, `getProfessionalProfileBySlug`,
   `getProfessionalsForSitemap`, `getCategoryBySlug`, `getSubCategories`,
   `getCitiesServingCategory`, `searchProfessionals` buna geçti (anon zaten aynı
   satırları görüyordu). `categoryTreeHasApprovedProvider` ve
   `calculateTrustBadges` PII-kilitli tabloyu (anon 087b'den beri reddediliyor)
   `createAdminClient()` ile okuyor; ikisi de yalnız boolean/rozet döndürüyor —
   önceden anonim ziyaretçi için hep `false`/`[]` dönüyordu.
5. Blog yazıları (`blog/[slug]`): boş `generateStaticParams` — Next 14'te bu, rotayı
   "her istekte render" (`private, no-store`) yerine istek-anında ISR'a çevirir (ilk
   ziyaret üretir + önbelleğe alır, 60 s'de bir tazelenir; build'de hiçbir yazı
   prerender edilmez). Eski yorumun bahsettiği `DYNAMIC_SERVER_USAGE` 500'ü, layout
   cookie okuduğu için oluyordu.
6. Sayfa düzeyi: ana sayfa ve `/services` `revalidate = 3600` + public client;
   `/services/[slug]` `generateStaticParams` (aktif kategori × locale);
   `/pros/[slug]` `generateStaticParams` (onaylı pro × locale) + `revalidate = 300`,
   yorumlar public client; `/request-service` `revalidate = 3600`, `getUser` yok;
   `/how-it-works`, `/founding-customer` `revalidate = 600`; ana sayfaya
   `setRequestLocale`.

## Doğrulama

Yerel `next build` + `next start -p 3102` (build 4, 2026-09-11):

| Rota | Önce (main) | Sonra |
|---|---|---|
| `/tr`, `/en` (ana sayfa) | `private, no-store`, her istek fonksiyon, ~300 ms+ | ● prerender, `x-nextjs-cache: HIT`, `s-maxage=3600`, 8–17 ms |
| `/tr/hizmetler` (services) | dinamik | ● HIT `s-maxage=3600` |
| `/tr/hizmetler/[slug]` | dinamik | ● (aktif kategori × 9 locale prerender) |
| `/tr/pros/[slug]` | dinamik | ● HIT `s-maxage=300` (onaylı pro × locale) |
| `/tr/request-service`, `/tr/nasil-calisir`, `/tr/hakkimizda`, hukuki metinler | dinamik | ● HIT |
| `/tr/blog` | dinamik | ● `s-maxage=60` |
| `/tr/pro/dashboard`, `/tr/messages`, `/tr/onboarding`, `/tr/admin`… | dinamik | dinamik kaldı (`private, no-store`; cookie okuyorlar — doğru) |
| `/api/session` | — | `private, no-store`, misafir için `{userId:null,…}` |
| `<html lang/dir>` | header'dan | `/tr` → `lang="tr" dir="ltr"`, `/ar` → `lang="ar" dir="rtl"` |

`.next/server/app` altında 2 800 HTML (önce 0); prerender-manifest 2 945 statik rota (önce 2).

**Tuzak (build 3'te yakalandı):** `createClient()`'taki eski `NEXT_PHASE === 'phase-production-build'`
guard'ı `cookies()` çağrısını build'den gizliyordu; ağaç statik olabilir hale gelince
**bütün gated sayfalar misafir kabuğu olarak prerender edilip 1 yıl CDN'de kalacaktı**
(`/tr/pro/dashboard` HIT `s-maxage=31536000`). Guard kaldırıldı — `cookies()` build'de
görülür, Next rotayı dinamik işaretler. Build tablosundaki ● işareti Next 14'te
`generateStaticParams` varlığını gösterir, gerçek durum `find .next/server/app -name "*.html"`
ve `prerender-manifest.json` ile doğrulanır.

**Boş-veri koruması:** ana sayfa / `/services` kategori sorguları ve `getServiceCategories`
hata dönerse fırlatır (build kırılır ya da ISR eski sayfayı korur), `getCategoryBySlug` /
`getProfessionalProfileBySlug` yalnız `PGRST116` (satır yok) durumunda 404 verir — build 2'de
Sanity/Supabase bağlantı zaman aşımları görüldüğü için (statik sayfaya boş veri gömülmesin).

## Canlı (PR #148 squash `7d3042cb`, deploy 2026-09-11 21:26 TSİ)

Başlıklar: `/tr` → `x-vercel-cache: HIT`, `cache-control: public, max-age=0, must-revalidate`,
ilk bayt ~150 ms (önce MISS + `private, no-cache, no-store`, ~400–650 ms); `/en`,
`/tr/hizmetler`, `/tr/hizmetler/[slug]`, `/tr/pros/[slug]`, `/tr/request-service`,
`/tr/nasil-calisir`, `/tr/blog` → PRERENDER/HIT; blog yazısı → ilk istek MISS, sonra STALE/HIT
(istek-anında ISR, 60 s); `/tr/pro/dashboard`, `/tr/messages` → `private, no-store` (dinamik,
doğru); `/api/session` → `private, no-store`; `<html lang="tr" dir="ltr">`, `/ar` → `rtl`;
ana sayfada 16 kategori linki (veri dolu).

Lighthouse 12 (canlı):

| Sayfa | Cihaz | Perf | A11y | BP | LCP | Not |
|---|---|---|---|---|---|---|
| /tr | masaüstü | **99** | 96 | 77 | 0,9 s | |
| /tr | mobil | 66 | 96 | 77 | 9,3 s | 2,0 MB toplam, 50 script |
| /tr/hizmetler | mobil | 61 | 95 | 77 | 12,6 s | 2,0 MB, 42 script |

Sunucu tarafı (TTFB / önbellek) bu PR ile çözüldü; mobil skor artık tamamen istemci JS ve
üçüncü taraf yüküne (GTM, Meta Pixel, Vercel insights, Sentry, Yandex, framer-motion…) bağlı —
`docs/` içindeki CWV yol haritasının (1C JS-erteleme, sahip kararıyla ertelenmişti) konusu.
BP 77 de aynı kaynaklardan (üçüncü taraf çerezleri / konsol hataları).
