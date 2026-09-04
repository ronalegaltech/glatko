"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Loader2, MailWarning } from "lucide-react";
import { createClient } from "@/supabase/browser";

/**
 * Shown on /login when an email link round-trip failed — /auth/confirm could
 * not redeem the token_hash, or /auth/callback could not exchange the code.
 *
 * Before this the route only appended `?error=…` and the login page ignored
 * it: the visitor landed on a bare form with no explanation and no way to get
 * a fresh link. The recovery offered depends on `flow` (the verifyOtp type
 * the confirm route carried over):
 *   signup    → resend the confirmation email
 *   recovery  → send them to /forgot-password for a new reset link
 *   otherwise → explain only; there is no logged-out resend for those.
 */

export type AuthLinkErrorCode =
  | "auth-confirm-failed"
  | "auth-confirm-missing-params"
  | "auth-confirm-invalid-type"
  | "auth-callback-failed";

const NOTICE_CODES = new Set<string>([
  "auth-confirm-failed",
  "auth-confirm-missing-params",
  "auth-confirm-invalid-type",
  "auth-callback-failed",
]);

/** Narrow an arbitrary `?error=` value to one we have copy for. */
export function toAuthLinkErrorCode(raw: string | null): AuthLinkErrorCode | null {
  return raw && NOTICE_CODES.has(raw) ? (raw as AuthLinkErrorCode) : null;
}

type SendState = "idle" | "sending" | "sent" | "rate-limited" | "error";

type Props = {
  code: AuthLinkErrorCode;
  /** verifyOtp type carried over as `?flow=`; null for the callback flow. */
  flow: string | null;
  /** Live value of the login form's email field — the resend target. */
  email: string;
};

export function AuthLinkNotice({ code, flow, email }: Props) {
  const t = useTranslations("auth.linkNotice");
  const [state, setState] = useState<SendState>("idle");

  const description =
    code === "auth-callback-failed" ? t("callbackDesc") : t("expiredDesc");
  const canResend = flow === "signup";
  const isRecovery = flow === "recovery";
  const emailReady = /.+@.+\..+/.test(email.trim());

  async function handleResend() {
    if (!emailReady || state === "sending") return;
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });
    if (!error) {
      setState("sent");
      return;
    }
    // Never echo GoTrue's message: "user already confirmed" would turn this
    // banner into an account-existence oracle. Rate limiting is the one case
    // worth naming, because retrying immediately cannot help.
    const rateLimited =
      error.code === "over_email_send_rate_limit" ||
      error.status === 429 ||
      /rate limit/i.test(error.message ?? "");
    setState(rateLimited ? "rate-limited" : "error");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="alert"
      className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-500/20 dark:bg-amber-500/10"
    >
      <div className="flex items-start gap-3">
        <MailWarning
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <div className="flex-1">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {t("title")}
          </p>
          <p className="mt-1 text-amber-800/90 dark:text-amber-300/80">
            {description}
          </p>

          {isRecovery && (
            <Link
              href="/forgot-password"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50 dark:bg-amber-500 dark:hover:bg-amber-400"
            >
              {t("recoveryCta")}
            </Link>
          )}

          {canResend && state !== "sent" && (
            <>
              <button
                type="button"
                onClick={handleResend}
                disabled={!emailReady || state === "sending"}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-400"
              >
                {state === "sending" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                )}
                {t("resendCta")}
              </button>
              {!emailReady && (
                <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-300/70">
                  {t("resendHint")}
                </p>
              )}
            </>
          )}

          {state === "sent" && (
            <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t("resendSent")}
            </p>
          )}
          {state === "rate-limited" && (
            <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-300/70">
              {t("errRateLimited")}
            </p>
          )}
          {state === "error" && (
            <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-300/70">
              {t("errGeneric")}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
