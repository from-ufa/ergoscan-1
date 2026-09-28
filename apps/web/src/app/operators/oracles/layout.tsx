import { listPageMeta } from "@/lib/page-meta";

export const metadata = listPageMeta("/operators/oracles");

export default function OraclesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
