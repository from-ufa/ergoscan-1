import assert from "node:assert/strict";
import test from "node:test";
import { adProofSectionBytes, extensionSectionBytes, sectionBytesFromBlock } from "./sectionBackfill.js";

const HEADER = "ab".repeat(32);

test("an empty extension is the header id and a zero count", () => {
  const buf = extensionSectionBytes(HEADER, []);
  assert.equal(buf?.length, 34);
  assert.equal(buf?.subarray(0, 32).toString("hex"), HEADER);
  assert.equal(buf?.readUInt16BE(32), 0);
});

test("extension fields are key, length, value", () => {
  const value = "01" + "cd".repeat(32);
  const buf = extensionSectionBytes(HEADER, [["0100", value]]);
  assert.ok(buf);
  assert.equal(buf.readUInt16BE(32), 1);
  assert.equal(buf.subarray(34, 36).toString("hex"), "0100");
  assert.equal(buf[36], 33);
  assert.equal(buf.subarray(37).toString("hex"), value);
});

test("a bad extension field is not stored", () => {
  assert.equal(extensionSectionBytes(HEADER, [["01", "aa"]]), null);
  assert.equal(extensionSectionBytes("abcd", []), null);
});

test("ad proof bytes are the explorer hex", () => {
  assert.equal(adProofSectionBytes("0001")?.toString("hex"), "0001");
  assert.equal(adProofSectionBytes({ proofBytes: "0a0b" })?.toString("hex"), "0a0b");
  assert.equal(adProofSectionBytes(null), null);
  assert.equal(adProofSectionBytes(""), null);
  assert.equal(adProofSectionBytes({ proofBytes: "" }), null);
});

test("a block section keeps a null proof", () => {
  const got = sectionBytesFromBlock({
    header: { id: HEADER },
    extension: { headerId: HEADER, fields: [] },
    adProofs: null,
  });
  assert.equal(got.extension?.length, 34);
  assert.equal(got.adProofs, null);
});
