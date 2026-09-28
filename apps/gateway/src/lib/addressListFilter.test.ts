import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADDRESS_BANDS,
  ADDRESS_KINDS,
  BAND_SQL,
  addressListWhere,
  holderFilterTotal,
  joinAddressFilter,
  knownKindLists,
  parseAddressBand,
  parseAddressBandList,
  parseAddressKind,
  parseAddressKindList,
  normalizeAddressFilter,
} from "./addressListFilter.js";

test("parseAddressBand / parseAddressKind allowlist", () => {
  assert.equal(parseAddressBand("dust"), "dust");
  assert.equal(parseAddressBand("OVERLORD"), "overlord");
  assert.equal(parseAddressBand("nope"), null);
  assert.equal(parseAddressBand(""), null);
  assert.equal(parseAddressKind("protocol"), "protocol");
  assert.equal(parseAddressKind("POOL"), "pool");
  assert.equal(parseAddressKind("holder"), null);
});

test("parse lists: comma, repeats, canonical order", () => {
  assert.deepEqual(parseAddressBandList("stacker,dust,dust,nope"), ["dust", "stacker"]);
  assert.deepEqual(parseAddressBandList(["overlord", "dust"]), ["dust", "overlord"]);
  assert.deepEqual(parseAddressBandList(ADDRESS_BANDS.join(",")), [...ADDRESS_BANDS]);
  assert.deepEqual(parseAddressKindList("contract,protocol"), ["protocol", "contract"]);
  assert.equal(joinAddressFilter(["dust", "stacker"]), "dust,stacker");
  assert.equal(joinAddressFilter([]), null);
});

test("five bands normalize to All, including when a kind is also set", () => {
  assert.deepEqual(normalizeAddressFilter([...ADDRESS_BANDS], ["protocol"]), {
    bands: [],
    kinds: [],
  });
  assert.deepEqual(normalizeAddressFilter(["dust"], ["protocol"]), {
    bands: ["dust"],
    kinds: ["protocol"],
  });
  const catalog = addressListWhere({ bands: [...ADDRESS_BANDS], kinds: ["protocol"] });
  assert.deepEqual(catalog.bands, []);
  assert.deepEqual(catalog.kinds, []);
  assert.doesNotMatch(catalog.sql, /ANY/);
});

test("addressListWhere ORs two bands", () => {
  const w = addressListWhere({ bands: ["dust", "overlord"] });
  assert.deepEqual(w.bands, ["dust", "overlord"]);
  assert.match(w.sql, /s\.nanoerg < 100000000000/);
  assert.match(w.sql, /s\.nanoerg >= 100000000000000/);
  assert.match(w.sql, / OR /);
  assert.doesNotMatch(w.sql, /ANY/);
});

test("BAND_SQL covers every holder class", () => {
  for (const id of ADDRESS_BANDS) {
    assert.ok(BAND_SQL[id].includes("s.nanoerg"));
  }
});

test("addressListWhere band is literal nanoerg, not a bound param", () => {
  const w = addressListWhere({ bands: ["dust"] });
  assert.equal(w.params.length, 0);
  assert.deepEqual(w.bands, ["dust"]);
  assert.deepEqual(w.kinds, []);
  assert.match(w.sql, /s\.nanoerg > 0/);
  assert.match(w.sql, /s\.nanoerg < 100000000000/);
  assert.doesNotMatch(w.sql, /\$\d/);
});

test("addressListWhere ORs band with kind, never AND", () => {
  const w = addressListWhere({ bands: ["dust"], kinds: ["protocol"] });
  assert.deepEqual(w.bands, ["dust"]);
  assert.deepEqual(w.kinds, ["protocol"]);
  assert.match(w.sql, /s\.nanoerg < 100000000000/);
  assert.match(w.sql, /s\.address = ANY\(\$1::text\[\]\)/);
  assert.match(w.sql, / OR /);
  assert.doesNotMatch(w.sql, /s\.nanoerg < 100000000000 AND s\.address/);
});

test("addressListWhere kind uses the same CASE order as indexer", () => {
  const lists = knownKindLists();
  assert.ok(lists.protocol.length >= 1);
  assert.ok(lists.exchange.length >= 1);

  const protocol = addressListWhere({ kinds: ["protocol"] });
  assert.equal(protocol.params.length, 1);
  assert.deepEqual(protocol.params[0], lists.protocol);
  assert.match(protocol.sql, /s\.address = ANY\(\$1::text\[\]\)/);

  const exchange = addressListWhere({ kinds: ["exchange"] });
  assert.equal(exchange.params.length, 2);
  assert.match(exchange.sql, /NOT \(s\.address = ANY\(\$1::text\[\]\)\)/);

  const pool = addressListWhere({ kinds: ["pool"] });
  assert.match(pool.sql, /address LIKE '88%'/);
  assert.equal(pool.params.length, 3);

  const contract = addressListWhere({ kinds: ["contract"] });
  assert.equal(contract.params.length, 3);
  assert.deepEqual(contract.params[0], lists.protocol);
  assert.deepEqual(contract.params[1], lists.exchange);
  assert.deepEqual(contract.params[2], lists.pool);
  assert.match(contract.sql, /NOT \(s\.address LIKE '9%'/);
  assert.match(contract.sql, /NOT \(s\.address = ANY\(\$1::text\[\]\)\)/);
  assert.match(contract.sql, /NOT \(s\.address = ANY\(\$2::text\[\]\)\)/);
  assert.match(contract.sql, /NOT \(s\.address LIKE '88%' OR s\.address = ANY\(\$3::text\[\]\)\)/);
});

test("leftover OR protocol keeps leftover NOT inside its own branch", () => {
  const w = addressListWhere({ kinds: ["protocol", "contract"] });
  assert.match(w.sql, /s\.address = ANY\(\$1::text\[\]\) OR \(NOT /);
  assert.doesNotMatch(w.sql, /s\.address = ANY\(\$1::text\[\]\) AND NOT/);
});

test("kind ids stay protocol/exchange/pool/contract", () => {
  assert.deepEqual([...ADDRESS_KINDS], ["protocol", "exchange", "pool", "contract"]);
});

test("holderFilterTotal: one layer sums, mixed is null, never COUNT", () => {
  const snap = {
    all: [
      { id: "dust", n: 12 },
      { id: "stacker", n: 5 },
    ],
    kinds: [
      { id: "protocol", n: 4 },
      { id: "exchange", n: 7 },
    ],
  };
  assert.equal(holderFilterTotal(snap, ["dust"], []), 12);
  assert.equal(holderFilterTotal(snap, ["dust", "stacker"], []), 17);
  assert.equal(holderFilterTotal(snap, [], ["protocol"]), 4);
  assert.equal(holderFilterTotal(snap, [], ["protocol", "exchange"]), 11);
  assert.equal(holderFilterTotal(snap, ["dust"], ["protocol"]), null);
  assert.equal(holderFilterTotal(snap, ["overlord"], []), 0);
  assert.equal(holderFilterTotal(null, ["dust"], []), null);
  assert.equal(holderFilterTotal(snap, [], []), null);
});
