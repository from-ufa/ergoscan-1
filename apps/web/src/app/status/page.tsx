import { readApiUse } from "@/lib/api-use-read";
import { fetchTrustBoard } from "@/lib/trust-board";
import { StatusView } from "./status-view";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const [initial, initialApi] = await Promise.all([fetchTrustBoard(), readApiUse()]);
  return <StatusView initial={initial} initialApi={initialApi} />;
}
