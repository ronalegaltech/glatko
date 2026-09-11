"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Euro,
  MapPin,
  Phone,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  approveRequest,
  rejectRequest,
} from "@/app/(site)/[locale]/admin/requests/actions";
import type { AdminRequestRow } from "@/app/(site)/[locale]/admin/requests/page";

interface Props {
  rows: AdminRequestRow[];
  locale: string;
}

function pickName(
  obj: Record<string, string> | null | undefined,
  locale: string,
  fallback: string,
): string {
  if (!obj) return fallback;
  return obj[locale] || obj.en || fallback;
}

export function AdminRequestsList({ rows, locale }: Props) {
  const t = useTranslations();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <RequestCard
          key={row.id}
          row={row}
          locale={locale}
          expanded={expandedId === row.id}
          onToggle={() =>
            setExpandedId((prev) => (prev === row.id ? null : row.id))
          }
          t={t}
        />
      ))}
    </div>
  );
}

interface CardProps {
  row: AdminRequestRow;
  locale: string;
  expanded: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useTranslations>;
}

function RequestCard({ row, locale, expanded, onToggle, t }: CardProps) {
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const requestor =
    row.anonymous_email ??
    (row.customer_id
      ? `${t("admin.requests.signedInUser")} · ${row.customer_id.slice(0, 8)}…`
      : t("admin.requests.unknownUser"));
  const categoryLabel = pickName(
    row.category_name,
    locale,
    row.category_slug ?? row.category_id,
  );
  const createdAt = new Date(row.created_at).toLocaleString();

  const budgetLabel =
    row.budget_min || row.budget_max
      ? `${row.budget_min ?? "?"} – ${row.budget_max ?? "?"} €`
      : null;
  const dateLabel = row.preferred_date_start
    ? new Date(row.preferred_date_start).toLocaleDateString()
    : null;

  const handleApprove = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await approveRequest(row.id);
      if (!res.success) {
        setActionError(res.error ?? "Approve failed");
      }
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      setActionError(t("admin.requests.rejectReasonRequired"));
      return;
    }
    setActionError(null);
    startTransition(async () => {
      const res = await rejectRequest(row.id, rejectReason);
      if (!res.success) {
        setActionError(res.error ?? "Reject failed");
      }
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 p-4 text-left transition hover:bg-gray-50 dark:hover:bg-neutral-900"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-teal-500/15 px-2 py-1 text-xs font-medium text-teal-700 dark:text-teal-300">
              {categoryLabel}
            </span>
            <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-neutral-500">
              {row.locale ?? "—"}
            </span>
            <span className="text-xs text-gray-500 dark:text-neutral-500">
              {createdAt}
            </span>
          </div>
          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
            {requestor}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-neutral-400">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {row.municipality}
              {row.address ? ` · ${row.address}` : ""}
            </span>
            {budgetLabel ? (
              <span className="inline-flex items-center gap-1">
                <Euro className="h-3 w-3" aria-hidden="true" />
                {budgetLabel}
              </span>
            ) : null}
            {dateLabel ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                {dateLabel}
              </span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-gray-400 dark:text-neutral-500">
          {expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-gray-200 bg-gray-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              {t("admin.requests.answers")}
            </h3>
            <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
              {JSON.stringify(row.details, null, 2)}
            </pre>
          </section>

          {row.photos && row.photos.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                {t("admin.requests.photos")} ({row.photos.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {row.photos.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="h-24 w-24 rounded-lg border border-gray-200 object-cover dark:border-neutral-800"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {(row.details as Record<string, unknown>).phone ? (
            <section className="text-xs">
              <span className="font-semibold text-gray-700 dark:text-neutral-300">
                <Phone
                  className="mr-1 inline-block h-3 w-3"
                  aria-hidden="true"
                />
                {t("admin.requests.phone")}:
              </span>{" "}
              <span className="font-mono text-gray-900 dark:text-white">
                {(row.details as Record<string, unknown>).phone as string}
              </span>
            </section>
          ) : null}

          {actionError ? (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300">
              {actionError}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleApprove}
              disabled={pending}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50",
              )}
            >
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              {pending
                ? t("admin.requests.processing")
                : t("admin.requests.approve")}
            </button>

            {!showRejectInput ? (
              <button
                type="button"
                onClick={() => setShowRejectInput(true)}
                disabled={pending}
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-red-500 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                {t("admin.requests.reject")}
              </button>
            ) : (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t("admin.requests.rejectReasonPlaceholder")}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  maxLength={1000}
                />
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={pending || !rejectReason.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  {pending
                    ? t("admin.requests.processing")
                    : t("admin.requests.confirmReject")}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
