import { completeBasisPack } from "@/lib/basis-pack";
import { fetchBasis } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { BasisView } from "./basis-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/defi/basis");

export default async function BasisPage() {
  const raw = await fetchBasis();
  const initial = await completeBasisPack(raw).catch(() => raw);
  return <BasisView initial={initial} />;
}
