import { createClient } from "@/supabase/server";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getProfessionalProfile, getMatchingRequests, getProfessionalBids } from "@/lib/supabase/glatko.server";
import { ProDashboardClient } from "@/components/glatko/pro/ProDashboardClient";

type Props = {
  params: Promise<{ locale: string }> | { locale: string };
};

export default async function ProDashboardPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  setRequestLocale(locale);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const t = await getTranslations();
  const profile = await getProfessionalProfile(user.id);
  if (!profile) return null;

  if (profile.verification_status !== "approved") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
            <svg className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl text-white">{t("proDashboard.notApproved")}</h2>
          <p className="mt-3 text-sm text-white/50">{t("proDashboard.notApprovedDesc")}</p>
        </div>
      </div>
    );
  }

  const [requests, bids] = await Promise.all([
    getMatchingRequests(user.id),
    getProfessionalBids(user.id),
  ]);

  const pendingBids = bids.filter((b) => b.status === "pending").length;
  const activeJobs = bids.filter((b) => b.status === "accepted").length;

  return (
    <ProDashboardClient
      displayName={profile.business_name || profile.profile?.full_name || "Pro"}
      isVerified={profile.is_verified}
      rating={Number(profile.avg_rating ?? 0)}
      pendingBids={pendingBids}
      activeJobs={activeJobs}
      completedJobs={Number(profile.completed_jobs ?? 0)}
      matchingRequestsCount={requests.length}
      recentBidsCount={bids.length}
      locale={locale}
    />
  );
}
