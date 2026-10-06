import assert from "node:assert/strict";
import test from "node:test";
import { splitExtension } from "./extension-section.js";

const BLOCK6 =
  "918d0c4ccb9a26cc69a3250eef1117b07bf843367a25455fd0873349a0821a61" +
  "0002" +
  "0100" +
  "21" +
  "01b0244dfc267baca974a4caee06120321562784303a8a688976ae56170e4d175b" +
  "0101" +
  "21" +
  "05855fc5c9eed868b43ea2c3df99ec17dd9d903187d891e2365a89b98125c994b2";

test("block 6 extension splits into a header id and two fields", () => {
  const parts = splitExtension(BLOCK6);
  assert.ok(parts);
  assert.equal(parts.headerId, "918d0c4ccb9a26cc69a3250eef1117b07bf843367a25455fd0873349a0821a61");
  assert.deepEqual(
    parts.fields.map((field) => field.key),
    ["0100", "0101"]
  );
  assert.equal(parts.fields[0]?.value.length, 66);
  assert.equal(parts.fields[1]?.value.startsWith("05855fc5"), true);
});

test("a truncated extension is left as one blob", () => {
  assert.equal(splitExtension("aa"), null);
  assert.equal(splitExtension(BLOCK6.slice(0, -2)), null);
});
