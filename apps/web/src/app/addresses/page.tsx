import { redirect } from "next/navigation";
import {
  fetchAddressesList,
  parseAddressListBands,
  parseAddressListKinds,
} from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { AddressesView } from "./addresses-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/addresses");

function firstQuery(raw: string | string[] | undefined): string | string[] {
  return raw ?? "";
}

export default async function AddressesPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    band?: string | string[];
    kind?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const view = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  if ((view ?? "").trim() === "book") redirect("/names");
  const bands = parseAddressListBands(firstQuery(sp.band));
  const kinds = parseAddressListKinds(firstQuery(sp.kind));
  const initial = await fetchAddressesList({ bands, kinds });
  return <AddressesView initial={initial} />;
}
