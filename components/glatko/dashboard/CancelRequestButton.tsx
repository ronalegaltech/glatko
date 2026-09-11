"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cancelRequest } from "@/app/(site)/[locale]/dashboard/requests/[id]/actions";
import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";

interface Props {
  requestId: string;
}

export function CancelRequestButton({ requestId }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleCancel = () => {
    setError("");
    startTransition(async () => {
      const result = await cancelRequest(requestId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? t("dashboard.detail.cancelError"));
      }
    });
  };

  if (!showConfirm) {
    return (
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/10"
      >
        {t("dashboard.detail.cancelRequest")}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
      <p className="mb-3 text-sm text-red-700 dark:text-red-300">
        {t("dashboard.detail.cancelConfirm")}
      </p>
      {error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className={cn(
            "flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {t("dashboard.detail.confirmCancel")}
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-white/60 dark:hover:bg-white/5"
        >
          {t("dashboard.detail.keepRequest")}
        </button>
      </div>
    </div>
  );
}
