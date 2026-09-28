import { listPageMeta } from "@/lib/page-meta";

export const metadata = listPageMeta("/fees");

export default function FeesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
