"use server";

import { glatkoCaptureException } from "@/lib/sentry/glatko-capture";
import { createClient, createAdminClient } from "@/supabase/server";
import { cancelServiceRequest, acceptBid, getOrCreateConversation, sendMessage, createNotification } from "@/lib/supabase/glatko.server";
import { getBidAcceptedMessageForRecipientLocale } from "@/lib/messages/bid-accepted-system";

interface CancelResult {
  success: boolean;
  error?: string;
}

export async function cancelRequest(requestId: string): Promise<CancelResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!requestId) return { success: false, error: "Missing request ID." };

  const result = await cancelServiceRequest(requestId, user.id);
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

export async function acceptBidAction(
  bidId: string,
  requestId: string
): Promise<{ success: boolean; error?: string; conversationId?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  try {
    await acceptBid(bidId, requestId, user.id);

    let conversationId: string | undefined;

    const { data: bid } = await supabase
      .from("glatko_bids")
      .select("professional_id, price")
      .eq("id", bidId)
      .single();

    if (bid) {
      const conversation = await getOrCreateConversation({
        service_request_id: requestId,
        bid_id: bidId,
        customer_id: user.id,
        professional_id: bid.professional_id,
      });

      conversationId = conversation.id;

      const admin = createAdminClient();
      const [{ data: proProfile }, { data: customerRow }] = await Promise.all([
        admin
          .from("profiles")
          .select("preferred_locale")
          .eq("id", bid.professional_id)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("preferred_locale, full_name")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const normLocale = (l: string | null | undefined) =>
        (l ?? "en").trim().toLowerCase().split(/[-_]/)[0]?.slice(0, 16) ||
        "en";

      const proLocaleNorm = normLocale(proProfile?.preferred_locale);
      const customerLocaleNorm = normLocale(customerRow?.preferred_locale);

      const customerContent = getBidAcceptedMessageForRecipientLocale(
        customerRow?.preferred_locale,
      );
      const proContent = getBidAcceptedMessageForRecipientLocale(
        proProfile?.preferred_locale,
      );

      await sendMessage({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: customerContent,
        content_type: "text",
        skipRecipientNotification: true,
        skipTranslation: true,
        ...(proLocaleNorm !== customerLocaleNorm && {
          original_locale: customerLocaleNorm,
          translated_content: proContent,
          translated_locale: proLocaleNorm,
        }),
      });

      const { data: reqData } = await supabase
        .from("glatko_service_requests")
        .select("title")
        .eq("id", requestId)
        .single();

      const requestTitle = reqData?.title || "a request";
      const customerName =
        customerRow?.full_name?.trim() || "A customer";
      const priceLabel = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(Number(bid.price));

      await createNotification({
        user_id: bid.professional_id,
        type: "bid_accepted",
        title: "Your bid was accepted!",
        body: `Your bid for "${requestTitle}" was accepted`,
        data: {
          requestId,
          bidId,
          conversationId: conversation.id,
          customerName,
          requestTitle,
          price: priceLabel,
        },
      }).catch(() => {});
    }

    return { success: true, conversationId };
  } catch (err) {
    glatkoCaptureException(err, { module: "accept-bid-action" });
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
