import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenIdenticonSrc, tokenIdenticonSvg } from "./token-identicon";

const A = "a55b8735ed1a99e46c2c89f8994aacdf4b1109bdcf682f1e5b34479c6e392669";
const B = "f".repeat(64);

test("identicon is a data svg and stable for the same id", () => {
  const src = tokenIdenticonSrc(A);
  assert.match(src, /^data:image\/svg\+xml/);
  assert.equal(tokenIdenticonSrc(A), src);
  assert.notEqual(tokenIdenticonSvg(A), tokenIdenticonSvg(B));
});
