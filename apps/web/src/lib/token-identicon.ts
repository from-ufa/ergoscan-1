/**
 * Deterministic mark when we have no file. 5×5 mirrored tiles from the id —
 * every token gets a logo, no empty disc.
 */
const HEX = /[^0-9a-f]/g;

export function tokenIdenticonSvg(tokenId: string): string {
  const id = String(tokenId || "0")
    .toLowerCase()
    .replace(HEX, "0")
    .padEnd(16, "0");
  const hue = (parseInt(id.slice(0, 2), 16) * 360) / 255;
  const bg = `hsl(${hue.toFixed(1)} 22% 16%)`;
  const fg = `hsl(${((hue + 38) % 360).toFixed(1)} 58% 58%)`;
  let p = 2;
  const cells: string[] = [];
  for (let y = 0; y < 5; y++) {
    const half: boolean[] = [];
    for (let x = 0; x < 3; x++) {
      half.push(parseInt(id[p] ?? "0", 16) > 7);
      p += 1;
    }
    const row = [half[0], half[1], half[2], half[1], half[0]];
    row.forEach((on, x) => {
      if (on) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    });
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5" shape-rendering="crispEdges">` +
    `<rect width="5" height="5" fill="${bg}"/>` +
    `<g fill="${fg}">${cells.join("")}</g></svg>`
  );
}

export function tokenIdenticonSrc(tokenId: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tokenIdenticonSvg(tokenId))}`;
}
