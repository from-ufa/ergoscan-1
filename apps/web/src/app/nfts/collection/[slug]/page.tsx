import type { Metadata } from "next";
import { NftBrowseView } from "../../nft-browse-view";
import { cachedNftSeries, missMeta, pageMeta } from "@/lib/page-meta";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pack = await cachedNftSeries(slug);
  if (!pack) return missMeta("NFT collection", slug, `/nfts/collection/${slug}`);
  return pageMeta({
    title: pack.name || slug,
    description: `Ergo NFT collection ${pack.name || slug} on ErgoScan. ${pack.total} items.`,
    path: `/nfts/collection/${slug}`,
  });
}

export default async function NftSeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pack = await cachedNftSeries(slug);
  return (
    <NftBrowseView
      kind="series"
      title={pack?.name || slug}
      slug={slug}
      initialItems={pack?.items ?? []}
      initialTotal={pack?.total ?? 0}
      initialReady={pack?.ready !== false && pack != null}
      coverUrl={pack?.coverUrl}
      hintKey="nfts.collection.hint"
    />
  );
}
