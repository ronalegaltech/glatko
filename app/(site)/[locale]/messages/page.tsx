import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/supabase/server";
import { ThreadList } from "@/components/glatko/messaging/ThreadList";

type Props = {
  params: Promise<{ locale: string }> | { locale: string };
};

export default async function MessagesInboxPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?redirect=/messages`);

  // Same approved-pro check as the root layout — drives the pro-perspective
  // subtitle in ThreadList.
  const { data: proProfile } = await supabase
    .from("glatko_professional_profiles")
    .select("id, verification_status")
    .eq("id", user.id)
    .maybeSingle();
  const isPro = !!proProfile && proProfile.verification_status === "approved";

  const { data: threads, error } = await supabase
    .from("glatko_message_threads")
    .select(
      `
      id,
      request_id,
      professional_id,
      customer_id,
      last_message_at,
      last_message_preview,
      last_message_sender_id,
      customer_unread_count,
      pro_unread_count,
      status,
      glatko_service_requests (
        id,
        title
      ),
      glatko_professional_profiles (
        id,
        business_name,
        location_city
      )
      `,
    )
    .or(`customer_id.eq.${user.id},professional_id.eq.${user.id}`)
    .eq("status", "active")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    console.error("[GLATKO:messages] thread list fetch failed:", error);
  }

  // Fetch counterpart profile fields (avatar) — pro avatars live on profiles.
  const proIds = (threads ?? [])
    .map((t) => t.professional_id as string)
    .filter(Boolean);
  const customerIds = (threads ?? [])
    .map((t) => t.customer_id as string | null)
    .filter((v): v is string => Boolean(v));
  const allIds = Array.from(new Set([...proIds, ...customerIds]));

  const profileById: Record<
    string,
    { avatar_url: string | null; full_name: string | null }
  > = {};
  if (allIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, avatar_url, full_name")
      .in("id", allIds);
    for (const p of profiles ?? []) {
      profileById[p.id as string] = {
        avatar_url: (p.avatar_url as string | null) ?? null,
        full_name: (p.full_name as string | null) ?? null,
      };
    }
  }

  return (
    <ThreadList
      threads={JSON.parse(JSON.stringify(threads ?? []))}
      profileById={profileById}
      currentUserId={user.id}
      locale={locale}
      isPro={isPro}
    />
  );
}
