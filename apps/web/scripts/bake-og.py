#!/usr/bin/env python3
"""Bake apps/web/public/og.png — Telegram / OG share card.

Uses the real mark (public/ergoscan-mark.svg, all four viewfinder corners)
and Commissioner for ERGO / SCAN ME — same lockup as the site and GitHub README.

  python3 apps/web/scripts/bake-og.py
"""
from __future__ import annotations

import base64
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "og.png"
MARK = ROOT / "public" / "ergoscan-mark.svg"
FONT = Path("/tmp/ogfonts/Commissioner[FLAR,VOLM,slnt,wght].ttf")
FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/commissioner/Commissioner%5BFLAR%2CVOLM%2Cslnt%2Cwght%5D.ttf"

W, H = 1200, 630
HEADING = "Ergo Mainnet Explorer"
CAPTION = "ErgoScan is a block explorer for the Ergo mainnet"
HOST = "ergoscan.me"

CHROME = "/usr/bin/google-chrome-stable"


def ensure_font() -> Path:
    if FONT.exists() and FONT.stat().st_size > 10_000:
        return FONT
    FONT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(["curl", "-fsSL", "-o", str(FONT), FONT_URL])
    return FONT


def card_html(font: Path, svg: str) -> str:
    face = base64.b64encode(font.read_bytes()).decode("ascii")
    # Inline SVG: drop xml header, keep the mark.
    mark = svg.strip()
    if mark.startswith("<?xml"):
        mark = mark.split(">", 1)[1]
    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
@font-face {{
  font-family: Commissioner;
  src: url(data:font/ttf;base64,{face}) format("truetype");
  font-weight: 100 900;
  font-style: normal;
}}
html, body {{
  margin: 0;
  padding: 0;
  width: {W}px;
  height: {H}px;
  overflow: hidden;
  background: #2e2d35;
  color: #fff;
  font-family: Commissioner, sans-serif;
}}
body {{
  box-sizing: border-box;
  padding: 64px 72px 56px;
  background:
    radial-gradient(ellipse 70% 85% at 92% 18%, rgba(60, 162, 255, 0.16), transparent 58%),
    #2e2d35;
  display: flex;
  flex-direction: column;
}}
.brand {{
  display: flex;
  align-items: center;
  gap: 28px;
}}
.brand svg {{
  width: 152px;
  height: 152px;
  display: block;
  flex-shrink: 0;
}}
.word {{
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
}}
.ergo {{
  font-size: 64px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1;
  color: #ff8a65;
}}
.scanline {{
  display: flex;
  align-items: baseline;
  gap: 0.28em;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1;
}}
.scan {{ color: #3ca2ff; }}
.me {{ color: #ff5a6a; }}
h1 {{
  margin: 40px 0 0;
  font-size: 56px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.05;
}}
.cap {{
  margin: 18px 0 0;
  font-size: 24px;
  font-weight: 500;
  color: rgba(255,255,255,0.78);
  line-height: 1.3;
}}
.host {{
  margin-top: auto;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: rgba(255,255,255,0.38);
}}
</style>
</head>
<body>
  <div class="brand">
    {mark}
    <div class="word">
      <div class="ergo">ERGO</div>
      <div class="scanline"><span class="scan">SCAN</span><span class="me">ME</span></div>
    </div>
  </div>
  <h1>{HEADING}</h1>
  <p class="cap">{CAPTION}</p>
  <div class="host">{HOST}</div>
</body>
</html>
"""


def screenshot(html_path: Path, dest: Path) -> None:
    raw = dest.with_suffix(".chrome.png")
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-sandbox",
        "--force-device-scale-factor=1",
        f"--window-size={W},{H}",
        "--virtual-time-budget=4000",
        f"--screenshot={raw}",
        html_path.as_uri(),
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    im = Image.open(raw).convert("RGB")
    if im.size != (W, H):
        im = im.crop((0, 0, min(W, im.width), min(H, im.height)))
        canvas = Image.new("RGB", (W, H), (46, 45, 53))
        canvas.paste(im, (0, 0))
        im = canvas
    im.save(dest, "PNG", optimize=True)
    raw.unlink(missing_ok=True)


def main() -> None:
    font = ensure_font()
    svg = MARK.read_text()
    html = card_html(font, svg)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(html)
        html_path = Path(f.name)
    try:
        screenshot(html_path, OUT)
    finally:
        html_path.unlink(missing_ok=True)
    print(f"wrote {OUT} {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
