import { describe, expect, it } from "vitest";

import { flattenSubcategories } from "@/lib/glatko/categories";
import type { ServiceCategory } from "@/types/glatko";

/**
 * Regression guard for the request wizard's "no additional questions" bug.
 *
 * `getServiceCategories()` returns ROOTS ONLY with subcategories nested under
 * `children`. The wizard used to flatten with `filter(c => c.parent_id !== null)`,
 * which matches nothing in that shape — so `selectedSub` was permanently
 * undefined and StepDetails never fetched the category questions.
 */

const cat = (
  id: string,
  slug: string,
  parent_id: string | null,
  children?: ServiceCategory[],
): ServiceCategory =>
  ({ id, slug, parent_id, name: { en: slug }, children }) as ServiceCategory;

/** Same shape getServiceCategories() actually produces. */
const nested: ServiceCategory[] = [
  cat("root-reno", "renovation-construction", null, [
    cat("sub-ac", "ac-installation", "root-reno"),
    cat("sub-elec", "electrical", "root-reno"),
  ]),
  cat("root-clean", "home-cleaning", null, [
    cat("sub-regular", "regular-cleaning", "root-clean"),
  ]),
];

describe("flattenSubcategories", () => {
  it("pulls subcategories out of the nested (roots-only) shape", () => {
    expect(flattenSubcategories(nested).map((c) => c.slug)).toEqual([
      "ac-installation",
      "electrical",
      "regular-cleaning",
    ]);
  });

  it("resolves a subcategory by id — the lookup the wizard depends on", () => {
    const found = flattenSubcategories(nested).find((c) => c.id === "sub-ac");
    expect(found?.slug).toBe("ac-installation");
  });

  it("documents the old flat filter finding nothing in this shape", () => {
    expect(nested.filter((c) => c.parent_id !== null)).toHaveLength(0);
  });

  it("still works if a caller passes an already-flat list", () => {
    const flat = [
      cat("root-reno", "renovation-construction", null),
      cat("sub-ac", "ac-installation", "root-reno"),
    ];
    expect(flattenSubcategories(flat).map((c) => c.slug)).toEqual([
      "ac-installation",
    ]);
  });

  it("does not emit a category twice when both shapes are present", () => {
    const mixed = [
      cat("root-reno", "renovation-construction", null, [
        cat("sub-ac", "ac-installation", "root-reno"),
      ]),
      cat("sub-ac", "ac-installation", "root-reno"),
    ];
    expect(flattenSubcategories(mixed)).toHaveLength(1);
  });

  it("returns nothing for roots with no children", () => {
    expect(flattenSubcategories([cat("r", "repair-service", null)])).toEqual([]);
  });
});
