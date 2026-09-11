import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { createAdminClient } from "@/supabase/server";
import { AdminRequestsList } from "@/components/admin/AdminRequestsList";

type Props = {
  params: Promise<{ locale: string }> | { locale: string };
  searchParams:
    | Promise<{ status?: string }>
    | { status?: string };
};

const REQUEST_STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "pending_moderation", label: "Beklemede" },
  { value: "published", label: "Yayında" },
  { value: "rejected", label: "Reddedilmiş" },
  { value: "expired", label: "Süresi dolmuş" },
  { value: "all", label: "Tümü" },
];

export interface AdminRequestRow {
  id: string;
  customer_id: string | null;
  anonymous_email: string | null;
  category_id: string;
  category_name: Record<string, string> | null;
  category_slug: string | null;
  details: Record<string, unknown>;
  municipality: string;
  address: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_date_start: string | null;
  preferred_date_end: string | null;
  urgency: string | null;
  photos: string[] | null;
  locale: string | null;
  status: string;
  created_at: string;
}

/**
 * G-REQ-1 Faz 8: admin moderation queue.
 *
 * `app/[locale]/admin/layout.tsx` already gates non-admins (login redirect
 * + isAdminEmail check), so we don't repeat that here. We use the
 * service-role client so we don't have to ship admin-specific RLS
 * policies — the layout-level email gate is the authorization boundary.
 */
export default async function AdminRequestsPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await Promise.resolve(params);
  const sp = await Promise.resolve(searchParams);
  setRequestLocale(locale);

  const validFilters = REQUEST_STATUS_FILTERS.map((f) => f.value);
  const requestedFilter = sp.status ?? "pending_moderation";
  const filter = validFilters.includes(requestedFilter)
    ? requestedFilter
    : "pending_moderation";

  const t = await getTranslations();
  const admin = createAdminClient();

  let query = admin
    .from("glatko_service_requests")
    .select(
      `id, customer_id, anonymous_email, category_id, details, municipality,
       address, budget_min, budget_max, preferred_date_start, preferred_date_end,
       urgency, photos, locale, status, created_at,
       category:category_id (slug, name)`,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data, error } = await query;

  const rows: AdminRequestRow[] = (data ?? []).map((row) => {
    const cat = (row as { category: unknown }).category;
    const catObj = Array.isArray(cat) ? cat[0] : cat;
    return {
      id: row.id as string,
      customer_id: row.customer_id as string | null,
      anonymous_email: row.anonymous_email as string | null,
      category_id: row.category_id as string,
      category_name:
        (catObj as { name?: Record<string, string> } | null)?.name ?? null,
      category_slug:
        (catObj as { slug?: string } | null)?.slug ?? null,
      details: (row.details as Record<string, unknown>) ?? {},
      municipality: row.municipality as string,
      address: row.address as string | null,
      budget_min: row.budget_min as number | null,
      budget_max: row.budget_max as number | null,
      preferred_date_start: row.preferred_date_start as string | null,
      preferred_date_end: row.preferred_date_end as string | null,
      urgency: row.urgency as string | null,
      photos: (row.photos as string[] | null) ?? [],
      locale: row.locale as string | null,
      status: row.status as string,
      created_at: row.created_at as string,
    };
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">
            {t("admin.requests.title")}
          </h1>
          <div className="mt-2 h-0.5 w-12 rounded-full bg-gradient-to-r from-teal-500 to-teal-600" />
          <p className="mt-2 text-sm text-gray-500 dark:text-white/50">
            {rows.length} kayıt
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {REQUEST_STATUS_FILTERS.map((opt) => {
            const isActive = filter === opt.value;
            const href =
              opt.value === "pending_moderation"
                ? "?"
                : `?status=${opt.value}`;
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

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300">
          {t("admin.requests.loadError")}: {error.message}
        </div>
      ) : null}

      {rows.length === 0 && !error ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-gray-200/50 bg-white/70 px-6 py-16 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <ClipboardList
            className="h-14 w-14 text-teal-500/30"
            strokeWidth={1.5}
          />
          <h2 className="mt-4 font-serif text-lg font-semibold text-gray-700 dark:text-white/70">
            {t("admin.requests.queueEmpty")}
          </h2>
        </div>
      ) : (
        <AdminRequestsList rows={rows} locale={locale} />
      )}
    </div>
  );
}
