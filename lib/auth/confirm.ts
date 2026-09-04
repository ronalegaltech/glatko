// lib/auth/confirm.ts
//
// Pure helpers for the /auth/confirm token_hash redeemer, kept out of the
// route handler so both are unit-testable without booting Next.

import { isSafeInternalPath } from "@/lib/auth/redirect";

export type ConfirmFailureKind = "expired-or-used" | "verify-failed";

/**
 * Classify a `verifyOtp` failure for Sentry severity.
 *
 * A one-time email token that is expired or already redeemed is ordinary user
 * behaviour: a second click, a stale link after a re-send, an inbox scanner
 * that prefetched the URL and burned the token. That belongs in Sentry as a
 * `warning` trend, not as an `error` that pages a human. Only unexpected
 * failures (GoTrue outage, misconfiguration, network) stay at `error`.
 */
export function classifyConfirmFailure(err: unknown): ConfirmFailureKind {
  const e = err as { code?: unknown; message?: unknown } | null;
  if (e?.code === "otp_expired") return "expired-or-used";
  const message = typeof e?.message === "string" ? e.message.toLowerCase() : "";
  // GoTrue collapses "never existed", "already redeemed" and "past expiry"
  // into one message: "Email link is invalid or has expired".
  if (message.includes("expired")) return "expired-or-used";
  if (message.includes("invalid") && message.includes("link")) {
    return "expired-or-used";
  }
  return "verify-failed";
}

/**
 * Resolve the post-confirmation `next=` path from the Auth Hook's `redirect_to`.
 *
 * supabase-js sends `emailRedirectTo` as an ABSOLUTE url (register/page.tsx
 * points it at /auth/callback so the plain code flow keeps working), so the
 * old `startsWith("/")` filter dropped it silently — a pro who signed up from
 * /become-a-pro lost the wizard and landed on "/" after confirming.
 *
 * Two rules:
 *  - only our own origin survives; an off-origin redirect_to is dropped,
 *  - /auth/callback is UNWRAPPED to its inner `next`, because /auth/confirm
 *    has already established the session and bouncing through the
 *    code-exchange callback without a `code` would land the user on
 *    login?error=auth-callback-failed.
 */
export function resolveConfirmNext(
  redirectTo: string | null | undefined,
  siteUrl: string,
): string | null {
  if (!redirectTo) return null;

  if (redirectTo.startsWith("/")) return unwrapCallback(redirectTo);

  let target: URL;
  let base: URL;
  try {
    target = new URL(redirectTo);
    base = new URL(siteUrl);
  } catch {
    return null;
  }
  if (target.origin !== base.origin) return null;

  return unwrapCallback(`${target.pathname}${target.search}`);
}

/** Placeholder origin — only the path/query of the input is ever read back. */
const PARSE_BASE = "https://confirm.invalid";

function unwrapCallback(pathAndQuery: string): string | null {
  if (!isSafeInternalPath(pathAndQuery)) return null;
  let parsed: URL;
  try {
    parsed = new URL(pathAndQuery, PARSE_BASE);
  } catch {
    return null;
  }
  if (parsed.pathname !== "/auth/callback") return pathAndQuery;
  const inner = parsed.searchParams.get("next");
  return isSafeInternalPath(inner) ? inner : null;
}
