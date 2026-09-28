import { DocsView } from "./docs-view";
import { listPageMeta } from "@/lib/page-meta";

export const metadata = listPageMeta("/docs");

export default function DocsPage() {
  return <DocsView />;
}
