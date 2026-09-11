import { notFound } from "next/navigation";
import Link from "next/link";

import { createAdminClient } from "@/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { UserActionsClient } from "./UserActionsClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string; id: string }> | { locale: string; id: string };
}

interface RequestRow {
  id: string;
  title: string | null;
  status: string;
  municipality: string | null;
  created_at: string;
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { locale, id } = await Promise.resolve(params);

  const admin = createAdminClient();

  const [profileRes, authRes, proRes, requestsRes] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, full_name, role, preferred_locale, created_at, updated_at, bio, city, is_active, is_suspended, is_deleted",
      )
      .eq("id", id)
      .maybeSingle(),
    admin.auth.admin.getUserById(id),
    admin
      .from("glatko_professional_profiles")
      .select(
        "id, business_name, slug, verification_status, is_active, is_founding_provider, founding_provider_number, location_city",
      )
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("glatko_service_requests")
      .select("id, title, status, municipality, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const profile = profileRes.data;
  if (!profile) notFound();

  const authUser = authRes.data?.user ?? null;
  const banUntil = (authUser as { banned_until?: string | null } | null)
    ?.banned_until;
  const isBanned =
    Boolean(banUntil) && new Date(banUntil as string).getTime() > Date.now();

  const pro = proRes.data;
  const requests = (requestsRes.data ?? []) as RequestRow[];

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/${locale}/admin/users`}
          className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
        >
          ← Üyeler
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white md:text-3xl">
          {profile.full_name || "(isimsiz üye)"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-white/50">
          {authUser?.email ?? "—"}
          {isBanned ? (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-700 dark:bg-red-500/15 dark:text-red-300">
              banlı
            </span>
          ) : null}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Field label="ID" mono value={profile.id} />
            <Field label="E-posta" value={authUser?.email ?? "—"} />
            <Field label="Rol" value={profile.role ?? "—"} />
            <Field
              label="Tercih edilen dil"
              value={profile.preferred_locale ?? "—"}
            />
            <Field
              label="Şehir"
              value={(profile.city as string | null) ?? "—"}
            />
            <Field
              label="Kayıt tarihi"
              value={new Date(profile.created_at).toLocaleString("tr")}
            />
            <Field
              label="E-posta doğrulanmış"
              value={authUser?.email_confirmed_at ? "Evet" : "Hayır"}
            />
            <Field
              label="Son giriş"
              value={
                authUser?.last_sign_in_at
                  ? new Date(authUser.last_sign_in_at).toLocaleString("tr")
                  : "—"
              }
            />
            <Field
              label="Auth provider"
              value={
                ((authUser?.app_metadata as { provider?: string } | undefined)
                  ?.provider) ?? "email"
              }
            />
            <Field
              label="Hesap durumu"
              value={
                profile.is_deleted
                  ? "silinmiş"
                  : profile.is_suspended
                    ? "askıda"
                    : profile.is_active === false
                      ? "pasif"
                      : "aktif"
              }
            />
          </dl>
        </CardContent>
      </Card>

      {pro ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profesyonel Profili</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Field
                label="İşletme adı"
                value={pro.business_name ?? "—"}
              />
              <Field
                label="Slug"
                mono
                value={pro.slug ? `/${locale}/pros/${pro.slug}` : "—"}
              />
              <Field
                label="Doğrulama durumu"
                value={pro.verification_status ?? "—"}
              />
              <Field label="Şehir" value={pro.location_city ?? "—"} />
              <Field
                label="Aktif"
                value={pro.is_active ? "Evet" : "Hayır"}
              />
              {pro.is_founding_provider ? (
                <Field
                  label="Founding"
                  value={`#${pro.founding_provider_number}`}
                />
              ) : null}
            </dl>
            {pro.slug ? (
              <Link
                href={`/${locale}/admin/professionals/${pro.id}`}
                className="mt-4 inline-block text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
              >
                Pro yönetim sayfasına git →
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {requests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Talepler ({requests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {requests.map((req) => (
                <Link
                  key={req.id}
                  href={`/${locale}/admin/requests`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 transition-colors hover:bg-gray-100 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {req.title || "(başlıksız)"}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-white/50">
                      {req.municipality ?? "—"}
                      {" · "}
                      {new Date(req.created_at).toLocaleDateString("tr")}
                    </div>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-600 dark:bg-white/[0.06] dark:text-white/60">
                    {req.status}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <UserActionsClient userId={profile.id as string} isBanned={isBanned} />
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "mt-0.5 break-all font-mono text-xs text-gray-700 dark:text-white/70"
            : "mt-0.5 text-gray-700 dark:text-white/70"
        }
      >
        {value}
      </dd>
    </div>
  );
}
