import type { Metadata } from "next";
import { fetchTokensCatalog } from "@/lib/list-snapshots";
import { listPageMeta, pageMeta } from "@/lib/page-meta";
import { TokensView } from "./tokens-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const raw = sp.q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (!q) return listPageMeta("/tokens");
  return pageMeta({
    title: `Tokens · ${q}`,
    description: `Ergo tokens matching “${q}” in the ErgoScan catalog.`,
    path: `/tokens?q=${encodeURIComponent(q)}`,
    index: false,
  });
}

export default async function TokensPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.q;
  const initialQ = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  const initial = await fetchTokensCatalog({ q: initialQ });
  return <TokensView initial={initial} />;
}
