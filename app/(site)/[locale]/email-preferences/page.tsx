import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import Link from "next/link";
import { routing } from "@/i18n/routing";
import { PageBackground } from "@/components/ui/PageBackground";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { GlassmorphCard } from "@/components/ui/GlassmorphCard";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string }> | { locale: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    title: "Email Preferences — Glatko",
    description:
      "Manage how Glatko contacts you. Glatko only sends transactional emails required for account security.",
    // Tokenized recipient links land here — never index.
    robots: { index: false, follow: false },
  };
}

export default async function EmailPreferencesPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("emailPreferences");
  const isRTL = locale === "ar";

  return (
    <PageBackground opacity={0.08}>
      <div
        className="mx-auto max-w-2xl px-4 pb-16 pt-28"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <SectionTitle>{t("title")}</SectionTitle>
        <GlassmorphCard className="p-8 md:p-12" hover={false}>
          <div className="space-y-6 text-sm leading-relaxed text-gray-600 dark:text-white/60">
            <p>{t("transactional")}</p>
            <p>{t("deleteAccount")}</p>
            <div className="pt-2">
              <Link
                href={`/${locale}/settings/profile`}
                className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                {t("goToSettings")}
              </Link>
            </div>
            <div className="border-t border-gray-200 pt-6 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/50">
                {t("noteHeader")}
              </p>
              <p className="mt-2 text-xs">{t("supportNote")}</p>
            </div>
          </div>
        </GlassmorphCard>
      </div>
    </PageBackground>
  );
}
