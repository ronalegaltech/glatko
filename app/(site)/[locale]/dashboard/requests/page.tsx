import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCustomerRequests } from "@/lib/supabase/glatko.server";
import { Link } from "@/i18n/navigation";
import { PageBackground } from "@/components/ui/PageBackground";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Inbox,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIcon } from "@/lib/utils/categoryIcon";
import type { RequestStatus } from "@/types/glatko";

type Props = {
  params: Promise<{ locale: string }> | { locale: string };
};

const STATUS_CONFIG: Record<
  RequestStatus,
  { color: string; bgColor: string; borderColor: string }
> = {
  draft: { color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-white/10", borderColor: "border-gray-200 dark:border-white/10" },
  published: { color: "text-teal-600 dark:text-teal-400", bgColor: "bg-teal-50 dark:bg-teal-500/10", borderColor: "border-teal-200 dark:border-teal-500/20" },
  bidding: { color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-500/10", borderColor: "border-blue-200 dark:border-blue-500/20" },
  assigned: { color: "text-indigo-600 dark:text-indigo-400", bgColor: "bg-indigo-50 dark:bg-indigo-500/10", borderColor: "border-indigo-200 dark:border-indigo-500/20" },
  in_progress: { color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-500/10", borderColor: "border-amber-200 dark:border-amber-500/20" },
  completed: { color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-500/10", borderColor: "border-green-200 dark:border-green-500/20" },
  reviewed: { color: "text-green-700 dark:text-green-300", bgColor: "bg-green-50 dark:bg-green-500/10", borderColor: "border-green-200 dark:border-green-500/20" },
  closed: { color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-white/10", borderColor: "border-gray-200 dark:border-white/10" },
  expired: { color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-500/10", borderColor: "border-orange-200 dark:border-orange-500/20" },
  cancelled: { color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-500/10", borderColor: "border-red-200 dark:border-red-500/20" },
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  published: Clock,
  bidding: Clock,
  completed: CheckCircle,
  reviewed: CheckCircle,
  in_progress: AlertCircle,
  cancelled: XCircle,
  expired: XCircle,
};

export default async function DashboardRequestsPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login?redirect=/dashboard/requests`);
  }

  const t = await getTranslations();
  const requests = await getCustomerRequests(user.id);

  const { data: proRow } = await supabase
    .from("glatko_professional_profiles")
    .select("verification_status")
    .eq("id", user.id)
    .maybeSingle();
  const isApprovedPro = proRow?.verification_status === "approved";

  const activeCount = requests.filter((r) =>
    ["published", "bidding", "assigned", "in_progress"].includes(r.status)
  ).length;
  const completedCount = requests.filter((r) =>
    ["completed", "reviewed"].includes(r.status)
  ).length;

  return (
    <PageBackground opacity={0.06}>
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-6">
        {/* Title */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-gray-900 dark:text-white">
            {t("dashboard.requests.title")}
          </h1>
          <div className="mt-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-teal-500 to-transparent" />
          <p className="mt-3 text-sm text-gray-500 dark:text-white/50">
            {t("dashboard.requests.subtitle")}
          </p>
        </div>

        {/* ── Stat strip — 3 mini pills ── */}
        <div className="mb-8 flex flex-wrap gap-3">
          {[
            { label: t("dashboard.requests.status.active") ?? "Active", count: activeCount, dot: "bg-teal-500" },
            { label: t("dashboard.requests.status.completed"), count: completedCount, dot: "bg-green-500" },
            { label: t("dashboard.requests.total") ?? "Total", count: requests.length, dot: "bg-gray-400 dark:bg-white/30" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200/60 bg-white/70 px-4 py-2 text-sm backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]"
            >
              <span className={cn("h-2 w-2 rounded-full", stat.dot)} />
              <span className="font-medium text-gray-700 dark:text-white/70">{stat.label}</span>
              <span className="font-bold tabular-nums text-gray-900 dark:text-white">{stat.count}</span>
            </div>
          ))}
        </div>

        {!isApprovedPro && (
          <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-teal-500/25 bg-gradient-to-r from-teal-500/10 via-teal-500/5 to-transparent px-5 py-4 dark:border-teal-500/20 dark:from-teal-500/15 dark:via-teal-500/5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h2 className="font-serif text-base font-semibold text-gray-900 dark:text-white">
                {t("dashboard.requests.becomeProBannerTitle")}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-white/55">
                {t("dashboard.requests.becomeProBannerDesc")}
              </p>
            </div>
            <Link
              href="/become-a-pro"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-500/20 transition-all hover:shadow-lg hover:shadow-teal-500/30"
            >
              {t("nav.becomeAPro")}
            </Link>
          </div>
        )}

        {requests.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-3xl border border-gray-200/60 bg-white/70 px-10 py-14 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
              <ClipboardList className="mx-auto mb-4 h-14 w-14 text-teal-500/30" strokeWidth={1.5} />
              <h2 className="font-serif text-lg font-semibold text-gray-900 dark:text-white">
                {t("dashboard.requests.empty")}
              </h2>
              <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-white/50">
                {t("dashboard.requests.emptyDesc")}
              </p>
              <Link
                href="/request-service"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-xl hover:shadow-teal-500/30"
              >
                {t("dashboard.requests.createFirst")}
              </Link>
            </div>
          </div>
        ) : (
          /* ── Request cards — adapted from kit bento-grid Card pattern ── */
          <div className="space-y-3">
            {requests.map((req, i) => {
              const status = (req.status as RequestStatus) ?? "draft";
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
              const StatusIcon = STATUS_ICONS[status] ?? Clock;
              const CatIcon = req.category?.icon
                ? resolveIcon(req.category.icon)
                : Inbox;
              const catName =
                req.category?.name?.[locale as keyof typeof req.category.name] ??
                req.category?.name?.en ??
                "";
              const date = new Date(req.created_at).toLocaleDateString(locale, {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
              const maxBids = 4;
              const bidPct = Math.min(100, ((req.bid_count ?? 0) / maxBids) * 100);

              return (
                <Link key={req.id} href={{ pathname: "/dashboard/requests/[id]", params: { id: req.id } }}>
                  <div
                    className="group flex items-start gap-4 rounded-2xl border border-gray-200/50 bg-white/70 p-5 backdrop-blur-sm transition-all duration-300 hover:border-teal-500/20 hover:shadow-lg dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-teal-500/15 md:p-6"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {/* Category icon */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 dark:bg-teal-500/15">
                      <CatIcon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                        {req.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-white/50">
                        {catName && <span>{catName}</span>}
                        {req.municipality && (
                          <>
                            <span className="text-gray-300 dark:text-white/15">&middot;</span>
                            <span>{req.municipality}</span>
                          </>
                        )}
                        <span className="text-gray-300 dark:text-white/15">&middot;</span>
                        <span className="text-xs">{date}</span>
                      </div>

                      {/* Bid progress */}
                      {req.bid_count > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-teal-500"
                              style={{ width: `${bidPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-white/30">
                            {req.bid_count}/{maxBids} {t("dashboard.requests.bids")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Status + arrow */}
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                          cfg.color,
                          cfg.bgColor,
                          cfg.borderColor
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {t(`dashboard.requests.status.${status}`)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-white/20" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageBackground>
  );
}
