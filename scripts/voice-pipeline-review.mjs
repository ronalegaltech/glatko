// G-VOICE-1 — Voice pipeline review tool (regression aracı, owner-run).
//
// NE YAPAR: Gerçek ses notlarını (TTS DEĞİL) sesli-onboarding pipeline'ından
// geçirir — whisper-1 STT → strict structured extraction (canlı 16-kök kategori
// enum'u ile) — ve klip başına okunur bir blok basar: algılanan dil, transcript,
// seçilen kategori slug + en/tr label, alt hizmetler, bio, hizmet bölgeleri,
// deneyim, enum-geçerli assertion. Amaç: extraction prompt'unu düzelttiğimizde,
// yeni kategori eklediğimizde veya model versiyonu değiştiğinde kategori isabetini
// ve bio uydurmasını gözle hızlıca denetlemek.
//
// GEREKTİRİR: gerçek bir OPENAI_API_KEY (inline verilir; dosyaya yazılmaz) +
// .env.local'deki Supabase creds (yalnız kategori okuması için).
//
// PROD'A YAZMAZ: yalnızca OpenAI çağrısı + kategori SELECT (read-only). DB'ye,
// storage'a, taslak tablosuna HİÇBİR yazma yok.
//
// ÖRNEK:
//   OPENAI_API_KEY=sk-... node --env-file=.env.local \
//     scripts/voice-pipeline-review.mjs <ses-dosyasi|klasör> [daha-fazla-klip...]
//
// inline OPENAI_API_KEY, .env.local'deki boş değeri ezer (Node: process.env > --env-file).

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, extname } from "node:path";

const AUDIO_EXT = new Set([".ogg", ".opus", ".oga", ".m4a", ".mp4", ".mp3", ".wav", ".webm", ".aac"]);

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error("Kullanım: node scripts/_throwaway-voice-pipeline-test.mjs <ses|klasör> [...]");
  process.exit(64);
}
const key = process.env.OPENAI_API_KEY || "";
if (!key.startsWith("sk-")) {
  console.error("OPENAI_API_KEY inline verilmeli: OPENAI_API_KEY=sk-... node --env-file=.env.local ...");
  process.exit(64);
}

// Girdileri klip listesine düzleştir (klasör → içindeki ses dosyaları).
const clips = [];
for (const inp of inputs) {
  let st;
  try { st = statSync(inp); } catch { console.error(`Yok: ${inp}`); continue; }
  if (st.isDirectory()) {
    for (const f of readdirSync(inp).sort()) {
      if (AUDIO_EXT.has(extname(f).toLowerCase())) clips.push(join(inp, f));
    }
  } else {
    clips.push(inp);
  }
}
if (!clips.length) { console.error("İşlenecek ses dosyası bulunamadı."); process.exit(64); }

function mimeOf(p) {
  return { ".ogg": "audio/ogg", ".opus": "audio/ogg", ".oga": "audio/ogg", ".m4a": "audio/mp4",
    ".mp4": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".webm": "audio/webm",
    ".aac": "audio/aac" }[extname(p).toLowerCase()] || "application/octet-stream";
}

const client = new OpenAI({ apiKey: key });

// ── Canlı kök kategoriler (prod, read-only): slug + label map ──────────────
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: cats, error: ce } = await supa
  .from("glatko_service_categories").select("slug, name, parent_id, is_active")
  .is("parent_id", null).eq("is_active", true).order("sort_order");
if (ce) { console.error("Kategori fetch FAILED:", ce.message); process.exit(1); }
const slugs = cats.map((c) => c.slug);
const labelOf = (slug) => {
  const c = cats.find((x) => x.slug === slug);
  if (!c) return slug;
  const n = c.name || {};
  return `${n.en ?? "?"} / ${n.tr ?? "?"}`;
};
console.log(`Canlı kök slug (${slugs.length}): ${slugs.join(", ")}`);
console.log(`İşlenecek klip: ${clips.length}\n`);

const schema = { type: "object", additionalProperties: false,
  required: ["display_name", "category_slug", "sub_services", "bio", "service_areas", "experience_years"],
  properties: { display_name: { type: "string" }, category_slug: { type: "string", enum: slugs },
    sub_services: { type: "array", items: { type: "string" }, maxItems: 8 }, bio: { type: "string" },
    service_areas: { type: "array", items: { type: "string" } }, experience_years: { type: ["integer", "null"] } } };

let pass = 0, fail = 0;
for (let i = 0; i < clips.length; i++) {
  const clip = clips[i];
  const head = `─── klip ${i + 1}/${clips.length}: ${basename(clip)} ${"─".repeat(Math.max(0, 40 - basename(clip).length))}`;
  console.log(head);
  try {
    const buf = readFileSync(clip);
    const file = await OpenAI.toFile(buf, basename(clip), { type: mimeOf(clip) });

    // Whisper — verbose_json: algılanan dili de döndürür (diagnostik için).
    const tr = await client.audio.transcriptions.create({ file, model: "whisper-1", response_format: "verbose_json" });
    const transcript = (tr.text || "").trim();
    const lang = tr.language || "?";
    if (!transcript) { console.log("  ⚠️  BOŞ TRANSCRIPT\n"); fail++; continue; }

    const r = await client.chat.completions.create({ model: "gpt-4o-mini", temperature: 0.2, max_tokens: 600,
      response_format: { type: "json_schema", json_schema: { name: "pro_profile", strict: true, schema } },
      messages: [
        { role: "system", content: "Majstorun sesli notundan bir hizmet sağlayıcı profili çıkar. bio majstorun KENDİ DİLİNDE 2-4 cümle, birinci tekil. Bilgi yoksa UYDURMA (experience null, alanlar boş olabilir). category_slug SADECE enum'dan." },
        { role: "user", content: `SESLİ NOT:\n${transcript}` } ] });
    const p = JSON.parse(r.choices[0].message.content);
    const enumOk = slugs.includes(p.category_slug);

    console.log(`  algılanan dil : ${lang}`);
    console.log(`  transcript    : "${transcript}"`);
    console.log(`  kategori      : ${p.category_slug}  (${labelOf(p.category_slug)})`);
    console.log(`  alt hizmetler : ${p.sub_services.join(", ") || "—"}`);
    console.log(`  bio           : "${p.bio}"`);
    console.log(`  hizmet bölg.  : ${p.service_areas.join(", ") || "—"}`);
    console.log(`  deneyim (yıl) : ${p.experience_years ?? "—"}`);
    console.log(`  enum geçerli  : ${enumOk ? "✓" : "✗ ENUM İHLALİ"}`);
    console.log("");
    enumOk ? pass++ : fail++;
  } catch (e) {
    console.log(`  ❌ HATA: ${e.message}\n`);
    fail++;
  }
}

console.log(`═══ ÖZET: ${pass} geçti / ${fail} başarısız (toplam ${clips.length}) ═══`);
console.log("Gözle bak: kategori isabetli mi? bio uydurma içeriyor mu? dil doğru mu?");
process.exit(fail ? 5 : 0);
