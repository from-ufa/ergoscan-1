import assert from "node:assert/strict";
import { test } from "node:test";
import { rosenExplorer } from "./rosen-explorers.js";

test("Ergo stays on-site", () => {
  const a = rosenExplorer(
    "ergo",
    "address",
    "9h1Nn67fL4kWDvnNLBXwy6zmEhzdUm6HToypmqh3BiUoe4sTSfm"
  );
  assert.equal(a?.external, false);
  assert.match(a?.href ?? "", /^\/address\//);
  const t = rosenExplorer(
    "ergo",
    "tx",
    "4d282996e2e3091a57689080bbe09cad4d95564246484a384ec075d98ba0cae5"
  );
  assert.equal(t?.href, "/tx/4d282996e2e3091a57689080bbe09cad4d95564246484a384ec075d98ba0cae5");
});

test("Cardano is AdaStat", () => {
  const addr =
    "addr1q85jk7pjflngt4cud6m3qaa0jzde2uyfznp30vkvfj04ttledql2ml323q3ye7ctzq8fm096kx63c32jnprqnr39fm0qevzlrc";
  assert.equal(
    rosenExplorer("cardano", "address", addr)?.href,
    `https://adastat.net/addresses/${addr}`
  );
  assert.equal(
    rosenExplorer(
      "cardano",
      "tx",
      "f9d56ed26d22603b3549b66351744eeb193399fa18711343fd95b7267be62411"
    )?.href,
    "https://adastat.net/transactions/f9d56ed26d22603b3549b66351744eeb193399fa18711343fd95b7267be62411"
  );
});

test("UTXO box:txid.n opens the source tx", () => {
  const hit = rosenExplorer(
    "bitcoin",
    "address",
    "box:b680e1be772474e9a38e2dc78f26d737c3055fe5c0e2ca63d918e71e615658eb.0"
  );
  assert.equal(
    hit?.href,
    "https://mempool.space/tx/b680e1be772474e9a38e2dc78f26d737c3055fe5c0e2ca63d918e71e615658eb"
  );
});

test("Bitcoin / Runes / ETH / BNB / Doge / Firo", () => {
  assert.equal(
    rosenExplorer("bitcoin", "address", "bc1qcna9tv9teesmdexgvlvcsq87j6n3cf8dd0yhgk")?.href,
    "https://mempool.space/address/bc1qcna9tv9teesmdexgvlvcsq87j6n3cf8dd0yhgk"
  );
  assert.equal(
    rosenExplorer(
      "bitcoin-runes",
      "address",
      "bc1pauat5z46a8y8ejyyjqsrwtxfw6zq7js4s9gfcxjlray6gzxevwss8eeekz"
    )?.href,
    "https://mempool.space/address/bc1pauat5z46a8y8ejyyjqsrwtxfw6zq7js4s9gfcxjlray6gzxevwss8eeekz"
  );
  assert.equal(
    rosenExplorer("ethereum", "address", "0xa8d06c2c6428e0e66360b9b7002fc9b0a475351c")?.href,
    "https://etherscan.io/address/0xa8d06c2c6428e0e66360b9b7002fc9b0a475351c"
  );
  assert.equal(
    rosenExplorer(
      "ethereum",
      "tx",
      "0x6171f1c641ea8a25ea689ff7e3a1daaf5a63082a1fb67d3b51f37468fbaa8c72"
    )?.href,
    "https://etherscan.io/tx/0x6171f1c641ea8a25ea689ff7e3a1daaf5a63082a1fb67d3b51f37468fbaa8c72"
  );
  assert.equal(
    rosenExplorer("binance", "address", "0xbc5689dd6bc7a74ceab61db64ddbca7cf8189d95")?.href,
    "https://bscscan.com/address/0xbc5689dd6bc7a74ceab61db64ddbca7cf8189d95"
  );
  assert.equal(
    rosenExplorer("doge", "address", "D5YeaCb6XqamkKgSFWnWxTkDPwgFyni4Wh")?.href,
    "https://www.oklink.com/doge/address/D5YeaCb6XqamkKgSFWnWxTkDPwgFyni4Wh"
  );
  assert.equal(
    rosenExplorer("firo", "address", "a86PtGKN9izdM7kdZn1Jm7J2bfjWzYm8u5")?.href,
    "https://chainz.cryptoid.info/firo/address.dws?a86PtGKN9izdM7kdZn1Jm7J2bfjWzYm8u5.htm"
  );
  assert.equal(
    rosenExplorer(
      "firo",
      "tx",
      "d64d134ce14b0dafe7494befcc22de75052872b1506c08cab232175d2d057e59"
    )?.href,
    "https://chainz.cryptoid.info/firo/tx.dws?d64d134ce14b0dafe7494befcc22de75052872b1506c08cab232175d2d057e59.htm"
  );
});
