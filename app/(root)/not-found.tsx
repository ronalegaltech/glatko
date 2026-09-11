import Link from "next/link";
import { headers } from "next/headers";
import { locales, defaultLocale } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { NOT_FOUND_COPY } from "@/lib/utils/notFoundCopy";

function pickLocale(pathname: string | null): Locale {
  if (!pathname) return defaultLocale;
  const seg = pathname.split("/")[1];
  return (locales as readonly string[]).includes(seg)
    ? (seg as Locale)
    : defaultLocale;
}

export default async function NotFound() {
  const h = await headers();
  const locale = pickLocale(h.get("x-pathname"));
  const t = NOT_FOUND_COPY[locale] ?? NOT_FOUND_COPY.en;
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div
      lang={locale}
      dir={dir}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8F6F0] px-4 dark:bg-[#0b1f23]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(20,184,166,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(20,184,166,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-teal-500/[0.04] blur-[120px] dark:bg-teal-500/[0.06]" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-cyan-500/[0.03] blur-[100px] dark:bg-cyan-500/[0.05]" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-gray-200/60 bg-white/70 p-10 text-center shadow-xl backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="mb-6 flex items-center justify-center gap-1">
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              Glatko
            </span>
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-teal-500" />
          </div>
          <span className="font-serif text-7xl font-bold bg-gradient-to-b from-teal-400 to-teal-600 bg-clip-text text-transparent">
            404
          </span>
          <h1 className="mt-4 font-serif text-2xl text-gray-900 dark:text-white">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-white/50">
            {t.subtitle}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/${locale}/services`}
              className="inline-block rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-xl hover:shadow-teal-500/30"
            >
              {t.ctaServices}
            </Link>
            <Link
              href={`/${locale}`}
              className="inline-block rounded-xl border border-gray-200/80 bg-white/60 px-6 py-3 text-sm font-semibold text-gray-700 backdrop-blur-sm transition-all hover:border-teal-500/30 hover:text-teal-600 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:border-teal-500/30 dark:hover:text-teal-400"
            >
              {t.ctaHome}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
