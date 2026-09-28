import { listPageMeta } from "@/lib/page-meta";

export const metadata = listPageMeta("/status");

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
