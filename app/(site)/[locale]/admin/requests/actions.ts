"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { dispatchRequestMatchNotifications } from "@/lib/notifications/match-dispatch";
import {
  sendRequestApprovedEmail,
  sendRequestRejectedEmail,
} from "@/lib/email/request-emails";

/**
 * Look up an email for the request's owner. Logged-in users come from
 * `auth.users` via the admin API; anonymous submissions store their
 * email directly on the row.
 */
async function lookupRequestorEmail(
  customerId: string | null,
  anonymousEmail: string | null,
): Promise<string | null> {
  if (anonymousEmail) return anonymousEmail;
  if (!customerId) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(customerId);
    if (error) return null;
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

interface ActionResult {
  success: boolean;
  error?: string;
}

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  if (!isAdminEmail(user.email)) return { ok: false, error: "Forbidden" };
  return { ok: true, userId: user.id };
}

/**
 * Approve a pending_moderation request → publish it and dispatch the
 * Top-3 match notifications via the G-REQ-2 matching algorithm. The
 * remaining 7 wait-list pros are queued (notified_at NULL) and
 * activated by /api/cron/activate-waitlists 30 min later if fewer than
 * 3 quotes have landed.
 */
export async function approveRequest(requestId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("glatko_service_requests")
    .update({
      status: "published",
      moderated_by: auth.userId,
      moderated_at: new Date().toISOString(),
      moderation_reason: null,
    })
    .eq("id", requestId)
    .eq("status", "pending_moderation")
    .select(
      "id, category_id, customer_id, anonymous_email, locale, title, municipality, preferred_professional_id",
    )
    .single();

  if (error || !row) {
    return {
      success: false,
      error: error?.message ?? "Approve failed (row not in pending state).",
    };
  }

  const { data: catRow } = await admin
    .from("glatko_service_categories")
    .select("name")
    .eq("id", row.category_id)
    .maybeSingle();

  const categoryNames =
    (catRow?.name as Record<string, string> | null | undefined) ?? {};

  // G-REQ-2: dispatch Top 3 matches via algorithm RPC + email.
  // Wait-list (7) is queued unnotified; cron activates it after 30 min
  // if quote_count < 3. Failures here never roll back the approve —
  // the row is now `published` and the cron can retry.
  await dispatchRequestMatchNotifications(row.id as string).catch(() => {
    /* logged inside dispatcher */
  });

  // User mailer: localized "your request is live" with verified-pro count.
  const userEmail = await lookupRequestorEmail(
    (row.customer_id as string | null) ?? null,
    (row.anonymous_email as string | null) ?? null,
  );
  if (userEmail) {
    const userLocale = (row.locale as string | null) ?? "en";
    const categoryName =
      categoryNames[userLocale] ?? categoryNames.en ?? row.title;

    const { count: proCount } = await admin
      .from("glatko_pro_services")
      .select("id", { count: "exact", head: true })
      .eq("category_id", row.category_id as string);

    void sendRequestApprovedEmail({
      to: userEmail,
      locale: userLocale,
      categoryName: categoryName as string,
      city: row.municipality as string,
      proCount: proCount ?? 0,
    }).catch(() => {
      /* helper logs to Sentry */
    });
  }

  revalidatePath("/[locale]/admin/requests", "page");
  return { success: true };
}

/**
 * Reject a pending_moderation request with an admin-supplied reason.
 * Keeps the row for the audit trail; user notification is queued in
 * Faz 9 (Resend integration). For now the moderation_reason text is
 * the source of truth admins can re-read on the dashboard.
 */
export async function rejectRequest(
  requestId: string,
  reason: string,
): Promise<ActionResult> {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length === 0) {
    return { success: false, error: "Reject reason is required." };
  }
  if (trimmed.length > 1000) {
    return { success: false, error: "Reject reason too long." };
  }

  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("glatko_service_requests")
    .update({
      status: "rejected",
      moderated_by: auth.userId,
      moderated_at: new Date().toISOString(),
      moderation_reason: trimmed,
    })
    .eq("id", requestId)
    .eq("status", "pending_moderation")
    .select(
      "id, category_id, customer_id, anonymous_email, locale, municipality, title",
    )
    .single();

  if (error || !row) {
    return {
      success: false,
      error: error?.message ?? "Reject failed (row not in pending state).",
    };
  }

  const { data: catRow } = await admin
    .from("glatko_service_categories")
    .select("name")
    .eq("id", row.category_id as string)
    .maybeSingle();
  const categoryNames =
    (catRow?.name as Record<string, string> | null | undefined) ?? {};

  const userEmail = await lookupRequestorEmail(
    (row.customer_id as string | null) ?? null,
    (row.anonymous_email as string | null) ?? null,
  );
  if (userEmail) {
    const userLocale = (row.locale as string | null) ?? "en";
    const categoryName =
      categoryNames[userLocale] ?? categoryNames.en ?? row.title;

    void sendRequestRejectedEmail({
      to: userEmail,
      locale: userLocale,
      categoryName: categoryName as string,
      city: row.municipality as string,
      rejectReason: trimmed,
    }).catch(() => {
      /* helper logs to Sentry */
    });
  }

  revalidatePath("/[locale]/admin/requests", "page");
  return { success: true };
}
