"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Save } from "lucide-react";
import {
  adminSetProTier,
  type VerificationTier,
} from "@/app/(site)/[locale]/admin/professionals/actions";
import { cn } from "@/lib/utils";

interface Props {
  professionalId: string;
  currentTier: VerificationTier;
  currentDocs: {
    business_registration?: { verified?: boolean };
    license?: { verified?: boolean };
    insurance?: { verified?: boolean };
    tax_certificate?: { verified?: boolean };
  };
}

const TIERS: VerificationTier[] = ["basic", "business", "professional"];
const DOC_TYPES = [
  "business_registration",
  "license",
  "insurance",
  "tax_certificate",
] as const;

/**
 * G-PRO-2 Faz 4 — Admin tier editor (client component).
 *
 * Drops into /admin/professionals/[id] underneath AdminActions. Admin
 * picks tier + flips per-document verified flags + clicks Save → calls
 * adminSetProTier server action → glatko_admin_set_tier RPC → router
 * refresh.
 */
export function AdminTierEditor({
  professionalId,
  currentTier,
  currentDocs,
}: Props) {
  const t = useTranslations("verification");
  const router = useRouter();
  const [tier, setTier] = useState<VerificationTier>(currentTier);
  const [docs, setDocs] = useState<Record<string, boolean>>({
    business_registration: Boolean(currentDocs.business_registration?.verified),
    license: Boolean(currentDocs.license?.verified),
    insurance: Boolean(currentDocs.insurance?.verified),
    tax_certificate: Boolean(currentDocs.tax_certificate?.verified),
  });
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );

  function save() {
    startTransition(async () => {
      const result = await adminSetProTier(professionalId, tier, docs);
      if (result.success) {
        setFeedback({ ok: true, msg: t("tierSaved") });
        router.refresh();
      } else {
        setFeedback({
          ok: false,
          msg: result.error ?? t("tierSaveFailed"),
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200/60 bg-white/80 p-5 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
      <h3 className="mb-1 font-serif text-lg font-semibold text-gray-900 dark:text-white">
        {t("tierEditorTitle")}
      </h3>
      <p className="mb-4 text-xs text-gray-500 dark:text-white/45">
        {t("tierEditorSubtitle")}
      </p>

      <div className="mb-5">
        <label className="mb-2 block text-xs font-medium text-gray-500 dark:text-white/50">
          {t("tier")}
        </label>
        <div className="flex flex-wrap gap-2">
          {TIERS.map((tt) => (
            <button
              key={tt}
              type="button"
              onClick={() => setTier(tt)}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-medium transition-all",
                tier === tt
                  ? tt === "professional"
                    ? "border-indigo-500 bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                    : tt === "business"
                      ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                      : "border-gray-700 bg-gray-700 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-teal-500/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70",
              )}
            >
              {TIER_LABEL[tt]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-xs font-medium text-gray-500 dark:text-white/50">
          {t("verifiedDocuments")}
        </label>
        <div className="space-y-2">
          {DOC_TYPES.map((dt) => (
            <label
              key={dt}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/40 px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
            >
              <input
                type="checkbox"
                checked={docs[dt]}
                onChange={(e) =>
                  setDocs((d) => ({ ...d, [dt]: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500/30"
              />
              <span className="text-gray-900 dark:text-white">
                {t(`documentTypes.${dt}`)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          className={cn(
            "mb-4 rounded-xl border px-3 py-2 text-xs",
            feedback.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
          )}
        >
          {feedback.msg}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Save className="h-4 w-4" aria-hidden />
        )}
        {t("saveTier")}
      </button>
    </div>
  );
}

const TIER_LABEL: Record<VerificationTier, string> = {
  basic: "Basic",
  business: "Business",
  professional: "Professional",
};
