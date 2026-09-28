import { fetchOracleFeed } from "@/lib/oracle-feed";
import { listPageMeta } from "@/lib/page-meta";
import { OracleFeedView } from "../oracle-feed-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/oracles/xau-erg");

export default async function XauErgOraclePage() {
  const initial = (await fetchOracleFeed("xau-erg")) ?? undefined;
  return <OracleFeedView slug="xau-erg" initial={initial} />;
}
