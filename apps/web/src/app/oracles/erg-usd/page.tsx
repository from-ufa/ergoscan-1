import { fetchOracleFeed } from "@/lib/oracle-feed";
import { listPageMeta } from "@/lib/page-meta";
import { OracleFeedView } from "../oracle-feed-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/oracles/erg-usd");

export default async function ErgUsdOraclePage() {
  const initial = (await fetchOracleFeed("erg-usd")) ?? undefined;
  return <OracleFeedView slug="erg-usd" initial={initial} />;
}
