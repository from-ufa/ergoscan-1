import { isFeeAddress } from "./address-book";
import { toBigIntAmt } from "./format";
import {
  addressFlow,
  markFeeOutputIndexes,
  settlement,
  type AddrFlowKind,
  type TxIo,
} from "./tx-flow";

export const TX_EXPLANATION_VERSION = 1;

export type TxEvidenceSource = "index" | "ram";
export type TxIoCoverage = "complete" | "partial" | "unknown";
export type FeeEvidence = "contract" | "reported-output" | "candidate" | "reported";

export type TxTokenChange = {
  tokenId: string;
  inAmt: bigint;
  outAmt: bigint;
  kind: "mint" | "burn" | "changed";
};

export type TxSelfFlow = {
  address: string;
  kind: AddrFlowKind;
  erg: bigint;
};

export type TxExplanation = {
  version: typeof TX_EXPLANATION_VERSION;
  source: TxEvidenceSource;
  confirmed: boolean;
  shape: string;
  protocolHint: string | null;
  coverage: TxIoCoverage;
  actualInputs: number;
  actualOutputs: number;
  resolvedInputs: number;
  resolvedOutputs: number;
  declaredInputs: number | null;
  declaredOutputs: number | null;
  feeNano: bigint;
  feeRateNanoPerByte: number | null;
  feeOutputCount: number;
  feeEvidence: FeeEvidence;
  nonFeeOutputNano: bigint;
  inputAddressCount: number;
  outputAddressCount: number;
  selfFlows: TxSelfFlow[];
  tokenChanges: TxTokenChange[];
  dataInputCount: number;
  limits: ("partial-io" | "unknown-io-coverage" | "unresolved-io")[];
};

export type ExplainableTx = {
  confirmed: boolean;
  source?: string | null;
  size?: number | null;
  fee?: number | string | bigint | null;
  category?: string | null;
  shape?: string | null;
  protocolHint?: string | null;
  inputCount?: number | null;
  outputCount?: number | null;
  assetsComplete?: boolean | null;
  inputs?: TxIo[];
  outputs?: TxIo[];
  dataInputs?: TxIo[];
};

function declaredCount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null;
}

function addressCount(items: TxIo[], feeIndexes?: Set<number>): number {
  const addresses = new Set<string>();
  items.forEach((item, index) => {
    if (feeIndexes?.has(index) || isFeeAddress(item.address)) return;
    if (item.address) addresses.add(item.address);
  });
  return addresses.size;
}

function ioResolved(item: TxIo): boolean {
  return item.value != null && Array.isArray(item.assets);
}

function feeEvidence(
  outputs: TxIo[],
  feeIndexes: Set<number>,
  reportedFee: bigint
): FeeEvidence {
  if (outputs.some((output) => isFeeAddress(output.address))) return "contract";
  if (
    reportedFee > 0n &&
    outputs.some(
      (output) =>
        (output.assets?.length ?? 0) === 0 &&
        toBigIntAmt(output.value) === reportedFee
    )
  ) {
    return "reported-output";
  }
  return feeIndexes.size ? "candidate" : "reported";
}

/**
 * Deterministic explanation facts assembled from the tx response only.
 * It never guesses intent, a swap side, or script semantics.
 */
export function explainTransaction(input: ExplainableTx): TxExplanation {
  const inputs = input.inputs ?? [];
  const outputs = input.outputs ?? [];
  const declaredInputs = declaredCount(input.inputCount);
  const declaredOutputs = declaredCount(input.outputCount);
  const resolvedInputs = inputs.filter(ioResolved).length;
  const resolvedOutputs = outputs.filter(ioResolved).length;
  const countPartial =
    (declaredInputs != null && declaredInputs > inputs.length) ||
    (declaredOutputs != null && declaredOutputs > outputs.length);
  const unresolvedIo =
    input.assetsComplete === false ||
    resolvedInputs < inputs.length ||
    resolvedOutputs < outputs.length;
  const coverage: TxIoCoverage = countPartial || unresolvedIo
    ? "partial"
    : declaredInputs != null && declaredOutputs != null
      ? "complete"
      : "unknown";

  const reportedFee = toBigIntAmt(input.fee);
  const feeIndexes = markFeeOutputIndexes(outputs, reportedFee);
  const feeFromBoxes = outputs.reduce(
    (sum, output, index) =>
      feeIndexes.has(index) ? sum + toBigIntAmt(output.value) : sum,
    0n
  );
  const feeNano = reportedFee > 0n ? reportedFee : feeFromBoxes;
  const nonFeeOutputNano = outputs.reduce(
    (sum, output, index) =>
      feeIndexes.has(index) ? sum : sum + toBigIntAmt(output.value),
    0n
  );

  const inputAddresses = new Set(
    inputs
      .map((item) => item.address)
      .filter((address): address is string => Boolean(address) && !isFeeAddress(address))
  );
  const outputAddresses = new Set(
    outputs
      .map((item, index) => (feeIndexes.has(index) ? null : item.address))
      .filter((address): address is string => Boolean(address) && !isFeeAddress(address))
  );
  const selfFlows = [...inputAddresses]
    .filter((address) => outputAddresses.has(address))
    .map((address) => {
      const flow = addressFlow(address, inputs, outputs, feeNano);
      return flow ? { address, kind: flow.kind, erg: flow.erg } : null;
    })
    .filter((flow): flow is TxSelfFlow => flow != null);

  const tokenChanges: TxTokenChange[] =
    coverage === "complete"
      ? settlement(inputs, outputs)
          .filter((line) => line.tokenId != null && line.kind !== "pass")
          .map((line) => {
            const tokenId = line.tokenId as string;
            const validMint =
              line.kind === "mint" &&
              inputs.some(
                (item) => item.boxId?.toLowerCase() === tokenId.toLowerCase()
              );
            return {
              tokenId,
              inAmt: line.inAmt,
              outAmt: line.outAmt,
              kind: validMint
                ? "mint"
                : line.kind === "burn"
                  ? "burn"
                  : "changed",
            };
          })
      : [];

  const size =
    typeof input.size === "number" && Number.isFinite(input.size) && input.size > 0
      ? input.size
      : null;
  const limits: TxExplanation["limits"] = [];
  if (coverage === "partial") limits.push("partial-io");
  if (coverage === "unknown") limits.push("unknown-io-coverage");
  if (unresolvedIo) limits.push("unresolved-io");
  const rentChip =
    input.category === "rent" || input.category === "rent-renew" ? input.category : null;
  const observedShape = rentChip || input.shape || input.category || "unknown";

  return {
    version: TX_EXPLANATION_VERSION,
    source:
      !input.confirmed || input.source?.toLowerCase() === "mempool" ? "ram" : "index",
    confirmed: input.confirmed,
    shape: rentChip ?? (coverage === "complete" ? observedShape : "unknown"),
    protocolHint: input.protocolHint || null,
    coverage,
    actualInputs: inputs.length,
    actualOutputs: outputs.length,
    resolvedInputs,
    resolvedOutputs,
    declaredInputs,
    declaredOutputs,
    feeNano,
    feeRateNanoPerByte: size != null && feeNano > 0n ? Number(feeNano) / size : null,
    feeOutputCount: feeIndexes.size,
    feeEvidence: feeEvidence(outputs, feeIndexes, reportedFee),
    nonFeeOutputNano,
    inputAddressCount: addressCount(inputs),
    outputAddressCount: addressCount(outputs, feeIndexes),
    selfFlows,
    tokenChanges,
    dataInputCount: input.dataInputs?.length ?? 0,
    limits,
  };
}
