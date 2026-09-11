import { redirect, notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/supabase/server";
import { ChatBox } from "@/components/glatko/messaging/ChatBox";

type Props = {
  params:
    | Promise<{ locale: string; id: string }>
    | { locale: string; id: string };
};

export default async function MessagesThreadPage({ params }: Props) {
  const { locale, id } = await Promise.resolve(params);
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?redirect=/messages/${id}`);

  const { data: thread } = await supabase
    .from("glatko_message_threads")
    .select(
      `
      id,
      request_id,
      professional_id,
      customer_id,
      initial_quote_id,
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
    .eq("id", id)
    .maybeSingle();

  if (!thread) notFound();

  const isParticipant =
    thread.customer_id === user.id || thread.professional_id === user.id;
  if (!isParticipant) notFound();

  // G-REV-1: load the linked quote (completion_state machine) + any
  // existing review so the ChatBox can render the right banner.
  let quoteInfo: {
    id: string;
    completion_state: string;
    has_review: boolean;
  } | null = null;
  if (thread.initial_quote_id) {
    const { data: q } = await supabase
      .from("glatko_request_quotes")
      .select("id, completion_state")
      .eq("id", thread.initial_quote_id as string)
      .maybeSingle();
    if (q) {
      const { count: reviewCount } = await supabase
        .from("glatko_quote_reviews")
        .select("id", { count: "exact", head: true })
        .eq("quote_id", q.id as string);
      quoteInfo = {
        id: q.id as string,
        completion_state: (q.completion_state as string) ?? "in_progress",
        has_review: (reviewCount ?? 0) > 0,
      };
    }
  }

  const { data: messages } = await supabase
    .from("glatko_thread_messages")
    .select(
      "id, sender_id, body, body_locale, translated_body, translated_locale, read_at, created_at",
    )
    .eq("thread_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  const counterpartId =
    user.id === thread.customer_id
      ? thread.professional_id
      : thread.customer_id;
  let counterpartName = "—";
  let counterpartAvatar: string | null = null;
  if (counterpartId) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("avatar_url, full_name")
      .eq("id", counterpartId)
      .maybeSingle();
    counterpartAvatar = (prof?.avatar_url as string | null) ?? null;

    // Supabase types nested *_profiles relations as arrays even when the
    // FK is one-to-one — normalize via unknown cast.
    type ProInfo = { business_name: string | null } | null;
    const proInfo = thread.glatko_professional_profiles as unknown as ProInfo;

    if (user.id === thread.customer_id) {
      counterpartName =
        proInfo?.business_name ?? (prof?.full_name as string | null) ?? "—";
    } else {
      counterpartName = (prof?.full_name as string | null) ?? "—";
    }
  }

  // Mark thread read on open (best-effort, no error propagation).
  try {
    await supabase.rpc("glatko_mark_thread_read", { p_thread_id: id });
  } catch {
    /* ignore */
  }

  type ServiceRequestInfo = { title: string } | null;
  const requestInfo =
    thread.glatko_service_requests as unknown as ServiceRequestInfo;

  const isProUser = user.id === thread.professional_id;
  const isCustomerUser = user.id === thread.customer_id;

  return (
    <ChatBox
      threadId={id}
      currentUserId={user.id}
      counterpartName={counterpartName}
      counterpartAvatar={counterpartAvatar}
      requestTitle={requestInfo?.title ?? ""}
      initialMessages={JSON.parse(JSON.stringify(messages ?? []))}
      locale={locale}
      threadActive={thread.status === "active"}
      quote={quoteInfo}
      isProUser={isProUser}
      isCustomerUser={isCustomerUser}
      counterpartId={counterpartId ?? null}
    />
  );
}
