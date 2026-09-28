import { listPageMeta } from "@/lib/page-meta";
import { getGateway } from "@/lib/config";
import { PoolCardView } from "./pool-card-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/defi/pool");

export default async function PoolCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const poolId = id.trim().toLowerCase();
  let initial = null;
  if (/^[0-9a-f]{64}$/.test(poolId)) {
    try {
      const r = await fetch(`${getGateway()}/v1/defi/pool/${poolId}?view=trades`, { cache: "no-store" });
      if (r.ok) initial = await r.json();
    } catch {
      initial = null;
    }
  }
  return <PoolCardView poolId={poolId} initial={initial?.ok ? initial : null} />;
}
