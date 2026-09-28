import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeRegisterHex,
  decodeSigmaLong,
  decodeRegisterMap,
  decodeSigmaConstant,
  decodeSigmaCollLong,
  collLongFromRegister,
  ergUsdFromOracleRegisters,
  groupElementFromRegister,
  longFromRegister,
  pickArtworkUrl,
} from "./registers.js";

function encodeVlq(n: bigint): number[] {
  const out: number[] = [];
  let x = n;
  while (x >= 0x80n) {
    out.push(Number((x & 0x7fn) | 0x80n));
    x >>= 7n;
  }
  out.push(Number(x));
  return out;
}

function encodeSigmaLong(n: bigint): string {
  const zig = n >= 0n ? n << 1n : (n << 1n) ^ -1n;
  const body = encodeVlq(zig)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `05${body}`;
}

test("sigma Long zigzag VLQ roundtrip", () => {
  const n = 4485028973n;
  const hex = encodeSigmaLong(n);
  assert.equal(decodeSigmaLong(hex), n);
});

test("oracle R4 nanoERG/USD → ERG/USD", () => {
  const usd = ergUsdFromOracleRegisters({ R4: encodeSigmaLong(4485028973n) });
  assert.ok(usd != null && usd > 0.2 && usd < 0.25);
});

test("node hex R4 string matches renderedValue", () => {
  const hex = encodeSigmaLong(3855860469n);
  const fromHex = ergUsdFromOracleRegisters({ R4: hex });
  const fromRendered = ergUsdFromOracleRegisters({ R4: { renderedValue: "3855860469" } });
  assert.equal(fromHex, fromRendered);
  assert.ok(fromHex != null && fromHex > 0.2 && fromHex < 0.3);
});

test("renderedValue long", () => {
  assert.equal(longFromRegister({ renderedValue: "4485028973" }), 4485028973n);
});

test("GroupElement R4 is a compressed pubkey, not a long", () => {
  const hex = "07033e299a9add2321db9220fd34d41b75ce6a2dd0564fd6032205c39b32ef59da98";
  assert.equal(
    groupElementFromRegister(hex),
    "033e299a9add2321db9220fd34d41b75ce6a2dd0564fd6032205c39b32ef59da98"
  );
  assert.equal(longFromRegister(hex), null);
});

test("sigma Int hex is not a decimal string (FIRO R7 0430 → 24)", () => {
  assert.equal(decodeSigmaLong("0430"), 24n);
  assert.equal(longFromRegister("0430"), 24n);
  assert.equal(longFromRegister("0476"), 59n);
  assert.equal(longFromRegister("24"), 24n);
  assert.equal(longFromRegister("0416"), 11n);
});

test("EIP-4 R4 emoji-only name (clown)", () => {
  const d = decodeRegisterHex("0e04f09fa4a1");
  assert.equal(d.kind, "text");
  assert.equal(d.text, "🤡");
});

test("Coll[Byte] longer than 127 bytes does not keep the VLQ tail as text", () => {
  const body = `{"title":"rosen 🚬","note":"${"x".repeat(140)}"}`;
  const raw = Buffer.from(body, "utf8");
  const vlq: number[] = [];
  let n = raw.length;
  while (true) {
    const b = n & 0x7f;
    n >>= 7;
    if (n) vlq.push(b | 0x80);
    else {
      vlq.push(b);
      break;
    }
  }
  const hex = `0e${Buffer.from(vlq).toString("hex")}${raw.toString("hex")}`;
  const d = decodeRegisterHex(hex);
  assert.equal(d.kind, "json");
  assert.equal(d.text, body);
  assert.equal(d.text?.includes("\u0001"), false);
});

test("Coll[Coll[SByte]] R4 matches official rendered bytes", () => {
  const hex =
    "1a0120101f5f0995d90c80a9491815571ed1c9fc5522922fa3bbccbd575d1aa7255f90";
  const d = decodeSigmaConstant(hex);
  assert.equal(d?.sigmaType, "Coll[Coll[SByte]]");
  assert.equal(
    d?.renderedValue,
    "[101f5f0995d90c80a9491815571ed1c9fc5522922fa3bbccbd575d1aa7255f90]"
  );
});

test("Coll[SByte] R6 is payload hex, not 0e prefix", () => {
  const hex =
    "0e20dc7f99a142ef282ca46cfff9eae5dc52250faf01b8519e94c976890b2cdb982b";
  const d = decodeSigmaConstant(hex);
  assert.equal(d?.sigmaType, "Coll[SByte]");
  assert.equal(
    d?.renderedValue,
    "dc7f99a142ef282ca46cfff9eae5dc52250faf01b8519e94c976890b2cdb982b"
  );
});

function encodeSigmaCollLong(xs: bigint[], compact = false): string {
  const body: number[] = [];
  for (const b of encodeVlq(BigInt(xs.length))) body.push(b);
  for (const n of xs) {
    const zig = n >= 0n ? n << 1n : (n << 1n) ^ -1n;
    for (const b of encodeVlq(zig)) body.push(b);
  }
  const hex = body.map((b) => b.toString(16).padStart(2, "0")).join("");
  return compact ? `11${hex}` : `0c05${hex}`;
}

test("sigma Coll[Long] 0c05 and embeddable 11", () => {
  const hex = encodeSigmaCollLong([0n, 1_000_000_000n]);
  assert.deepEqual(decodeSigmaCollLong(hex), [0n, 1_000_000_000n]);
  assert.deepEqual(decodeSigmaCollLong(encodeSigmaCollLong([0n, 2n], true)), [
    0n,
    2n,
  ]);
  assert.equal(decodeSigmaCollLong("1a020000"), null);
});

test("Coll[Long] from node renderedValue / array / hex", () => {
  assert.deepEqual(collLongFromRegister("[0, 15]"), [0n, 15n]);
  assert.deepEqual(collLongFromRegister([0, 15]), [0n, 15n]);
  assert.deepEqual(
    collLongFromRegister({ renderedValue: "[100, 200]" }),
    [100n, 200n]
  );
  const hex = encodeSigmaCollLong([3n, 4n]);
  assert.deepEqual(collLongFromRegister({ serializedValue: hex }), [3n, 4n]);
});

test("sigma Int 0430 is SInt 24", () => {
  const d = decodeSigmaConstant("0430");
  assert.equal(d?.sigmaType, "SInt");
  assert.equal(d?.renderedValue, "24");
});

test("SBoolean 0101 is true", () => {
  const d = decodeSigmaConstant("0101");
  assert.equal(d?.sigmaType, "SBoolean");
  assert.equal(d?.renderedValue, "true");
});

test("pickArtworkUrl: http, ipfs, on-chain data URI", () => {
  assert.equal(
    pickArtworkUrl({ R9: { text: "https://i.ibb.co/x.png", kind: "url" } }),
    "https://i.ibb.co/x.png"
  );
  assert.equal(
    pickArtworkUrl({ R9: { text: "ipfs://bafyabc", kind: "text" } }),
    "https://nftstorage.link/ipfs/bafyabc"
  );
  const data = "data:image/png;base64,aaa";
  assert.equal(pickArtworkUrl({ R9: { text: data, kind: "text" } }), data);
  assert.equal(
    pickArtworkUrl({
      R5: { text: '{"image":"ipfs://Qmabc"}', kind: "json" },
    }),
    "https://nftstorage.link/ipfs/Qmabc"
  );
});
