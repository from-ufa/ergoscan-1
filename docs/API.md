# ErgoScan public API

Gateway `:4400`. Caddy: `/v1/*` and `/api/*` → gateway. `/api/v1/*` is the same router as `/v1/*`.

This file is the API contract. Pages and writers are described in the repository README.

## Goal

A public Ergo API that a wallet or dApp can use **instead of** `api.ergoplatform.com/api/v1`, and that is **not worse** than the official explorer:

| Official strength | How we match or beat it |
| --- | --- |
| Wallet paths (`boxes/unspent/byAddress`, `balance/total`, `tokens/bySymbol`, `epochs/params`, `blocks/headers`, `mempool/transactions/submit`) | Same paths on `/v1` and `/api/v1`. Thin aliases over our index + mempool RAM. |
| Amounts as JSON numbers (int64) | We keep **decimal strings**. Safer than official (LP / emission overflow). Clients that `BigInt()` or coerce still work. |
| Box / ErgoTree search and streams | Exact `byErgoTree`, template hash (`packed.box_template`), and `unspent/byLastEpochs/stream` are live (`limit≤100`, 4s). `POST /boxes/search`, unbounded `unspent/stream`, and `blocks/byGlobalIndex/stream` stay `501`. |
| Token name search via official HTTP | **Ours reads `tokens`.** No live GET to `api.ergoplatform.com`. |
| Chain + mempool only | We also ship DeFi (unified N2T + T2T fills), Rosen, rent, NFT catalog, resolve, graphs, orbit, page composites, WS. |

Official OpenAPI (reference only): `https://api.ergoplatform.com/api/v1/docs/`.

## Architecture

```
wallet / dApp / UI
        │
        ▼
 Caddy :443
        │  /v1/*  /api/*
        ▼
 Gateway :4400
   native product routes     official-compat aliases
   /defi /rosen /oracles /nfts  /boxes/unspent/byAddress
   /page/* /graph /resolve   /addresses/:id/balance/total
   /v1/tokens/:id (card)     /tokens/bySymbol /epochs/params
        │                    /blocks/headers /networkStats
        │                    POST /mempool/transactions/submit
        ▼
 Postgres ergoscan (read)
   public.* snapshots + tables
   defi.*  rosen.*  oracle.*
        │
 Mempool RAM  ← node /transactions/unconfirmed (poll only)
 Submit tx    → node POST /transactions   (this POST only)
```

Rules:

1. **One Postgres.** Gateway never writes chain / `defi` / `rosen` / `oracle`, except the template-hash tail: `packed.script.template_hash` and `packed.box_template`.
2. **User GET does not call the node** except the already-polled `/info` blob in RAM. Submit-tx is the only user path that talks to `:9053`.
3. **No `COUNT(*)` / wide `OFFSET` on `boxes` / `address_tx` / `blocks` / `transactions`.** Totals come from `address_summary` or snapshot KPIs. Lanes are keyset; official `offset` is accepted only as a small skip on an address-filtered index (`limit≤100`, `offset≤500`).
4. **Do not restart indexer, DeFi, Rosen, or ergonode** to ship API. Gateway only.
5. **Frozen native JSON stays.** New official paths may be added. Additive fields on existing routes are allowed. Do not rename or drop fields.
6. **Strings for nanoERG and token raw.** Official-compat bodies use the official field names (`nanoErgs`, `id`, `emissionAmount`) but values stay strings.
7. **Decimals overlay** is read-only on GET: if `tokens.decimals` is 0/null and the token is not emission=1, fill from `ergoTokenDecimals` (Rosen + Spectrum extras). `/v1/tokens` catalog page is unchanged. The indexer writer (`token_issuance_v1`) UPDATEs `tokens.decimals` / `emission` from the mint tx (spend of `box_id = token_id`, SUM of those outputs + R6) and the known map — not official HTTP.

## Layers

### Native (`/v1/…`)

Product contract for ErgoScan pages. Amounts as strings. Keyset cursors. Snapshots for lists. Documented in HOW.

### Official-compat (`/v1/…` same official suffixes)

Wallet/dApp drop-in. Same path after `/api/v1` as explorer. Response **shape** follows explorer (`items`/`total`, `confirmed`/`unconfirmed`, `TokenInfo`, `EpochInfo`, `NetworkState`, `TxIdResponse`). Amounts stay strings. Extra fields (`source`, `nextCursor`, `hasMore`) are additive.

`/api/v1/*` rewrite is already in `apps/gateway/src/index.ts`.

### Not this week

| Official path | Why later |
| --- | --- |
| `POST /boxes/search`, `POST /boxes/unspent/search`, `POST /boxes/unspent/search/union` | Registers and token predicates can seq-scan `boxes` |
| `GET /boxes/unspent/stream`, `GET /blocks/byGlobalIndex/stream` | Unbounded UTXO dump, and blocks have no `gix`. Hang-safe 501 |
| Facade that proxies official explorer | we are the index |

Those routes return `501` with a stable error so a client can detect the hole instead of hanging.

### Our GraphQL (`POST /v1/graphql`)

Same gateway. Not a port of nautls / SigmaSpace / `gql.ergoplatform.com`. GET → 405.

- **Live roots:** `info`, `state`, `box(id)`, `transaction(id)`, `address(id)` (balance + unspent/txs keyset), `token(id)`, `boxesByGix` / `transactionsByGix`, `mempool`, `oracles`, `defi`, `rosen`. Mutation `submitTx(signedJson)` — the only node write. Same shape-check, `SUBMIT_PER_MIN`, and `rejected`/`submit_failed` as REST submit.
- **Laws:** decimal strings, no `COUNT` / seq-scan on `boxes`, no ErgoTree filter, depth ≤ 7, gix window ≤ 10000 / 4s. `maxBoxGix` is ours (`*_gix_next − 1`).
- **Not live:** `boxes(spent:)`, template hash, registers search, nested `Box.transaction`, Fleet/Nautilus drop-in names. No second GraphQL phase is planned.

## Official-compat map

| Official | Ours | Source |
| --- | --- | --- |
| `GET /boxes/unspent/byAddress/{addr}` | same | `addressUnspentBoxesCursor` + `address_summary.box_count` |
| `GET /boxes/unspent/unconfirmed/byAddress/{addr}` | same | mempool RAM outputs |
| `GET /boxes/{id}` | native card | index → mempool RAM. Additive `settlementHeight` / `blockId`, `registersTyped`, ErgoTree constants/script/template hash (SHA-256 of template bytes). Rent clock stays declared `creationHeight`. Lists unchanged. |
| `GET /boxes/unspent/byTokenId/{id}` | already existed | `unspentBoxesByTokenId` |
| `GET /boxes/byAddress/{addr}` | same | address-filtered boxes, spent included, small page |
| `GET /assets` | official deprecated catalog | `listTokensCatalog` → TokenInfo; does **not** change `/v1/tokens` |
| `GET /assets/search/byTokenId` | same | `tokensSearchLite` (query ≥ 5) |
| `GET /addresses/{addr}/balance/confirmed` | already existed | `address_summary` + tokens id/amount/name from `addressBalanceConfirmed`. Official-compat same. Boxes fallback until `token_balances_utxo_v1`. |
| `GET /addresses/{addr}/tokens` | address Tokens tab | `addressTokenTape`: meta, `defi.price_tick`, first/last **on this address** from `token_balances`. No unspent scan. |
| `GET /addresses/{addr}/balance/total` | same | confirmed + mempool RAM delta |
| `GET /addresses/{addr}/transactions` | already existed | `address_tx` keyset; `total` from summary |
| `GET /tokens/bySymbol/{name}` | same | `tokens` where `lower(name)`; decimals from DB or Rosen/Spectrum map when DB is 0 |
| `GET /tokens/{id}` | native card | additive `id` (= tokenId). UI still reads `tokenId`. Decimals overlay as above. NFT `isNft` uses stored decimals. |
| `GET /tokens/search?query=` | native `/tokens/search` also accepts `query` | `tokens` FTS/ILIKE, no official HTTP |
| `GET /epochs/params` | same | last node `/info.parameters` in RAM |
| `GET /blocks/headers` | same | `getBlocksList` → header fields |
| `GET /networkState` | enrich existing | tip snapshot + params; `maxBoxGix`/`maxTxGix` = `*_gix_next − 1` |
| `GET /networkStats` | same | home snapshot KPIs (no table COUNT) |
| `GET /info` | additive official fields on existing lite | RAM + tip; same gix watermarks |
| `GET /boxes/byErgoTree/{tree}` | same | `md5` → `packed.script` → `boxes.script_id`. `limit≤100`, `offset≤500`, 4s, no `COUNT` |
| `GET /boxes/unspent/byErgoTree/{tree}` | same | unspent partial script index, same caps |
| `GET /boxes/byErgoTreeTemplateHash/{hash}` | same | `packed.box_template (template_hash, creation_height DESC)`. Same caps |
| `GET /boxes/unspent/byErgoTreeTemplateHash/{hash}` | same | same index, then `spent_tx_id IS NULL` |
| `GET /boxes/unspent/byLastEpochs/stream` | same | epochs 1–4, `limit≤100`, `creation_height` index |
| `GET /boxes/unspent/byGlobalIndex/stream` | same | unique `boxes.gix`; `minGix`+`maxGix` required; window ≤ 10000; unspent after seek |
| `GET /transactions/byGlobalIndex/stream` | same | unique `transactions.gix`; same window; batched I/O |
| `POST /mempool/transactions/submit` | same | shape-check, then node `POST /transactions`. Client errors: `rejected` / `submit_failed`. `SUBMIT_PER_MIN=10`. |
| `GET /mempool/transactions/byAddress/{addr}` | same | mempool RAM |
| `GET /mempool/boxes/unspent` | same | outputs in mempool RAM |

## Amounts

Never `JSON.parse` large integers into JS `Number` on the way out. Official explorer does, and emission / LP amounts break. Compat objects use the official **names**; values are decimal strings.

## OpenAPI

Human page: **https://ergoscan.me/docs** (same Shell as the rest of the site). Start tab is the public contract: Introduction, Specification, CORS, Authentication, Pagination, Rate Limit.  
`/api/v1/docs` and `/v1/docs` redirect there.  
`GET /openapi.json` carries the same English contract in `info.description` (`apps/gateway/src/lib/openapi-intro.ts`), then paths and `components.schemas` (`TokenInfo`, `TotalBalance`, `EpochInfo`, `OutputInfo`, `NetworkState`). Amounts in schemas are strings. No node bind, disk, or ops hosts in that intro.

## Ship / ops

- Restart **`ergoscan-gateway` only** after a gateway build.
- Do not flip `ENRICH_TOKENS`, `DEEPEN_PER_TICK`, DeFi history env, or Rosen.
- Do not `DROP` `defi` / `rosen` / `oracle`.
- Do not set `ORACLE_HISTORY=1` unless asked. Default oracle writer is tip-only.
- Unified DEX (`ergoscan-defi-projector`, N2T + T2T) remains tip-follow while this layer ships.
