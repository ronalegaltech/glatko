"use server";

import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/supabase/server";
import { normalizePhoneE164 } from "@/lib/phone/normalize";
import { pickLocalizedLabel } from "@/lib/i18n/pick-localized-label";
import { createServiceRequestSchema } from "@/lib/validations/service-request";
import { sendAdminPendingRequestEmail } from "@/lib/email/request-emails";

interface SubmitResult {
  success: boolean;
  requestId?: string;
  categoryLabel?: string;
  /** G-LAUNCH-1: true when this submit promoted user into founding-100. */
  isFoundingCustomer?: boolean;
  error?: string;
}

const SUPPORTED_LOCALES = [
  "me",
  "sr",
  "en",
  "tr",
  "de",
  "it",
  "ru",
  "ar",
  "uk",
] as const;

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function normalizeLocale(value: string | null): SupportedLocale {
  if (!value) return "me";
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
    ? (value as SupportedLocale)
    : "me";
}

/**
 * G-REQ-1 anonim flow.
 *
 * - Logged-in user: `customer_id` set from auth cookie.
 * - Anonymous user: `customer_id` left null, `anonymous_email` collected
 *   in the wizard's last step (Airbnb pattern).
 *
 * New requests land with `status = 'pending_moderation'`. Admin approval
 * (Faz 8) flips them to `'active'` and triggers
 * `notifyProfessionalsOfNewRequest` — that step is intentionally NOT
 * called here, so unreviewed requests never reach pros.
 */
export async function submitServiceRequest(
  formData: FormData,
): Promise<SubmitResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const customerId = user?.id ?? null;

  let details: Record<string, unknown> = {};
  const detailsRaw = formData.get("details") as string | null;
  if (detailsRaw) {
    try {
      details = JSON.parse(detailsRaw) as Record<string, unknown>;
    } catch {
      return { success: false, error: "Invalid details format." };
    }
  }

  let photos: string[] = [];
  const photosRaw = formData.get("photos") as string | null;
  if (photosRaw) {
    try {
      photos = JSON.parse(photosRaw) as string[];
    } catch {
      photos = [];
    }
  }

  const budgetMinStr = formData.get("budgetMin") as string | null;
  const budgetMaxStr = formData.get("budgetMax") as string | null;
  const emailStr = ((formData.get("email") as string) || "").trim();
  const phone = ((formData.get("phone") as string) || "").trim();
  const submittedLocale = normalizeLocale(
    (formData.get("locale") as string) || (formData.get("summaryLocale") as string),
  );

  const rawData = {
    categoryId: (formData.get("categoryId") as string) || "",
    title: ((formData.get("title") as string) || "").trim(),
    description:
      ((formData.get("description") as string) || "").trim() || undefined,
    details,
    municipality: (formData.get("municipality") as string) || "",
    address:
      ((formData.get("address") as string) || "").trim() || undefined,
    budgetMin: budgetMinStr ? Number(budgetMinStr) : null,
    budgetMax: budgetMaxStr ? Number(budgetMaxStr) : null,
    urgency: ((formData.get("urgency") as string) || "flexible") as
      | "asap"
      | "this_week"
      | "flexible"
      | "specific_date",
    preferredDateStart: (formData.get("dateStart") as string) || null,
    preferredDateEnd: (formData.get("dateEnd") as string) || null,
    photos,
    phone,
    email: emailStr || null,
  };

  const t = await getTranslations({
    locale: await getLocale(),
    namespace: "validation",
  });
  const createRequestSchema = createServiceRequestSchema((key, values) =>
    t(key, values),
  );
  const parsed = createRequestSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstField = Object.keys(fieldErrors)[0];
    const firstMsg = firstField
      ? `${firstField}: ${(fieldErrors as Record<string, string[]>)[firstField]?.[0]}`
      : "Validation failed.";
    return { success: false, error: firstMsg };
  }

  const data = parsed.data;

  // Anonymous flow gate: an anon user must supply an email so the admin
  // moderation queue (and subsequent approve/reject mail) can reach them.
  const anonymousEmail = !customerId ? data.email : null;
  if (!customerId && !anonymousEmail) {
    return {
      success: false,
      error: "Email is required for anonymous requests.",
    };
  }

  // G-PHONE: authoritative E.164 normalization (libphonenumber-js, ME default)
  // for the customer's contact number before it is stored on the request.
  const reqPhone = normalizePhoneE164(phone);
  if (!reqPhone.ok) {
    return { success: false, error: t("phoneInvalid") };
  }
  data.details.phone = reqPhone.e164;
  if (emailStr) data.details.email = emailStr;

  const preferredRaw = (formData.get("preferredProfessionalId") as string) || "";
  let preferred_professional_id: string | null = null;
  if (preferredRaw) {
    const u = z.string().uuid().safeParse(preferredRaw.trim());
    if (u.success) preferred_professional_id = u.data;
  }

  // Direct insert (bypassing createServiceRequest helper) so we can set
  // status='pending_moderation' + write the new anonymous_email + locale
  // columns. Skipping notifyProfessionalsOfNewRequest is intentional —
  // pros only see requests after admin approval (Faz 8).
  const insertPayload = {
    customer_id: customerId,
    anonymous_email: anonymousEmail,
    category_id: data.categoryId,
    title: data.title,
    description: data.description ?? null,
    details: data.details,
    municipality: data.municipality,
    address: data.address ?? null,
    budget_min: data.budgetMin ?? null,
    budget_max: data.budgetMax ?? null,
    urgency: data.urgency,
    preferred_date_start: data.preferredDateStart ?? null,
    preferred_date_end: data.preferredDateEnd ?? null,
    photos: data.photos,
    preferred_professional_id,
    locale: submittedLocale,
    status: "pending_moderation",
  };

  const { data: row, error } = await supabase
    .from("glatko_service_requests")
    .insert(insertPayload)
    .select("id, category_id, title, municipality")
    .single();

  if (error || !row) {
    return {
      success: false,
      error: error?.message ?? "Failed to submit request.",
    };
  }

  const { data: catRow } = await supabase
    .from("glatko_service_categories")
    .select("name")
    .eq("id", row.category_id)
    .maybeSingle();

  const categoryNames =
    (catRow?.name as Record<string, string> | null | undefined) ?? {};

  const summaryLocale = ((formData.get("summaryLocale") as string) || "en").trim();
  const categoryLabel = pickLocalizedLabel(categoryNames, summaryLocale);

  // Fire-and-forget admin notification (English copy; ops mailbox).
  // Never blocks the submit success path — the moderation queue is the
  // canonical surface, mail is just a heads-up.
  void sendAdminPendingRequestEmail({
    requestId: row.id as string,
    categoryName: pickLocalizedLabel(categoryNames, "en") || "Unknown",
    city: row.municipality as string,
    requestorEmail: user?.email || anonymousEmail || "anonymous",
    budgetMin: data.budgetMin ?? null,
    budgetMax: data.budgetMax ?? null,
    preferredDate: data.preferredDateStart ?? null,
  }).catch(() => {
    /* glatkoCaptureException already wraps inside the helper */
  });

  // G-LAUNCH-1: auto-flag founding customer (first 100 authenticated submitters).
  // Idempotent — RPC is no-op for users already founding or past the cap.
  // Fire-and-forget so flag failure never blocks the success path.
  let isFoundingCustomer = false;
  if (customerId) {
    try {
      const { data: foundingResult } = await supabase.rpc(
        "glatko_check_founding_customer",
        { p_user_id: customerId },
      );
      isFoundingCustomer = Boolean(foundingResult);

      // If the flag was JUST flipped on this submit, fire the welcome email.
      // We detect "just flipped" by re-reading founding_customer_at and
      // checking it's recent (5 second window — within the same request).
      if (isFoundingCustomer) {
        const { data: profile } = await supabase
          .from("glatko_customer_profiles")
          .select("founding_customer_number, founding_customer_at, preferred_locale")
          .eq("id", customerId)
          .maybeSingle();

        if (
          profile?.founding_customer_at &&
          Date.now() - new Date(profile.founding_customer_at).getTime() < 10_000
        ) {
          const number =
            (profile.founding_customer_number as number | null) ?? 0;
          const userLocale =
            (profile.preferred_locale as string | null) ?? submittedLocale;
          const customerName =
            (user?.user_metadata?.full_name as string | undefined) ||
            user?.email?.split("@")[0] ||
            "there";
          const recipient = user?.email;
          if (recipient && number > 0) {
            const { sendFoundingCustomerWelcomeEmail } = await import(
              "@/lib/email/founding-emails"
            );
            void sendFoundingCustomerWelcomeEmail({
              to: recipient,
              locale: userLocale,
              customerName,
              foundingNumber: number,
            }).catch(() => {
              /* helper logs to Sentry */
            });
          }
        }
      }
    } catch {
      // Don't block — RPC failure is non-critical (existing user already submitted).
    }
  }

  return {
    success: true,
    requestId: row.id as string,
    categoryLabel,
    isFoundingCustomer,
  };
}
