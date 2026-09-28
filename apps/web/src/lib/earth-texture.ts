/**
 * Home globe map. Prebaked 2048×1024 WebP (scripts/bake-earth.mjs).
 * Browser does not parse Natural Earth GeoJSON.
 */
const GLOBE_SRC = "/earth/globe.webp";

/** Tiny ocean placeholder until the WebP lands — not a 4k canvas. */
export function makePlaceholderMap(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 2;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0c3558";
    ctx.fillRect(0, 0, 2, 2);
  }
  return c;
}

export function loadGlobeMap(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("globe map"));
    img.src = GLOBE_SRC;
  });
}
