import assert from "node:assert/strict";
import { test } from "node:test";
import { en } from "./i18n/en";
import { ru } from "./i18n/ru";

test("English and Russian dictionaries expose the same keys", () => {
  assert.deepEqual(
    Object.keys(en).sort(),
    Object.keys(ru).sort()
  );
});
