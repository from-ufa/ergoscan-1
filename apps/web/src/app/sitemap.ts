import type { MetadataRoute } from "next";
import { getGateway } from "@/lib/config";
import { SITEMAP_STATIC } from "@/lib/page-meta";
import { SITE_URL } from "@/lib/site-meta";

export const dynamic = "force-dynamic";

type TokenRow = { tokenId?: string };
type BlockRow = { id?: string; height?: number };
type SeriesRow = { slug?: string };

async function gw<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${getGateway()}${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function loc(path: string, extra?: Partial<MetadataRoute.Sitemap[number]>): MetadataRoute.Sitemap[number] {
  return {
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    changeFrequency: extra?.changeFrequency ?? "hourly",
    priority: extra?.priority ?? 0.6,
    lastModified: extra?.lastModified,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tokens, blocks, series] = await Promise.all([
    gw<{ items?: TokenRow[] }>("/v1/tokens?limit=50&sort=holders&dir=desc&names=0"),
    gw<BlockRow[] | { items?: BlockRow[] }>("/v1/blocks?limit=50"),
    gw<{ collections?: SeriesRow[] }>("/v1/nfts/collections?limit=40"),
  ]);
  const blockRows = Array.isArray(blocks) ? blocks : (blocks?.items ?? []);

  const out: MetadataRoute.Sitemap = SITEMAP_STATIC.map((path) =>
    loc(path, {
      changeFrequency: path === "/" ? "always" : path === "/docs" || path === "/learn" || path === "/about" ? "weekly" : "hourly",
      priority: path === "/" ? 1 : path === "/docs" ? 0.8 : 0.7,
    })
  );

  for (const row of tokens?.items ?? []) {
    if (row.tokenId) out.push(loc(`/token/${row.tokenId}`, { changeFrequency: "daily", priority: 0.5 }));
  }
  for (const row of blockRows) {
    if (row.id) out.push(loc(`/block/${row.id}`, { changeFrequency: "hourly", priority: 0.4 }));
  }
  for (const row of series?.collections ?? []) {
    if (row.slug) out.push(loc(`/nfts/collection/${row.slug}`, { changeFrequency: "daily", priority: 0.4 }));
  }

  return out;
}
