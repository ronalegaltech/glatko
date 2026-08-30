import type { ServiceCategory } from "@/types/glatko";

/**
 * Flatten every subcategory out of whatever shape a category list arrives in.
 *
 * `getServiceCategories()` (lib/supabase/glatko.server.ts) does NOT return a
 * flat list: it returns roots only, with each root's subcategories nested under
 * `children`. Callers that reached for `categories.filter(c => c.parent_id)`
 * therefore matched nothing at all — every root has a null `parent_id`, so the
 * filter is silently empty rather than wrong-looking. That is exactly how the
 * request wizard lost `selectedSub`: no subcategory could ever be resolved by
 * id, which emptied StepDetails (no slug → no questions RPC) and blanked the
 * auto-generated request title.
 *
 * Both shapes are accepted so this stays correct if a caller ever passes a flat
 * list (e.g. a raw table read), and results are de-duplicated by id so a mixed
 * list cannot yield the same category twice.
 */
export function flattenSubcategories(
  categories: ServiceCategory[],
): ServiceCategory[] {
  const out = new Map<string, ServiceCategory>();

  for (const category of categories) {
    for (const child of category.children ?? []) {
      out.set(child.id, child);
    }
    if (category.parent_id) out.set(category.id, category);
  }

  return Array.from(out.values());
}
