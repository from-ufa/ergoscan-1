import { pickTxLock, type ShapeBox } from "@ergoscan/shared";

/** Translate a lock family or monetary protocol id. Unknown ids pass through. */
export function lockCaption(
  id: string | null | undefined,
  t: (k: string) => string
): string | null {
  if (!id) return null;
  for (const key of [`tx.lock.${id}`, `tx.protocol.${id}`]) {
    const loc = t(key);
    if (loc !== key) return loc;
  }
  return id;
}

export function lockIdFromIo(
  inputs: ShapeBox[],
  outputs: ShapeBox[],
  dataInputs?: ShapeBox[]
): string | null {
  return pickTxLock({ inputs, outputs, dataInputs })?.id ?? null;
}
