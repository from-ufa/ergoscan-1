import { fetchRosenTape } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { RosenView } from "./rosen-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/rosen");

export default async function RosenPage() {
  const pack = await fetchRosenTape();
  return (
    <RosenView
      initialItems={pack.items}
      initialNextCursor={pack.nextCursor}
      initialHasMore={pack.hasMore}
      initialReady={pack.ready}
      initialHealth={pack.health}
    />
  );
}
