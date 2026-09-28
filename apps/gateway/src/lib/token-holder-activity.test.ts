import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TOKEN_HOLDER_ADDR_TX_CAP,
  leanTokenHolderAddresses,
  skippedTokenHolderAddresses,
} from "./token-holder-activity.js";

test("leanTokenHolderAddresses keeps short addrs under the address_tx cap", () => {
  const p2pk = "9fLYPigGHXkTyyQvU9zzoT3RTAXJ4dfHjbkg6ik2fHKKxjprSrh";
  const fat = "9how9k2dp67jXDnCM6TeRPKtQrToCs5MYL2JoSgyGHLXm1eHxWs";
  const p2s = "5".repeat(201);
  const got = leanTokenHolderAddresses(
    [p2pk, fat, p2s, p2pk, ""],
    new Map([
      [p2pk, 865],
      [fat, TOKEN_HOLDER_ADDR_TX_CAP],
    ])
  );
  assert.deepEqual(got, [p2pk]);
});

test("missing address_summary tx_count still counts as lean", () => {
  const a = "9gufJem5wtsb8qRFU91nmUg1Vy5WehraBoC29vTjWnmcTN3taEt";
  assert.deepEqual(leanTokenHolderAddresses([a], new Map()), [a]);
});

test("skippedTokenHolderAddresses is the long P2S and fat remainder", () => {
  const p2pk = "9fLYPigGHXkTyyQvU9zzoT3RTAXJ4dfHjbkg6ik2fHKKxjprSrh";
  const fat = "9how9k2dp67jXDnCM6TeRPKtQrToCs5MYL2JoSgyGHLXm1eHxWs";
  const p2s = "5".repeat(201);
  const got = skippedTokenHolderAddresses(
    [p2pk, fat, p2s],
    new Map([
      [p2pk, 865],
      [fat, TOKEN_HOLDER_ADDR_TX_CAP],
    ])
  );
  assert.deepEqual(got, [fat, p2s]);
});
