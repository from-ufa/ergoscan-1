import { redirect } from "next/navigation";
import { getGateway } from "@/lib/config";
import { listPageMeta } from "@/lib/page-meta";
import { orderTokenHitsByHolders } from "@/lib/token-hit-rank";
import { SearchHits, type ResolveHit } from "./search-hits";

export const dynamic = "force-dynamic";

export const metadata = listPageMeta("/search");

async function resolveQuery(q: string): Promise<ResolveHit[]> {
  const gw = getGateway();
  try {
    const r = await fetch(`${gw}/v1/resolve?q=${encodeURIComponent(q)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { hits?: ResolveHit[] };
    return Array.isArray(j.hits) ? j.hits : [];
  } catch {
    return [];
  }
}

function isTokenNameList(hits: ResolveHit[]): boolean {
  return hits.length > 1 && hits.every((h) => h.type === "token");
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const gw = getGateway();
  const hits = q ? await orderTokenHitsByHolders(q, await resolveQuery(q), gw) : [];
  if (!isTokenNameList(hits) && hits[0]?.path) redirect(hits[0].path);
  return <SearchHits q={q} hits={hits} />;
}
