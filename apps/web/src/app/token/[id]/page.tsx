import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { fetchTokenHolders } from "@/lib/list-snapshots";
import { cachedToken, tokenPageMeta, webpageJsonLd } from "@/lib/page-meta";
import { TokenView } from "./token-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tokenId = decodeURIComponent(id ?? "").toLowerCase();
  return tokenPageMeta(tokenId, await cachedToken(tokenId));
}

export default async function TokenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tokenId = decodeURIComponent(id ?? "").toLowerCase();
  const [initial, initialHolders] = await Promise.all([
    cachedToken(tokenId),
    fetchTokenHolders(tokenId),
  ]);
  const meta = tokenPageMeta(tokenId, initial);
  return (
    <>
      <JsonLd
        data={webpageJsonLd({
          title: String(meta.title ?? "Token"),
          path: `/token/${tokenId}`,
          description: String(meta.description ?? ""),
        })}
      />
      <TokenView
        key={tokenId}
        tokenId={tokenId}
        initial={initial}
        initialHolders={initialHolders}
      />
    </>
  );
}
