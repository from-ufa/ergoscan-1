import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupAddress, searchAddressBook, listBookEntries, countBookKinds } from "./address-book";

test("Rosen Cold is the unnamed leftover we sourced from their release JSON", () => {
  const hit = lookupAddress(
    "HNJiaJVyw1qtkiuQYxDTjaA8rmogotVzADinCt5qqavoyoREWM27WAp6f9Y79meFcMoJLt3yr8nsWC5xU5474ojCxE7VweGpd9sLz79VrSiyu7zBjBXPjgGLFZdJAEJhsH8A4y924MVZa7D9te6t3FUiLcpyTbrvTBhD7SpnD6hUjbGszCEGf1fRX1SmWZikeXcJEkfej42dPRimT6Fw423XAc9Tbeih8ZW8x7f5Y7y8frF5kxEdw998JdLU6UzPSwhrDjfKhySqmssQeQxCFwb19PMCB8ZZtx2mGwczr2H12Yi3hnEWn9ArqRqKWip24pJgm6e4Ky7n7BzGRRTmDtcA2EGH3zEVzpRH6aNSHE1MJ51dbCZSNFnRJfk3vxenkSevCfvEMfn5KyQP9wPU5foZACuHX8TQXvVUe1va3HXJFwCm74gxRssBy61GcYdwVbtxykPrw3t6aDX7c46BejsXvEaz5Ydcu7U8MJCoYia9pZ6zkjAj8d7Su12DMK1aLkBxw4vY2zQYc"
  );
  assert.equal(hit?.name, "Rosen Cold");
  assert.equal(hit?.kind, "contract");
});

test("Rosen Lock and Auction House are named from project files", () => {
  assert.equal(
    lookupAddress(
      "nB3L2PD3J4rMmyGk7nnNdESpPXxhPRQ4t1chF8LTXtceMQjKCEgL2pFjPY6cehGjyEFZyHEomBTFXZyqfonvxDozrTtK5JzatD8SdmcPeJNWPvdRb5UxEMXE4WQtpAFzt2veT8Z6bmoWN"
    )?.name,
    "Rosen Lock"
  );
  assert.equal(
    lookupAddress(
      "5t19JGogcry9DRipPNcLs4mSnHYXQoqazPDMXXcdMixeH2mkgzMvWXjENsHRJzfHAFnTL5FBDHQCzBcnYg4CU1LcJZMmUXAaDcsKdgfBk4sE9BDbLt6Yxkjh6ow65HGCgxkwNAEArMAz8tqZL7GzKx4AvYVkqG3ExKggwDyVrvx7YzN8xeFtEUcnVkDKM8ow7YWW8eee2EidfYArPRd8fxQr5EuZVEiQbzKZ6m4xgtHfhsEptE3pNdt69F94gkytpounxBYpJPqfeZ8hVxLk8qaXTGFiJTDTt2p9D5ue4skZf4AGSLJyuzpMkjdifczQNc784ic1nbTAcjL3FKGHqnkaVwnCxU7go45X9ZFHwdpc6v67vFDoHzAAqypax4UFF1ux84X5G4xK5NFFjMZtvPyjqn2ErNXVgHBs2AkpngBPjnVRiN4sWkhR66NfBNpigU8PaTiB4Rim2FMZSXuyhRySCA1BV8ydVxz45T9VHqHA6WYkXp2ppAHmc29F8MrHX5Ew2x6amraFgvsdgAB3XiiEqEjRc83mhZVL1QgKi5CdeeGNYiXeCkxaRhG3j6r1JdAgzGDAQfN8sdRcEc1aYxbPfbqM1s81NFm7K1UmMUxrfCUp73poGAfV8FvQa2akyascKBaSCqvwuHW2ZP4oMoJHjZjTAgQjQF8cBNF9YLo6wXEtMQT5FYc3bHSgd4xZXCk2oHYjUSACW1Z5e7KZ3Qw1Sa2UvpMdWhbZ5Ncu99WT7v6nHFLJvHEPM7evr41nhCe9Yt3pAq4ee4rKCtEer4vQWq2b5UJSDXDj5VkVepQ5tmeXfXrBc42Yqucy6VeQSE7W66o4hQjwW1iN3yipmdTmpaAEASmbXwCxRSm7g4sNkfA969xo14PZQpBY3QUGqgCWoqJJVFWMhfvD53rzfgJpA4JH5B1fvY99q5iwbsAKdJfZi4fxub9QWZSNQfht4JqXMDmc6XTkWLE4VCxBRQYzF44H2E6mdf5EbZHUrpXj5c2VfC6PZGg9qmrz14aZjafM4M7kRTqMwVB8R9r7kXM1FWidGoprp2fRoJUALAKxKDSTVHX8ejT8zkSKJ5W45dSQjMe3WUDTeKhiy6Fqio2ukV8THaizTp6yZWxMVdu3a15pGBv1kmXZJEnLN9BsxyhnW2iGM7tvwK1jAneXeBH1uVdusR59j5ubCGKeoaS5ToC8Ky6wZ2iCyb2JF5CTvR4sMUg2ksmUm1dk8EoRjJ9i5gkqY"
    )?.name,
    "Auction House"
  );
});

test("SigmaUSD implementor is a wallet, not the bank", () => {
  const hit = lookupAddress("9hFmeUHVttZmgtq4DEosEzJb3bTjx9HMJVptmMgfaHH9tYyGYTE");
  assert.equal(hit?.name, "SigmaUSD Implementor");
  assert.equal(hit?.kind, "wallet");
});

test("palette finds Rosen by name and by address prefix", () => {
  const byName = searchAddressBook("Rosen Cold");
  assert.equal(byName[0]?.name, "Rosen Cold");
  const byPrefix = searchAddressBook("HNJiaJVy");
  assert.equal(byPrefix[0]?.name, "Rosen Cold");
  assert.equal(searchAddressBook("R").length, 0);
});

test("directory lists named book entries and skips rejected CEX", () => {
  const all = listBookEntries();
  assert.ok(all.length > 50);
  assert.equal(all.some((e) => e.name === "Not a CEX main"), false);
  assert.equal(
    all.some((e) => e.address === "9exS2B892HTiDkqhcWnj1nzsbYmVn7ameVb1d2jagUWTqaLxfTX"),
    false
  );
  assert.ok(all.some((e) => e.name === "Rosen Cold"));
  assert.ok(all.some((e) => e.name === "Coinex"));
  assert.equal(searchAddressBook("Not a CEX").length, 0);
});

test("directory filters by kind and name query", () => {
  const leftover = listBookEntries({ kind: "contract" });
  assert.ok(leftover.some((e) => e.name === "Rosen Cold"));
  assert.ok(leftover.some((e) => e.name === "SigmaUSD Bank"));
  assert.equal(leftover.some((e) => e.name === "SigmaUSD Implementor"), false);

  const wallets = listBookEntries({ kind: "wallet" });
  assert.ok(wallets.some((e) => e.name === "SigmaUSD Implementor"));
  assert.equal(wallets.some((e) => e.name === "SigmaUSD Bank"), false);

  const rosen = listBookEntries({ q: "Rosen Cold" });
  assert.equal(rosen[0]?.name, "Rosen Cold");
});

test("book kind tiles count named entries only", () => {
  const n = countBookKinds();
  assert.equal(n.all, n.protocol + n.exchange + n.pool + n.contract + n.wallet);
  assert.ok(n.all > 50);
  assert.ok(n.contract > 0);
  assert.ok(n.exchange > 0);
  assert.equal(n.all, listBookEntries().length);
});
