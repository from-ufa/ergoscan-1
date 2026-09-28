import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addrTapeHasMore,
  holderKeysetCursor,
  mergeById,
  rankWindowNav,
  txKeysetCursor,
} from "./rank-window";

test("page mode: total enables scrub and of-range, hides one page", () => {
  const bar = rankWindowNav({
    mode: "page",
    offset: 0,
    pageSize: 25,
    shown: 25,
    total: 100,
  });
  assert.equal(bar.from, 1);
  assert.equal(bar.to, 25);
  assert.equal(bar.canPrev, false);
  assert.equal(bar.canNext, true);
  assert.equal(bar.canScrub, true);
  assert.equal(bar.hide, false);

  const one = rankWindowNav({
    mode: "page",
    offset: 0,
    pageSize: 25,
    shown: 10,
    total: 10,
  });
  assert.equal(one.hide, true);
  assert.equal(one.canScrub, false);
});

test("page mode: null total follows hasMore, not shown >= pageSize", () => {
  const more = rankWindowNav({
    mode: "page",
    offset: 0,
    pageSize: 25,
    shown: 25,
    total: null,
    hasMore: true,
  });
  assert.equal(more.hide, false);
  assert.equal(more.canNext, true);
  assert.equal(more.canScrub, false);

  const end = rankWindowNav({
    mode: "page",
    offset: 0,
    pageSize: 25,
    shown: 10,
    total: null,
    hasMore: false,
  });
  assert.equal(end.hide, true);
  assert.equal(end.canNext, false);
});

test("loaded mode: hide ignores disabled so the bar stays while the next pack loads", () => {
  const pending = rankWindowNav({
    mode: "loaded",
    offset: 0,
    pageSize: 25,
    shown: 25,
    total: 394548,
    hasMore: true,
    disabled: true,
  });
  assert.equal(pending.hide, false);
  assert.equal(pending.canNext, false);
  assert.equal(pending.moreAhead, true);
});

test("loaded mode: 1–shown of total, next from hasMore, no scrub", () => {
  const first = rankWindowNav({
    mode: "loaded",
    offset: 0,
    pageSize: 25,
    shown: 25,
    total: 394548,
    hasMore: true,
  });
  assert.equal(first.from, 1);
  assert.equal(first.to, 25);
  assert.equal(first.canPrev, false);
  assert.equal(first.canNext, true);
  assert.equal(first.canScrub, false);
  assert.equal(first.hide, false);

  const appended = rankWindowNav({
    mode: "loaded",
    offset: 0,
    pageSize: 25,
    shown: 50,
    total: 394548,
    hasMore: true,
  });
  assert.equal(appended.from, 1);
  assert.equal(appended.to, 50);
  assert.equal(appended.canPrev, true);

  const done = rankWindowNav({
    mode: "loaded",
    offset: 0,
    pageSize: 25,
    shown: 25,
    total: 20,
    hasMore: false,
  });
  assert.equal(done.hide, true);
  assert.equal(done.canNext, false);

  const staleFlag = rankWindowNav({
    mode: "loaded",
    offset: 0,
    pageSize: 25,
    shown: 25,
    total: 394548,
    hasMore: false,
  });
  assert.equal(staleFlag.hide, false);
  assert.equal(staleFlag.canNext, true);
});

test("page mode scrub false: 26–50 of total, no OFFSET jump", () => {
  const first = rankWindowNav({
    mode: "page",
    scrub: false,
    offset: 0,
    pageSize: 25,
    shown: 25,
    total: 394548,
    hasMore: true,
  });
  assert.equal(first.from, 1);
  assert.equal(first.to, 25);
  assert.equal(first.canPrev, false);
  assert.equal(first.canNext, true);
  assert.equal(first.canScrub, false);
  assert.equal(first.hide, false);

  const page2 = rankWindowNav({
    mode: "page",
    scrub: false,
    offset: 25,
    pageSize: 25,
    shown: 25,
    total: 394548,
    hasMore: true,
  });
  assert.equal(page2.from, 26);
  assert.equal(page2.to, 50);
  assert.equal(page2.canPrev, true);
  assert.equal(page2.canScrub, false);
});

test("mergeById appends new ids only", () => {
  assert.deepEqual(
    mergeById([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]),
    [{ id: "a" }, { id: "b" }, { id: "c" }]
  );
  const same = [{ id: "a" }];
  assert.equal(mergeById(same, [{ id: "a" }]), same);
});

test("txKeysetCursor matches gateway height:id", () => {
  assert.equal(
    txKeysetCursor({ id: "ab", inclusionHeight: 10 }),
    "10:ab"
  );
  assert.equal(txKeysetCursor({ id: "ab", inclusionHeight: null }), "-1:ab");
  assert.equal(txKeysetCursor(undefined), null);
});

test("holderKeysetCursor matches gateway amount|address", () => {
  assert.equal(
    holderKeysetCursor({ address: "9abc", amount: "95468683" }),
    "95468683|9abc"
  );
  assert.equal(holderKeysetCursor({ address: "9abc", amount: 12 }), "12|9abc");
  assert.equal(holderKeysetCursor({ address: "9abc" }), null);
  assert.equal(holderKeysetCursor(undefined), null);
});

test("addrTapeHasMore follows the counter when hasMore is stale false", () => {
  assert.equal(addrTapeHasMore(25, 394548, false), true);
  assert.equal(addrTapeHasMore(25, 25, false), false);
  assert.equal(addrTapeHasMore(25, 25, true), true);
});
