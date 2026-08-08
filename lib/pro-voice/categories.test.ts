import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * G-VOICE-1 — category resolver (DoD #5). The taxonomy is the SINGLE SOURCE
 * (DB): the enum builder yields only live root slugs, and slug→id resolution
 * rejects any fabricated/unknown slug. Supabase admin client is mocked.
 */

const h = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));

vi.mock("@/supabase/server", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        is: () => ({ eq: () => ({ order: async () => ({ data: h.rows, error: null }) }) }),
      }),
    }),
  }),
}));

import {
  getRootCategories,
  getRootCategorySlugs,
  resolveCategoryId,
  rootLabel,
  type RootCategory,
} from "./categories";

beforeEach(() => {
  h.rows = [
    { id: "id-boat", slug: "boat-services", name: { en: "Boat", tr: "Tekne" } },
    { id: "id-clean", slug: "home-cleaning", name: { en: "Cleaning" } },
  ];
});

describe("enum builder (live slugs only)", () => {
  it("getRootCategorySlugs returns the live DB slugs", async () => {
    expect(await getRootCategorySlugs()).toEqual(["boat-services", "home-cleaning"]);
  });
  it("getRootCategories maps id/slug/name", async () => {
    const roots = await getRootCategories();
    expect(roots).toEqual([
      { id: "id-boat", slug: "boat-services", name: { en: "Boat", tr: "Tekne" } },
      { id: "id-clean", slug: "home-cleaning", name: { en: "Cleaning" } },
    ]);
  });
});

describe("resolveCategoryId (slug→uuid, no hallucination)", () => {
  const roots: RootCategory[] = [
    { id: "id-boat", slug: "boat-services", name: { en: "Boat" } },
    { id: "id-clean", slug: "home-cleaning", name: { en: "Cleaning" } },
  ];
  it("known slug → its uuid", () => {
    expect(resolveCategoryId(roots, "boat-services")).toBe("id-boat");
  });
  it("fabricated/unknown slug → null (DB is the only source)", () => {
    expect(resolveCategoryId(roots, "made-up-slug")).toBeNull();
    expect(resolveCategoryId(roots, "")).toBeNull();
  });
});

describe("rootLabel (locale fallbacks)", () => {
  const cat: RootCategory = { id: "x", slug: "boat-services", name: { en: "Boat", tr: "Tekne" } };
  it("uses the requested locale", () => {
    expect(rootLabel(cat, "tr")).toBe("Tekne");
  });
  it("falls back en → tr → first → slug", () => {
    expect(rootLabel(cat, "de")).toBe("Boat"); // de missing → en
    expect(rootLabel({ id: "x", slug: "s", name: { tr: "Sadece TR" } }, "de")).toBe("Sadece TR");
    expect(rootLabel({ id: "x", slug: "only-slug", name: {} }, "de")).toBe("only-slug");
  });
});
