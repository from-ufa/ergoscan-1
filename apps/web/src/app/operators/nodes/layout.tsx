import { listPageMeta } from "@/lib/page-meta";

export const metadata = listPageMeta("/operators/nodes");

export default function NodesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
