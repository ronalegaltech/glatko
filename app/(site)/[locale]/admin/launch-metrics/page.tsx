import { setRequestLocale, getTranslations } from "next-intl/server";
import { Activity, ClipboardList, MapPin, Users } from "lucide-react";
import { createAdminClient } from "@/supabase/server";
import { FoundingCounter } from "@/components/glatko/founding/FoundingCounter";

type Props = {
  params: Promise<{ locale: string }> | { locale: string };
};

interface LaunchMetrics {
  founding_provider: { count: number; limit: number; remaining: number };
  founding_customer: { count: number; limit: number; remaining: number };
  pros_by_city: Record<string, number>;
  pros_by_category: Record<string, number>;
  requests_total: number;
  requests_pending: number;
  requests_published: number;
  last_24h_signups: number;
}

async function fetchMetrics(): Promise<LaunchMetrics | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("glatko_launch_metrics");
    if (error || !data) return null;
    return data as unknown as LaunchMetrics;
  } catch {
    return null;
  }
}

/**
 * G-LAUNCH-1 Faz 7 — Admin-only launch dashboard.
 *
 * Surfaces the soft-launch counters (founding programs), geographic +
 * category distribution of approved pros, request flow (total / pending /
 * published), and last-24h signup rate. Powered by glatko_launch_metrics()
 * RPC which raises Forbidden if the caller is not an admin (defence in
 * depth — the layout also gates the route).
 */
export default async function LaunchMetricsPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "launchMetrics" });
  const metrics = await fetchMetrics();

  const cityRows = metrics
    ? Object.entries(metrics.pros_by_city).sort((a, b) => b[1] - a[1])
    : [];
  const categoryRows = metrics
    ? Object.entries(metrics.pros_by_category).sort((a, b) => b[1] - a[1])
    : [];

  const totalCityPros = cityRows.reduce((acc, [, n]) => acc + n, 0);
  const totalCatPros = categoryRows.reduce((acc, [, n]) => acc + n, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">
          {t("title")}
        </h1>
        <div className="mt-2 h-0.5 w-12 rounded-full bg-gradient-to-r from-teal-500 to-teal-600" />
        <p className="mt-3 text-sm text-gray-500 dark:text-white/50">
          {t("subtitle")}
        </p>
      </div>

      {!metrics ? (
        <div className="rounded-2xl border border-red-200/60 bg-red-50/60 p-6 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {t("loadError")}
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Founding counters ── */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">
              {t("foundingPrograms")}
            </h2>
            <FoundingCounter
              initialCounts={{
                provider_count: metrics.founding_provider.count,
                provider_limit: metrics.founding_provider.limit,
                provider_remaining: metrics.founding_provider.remaining,
                customer_count: metrics.founding_customer.count,
                customer_limit: metrics.founding_customer.limit,
                customer_remaining: metrics.founding_customer.remaining,
              }}
            />
          </section>

          {/* ── Top stats row ── */}
          <section className="grid gap-4 sm:grid-cols-4">
            <StatCard
              icon={ClipboardList}
              label={t("stats.totalRequests")}
              value={metrics.requests_total}
              tone="teal"
            />
            <StatCard
              icon={ClipboardList}
              label={t("stats.pendingRequests")}
              value={metrics.requests_pending}
              tone="amber"
            />
            <StatCard
              icon={Activity}
              label={t("stats.publishedRequests")}
              value={metrics.requests_published}
              tone="emerald"
            />
            <StatCard
              icon={Users}
              label={t("stats.last24hSignups")}
              value={metrics.last_24h_signups}
              tone="indigo"
            />
          </section>

          {/* ── Distribution panels ── */}
          <section className="grid gap-6 lg:grid-cols-2">
            <DistributionPanel
              icon={MapPin}
              title={t("distribution.byCity")}
              rows={cityRows}
              total={totalCityPros}
              emptyText={t("distribution.empty")}
              tone="teal"
            />
            <DistributionPanel
              icon={ClipboardList}
              title={t("distribution.byCategory")}
              rows={categoryRows}
              total={totalCatPros}
              emptyText={t("distribution.empty")}
              tone="violet"
            />
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: "teal" | "amber" | "emerald" | "indigo";
}) {
  const palette: Record<typeof tone, { bg: string; text: string }> = {
    teal: {
      bg: "bg-teal-500/10 dark:bg-teal-500/15",
      text: "text-teal-600 dark:text-teal-400",
    },
    amber: {
      bg: "bg-amber-500/10 dark:bg-amber-500/15",
      text: "text-amber-600 dark:text-amber-400",
    },
    emerald: {
      bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    indigo: {
      bg: "bg-indigo-500/10 dark:bg-indigo-500/15",
      text: "text-indigo-600 dark:text-indigo-400",
    },
  };
  const p = palette[tone];
  return (
    <div className="rounded-2xl border border-gray-200/60 bg-white/70 p-5 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${p.bg}`}>
        <Icon className={`h-4 w-4 ${p.text}`} aria-hidden />
      </div>
      <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-gray-500 dark:text-white/50">
        {label}
      </p>
    </div>
  );
}

function DistributionPanel({
  icon: Icon,
  title,
  rows,
  total,
  emptyText,
  tone,
}: {
  icon: typeof MapPin;
  title: string;
  rows: Array<[string, number]>;
  total: number;
  emptyText: string;
  tone: "teal" | "violet";
}) {
  const fill =
    tone === "teal"
      ? "bg-gradient-to-r from-teal-400 to-cyan-500"
      : "bg-gradient-to-r from-violet-500 to-fuchsia-500";
  const iconColor =
    tone === "teal"
      ? "text-teal-600 dark:text-teal-400"
      : "text-violet-600 dark:text-violet-400";

  return (
    <div className="rounded-2xl border border-gray-200/60 bg-white/70 p-6 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="mb-4 flex items-center gap-2">
        <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-4 py-6 text-center text-xs text-gray-500 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white/45">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map(([key, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <li key={key}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium capitalize text-gray-700 dark:text-white/80">
                    {key.replace(/-/g, " ")}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-white/50">
                    {count}{" "}
                    <span className="text-gray-400 dark:text-white/30">({pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${fill}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
