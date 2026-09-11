"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { banUser, unbanUser } from "./actions";

interface Props {
  userId: string;
  isBanned: boolean;
}

/**
 * G-ADMIN-1 Faz 3: ban / unban controls on the user detail page.
 * Role changes are deliberately omitted — the `profiles.role` column is
 * still effectively a single-value ('user') field at this point in time;
 * the email allowlist (lib/admin) is the actual admin gate. Role
 * management ships once the schema and product flow are formalised.
 */
export function UserActionsClient({ userId, isBanned }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ban() {
    setError(null);
    const reason = window.prompt(
      "Ban sebebi (zorunlu, en az 5 karakter):",
    );
    if (!reason) return;
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError("Sebep en az 5 karakter olmalı.");
      return;
    }
    if (
      !window.confirm(
        "Bu kullanıcı banlanacak (yaklaşık 100 yıl). Geri alınabilir. Devam?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await banUser(userId, trimmed);
      if (!result.success) {
        setError(result.error ?? "Beklenmeyen hata");
        return;
      }
      router.refresh();
    });
  }

  function unban() {
    setError(null);
    const reason = window.prompt("Ban kaldırma sebebi (zorunlu):");
    if (!reason) return;
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError("Sebep en az 5 karakter olmalı.");
      return;
    }
    startTransition(async () => {
      const result = await unbanUser(userId, trimmed);
      if (!result.success) {
        setError(result.error ?? "Beklenmeyen hata");
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="border-red-200/60 dark:border-red-500/20">
      <CardHeader>
        <CardTitle className="text-base text-red-700 dark:text-red-400">
          Yönetici Eylemleri
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {isBanned ? (
            <button
              type="button"
              onClick={unban}
              disabled={pending}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
            >
              {pending ? "İşleniyor…" : "Ban Kaldır"}
            </button>
          ) : (
            <button
              type="button"
              onClick={ban}
              disabled={pending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "İşleniyor…" : "Banla"}
            </button>
          )}
        </div>
        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        ) : null}
        <p className="mt-3 text-xs text-gray-500 dark:text-white/50">
          Rol değişikliği bu sürümde devre dışı. Admin yetkisi e-posta
          allowlist üzerinden ({" "}
          <code className="font-mono text-[10px]">lib/admin.ts</code>).
        </p>
      </CardContent>
    </Card>
  );
}
