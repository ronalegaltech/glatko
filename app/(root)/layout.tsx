import type { Metadata } from "next";
import "../globals.css";

// perf-static (2026-09-11): the locale tree (app/(site)/[locale]) is its own
// root layout now, so <html lang> can be set from the route param instead of
// from the `x-pathname` request header — which made every page on the site a
// per-request render. This group only hosts the "/" redirect and the
// locale-less not-found page.
export const metadata: Metadata = {
  metadataBase: new URL("https://glatko.app"),
  robots: { index: false, follow: false },
};

export default function BareRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
