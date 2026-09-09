/**
 * READ-ONLY: per-category provider counts for Herceg Novi and Budva AFTER the
 * migration-120 rewrite, to show how close each city is to the >= 3 threshold.
 *
 *   node scripts/audit-herceg-novi.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const REWRITE = { Budva: "budva", hercegNovi: "herceg-novi" };
const TARGETS = process.argv.slice(2).length ? process.argv.slice(2) : ["herceg-novi", "budva"];

const [{ data: pros }, { data: cats }, { data: links }] = await Promise.all([
  supa.from("glatko_professional_profiles").select("id, slug, location_city, is_active, is_verified"),
  supa.from("glatko_service_categories").select("id, slug, parent_id, is_active"),
  supa.from("glatko_pro_services").select("professional_id, category_id"),
]);

const catById = new Map(cats.map((c) => [c.id, c]));

for (const city of TARGETS) {
  const inCity = pros.filter(
    (p) =>
      p.is_active &&
      p.is_verified &&
      (REWRITE[p.location_city] ?? p.location_city) === city,
  );
  console.log(`\n=== ${city} — ${inCity.length} active+verified provider(s) after normalisation ===`);
  for (const p of inCity) console.log(`   ${p.slug ?? p.id}   (stored as "${p.location_city}")`);

  const ids = new Set(inCity.map((p) => p.id));
  const perRoot = new Map();
  for (const l of links) {
    if (!ids.has(l.professional_id)) continue;
    const c = catById.get(l.category_id);
    if (!c || !c.is_active) continue;
    const root = c.parent_id ? catById.get(c.parent_id) : c;
    if (!root) continue;
    if (!perRoot.has(root.slug)) perRoot.set(root.slug, new Set());
    perRoot.get(root.slug).add(l.professional_id);
  }

  const rows = [...perRoot.entries()].sort((a, b) => b[1].size - a[1].size);
  if (!rows.length) {
    console.log("   (no category links)");
    continue;
  }
  console.log("   root category                 providers   threshold");
  for (const [slug, set] of rows) {
    console.log(
      `   ${slug.padEnd(28)} ${String(set.size).padStart(6)}      ${set.size >= 3 ? "PUBLISHED" : `short by ${3 - set.size}`}`,
    );
  }
}
