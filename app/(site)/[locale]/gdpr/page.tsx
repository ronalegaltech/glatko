import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/seo";
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
  const alternates = buildAlternates(locale, "/gdpr");
  return {
    title: "GDPR Rights",
    description: "Your GDPR data protection rights on the Glatko platform.",
    alternates,
    openGraph: {
      title: "GDPR Rights — Glatko",
      url: alternates.canonical,
      siteName: "Glatko",
      locale,
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default async function GdprPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  const c = (key: string) => t(`legal.gdprContent.${key}`);
  const rights = ["r1", "r2", "r3", "r4", "r5", "r6"] as const;
  return (
    <PageBackground opacity={0.08}>
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-28">
        <SectionTitle>{t("legal.gdpr")}</SectionTitle>
        <GlassmorphCard className="p-8 md:p-12" hover={false}>
          <div className="space-y-6 text-sm leading-relaxed text-gray-600 dark:text-white/60">
            <p>{c("intro")}</p>
            {rights.map((r) => (
              <div key={r} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{c(`${r}Title`)}</h2>
                <p className="mt-1">{c(r)}</p>
              </div>
            ))}
            <div className="mt-8 rounded-xl border border-teal-500/10 bg-teal-500/5 p-5">
              <h2 className="text-sm font-semibold text-teal-700 dark:text-teal-400">{c("howToExercise")}</h2>
              <p className="mt-1.5">{c("howToExerciseDesc")}</p>
              <p className="mt-2 text-xs font-medium text-teal-600 dark:text-teal-400">{c("responseTime")}</p>
            </div>
          </div>
        </GlassmorphCard>
      </div>
    </PageBackground>
  );
}
