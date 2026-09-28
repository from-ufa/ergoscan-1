import { listPageMeta } from "@/lib/page-meta";

export const metadata = listPageMeta("/about");

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
