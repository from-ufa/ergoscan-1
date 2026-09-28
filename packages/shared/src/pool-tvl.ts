/**
 * Honest N2T pool TVL from the unspent pool box + last fill price.
 *
 * ERG side = box nano minus Lithos pendingX (Spectrum pending is 0).
 * Token side = (quote raw − pendingY) × last fill ERG price, only when that
 * ratio is sane. Do not blindly 2× the ERG box — missing/stale price stays
 * ERG-only, which is the live Spectrum KPI today.
 */

/** Drop token side when it is this many times the ERG side (stale fill). */
export const TVL_TOKEN_SIDE_MAX_RATIO = 8;

/** Spectrum page lists / KPI-sums pools at or above this indexed TVL. */
export const POOL_LIST_MIN_TVL_ERG = 100;

export type N2tTvlInput = {
  valueNano: number | bigint | string;
  pendingXNano?: number | bigint | string | null;
  pendingY?: number | bigint | string | null;
  quoteRaw?: number | bigint | string | null;
  quoteDecimals?: number | null;
  priceErg?: number | null;
};

export type N2tTvlParts = {
  tvlErg: number;
  ergSide: number;
  tokenSide: number;
};

function asInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "string" && /^-?\d+(\.0+)?$/.test(v.trim())) {
    return BigInt(v.trim().replace(/\.0+$/, ""));
  }
  const n = Number(v);
  return Number.isFinite(n) ? BigInt(Math.trunc(n)) : 0n;
}

function rawToDec(raw: bigint, decimals: number): number {
  if (raw <= 0n) return 0;
  const d = Math.max(0, Math.min(18, decimals));
  const base = 10n ** BigInt(d);
  const whole = raw / base;
  const frac = raw % base;
  return Number(whole) + Number(frac) / Number(base);
}

export function n2tTvlErg(input: N2tTvlInput): N2tTvlParts {
  const valueNano = asInt(input.valueNano);
  const pendingX = asInt(input.pendingXNano);
  const ergNano = valueNano > pendingX && pendingX >= 0n ? valueNano - pendingX : 0n;
  const ergSide = rawToDec(ergNano, 9);
  if (!(ergSide > 0) || !Number.isFinite(ergSide)) {
    return { tvlErg: 0, ergSide: 0, tokenSide: 0 };
  }

  const price = input.priceErg;
  const quoteRaw = asInt(input.quoteRaw);
  const pendingY = asInt(input.pendingY);
  const quoteNet = quoteRaw > pendingY && pendingY >= 0n ? quoteRaw - pendingY : 0n;
  const dec = Math.max(0, Math.min(18, Number(input.quoteDecimals ?? 0) || 0));
  let tokenSide = 0;
  if (
    price != null &&
    price > 0 &&
    price < 1e12 &&
    quoteNet > 0n &&
    Number.isFinite(price)
  ) {
    const quote = rawToDec(quoteNet, dec);
    if (Number.isFinite(quote) && quote > 0) {
      const ts = quote * price;
      if (
        Number.isFinite(ts) &&
        ts > 0 &&
        ts <= ergSide * TVL_TOKEN_SIDE_MAX_RATIO
      ) {
        tokenSide = ts;
      }
    }
  }
  const tvlErg = ergSide + tokenSide;
  return {
    tvlErg: Number.isFinite(tvlErg) ? tvlErg : ergSide,
    ergSide,
    tokenSide,
  };
}

export type T2tTvlInput = {
  amountA: number | bigint | string | null;
  decimalsA?: number | null;
  priceErgA?: number | null;
  amountB: number | bigint | string | null;
  decimalsB?: number | null;
  priceErgB?: number | null;
};

export type T2tTvlParts = {
  tvlErg: number;
  sideA: number;
  sideB: number;
};

function tokenSideErg(
  raw: unknown,
  decimals: number | null | undefined,
  price: number | null | undefined
): number {
  if (price == null || !(price > 0) || price >= 1e12 || !Number.isFinite(price)) return 0;
  const qty = rawToDec(
    asInt(raw),
    Math.max(0, Math.min(18, Number(decimals ?? 0) || 0))
  );
  if (!(qty > 0) || !Number.isFinite(qty)) return 0;
  const v = qty * price;
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Honest T2T TVL in ERG: each reserve × that token's N2T last-fill ERG price.
 * Box nano is rent, not liquidity — do not add it. Missing price → that side 0.
 * If one priced side is > 8× the other, drop the expensive side.
 */
export function t2tTvlErg(input: T2tTvlInput): T2tTvlParts {
  let sideA = tokenSideErg(input.amountA, input.decimalsA, input.priceErgA);
  let sideB = tokenSideErg(input.amountB, input.decimalsB, input.priceErgB);
  if (sideA > 0 && sideB > 0) {
    const hi = Math.max(sideA, sideB);
    const lo = Math.min(sideA, sideB);
    if (hi > lo * TVL_TOKEN_SIDE_MAX_RATIO) {
      if (sideA > sideB) sideA = 0;
      else sideB = 0;
    }
  }
  const tvlErg = sideA + sideB;
  return {
    tvlErg: Number.isFinite(tvlErg) ? tvlErg : 0,
    sideA,
    sideB,
  };
}
