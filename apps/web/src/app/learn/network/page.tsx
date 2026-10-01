import { listPageMeta } from "@/lib/page-meta";
import { NetworkView } from "./network-view";

export const metadata = listPageMeta("/learn/network");

export default function NetworkPage() {
  return <NetworkView />;
}
