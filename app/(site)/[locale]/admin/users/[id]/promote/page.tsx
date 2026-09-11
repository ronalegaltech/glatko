import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/supabase/server";
import { ProviderCreateForm, type PrefillUser } from "@/components/admin/providers/ProviderCreateForm";
import { loadCategoryOptions } from "@/lib/admin/loadCategoryOptions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string; id: string }> | { locale: string; id: string };
}

async function loadPrefillUser(userId: string): Promise<PrefillUser | null> {
  const admin = createAdminClient();
  // Contact (email/phone) resolves auth-first. A phone-OTP user has a NULL
  // email AND NULL phone in profiles — the number lives only on
  // auth.users.phone — so a profiles-only read leaves the form blank and the
  // admin would have to re-type the phone by hand.
  const [{ data: profile }, { data: authData }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, phone, city, preferred_locale, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);

  const authUser = authData?.user ?? null;
  // The user must exist in auth.users; the profiles row may be absent/sparse.
  if (!authUser && !profile) return null;

  return {
    id: userId,
    email: authUser?.email ?? (profile?.email as string | null) ?? "",
    full_name: (profile?.full_name as string | null) ?? null,
    phone: authUser?.phone ?? (profile?.phone as string | null) ?? null,
    city: (profile?.city as string | null) ?? null,
    preferred_locale: (profile?.preferred_locale as string | null) ?? null,
    avatar_url: (profile?.avatar_url as string | null) ?? null,
  };
}

async function userAlreadyPro(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("glatko_professional_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data);
}

export default async function AdminPromoteUserPage({ params }: Props) {
  const { locale, id } = await Promise.resolve(params);

  const prefillUser = await loadPrefillUser(id);
  if (!prefillUser) notFound();

  const isAlreadyPro = await userAlreadyPro(id);
  const categories = await loadCategoryOptions();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`/${locale}/admin/users/${id}`}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 dark:text-white/50 dark:hover:text-teal-400"
          >
            <ChevronLeft className="h-3 w-3" /> Üye detayına dön
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white md:text-3xl">
            Pro yap — {prefillUser.full_name ?? prefillUser.email}
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/50">
            Mevcut hesabı profesyonele yükselt. Profil bilgileri pre-fill edildi.
          </p>
        </div>
      </header>

      {isAlreadyPro ? (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/[0.08] dark:text-amber-300">
          Bu kullanıcı zaten bir profesyonel profile sahip.{" "}
          <Link
            href={`/${locale}/provider/${id}`}
            className="font-semibold underline underline-offset-2"
          >
            Pro profilini görüntüle
          </Link>
        </div>
      ) : (
        <ProviderCreateForm
          mode="promote"
          prefillUser={prefillUser}
          categories={categories}
        />
      )}
    </div>
  );
}
