import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowRight,
  ClipboardList,
  Handshake,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/seo";
import { PageBackground } from "@/components/ui/PageBackground";
import { FoundingCounter } from "@/components/glatko/founding/FoundingCounter";
import { createAdminClient } from "@/supabase/server";

type PageProps = {
  params: Promise<{ locale: string }> | { locale: string };
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  return {
    title: t("hero.title"),
    description: t("hero.subtitle"),
    alternates: buildAlternates(locale, "/how-it-works"),
    openGraph: {
      title: `${t("hero.title")} — Glatko`,
      description: t("hero.subtitle"),
      type: "website",
      url: `https://glatko.app/${locale}/how-it-works`,
      siteName: "Glatko",
      locale,
    },
    robots: { index: true, follow: true },
  };
}

interface CountsShape {
  provider_count: number;
  provider_limit: number;
  provider_remaining: number;
  customer_count: number;
  customer_limit: number;
  customer_remaining: number;
}

// perf-static (2026-09-11): prerendered per locale; the founding counter is refreshed every 600 s.
export const revalidate = 600;

export default async function HowItWorksPage({ params }: PageProps) {
  const { locale } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) return null;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "howItWorks" });

  let counts: CountsShape | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("glatko_founding_counts");
    if (data) counts = data as unknown as CountsShape;
  } catch {
    /* ignore */
  }

  const steps = [
    {
      icon: ClipboardList,
      number: "1",
      title: t("steps.s1.title"),
      desc: t("steps.s1.desc"),
    },
    {
      icon: MessageSquare,
      number: "2",
      title: t("steps.s2.title"),
      desc: t("steps.s2.desc"),
    },
    {
      icon: Handshake,
      number: "3",
      title: t("steps.s3.title"),
      desc: t("steps.s3.desc"),
    },
  ];

  return (
    <PageBackground opacity={0.06}>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-gradient-to-b from-teal-500/[0.10] via-cyan-500/[0.04] to-transparent dark:from-teal-500/[0.08]" />
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6">
        <section className="text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-teal-300/40 bg-teal-50/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:border-teal-400/30 dark:bg-teal-500/10 dark:text-teal-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("hero.eyebrow")}
          </div>
          <h1 className="font-serif text-4xl font-bold leading-tight text-gray-900 dark:text-white sm:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600 dark:text-white/70 sm:text-lg">
            {t("hero.subtitle")}
          </p>
        </section>

        <section className="mt-16">
          <div className="grid gap-6 sm:grid-cols-3">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.number}
                  className="relative rounded-2xl border border-gray-200/60 bg-white/70 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-white shadow-md">
                    {s.number}
                  </div>
                  <Icon
                    className="mt-4 h-6 w-6 text-teal-600 dark:text-teal-400"
                    aria-hidden
                  />
                  <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-white/60">
                    {s.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-indigo-300/40 bg-gradient-to-br from-indigo-500/[0.08] via-violet-500/[0.04] to-transparent p-8 backdrop-blur-sm dark:border-indigo-400/20 dark:from-indigo-500/[0.10] sm:p-10">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h2 className="font-serif text-2xl font-bold text-gray-900 dark:text-white">
                {t("foundingCallout.title")}
              </h2>
              <p className="mt-2 text-sm text-gray-700 dark:text-white/70">
                {t("foundingCallout.body")}
              </p>
            </div>
            <Link
              href="/founding-customer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-500/25 transition-transform hover:-translate-y-0.5"
            >
              {t("foundingCallout.cta")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-8">
            <FoundingCounter initialCounts={counts ?? undefined} />
          </div>
        </section>

        <section className="mt-16 text-center">
          <Link
            href="/request-service"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-teal-500/25 transition-transform hover:-translate-y-0.5"
          >
            {t("cta.button")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      </div>
    </PageBackground>
  );
}
