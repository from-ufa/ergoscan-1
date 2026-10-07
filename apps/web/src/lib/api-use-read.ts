import { readFile } from "node:fs/promises";
import { parseApiUse, type ApiUse } from "./api-use";

const SNAP = process.env.VISITORS_SNAP ?? "/opt/lumen-visitors/www/snapshot.json";
const HEALTH = process.env.API_HEALTH_URL ?? "http://127.0.0.1:4401/v1/health";

export async function readApiUse(): Promise<ApiUse> {
  const [snapshot, health] = await Promise.all([
    readFile(SNAP, "utf8")
      .then((text) => JSON.parse(text) as unknown)
      .catch(() => null),
    fetch(HEALTH, { cache: "no-store", signal: AbortSignal.timeout(2500) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);
  return parseApiUse(snapshot, health);
}
