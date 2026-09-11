import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { createClient, createAdminClient } from "@/supabase/server";
import { VerificationTiersDisplay } from "@/components/glatko/verification/VerificationTiersDisplay";
import type { Tier } from "@/components/glatko/verification/VerificationTiersDisplay";

type Props = {
  params: Promise<{ locale: string }> | { locale: string };
};

interface EligibilityShape {
  eligible_tier: Tier;
  business_verified: boolean;
  license_verified: boolean;
  insurance_verified: boolean;
  next_tier_requirements: {
    next: Tier | null;
    requires: string[];
  };
}

/**
 * G-PRO-2 Faz 4 — Pro tier upgrade dashboard.
 *
 * Server component:
 *   - auth gate (redirect to login if no user)
 *   - reads pro profile (verification_tier, tier_documents)
 *   - calls glatko_check_tier_eligibility RPC for the next-tier hint
 *   - renders VerificationTiersDisplay highlighting current tier
 *     and surfacing missing-doc bullets per tier
 *
 * Tier upgrade itself is admin-controlled — this page only shows the
 * pro what they're at and what's missing for the next tier.
 */
export default async function UpgradeTierPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/pro/dashboard/upgrade-tier`);
  }

  const t = await getTranslations({ locale, namespace: "verification" });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("glatko_professional_profiles")
    .select("verification_tier, tier_documents, verification_status")
    .eq("id", user.id)
    .maybeSingle();

  const currentTier =
    ((profile?.verification_tier as Tier | null) ?? "basic") as Tier;
  const tierDocsRaw = (profile?.tier_documents ?? {}) as Record<
    string,
    { verified?: boolean }
  >;
  const docs = {
    business_registration: Boolean(tierDocsRaw.business_registration?.verified),
    license: Boolean(tierDocsRaw.license?.verified),
    insurance: Boolean(tierDocsRaw.insurance?.verified),
  };

  // Eligibility hint via RPC (best-effort)
  let eligibility: EligibilityShape | null = null;
  try {
    const { data, error } = await admin.rpc("glatko_check_tier_eligibility", {
      p_professional_id: user.id,
    });
    if (!error && data) {
      eligibility = data as unknown as EligibilityShape;
    }
  } catch {
    /* ignore */
  }

  const isApproved = profile?.verification_status === "approved";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-12 sm:px-6">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-gray-900 dark:text-white">
          {t("upgradeTierTitle")}
        </h1>
        <div className="mt-2 h-0.5 w-12 rounded-full bg-gradient-to-r from-teal-500 to-teal-600" />
        <p className="mt-3 text-sm text-gray-600 dark:text-white/60">
          {t("upgradeTierSubtitle")}
        </p>
      </div>

      {!isApproved && (
        <div className="mb-6 rounded-2xl border border-amber-300/40 bg-amber-50/60 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          {t("notApprovedYet")}
        </div>
      )}

      <VerificationTiersDisplay
        currentTier={currentTier}
        docs={docs}
        ctaHref={`/${locale}/pro/dashboard/profile`}
      />

      {eligibility?.next_tier_requirements?.next && (
        <div className="mt-8 rounded-2xl border border-gray-200/60 bg-white/70 p-5 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/50">
            {t("nextTier")}
          </p>
          <p className="mt-2 text-sm text-gray-700 dark:text-white/70">
            {t("nextTierExplain", {
              tier: TIER_LABEL[eligibility.next_tier_requirements.next],
              docs: eligibility.next_tier_requirements.requires
                .map((r) => t(`tierRequirements.${r}`))
                .join(", "),
            })}
          </p>
        </div>
      )}
    </div>
  );
}

const TIER_LABEL: Record<Tier, string> = {
  basic: "Basic",
  business: "Business",
  professional: "Professional",
};
