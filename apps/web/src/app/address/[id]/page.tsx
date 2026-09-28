import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { addressPageMeta, cachedAddress, webpageJsonLd } from "@/lib/page-meta";
import { AddressView } from "./address-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const address = decodeURIComponent(id ?? "");
  return addressPageMeta(address, address ? await cachedAddress(address) : null);
}

export default async function AddressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const address = decodeURIComponent(id ?? "");
  const initial = address ? await cachedAddress(address) : null;
  const meta = addressPageMeta(address, initial);
  return (
    <>
      <JsonLd
        data={webpageJsonLd({
          title: String(meta.title ?? "Address"),
          path: `/address/${address}`,
          description: String(meta.description ?? ""),
        })}
      />
      <AddressView key={address} address={address} initial={initial} />
    </>
  );
}
