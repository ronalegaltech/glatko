import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/supabase/server";
import { PageBackground } from "@/components/ui/PageBackground";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { getProfileSettings } from "@/lib/actions/profile";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t("settings.profile.title"),
  };
}

export default async function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/settings/profile`);
  }

  const loaded = await getProfileSettings();
  if (!loaded.ok) {
    redirect(`/${locale}/login?redirect=/settings/profile`);
  }

  return (
    <PageBackground opacity={0.08}>
      <ProfileForm initialProfile={loaded.profile} email={loaded.email} />
    </PageBackground>
  );
}
