import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GIX_STREAM_WINDOW, gixMaxFromNext, parseGixWindow } from "./gix.js";

describe("gix", () => {
  it("max is next − 1; next 0 or missing is null", () => {
    assert.equal(gixMaxFromNext("1875557"), 1875556);
    assert.equal(gixMaxFromNext("1"), 0);
    assert.equal(gixMaxFromNext("0"), null);
    assert.equal(gixMaxFromNext(""), null);
    assert.equal(gixMaxFromNext(undefined), null);
    assert.equal(gixMaxFromNext("-3"), null);
  });

  it("requires both ends and caps the window at 10000", () => {
    assert.deepEqual(parseGixWindow("10", "20"), { ok: true, min: 10, max: 20 });
    assert.deepEqual(parseGixWindow(["0"], ["9999"]), { ok: true, min: 0, max: 9999 });
    assert.equal(parseGixWindow("", "1").ok, false);
    assert.equal(parseGixWindow("1", "").ok, false);
    assert.equal(parseGixWindow("5", "4").ok, false);
    const wide = parseGixWindow("0", String(GIX_STREAM_WINDOW));
    assert.equal(wide.ok, false);
    if (!wide.ok) assert.equal(wide.reason, "window too large");
    const edge = parseGixWindow("1", String(GIX_STREAM_WINDOW));
    assert.deepEqual(edge, { ok: true, min: 1, max: GIX_STREAM_WINDOW });
  });
});
