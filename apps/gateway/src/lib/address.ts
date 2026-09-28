/**
 * Resolve payment addresses from a mempool tx (optional enrich).
 * Node unconfirmed payloads often have ergoTree, not Base58.
 */
import type { RawTx } from "@ergoscan/shared";

type NodeGet = <T = unknown>(path: string, timeoutMs?: number) => Promise<T>;
type NodePost = <T = unknown>(path: string, body: unknown, timeoutMs?: number) => Promise<T>;

const treeCache = new Map<string, string | null>();
const TREE_CACHE_MAX = 800;

async function treeToAddress(
  tree: string,
  nodeGet: NodeGet,
  nodePost: NodePost
): Promise<string | null> {
  if (treeCache.has(tree)) return treeCache.get(tree) ?? null;
  let addr: string | null = null;
  try {
    const r = await nodeGet<{ address?: string }>(`/utils/ergoTreeToAddress/${tree}`, 3000);
    addr = r.address ?? null;
  } catch {
    try {
      const r = await nodePost<{ address?: string }>("/utils/ergoTreeToAddress", tree, 3000);
      addr = r.address ?? null;
    } catch {
      addr = null;
    }
  }
  if (treeCache.size >= TREE_CACHE_MAX) treeCache.clear();
  treeCache.set(tree, addr);
  return addr;
}

export async function addressesFromTx(
  tx: RawTx,
  nodeGet: NodeGet,
  nodePost: NodePost
): Promise<string[]> {
  const out = new Set<string>();
  const trees: string[] = [];
  for (const box of [...(tx.inputs ?? []), ...(tx.outputs ?? [])]) {
    const a = (box as { address?: string }).address;
    if (a) out.add(a);
    else if (box.ergoTree) trees.push(box.ergoTree);
  }
  const uniqueTrees = [...new Set(trees)].slice(0, 24);
  for (const tree of uniqueTrees) {
    const addr = await treeToAddress(tree, nodeGet, nodePost);
    if (addr) out.add(addr);
  }
  return [...out];
}
