"use client";

import { GlatkoHeader } from "@/components/GlatkoHeader";
import { OnboardingWelcomeBanner } from "@/components/glatko/onboarding/OnboardingWelcomeBanner";
import { SentryUserScope } from "@/components/monitoring/SentryUserScope";
import { SearchModal } from "@/components/glatko/search/SearchModal";
import { QuoteReviewsSection } from "@/components/glatko/pro/QuoteReviewsSection";
import { useSession } from "./SessionProvider";
import type { ComponentProps } from "react";

/**
 * Thin client wrappers that feed the viewer's session (SessionProvider) into
 * components that used to receive it as server props from the [locale]
 * layout. See app/api/session/route.ts for why.
 */

export function HeaderBound() {
  const s = useSession();
  return <GlatkoHeader userId={s.userId} isPro={s.isPro} isAdmin={s.isAdmin} />;
}

export function OnboardingBannerBound() {
  const s = useSession();
  if (!s.onboarding) return null;
  return (
    <div className="shrink-0">
      <OnboardingWelcomeBanner displayName={s.onboarding.firstName} />
    </div>
  );
}

export function SentryUserScopeBound() {
  const s = useSession();
  return <SentryUserScope userId={s.userId} email={s.email} />;
}

export function SearchModalBound({ locale }: { locale: string }) {
  const s = useSession();
  return <SearchModal locale={locale} isAuthenticated={!!s.userId} />;
}

type ReviewsProps = Omit<ComponentProps<typeof QuoteReviewsSection>, "viewerIsOwner"> & {
  /** The professional whose profile this is — the owner sees the respond form. */
  ownerId: string;
};

export function QuoteReviewsSectionBound({ ownerId, ...rest }: ReviewsProps) {
  const s = useSession();
  return <QuoteReviewsSection {...rest} viewerIsOwner={s.userId === ownerId} />;
}
