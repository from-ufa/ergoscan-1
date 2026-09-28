import assert from "node:assert/strict";
import { test } from "node:test";
import { isHex64, packedReadEnabled } from "./packedRead.js";

test("packed page reads stay off without PACKED_READ", () => {
  const prev = process.env.PACKED_READ;
  delete process.env.PACKED_READ;
  try {
    assert.equal(packedReadEnabled(), false);
    process.env.PACKED_READ = "0";
    assert.equal(packedReadEnabled(), false);
    process.env.PACKED_READ = "1";
    assert.equal(packedReadEnabled(), true);
  } finally {
    if (prev == null) delete process.env.PACKED_READ;
    else process.env.PACKED_READ = prev;
  }
});

test("packed id lookup accepts 64 hex", () => {
  assert.equal(isHex64("a".repeat(64)), true);
  assert.equal(isHex64("A".repeat(64)), true);
  assert.equal(isHex64("zz"), false);
  assert.equal(isHex64("a".repeat(63)), false);
});
