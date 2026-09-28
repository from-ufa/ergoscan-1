import assert from "node:assert/strict";
import { test } from "node:test";
import { enteringIds, leavingIds } from "./keyed-enter";

test("enteringIds are new ids only", () => {
  assert.deepEqual(
    enteringIds([{ id: "a" }], [{ id: "a" }, { id: "b" }]),
    ["b"]
  );
});

test("leavingIds are ids that dropped out", () => {
  assert.deepEqual(
    leavingIds([{ id: "a" }, { id: "b" }], [{ id: "b" }]),
    ["a"]
  );
  assert.deepEqual(leavingIds([{ id: "a" }], [{ id: "a" }]), []);
});
