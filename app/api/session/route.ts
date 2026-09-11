import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { routing } from "@/i18n/routing";

/**
 * perf-static (2026-09-11): the viewer's session summary for the layout
 * chrome (header links, onboarding banner, Sentry scope, search modal).
 *
 * This used to be computed in app/[locale]/layout.tsx with the cookie-bound
 * Supabase client, which made EVERY page on the site a per-request serverless
 * render (`private, no-store`, no CDN cache). The layout is static now and the
 * client asks this route once after hydration (components/glatko/session).
 *
 * Authorization is never derived from this payload — server actions and
 * gated routes re-read the session from cookies themselves.
 */
export const dynamic = "force-dynamic";

export type SessionPayload = {
  userId: string | null;
  email: string | null;
  isPro: boolean;
  isAdmin: boolean;
  /** Present only while the welcome banner should show. */
  onboarding: { firstName: string } | null;
};

const NO_STORE = { "Cache-Control": "private, no-store" };

const GUEST: SessionPayload = {
  userId: null,
  email: null,
  isPro: false,
  isAdmin: false,
  onboarding: null,
};

export async function GET(req: Request) {
  const locale = new URL(req.url).searchParams.get("locale") ?? "";
  const localeValid = (routing.locales as readonly string[]).includes(locale);

  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  if (!user) return NextResponse.json(GUEST, { headers: NO_STORE });

  let isPro = false;
  let onboarding: SessionPayload["onboarding"] = null;
  try {
    const [profileRes, proProfileRes] = await Promise.all([
      localeValid
        ? supabase
            .from("profiles")
            .select("preferred_locale, full_name, onboarding_completed")
            .eq("id", user.id)
            .maybeSingle()
        : null,
      supabase
        .from("glatko_professional_profiles")
        .select("id, verification_status")
        .eq("id", user.id)
        .single(),
    ]);
    const profile = profileRes?.data ?? null;
    isPro =
      !!proProfileRes.data &&
      proProfileRes.data.verification_status === "approved";
    if (!isPro && profile?.onboarding_completed !== true) {
      onboarding = {
        firstName: profile?.full_name?.trim().split(/\s+/)[0] ?? "",
      };
    }
    // Locale convergence (moved from the layout): fire and forget, never
    // blocks or breaks the response.
    if (localeValid && profile && profile.preferred_locale !== locale) {
      void supabase
        .from("profiles")
        .update({ preferred_locale: locale })
        .eq("id", user.id)
        .then(
          () => {},
          () => {},
        );
    }
  } catch {
    /* never fail the session read over profile lookups */
  }

  const payload: SessionPayload = {
    userId: user.id,
    email: user.email ?? null,
    isPro,
    isAdmin: isAdminEmail(user.email),
    onboarding,
  };
  return NextResponse.json(payload, { headers: NO_STORE });
}
