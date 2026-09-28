import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MINERS_FEE_ADDRESS,
  RENT_TAPE_COLOR,
  SHAPE_COLORS,
  TX_SHAPE_RULES_VERSION,
  classifyTxShape,
  minerFeeFromOutputs,
  txListPaint,
  rentTapePaint,
  txTapeFields,
} from "./tx-shape.js";

const p2pk = { address: `9${"x".repeat(51)}` };
const script = { address: `2${"A".repeat(51)}` };
const lock88 = { address: `88${"a".repeat(50)}` };
const fee = { address: MINERS_FEE_ADDRESS };
const tok = [{ tokenId: "aa".repeat(32), amount: "1" }];
const emission = {
  address:
    "2Z4YBkDsDvQj8BX7xiySFewjitqp2ge9c99jfes2whbtKitZTxdBYqbrVZUvZvKv6aqn9by4kp3LE1c26LCyosFnVnm6b6U1JYvWpYmL2ZnixJbXLjWAWuBThV1D6dLpqZJYQHYDznJCk49g5TUiS4q8khpag2aNmHwREV7JSsypHdHLgJT7MGaw51aJfNubyzSKxZ4AJXFS27EfXwyCLzW1K6GVqwkJtCoPvrcLqmqwacAWJPkmh78nke9H4oT88XmSbRt2n9aWZjosiZCafZ4osUDxmZcc5QVEeTWn8drSraY3eFKe8Mu9MSCcVU",
};

test("v4 version and protocol stay null on a plain transfer", () => {
  const r = classifyTxShape({ inputs: [p2pk], outputs: [p2pk, fee] });
  assert.equal(TX_SHAPE_RULES_VERSION, 4);
  assert.equal(r.rulesVersion, 4);
  assert.equal(r.protocol, null);
  assert.equal(r.shape, "transfer");
});

test("P2PK to P2PK is transfer", () => {
  const r = classifyTxShape({ inputs: [p2pk], outputs: [p2pk, fee] });
  assert.equal(r.shape, "transfer");
  assert.equal(r.category, "transfer");
});

test("P2PK to script is script-pay, not contract", () => {
  const r = classifyTxShape({ inputs: [p2pk], outputs: [script, fee] });
  assert.equal(r.shape, "script-pay");
  assert.notEqual(r.shape, "contract");
  const paint = txListPaint(r);
  assert.equal(paint.category, "script-pay");
  assert.equal(paint.color, SHAPE_COLORS["script-pay"]);
});

test("script spend is contract", () => {
  const r = classifyTxShape({ inputs: [script], outputs: [p2pk, fee] });
  assert.equal(r.shape, "contract");
});

test("token without script input is token", () => {
  const r = classifyTxShape({
    inputs: [{ ...p2pk, assets: tok }],
    outputs: [{ ...p2pk, assets: tok }, fee],
  });
  assert.equal(r.shape, "token");
});

test("P2PK to script with tokens is token, not script-pay", () => {
  const r = classifyTxShape({
    inputs: [{ ...p2pk, assets: tok }],
    outputs: [{ ...script, assets: tok }, fee],
  });
  assert.equal(r.shape, "token");
});

test("script spend with tokens stays contract", () => {
  const r = classifyTxShape({
    inputs: [{ ...script, assets: tok }],
    outputs: [{ ...p2pk, assets: tok }, fee],
  });
  assert.equal(r.shape, "contract");
});

test("paying into an 88 reward lock is not contract", () => {
  const r = classifyTxShape({ inputs: [p2pk], outputs: [lock88, fee] });
  assert.notEqual(r.shape, "contract");
  assert.equal(r.shape, "transfer");
});

test("index-0 coinbase is reward", () => {
  const r = classifyTxShape({
    coinbase: true,
    inputs: [],
    outputs: [lock88, p2pk],
  });
  assert.equal(r.shape, "coinbase");
  assert.equal(r.ruleId, "shape:coinbase");
});

test("emission spend plus 88 payout is coinbase without the index flag", () => {
  const r = classifyTxShape({
    inputs: [emission],
    outputs: [emission, lock88],
  });
  assert.equal(r.shape, "coinbase");
  assert.equal(r.protocol, "emission");
  assert.equal(r.ruleId, "shape:coinbase-emission");
});

test("miner fee collection is not a transfer", () => {
  const r = classifyTxShape({
    inputs: [fee, fee],
    outputs: [lock88],
  });
  assert.equal(r.shape, "fee-collect");
  assert.equal(r.category, "fee-collect");
  assert.equal(r.protocol, "miner-fee");
  assert.equal(r.ruleId, "shape:fee-collect");
});

test("fee-collect wins over a stale coinbase flag", () => {
  const r = classifyTxShape({
    coinbase: true,
    inputs: [fee],
    outputs: [lock88],
  });
  assert.equal(r.shape, "fee-collect");
});

test("paying a fee is not fee collection", () => {
  const r = classifyTxShape({ inputs: [p2pk], outputs: [fee] });
  assert.equal(r.shape, "transfer");
});

test("solo 88 unlock to P2PK is reward-unlock", () => {
  const r = classifyTxShape({
    inputs: [lock88, lock88],
    outputs: [p2pk, fee],
  });
  assert.equal(r.shape, "reward-unlock");
  assert.equal(r.protocol, "miner-reward");
});

test("pool payout that mixes a hot wallet stays transfer", () => {
  const r = classifyTxShape({
    inputs: [lock88, p2pk],
    outputs: [p2pk, p2pk, fee],
  });
  assert.equal(r.shape, "transfer");
  assert.equal(r.protocol, null);
});

test("tape chip stays shape when protocol is set", () => {
  const r = classifyTxShape({
    inputs: [fee, fee],
    outputs: [lock88],
  });
  assert.equal(r.shape, "fee-collect");
  assert.equal(r.protocol, "miner-fee");
  const paint = txListPaint(r);
  assert.equal(paint.category, "fee-collect");
  assert.notEqual(paint.category, "miner-fee");
  assert.equal(paint.platform, "miner-fee");
  const tape = txTapeFields(r.shape, r.protocol);
  assert.equal(tape.category, "fee-collect");
  assert.equal(tape.platform, "miner-fee");
  assert.equal(tape.color, SHAPE_COLORS["fee-collect"]);
});

test("plain transfer tape has no overlay", () => {
  const r = classifyTxShape({ inputs: [p2pk], outputs: [p2pk, fee] });
  const tape = txTapeFields(r.shape, r.protocol);
  assert.equal(tape.category, "transfer");
  assert.equal(tape.platform, null);
});

test("rent tape is an overlay, not a shape hue", () => {
  const took = rentTapePaint(true, false);
  const renewed = rentTapePaint(false, true);
  const mixed = rentTapePaint(true, true);
  const none = rentTapePaint(false, false);
  assert.equal(took?.category, "rent");
  assert.equal(took?.color, RENT_TAPE_COLOR.rent);
  assert.equal(renewed?.category, "rent-renew");
  assert.equal(renewed?.color, RENT_TAPE_COLOR["rent-renew"]);
  assert.equal(mixed?.category, "rent");
  assert.equal(none, null);
  for (const color of Object.values(RENT_TAPE_COLOR)) {
    assert.equal(Object.values(SHAPE_COLORS).includes(color), false);
  }
});

test("txTapeFields never promotes protocol into category", () => {
  const tape = txTapeFields("fee-collect", "miner-fee");
  assert.equal(tape.category, "fee-collect");
  assert.notEqual(tape.category, "miner-fee");
});

test("miner fee is the fee-box output, not in minus out", () => {
  const n = minerFeeFromOutputs([
    { address: p2pk.address, value: 1_000_000_000 },
    { address: MINERS_FEE_ADDRESS, value: 1_100_000 },
  ]);
  assert.equal(n, 1_100_000);
});
