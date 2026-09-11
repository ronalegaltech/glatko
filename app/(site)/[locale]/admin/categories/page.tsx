import Link from "next/link";
import { ChevronRight, FolderTree } from "lucide-react";

import { createAdminClient } from "@/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }> | { locale: string };
}

interface CategoryRow {
  id: string;
  slug: string;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number | null;
  name: Record<string, string> | null;
  faqs: unknown[] | null;
}

export default async function AdminCategoriesPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  const admin = createAdminClient();

  const [{ data: categoriesData }, { data: junctionData }] = await Promise.all([
    admin
      .from("glatko_service_categories")
      .select("id, slug, parent_id, is_active, sort_order, name, faqs")
      .order("sort_order", { ascending: true }),
    admin.from("glatko_pro_services").select("category_id"),
  ]);

  const categories = (categoriesData ?? []) as CategoryRow[];

  const proCountByCategory = new Map<string, number>();
  for (const row of (junctionData ?? []) as Array<{ category_id: string }>) {
    proCountByCategory.set(
      row.category_id,
      (proCountByCategory.get(row.category_id) ?? 0) + 1,
    );
  }

  // Group: roots with their children
  const roots = categories.filter((c) => !c.parent_id);
  const childrenByRoot = new Map<string, CategoryRow[]>();
  for (const c of categories) {
    if (!c.parent_id) continue;
    const arr = childrenByRoot.get(c.parent_id) ?? [];
    arr.push(c);
    childrenByRoot.set(c.parent_id, arr);
  }

  const totalActive = categories.filter((c) => c.is_active).length;
  const totalRoots = roots.filter((r) => r.is_active).length;
  const totalSubs = categories.filter(
    (c) => c.parent_id && c.is_active,
  ).length;

  const pickName = (n: Record<string, string> | null): string => {
    if (!n) return "—";
    return n[locale] ?? n.en ?? n.tr ?? Object.values(n)[0] ?? "—";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white md:text-3xl">
            Kategoriler
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/50">
            {totalActive} aktif kategori ({totalRoots} ana, {totalSubs} alt)
          </p>
        </div>
      </header>

      {roots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderTree
              className="mx-auto h-12 w-12 text-teal-500/30"
              strokeWidth={1.5}
            />
            <p className="mt-3 text-sm text-gray-500 dark:text-white/50">
              Kategori yok
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {roots.map((root) => {
            const children = childrenByRoot.get(root.id) ?? [];
            const proCount = proCountByCategory.get(root.id) ?? 0;
            const subProTotal = children.reduce(
              (acc, c) => acc + (proCountByCategory.get(c.id) ?? 0),
              0,
            );
            const faqCount = Array.isArray(root.faqs) ? root.faqs.length : 0;

            return (
              <Card key={root.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {pickName(root.name)}
                      </CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        <code className="font-mono text-gray-500 dark:text-white/50">
                          {root.slug}
                        </code>
                        {!root.is_active ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium uppercase tracking-wider text-gray-500 dark:bg-white/[0.06] dark:text-white/50">
                            pasif
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Stat
                        label="Pro (root)"
                        value={proCount}
                        accent={proCount > 0}
                      />
                      <Stat
                        label="Pro (alt-kat)"
                        value={subProTotal}
                        accent={subProTotal > 0}
                      />
                      <Stat
                        label="FAQ"
                        value={faqCount}
                        accent={faqCount > 0}
                      />
                      <Stat label="Alt-kat" value={children.length} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {children.length === 0 ? (
                    <div className="text-xs text-gray-500 dark:text-white/50">
                      Alt-kategori yok.
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {children.map((sub) => {
                        const subProCount =
                          proCountByCategory.get(sub.id) ?? 0;
                        return (
                          <li
                            key={sub.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 text-sm dark:border-white/[0.06] dark:bg-white/[0.02]"
                          >
                            <div className="min-w-0 flex-1">
                              <span
                                className={
                                  sub.is_active
                                    ? "font-medium text-gray-900 dark:text-white"
                                    : "font-medium text-gray-400 line-through dark:text-white/40"
                                }
                              >
                                {pickName(sub.name)}
                              </span>
                              <code className="ml-2 font-mono text-[10px] text-gray-500 dark:text-white/50">
                                {sub.slug}
                              </code>
                            </div>
                            {subProCount > 0 ? (
                              <Link
                                href={`/${locale}/admin/professionals?status=approved`}
                                className="flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-700 hover:bg-teal-500/15 dark:text-teal-300"
                              >
                                {subProCount} pro
                                <ChevronRight className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="text-[11px] text-gray-400 dark:text-white/30">
                                0 pro
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-gray-500 dark:text-white/50">
            Bu sayfa şu an salt-okunur bir genel bakış sunuyor. FAQ düzenleme
            ve pro&ndash;kategori junction y&ouml;netimi G-ADMIN-2&apos;de
            gelecek (yetkili sebep + audit log + UI).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <span
      className={
        accent
          ? "rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300"
          : "rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/[0.06] dark:text-white/60"
      }
    >
      {label}: {value}
    </span>
  );
}
