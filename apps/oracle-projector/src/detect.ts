import {
  ORACLE_FEEDS,
  SNAP_MARKET_KEY,
  longFromRegister,
  oracleEpochFromRegisters,
  oracleOperatorFromRegisters,
  oracleQuoteFromRegisters,
  parseMarketSnap,
  type OracleFeedSlug,
} from "@ergoscan/shared";
import type { Queryable } from "./db.js";
import { detectLookback, unspentMinHeight } from "./policy.js";

/** Same predicate as boxes_unspent_idx / boxes_unspent_long_md5_idx. */
export type OracleCensus = "holders" | "lookback";

export type DetectedBox = {
  boxId: string;
  address: string | null;
  height: number | null;
  tsMs: number | null;
  quote: number | null;
  r4Nano: string | null;
  epoch: number | null;
  valueNano: string;
  creationTxId: string | null;
};

export type DetectedFeed = {
  slug: OracleFeedSlug;
  pool: DetectedBox | null;
  operators: DetectedBox[];
  spentTicks: DetectedBox[];
  census: OracleCensus;
};

export type MarketSnap = {
  ergUsd: number | null;
  xauUsd: number | null;
  xauPerErg: number | null;
  circulating: number | null;
  volume24h: number | null;
};

type BoxRow = {
  box_id: string;
  address: string | null;
  creation_height: string | number | null;
  ts_ms: string | number | null;
  value_nano: string;
  creation_tx_id: string | null;
  additional_registers: unknown;
  amount: string;
};

function finite(n: unknown): number | null {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

/** amount=1 is a seated oracle token. amount>1 is leftover stock, not an operator. */
export function classifyOracleTokenAmount(
  amount: string | number | bigint | null | undefined
): "seat" | "stock" | "skip" {
  if (amount == null || amount === "") return "skip";
  try {
    const n = typeof amount === "bigint" ? amount : BigInt(String(amount).split(".")[0] || "0");
    if (n === 1n) return "seat";
    if (n > 1n) return "stock";
    return "skip";
  } catch {
    return "skip";
  }
}

/** One mark per P2PK (R4). Same person with two leftover boxes keeps the newest. */
export function uniqueOracleSeats<
  T extends { address: string | null; boxId: string; height: number | null },
>(ops: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const op of ops) {
    const key = op.address || `box:${op.boxId}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, op);
      continue;
    }
    const ph = prev.height ?? -1;
    const oh = op.height ?? -1;
    if (oh > ph || (oh === ph && op.boxId > prev.boxId)) byKey.set(key, op);
  }
  return [...byKey.values()].sort((a, b) => {
    const dh = (b.height ?? 0) - (a.height ?? 0);
    if (dh) return dh;
    return a.boxId.localeCompare(b.boxId);
  });
}

function decodeBox(row: BoxRow): DetectedBox | null {
  const id = String(row.box_id || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(id)) return null;
  const regs = row.additional_registers;
  const op = oracleOperatorFromRegisters(regs);
  const poolR4 = longFromRegister(
    regs && typeof regs === "object" && !Array.isArray(regs)
      ? (regs as Record<string, unknown>).R4
      : null
  );
  const datapoint = op.pubKey ? op.r6Nano : poolR4 != null ? String(poolR4) : null;
  return {
    boxId: id,
    address: op.address,
    height: finite(row.creation_height),
    tsMs: finite(row.ts_ms),
    quote: op.pubKey ? op.quote : oracleQuoteFromRegisters(regs),
    r4Nano: datapoint,
    epoch: oracleEpochFromRegisters(regs),
    valueNano: String(row.value_nano ?? "0"),
    creationTxId: row.creation_tx_id ? String(row.creation_tx_id) : null,
  };
}

async function boxesByToken(
  db: Queryable,
  tokenId: string,
  opts: { unspentOnly: boolean; fromHeight: number | null; limit: number }
): Promise<BoxRow[]> {
  const token = tokenId.toLowerCase();
  if (opts.unspentOnly) {
    const floor = opts.fromHeight != null && Number.isFinite(opts.fromHeight) ? opts.fromHeight : 0;
    const r = await db.query<BoxRow>(
      `SELECT encode(x.box_id, 'hex') AS box_id, x.address,
              x.creation_height::text AS creation_height,
              blk.timestamp_ms::text AS ts_ms, x.value_nano::text AS value_nano,
              encode(x.creation_tx_id, 'hex') AS creation_tx_id,
              x.additional_registers, x.amount::text AS amount
         FROM (
           SELECT b.box_id, ad.address AS address, b.creation_height, b.value_nano,
                  b.creation_tx_id, b.additional_registers, a.amount
             FROM packed.box_assets a
             JOIN packed.boxes b
               ON b.box_id = a.box_id AND b.spent_tx_id IS NULL
             JOIN packed.addr ad ON ad.id = b.addr_id
            WHERE a.token_id = decode(lower($1), 'hex')
              AND a.amount = 1
              AND b.creation_height >= $2
            ORDER BY b.creation_height DESC NULLS LAST, b.box_id
            LIMIT $3
         ) x
         LEFT JOIN packed.blocks blk ON blk.height = x.creation_height`,
      [token, floor, opts.limit]
    );
    return r.rows;
  }
  const params: unknown[] = [token];
  let floor = "";
  if (opts.fromHeight != null) {
    params.push(opts.fromHeight);
    floor = `AND b.creation_height >= $${params.length}`;
  }
  params.push(opts.limit);
  const r = await db.query<BoxRow>(
    `SELECT encode(b.box_id, 'hex') AS box_id, ad.address,
            b.creation_height::text AS creation_height,
            blk.timestamp_ms::text AS ts_ms, b.value_nano::text AS value_nano,
            encode(b.creation_tx_id, 'hex') AS creation_tx_id,
            b.additional_registers, a.amount::text AS amount
       FROM packed.box_assets a
       JOIN packed.boxes b ON b.box_id = a.box_id
       JOIN packed.addr ad ON ad.id = b.addr_id
       LEFT JOIN packed.blocks blk ON blk.height = b.creation_height
      WHERE a.token_id = packed.hex32($1) AND a.amount = 1
        ${floor}
      ORDER BY b.creation_height DESC NULLS LAST, b.box_id
      LIMIT $${params.length}`,
    params
  );
  return r.rows;
}

async function tokenHolders(
  db: Queryable,
  tokenId: string
): Promise<{ address: string; amount: string }[]> {
  const r = await db.query<{ address: string; amount: string }>(
    `SELECT address, amount::text AS amount
       FROM token_balances
      WHERE token_id = $1 AND amount > 0`,
    [tokenId.toLowerCase()]
  );
  return r.rows.filter((row) => row.address);
}

async function unspentOracleBoxesAtAddresses(
  db: Queryable,
  tokenId: string,
  addresses: string[]
): Promise<BoxRow[]> {
  const token = tokenId.toLowerCase();
  if (!addresses.length) return [];
  const r = await db.query<BoxRow>(
    `SELECT encode(b.box_id, 'hex') AS box_id, ad.address,
            b.creation_height::text AS creation_height,
            blk.timestamp_ms::text AS ts_ms, b.value_nano::text AS value_nano,
            encode(b.creation_tx_id, 'hex') AS creation_tx_id,
            b.additional_registers, a.amount::text AS amount
       FROM packed.addr ad
       JOIN packed.boxes b ON b.addr_id = ad.id AND b.spent_tx_id IS NULL
       JOIN packed.box_assets a ON a.box_id = b.box_id AND a.token_id = packed.hex32($1)
       LEFT JOIN packed.blocks blk ON blk.height = b.creation_height
      WHERE ad.addr_md5 IN (SELECT md5(x) FROM unnest($2::text[]) AS x)
        AND ad.address = ANY($2::text[])`,
    [token, addresses]
  );
  return r.rows;
}

/** Seat needs amount=1 and R4 → P2PK. Stray warehouse leftovers stay out. */
export function isOracleSeatBox(box: DetectedBox): boolean {
  return Boolean(box.address);
}

function seatsFromRows(rows: BoxRow[]): DetectedBox[] {
  const seats = rows
    .filter((row) => classifyOracleTokenAmount(row.amount) === "seat")
    .map(decodeBox)
    .filter((b): b is DetectedBox => b != null && isOracleSeatBox(b));
  return uniqueOracleSeats(seats);
}

export async function readMarket(db: Queryable): Promise<MarketSnap> {
  const [marketR, homeR] = await Promise.all([
    db.query<{ payload: unknown }>(
      `SELECT payload FROM snapshot_kv WHERE key = $1 LIMIT 1`,
      [SNAP_MARKET_KEY]
    ),
    db.query<{ payload: unknown }>(
      `SELECT payload FROM snapshot_kv WHERE key = 'home' LIMIT 1`
    ),
  ]);
  const market = parseMarketSnap(marketR.rows[0]?.payload);
  const home = homeR.rows[0]?.payload;
  const homeObj =
    home && typeof home === "object" && !Array.isArray(home)
      ? (home as Record<string, unknown>)
      : null;
  return {
    ergUsd: market?.ergUsd ?? finite(homeObj?.ergUsd),
    xauUsd: market?.xauUsd ?? null,
    xauPerErg: market?.xauPerErg ?? null,
    circulating: finite(homeObj?.circulating),
    volume24h: market?.volume24h ?? finite(homeObj?.volume24h),
  };
}

export async function detectFeed(
  db: Queryable,
  slug: OracleFeedSlug,
  includeSpent: boolean,
  fromHeight: number | null,
  tipHeight = 0
): Promise<DetectedFeed> {
  const def = ORACLE_FEEDS[slug];
  const liveFloor = unspentMinHeight(tipHeight, detectLookback(process.env.ORACLE_DETECT_LOOKBACK));
  const poolRows = await boxesByToken(db, def.poolNft, {
    unspentOnly: true,
    fromHeight: liveFloor,
    limit: 4,
  });
  let census: OracleCensus = "lookback";
  let operators: DetectedBox[] = [];
  const holders = await tokenHolders(db, def.oracleToken);
  if (holders.length) {
    const seated = seatsFromRows(
      await unspentOracleBoxesAtAddresses(
        db,
        def.oracleToken,
        holders.map((h) => h.address)
      )
    );
    if (seated.length) {
      operators = seated;
      census = "holders";
    }
  }
  if (!operators.length) {
    const opRows = await boxesByToken(db, def.oracleToken, {
      unspentOnly: true,
      fromHeight: liveFloor,
      limit: 64,
    });
    operators = uniqueOracleSeats(
      opRows
        .map(decodeBox)
        .filter((b): b is DetectedBox => b != null && isOracleSeatBox(b))
    );
    census = "lookback";
  }
  let spentTicks: DetectedBox[] = [];
  if (includeSpent && fromHeight != null) {
    const hist = await boxesByToken(db, def.poolNft, {
      unspentOnly: false,
      fromHeight,
      limit: 4_000,
    });
    spentTicks = hist.map(decodeBox).filter((b): b is DetectedBox => b != null && b.quote != null);
  }
  return {
    slug,
    pool: poolRows[0] ? decodeBox(poolRows[0]) : null,
    operators,
    spentTicks,
    census,
  };
}

export async function enrichOperators(
  db: Queryable,
  ops: DetectedBox[]
): Promise<
  Map<
    string,
    { addressErgNano: string | null; feeNano: string | null; tsMs: number | null }
  >
> {
  const out = new Map<
    string,
    { addressErgNano: string | null; feeNano: string | null; tsMs: number | null }
  >();
  if (!ops.length) return out;
  const addrs = [...new Set(ops.map((o) => o.address).filter((a): a is string => !!a))];
  const txs = [...new Set(ops.map((o) => o.creationTxId).filter((a): a is string => !!a))];
  const addrRows =
    addrs.length === 0
      ? []
      : (
          await db.query<{ address: string; nanoerg: string }>(
            `SELECT address, nanoerg::text AS nanoerg
               FROM address_summary WHERE address = ANY($1::text[])`,
            [addrs]
          )
        ).rows;
  const txRows =
    txs.length === 0
      ? []
      : (
          await db.query<{ id: string; fee: string | null; timestamp_ms: string | null }>(
            `SELECT encode(id, 'hex') AS id, fee::text AS fee, timestamp_ms::text AS timestamp_ms
               FROM packed.transactions
              WHERE id IN (SELECT decode(lower(x), 'hex') FROM unnest($1::text[]) AS x)`,
            [txs]
          )
        ).rows;
  const byAddr = new Map(addrRows.map((r) => [r.address, r.nanoerg]));
  const byTx = new Map(
    txRows.map((r) => [
      r.id,
      { fee: r.fee, ts: r.timestamp_ms != null ? Number(r.timestamp_ms) : null },
    ])
  );
  for (const op of ops) {
    const tx = op.creationTxId ? byTx.get(op.creationTxId) : undefined;
    out.set(op.boxId, {
      addressErgNano: op.address ? byAddr.get(op.address) ?? null : null,
      feeNano: tx?.fee ?? null,
      tsMs: op.tsMs ?? (tx?.ts != null && Number.isFinite(tx.ts) ? tx.ts : null),
    });
  }
  return out;
}
