/**
 * Retired category slugs → their surviving slug.
 *
 * SSOT for category merges. A slug lands here when a migration deactivates it
 * because it was a duplicate of another category (same trade, two rows), so
 * every URL that still carries the old slug can be 308'd to the survivor.
 *
 * Consumers:
 *   - middleware.ts issues the HTTP 308 across all 9 locales + the /[city]
 *     suffix + query (next.config redirects() only covers the EN hub).
 *   - lib/glatko/retired-slugs.test.ts asserts no retired slug is still used as
 *     a content key anywhere, which is the drift that made migration 119 messy:
 *     the cost guide and FAQ copy had been keyed to `plumbing-renov`, the row
 *     that turned out to be the duplicate.
 *
 * Keep this in sync with the migration that retires the slug, and never reuse a
 * retired slug for a new category — the redirect would silently hijack it.
 */
export const RETIRED_SLUGS: Record<string, string> = {
  // migration 085 — boat-services dup merge
  "engine-service": "boat-engine-service",
  "captain-rental": "captain-daily",
  "electronics-gps": "electrical-electronics",
  // migration 119 — renovation-construction dup merge (039 inserted a second
  // row for a trade that already existed, suffixed `-renov` to dodge the slug
  // collision, and both ended up published with the same display name)
  "plumbing-renov": "plumbing",
  "electrical-renov": "electrical",
};
