import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTxShape, pickTxLock, txTapeFields } from "@ergoscan/shared";
import { en } from "./i18n/en";
import { lockCaption } from "./tx-lock";
import fixtures from "./tx-tape-live.fixtures.json";

type Box = {
  address?: string | null;
  assets?: Array<{ tokenId?: string; amount?: string }>;
};

type LiveTx = {
  id: string;
  height: number;
  index: number | null;
  storedShape: string;
  storedProtocol: string | null;
  inputs: Box[];
  outputs: Box[];
};

const PROTOCOL = new Set(["miner-fee", "emission", "miner-reward"]);
const SHAPES = new Set([
  "coinbase",
  "fee-collect",
  "reward-unlock",
  "transfer",
  "token",
  "contract",
  "script-pay",
]);

function t(k: string): string {
  return en[k] ?? k;
}

function paint(row: LiveTx) {
  const actual = classifyTxShape({
    coinbase: row.index === 0,
    inputs: row.inputs,
    outputs: row.outputs,
  });
  const tape = txTapeFields(actual.shape, actual.protocol);
  const lock = pickTxLock({ inputs: row.inputs, outputs: row.outputs });
  const overlayId = lock?.id ?? tape.platform;
  const catKey = `tx.cat.${tape.category}`;
  const chip = t(catKey) !== catKey ? t(catKey) : tape.category;
  const overlay = lockCaption(overlayId, t);
  const shown = overlay && overlay !== chip ? `${chip} · ${overlay}` : chip;
  return { actual, tape, chip, overlay, shown, lock };
}

const rows = fixtures as LiveTx[];
assert.equal(rows.length, 20);

for (const row of rows) {
  const short = row.id.slice(0, 8);
  const preview = paint(row);
  test(`#${short} shows "${preview.shown}" — I/O is ${preview.actual.shape}`, () => {
    const { actual, tape, chip, overlay, shown, lock } = paint(row);

    assert.ok(SHAPES.has(actual.shape), `${short} actual ${actual.shape}`);
    assert.equal(tape.category, actual.shape);
    assert.equal(tape.category, actual.category);
    assert.ok(!PROTOCOL.has(tape.category), `${short} chip leaked protocol`);

    const storedPaint = txTapeFields(row.storedShape, row.storedProtocol);
    assert.ok(!PROTOCOL.has(storedPaint.category), `${short} stored path leaked protocol`);

    assert.equal(chip, t(`tx.cat.${actual.shape}`));
    if (actual.protocol && !lock) {
      assert.equal(overlay, t(`tx.protocol.${actual.protocol}`));
    }
    if (row.storedShape !== actual.shape) {
      assert.notEqual(
        chip,
        t(`tx.cat.${row.storedShape}`),
        `${short} must not show stale ${row.storedShape}`
      );
    }

    assert.equal(shown, preview.shown);
    assert.ok(!shown.includes("miner-fee"));
    assert.ok(!shown.toLowerCase().startsWith("emission ·"));
  });
}
