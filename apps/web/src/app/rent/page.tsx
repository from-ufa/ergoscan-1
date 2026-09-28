import { fetchRentPage } from "@/lib/list-snapshots";
import { listPageMeta } from "@/lib/page-meta";
import { RentView } from "./rent-view";

export const dynamic = "force-dynamic";
export const metadata = listPageMeta("/rent");

export default async function RentPage() {
  const initial = await fetchRentPage({ tab: "upcoming", offset: 0 });
  return <RentView initial={initial} />;
}
