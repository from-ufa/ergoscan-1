#!/usr/bin/env python3
"""Build /public/token-logos/{id}.png — 64px, same-origin.

Sources (first working url wins, Spectrum file preferred):
  1. spectrum-finance/token-logos logos/ergo/{id}.svg
  2. api2.ergexplorer.com/tokens/getTokenIcons
  3. ergexplorer.com/scripts/common/token-icons.js extras

Does not write remote URLs into the web app. Re-run to refresh.
"""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "token-logos"
GEN = ROOT / "src" / "lib" / "token-logos.generated.ts"
MANIFEST = ROOT / "src" / "lib" / "token-logos.manifest.json"
HEX64 = re.compile(r"^[0-9a-f]{64}$")
SIZE = 64
UA = "ErgoScanLogoIngest/1.0 (+https://ergoscan.me)"

SPECTRUM_LIST = (
    "https://api.github.com/repos/spectrum-finance/token-logos/contents/logos/ergo"
)
SPECTRUM_RAW = (
    "https://raw.githubusercontent.com/spectrum-finance/token-logos/master/logos/ergo"
)
ERGO_API = "https://api2.ergexplorer.com/tokens/getTokenIcons"
ERGO_JS = "https://ergexplorer.com/scripts/common/token-icons.js?v=41"


def fetch(url: str, timeout: int = 25) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def collect() -> dict[str, list[tuple[str, str]]]:
    by: dict[str, list[tuple[str, str]]] = {}

    def add(tid: str, source: str, url: str) -> None:
        tid = tid.lower().strip()
        url = url.strip()
        if not HEX64.match(tid) or not url.startswith("http"):
            return
        if "github.com/" in url and "/blob/" in url:
            url = url.replace("github.com/", "raw.githubusercontent.com/").replace(
                "/blob/", "/"
            )
        by.setdefault(tid, [])
        if any(u == url for _, u in by[tid]):
            return
        by[tid].append((source, url))

    files = json.loads(fetch(SPECTRUM_LIST).decode())
    for f in files:
        name = str(f.get("name") or "")
        stem = name.rsplit(".", 1)[0].lower()
        if HEX64.match(stem):
            add(stem, "spectrum", f"{SPECTRUM_RAW}/{name}")

    api = json.loads(fetch(ERGO_API).decode())
    for it in api.get("items") or []:
        add(str(it.get("id") or ""), "ergexplorer-api", str(it.get("iconurl") or ""))

    js = fetch(ERGO_JS).decode("utf-8", "replace")
    for tid, url in re.findall(
        r"tokenIcons\['([0-9a-fA-F]{64})'\]\s*=\s*'([^']+)'", js
    ):
        add(tid, "ergexplorer-js", url)

    return by


def to_png(raw: bytes, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    head = raw[:64].lstrip().lower()
    if head.startswith(b"<svg") or b"<svg" in raw[:400].lower():
        with tempfile.NamedTemporaryFile(suffix=".svg", delete=True) as tmp:
            tmp.write(raw)
            tmp.flush()
            try:
                subprocess.check_call(
                    ["rsvg-convert", "-w", str(SIZE), "-h", str(SIZE), tmp.name, "-o", str(dest)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except subprocess.CalledProcessError:
                return False
        return dest.exists() and dest.stat().st_size > 32

    try:
        from io import BytesIO

        im = Image.open(BytesIO(raw))
        if getattr(im, "n_frames", 1) > 1:
            im.seek(0)
        im = im.convert("RGBA")
        im.thumbnail((SIZE, SIZE), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        x = (SIZE - im.width) // 2
        y = (SIZE - im.height) // 2
        canvas.paste(im, (x, y), im)
        canvas.save(dest, "PNG", optimize=True)
        return dest.stat().st_size > 32
    except Exception:
        return False


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sources = collect()
    manifest: dict[str, dict[str, str]] = {}
    ok = fail = skip = 0

    # Keep ERG as the special mark.
    erg = OUT / "erg.png"
    if not erg.exists():
        print("missing erg.png — leave as-is")

    for tid, urls in sorted(sources.items()):
        dest = OUT / f"{tid}.png"
        got = False
        last_err = ""
        for source, url in urls:
            try:
                raw = fetch(url)
            except (urllib.error.URLError, TimeoutError, ValueError) as e:
                last_err = f"{source} {e}"
                continue
            if len(raw) < 40:
                last_err = f"{source} tiny"
                continue
            if to_png(raw, dest):
                manifest[tid] = {"source": source, "url": url}
                ok += 1
                got = True
                print(f"ok {tid[:12]} {source}")
                break
            last_err = f"{source} decode"
        if not got:
            fail += 1
            print(f"fail {tid[:12]} {last_err}")

    ids = sorted(
        p.stem
        for p in OUT.glob("*.png")
        if HEX64.match(p.stem) and not re.fullmatch(r"0{64}", p.stem)
    )
    GEN.write_text(
        "/** Generated by scripts/fetch-token-logos.py — do not edit. */\n"
        "export const LOCAL_TOKEN_LOGOS = new Set([\n"
        + "".join(f'  "{i}",\n' for i in ids)
        + "]);\n"
    )
    MANIFEST.write_text(json.dumps({"count": len(ids), "items": manifest}, indent=2) + "\n")
    print(f"wrote {len(ids)} logos ok={ok} fail={fail} skip={skip} → {OUT}")


if __name__ == "__main__":
    main()
