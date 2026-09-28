import {
  RENT_TAPE_COLOR,
  SHAPE_COLORS,
  classifyTxShape,
  type RentTapeCategory,
  type ShapeBox,
} from "@ergoscan/shared";

type PaintableTx = {
  indexInBlock?: number | null;
  category: string;
  shape?: string;
  protocol?: string | null;
  /** Writer mark. Survives the I/O shape repaint. */
  rent?: string | null;
  /** Gateway: false when box_assets timed out. Do not guess token vs transfer. */
  assetsComplete?: boolean;
  inputs?: unknown[];
  outputs?: unknown[];
  ball?: {
    feeRate: number;
    inputCount: number;
    outputCount: number;
    platform?: string;
    color?: string;
    category?: string;
  };
};

function rentCategory(raw: string | null | undefined): RentTapeCategory | null {
  return raw === "rent" || raw === "rent-renew" ? raw : null;
}

function applyRentMark<T extends PaintableTx>(snap: T, painted: T): T {
  const rent = rentCategory(snap.rent);
  if (!rent) return painted;
  const color = RENT_TAPE_COLOR[rent];
  return {
    ...painted,
    category: rent,
    rent,
    ball: painted.ball
      ? { ...painted.ball, category: rent, color }
      : painted.ball,
  };
}

/** Paint v4 from resolved I/O so a stale gateway/index shape cannot hide fee-collect. */
export function paintTxSnapshot<T extends PaintableTx>(snap: T): T {
  if (snap.assetsComplete === false) return applyRentMark(snap, snap);
  const inputs = (snap.inputs ?? []) as ShapeBox[];
  const outputs = (snap.outputs ?? []) as ShapeBox[];
  const shaped = classifyTxShape({
    coinbase: snap.indexInBlock === 0,
    inputs,
    outputs,
  });
  return applyRentMark(snap, {
    ...snap,
    category: shaped.category,
    shape: shaped.shape,
    protocol: shaped.protocol,
    ball: snap.ball
      ? {
          ...snap.ball,
          category: shaped.category,
          color: SHAPE_COLORS[shaped.category] ?? snap.ball.color,
        }
      : snap.ball,
  });
}
