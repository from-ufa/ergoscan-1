import { fetchAgeUsdBank } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { StableView } from "./stable-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/defi/stable");

export default async function StablePage() {
  const bank = await fetchAgeUsdBank();
  return <StableView initial={bank} />;
}
