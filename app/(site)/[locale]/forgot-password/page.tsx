"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/supabase/browser";
import { AuthBrandPanel } from "@/components/glatko/auth/AuthBrandPanel";
import { cn } from "@/lib/utils";

const inputCls = cn(
  "block w-full rounded-xl border border-gray-200 dark:border-white/10",
  "bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm",
  "text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30",
  "focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all"
);

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError(t("auth.resetError")); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      });
      if (resetErr) throw resetErr;
      setSent(true);
    } catch { setError(t("auth.resetError")); } finally { setLoading(false); }
  }

  if (sent) {
    return (
      <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
        <AuthBrandPanel />
        <div className="flex items-center justify-center bg-white px-4 py-12 dark:bg-neutral-950">
          <div className="mx-auto w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" strokeWidth={1.5} />
            </div>
            <h2 className="font-serif text-xl font-semibold text-gray-900 dark:text-white">{t("auth.resetLinkSent")}</h2>
            <p className="mt-3 text-sm text-gray-500 dark:text-white/50 break-all">{email}</p>
            <Link href="/login" className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-teal-500/40">
              {t("auth.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      <AuthBrandPanel />

      <div className="flex items-center justify-center bg-white px-4 py-12 dark:bg-neutral-950 sm:px-6 lg:px-20 xl:px-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
          className="mx-auto w-full max-w-md"
        >
          <div className="md:hidden mb-8 flex items-center gap-1">
            <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Glatko</span>
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-500" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t("auth.forgotPassword")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-neutral-400">
            {t("auth.forgotPasswordDesc")}
          </p>

          <div className="mt-8">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-neutral-400">
                  {t("auth.email")}
                </label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="name@example.com" className={inputCls} />
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-teal-500/40 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.sendResetLink")}
              </motion.button>
            </form>

            <p className="mt-8 text-center text-sm text-gray-500 dark:text-neutral-400">
              <Link href="/login" className="font-semibold text-teal-600 dark:text-teal-400">{t("auth.backToLogin")}</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
