import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Clock,
  Users,
} from "lucide-react";

import { createAdminClient } from "@/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }> | { locale: string };
}

interface RecentRequest {
  id: string;
  title: string | null;
  municipality: string | null;
  status: string;
  created_at: string;
}

async function getDashboardStats() {
  const admin = createAdminClient();

  const [
    totalUsersRes,
    totalProsRes,
    pendingProsRes,
    totalRequestsRes,
    pendingRequestsRes,
    publishedRequestsRes,
    foundingProsRes,
    recentRequestsRes,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("glatko_professional_profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("verification_status", "approved"),
    admin
      .from("glatko_professional_profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    admin
      .from("glatko_service_requests")
      .select("id", { count: "exact", head: true }),
    admin
      .from("glatko_service_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_moderation"),
    admin
      .from("glatko_service_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    admin
      .from("glatko_professional_profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_founding_provider", true),
    admin
      .from("glatko_service_requests")
      .select("id, title, municipality, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    totalUsers: totalUsersRes.count ?? 0,
    totalPros: totalProsRes.count ?? 0,
    pendingPros: pendingProsRes.count ?? 0,
    totalRequests: totalRequestsRes.count ?? 0,
    pendingRequests: pendingRequestsRes.count ?? 0,
    publishedRequests: publishedRequestsRes.count ?? 0,
    foundingPros: foundingProsRes.count ?? 0,
    recentRequests: (recentRequestsRes.data ?? []) as RecentRequest[],
  };
}

export default async function AdminDashboardPage({ params }: Props) {
  await Promise.resolve(params); // setRequestLocale already called in layout
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white md:text-3xl">
          Yönetim Paneli
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-white/50">
          Glatko platform genel durumu
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
          label="Toplam Üye"
          value={stats.totalUsers}
        />
        <KpiCard
          icon={
            <Briefcase className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          }
          label="Aktif Profesyonel"
          value={stats.totalPros}
          subtitle={
            stats.foundingPros > 0
              ? `${stats.foundingPros} founding`
              : undefined
          }
        />
        <KpiCard
          icon={<Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          label="Bekleyen Pro Başvuru"
          value={stats.pendingPros}
          subtitle={
            stats.pendingPros > 0 ? "İncelenmeyi bekliyor" : undefined
          }
          subtitleAccent={stats.pendingPros > 0}
        />
        <KpiCard
          icon={
            <ClipboardList className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          }
          label="Toplam Talep"
          value={stats.totalRequests}
          subtitle={`${stats.publishedRequests} yayında, ${stats.pendingRequests} bekleyen`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Son Talepler</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentRequests.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-white/50">
              Henüz talep yok
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {req.title || "(başlıksız)"}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-white/50">
                      {req.municipality ?? "—"}
                      {" · "}
                      {new Date(req.created_at).toLocaleString("tr")}
                    </div>
                  </div>
                  <RequestStatusBadge status={req.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  subtitleAccent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle?: string;
  subtitleAccent?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-white/50">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-gray-900 dark:text-white">
          {value}
        </div>
        {subtitle ? (
          <div
            className={cn(
              "mt-1 text-xs",
              subtitleAccent
                ? "font-medium text-amber-600 dark:text-amber-400"
                : "text-gray-500 dark:text-white/50",
            )}
          >
            {subtitle}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; className: string; Icon: typeof Clock }
  > = {
    pending_moderation: {
      label: "Beklemede",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
      Icon: Clock,
    },
    published: {
      label: "Yayında",
      className:
        "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
      Icon: CheckCircle2,
    },
    rejected: {
      label: "Reddedildi",
      className:
        "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
      Icon: AlertCircle,
    },
    expired: {
      label: "Süresi Doldu",
      className:
        "bg-gray-100 text-gray-700 dark:bg-white/[0.06] dark:text-white/60",
      Icon: AlertCircle,
    },
  };
  const cfg = map[status] ?? map.pending_moderation;
  const { Icon } = cfg;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        cfg.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}
