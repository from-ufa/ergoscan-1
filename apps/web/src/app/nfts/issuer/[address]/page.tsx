import type { Metadata } from "next";
import { issuerTitle } from "@/lib/nft-art";
import { cachedNftIssuer, pageMeta } from "@/lib/page-meta";
import { NftBrowseView } from "../../nft-browse-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  const decoded = decodeURIComponent(address);
  const pack = await cachedNftIssuer(decoded);
  const title = issuerTitle(decoded);
  return pageMeta({
    title,
    description: `NFTs issued by ${title} on Ergo. ${pack?.total ?? 0} items in the ErgoScan index.`,
    path: `/nfts/issuer/${decoded}`,
    index: pack != null,
  });
}

export default async function NftIssuerPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const decoded = decodeURIComponent(address);
  const pack = await cachedNftIssuer(decoded);
  return (
    <NftBrowseView
      kind="issuer"
      title={issuerTitle(decoded)}
      address={decoded}
      initialItems={pack?.items ?? []}
      initialTotal={pack?.total ?? 0}
      initialReady={pack?.ready !== false && pack != null}
      coverUrl={pack?.coverUrl}
      hintKey="nfts.issuer.hint"
    />
  );
}
