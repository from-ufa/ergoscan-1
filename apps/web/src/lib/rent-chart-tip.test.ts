import assert from "node:assert/strict";
import { test } from "node:test";
import {
  nearestRentTipPoint,
  pickRentChartTip,
  rentTipAxisMs,
} from "./rent-chart-tip";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 8, 13);
const past = [
  { t: T0, boxes: 1670, rentErg: 103.23 },
  { t: T0 - DAY, boxes: 900, rentErg: 40 },
];
const ahead = [
  { t: T0 + DAY, boxes: 200, rentErg: 12 },
  { t: T0 + 2 * DAY, boxes: 80, rentErg: 4.5 },
];

test("axis ms comes from the pointer, not the last collected point", () => {
  const hover = T0 + 2 * DAY;
  assert.equal(
    rentTipAxisMs([
      { axisValue: hover, value: [T0, 103.23] },
      { axisValue: hover, value: [hover, 4.5] },
    ]),
    hover
  );
  assert.equal(rentTipAxisMs([{ value: [T0, 103.23] }]), null);
});

test("peek day under the pointer wins over yesterday's collected", () => {
  const hover = T0 + 2 * DAY + 3_600_000;
  const picked = pickRentChartTip(past, ahead, hover);
  assert.ok(picked);
  assert.equal(picked.due, true);
  assert.equal(picked.src.rentErg, 4.5);
  assert.equal(picked.src.boxes, 80);
});

test("collected day still wins left of now", () => {
  const picked = pickRentChartTip(past, ahead, T0 + 1_000);
  assert.ok(picked);
  assert.equal(picked.due, false);
  assert.equal(picked.src.rentErg, 103.23);
});

test("nearest ignores points farther than half a day", () => {
  assert.equal(nearestRentTipPoint(ahead, T0 + 8 * DAY), undefined);
});
