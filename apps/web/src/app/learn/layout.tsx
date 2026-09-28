import { listPageMeta } from "@/lib/page-meta";

export const metadata = listPageMeta("/learn");

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
