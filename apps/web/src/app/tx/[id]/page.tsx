import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { cachedTx, txPageMeta, webpageJsonLd } from "@/lib/page-meta";
import { TxView } from "./tx-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const txId = decodeURIComponent(id ?? "");
  return txPageMeta(txId, await cachedTx(txId));
}

export default async function TxPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const txId = decodeURIComponent(id ?? "");
  const initial = await cachedTx(txId);
  const meta = txPageMeta(txId, initial);
  return (
    <>
      <JsonLd
        data={webpageJsonLd({
          title: String(meta.title ?? "Transaction"),
          path: `/tx/${txId}`,
          description: String(meta.description ?? ""),
        })}
      />
      <TxView key={txId} id={txId} initial={initial} />
    </>
  );
}
