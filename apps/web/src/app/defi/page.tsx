import { redirect } from "next/navigation";
import { listPageMeta } from "@/lib/page-meta";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/defi");

export default async function DefiRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tokenId?: string | string[]; token?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.tokenId ?? sp.token;
  const tokenId = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (/^[0-9a-f]{64}$/i.test(tokenId)) {
    redirect(`/defi/spectrum?tokenId=${encodeURIComponent(tokenId.toLowerCase())}`);
  }
  redirect("/defi/spectrum");
}
