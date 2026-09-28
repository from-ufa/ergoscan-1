import { fetchHomeSnapshot, fetchRecentTxs, homeToChainStats } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { TransactionsView } from "./transactions-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/transactions");

export default async function TransactionsPage() {
  const [recent, home] = await Promise.all([fetchRecentTxs(), fetchHomeSnapshot()]);
  return (
    <TransactionsView
      initialItems={recent.items}
      initialUpdatedAt={recent.updatedAt}
      initialHasMore={recent.hasMore}
      initialNextCursor={recent.nextCursor}
      initialStats={homeToChainStats(home)}
    />
  );
}
