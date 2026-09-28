import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { boxPageMeta, cachedBox, webpageJsonLd } from "@/lib/page-meta";
import { BoxView } from "./box-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const boxId = decodeURIComponent(id ?? "");
  return boxPageMeta(boxId, boxId ? await cachedBox(boxId) : null);
}

export default async function BoxPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const boxId = decodeURIComponent(id ?? "");
  const initial = boxId ? await cachedBox(boxId) : null;
  const meta = boxPageMeta(boxId, initial);
  return (
    <>
      <JsonLd
        data={webpageJsonLd({
          title: String(meta.title ?? "Box"),
          path: `/box/${boxId}`,
          description: String(meta.description ?? ""),
        })}
      />
      <BoxView key={boxId} id={boxId} initial={initial} />
    </>
  );
}
