import { fetchNftHome } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { NftsView } from "./nfts-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/nfts");

export default async function NftsPage() {
  const initial = await fetchNftHome();
  return <NftsView initial={initial} />;
}
