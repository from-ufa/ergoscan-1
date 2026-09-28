/**
 * Keep in lockstep with packages/shared/src/tx-shape.ts.
 * Indexer already depends on shared; re-export so rules cannot drift.
 */
export {
  MINERS_FEE_ADDRESS,
  MINERS_FEE_TREE,
  SHAPE_COLORS,
  TX_SHAPE_RULES_VERSION,
  asTxShape,
  classifyTxShape,
  isEmissionBox,
  isEmissionRewardTx,
  isFeeCollectTx,
  isMinerFeeBox,
  isMiningRewardLock,
  isP2pkBox,
  isRewardUnlockTx,
  isScriptBox,
  isShapeWhitelist,
  minerFeeFromOutputs,
  txListPaint,
  txTapeFields,
} from "@ergoscan/shared";
export type { ShapeBox, TxShape, TxShapeResult } from "@ergoscan/shared";
