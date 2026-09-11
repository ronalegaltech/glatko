"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import type { VerificationStatus } from "@/types/glatko";
import { updateProfessionalStatus } from "@/app/(site)/[locale]/admin/professionals/actions";

interface AdminActionsProps {
  professionalId: string;
  currentStatus: VerificationStatus;
}

export function AdminActions({
  professionalId,
  currentStatus,
}: AdminActionsProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  function handleStatusChange(status: VerificationStatus, reason?: string) {
    startTransition(async () => {
      await updateProfessionalStatus(professionalId, status, reason);
      router.refresh();
    });
  }

  if (currentStatus === "approved") {
    return (
      <p className="text-sm font-medium text-green-600 dark:text-green-400">
        {t("admin.professionals.approved")}
      </p>
    );
  }

  if (currentStatus === "rejected") {
    return (
      <p className="text-sm font-medium text-red-600 dark:text-red-400">
        {t("admin.professionals.rejected")}
      </p>
    );
  }

  if (currentStatus === "pending") {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        disabled={isPending}
        onClick={() => handleStatusChange("in_review")}
        className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? t("common.loading") : t("admin.professionals.takeReview")}
      </motion.button>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        disabled={isPending}
        onClick={() => {
          if (window.confirm(t("admin.professionals.confirmApprove"))) {
            handleStatusChange("approved");
          }
        }}
        className="rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? t("common.loading") : t("admin.professionals.approve")}
      </motion.button>

      {!showRejectForm ? (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isPending}
          onClick={() => setShowRejectForm(true)}
          className="rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("admin.professionals.reject")}
        </motion.button>
      ) : (
        <div className="flex w-full max-w-md flex-col gap-3">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t("admin.professionals.rejectReason")}
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 dark:border-white/20 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40"
          />
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isPending}
              onClick={() => {
                if (window.confirm(t("admin.professionals.confirmReject"))) {
                  handleStatusChange("rejected", rejectReason || undefined);
                }
              }}
              className="rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending
                ? t("common.loading")
                : t("admin.professionals.reject")}
            </motion.button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setShowRejectForm(false);
                setRejectReason("");
              }}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
