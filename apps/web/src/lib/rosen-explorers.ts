/**
 * Rosen from/to/source links. Ergo stays on ErgoScan.
 * Other chains: official explorers we probed against live tape ids.
 */

const BOX_RE = /^box:([0-9a-fA-F]{64})(?:\.\d+)?$/;
const HEX64 = /^[0-9a-fA-F]{64}$/;
const EVM = /^0x[0-9a-fA-F]{40}$/;
const EVM_TX = /^0x[0-9a-fA-F]{64}$/;

export type RosenExplorerHit = {
  href: string;
  external: boolean;
  label: string;
};

function evmAddr(id: string): string | null {
  const s = id.trim();
  if (EVM.test(s)) return s.toLowerCase();
  if (/^[0-9a-fA-F]{40}$/.test(s)) return `0x${s.toLowerCase()}`;
  return null;
}

function evmTx(id: string): string | null {
  const s = id.trim();
  if (EVM_TX.test(s)) return s.toLowerCase();
  if (HEX64.test(s)) return `0x${s.toLowerCase()}`;
  return null;
}

function hexTx(id: string): string | null {
  const s = id.trim().replace(/^0x/i, "");
  return HEX64.test(s) ? s.toLowerCase() : null;
}

function boxTxId(raw: string): string | null {
  const m = BOX_RE.exec(raw.trim());
  return m ? m[1].toLowerCase() : null;
}

export function rosenExplorer(
  chain: string | null | undefined,
  kind: "address" | "tx",
  raw: string | null | undefined
): RosenExplorerHit | null {
  const id = (raw ?? "").trim();
  if (!id) return null;
  const ch = (chain ?? "").trim().toLowerCase();

  if (kind === "address") {
    const boxed = boxTxId(id);
    if (boxed) return rosenExplorer(ch, "tx", boxed);
  }

  if (ch === "ergo") {
    if (kind === "address") {
      return { href: `/address/${encodeURIComponent(id)}`, external: false, label: id };
    }
    const tx = hexTx(id);
    if (!tx) return null;
    return { href: `/tx/${tx}`, external: false, label: tx };
  }

  if (ch === "cardano") {
    if (kind === "address") {
      if (!/^addr1[0-9a-z]+$/i.test(id)) return null;
      return {
        href: `https://adastat.net/addresses/${encodeURIComponent(id)}`,
        external: true,
        label: id,
      };
    }
    const tx = hexTx(id);
    if (!tx) return null;
    return { href: `https://adastat.net/transactions/${tx}`, external: true, label: tx };
  }

  if (ch === "bitcoin" || ch === "bitcoin-runes") {
    if (kind === "address") {
      if (!/^(bc1|[13])[0-9a-z]+$/i.test(id)) return null;
      return { href: `https://mempool.space/address/${encodeURIComponent(id)}`, external: true, label: id };
    }
    const tx = hexTx(id);
    if (!tx) return null;
    return { href: `https://mempool.space/tx/${tx}`, external: true, label: tx };
  }

  if (ch === "ethereum") {
    if (kind === "address") {
      const a = evmAddr(id);
      if (!a) return null;
      return { href: `https://etherscan.io/address/${a}`, external: true, label: a };
    }
    const tx = evmTx(id);
    if (!tx) return null;
    return { href: `https://etherscan.io/tx/${tx}`, external: true, label: tx };
  }

  if (ch === "binance") {
    if (kind === "address") {
      const a = evmAddr(id);
      if (!a) return null;
      return { href: `https://bscscan.com/address/${a}`, external: true, label: a };
    }
    const tx = evmTx(id);
    if (!tx) return null;
    return { href: `https://bscscan.com/tx/${tx}`, external: true, label: tx };
  }

  if (ch === "doge") {
    if (kind === "address") {
      if (!/^D[1-9A-HJ-NP-Za-km-z]{20,}$/.test(id)) return null;
      return {
        href: `https://www.oklink.com/doge/address/${encodeURIComponent(id)}`,
        external: true,
        label: id,
      };
    }
    const tx = hexTx(id);
    if (!tx) return null;
    return { href: `https://www.oklink.com/doge/tx/${tx}`, external: true, label: tx };
  }

  if (ch === "firo") {
    if (kind === "address") {
      if (!/^a[1-9A-HJ-NP-Za-km-z]{20,}$/.test(id)) return null;
      return {
        href: `https://chainz.cryptoid.info/firo/address.dws?${encodeURIComponent(id)}.htm`,
        external: true,
        label: id,
      };
    }
    const tx = hexTx(id);
    if (!tx) return null;
    return { href: `https://chainz.cryptoid.info/firo/tx.dws?${tx}.htm`, external: true, label: tx };
  }

  return null;
}
