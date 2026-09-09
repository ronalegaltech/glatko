/**
 * READ-ONLY audit of glatko_professional_profiles.location_city.
 *
 * The column is documented as holding a city SLUG matching GLATKO_CITIES.slug
 * (see supabase/migrations/060_glatko_liquidity_rpc.sql, which matches with
 * exact equality). Free-text "other" cities are allowed by design, so the goal
 * is not "every value must be a slug" but: find values that LOOK like a known
 * city yet are not that city's canonical slug — those silently drop out of the
 * liquidity RPCs and city-filtered search.
 *
 *   node scripts/audit-location-city.mjs
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

// Mirror of lib/glatko/cities.ts (key / name / slug) — kept inline so this
// script runs under plain node without a TS loader.
const CITIES = [
  ["podgorica", "Podgorica", "podgorica"], ["niksic", "Nikšić", "niksic"],
  ["hercegNovi", "Herceg Novi", "herceg-novi"], ["pljevlja", "Pljevlja", "pljevlja"],
  ["bijeloPolje", "Bijelo Polje", "bijelo-polje"], ["bar", "Bar", "bar"],
  ["budva", "Budva", "budva"], ["berane", "Berane", "berane"],
  ["kotor", "Kotor", "kotor"], ["ulcinj", "Ulcinj", "ulcinj"],
  ["tivat", "Tivat", "tivat"], ["cetinje", "Cetinje", "cetinje"],
  ["rozaje", "Rožaje", "rozaje"], ["danilovgrad", "Danilovgrad", "danilovgrad"],
  ["mojkovac", "Mojkovac", "mojkovac"], ["kolasin", "Kolašin", "kolasin"],
  ["plav", "Plav", "plav"], ["zabljak", "Žabljak", "zabljak"],
  ["pluzine", "Plužine", "pluzine"], ["savnik", "Šavnik", "savnik"],
  ["andrijevica", "Andrijevica", "andrijevica"], ["gusinje", "Gusinje", "gusinje"],
  ["petnjica", "Petnjica", "petnjica"], ["tuzi", "Tuzi", "tuzi"],
  ["zeta", "Zeta", "zeta"],
];
const SLUGS = new Set(CITIES.map((c) => c[2]));

/** Loose normaliser: strip diacritics, lowercase, drop every separator. */
const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const BY_NORM = new Map();
for (const [key, name, slug] of CITIES) {
  for (const v of [key, name, slug]) BY_NORM.set(norm(v), slug);
}

const { data, error } = await supa
  .from("glatko_professional_profiles")
  .select("id, slug, location_city, is_active, is_verified");
if (error) {
  console.error("query failed:", error.message);
  process.exit(1);
}

const tally = new Map();
for (const r of data) {
  const k = r.location_city === null ? " NULL" : r.location_city;
  if (!tally.has(k)) tally.set(k, []);
  tally.get(k).push(r);
}

console.log(`glatko_professional_profiles: ${data.length} rows\n`);
console.log("value".padEnd(24), "rows".padStart(5), " a+v", "  verdict");
console.log("-".repeat(80));

const offenders = [];
for (const [value, rowsFor] of [...tally.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const av = rowsFor.filter((r) => r.is_active && r.is_verified).length;
  let verdict;
  if (value === " NULL") {
    verdict = "NULL — not counted by any city query";
  } else if (SLUGS.has(value)) {
    verdict = "ok (canonical slug)";
  } else {
    const canonical = BY_NORM.get(norm(value));
    if (canonical) {
      verdict = `MISMATCH -> should be '${canonical}'`;
      offenders.push({ value, canonical, rows: rowsFor });
    } else {
      verdict = "free text (no known city) — left as is";
    }
  }
  console.log(
    String(value === " NULL" ? "(null)" : value).padEnd(24),
    String(rowsFor.length).padStart(5),
    String(av).padStart(4),
    "  " + verdict,
  );
}

console.log("\n" + "=".repeat(80));
if (!offenders.length) {
  console.log("No non-canonical values that resolve to a known city. Nothing to migrate.");
} else {
  console.log(`${offenders.length} value(s) to normalize:\n`);
  for (const o of offenders) {
    console.log(`  '${o.value}' -> '${o.canonical}'  (${o.rows.length} row(s))`);
    for (const r of o.rows) {
      console.log(`      ${r.slug ?? r.id}  active=${r.is_active} verified=${r.is_verified}`);
    }
  }
  console.log("\nSQL:");
  for (const o of offenders) {
    console.log(
      `  UPDATE glatko_professional_profiles SET location_city = '${o.canonical}' WHERE location_city = '${o.value}';`,
    );
  }
}

// Precondition for migration 121: after 120's rewrite, every value must be
// slug-shaped (lower-case, trimmed, no internal whitespace), or adding the
// CHECK would fail on existing rows.
const REWRITE = Object.fromEntries(offenders.map((o) => [o.value, o.canonical]));
const shapeOk = (v) => v === v.toLowerCase() && v === v.trim() && !/\s/.test(v);
const wouldViolate = [
  ...new Set(
    data
      .map((r) => r.location_city)
      .filter((v) => v !== null)
      .map((v) => REWRITE[v] ?? v)
      .filter((v) => !shapeOk(v)),
  ),
];
console.log(
  `\nMigration 121 precondition (all values slug-shaped after 120): ` +
    (wouldViolate.length ? `FAILS on ${JSON.stringify(wouldViolate)}` : "ok"),
);
