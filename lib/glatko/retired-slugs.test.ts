import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { RETIRED_SLUGS } from "./retired-slugs";
import { PRICING_DATA } from "./pricing";

/**
 * Guards for the category-merge bug class.
 *
 * Migration 039 bulk-inserted subcategories with an idempotency guard that
 * tested the SLUG only, never the display name. Under renovation-construction
 * the trades already existed, so the new rows got a `-renov` suffix and the
 * catalogue ended up with two "Plumbing" and two "Electrical" rows — two
 * indexable city URLs per trade with identical titles, and one trade's supply
 * split across two category ids. Migration 085 had already fixed the same class
 * for boat-services, and nothing stopped it recurring.
 *
 * The DB half of the invariant (no two active siblings share name.en) has to be
 * asserted in the migration itself, since these tests do not reach production.
 * What IS checkable here is the drift that made the cleanup messy: the cost
 * guide and FAQ copy for Podgorica plumbing had been keyed to `plumbing-renov`,
 * i.e. to the row that turned out to be the duplicate. Content keyed to a slug
 * that is about to be retired is invisible until the redirect strands it.
 */
describe("retired category slugs", () => {
  const dictDir = join(process.cwd(), "dictionaries");
  const locales = readdirSync(dictDir).filter((f) => f.endsWith(".json"));

  it("has locale files to check", () => {
    expect(locales.length).toBe(9);
  });

  it("never maps a slug to another retired slug", () => {
    // A survivor that is itself retired would 308 into a dead end; middleware
    // redirects once, it does not follow the chain.
    for (const [dead, survivor] of Object.entries(RETIRED_SLUGS)) {
      expect(RETIRED_SLUGS[survivor], `${dead} → ${survivor} → …`).toBeUndefined();
    }
  });

  it("never maps a slug to itself", () => {
    for (const [dead, survivor] of Object.entries(RETIRED_SLUGS)) {
      expect(survivor, `${dead} redirects to itself`).not.toBe(dead);
    }
  });

  it("is not used as a servicesCity content key in any locale", () => {
    const offenders: string[] = [];
    for (const file of locales) {
      const dict = JSON.parse(readFileSync(join(dictDir, file), "utf8"));
      const content = dict?.servicesCity?.content ?? {};
      for (const slug of Object.keys(RETIRED_SLUGS)) {
        if (slug in content) offenders.push(`${file}: servicesCity.content.${slug}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("is not used as a pricing key", () => {
    const offenders: string[] = [];
    for (const [key, entry] of Object.entries(PRICING_DATA)) {
      const slug = key.split(":")[0];
      if (slug in RETIRED_SLUGS) offenders.push(`PRICING_DATA["${key}"]`);
      // The key and the record must agree, or a survivor rename silently
      // detaches the cost table from the page that renders it.
      expect(entry.categorySlug, `key/categorySlug mismatch on ${key}`).toBe(slug);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
