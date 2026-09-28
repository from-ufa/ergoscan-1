import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sceneCentroid,
  sceneCluster,
  sceneCouncilCap,
  sceneFromRects,
  sceneGatherDelay,
  sceneGridSlots,
  scenePinchIndex,
  sortSilentOldest,
  splitOracleLens,
} from "./oracle-scene";

test("centroid is the mean of the lattice", () => {
  assert.deepEqual(
    sceneCentroid([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ]),
    { x: 5, y: 5 }
  );
});

test("cluster keeps n points around the pinch", () => {
  const pts = sceneCluster(6, { x: 100, y: 40 }, 24);
  assert.equal(pts.length, 6);
  for (const p of pts) {
    assert.ok(Math.hypot(p.x - 100, p.y - 40) <= 24 + 1e-6);
  }
});

test("one-body cluster sits on the pinch", () => {
  assert.deepEqual(sceneCluster(1, { x: 10, y: 4 }, 24), [{ x: 10, y: 4 }]);
});

test("gather delay is longer for marks farther from the pinch", () => {
  const c = { x: 0, y: 0 };
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ];
  assert.equal(sceneGatherDelay(0, pts, c, 100), 0);
  assert.equal(sceneGatherDelay(1, pts, c, 100), 100);
});

test("council cap is 3 rows by the live column count", () => {
  assert.equal(sceneCouncilCap(4), 12);
  assert.equal(sceneCouncilCap(3), 9);
});

test("pinch sits on 2nd of 2nd row once there are more than 5", () => {
  assert.equal(scenePinchIndex(9, 4), 5);
  assert.equal(scenePinchIndex(6, 4), 5);
  assert.equal(scenePinchIndex(12, 4), 5);
  assert.equal(scenePinchIndex(7, 3), 4);
  assert.equal(scenePinchIndex(5, 4), 1);
  assert.equal(scenePinchIndex(1, 4), 0);
});

test("grid slots fill left-to-right from the cell centers", () => {
  const pts = sceneGridSlots(2, 2, { w: 200, h: 80 }, 36);
  assert.equal(pts.length, 2);
  assert.equal(pts[0]?.x, 50);
  assert.equal(pts[1]?.x, 150);
});

test("mark centers are wrap-relative", () => {
  const { box, pts } = sceneFromRects(
    { left: 10, top: 20, width: 100, height: 40 },
    [{ left: 10, top: 20, width: 20, height: 20 }]
  );
  assert.deepEqual(box, { w: 100, h: 40 });
  assert.deepEqual(pts, [{ x: 10, y: 10 }]);
});

test("lens split is live vs everyone else", () => {
  const { live, silent } = splitOracleLens([
    { live: true },
    { live: false },
    { live: null },
    {},
  ]);
  assert.equal(live.length, 1);
  assert.equal(silent.length, 3);
});

test("silent tape is oldest first", () => {
  const rows = sortSilentOldest([
    { tsMs: 200, height: 2 },
    { tsMs: 50, height: 1 },
    { tsMs: null, height: 9 },
  ]);
  assert.equal(rows[0]?.tsMs, 50);
  assert.equal(rows[2]?.height, 9);
});
