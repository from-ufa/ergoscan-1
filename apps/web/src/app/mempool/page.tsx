import { fetchMempoolPage } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { MempoolView } from "./mempool-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/mempool");

export default async function MempoolPage() {
  const pack = await fetchMempoolPage();
  return <MempoolView initialBalls={pack.balls} initialP50={pack.p50} />;
}
