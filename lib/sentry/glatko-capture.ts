import * as Sentry from "@sentry/nextjs";

function sentryEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SENTRY_DSN &&
      process.env.NEXT_PUBLIC_SENTRY_DSN.length > 0,
  );
}

/**
 * Best-effort error reporting; no-op when DSN unset (local dev).
 *
 * `level` is optional and defaults to Sentry's own (`error`). Pass "warning"
 * for expected-but-worth-trending failures — e.g. an expired one-time email
 * link — so routine user behaviour doesn't fire the high-priority alert rule.
 */
export function glatkoCaptureException(
  err: unknown,
  tags: Record<string, string>,
  level?: "info" | "warning" | "error",
): void {
  if (!sentryEnabled()) return;
  Sentry.captureException(err, level ? { tags, level } : { tags });
}

/**
 * Best-effort message capture (non-error tripwires, e.g. the H3 Mapbox quota
 * 80% alarm). No-op when DSN unset. `level` follows Sentry severity levels.
 */
export function glatkoCaptureMessage(
  message: string,
  level: "info" | "warning" | "error",
  tags: Record<string, string>,
): void {
  if (!sentryEnabled()) return;
  Sentry.captureMessage(message, { level, tags });
}
