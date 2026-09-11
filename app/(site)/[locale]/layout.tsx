import { hasLocale } from "next-intl";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "../../globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { GoogleTagManager } from "@next/third-parties/google";
import { MetaPixel } from "@/components/glatko/analytics/MetaPixel";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/seo";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { GlatkoFooter } from "@/components/GlatkoFooter";
import { VerticalsNav } from "@/components/glatko/verticals/VerticalsNav";
import { isHealthVerticalEnabled } from "@/lib/saglik/flags";
import { CookieConsent } from "@/components/glatko/CookieConsent";
import { YandexMetrica } from "@/components/seo/YandexMetrica";
import { SearchModalProvider } from "@/components/glatko/search/SearchModalContext";
import { SessionProvider } from "@/components/glatko/session/SessionProvider";
import {
  HeaderBound,
  OnboardingBannerBound,
  SearchModalBound,
  SentryUserScopeBound,
} from "@/components/glatko/session/SessionBound";
import {
  generateOrganizationSchema,
  jsonLdScriptProps,
} from "@/lib/seo/jsonld";
import type { Metadata } from "next";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }> | { locale: string };
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }> | { locale: string };
}): Promise<Metadata> {
  const { locale } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale });
  const title = t("seo.landingTitle");
  const description = t("seo.landingDesc");
  // Locale homepage canonical + 9-locale hreflang via the single helper.
  // See docs/audits/gsc-audit-2026-05-18.md Bugs A/C for the prior
  // double-emission pattern this replaces.
  const alternates = buildAlternates(locale, "/");
  return {
    metadataBase: new URL("https://glatko.app"),
    title: {
      default: title,
      template: "%s | Glatko",
    },
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      siteName: "Glatko",
      locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
    // Moved from the former app/layout.tsx (perf-static 2026-09-11).
    icons: {
      icon: "/icon.svg",
      apple: "/apple-icon.svg",
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      yandex: process.env.YANDEX_VERIFICATION,
      other: Object.keys(verificationOther).length > 0 ? verificationOther : undefined,
    },
  };
}

const RTL_LOCALES = new Set(["ar"]);

// perf-static (2026-09-11): this is the ROOT layout for the whole locale tree
// now (app/layout.tsx used to wrap it and read the `x-pathname` header to set
// <html lang>, which forced every page into per-request rendering). The lang
// comes from the route param instead, so the shell is fully static.
// BCP 47 lang tag for the <html lang> attribute. Decoupled from URL prefix
// so URLs stay short (/me/, /sr/) but crawlers see the explicit script subtag.
//   me → sr-Latn-ME (Montenegrin Latin script)
//   sr → sr-Latn-RS (Serbian Latin script as used on the .sr/ subtree)
const URL_LOCALE_TO_HTML_LANG: Record<string, string> = {
  ar: "ar",
  de: "de",
  en: "en",
  it: "it",
  me: "sr-Latn-ME",
  ru: "ru",
  sr: "sr-Latn-RS",
  tr: "tr",
  uk: "uk",
};


const inter = Inter({
  subsets: ["latin", "cyrillic", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

// Cormorant weight usage audited 3 May 2026: only font-light (300),
// default (400), font-semibold (600), font-bold (700) appear with
// font-serif anywhere in the codebase. Weight 500 was loaded but never
// referenced — dropping it removes one woff2 from the critical font set.
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic", "latin-ext"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

// Search engine ownership verification meta tags. All three are env-gated so
// previews / local builds don't leak verification tokens into the HTML.
//   - GOOGLE_SITE_VERIFICATION: HTML tag method from Search Console (only used
//     for URL-prefix properties; Domain properties auto-verify via DNS, so this
//     is optional). Keeping it here as a backup verification method.
//   - YANDEX_VERIFICATION: yandex-verification meta from Yandex Webmaster.
//   - BING_SITE_VERIFICATION: msvalidate.01 meta from Bing Webmaster Tools.
//   - FACEBOOK_DOMAIN_VERIFICATION: facebook-domain-verification meta from Meta
//     Business (Brand Safety > Domains); required for iOS 14.5+ aggregated event
//     measurement on the Meta Pixel / Conversions API. Public token (visible in
//     HTML), env-gated only so previews/local builds stay clean.
const verificationOther: Record<string, string> = {};
if (process.env.BING_SITE_VERIFICATION) {
  verificationOther["msvalidate.01"] = process.env.BING_SITE_VERIFICATION;
}
if (process.env.FACEBOOK_DOMAIN_VERIFICATION) {
  verificationOther["facebook-domain-verification"] =
    process.env.FACEBOOK_DOMAIN_VERIFICATION;
}


// perf-static (2026-09-11): without this, a `[locale]` route is rendered on
// demand for every request in Next 16 (no prerender, `private, no-store`),
// even when nothing in the tree is dynamic. With it, every page under
// /[locale] that does not read cookies/headers is prerendered per locale.
export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await Promise.resolve(params);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
  const htmlLang = URL_LOCALE_TO_HTML_LANG[locale] ?? "en";

  // perf-static (2026-09-11): no auth here any more. Reading the session
  // cookie in the layout made every page a per-request serverless render;
  // the viewer is resolved on the client by SessionProvider (/api/session)
  // and fed to the header / banner / Sentry / search modal via SessionBound.

  return (
    <html lang={htmlLang} dir={dir} suppressHydrationWarning>
      <head>
        {/* Preconnect to Supabase: warms TLS so the first client-side
            REST/auth call (after hydration) doesn't pay the handshake cost. */}
        <link
          rel="preconnect"
          href="https://cjqappdfyxgytdyeytwv.supabase.co"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://cjqappdfyxgytdyeytwv.supabase.co"
        />
        {/* Consent Mode v2 defaults — must run before GTM loads so denied
            state is honored. Cookie banner (CookieConsent component) updates
            consent to granted on user accept. See G-ADS-2. */}
        <Script id="gtm-consent-default" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied',
              'analytics_storage': 'denied',
              'functionality_storage': 'denied',
              'personalization_storage': 'denied',
              'security_storage': 'granted',
              'wait_for_update': 500
            });
            gtag('set', 'ads_data_redaction', true);
            gtag('set', 'url_passthrough', true);
          `}
        </Script>
        {/* Consent mount restore — sync localStorage check before GTM init,
            BEFORE React hydration. Returning visitors with a stored choice get
            their per-category consent applied within the wait_for_update window
            so GA4's first page_view collect carries the correct gcs signal
            (granted analytics → gcs=G111) instead of denied. Backward-compat:
            the legacy "accepted" string maps to a full grant. Granular format
            mirrors lib/analytics/consent.ts. See G-ADS-2.1 + G-ADS-5. */}
        <Script id="gtm-consent-mount-restore" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            try {
              var raw = (typeof localStorage !== 'undefined')
                ? localStorage.getItem('glatko-cookie-consent')
                : null;
              if (raw) {
                var analytics, marketing;
                if (raw === 'accepted') {
                  // Backward-compat: pre-G-ADS-5 "accepted" = full grant.
                  analytics = true; marketing = true;
                } else {
                  var p = JSON.parse(raw);
                  analytics = !!p.analytics; marketing = !!p.marketing;
                }
                gtag('consent', 'update', {
                  'security_storage': 'granted',
                  'analytics_storage': analytics ? 'granted' : 'denied',
                  'functionality_storage': analytics ? 'granted' : 'denied',
                  'personalization_storage': analytics ? 'granted' : 'denied',
                  'ad_storage': marketing ? 'granted' : 'denied',
                  'ad_user_data': marketing ? 'granted' : 'denied',
                  'ad_personalization': marketing ? 'granted' : 'denied'
                });
              }
            } catch(e) {}
          `}
        </Script>
      </head>
      <body
        className={`${inter.variable} ${cormorant.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
    <NextIntlClientProvider messages={messages}>
      <NuqsAdapter>
        <SessionProvider locale={locale}>
        <SearchModalProvider>
          <script {...jsonLdScriptProps(generateOrganizationSchema(locale))} />
          <SentryUserScopeBound />
          <div className="flex min-h-screen flex-col" dir={dir}>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[999] focus:rounded-xl focus:bg-teal-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
            >
              Skip to content
            </a>
            {/* Two-layer global header (combined into ONE sticky block at the
                top of every page, so the layers never overlap and merge as the
                3-tab bar collapses on scroll):
                  KATMAN 1 — VerticalsNav (vertical switcher, always on top)
                  KATMAN 2 — GlatkoHeader (per-vertical app header, below it)
                The block is in-flow, so pages keep their existing top padding
                (it now sits below the block instead of clearing a fixed header;
                content lands at the same offset as before). */}
            <div className="sticky top-0 z-50">
              <VerticalsNav healthEnabled={isHealthVerticalEnabled()} />
              <HeaderBound />
            </div>
            <OnboardingBannerBound />
            <main id="main-content" className="flex-1">{children}</main>
            <GlatkoFooter />
            <CookieConsent />
          </div>
          <SearchModalBound locale={locale} />
          <YandexMetrica />
        </SearchModalProvider>
        </SessionProvider>
      </NuqsAdapter>
    </NextIntlClientProvider>
          <Toaster richColors position="top-right" />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
        {/* GTM placed outside ThemeProvider — it's a server-rendered <script>
            wrapper, has no theme/state dependency. Env-gated so dev/test
            builds without NEXT_PUBLIC_GTM_ID emit no GTM tag. See G-ADS-2. */}
        {process.env.NEXT_PUBLIC_GTM_ID && (
          <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
        )}
        {/* Meta Pixel skeleton — env-gated. When NEXT_PUBLIC_META_PIXEL_ID
            is empty, MetaPixel renders nothing (no fbq, no script load).
            See G-ADS-4a. */}
        {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
          <MetaPixel pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} />
        )}
      </body>
    </html>
  );
}
