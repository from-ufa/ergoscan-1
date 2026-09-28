import assert from "node:assert/strict";
import { test } from "node:test";
import { ERGO_MAX_BLOCK_SIZE } from "./ergo-emission";
import {
  MORE_ID,
  attractorOf,
  beginSeal,
  dyingCount,
  ensureIncludedBodies,
  makeWellBody,
  markMissing,
  mergeWellSeeds,
  orbitRadius,
  packForSeal,
  assignPackRadii,
  packFillRatio,
  packMeanRadius,
  pickWellSeeds,
  pokeWell,
  pourSeedsOf,
  assembleHomes,
  stepWell,
  sweepDead,
  wellRadiusForPack,
  birthScale,
  bodyInset,
  BIRTH_PEAK,
  type WellBody,
} from "./seal-well";

function ball(id: string, size: number, feeRate: number) {
  return { id, size, feeRate };
}

test("packForSeal takes everyone when sum(size) is under the cap", () => {
  const balls = [
    ball("a", 152, 9000),
    ball("b", 530, 4000),
    ball("c", 1283, 2000),
  ];
  const sum = balls.reduce((s, b) => s + b.size, 0);
  assert.ok(sum < ERGO_MAX_BLOCK_SIZE);
  const { packed, leftover } = packForSeal(balls, ERGO_MAX_BLOCK_SIZE);
  assert.equal(packed.length, 3);
  assert.equal(leftover.length, 0);
  assert.deepEqual(
    packed.map((b) => b.id),
    ["a", "b", "c"]
  );
});

test("orbitRadius: higher fee sits closer to the left mouth", () => {
  const rHi = orbitRadius(20_000, 100, 20_000, 10, 80);
  const rLo = orbitRadius(100, 100, 20_000, 10, 80);
  assert.ok(rHi < rLo, `high fee ${rHi} should be < low fee ${rLo}`);
  assert.ok(rHi < 25, "high fee stays near the mouth");
  assert.ok(rLo > 50, "low fee sits out on the rim");
});

test("tombstone: remove does not drop length to 0 while dying", () => {
  const now = 1_000;
  const bodies: WellBody[] = [
    makeWellBody(
      { id: "keep", size: 200, feeRate: 1000, color: "#5B8CFF" },
      320,
      90,
      "home",
      now
    ),
    makeWellBody(
      { id: "gone", size: 200, feeRate: 800, color: "#2DD4BF" },
      320,
      90,
      "home",
      now
    ),
  ];
  markMissing(bodies, new Set(["keep"]), "fade", now);
  assert.equal(bodies.length, 2);
  assert.ok(dyingCount(bodies) > 0);
  const mid = sweepDead(bodies, now + 50);
  assert.ok(mid.length >= 2);
  const done = sweepDead(mid, now + 400);
  assert.equal(done.length, 1);
  assert.equal(done[0].id, "keep");
});

test("seal packed.x decreases — inhale is left, toward the mouth", () => {
  const now = 5_000;
  const w = 340;
  const h = 90;
  const mouth = attractorOf(w, h);
  const body = makeWellBody(
    { id: "pack", size: 400, feeRate: 9000, color: "#5B8CFF" },
    w,
    h,
    "home",
    now
  );
  body.x = w * 0.72;
  body.y = h * 0.5;
  body.vx = 0;
  body.vy = 0;
  const startX = body.x;
  assert.ok(startX > mouth.x);
  beginSeal([body], now, new Set(["pack"]), mouth);
  assert.equal(body.dying, "seal");
  for (let i = 0; i < 8; i++) {
    stepWell([body], w, h, 0.016, now + i * 16);
  }
  assert.ok(body.x < startX, `packed.x ${body.x} must fall from ${startX} (left inhale)`);
  assert.ok(body.x < startX - 2, "seal flight must move, not jitter");
  const end = now + body.sealDelay + body.dieDur;
  for (let t = now + 8 * 16; t <= end; t += 16) {
    stepWell([body], w, h, 0.016, t);
  }
  assert.ok(body.x < 6, `must dissolve at the left edge, not stop mid-tile (${body.x},${body.y})`);
  assert.ok(body.alpha < 0.08, "ball must be gone when it reaches the edge");
  assert.equal(sweepDead([body], end + 1).length, 0);
});

test("beginSeal flies only txs that landed in the block", () => {
  const now = 2_000;
  const inBlock = makeWellBody(
    { id: "in", size: 200, feeRate: 8000, color: "#5B8CFF" },
    320,
    90,
    "home",
    now
  );
  const wait = makeWellBody(
    { id: "wait", size: 200, feeRate: 800, color: "#2DD4BF" },
    320,
    90,
    "home",
    now
  );
  beginSeal([inBlock, wait], now, new Set(["in"]));
  assert.equal(inBlock.dying, "seal");
  assert.equal(wait.dying, "none");
});

test("a sealing ball knocks an idle neighbor aside", () => {
  const now = 8_000;
  const flyer = makeWellBody(
    { id: "fly", size: 200, feeRate: 9000, color: "#5B8CFF" },
    340,
    90,
    "home",
    now
  );
  const idle = makeWellBody(
    { id: "idle", size: 200, feeRate: 400, color: "#A78BFA" },
    340,
    90,
    "home",
    now
  );
  flyer.x = 130;
  flyer.y = 45;
  flyer.r = 12;
  flyer.vx = -50;
  flyer.vy = 0;
  idle.x = 108;
  idle.y = 45;
  idle.r = 12;
  idle.vx = 0;
  idle.vy = 0;
  beginSeal([flyer, idle], now, new Set(["fly"]));
  const idleX = idle.x;
  stepWell([flyer, idle], 340, 90, 0.016, now);
  assert.ok(idle.x !== idleX || Math.abs(idle.vx) > 8, "idle must be shoved");
});

test("pack mean shrinks when more balls share the same 2/3 fill", () => {
  const r5 = packMeanRadius(5, 800, 400);
  const r7 = packMeanRadius(7, 800, 400);
  const r19 = packMeanRadius(19, 800, 400);
  assert.ok(r5 > r7 && r7 > r19);
  const area5 = 5 * Math.PI * r5 * r5;
  assert.ok(Math.abs(area5 / (800 * 400) - 2 / 3) < 0.02);
});

test("wellRadiusForPack: higher fee is larger, still around the pack mean", () => {
  const hi = wellRadiusForPack({
    n: 8,
    w: 800,
    h: 400,
    feeRate: 20_000,
    lo: 100,
    hi: 20_000,
    scale: "scene",
  });
  const lo = wellRadiusForPack({
    n: 8,
    w: 800,
    h: 400,
    feeRate: 100,
    lo: 100,
    hi: 20_000,
    scale: "scene",
  });
  assert.ok(hi > lo);
});

test("birthScale grows from a point, overshoots, then settles to 1", () => {
  assert.ok(birthScale(0) < 0.1);
  const mid = birthScale(300);
  assert.ok(mid > 1 && mid <= 1.21);
  assert.equal(birthScale(560), 1);
  assert.equal(birthScale(900), 1);
});

test("pokeWell shoves an idle ball and skips a more chip", () => {
  const now = 4_000;
  const ball = makeWellBody(
    { id: "hit", size: 200, feeRate: 800, color: "#5B8CFF" },
    320,
    90,
    "home",
    now
  );
  ball.x = 160;
  ball.y = 45;
  ball.vx = 0;
  ball.vy = 0;
  pokeWell(ball, 150, 45, now);
  assert.ok(ball.vx > 80, "poke must add cue speed");
  assert.ok(ball.stunUntil > now);
  const startX = ball.x;
  const idle = makeWellBody(
    { id: "nudge", size: 200, feeRate: 400, color: "#A78BFA" },
    320,
    90,
    "home",
    now
  );
  idle.x = 188;
  idle.y = 45;
  idle.r = 12;
  idle.vx = 0;
  idle.vy = 0;
  ball.r = 12;
  pokeWell(ball, 150, 45, now, [ball, idle]);
  assert.ok(Math.abs(idle.vx) > 20 || Math.abs(idle.vy) > 20, "break must kick the neighbor");
  assert.ok(idle.stunUntil > now);
  for (let i = 0; i < 8; i++) stepWell([ball, idle], 320, 90, 0.016, now + i * 16);
  assert.ok(ball.x !== startX, "poked ball must travel");
  assert.ok(idle.x !== 188 || idle.y !== 45, "neighbor must scatter");
  const chip = makeWellBody(
    { id: MORE_ID, size: 160, feeRate: 0, color: "#94A3B8" },
    320,
    90,
    "home",
    now,
    { more: true }
  );
  chip.vx = 0;
  pokeWell(chip, chip.x - 4, chip.y, now);
  assert.equal(chip.vx, 0);
});

test("pourSeedsOf keeps only sealing balls", () => {
  const now = 3_000;
  const seal = makeWellBody(
    { id: "in", size: 200, feeRate: 8000, color: "#5B8CFF" },
    320,
    90,
    "home",
    now
  );
  const idle = makeWellBody(
    { id: "wait", size: 200, feeRate: 400, color: "#2DD4BF" },
    320,
    90,
    "home",
    now
  );
  beginSeal([seal, idle], now, new Set(["in"]));
  const seeds = pourSeedsOf([seal, idle]);
  assert.equal(seeds.length, 1);
  assert.equal(seeds[0]?.id, "in");
  assert.ok((seeds[0]?.delayMs ?? 0) > 800);
});

test("assembleHomes stacks inside the bar and stays on canvas", () => {
  const homes = assembleHomes(6, 40, 28);
  assert.equal(homes.length, 6);
  for (const p of homes) {
    assert.ok(p.x > 0 && p.x < 40, `x ${p.x}`);
    assert.ok(p.y > 0 && p.y <= 28, `y ${p.y}`);
  }
  assert.deepEqual(assembleHomes(0, 40, 28), []);
});

test("assignPackRadii never fills more than 2/3 of the tile, even with fee spread", () => {
  const now = 9_000;
  const w = 400;
  const h = 90;
  const bodies = Array.from({ length: 12 }, (_, i) =>
    makeWellBody(
      {
        id: `f${i}`,
        size: 200 + i * 40,
        feeRate: i === 0 ? 80 : 80 * (i + 1) * (i + 1),
        color: "#5B8CFF",
      },
      w,
      h,
      "home",
      now
    )
  );
  assignPackRadii(bodies, w, h, "home");
  const ratio = packFillRatio(
    bodies.map((b) => b.r),
    w,
    h
  );
  assert.ok(ratio <= 2 / 3 + 0.012, `fill ${ratio} must leave ≥1/3 of the tile free`);
  const wide = packMeanRadius(5, 800, 400, "scene");
  assert.ok(Math.abs((5 * Math.PI * wide * wide) / (800 * 400) - 2 / 3) < 0.03);
});

test("idle balls may rest where the mouth was", () => {
  const now = 11_000;
  const w = 340;
  const h = 90;
  const mouth = attractorOf(w, h);
  const idle = makeWellBody(
    { id: "park", size: 400, feeRate: 20_000, color: "#CBD5E1" },
    w,
    h,
    "home",
    now
  );
  idle.x = mouth.x;
  idle.y = mouth.y;
  idle.vx = 0;
  idle.vy = 0;
  idle.r = 12;
  idle.r0 = 12;
  const crowd = Array.from({ length: 5 }, (_, i) => {
    const extra = makeWellBody(
      { id: `n${i}`, size: 200, feeRate: 400, color: "#A78BFA" },
      w,
      h,
      "home",
      now
    );
    extra.x = 140 + i * 28;
    extra.y = 45;
    extra.r = 10;
    extra.r0 = 10;
    extra.vx = 0;
    extra.vy = 0;
    return extra;
  });
  for (let i = 0; i < 24; i++) stepWell([idle, ...crowd], w, h, 0.016, now + i * 16, "home");
  assert.ok(
    Math.hypot(idle.x - mouth.x, idle.y - mouth.y) < idle.r + 10,
    "high-fee ball may sit where the hole was"
  );
  const flyer = makeWellBody(
    { id: "drop", size: 200, feeRate: 9000, color: "#5B8CFF" },
    w,
    h,
    "home",
    now
  );
  flyer.x = 120;
  flyer.y = mouth.y;
  beginSeal([flyer], now, new Set(["drop"]), mouth);
  const end = now + flyer.sealDelay + flyer.dieDur;
  for (let t = now; t <= end; t += 16) stepWell([flyer], w, h, 0.016, t, "home");
  assert.ok(flyer.x < 6, "sealing ball dissolves at the left edge");
});

test("pressing neighbors squash instead of sitting inside each other", () => {
  const now = 12_000;
  const a = makeWellBody(
    { id: "a", size: 200, feeRate: 800, color: "#A78BFA" },
    320,
    90,
    "home",
    now
  );
  const b = makeWellBody(
    { id: "b", size: 200, feeRate: 800, color: "#5B8CFF" },
    320,
    90,
    "home",
    now
  );
  a.x = 160;
  a.y = 45;
  a.r = 14;
  a.vx = 8;
  a.vy = 0;
  b.x = 172;
  b.y = 45;
  b.r = 14;
  b.vx = -8;
  b.vy = 0;
  stepWell([a, b], 320, 90, 0.016, now, "home");
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(dist + 0.6 >= a.r + b.r, `centers must separate (${dist} vs ${a.r + b.r})`);
  assert.ok(a.sq > 0.04 || b.sq > 0.04, "contact must squash");
});

test("idle ball stays fully inside the tile, including birth overshoot", () => {
  const now = 13_000;
  const w = 340;
  const h = 90;
  const ball = makeWellBody(
    { id: "clip", size: 400, feeRate: 9000, color: "#2DD4BF" },
    w,
    h,
    "home",
    now
  );
  ball.x = 180;
  ball.y = 2;
  ball.r = 16;
  ball.vx = 0;
  ball.vy = -20;
  for (let i = 0; i < 12; i++) stepWell([ball], w, h, 0.016, now + i * 16, "home");
  const inset = bodyInset(ball.r);
  assert.ok(ball.y >= inset - 0.05, `top clip y=${ball.y} r=${ball.r} inset=${inset}`);
  assert.ok(ball.y <= h - inset + 0.05);
  assert.ok(ball.x >= inset - 0.05);
  assert.ok(ball.x <= w - inset + 0.05);
  assert.ok(BIRTH_PEAK > 1);
});

test("pickWellSeeds keeps a +N more chip when the pool exceeds 48", () => {
  const seeds = Array.from({ length: 60 }, (_, i) => ({
    id: `t${i}`,
    feeRate: i,
  }));
  const { shown, more } = pickWellSeeds(seeds, 48);
  assert.equal(shown.length, 47);
  assert.equal(more, 13);
  assert.ok(!shown.some((s) => s.id === MORE_ID));
});

test("pickWellSeeds never drops included ids even when they would be +N", () => {
  const seeds = Array.from({ length: 60 }, (_, i) => ({
    id: `t${i}`,
    feeRate: i,
  }));
  const keep = new Set(["t0", "t1", "t2"]);
  const { shown, more } = pickWellSeeds(seeds, 48, keep);
  assert.ok(keep.size && [...keep].every((id) => shown.some((s) => s.id === id)));
  assert.ok(shown.length <= 48);
  assert.ok(more > 0);
});

test("beginSeal promotes a fading included ball", () => {
  const now = 4_000;
  const body = makeWellBody(
    { id: "in", size: 200, feeRate: 800, color: "#5B8CFF" },
    320,
    90,
    "home",
    now
  );
  body.dying = "fade";
  body.dieT0 = now - 80;
  body.dieDur = 200;
  beginSeal([body], now, new Set(["in"]));
  assert.equal(body.dying, "seal");
});

test("ensureIncludedBodies spawns every included seed we still know", () => {
  const now = 5_000;
  const bodies: WellBody[] = [
    makeWellBody(
      { id: "on-screen", size: 200, feeRate: 9000, color: "#5B8CFF" },
      320,
      90,
      "home",
      now
    ),
  ];
  const seeds = [
    { id: "on-screen", size: 200, feeRate: 9000, color: "#5B8CFF" },
    { id: "departed", size: 180, feeRate: 50, color: "#2DD4BF" },
  ];
  const included = new Set(["on-screen", "departed", "coinbase-only"]);
  const pool = mergeWellSeeds(seeds.slice(0, 1), seeds.slice(1), included);
  ensureIncludedBodies(bodies, included, pool, 320, 90, "home", now);
  beginSeal(bodies, now, included);
  assert.equal(bodies.length, 2);
  assert.ok(bodies.every((b) => b.dying === "seal"));
  assert.ok(!bodies.some((b) => b.id === "coinbase-only"));
});
