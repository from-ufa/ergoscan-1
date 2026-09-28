/**
 * Signed-tx gate before node POST /transactions.
 * Shape only — the node still checks proofs. Extra wallet fields are allowed.
 */
export const SUBMIT_PER_MIN = Math.max(1, Number(process.env.SUBMIT_PER_MIN ?? 10) || 10);
export const SUBMIT_INFLIGHT = Math.max(1, Number(process.env.SUBMIT_INFLIGHT ?? 2) || 2);

const HEX64 = /^[0-9a-fA-F]{64}$/;
const HEX = /^[0-9a-fA-F]*$/;
const MAX_IN = 512;
const MAX_DATA = 512;
const MAX_OUT = 1024;
const MAX_ASSETS = 128;
const MAX_TREE = 32_768;
const MAX_PROOF = 16_384;

type Ok = { ok: true };
type Bad = { ok: false; reason: string };

function obj(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function amount(v: unknown): boolean {
  if (typeof v === "number") return Number.isInteger(v) && Number.isFinite(v) && v >= 0;
  if (typeof v === "string") return /^\d+$/.test(v) && v.length >= 1 && v.length <= 24;
  return false;
}

function hex64(v: unknown): v is string {
  return typeof v === "string" && HEX64.test(v);
}

function hexStr(v: unknown, max: number, min = 0): v is string {
  return typeof v === "string" && v.length >= min && v.length <= max && v.length % 2 === 0 && HEX.test(v);
}

function assets(v: unknown): boolean {
  if (v == null) return true;
  if (!Array.isArray(v) || v.length > MAX_ASSETS) return false;
  for (const a of v) {
    if (!obj(a) || !hex64(a.tokenId) || !amount(a.amount)) return false;
  }
  return true;
}

function output(v: unknown): boolean {
  if (!obj(v)) return false;
  if (v.boxId != null && !hex64(v.boxId)) return false;
  if (!amount(v.value) || !hexStr(v.ergoTree, MAX_TREE, 2)) return false;
  if (typeof v.creationHeight !== "number" || !Number.isInteger(v.creationHeight) || v.creationHeight < 0) {
    return false;
  }
  if (!assets(v.assets)) return false;
  if (v.additionalRegisters != null && !obj(v.additionalRegisters)) return false;
  return true;
}

function signedInput(v: unknown): boolean {
  if (!obj(v) || !hex64(v.boxId)) return false;
  const proof = v.spendingProof;
  if (!obj(proof) || !hexStr(proof.proofBytes, MAX_PROOF, 0)) return false;
  if (proof.extension != null && !obj(proof.extension)) return false;
  return true;
}

function dataInput(v: unknown): boolean {
  return obj(v) && hex64(v.boxId);
}

export function validateSignedTx(body: unknown): Ok | Bad {
  if (!obj(body)) return { ok: false, reason: "JSON transaction object required" };
  if (body.id != null && !hex64(body.id)) return { ok: false, reason: "id must be 64-char hex" };
  const inputs = body.inputs;
  const outputs = body.outputs;
  const dataInputs = body.dataInputs;
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > MAX_IN) {
    return { ok: false, reason: "inputs must be a non-empty array" };
  }
  if (!Array.isArray(outputs) || outputs.length < 1 || outputs.length > MAX_OUT) {
    return { ok: false, reason: "outputs must be a non-empty array" };
  }
  if (dataInputs != null && (!Array.isArray(dataInputs) || dataInputs.length > MAX_DATA)) {
    return { ok: false, reason: "dataInputs must be an array" };
  }
  for (const i of inputs) {
    if (!signedInput(i)) return { ok: false, reason: "each input needs boxId and spendingProof" };
  }
  if (dataInputs) {
    for (const d of dataInputs) {
      if (!dataInput(d)) return { ok: false, reason: "each dataInput needs boxId" };
    }
  }
  for (const o of outputs) {
    if (!output(o)) return { ok: false, reason: "each output needs value, ergoTree, creationHeight" };
  }
  return { ok: true };
}

export type PublicSubmitFail = {
  error: "rejected" | "submit_failed";
  status: 400 | 502;
};

/** Map node/proxy failures to a stable client code. Raw Scorex text stays in the log. */
export function publicSubmitFail(e: unknown): PublicSubmitFail {
  const msg = String(e);
  const m = /\bnode (\d{3}) POST /.exec(msg);
  const code = m ? Number(m[1]) : 0;
  if (code >= 400 && code < 500) return { error: "rejected", status: 400 };
  return { error: "submit_failed", status: 502 };
}

export function logSubmitFail(e: unknown): void {
  console.warn("[gateway] submit", String(e).slice(0, 800));
}

export function isSubmitTxQuery(query: string): boolean {
  return /\bsubmitTx\s*\(/i.test(query);
}

type SlotRow = { n: number; reset: number; inflight: number };
const slots = new Map<string, SlotRow>();
const WINDOW_MS = 60_000;

export function resetSubmitLimiterForTests(): void {
  slots.clear();
}

export function requestIp(req: {
  headers: { [k: string]: string | string[] | undefined };
  socket: { remoteAddress?: string };
}): string {
  const raw = req.headers["x-forwarded-for"];
  const xff = Array.isArray(raw) ? raw[0] : raw;
  return xff?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

export function takeSubmitSlot(
  ip: string,
  perMin = SUBMIT_PER_MIN,
  inflightMax = SUBMIT_INFLIGHT
): { ok: true; release: () => void } | { ok: false; retryAfterSec: number; reason: "rate" | "inflight" } {
  const now = Date.now();
  let row = slots.get(ip);
  if (!row || now > row.reset) {
    row = { n: 0, reset: now + WINDOW_MS, inflight: 0 };
    slots.set(ip, row);
  }
  if (row.inflight >= inflightMax) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((row.reset - now) / 1000)), reason: "inflight" };
  }
  if (row.n >= perMin) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((row.reset - now) / 1000)), reason: "rate" };
  }
  row.n += 1;
  row.inflight += 1;
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      row.inflight = Math.max(0, row.inflight - 1);
    },
  };
}
