import Link from "next/link";
import { ChevronRight, Eye, Search, ShieldCheck } from "lucide-react";

import { createAdminClient } from "@/supabase/server";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface Props {
  params: Promise<{ locale: string }> | { locale: string };
  searchParams:
    | Promise<{ q?: string; role?: string; page?: string }>
    | { q?: string; role?: string; page?: string };
}

interface UserRow {
  id: string;
  full_name: string | null;
  role: string | null;
  preferred_locale: string | null;
  created_at: string;
  email: string;
  email_confirmed: boolean;
  last_sign_in_at: string | null;
  is_banned: boolean;
  is_pro: boolean;
}

async function loadUsers(
  query: string,
  roleFilter: string,
  page: number,
): Promise<{ rows: UserRow[]; total: number }> {
  const admin = createAdminClient();

  let q = admin
    .from("profiles")
    .select(
      "id, full_name, role, preferred_locale, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (query.trim().length > 0) {
    q = q.ilike("full_name", `%${query.trim()}%`);
  }
  if (roleFilter && roleFilter !== "all") {
    q = q.eq("role", roleFilter);
  }

  const { data: profiles, count } = await q;

  // Pull email + ban + last-sign-in from auth.users via the admin API.
  // We list a single page of auth users (max 200) and join in memory; the
  // admin user pool is small enough that this stays cheap.
  const { data: authData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const authMap = new Map<
    string,
    {
      email: string;
      email_confirmed: boolean;
      last_sign_in_at: string | null;
      is_banned: boolean;
    }
  >();
  for (const u of authData.users ?? []) {
    if (!u.id) continue;
    const banUntil = (u as { banned_until?: string | null }).banned_until;
    authMap.set(u.id, {
      email: u.email ?? "",
      email_confirmed: Boolean(u.email_confirmed_at),
      last_sign_in_at: u.last_sign_in_at ?? null,
      is_banned:
        Boolean(banUntil) && new Date(banUntil as string).getTime() > Date.now(),
    });
  }

  // Detect which profiles already have a pro profile so we can render
  // "Pro yap" vs "Pro Görüntüle" per row (G-ADMIN-PROVIDER-CREATE-01).
  const profileIds = (profiles ?? []).map((p) => p.id as string);
  const proSet = new Set<string>();
  if (profileIds.length > 0) {
    const { data: proRows } = await admin
      .from("glatko_professional_profiles")
      .select("id")
      .in("id", profileIds);
    for (const r of proRows ?? []) proSet.add(r.id as string);
  }

  const rows: UserRow[] = (profiles ?? []).map((p) => {
    const auth = authMap.get(p.id as string);
    return {
      id: p.id as string,
      full_name: p.full_name as string | null,
      role: (p.role as string | null) ?? null,
      preferred_locale: (p.preferred_locale as string | null) ?? null,
      created_at: p.created_at as string,
      email: auth?.email ?? "",
      email_confirmed: auth?.email_confirmed ?? false,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
      is_banned: auth?.is_banned ?? false,
      is_pro: proSet.has(p.id as string),
    };
  });

  return { rows, total: count ?? 0 };
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await Promise.resolve(params);
  const sp = await Promise.resolve(searchParams);

  const query = sp.q ?? "";
  const roleFilter = sp.role ?? "all";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const { rows, total } = await loadUsers(query, roleFilter, page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const linkParams = new URLSearchParams();
  if (query) linkParams.set("q", query);
  if (roleFilter && roleFilter !== "all") linkParams.set("role", roleFilter);

  const buildPageHref = (p: number) => {
    const lp = new URLSearchParams(linkParams);
    lp.set("page", String(p));
    return `?${lp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white md:text-3xl">
            Üyeler
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/50">
            Toplam {total} üye
          </p>
        </div>
      </header>

      <Card>
        <CardContent className="pt-6">
          <form
            method="GET"
            className="flex flex-col gap-3 md:flex-row md:items-center"
          >
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="İsim ile ara…"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
              />
            </label>
            <select
              name="role"
              defaultValue={roleFilter}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
            >
              <option value="all">Tüm Roller</option>
              <option value="user">user</option>
              <option value="pro">pro</option>
              <option value="admin">admin</option>
            </select>
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-5 py-2 text-sm font-medium text-white transition-all hover:from-teal-600 hover:to-teal-700"
            >
              Filtrele
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-white/50">
              {query || roleFilter !== "all"
                ? "Sonuç bulunamadı"
                : "Henüz üye yok"}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
              {rows.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                >
                  <Link
                    href={`/${locale}/admin/users/${u.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {u.full_name || "(isimsiz)"}
                        </span>
                        {u.is_banned ? (
                          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-700 dark:bg-red-500/15 dark:text-red-300">
                            banlı
                          </span>
                        ) : null}
                        {u.is_pro ? (
                          <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                            pro
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-white/50">
                        {u.email || "—"}
                        {u.preferred_locale ? ` · ${u.preferred_locale}` : ""}
                      </div>
                    </div>
                    <RoleBadge role={u.role} />
                  </Link>
                  {u.is_pro ? (
                    <Link
                      href={`/${locale}/provider/${u.id}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-teal-500/30 hover:text-teal-700 dark:border-white/[0.08] dark:text-white/70 dark:hover:border-teal-500/40 dark:hover:text-teal-300"
                    >
                      <Eye className="h-3 w-3" /> Pro
                    </Link>
                  ) : (
                    <Link
                      href={`/${locale}/admin/users/${u.id}/promote`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-teal-500/20 transition-shadow hover:shadow-teal-500/30"
                    >
                      <ShieldCheck className="h-3 w-3" /> Pro yap
                    </Link>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-white/30" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {page > 1 ? (
            <Link
              href={buildPageHref(page - 1)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.06]"
            >
              Önceki
            </Link>
          ) : null}
          <span className="text-sm text-gray-500 dark:text-white/50">
            Sayfa {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildPageHref(page + 1)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.06]"
            >
              Sonraki
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RoleBadge({ role }: { role: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    user: {
      label: "user",
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    },
    pro: {
      label: "pro",
      className:
        "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    },
    admin: {
      label: "admin",
      className:
        "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
    },
  };
  const cfg = role ? map[role] : undefined;
  if (!cfg) {
    return (
      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:bg-white/[0.06] dark:text-white/50">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}
