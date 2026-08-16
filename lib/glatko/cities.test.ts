import { describe, expect, it } from "vitest";

import { GLATKO_CITIES, toCitySlug } from "./cities";

/**
 * Guard for the location_city drift that migration 120 repairs.
 *
 * The forms post three different shapes for the same city — display name, i18n
 * key, slug — and glatko_liquid_combinations groups on the raw column, so a
 * non-slug value silently splits one municipality's provider count in two and
 * can hold a city below the >= 3 publishing threshold.
 */
describe("toCitySlug", () => {
  it("maps every city's slug, key and name to the same slug", () => {
    for (const c of GLATKO_CITIES) {
      expect(toCitySlug(c.slug), `slug ${c.slug}`).toBe(c.slug);
      expect(toCitySlug(c.key), `key ${c.key}`).toBe(c.slug);
      expect(toCitySlug(c.name), `name ${c.name}`).toBe(c.slug);
    }
  });

  it("repairs the two spellings actually found in production", () => {
    expect(toCitySlug("Budva")).toBe("budva");
    expect(toCitySlug("hercegNovi")).toBe("herceg-novi");
  });

  it("is case- and whitespace-insensitive for known cities", () => {
    expect(toCitySlug("  PODGORICA ")).toBe("podgorica");
    expect(toCitySlug("Herceg Novi")).toBe("herceg-novi");
    expect(toCitySlug("HERCEG-NOVI")).toBe("herceg-novi");
  });

  it("keeps free-text cities instead of rejecting them", () => {
    // The column is deliberately free text: providers outside the 25
    // municipalities enter their own place, and that must survive.
    expect(toCitySlug("Some Village")).toBe("some-village");
    expect(toCitySlug("")).toBe("");
  });

  it("is idempotent", () => {
    for (const c of GLATKO_CITIES) {
      expect(toCitySlug(toCitySlug(c.name))).toBe(c.slug);
    }
  });
});
