import { fetchDefiVolume, fetchLithosDex } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { LithosView } from "./lithos-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/defi/lithos");

export default async function LithosDexPage() {
  const [pack, volume] = await Promise.all([
    fetchLithosDex(),
    fetchDefiVolume({ days: 7, venue: "lithos_dex" }),
  ]);
  const lithosLive = pack?.ok === true && pack.venue === "lithos_dex";
  return (
    <LithosView
      initial={lithosLive ? pack : null}
      initialVolume={lithosLive ? volume : []}
    />
  );
}
