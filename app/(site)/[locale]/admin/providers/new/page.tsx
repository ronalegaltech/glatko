import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { ProviderCreateForm } from "@/components/admin/providers/ProviderCreateForm";
import { loadCategoryOptions } from "@/lib/admin/loadCategoryOptions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }> | { locale: string };
}

export default async function AdminCreateProviderPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  const categories = await loadCategoryOptions();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`/${locale}/admin`}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 dark:text-white/50 dark:hover:text-teal-400"
          >
            <ChevronLeft className="h-3 w-3" /> Admin paneli
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white md:text-3xl">
            Yeni Provider — Sıfırdan
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/50">
            Hiç signup olmamış majstor için yeni hesap + tam profil oluşturur.
            Helena Viber&apos;dan bilgi topladıktan sonra bu formu kullanır.
          </p>
        </div>
      </header>

      <ProviderCreateForm mode="create" categories={categories} />
    </div>
  );
}
