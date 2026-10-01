/** Public Ergo explorers and explorer-family APIs. Not ErgoScan. */

export type NetworkKind = "explorers" | "apis" | "graphql";

export type NetworkLink = {
  href: string;
  op: NetworkOp;
};

export type NetworkOp =
  | "ergoplatform"
  | "ergoplatformP2p"
  | "cornell"
  | "cornellBackup"
  | "codeutxo"
  | "ergexplorer"
  | "sigmaspace";

export const NETWORK_OPS: Record<NetworkOp, `network.op.${NetworkOp}`> = {
  ergoplatform: "network.op.ergoplatform",
  ergoplatformP2p: "network.op.ergoplatformP2p",
  cornell: "network.op.cornell",
  cornellBackup: "network.op.cornellBackup",
  codeutxo: "network.op.codeutxo",
  ergexplorer: "network.op.ergexplorer",
  sigmaspace: "network.op.sigmaspace",
};

export const NETWORK_DIRECTORY: Record<NetworkKind, readonly NetworkLink[]> = {
  explorers: [
    { href: "https://explorer.ergoplatform.com/", op: "ergoplatform" },
    { href: "https://explorer-p2p.ergoplatform.com/", op: "ergoplatformP2p" },
    { href: "https://ergo.aap.cornell.edu/", op: "cornell" },
    { href: "https://ergobackup.aap.cornell.edu/", op: "cornellBackup" },
    { href: "https://explorer.codeutxo.com/", op: "codeutxo" },
    { href: "https://ergexplorer.com/", op: "ergexplorer" },
    { href: "https://sigmaspace.io/", op: "sigmaspace" },
  ],
  apis: [
    { href: "https://api.ergoplatform.com/api/v1/docs/", op: "ergoplatform" },
    { href: "https://api-p2p.ergoplatform.com/api/v1/docs/", op: "ergoplatformP2p" },
    { href: "https://api.ergo.aap.cornell.edu/api/v1/docs/", op: "cornell" },
    { href: "https://api.ergobackup.aap.cornell.edu/api/v1/docs/", op: "cornellBackup" },
    { href: "https://api.codeutxo.com/api/v1/docs/", op: "codeutxo" },
  ],
  graphql: [
    { href: "https://gql.ergoplatform.com/", op: "ergoplatform" },
    { href: "https://graphql-p2p.ergoplatform.com/", op: "ergoplatformP2p" },
    { href: "https://graphql.ergo.aap.cornell.edu/", op: "cornell" },
    { href: "https://graphql.ergobackup.aap.cornell.edu/", op: "cornellBackup" },
    { href: "https://graphql.codeutxo.com/", op: "codeutxo" },
  ],
};

export const NETWORK_KINDS: readonly NetworkKind[] = ["explorers", "apis", "graphql"];

export function hrefHost(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}

export function hrefPath(href: string): string {
  try {
    const u = new URL(href);
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return path;
  } catch {
    return "";
  }
}
