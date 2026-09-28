/** Mainnet Autolykos emission in nanoERG. Same constants as indexer snapshots. */
const FIXED_PERIOD = 525_600;
const EPOCH = 64_800;
const FIXED = 75_000_000_000n;
const STEP = 3_000_000_000n;

/** EIP-27 mainnet. */
const EIP27_ACTIVATION = 777_217;
const REEMISSION_START = 2_080_800;
const MINER_FLOOR = 3_000_000_000n;
const REEMISSION_HIGH_CUT = 12_000_000_000n;
const REEMISSION_HIGH_FROM = 15_000_000_000n;

export function emissionAtHeight(height: number): bigint {
  if (!Number.isFinite(height) || height < 1) return 0n;
  if (height <= FIXED_PERIOD) return FIXED;
  const epoch = Math.floor((height - FIXED_PERIOD) / EPOCH);
  const rate = FIXED - STEP * BigInt(epoch + 1);
  return rate > 0n ? rate : 0n;
}

/**
 * What the miner keeps from scheduled emission (not fees).
 * EIP-27: if R ≥ 15 ERG send 12 to re-emission; else send R − 3.
 * From height 2,080,800 the contract pays a flat 3 ERG.
 */
export function minerEmissionAtHeight(height: number): bigint {
  if (!Number.isFinite(height) || height < 1) return 0n;
  if (height >= REEMISSION_START) return MINER_FLOOR;
  const r = emissionAtHeight(height);
  if (height < EIP27_ACTIVATION) return r;
  if (r >= REEMISSION_HIGH_FROM) return r - REEMISSION_HIGH_CUT;
  return r > MINER_FLOOR ? MINER_FLOOR : r;
}

/**
 * EIP-27 circulating at height: miner-keep from scheduled emission (re-emission
 * cut stays locked). Matches explorer `/api/v0/info.supply` in whole ERG.
 */
export function circulatingNanoAtHeight(height: number): bigint {
  if (!Number.isFinite(height) || height < 1) return 0n;
  const H = Math.floor(height);
  let nano = 0n;
  let h = 1;
  while (h <= H) {
    const keep = minerEmissionAtHeight(h);
    if (keep <= 0n) break;
    let runEnd: number;
    if (h <= FIXED_PERIOD) runEnd = FIXED_PERIOD;
    else if (h >= REEMISSION_START) runEnd = H;
    else {
      const epoch = Math.floor((h - FIXED_PERIOD) / EPOCH);
      runEnd = FIXED_PERIOD + (epoch + 1) * EPOCH - 1;
    }
    if (h < EIP27_ACTIVATION && runEnd >= EIP27_ACTIVATION) runEnd = EIP27_ACTIVATION - 1;
    if (h < REEMISSION_START && runEnd >= REEMISSION_START) runEnd = REEMISSION_START - 1;
    runEnd = Math.min(runEnd, H);
    nano += keep * BigInt(runEnd - h + 1);
    h = runEnd + 1;
  }
  return nano;
}

export function circulatingErgAtHeight(height: number): number | null {
  const nano = circulatingNanoAtHeight(height);
  if (nano <= 0n) return null;
  const erg = nano / 1_000_000_000n;
  if (erg > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(erg);
}

export const ERGO_EPOCH_LEN = 1024;

/** Mainnet voted max block size (bytes). Ergo docs current network settings. */
export const ERGO_MAX_BLOCK_SIZE = 1_271_009;
