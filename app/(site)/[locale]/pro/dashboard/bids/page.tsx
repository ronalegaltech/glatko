import { createClient } from "@/supabase/server";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getProfessionalBids } from "@/lib/supabase/glatko.server";
import { ProBidsList } from "@/components/glatko/pro/ProBidsList";

type Props = {
  params: Promise<{ locale: string }> | { locale: string };
};

export default async function ProBidsPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  setRequestLocale(locale);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?redirect=/pro/dashboard/bids`);

  const bids = await getProfessionalBids(user.id);

  return <ProBidsList bids={JSON.parse(JSON.stringify(bids))} locale={locale} />;
}
