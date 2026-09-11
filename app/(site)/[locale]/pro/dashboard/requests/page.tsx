import { createClient } from "@/supabase/server";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getMatchingRequests } from "@/lib/supabase/glatko.server";
import { ProRequestsFeed } from "@/components/glatko/pro/ProRequestsFeed";

type Props = {
  params: Promise<{ locale: string }> | { locale: string };
};

export default async function ProRequestsPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  setRequestLocale(locale);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?redirect=/pro/dashboard/requests`);

  const requests = await getMatchingRequests(user.id);

  return <ProRequestsFeed requests={JSON.parse(JSON.stringify(requests))} locale={locale} />;
}
