import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { addressPageMeta, badAddressMeta, cachedAddressResult, webpageJsonLd } from "@/lib/page-meta";
import { AddressView } from "./address-view";
import { BadAddressView } from "./bad-address";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const address = decodeURIComponent(id ?? "");
  const got = address ? await cachedAddressResult(address) : null;
  if (got?.bad) return badAddressMeta(address);
  return addressPageMeta(address, got?.data ?? null);
}

export default async function AddressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const address = decodeURIComponent(id ?? "");
  const got = address ? await cachedAddressResult(address) : null;
  if (got?.bad) return <BadAddressView address={address} />;
  const initial = got?.data ?? null;
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
