/**
 * READ-ONLY: what changes if location_city is normalised?
 *
 * Replicates the two RPCs from migration 060 in JS (active+verified, one-level
 * root expansion, city = exact location_city) twice: once against the column as
 * it is today, once against a normalised copy. The diff is the set of service x
 * city pages that would newly cross the >= 3 publishing threshold, i.e. become
 * indexable, once migration 120 is applied.
 *
 *   node scripts/audit-location-city-impact.mjs
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

const THRESHOLD = 3; // lib/glatko/config/liquidity-phase.ts, M0-M2

// Exactly the rewrites migration 120 performs — nothing broader.
const REWRITE = { Budva: "budva", hercegNovi: "herceg-novi" };

const [{ data: pros, error: e1 }, { data: cats, error: e2 }, { data: links, error: e3 }] =
  await Promise.all([
    supa
      .from("glatko_professional_profiles")
      .select("id, location_city, is_active, is_verified"),
    supa.from("glatko_service_categories").select("id, slug, parent_id, is_active"),
    supa.from("glatko_pro_services").select("professional_id, category_id"),
  ]);
if (e1 || e2 || e3) {
  console.error("query failed:", (e1 || e2 || e3).message);
  process.exit(1);
}

const catById = new Map(cats.map((c) => [c.id, c]));

/** query_slug -> Set(effective category ids), mirroring cat_expand in 060. */
const expand = new Map();
for (const c of cats) {
  if (!c.is_active) continue;
  if (!expand.has(c.slug)) expand.set(c.slug, new Set());
  expand.get(c.slug).add(c.id);
  if (c.parent_id) {
    const root = catById.get(c.parent_id);
    if (root && root.is_active && root.parent_id === null) {
      if (!expand.has(root.slug)) expand.set(root.slug, new Set());
      expand.get(root.slug).add(c.id);
    }
  }
}

function liquid(normalise) {
  const cityOf = new Map();
  for (const p of pros) {
    if (!p.is_active || !p.is_verified || !p.location_city) continue;
    cityOf.set(p.id, normalise ? (REWRITE[p.location_city] ?? p.location_city) : p.location_city);
  }
  const out = new Map(); // "cat|city" -> Set(proId)
  for (const [slug, ids] of expand) {
    for (const l of links) {
      if (!ids.has(l.category_id)) continue;
      const city = cityOf.get(l.professional_id);
      if (!city) continue;
      const k = `${slug}|${city}`;
      if (!out.has(k)) out.set(k, new Set());
      out.get(k).add(l.professional_id);
    }
  }
  const res = new Map();
  for (const [k, set] of out) if (set.size >= THRESHOLD) res.set(k, set.size);
  return res;
}

const before = liquid(false);
const after = liquid(true);

console.log(`Threshold: >= ${THRESHOLD} active+verified providers (root-expanded)\n`);
console.log(`Liquid combinations now:            ${before.size}`);
console.log(`Liquid combinations after migration: ${after.size}\n`);

const added = [...after.keys()].filter((k) => !before.has(k));
const removed = [...before.keys()].filter((k) => !after.has(k));
const changed = [...after.keys()].filter((k) => before.has(k) && before.get(k) !== after.get(k));

if (added.length) {
  console.log("NEWLY PUBLISHED (noindex 'coming soon' -> indexable page):");
  for (const k of added.sort()) {
    const [cat, city] = k.split("|");
    console.log(`  + ${cat} x ${city}  -> ${after.get(k)} providers`);
  }
} else {
  console.log("No combination newly crosses the threshold.");
}
if (removed.length) {
  console.log("\nWOULD UNPUBLISH (should be empty):");
  for (const k of removed.sort()) console.log(`  - ${k.replace("|", " x ")}`);
}
if (changed.length) {
  console.log("\nCount changes on already-published pages (badge number on the page):");
  for (const k of changed.sort()) {
    const [cat, city] = k.split("|");
    console.log(`  ~ ${cat} x ${city}: ${before.get(k)} -> ${after.get(k)}`);
  }
}

// Cross-check the "before" simulation against the live RPC, so a modelling
// mistake here cannot pass silently.
const { data: rpcRows, error: e4 } = await supa.rpc("glatko_liquid_combinations", {
  p_min_providers: THRESHOLD,
});
if (e4) {
  console.log(`\n[cross-check skipped: ${e4.message}]`);
} else {
  const live = new Set(rpcRows.map((r) => `${r.category_slug}|${r.city_slug}`));
  const onlySim = [...before.keys()].filter((k) => !live.has(k));
  const onlyLive = [...live].filter((k) => !before.has(k));
  console.log(
    `\nCross-check vs live RPC: ${live.size} live, ${before.size} simulated,` +
      ` ${onlySim.length} sim-only, ${onlyLive.length} live-only` +
      (onlySim.length || onlyLive.length ? "  <-- MODEL MISMATCH" : "  (match)"),
  );
  for (const k of [...onlySim, ...onlyLive]) console.log(`    ? ${k}`);
}
