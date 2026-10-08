import assert from "node:assert/strict";
import { test } from "node:test";
import { scriptCountFromKinds } from "./snapshots.js";

test("script count sums protocol, pool, and contract", () => {
  assert.equal(
    scriptCountFromKinds([
      { id: "protocol", n: 3 },
      { id: "exchange", n: 21 },
      { id: "pool", n: 358 },
      { id: "contract", n: 4367 },
    ]),
    4728
  );
});

test("script count keeps a real zero and skips a missing snapshot", () => {
  assert.equal(
    scriptCountFromKinds([
      { id: "protocol", n: 0 },
      { id: "pool", n: 0 },
      { id: "contract", n: 0 },
    ]),
    0
  );
  assert.equal(scriptCountFromKinds([]), null);
  assert.equal(scriptCountFromKinds(null), null);
});
