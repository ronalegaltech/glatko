"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient, createClient } from "@/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin/audit";

interface ActionResult {
  success: boolean;
  error?: string;
}

async function requireAdmin(): Promise<
  | { ok: true; userId: string; email: string }
  | { ok: false; error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, error: "Unauthorized" };
  if (!isAdminEmail(user.email)) return { ok: false, error: "Forbidden" };
  return { ok: true, userId: user.id, email: user.email };
}

/**
 * Soft-ban via Supabase auth `ban_duration`. ~100-year duration is the
 * idiomatic "indefinite" because the API doesn't expose a true forever flag.
 * Reversible via unbanUser.
 */
export async function banUser(
  targetUserId: string,
  reason: string,
): Promise<ActionResult> {
  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    return { success: false, error: "Sebep en az 5 karakter olmalı." };
  }
  if (trimmed.length > 1000) {
    return { success: false, error: "Sebep çok uzun." };
  }

  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  if (auth.userId === targetUserId) {
    return { success: false, error: "Kendinizi banlayamazsınız." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    ban_duration: "876000h",
  });
  if (error) {
    return { success: false, error: error.message };
  }

  await logAdminAction({
    actionType: "user_ban",
    targetTable: "auth.users",
    targetId: targetUserId,
    payload: { ban_duration: "876000h" },
    reason: trimmed,
  });

  revalidatePath(`/[locale]/admin/users/${targetUserId}`, "page");
  revalidatePath(`/[locale]/admin/users`, "page");
  return { success: true };
}

export async function unbanUser(
  targetUserId: string,
  reason: string,
): Promise<ActionResult> {
  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    return { success: false, error: "Sebep en az 5 karakter olmalı." };
  }

  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    ban_duration: "none",
  });
  if (error) {
    return { success: false, error: error.message };
  }

  await logAdminAction({
    actionType: "user_unban",
    targetTable: "auth.users",
    targetId: targetUserId,
    payload: {},
    reason: trimmed,
  });

  revalidatePath(`/[locale]/admin/users/${targetUserId}`, "page");
  revalidatePath(`/[locale]/admin/users`, "page");
  return { success: true };
}
