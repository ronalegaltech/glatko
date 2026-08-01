# Glatko — Eşleştirme & Dispatch Sprint Planı

**Oluşturuldu:** 2026-08-01
**Dayanak:** `docs/notification-chain-diagnosis.md` (teşhis, 2026-07-30) + `glatko-dispatch-status.md` (uygulama ve dry-run, 2026-08-01)
**Kural:** sıra kasıtlı — gözlemlenebilirlik önce, davranış değişikliği sonra.

---

## Durum tablosu

| Sprint | Kapsam | Durum |
|---|---|---|
| **A1** | Gözlemlenebilirlik şeması | ✅ **TAMAM** — migration 116 + 117a + 117b + 118 prod'da |
| **A2** | Enstrümantasyon yazıcısı (TS) | ⏳ Sıradaki PR |
| **A3** | Admin kanal × durum matrisi | Beklemede (A2'ye bağlı) |
| **B** | RLS yazma kontrolü + durum geçiş koruması | Beklemede |
| **C** | Tetikleme topolojisi (provider_signup, manual_replay, cron) | Beklemede |
| **D** | `location_point` backfill | 🔒 **SERT KAPI — aşağıya bak** |
| **E** | Kategori join'i (ata yönünde genişletme) | Beklemede |
| **F** | Şehir normalizasyonu | Beklemede, tek başına gitmeli |

---

## 🔒 SPRINT D SERT KAPISI — ölçülmeden uygulanmaz

**Bu kapı bir tavsiye değil, bir önkoşuldur.**

### Neden

2026-08-01 dry-run ölçümü (`glatko-dispatch-status.md` Adım 3, BEGIN/ROLLBACK içinde):

| Ölçüm | S1 Podgorica/electrical | S2 Budva/plumbing-renov |
|---|---|---|
| `dist_km` NULL ile geçen eşleşme | **8 / 8** | **7 / 7** |
| Mesafesi hesaplanan | 0 | 0 |
| Eşleşen sağlayıcıların şehri | podgorica 6, budva 2 | **podgorica 5, tivat 1, bar 1, budva 0** |

Bugün geo kapısı (`034:147-148`) **fiilen devre dışı**: 42 sağlayıcının 41'inde `location_point` NULL olduğu için `dist_km` her zaman NULL ve kapı `dist_km IS NULL OR …` koluyla koşulsuz geçiyor. Sonuç: `service_radius_km` 42/42 dolu ama **ölü veri**.

Bunun bugünkü etkisi **olumlu**: Budva'da açılan bir talep, şehirde hiç sağlayıcı olmamasına rağmen 7 kişiye ulaşıyor.

**Sprint D bu kapıyı canlandıracak.** Backfill sonrası aynı Budva talebi, Podgorica'daki 5 sağlayıcı yarıçap dışında kalırsa **7'den 0'a düşebilir.** Yani "coğrafi doğruluk" düzeltmesi, bugün çalışan tek şeyi — erişimi — kapatabilir.

### Kapı koşulu — üçü birden

**1. Backfill ÖNCESİ simülasyon zorunlu.**
Her açık talep için "yarıçap uygulansaydı kaç eşleşme kalırdı" hesaplanacak. Simülasyon backfill'i **uygulamadan**, aday koordinatlar üzerinden `BEGIN/ROLLBACK` içinde yürütülür. Çıktı, talep başına:

```
talep_id · kategori · şehir · bugünkü_eşleşme · yarıçap_sonrası_eşleşme · düşüş_yüzdesi
```

**2. Düşüş eşiği önceden yazılacak.**
Simülasyon sonucu okunmadan eşik belirlenmez — ama eşiğin ne olduğu backfill'den **önce** yazılı olmalıdır. Öneri: herhangi bir talep 3'ün altına düşüyorsa veya toplam eşleşme %50'den fazla azalıyorsa kabul edilemez sayılır.

**3. Düşüş kabul edilemezse kademeli fallback tasarlanacak.**
Önce yarıçap içi aranır; sonuç yoksa (veya `p_primary_count`'un altındaysa) yarıçap genişletilir. Yani geo bir **sıralama sinyali** olur, bir **eleme kapısı** değil. Tasarım Sprint D'nin parçasıdır, sonrasına bırakılmaz.

### Ölçümün taban verisi nerede

Migration **118** tam bu kapı için var:

- `glatko_dispatch_attempts.matches_without_distance` — fail-open koldan geçen (bugünkü taban: eşleşmelerin %100'ü)
- `glatko_dispatch_attempts.matches_with_distance` — mesafesi hesaplanan (bugünkü taban: 0)
- `glatko_dispatch_attempts.matched_cities` — eşleşen sağlayıcıların şehir dağılımı, örn. `{"podgorica":5,"tivat":1,"bar":1}`

A2 bu alanları doldurmaya başladıktan sonra, backfill'in etkisi **öncesi/sonrası karşılaştırmasıyla** okunabilir hale gelir. **A2 çalışmadan Sprint D'ye girilmez** — aksi halde düşüşü ölçecek veri hiç üretilmemiş olur.

---

## Sprint E — kategori join'i

**Doğrulandı (dry-run S3, 2026-08-01):** `boat-services` kök kategorisinde açılan talep **0 eşleşme** aldı; havuz 0. Oysa kökün altında 20 alt kategori var. Düz eşitlik join'i (`034:140`) hiyerarşide gezinmiyor.

**Kısıtlar (teşhis §11'den, aynen geçerli):**
- Yalnızca **ata yönünde** genişletme (talep yaprağı → kökte kayıtlı sağlayıcı), artı kök-açılmış talepler için descendant.
- **Kardeş↔kardeş asla.** Ölçüldü: `roofing` için tam alt-ağaç 23 sağlayıcı döndürüyor ve içinde tek çatı ustası yok. Ayrıca taksonomide çapraz kablolama var (`electrical-electronics`, `boat-services`'in çocuğu).
- **E1 zorunlu:** kategori join'i değişirse `glatko_get_request_matches` (034:140-141) **ve** `glatko_dispatch_request_notifications` içindeki `candidate_pool_size` sayımı **aynı commit'te** güncellenir. Aksi halde ölçüm katmanı sessizce yalan söyler. Sprint E bu iki predikat eşitlenmeden kapanmaz.
- Kategori join'i medyan ücret ön-hesabını da sürüyor (`034:111`) — fiyatlandırma etkisi aynı PR'da test edilir.

---

## Sprint B / C / F — kısa notlar

**B — RLS yazma kontrolü.** `Customers manage own requests` politikası `cmd=ALL` ve `with_check` NULL; Postgres bu durumda `USING`'i yazma kontrolü olarak yeniden kullanıyor. Kimliği doğrulanmış bir müşteri kendi satırını doğrudan `status='published'` ile yazabilir. **C'den (otomatik dispatch) ÖNCE gelmeli** — aksi halde ölü `createServiceRequest` helper'ı (`glatko.server.ts:413`) self-servis bir firehose'a döner.

**C — tetikleme topolojisi.** 116'nın `triggered_by` CHECK'i dört değeri şimdiden tanıyor: `admin_moderation` (bugün kullanılan tek değer), `provider_signup`, `manual_replay`, `cron`. Üçünün üreticisi henüz yok.

**F — şehir normalizasyonu.** Yön önemli: sağlayıcı tarafı kanonik olarak slug, talepler slug'a normalize edilmeli. **Kendi migration'ı olarak gitmeli**, asla bir eşleştirici değişikliğiyle paketlenmemeli — diff, indeksleme değişikliğini gizler. `CHECK`/lookup FK olmadan yeniden kayar.

---

## Sprint teslim formatı — kalıcı kural

**CI'da migration uygulayan bir adım YOK** (`.github/` dizini yok, `package.json`'da migration komutu yok, `supabase/config.toml` yok, üstelik `vercel.json`'daki `ignoreCommand` `supabase/migrations/**` yolunu build tetikleyicisinden hariç tutuyor). Uygulama %100 manuel. Bu yüzden repo ile veritabanı arasındaki farkı yakalayacak tek koruma **teslim disiplinidir**.

**Kural 1 — Migration içeren her PR'ın açıklamasında uygulama durumu yazılı olacak.** Biçim:

```
Migration: <numaralar> — PRODUCTION'A UYGULANDI (<tarih>)
schema_migrations kaydı: <version> / <name>  (her migration için bir satır)
```

**Kural 2 — Migration varsa `schema_migrations` çıktısı teslim edilecek.** İddia değil, sorgu çıktısı:

```sql
select version, name from supabase_migrations.schema_migrations
where name in ('<migration adları>') order by version;
```

**Kural 3 — Uygulanmış ama commit edilmemiş migration bırakılmaz.** 116 iki gün boyunca prod'da uygulanmamış *ve* repoda commit edilmemiş halde bekledi; aynı boşluk 117/118'de tekrar oluştu. Şema değişikliği prod'a gittiyse aynı gün commit edilir.

**Örnek — Sprint A1 teslimi (2026-08-01):**

```
Migration: 116, 117a, 117b, 118 — PRODUCTION'A UYGULANDI (2026-08-01)
schema_migrations kaydı:
  20260801092803 / 116_glatko_observability_dispatch_attempts
  20260801093908 / 117a_view_grant_lockdown
  20260801094531 / 117b_observability_cutoff_config
  20260801100010 / 118_dispatch_attempts_geo_and_cities
```

---

## Değişmeyen kural

**Enstrümantasyon dispatch'i bozamaz.** Her tablo yazımı `try/catch` içindedir; yazım başarısız olursa dispatch normal devam eder. Enstrümantasyon **kimin bildirim aldığını değiştirmez.**

Bunun bedeli: yazım sessizce düşebilir. Karşılığı `v_glatko_dispatch_attempts_missing` view'ıdır — bildirim satırı var ama attempt satırı yoksa ölçüm katmanı satır kaybetmiştir. **Bu view boş kalmalıdır.**
