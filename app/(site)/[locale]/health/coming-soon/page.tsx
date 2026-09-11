import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { HealthWaitlistForm } from "@/components/glatko-saglik/HealthWaitlistForm";
import { VerticalBrand } from "@/components/glatko/verticals/VerticalBrand";

type Props = {
  params: Promise<{ locale: string }> | { locale: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale });
  return { title: t("healthVertical.seoTitle") };
}

/**
 * K2: the only health route that stays live in Production while the vertical
 * is dark — short value proposition + doctor waitlist form, collecting supply
 * before launch (H11 needs 8–10 verified providers on day one).
 */
export default async function HealthComingSoonPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="bg-brandHealth-50/60 dark:bg-transparent">
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-32">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brandHealth-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brandHealth-700 dark:bg-brandHealth/15 dark:text-brandHealth">
            <HeartPulse className="h-3.5 w-3.5" />
            {t("healthVertical.comingSoon.badge")}
          </span>
          {/* Named sub-brand lockup (§1.6) is the coming-soon hero */}
          <h1 className="mt-6">
            <VerticalBrand vertical="health" size="lg" />
          </h1>
          <p className="mx-auto mt-3 text-lg text-gray-700 dark:text-white/80">
            {t("healthVertical.comingSoon.title")}
          </p>
          <p className="mx-auto mt-3 max-w-xl text-gray-600 dark:text-white/60">
            {t("healthVertical.comingSoon.subtitle")}
          </p>
        </div>

        <div className="mt-12 rounded-2xl border border-gray-200 bg-white p-6 shadow-premium-sm dark:border-white/10 dark:bg-white/5 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("healthVertical.comingSoon.waitlistTitle")}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/50">
            {t("healthVertical.comingSoon.waitlistSubtitle")}
          </p>
          <HealthWaitlistForm locale={locale as Locale} />
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-teal-600 hover:underline dark:text-teal-400"
          >
            {t("healthVertical.comingSoon.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
