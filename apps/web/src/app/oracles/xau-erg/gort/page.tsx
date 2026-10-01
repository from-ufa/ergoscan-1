import { fetchBuyback } from "@/lib/buyback";
import { listPageMeta } from "@/lib/page-meta";
import { BuybackView } from "../../buyback-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/oracles/xau-erg/gort");

export default async function GortBuybackPage() {
  const initial = (await fetchBuyback("gort")) ?? undefined;
  return <BuybackView kind="gort" initial={initial} />;
}
