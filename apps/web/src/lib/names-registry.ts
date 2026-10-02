import { registryRowsMissingFromBook, type RegistryBookRow } from "./address-book";
import { getGateway } from "./config";

type BookItem = Partial<RegistryBookRow> & { project?: { name?: string; category?: string } };

/** Registry names the bundled book lacks. Empty on any gateway trouble: the bundled book still names the rest. */
export async function fetchRegistryRows(): Promise<RegistryBookRow[]> {
  try {
    const r = await fetch(`${getGateway()}/v1/names/book`, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { items?: BookItem[] };
    const rows: RegistryBookRow[] = [];
    for (const it of j.items ?? []) {
      if (!it.address || !it.name || !it.fileUrl) continue;
      rows.push({
        address: it.address,
        name: it.name,
        kind: it.kind ?? "contract",
        category: it.project?.category ?? "other",
        projectName: it.project?.name ?? "",
        by: it.by === "project" ? "project" : "ergoscan",
        current: it.current !== false,
        fileUrl: it.fileUrl,
      });
    }
    return registryRowsMissingFromBook(rows);
  } catch {
    return [];
  }
}
