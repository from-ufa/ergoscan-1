import assert from "node:assert/strict";
import { test } from "node:test";
import {
  displayErgoTokenName,
  ergoTokenDecimals,
  knownErgoTokenDecimals,
  knownErgoTokenName,
} from "./ergo-decimals.js";

const RSADA = "e023c5f382b6e96fbd878f6811aac73345489032157ad5affb84aefd4956c297";
const SIGUSD = "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04";
const SIGRSV = "003bd19d0187117f130b62e1bcab0939929ff5c7709f843c5c4dd158949285d0";
const USE = "a55b8735ed1a99e46c2c89f8994aacdf4b1109bdcf682f1e5b34479c6e392669";
const NETA = "472c3d4ecaa08fb7392ff041ee2e6af75f4a558810a74b28600549d5392810e8";
const FLUX = "e8b20745ee9d18817305f32eb21015831a48f02d40980de6e849f886dca7f807";
const EXLE = "007fd64d1ee54d78dd269c8930a38286caa28d3f29d27cadcb796418ab15c283";
const LIT = "c1980d829988229516430a47a5eca376060b6ce859616db0936e78ab25cb6de7";

test("Rosen + extra Ergo decimals", () => {
  assert.equal(ergoTokenDecimals(RSADA), 6);
  assert.equal(ergoTokenDecimals(SIGUSD), 2);
  assert.equal(ergoTokenDecimals(SIGRSV), 0);
  assert.equal(ergoTokenDecimals(USE), 3);
  assert.equal(ergoTokenDecimals(NETA), 6);
  assert.equal(ergoTokenDecimals(FLUX), 8);
  assert.equal(ergoTokenDecimals(EXLE), 4);
  assert.equal(ergoTokenDecimals(LIT), 9);
  assert.equal(knownErgoTokenName(LIT), "LIT");
  assert.equal(knownErgoTokenName(FLUX), "Flux");
  assert.equal(
    knownErgoTokenName("f0cac602d618081f46db086726d3c4da53006b646b50e382989054dcf3c93bd8"),
    "Faku"
  );
  assert.equal(ergoTokenDecimals("f".repeat(64)), null);
  assert.equal(ergoTokenDecimals(null), null);
});

test("known ticker wins over leftover issuance R4", () => {
  const rsbtc = "7a51950e5f548549ec1aa63ffdc38279505b11e7e803d01bcf8347e0123c88b0";
  assert.equal(knownErgoTokenName(rsbtc), "rsBTC");
  assert.equal(displayErgoTokenName(rsbtc, "rsPALM"), "rsBTC");
  assert.equal(knownErgoTokenName(SIGUSD), "SigUSD");
  assert.equal(displayErgoTokenName("f".repeat(64), "Wolf"), "Wolf");
});

test("known map indexes ergo-side ids", () => {
  const m = knownErgoTokenDecimals();
  assert.equal(m.get(RSADA), 6);
  assert.equal(m.get(SIGUSD), 2);
  assert.equal(m.get(NETA), 6);
});
