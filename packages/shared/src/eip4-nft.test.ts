import assert from "node:assert/strict";
import { test } from "node:test";
import {
  eip24FromIssuerRegs,
  eip4DecimalsFromRegs,
  eip4MediaFromRegs,
  eip4PreviewUrl,
  ipfsCidFromHref,
  nftKindFromR7,
  sha256FromR8,
} from "./eip4-nft.js";

test("nftKindFromR7: EIP-4 two-byte types", () => {
  assert.equal(nftKindFromR7("0e020101"), "image");
  assert.equal(nftKindFromR7("0e020102"), "audio");
  assert.equal(nftKindFromR7("0e020103"), "video");
  assert.equal(nftKindFromR7("0e020104"), "collection");
  assert.equal(nftKindFromR7("0e02010F"), "file");
  assert.equal(nftKindFromR7("0e020201"), "membership");
  assert.equal(nftKindFromR7("0e04576f6c66"), null);
  assert.equal(nftKindFromR7(null), null);
});

test("sha256FromR8: raw 32 bytes and ASCII hex coll", () => {
  const raw =
    "0e201c70b32fad1c95c841e1454135af6c19eb896cdc6c881714fd6b9ed03705b107";
  assert.equal(
    sha256FromR8(raw),
    "1c70b32fad1c95c841e1454135af6c19eb896cdc6c881714fd6b9ed03705b107"
  );
  const ascii = Buffer.from(
    "d054fb5faaaab8410436f01731c1ccb6a9fc72463fe51333b8aeb77e01a20f8a",
    "utf8"
  );
  const asciiHex = `0e${ascii.length.toString(16).padStart(2, "0")}${ascii.toString("hex")}`;
  assert.equal(
    sha256FromR8(asciiHex),
    "d054fb5faaaab8410436f01731c1ccb6a9fc72463fe51333b8aeb77e01a20f8a"
  );
});

test("audio R9 pair: two ipfs URLs (HOF live hex)", () => {
  const r9 =
    "3c0e0e42697066733a2f2f62616679626569627061346135676476326d626a74666e6f62763375626f3764707a6d6233736a70706d326f79333561757462366574626879796942697066733a2f2f62616679626569687a667677336e6e6a777a7a7a753569616570337662697072796774693474366274797378746165626536766133757378347161";
  const media = eip4MediaFromRegs({
    R7: "0e020102",
    R9: r9,
  });
  assert.equal(media.kind, "audio");
  assert.ok(media.url?.includes("bafybeibpa4a5gdv2mbjtfnobv3ubo7dpzmb3sjppm2oy35autb6etbhyyi"));
  assert.ok(media.coverUrl?.includes("bafybeihzfvw3nnjwzzzu5iaep3vbiprygti4t6btysxtaebe6va3usx4qa"));
  assert.equal(eip4PreviewUrl(media), media.coverUrl);
  assert.equal(media.ipfsCid, "bafybeibpa4a5gdv2mbjtfnobv3ubo7dpzmb3sjppm2oy35autb6etbhyyi");
  assert.equal(media.extraUrls.length, 0);
});

test("image R9 http + cover is the image", () => {
  const url = Buffer.from("https://i.ibb.co/x.png", "utf8");
  const hex = `0e${url.length.toString(16).padStart(2, "0")}${url.toString("hex")}`;
  const media = eip4MediaFromRegs({ R7: "0e020101", R9: hex });
  assert.equal(media.kind, "image");
  assert.equal(media.url, "https://i.ibb.co/x.png");
  assert.equal(media.coverUrl, media.url);
});

test("eip24 issuer: royalty 0.2% and collection token id (ErgoNames live)", () => {
  const issuer = eip24FromIssuerRegs({
    R4: "0404",
    R7: "0e20363285d224b9eb9c82f0ba738a4ab9e8271d18d71792b59a43ee2665c8048718",
  });
  assert.equal(issuer.royaltyPercent, 0.2);
  assert.equal(
    issuer.collectionTokenId,
    "363285d224b9eb9c82f0ba738a4ab9e8271d18d71792b59a43ee2665c8048718"
  );
});

test("eip24: empty issuer coll is not a collection", () => {
  const issuer = eip24FromIssuerRegs({ R4: "0400", R7: "0e00" });
  assert.equal(issuer.royaltyPercent, null);
  assert.equal(issuer.collectionTokenId, null);
});

test("data URI with comma stays intact", () => {
  const data = "data:image/png;base64,aaa";
  const buf = Buffer.from(data, "utf8");
  const hex = `0e${buf.length.toString(16).padStart(2, "0")}${buf.toString("hex")}`;
  const media = eip4MediaFromRegs({ R7: "0e020101", R9: hex });
  assert.equal(media.url, data);
});

test("ipfsCidFromHref", () => {
  assert.equal(ipfsCidFromHref("ipfs://bafyabc"), "bafyabc");
  assert.equal(ipfsCidFromHref("https://ipfs.io/ipfs/bafyabc"), "bafyabc");
  assert.equal(ipfsCidFromHref("https://nftstorage.link/ipfs/bafyabc"), "bafyabc");
  assert.equal(ipfsCidFromHref("https://i.ibb.co/x.png"), null);
});

test("eip4DecimalsFromRegs: two-digit text and one-byte ASCII", () => {
  assert.equal(eip4DecimalsFromRegs({ R6: "0e023138" }), 18); // "18"
  assert.equal(eip4DecimalsFromRegs({ R6: "0e0132" }), 2); // "2"
  assert.equal(eip4DecimalsFromRegs({ R6: { serializedValue: "0e0130" } }), 0);
  assert.equal(eip4DecimalsFromRegs({ R6: "0e0132".toUpperCase() }), 2);
  assert.equal(eip4DecimalsFromRegs(JSON.stringify({ R6: "0e0138" })), 8);
  assert.equal(eip4DecimalsFromRegs({ R4: "0e04576f6c66" }), null);
  assert.equal(eip4DecimalsFromRegs(null), null);
});
