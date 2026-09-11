import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; children: React.ReactNode };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t("pro.wizard.title"),
    description: t("pro.wizard.subtitle"),
    alternates: buildAlternates(locale, "/become-a-pro"),
    robots: { index: true, follow: true },
  };
}

export default function Layout({ children }: Props) {
  return children;
}
