import { fetchDefiVolume, fetchSpectrumDex } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { SpectrumView } from "./spectrum-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/defi/spectrum");

export default async function SpectrumDexPage({
  searchParams,
}: {
  searchParams: Promise<{ tokenId?: string | string[]; token?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.tokenId ?? sp.token;
  const tokenId = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const tokenOk = /^[0-9a-f]{64}$/i.test(tokenId) ? tokenId.toLowerCase() : "";
  const [pack, volume] = await Promise.all([
    fetchSpectrumDex({ tokenId: tokenOk }),
    fetchDefiVolume({ days: 7, venue: "spectrum", tokenId: tokenOk }),
  ]);
  const spectrumLive = pack?.ok === true && pack.venue === "spectrum";
  return (
    <SpectrumView
      key={tokenOk || "spectrum"}
      tokenId={tokenOk}
      initial={spectrumLive ? pack : null}
      initialVolume={spectrumLive ? volume : []}
    />
  );
}
