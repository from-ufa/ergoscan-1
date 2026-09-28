import { fetchBlocksPack, fetchHomeSnapshot, homeToChainStats } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { BlocksView } from "./blocks-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/blocks");

export default async function BlocksPage() {
  const [pack, home] = await Promise.all([fetchBlocksPack(), fetchHomeSnapshot()]);
  return (
    <BlocksView
      initialItems={pack.items}
      initialHasMore={pack.hasMore}
      initialNextCursor={pack.nextCursor}
      initialStats={homeToChainStats(home)}
      initialUpdatedAt={pack.updatedAt ?? home.updatedAt}
    />
  );
}
