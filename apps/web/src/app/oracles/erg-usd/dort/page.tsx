import { fetchBuyback } from "@/lib/buyback";
import { listPageMeta } from "@/lib/page-meta";
import { BuybackView } from "../../buyback-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/oracles/erg-usd/dort");

export default async function DortBuybackPage() {
  const initial = (await fetchBuyback("dort")) ?? undefined;
  return <BuybackView kind="dort" initial={initial} />;
}
