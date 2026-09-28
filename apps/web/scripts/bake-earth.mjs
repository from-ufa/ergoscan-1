/**
 * Bake equirectangular globe texture for Home Earth.
 * Runtime loads public/earth/globe.webp — does not parse GeoJSON.
 *
 *   npm i -D @napi-rs/canvas
 *   node ./scripts/bake-earth.mjs
 *
 * Source: Natural Earth 50m (public domain).
 */
import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(__dirname, "earth/ne-50m.json");
const OUT_DIR = join(ROOT, "public/earth");
const W = 2048;
const H = 1024;

function xy(lon, lat, w, h) {
  return [((lon + 180) / 360) * w, ((90 - lat) / 180) * h];
}

function ringPath(ctx, ring, w, h) {
  if (ring.length < 3) return;
  let started = false;
  let prevLon = null;
  for (const pt of ring) {
    const lon = pt[0];
    const lat = pt[1];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const [x, y] = xy(lon, lat, w, h);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
      prevLon = lon;
      continue;
    }
    if (prevLon != null && Math.abs(lon - prevLon) > 180) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    prevLon = lon;
  }
}

function walkPolys(g, fn) {
  if (!g) return;
  if (g.type === "GeometryCollection") {
    for (const child of g.geometries ?? []) walkPolys(child, fn);
    return;
  }
  if (g.type === "Polygon") fn(g.coordinates);
  else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates) fn(poly);
  }
}

function paintCollection(ctx, fc, w, h, mode) {
  if (!fc?.features?.length) return;
  for (const feat of fc.features) {
    walkPolys(feat.geometry, (rings) => {
      if (!rings?.length) return;
      ctx.beginPath();
      for (const ring of rings) ringPath(ctx, ring, w, h), ctx.closePath();
      if (mode === "fill") ctx.fill("evenodd");
      else ctx.stroke();
    });
  }
}

function paintOcean(ctx, w, h) {
  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, "#d5e2ea");
  ocean.addColorStop(0.09, "#1a5d86");
  ocean.addColorStop(0.5, "#0c3558");
  ocean.addColorStop(0.91, "#1a5d86");
  ocean.addColorStop(1, "#d5e2ea");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);
  return ocean;
}

function sealSeam(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  const pad = Math.min(12, Math.floor(w / 64));
  const left = ctx.getImageData(0, 0, pad, h);
  const right = ctx.getImageData(w - pad, 0, pad, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < pad; x++) {
      const t = (x + 0.5) / pad;
      const li = (y * pad + x) * 4;
      const ri = (y * pad + (pad - 1 - x)) * 4;
      for (let k = 0; k < 3; k++) {
        const L = left.data[li + k];
        const R = right.data[ri + k];
        const m = (L + R) * 0.5;
        left.data[li + k] = L * t + m * (1 - t);
        right.data[ri + k] = R * t + m * (1 - t);
      }
    }
  }
  ctx.putImageData(left, 0, 0);
  ctx.putImageData(right, w - pad, 0);
}

const layers = JSON.parse(readFileSync(SRC, "utf8"));
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
const ocean = paintOcean(ctx, W, H);
const scale = W / 4096;

ctx.lineJoin = "round";
ctx.miterLimit = 2;
ctx.strokeStyle = "#1e6a96";
ctx.lineWidth = 5.5 * scale;
paintCollection(ctx, layers.land, W, H, "stroke");
ctx.fillStyle = "#4a6840";
paintCollection(ctx, layers.land, W, H, "fill");
ctx.strokeStyle = "rgba(12, 53, 88, 0.32)";
ctx.lineWidth = 1.4 * scale;
paintCollection(ctx, layers.land, W, H, "stroke");
ctx.fillStyle = ocean;
paintCollection(ctx, layers.lakes, W, H, "fill");
ctx.fillStyle = "#e6eef4";
paintCollection(ctx, layers.ice, W, H, "fill");
paintCollection(ctx, layers.shelves, W, H, "fill");
sealSeam(canvas);

mkdirSync(OUT_DIR, { recursive: true });
const webp = await canvas.encode("webp", 82);
writeFileSync(join(OUT_DIR, "globe.webp"), webp);
console.log("wrote", join(OUT_DIR, "globe.webp"), webp.length, "bytes", `${W}x${H}`);
