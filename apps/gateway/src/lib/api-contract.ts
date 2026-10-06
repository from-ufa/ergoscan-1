/**
 * Public wallet contract for https://api.ergoscan.me.
 * Served only when API_CONTOUR=1. English. No node bind, disk, or ops hosts.
 */

export const API_PUBLIC_ORIGIN = "https://api.ergoscan.me";

export const API_COMPARE = [
  {
    topic: "Wallet paths",
    official: "https://api.ergoplatform.com/api/v1/…",
    ours: "The same path on https://api.ergoscan.me/api/v1/…",
  },
  {
    topic: "nanoERG and token amounts",
    official: "JSON numbers",
    ours: "Decimal strings. Parse with BigInt.",
  },
  {
    topic: "Heights, indexes, sizes, timestamps",
    official: "JSON numbers. Timestamps are Unix milliseconds.",
    ours: "The same.",
  },
  {
    topic: "Box by id and transaction by id",
    official: "Explorer document",
    ours: "The same field names. value and asset amounts are strings.",
  },
  {
    topic: "Register search and a full unspent dump",
    official: "Served",
    ours: "HTTP 501. A wallet does not need them.",
  },
] as const;

/** Official paths we answer with 501. Feature string is the gateway path. */
export const API_NOT_SERVED = [
  { method: "POST", path: "/boxes/search" },
  { method: "POST", path: "/boxes/unspent/search" },
  { method: "POST", path: "/boxes/unspent/search/union" },
  { method: "GET", path: "/boxes/unspent/stream" },
  { method: "GET", path: "/blocks/byGlobalIndex/stream" },
] as const;

export const API_WALLET_PATHS = [
  "GET /boxes/unspent/byAddress/{address}",
  "GET /boxes/unspent/unconfirmed/byAddress/{address}",
  "GET /boxes/unspent/byTokenId/{tokenId}",
  "GET /boxes/{boxId}",
  "GET /transactions/{txId}",
  "GET /addresses/{address}/balance/confirmed",
  "GET /addresses/{address}/balance/total",
  "GET /addresses/{address}/transactions",
  "GET /tokens/{tokenId}",
  "GET /tokens/bySymbol/{symbol}",
  "GET /epochs/params",
  "GET /blocks/headers",
  "GET /info",
  "GET /networkState",
  "POST /mempool/transactions/submit",
] as const;

export function apiContractMarkdown(): string {
  const table = [
    "| | Official explorer | ErgoScan API |",
    "| --- | --- | --- |",
    ...API_COMPARE.map((row) => `| ${row.topic} | ${row.official} | ${row.ours} |`),
  ].join("\n");
  const missing = API_NOT_SERVED.map((row) => `- \`${row.method} /api/v1${row.path}\``).join("\n");
  const wallet = API_WALLET_PATHS.map((row) => `- \`${row}\``).join("\n");
  return [
    "# ErgoScan API",
    "",
    `Base URL: ${API_PUBLIC_ORIGIN}/api/v1`,
    "",
    "`/api/v1` and `/v1` are the same router. No API key. `Access-Control-Allow-Origin: *`.",
    "",
    "This host replaces `api.ergoplatform.com` for a wallet. The explorer website stays at https://ergoscan.me. Do not build a wallet on `/v1/page/*`: those responses follow the website layout.",
    "",
    table,
    "",
    "## Not served",
    "",
    "These official paths return HTTP 501 `{ error: \"not_implemented\", status: 501 }`. Register predicates and an unbounded unspent dump can scan the whole chain. A wallet does not need them.",
    "",
    missing,
    "",
    "## Amounts",
    "",
    "nanoERG and token raw amounts are decimal strings, including inside boxes, balances, and assets. Official JSON numbers already lose precision past 2^53. Heights, indexes, sizes, and timestamps stay JSON numbers.",
    "",
    "## Index",
    "",
    "`globalIndex` on a box or a transaction is ErgoScan's own sequence. The same box carries the same `globalIndex` in a list and in `GET /boxes/{id}`. It is not the official explorer's global index. Box and transaction `byGlobalIndex` streams use this sequence: both bounds are required, and the window is at most 10000.",
    "",
    "`dataInputs` on a transaction is an empty list. `inputs` and `outputs` are filled.",
    "",
    "## Bounded lookups",
    "",
    "Exact `byErgoTree` and template-hash lookups are live: `limit` at most 100, `offset` at most 500. `unspent/byLastEpochs/stream` accepts 1–4 epochs and `limit` at most 100.",
    "",
    "## Wallet paths",
    "",
    "Paths are relative to `/api/v1`. List responses use `items` and `total`. `total` comes from the address summary, not a live count of boxes. Prefer `cursor` when `hasMore` is true. `offset` is a small skip (at most 500) on an address-filtered index.",
    "",
    wallet,
    "",
    "```",
    `curl -sS ${API_PUBLIC_ORIGIN}/api/v1/info`,
    `curl -sS ${API_PUBLIC_ORIGIN}/api/v1/epochs/params`,
    "```",
    "",
    "## Rate limit",
    "",
    "Reads: 120 requests per minute per IP. Submit (`POST /mempool/transactions/submit`): 10 per minute and 2 in flight. Over the limit the API returns HTTP 429 `{ error: \"rate_limited\", retryAfterSec }`.",
    "",
    `Machine-readable spec: ${API_PUBLIC_ORIGIN}/openapi.json`,
    "",
  ].join("\n");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function apiContractHtml(): string {
  const rows = API_COMPARE.map(
    (row) =>
      `<tr><th scope="row">${esc(row.topic)}</th><td>${esc(row.official)}</td><td>${esc(row.ours)}</td></tr>`
  ).join("");
  const missing = API_NOT_SERVED.map(
    (row) => `<li><code>${esc(row.method)} /api/v1${row.path}</code></li>`
  ).join("");
  const wallet = API_WALLET_PATHS.map((row) => `<li><code>${esc(row)}</code></li>`).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ErgoScan API</title>
<meta name="description" content="Wallet API for Ergo. Drop-in paths for api.ergoplatform.com, decimal string amounts, no API key.">
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #1c1b22; color: #eceaf0; font: 16px/1.5 ui-sans-serif, system-ui, sans-serif; }
  main { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
  h1 { font-size: 1.75rem; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 0.4rem; }
  h2 { font-size: 1.05rem; font-weight: 600; margin: 2rem 0 0.6rem; }
  p, li { color: #d5d2dc; }
  a { color: #ff8a65; }
  code, pre { font-family: ui-monospace, "Cascadia Code", monospace; font-size: 0.86rem; }
  code { color: #eceaf0; }
  pre { background: #24232b; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 0.9rem 1rem; overflow: auto; }
  table { width: 100%; border-collapse: collapse; margin: 1.25rem 0 0; font-size: 0.92rem; }
  th, td { text-align: left; vertical-align: top; padding: 0.65rem 0.7rem; border-bottom: 1px solid rgba(255,255,255,.08); }
  thead th { color: #a8a4b3; font-weight: 600; font-size: 0.75rem; letter-spacing: 0.04em; text-transform: uppercase; }
  tbody th { font-weight: 600; width: 28%; }
  .lede { color: #a8a4b3; margin: 0 0 0.5rem; }
  ul { padding-left: 1.15rem; }
</style>
</head>
<body>
<main>
  <p class="lede">Wallet API</p>
  <h1>ErgoScan API</h1>
  <p>Base URL <a href="${API_PUBLIC_ORIGIN}/api/v1/info"><code>${API_PUBLIC_ORIGIN}/api/v1</code></a>. <code>/api/v1</code> and <code>/v1</code> are the same router. No API key. <code>Access-Control-Allow-Origin: *</code>.</p>
  <p>This host replaces <code>api.ergoplatform.com</code> for a wallet. The explorer website stays at <a href="https://ergoscan.me">ergoscan.me</a>. Do not build a wallet on <code>/v1/page/*</code>: those responses follow the website layout.</p>
  <table>
    <thead><tr><th></th><th>Official explorer</th><th>ErgoScan API</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>Not served</h2>
  <p>These official paths return HTTP 501 <code>{ error: "not_implemented", status: 501 }</code>. Register predicates and an unbounded unspent dump can scan the whole chain. A wallet does not need them.</p>
  <ul>${missing}</ul>
  <h2>Amounts</h2>
  <p>nanoERG and token raw amounts are decimal strings, including inside boxes, balances, and assets. Official JSON numbers already lose precision past 2^53. Heights, indexes, sizes, and timestamps stay JSON numbers.</p>
  <h2>Index</h2>
  <p><code>globalIndex</code> on a box or a transaction is ErgoScan's own sequence. The same box carries the same <code>globalIndex</code> in a list and in <code>GET /boxes/{id}</code>. It is not the official explorer's global index. Box and transaction <code>byGlobalIndex</code> streams use this sequence: both bounds are required, and the window is at most 10000.</p>
  <p><code>dataInputs</code> on a transaction is an empty list. <code>inputs</code> and <code>outputs</code> are filled.</p>
  <h2>Bounded lookups</h2>
  <p>Exact <code>byErgoTree</code> and template-hash lookups are live: <code>limit</code> at most 100, <code>offset</code> at most 500. <code>unspent/byLastEpochs/stream</code> accepts 1–4 epochs and <code>limit</code> at most 100.</p>
  <h2>Wallet paths</h2>
  <p>Paths are relative to <code>/api/v1</code>. List responses use <code>items</code> and <code>total</code>. <code>total</code> comes from the address summary, not a live count of boxes. Prefer <code>cursor</code> when <code>hasMore</code> is true. <code>offset</code> is a small skip (at most 500) on an address-filtered index.</p>
  <ul>${wallet}</ul>
  <pre>curl -sS ${API_PUBLIC_ORIGIN}/api/v1/info
curl -sS ${API_PUBLIC_ORIGIN}/api/v1/epochs/params</pre>
  <h2>Rate limit</h2>
  <p>Reads: 120 requests per minute per IP. Submit (<code>POST /mempool/transactions/submit</code>): 10 per minute and 2 in flight. Over the limit the API returns HTTP 429 <code>{ error: "rate_limited", retryAfterSec }</code>.</p>
  <p>Machine-readable spec: <a href="${API_PUBLIC_ORIGIN}/openapi.json"><code>/openapi.json</code></a>.</p>
</main>
</body>
</html>
`;
}
