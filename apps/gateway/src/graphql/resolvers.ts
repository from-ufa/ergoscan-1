import { GraphQLError } from "graphql";
import { ergoTokenDecimals } from "@ergoscan/shared";
import type { RawTx } from "@ergoscan/shared";
import { parseGixWindow } from "../lib/gix.js";
import {
  addressTokensConfirmed,
  addressTransactionsCursor,
  addressUnspentBoxesCursor,
  getAddressSummary,
  type AddressSummary,
  getBoxById,
  getTxById,
  parseKeysetCursor,
  readGixWatermark,
  tokenLiteById,
  transactionsByGix,
  unspentBoxesByGix,
  type GixStreamBox,
  type IdxBoxRow,
} from "../lib/indexDb.js";
import { peekChainTip } from "../lib/snapshots.js";
import { logSubmitFail, publicSubmitFail, validateSignedTx } from "../lib/submit-tx.js";
import { defiReady, oracleFeed, oracleHealth, rosenReady } from "./overlays.js";

export type GraphqlCtx = {
  getRawMempool: () => Map<string, RawTx>;
  getFullHeight: () => number | null | undefined;
  submitTx: (body: unknown) => Promise<unknown>;
  network: string;
};

function gixStr(v: number | null | undefined): string | null {
  return v == null || !Number.isFinite(v) ? null : String(Math.trunc(v));
}

function numStr(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  return String(v);
}

function mapBox(
  b: Partial<IdxBoxRow> & {
    boxId: string;
    value: string;
    blockId?: string | null;
    creationTxId?: string | null;
    spentTxId?: string | null;
  }
) {
  return {
    boxId: b.boxId,
    value: b.value || "0",
    address: b.address ?? null,
    ergoTree: b.ergoTree ?? null,
    transactionId: b.creationTxId ?? null,
    spentTransactionId: b.spentTxId ?? null,
    index: b.index ?? null,
    gix: gixStr(b.gix),
    creationHeight: b.creationHeight ?? null,
    blockId: b.blockId ?? null,
    assets: (b.assets ?? []).map((a) => ({
      tokenId: a.tokenId,
      amount: String(a.amount),
    })),
    additionalRegisters: b.additionalRegisters
      ? JSON.stringify(b.additionalRegisters)
      : null,
  };
}

function mapStreamBox(b: GixStreamBox) {
  return mapBox(b);
}

function pageLimit(raw: unknown, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(n)));
}

async function chainState(ctx: GraphqlCtx) {
  const [wm, tip] = await Promise.all([readGixWatermark(), peekChainTip()]);
  const height = ctx.getFullHeight() ?? tip?.height ?? null;
  return {
    height: height != null && Number.isFinite(height) ? height : null,
    lastBlockId: tip?.headerId ?? null,
    maxBoxGix: gixStr(wm.maxBoxGix),
    maxTxGix: gixStr(wm.maxTxGix),
    network: ctx.network,
    source: "index",
  };
}

export const graphqlRoot = {
  Query: {
    info: async (_: unknown, __: unknown, ctx: GraphqlCtx) => {
      const s = await chainState(ctx);
      return { ...s, gateway: "ergoscan/1.0.0" };
    },
    state: async (_: unknown, __: unknown, ctx: GraphqlCtx) => chainState(ctx),
    box: async (_: unknown, args: { id: string }) => {
      const row = await getBoxById(String(args.id ?? "").trim());
      return row ? mapBox(row) : null;
    },
    transaction: async (_: unknown, args: { id: string }) => {
      const row = await getTxById(String(args.id ?? "").trim());
      if (!row) return null;
      return {
        id: row.id,
        blockId: row.blockId,
        inclusionHeight: row.inclusionHeight,
        timestamp: numStr(row.timestamp),
        index: row.indexInBlock,
        gix: gixStr(row.gix),
        size: row.size,
        fee: row.fee,
        inputs: row.inputs.map(mapBox),
        outputs: row.outputs.map(mapBox),
      };
    },
    address: async (_: unknown, args: { id: string }) => {
      const address = String(args.id ?? "").trim();
      if (!address) return null;
      const summary = await getAddressSummary(address);
      return { address, summary };
    },
    token: async (_: unknown, args: { id: string }) => {
      const row = await tokenLiteById(String(args.id ?? "").trim());
      if (!row) return null;
      const decimals =
        row.decimals != null && row.decimals > 0
          ? row.decimals
          : ergoTokenDecimals(row.tokenId) ?? row.decimals;
      return {
        tokenId: row.tokenId,
        name: row.name,
        decimals,
        emission: row.emission,
        boxId: row.boxId,
      };
    },
    boxesByGix: async (_: unknown, args: { minGix: string; maxGix: string }) => {
      const win = parseGixWindow(args.minGix, args.maxGix);
      if (!win.ok) throw new GraphQLError(win.reason);
      const items = await unspentBoxesByGix(win.min, win.max);
      if (!items) throw new GraphQLError("gix stream query exceeded 4s");
      return items.map(mapStreamBox);
    },
    transactionsByGix: async (_: unknown, args: { minGix: string; maxGix: string }) => {
      const win = parseGixWindow(args.minGix, args.maxGix);
      if (!win.ok) throw new GraphQLError(win.reason);
      const items = await transactionsByGix(win.min, win.max);
      if (!items) throw new GraphQLError("gix stream query exceeded 4s");
      return items.map((t) => ({
        id: t.id,
        blockId: t.blockId,
        inclusionHeight: t.inclusionHeight,
        timestamp: numStr(t.timestamp),
        index: t.indexInBlock,
        gix: gixStr(t.gix),
        size: t.size,
        fee: null as string | null,
        inputs: t.inputs.map(mapStreamBox),
        outputs: t.outputs.map(mapStreamBox),
      }));
    },
    mempool: () => ({}),
    oracles: async () => oracleHealth(),
    defi: async () => defiReady(),
    rosen: async () => rosenReady(),
  },
  Mutation: {
    submitTx: async (_: unknown, args: { signedJson: string }, ctx: GraphqlCtx) => {
      let signed: unknown;
      try {
        signed = JSON.parse(args.signedJson);
      } catch {
        return { id: null, error: "signedJson must be a JSON object string" };
      }
      const shape = validateSignedTx(signed);
      if (!shape.ok) return { id: null, error: shape.reason };
      try {
        const id = await ctx.submitTx(signed);
        const txId = typeof id === "string" ? id : String((id as { id?: string })?.id ?? id);
        return { id: txId.replace(/^"|"$/g, ""), error: null };
      } catch (e) {
        logSubmitFail(e);
        return { id: null, error: publicSubmitFail(e).error };
      }
    },
  },
  Address: {
    used: (parent: { address: string; summary: AddressSummary | null }) =>
      (parent.summary?.txCount ?? 0) > 0 || (parent.summary?.boxCount ?? 0) > 0,
    balance: async (parent: { address: string; summary: AddressSummary | null }) => {
      const tokens = await addressTokensConfirmed(parent.address);
      return {
        nanoErgs: parent.summary?.nanoerg ?? "0",
        tokens: (tokens ?? []).map((t) => ({ tokenId: t.tokenId, amount: t.amount })),
      };
    },
    unspent: async (
      parent: { address: string },
      args: { cursor?: string | null; limit?: number }
    ) => {
      const cur = parseKeysetCursor(args.cursor);
      const page = await addressUnspentBoxesCursor(
        parent.address,
        cur,
        pageLimit(args.limit, 50, 100)
      );
      if (!page) return { items: [], hasMore: false, nextCursor: null };
      return {
        items: page.items.map((b) =>
          mapBox({
            boxId: b.boxId,
            value: b.value,
            address: b.address,
            ergoTree: b.ergoTree,
            creationTxId: b.creationTxId,
            index: b.index,
            creationHeight: b.creationHeight,
            assets: b.assets,
            gix: null,
            spentTxId: null,
            spentHeight: null,
            additionalRegisters: null,
          })
        ),
        hasMore: page.hasMore,
        nextCursor: page.hasMore ? page.nextCursor : null,
      };
    },
    transactions: async (
      parent: { address: string },
      args: { cursor?: string | null; limit?: number }
    ) => {
      const cur = parseKeysetCursor(args.cursor);
      const page = await addressTransactionsCursor(
        parent.address,
        cur,
        pageLimit(args.limit, 50, 100)
      );
      if (!page) return { items: [], hasMore: false, nextCursor: null };
      return {
        items: page.items.map((t) => ({
          id: t.id,
          inclusionHeight: t.inclusionHeight,
          timestamp: numStr(t.timestamp),
          size: t.size,
          fee: numStr(t.fee),
        })),
        hasMore: page.hasMore,
        nextCursor: page.hasMore ? page.nextCursor : null,
      };
    },
  },
  Mempool: {
    size: (_: unknown, __: unknown, ctx: GraphqlCtx) => ctx.getRawMempool().size,
    transactions: (
      _: unknown,
      args: { limit?: number },
      ctx: GraphqlCtx
    ) => {
      const take = pageLimit(args.limit, 50, 100);
      const out: { id: string; size: number | null }[] = [];
      for (const tx of ctx.getRawMempool().values()) {
        if (out.length >= take) break;
        out.push({ id: tx.id, size: tx.size ?? null });
      }
      return out;
    },
  },
  Oracles: {
    feed: async (_: unknown, args: { slug: string }) => oracleFeed(args.slug),
  },
};
