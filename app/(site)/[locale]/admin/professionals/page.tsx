import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ClipboardList } from "lucide-react";
import { getProfessionalsByStatus } from "@/lib/supabase/glatko.server";
import type { VerificationStatus } from "@/types/glatko";

type Props = {
  params: Promise<{ locale: string }> | { locale: string };
  searchParams:
    | Promise<{ status?: string }>
    | { status?: string };
};

const STATUS_FILTER_OPTIONS: Array<{
  value: "all" | VerificationStatus;
  label: string;
}> = [
  { value: "all", label: "Tümü" },
  { value: "pending", label: "Beklemede" },
  { value: "in_review", label: "İncelemede" },
  { value: "approved", label: "Onaylanmış" },
  { value: "rejected", label: "Reddedilmiş" },
];

const STATUS_STYLES: Record<VerificationStatus, string> = {
  pending:
    "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-900/20 dark:text-yellow-300",
  in_review:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-900/20 dark:text-blue-300",
  approved:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-900/20 dark:text-green-300",
  rejected:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300",
};

const STATUS_KEYS: Record<VerificationStatus, string> = {
  pending: "admin.professionals.pending",
  in_review: "admin.professionals.inReview",
  approved: "admin.professionals.approved",
  rejected: "admin.professionals.rejected",
};

export default async function ProfessionalsAdminPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await Promise.resolve(params);
  const sp = await Promise.resolve(searchParams);
  setRequestLocale(locale);

  const filter = (sp.status ?? "all") as "all" | VerificationStatus;
  const validFilters: Array<"all" | VerificationStatus> = [
    "all",
    "pending",
    "in_review",
    "approved",
    "rejected",
  ];
  const safeFilter = validFilters.includes(filter) ? filter : "all";

  const t = await getTranslations();
  const professionals =
    safeFilter === "all"
      ? await getProfessionalsByStatus()
      : await getProfessionalsByStatus(safeFilter);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">
            {t("admin.professionals.title")}
          </h1>
          <div className="mt-2 h-0.5 w-12 rounded-full bg-gradient-to-r from-teal-500 to-teal-600" />
          <p className="mt-2 text-sm text-gray-500 dark:text-white/50">
            {professionals.length} kayıt
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTER_OPTIONS.map((opt) => {
            const isActive = safeFilter === opt.value;
            const href =
              opt.value === "all" ? "?" : `?status=${opt.value}`;
            return (
              <Link
                key={opt.value}
                href={href}
                className={
                  isActive
                    ? "rounded-lg bg-teal-500/15 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-300"
                    : "rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-white/60 dark:hover:bg-white/[0.04]"
                }
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {professionals.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-gray-200/50 bg-white/70 px-6 py-16 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <ClipboardList className="h-14 w-14 text-teal-500/30" strokeWidth={1.5} />
          <h2 className="mt-4 font-serif text-lg font-semibold text-gray-700 dark:text-white/70">
            {t("admin.professionals.noApplications")}
          </h2>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {professionals.map((pro) => {
            const name = pro.profile?.full_name ?? pro.business_name ?? "---";
            const initials = name !== "---"
              ? name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
              : "?";
            return (
              <div
                key={pro.id}
                className="rounded-2xl border border-gray-200/50 bg-white/70 p-5 backdrop-blur-sm transition-all duration-300 hover:border-teal-500/20 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-semibold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-white/50">
                        {pro.location_city ?? "---"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[pro.verification_status]}`}
                  >
                    {t(STATUS_KEYS[pro.verification_status])}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                  <span className="text-xs text-gray-400 dark:text-white/40">
                    {new Date(pro.created_at).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <Link
                    href={`/${locale}/admin/professionals/${pro.id}`}
                    className="text-xs font-medium text-teal-600 transition-colors hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
                  >
                    {t("admin.professionals.viewDocuments")} &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
