import { fetchBasis } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { BasisView } from "./basis-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/defi/basis");

export default async function BasisPage() {
  const initial = await fetchBasis();
  return <BasisView initial={initial} />;
}
