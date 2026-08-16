import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Star, Users } from "lucide-react";
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
  const t = await getTranslations({ locale, namespace: "founding.customer" });
  const alternates = buildAlternates(locale, "/founding-customer");
  return {
    title: { absolute: t("hero.title") },
    description: t("hero.subtitle"),
    alternates,
    openGraph: {
      title: t("hero.title"),
      description: t("hero.subtitle"),
      type: "website",
      url: alternates.canonical,
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

export default async function FoundingCustomerLandingPage({ params }: PageProps) {
  const { locale } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) return null;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "founding.customer" });

  let counts: CountsShape | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("glatko_founding_counts");
    if (data) counts = data as unknown as CountsShape;
  } catch {
    /* ignore */
  }

  const benefits = [
    {
      icon: Star,
      title: t("benefits.b1.title"),
      desc: t("benefits.b1.desc"),
    },
    // The "5 free request credits" card was removed with the claim behind it:
    // free_credits is granted by migration 030 and read by no code path, and a
    // request is free for every customer anyway, so there was nothing true to
    // reword it into. Two cards is the honest set.
    {
      icon: Users,
      title: t("benefits.b3.title"),
      desc: t("benefits.b3.desc"),
    },
  ];

  return (
    <PageBackground opacity={0.06}>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-indigo-500/[0.10] via-violet-500/[0.04] to-transparent dark:from-indigo-500/[0.08]" />
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6">
        <section className="text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-50/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-300">
            <Star className="h-3.5 w-3.5" aria-hidden />
            {t("hero.eyebrow")}
          </div>
          <h1 className="font-serif text-4xl font-bold leading-tight text-gray-900 dark:text-white sm:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600 dark:text-white/70 sm:text-lg">
            {t("hero.subtitle")}
          </p>

          <div className="mx-auto mt-10 max-w-3xl">
            <FoundingCounter initialCounts={counts ?? undefined} />
          </div>

          <div className="mt-8">
            <Link
              href="/request-service"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-500/25 transition-transform hover:-translate-y-0.5"
            >
              {t("hero.cta")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>

        <section className="mt-20">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold text-gray-900 dark:text-white">
              {t("benefits.title")}
            </h2>
            <div className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-indigo-400 to-violet-500" />
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="rounded-2xl border border-gray-200/60 bg-white/70 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10">
                    <Icon
                      className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                      aria-hidden
                    />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {b.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-white/60">
                    {b.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-20">
          <div className="rounded-3xl border border-gray-200/60 bg-white/70 p-8 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-10">
            <h2 className="font-serif text-2xl font-bold text-gray-900 dark:text-white">
              {t("howToBecome.title")}
            </h2>
            <ol className="mt-6 space-y-4 text-sm text-gray-700 dark:text-white/80">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  1
                </span>
                <span>{t("howToBecome.step1")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  2
                </span>
                <span>{t("howToBecome.step2")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  3
                </span>
                <span>{t("howToBecome.step3")}</span>
              </li>
            </ol>
          </div>
        </section>

        <section className="mt-20 text-center">
          <div className="rounded-3xl border border-indigo-300/40 bg-gradient-to-br from-indigo-500/[0.08] via-violet-500/[0.04] to-transparent p-10 backdrop-blur-sm dark:border-indigo-400/20 dark:from-indigo-500/[0.12]">
            <h2 className="font-serif text-3xl font-bold text-gray-900 dark:text-white">
              {t("cta.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600 dark:text-white/70">
              {t("cta.subtitle")}
            </p>
            <Link
              href="/request-service"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-500/25 transition-transform hover:-translate-y-0.5"
            >
              {t("cta.button")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      </div>
    </PageBackground>
  );
}
