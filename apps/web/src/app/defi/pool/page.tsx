import { fetchPoolBoard } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { PoolView } from "./pool-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/defi/pool");

export default async function PoolPage() {
  const pack = await fetchPoolBoard();
  return <PoolView initial={pack?.ok === true ? pack : null} />;
}
