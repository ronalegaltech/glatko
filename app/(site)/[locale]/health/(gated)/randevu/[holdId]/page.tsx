import type { Metadata } from "next";
import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CalendarClock, MapPin, AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getHold } from "@/lib/saglik/booking";
import { intlLocale } from "@/lib/saglik/intl";
import { BookingForm } from "@/components/glatko-saglik/BookingForm";

type Props = {
  params:
    | Promise<{ locale: string; holdId: string }>
    | { locale: string; holdId: string };
};

// Booking is per-request (hold validity is time-sensitive) + noindex (quarantine).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const SESSION_COOKIE = "glatko_hsess";

export default async function BookingPage({ params }: Props) {
  const { locale, holdId } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  const l = locale as Locale;
  const d = (k: string) => t(`healthVertical.booking.${k}`);

  const sessionKey = cookies().get(SESSION_COOKIE)?.value ?? "";
  const hold = sessionKey ? await getHold(holdId, sessionKey, l) : null;

  // Expired / not found / wrong session → designed graceful screen (never crash).
  if (!hold) {
    return (
      <div className="mx-auto max-w-md px-4 pb-24 pt-40 text-center">
        <AlertTriangle className="mx-auto h-9 w-9 text-gray-400" />
        <h1 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          {d("expiredTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500 dark:text-white/50">
          {d("expiredBody")}
        </p>
        <Link
          href="/health"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-teal-500/40"
        >
          {d("backToDirectory")}
        </Link>
      </div>
    );
  }

  const dateTime = new Intl.DateTimeFormat(intlLocale(l), {
    timeZone: "Europe/Podgorica",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(hold.slotStart));

  return (
    <div className="bg-brandHealth-50/40 pb-16 dark:bg-transparent">
      <div className="mx-auto max-w-xl px-4 pb-16 pt-28">
        <h1 className="font-serif text-3xl font-light tracking-tight text-gray-900 dark:text-white">
          {d("pageTitle")}
        </h1>

        {/* Summary (PII-free) */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-premium-sm dark:border-white/10 dark:bg-white/5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">
            {d("summaryTitle")}
          </h2>
          <p className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
            {hold.providerTitle ? `${hold.providerTitle} ` : ""}
            {hold.providerName}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-white/70">
            {hold.serviceName} · {hold.serviceDurationMin} {t("healthVertical.directory.minutesShort")}
            {hold.servicePriceEur != null ? ` · €${hold.servicePriceEur}` : ""}
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
            <CalendarClock className="h-4 w-4 text-brandHealth" />
            {dateTime}
          </p>
          <p className="mt-1.5 flex items-start gap-2 text-sm text-gray-600 dark:text-white/70">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brandHealth" />
            <span>
              {hold.locationLabel}
              <br />
              {hold.locationAddress}, {hold.locationCity}
            </span>
          </p>
        </section>

        <BookingForm
          holdId={hold.holdId}
          expiresAt={hold.expiresAt}
          providerSlug={hold.providerSlug}
          locale={l}
        />
      </div>
    </div>
  );
}
