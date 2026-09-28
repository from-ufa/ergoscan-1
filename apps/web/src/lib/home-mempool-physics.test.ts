import assert from "node:assert/strict";
import { test } from "node:test";
import {
  easeHouse,
  mixHex,
  radiusFromKb,
  mergedRadius,
  clampSpeed,
  pokeBall,
  PIT_MIN_R,
  PIT_MAX_R,
  PIT_MIN_SPEED,
} from "./home-mempool-physics";

test("radius grows with sqrt of kilobytes and clamps", () => {
  const oneKb = radiusFromKb(1024);
  const fourKb = radiusFromKb(4096);
  assert.ok(Math.abs(fourKb / oneKb - 2) < 0.15);
  assert.equal(radiusFromKb(0), PIT_MIN_R);
  assert.ok(radiusFromKb(1024 * 80) <= PIT_MAX_R);
});

test("mixHex weights by area", () => {
  assert.equal(mixHex([{ color: "#ff0000", weight: 1 }]), "#ff0000");
  const mixed = mixHex([
    { color: "#ff0000", weight: 1 },
    { color: "#0000ff", weight: 1 },
  ]);
  assert.equal(mixed, "#800080");
});

test("easeHouse is 0 at start, 1 at end, and eases in between", () => {
  assert.equal(easeHouse(0), 0);
  assert.equal(easeHouse(1), 1);
  const mid = easeHouse(0.5);
  assert.ok(mid > 0.5 && mid < 1);
});

test("mergedRadius is hypot of component radii", () => {
  const r = mergedRadius([{ r: 6 }, { r: 8 }]);
  assert.ok(Math.abs(r - 10) < 0.01);
});

test("clampSpeed restores a stalled ball to min speed", () => {
  const b = {
    id: "a",
    x: 10,
    y: 10,
    vx: 0,
    vy: 0,
    r: 9,
    color: "#fff",
    size: 200,
    category: "transfer",
    platform: null,
    value: 0,
    born: 0,
    morph: 1,
    spin: 0,
    sealing: false,
    leaving: null,
  };
  clampSpeed(b);
  assert.ok(Math.hypot(b.vx, b.vy) >= PIT_MIN_SPEED - 0.01);
});

test("pokeBall sends the ball away from the pointer", () => {
  const b = {
    id: "a",
    x: 40,
    y: 40,
    vx: -10,
    vy: 0,
    r: 9,
    color: "#fff",
    size: 200,
    category: "transfer",
    platform: null,
    value: 0,
    born: 0,
    morph: 1,
    spin: 0,
    sealing: false,
    leaving: null,
  };
  pokeBall(b, 20, 40);
  assert.ok(b.vx > 0);
});
