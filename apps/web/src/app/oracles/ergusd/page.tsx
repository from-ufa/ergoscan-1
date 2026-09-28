import { fetchOracleFeed } from "@/lib/oracle-feed";
import { listPageMeta } from "@/lib/page-meta";
import { OracleFeedView } from "../oracle-feed-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/oracles/ergusd");

export default async function OfficialErgUsdOraclePage() {
  const initial = (await fetchOracleFeed("ergusd")) ?? undefined;
  return <OracleFeedView slug="ergusd" initial={initial} />;
}
