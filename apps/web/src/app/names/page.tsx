import { listPageMeta } from "@/lib/page-meta";
import { NamesView } from "./names-view";

export const metadata = listPageMeta("/names");

export default function NamesPage() {
  return <NamesView />;
}
