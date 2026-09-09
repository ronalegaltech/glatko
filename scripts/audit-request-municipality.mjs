/**
 * READ-ONLY: which shape does glatko_service_requests.municipality hold?
 *
 * notifyProfessionalsOfNewRequest() matches a request's municipality against a
 * provider's location_city with a plain lower-cased string compare, so the two
 * columns must agree on shape. StepLocation posts the i18n KEY; location_city is
 * the SLUG. For 23 of 25 municipalities key === slug, but "hercegNovi" /
 * "herceg-novi" and "bijeloPolje" / "bijelo-polje" differ.
 *
 *   node scripts/audit-request-municipality.mjs
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

// key !== slug for exactly these two municipalities.
const DIVERGENT = { hercegNovi: "herceg-novi", bijeloPolje: "bijelo-polje" };

const { data, error } = await supa
  .from("glatko_service_requests")
  .select("id, municipality, created_at");
if (error) {
  console.error("query failed:", error.message);
  process.exit(1);
}

const tally = new Map();
for (const r of data) {
  const k = r.municipality === null || r.municipality === "" ? "(empty)" : r.municipality;
  tally.set(k, (tally.get(k) ?? 0) + 1);
}

console.log(`glatko_service_requests: ${data.length} rows\n`);
console.log("municipality".padEnd(22), "rows".padStart(5), "  note");
console.log("-".repeat(70));
for (const [v, n] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
  const note = DIVERGENT[v]
    ? `KEY form — will NOT match location_city '${DIVERGENT[v]}'`
    : "";
  console.log(String(v).padEnd(22), String(n).padStart(5), "  " + note);
}

const affected = Object.keys(DIVERGENT).filter((k) => tally.has(k));
console.log(
  "\n" +
    (affected.length
      ? `Dispatch mismatch reachable today for: ${affected.join(", ")}`
      : "No request currently uses a divergent municipality — latent, not live."),
);
