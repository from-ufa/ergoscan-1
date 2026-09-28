import { fetchTrustBoard } from "@/lib/trust-board";
import { StatusView } from "./status-view";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  return <StatusView initial={await fetchTrustBoard()} />;
}
