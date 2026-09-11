"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/supabase/browser";
import { AuthBrandPanel } from "@/components/glatko/auth/AuthBrandPanel";
import { cn } from "@/lib/utils";

const inputCls = cn(
  "block w-full rounded-xl border border-gray-200 dark:border-white/10",
  "bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm",
  "text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30",
  "focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all"
);

export default function ResetPasswordPage() {
  const t = useTranslations();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError(t("auth.passwordMismatch")); return; }
    if (password.length < 8) { setError(t("auth.passwordTooShort")); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;
      router.push("/");
      router.refresh();
    } catch { setError(t("auth.updatePasswordError")); } finally { setLoading(false); }
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
            {t("auth.resetPasswordTitle")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-neutral-400">
            {t("auth.resetPasswordDesc")}
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
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-neutral-400">
                  {t("auth.newPassword")}
                </label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" className={inputCls} />
              </div>

              <div>
                <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-neutral-400">
                  {t("auth.confirmPassword")}
                </label>
                <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="••••••••" className={inputCls} />
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-teal-500/40 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.updatePassword")}
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
