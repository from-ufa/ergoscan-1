import { listPageMeta } from "@/lib/page-meta";
import { getGateway } from "@/lib/config";
import { LithosProtocolView, type LithosProtocolSnap } from "./lithos-view";

export const metadata = listPageMeta("/lithos");
export const dynamic = "force-dynamic";

async function load(): Promise<LithosProtocolSnap | null> {
  try {
    const r = await fetch(`${getGateway()}/v1/lithos`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    return (await r.json()) as LithosProtocolSnap;
  } catch {
    return null;
  }
}

export default async function LithosProtocolPage() {
  const initial = await load();
  return <LithosProtocolView initial={initial} />;
}
