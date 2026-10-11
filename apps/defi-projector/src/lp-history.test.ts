import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyLpStep,
  droppedSwapEvents,
  lpEventsFromBoxes,
  resolveBoxHeight,
  type LpBox,
} from "./lp-history.js";

function box(part: Partial<LpBox> & Pick<LpBox, "creationTx">): LpBox {
  return {
    creationTx: part.creationTx,
    spentTx: part.spentTx ?? null,
    height: part.height ?? 1,
    tsMs: part.tsMs ?? part.height ?? 1,
    erg: part.erg ?? 0n,
    quote: part.quote ?? 0n,
    base: part.base ?? 0n,
    lp: part.lp ?? 0n,
  };
}

test("box height comes from the transaction when the box stored zero", () => {
  assert.equal(resolveBoxHeight(0, 778875), 778875);
  assert.equal(resolveBoxHeight(756645, 0), 756645);
  assert.equal(resolveBoxHeight(0, 0), 0);
});

test("CFMM birth, a later deposit, a withdraw, and a swap stays out", () => {
  const events = lpEventsFromBoxes("spectrum_cfmm", [
    box({ creationTx: "aa", spentTx: "bb", height: 100, quote: 10n, erg: 100n }),
    box({ creationTx: "bb", spentTx: "cc", height: 200, quote: 15n, erg: 150n }),
    box({ creationTx: "cc", spentTx: "dd", height: 300, quote: 12n, erg: 120n }),
    box({ creationTx: "dd", height: 400, quote: 20n, erg: 80n }),
    box({ creationTx: "zz", height: 250, quote: 99n, erg: 999n }),
  ]);
  assert.deepEqual(
    events.map((ev) => [ev.txId, ev.kind, ev.tokenRaw, ev.baseRaw]),
    [
      ["aa", "mint", 10n, 100n],
      ["bb", "mint", 5n, 50n],
      ["cc", "redeem", 3n, 30n],
    ]
  );
});

test("a large sell is a dropped swap, a small one and a deposit are not", () => {
  const events = droppedSwapEvents("spectrum_cfmm", [
    box({ creationTx: "aa", spentTx: "bb", height: 10, quote: 8_772_587_302n, erg: 234_922_000n }),
    box({ creationTx: "bb", spentTx: "cc", height: 20, quote: 32_995_872_039n, erg: 62_921_000n }),
    box({ creationTx: "cc", height: 30, quote: 32_990_000_000n, erg: 63_000_000n }),
    box({ creationTx: "zz", spentTx: "yy", height: 40, quote: 1000n, erg: 1000n }),
    box({ creationTx: "yy", height: 50, quote: 2000n, erg: 2000n }),
  ]);
  assert.deepEqual(
    events.map((ev) => [ev.txId, ev.side, ev.tokenRaw, ev.baseRaw]),
    [["bb", "sell", 24_223_284_737n, 172_001_000n]]
  );
});

test("N2N deposit sends LP out and withdraw brings it back", () => {
  assert.equal(classifyLpStep("spectrum_n2n", 5n, 10n, -1n), "mint");
  assert.equal(classifyLpStep("spectrum_n2n", -5n, -10n, 1n), "redeem");
  assert.equal(classifyLpStep("spectrum_n2n", 5n, 10n, 1n), null);
  assert.equal(classifyLpStep("spectrum_n2n", 5n, -10n, 0n), null);
  const events = lpEventsFromBoxes("spectrum_n2n", [
    box({ creationTx: "aa", spentTx: "bb", height: 10, quote: 10n, base: 20n, lp: 1000n }),
    box({ creationTx: "bb", spentTx: "cc", height: 20, quote: 15n, base: 30n, lp: 900n }),
    box({ creationTx: "cc", height: 30, quote: 12n, base: 22n, lp: 950n }),
  ]);
  assert.deepEqual(
    events.map((ev) => ev.kind),
    ["mint", "mint", "redeem"]
  );
  assert.equal(events[1]?.tokenRaw, 5n);
  assert.equal(events[2]?.baseRaw, 8n);
});
