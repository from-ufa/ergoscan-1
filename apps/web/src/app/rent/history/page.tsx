import { fetchRentPage } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { RentView } from "../rent-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/rent/history");

export default async function RentHistoryPage() {
  const initial = await fetchRentPage({ tab: "upcoming", offset: 0 });
  return <RentView initial={initial} pane="history" />;
}
