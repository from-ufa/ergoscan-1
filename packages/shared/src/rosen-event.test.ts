import assert from "node:assert/strict";
import { test } from "node:test";
import {
  eventIdFromSourceTx,
  extractEventFromRegisters,
  extractWidsCount,
  formatRosenAmount,
  parseCollCollByte,
  paymentTxIdFromRegisters,
  resolveRosenTokenDisplay,
} from "./rosen-event.js";
import { lookupRosenToken } from "./rosen-tokens.js";
import { isRosenTriggerAddress, ROSEN_TRIGGER_ADDRESSES } from "./rosen-chains.js";
import { ROSEN_HISTORY_TRIGGERS } from "./rosen-history.js";

function vlq(n: number): number[] {
  const out: number[] = [];
  let x = n;
  while (x >= 0x80) {
    out.push((x & 0x7f) | 0x80);
    x >>= 7;
  }
  out.push(x);
  return out;
}

function encBytes(bytes: Uint8Array): number[] {
  return [...vlq(bytes.length), ...bytes];
}

function utf(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function be(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array([0]);
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function hexOf(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function collColl(parts: Uint8Array[]): string {
  const body = [...vlq(parts.length)];
  for (const p of parts) body.push(...encBytes(p));
  return hexOf([0x0c, 0x0e, ...body]);
}

const SAMPLE = [
  utf("8e9bb9615880cac964f2c2b87319f6eb15390289afd73b199af2a37c92cad4cf"),
  utf("ergo"),
  utf("cardano"),
  utf("9eYh7EPyDThRJFqMYuRT6rzzd4h7ptDZS3ZJhKNG2rmKreeVbG3"),
  utf("addr1q85fh9t2cn7j8g62te545uyayjtlc7cwl9df50dugpe78r5d9z85ctlucfs"),
  be(100000000000n),
  be(6097560976n),
  be(1457241464n),
  utf("erg"),
  utf("erg"),
  utf("source-block"),
  be(1160698n),
];

test("parse Coll[Coll[Byte]] 0c0e", () => {
  const hex = collColl(SAMPLE);
  const slots = parseCollCollByte(hex);
  assert.ok(slots);
  assert.equal(slots.length, 12);
  assert.equal(new TextDecoder().decode(slots[1]!), "ergo");
  assert.equal(new TextDecoder().decode(slots[2]!), "cardano");
});

test("extract event from node-style registers", () => {
  const hex = collColl(SAMPLE);
  const ev = extractEventFromRegisters({
    R4: "0e20" + "ab".repeat(32),
    R5: hex,
    R7: "0416",
  });
  assert.ok(ev);
  assert.equal(ev.fromChain, "ergo");
  assert.equal(ev.toChain, "cardano");
  assert.equal(ev.amount, "100000000000");
  assert.equal(ev.bridgeFee, "6097560976");
  assert.equal(ev.networkFee, "1457241464");
  assert.equal(ev.sourceChainTokenId, "erg");
  assert.equal(ev.sourceChainHeight, 1160698);
  assert.equal(ev.eventId, eventIdFromSourceTx(ev.sourceTxId));
  assert.equal(ev.eventId.length, 64);
});

test("1a type prefix also parses", () => {
  const with0c0e = collColl(SAMPLE);
  const with1a = "1a" + with0c0e.slice(4);
  assert.equal(parseCollCollByte(with1a)?.length, 12);
});

test("payment tx id utf8 or empty → spend tx", () => {
  const dest = new TextEncoder().encode("e2dea69feb61101d926ed2a3aeeb62b0");
  const hex = hexOf([0x0e, dest.length, ...dest]);
  assert.equal(paymentTxIdFromRegisters({ R4: hex }, "spend"), "e2dea69feb61101d926ed2a3aeeb62b0");
  assert.equal(paymentTxIdFromRegisters({ R4: "0e00" }, "spend-tx"), "spend-tx");
});

test("history set includes 1.0.0 soft-launch and current 7.0.0 triggers", () => {
  const first = ROSEN_HISTORY_TRIGGERS[0];
  assert.ok(first?.startsWith("21oSXp"));
  assert.equal(isRosenTriggerAddress(first), true);
  assert.ok(ROSEN_TRIGGER_ADDRESSES.length >= 19);
});

test("formatRosenAmount keeps the integer string", () => {
  assert.equal(formatRosenAmount("100000000000", 9), "100");
  assert.equal(formatRosenAmount("500000000", 6), "500");
  assert.equal(formatRosenAmount("1", 9), "0.000000001");
  assert.equal(formatRosenAmount("0", 9), "0");
  assert.equal(formatRosenAmount("60000000000", 8), "600");
});

test("official 7.1.1 natives and Cardano aliases", () => {
  assert.equal(lookupRosenToken("firo", "firo")?.decimals, 8);
  assert.equal(lookupRosenToken("firo", "firo")?.name, "FIRO");
  assert.equal(lookupRosenToken("cardano", "lovelace")?.name, "ADA");
  assert.equal(lookupRosenToken("cardano", "lovelace")?.decimals, 6);
  assert.equal(lookupRosenToken("cardano", "ada")?.decimals, 6);
  assert.equal(lookupRosenToken("ergo", "erg")?.decimals, 9);
  assert.equal(lookupRosenToken("bitcoin", "btc")?.decimals, 8);
  assert.equal(lookupRosenToken("ethereum", "eth")?.decimals, 18);
  assert.equal(lookupRosenToken("binance", "bnb")?.decimals, 18);
  assert.equal(lookupRosenToken("doge", "doge")?.decimals, 8);
  assert.equal(
    lookupRosenToken("cardano", "asset17q7r59zlc3dgw0venc80pdv566q6yguw03f0d9")?.name,
    "HOSKY"
  );
  assert.equal(
    lookupRosenToken("ethereum", "0x2744ea5ac9b11cb5e3cd63d3a88e858336aeddc2")?.name,
    "rsFIRO"
  );
  const firo = resolveRosenTokenDisplay("firo", "firo", null, null);
  assert.equal(firo.decimals, 8);
  assert.equal(formatRosenAmount("60000000000", firo.decimals ?? 0), "600");
});

test("R7 sigma watchers 0430 → 24", () => {
  assert.equal(extractWidsCount({ R7: "0430" }), 24);
  assert.equal(extractWidsCount({ R7: "0476" }), 59);
});
