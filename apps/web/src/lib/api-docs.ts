import { readHashTab } from "./hash-tab";

/** Public host. Same router as `/v1`. */
export const DOCS_PUBLIC_BASE = "https://ergoscan.me/api/v1";
export const DOCS_WS = "wss://ergoscan.me/v1/stream";
export const DOCS_OPENAPI = "https://ergoscan.me/openapi.json";

export const DOCS_TABS = ["start", "wallet", "chain", "tokens", "more"] as const;
export type DocsTab = (typeof DOCS_TABS)[number];

export type DocsSource = "index" | "ram" | "node" | "snapshot";

export type DocsCopy = { en: string; ru: string };

export type DocsRoute = {
  id: string;
  tab: Exclude<DocsTab, "start">;
  method: "GET" | "POST";
  /** Path after `/api/v1`. Leading slash. */
  path: string;
  source: DocsSource;
  title: DocsCopy;
  blurb: DocsCopy;
  query?: DocsCopy;
  tag?: DocsCopy;
  /** Gateway path to open (`/v1/…` or `/openapi.json`). */
  tryPath?: string;
};

export const DOCS_TRY_CURL = [
  `curl -sS ${DOCS_PUBLIC_BASE}/health`,
  `curl -sS ${DOCS_PUBLIC_BASE}/epochs/params`,
  `curl -sS ${DOCS_PUBLIC_BASE}/tokens/bySymbol/SigUSD`,
  `curl -sS ${DOCS_PUBLIC_BASE}/graphql -H 'content-type: application/json' -d '{"query":"{ state { height maxBoxGix } }"}'`,
] as const;

export const DOCS_EXAMPLE_URLS = [
  `${DOCS_PUBLIC_BASE}/health`,
  `${DOCS_PUBLIC_BASE}/epochs/params`,
  `${DOCS_PUBLIC_BASE}/tokens/bySymbol/SigUSD`,
] as const;

export const DOCS_ACCESS_LINKS = [
  { id: "docs", href: "https://ergoscan.me/docs" },
  { id: "openapi", href: DOCS_OPENAPI },
  { id: "graphql", href: `${DOCS_PUBLIC_BASE}/graphql` },
  { id: "ws", href: DOCS_WS },
] as const;

/** Start-tab contract, same chapters as OpenAPI `info.description`. */
export const DOCS_CONTRACT = ["intro", "spec", "cors", "auth", "page", "rate"] as const;

export const DOCS_SPEC_PARAS = [
  "format",
  "same",
  "index",
  "amounts",
  "times",
  "write",
  "address",
  "stable",
  "gql",
] as const;

export const DOCS_LIMIT_ROWS = ["rate", "submit", "over"] as const;

export const DOCS_START_ENTER = [...DOCS_CONTRACT, "try", "machines"] as const;

export function locCopy(locale: string, pair: DocsCopy): string {
  return locale === "ru" ? pair.ru : pair.en;
}

export function readDocsTab(): DocsTab {
  return readHashTab(DOCS_TABS, "start");
}

export function routesFor(tab: DocsTab): DocsRoute[] {
  if (tab === "start") return [];
  return DOCS_ROUTES.filter((r) => r.tab === tab);
}

export const DOCS_ROUTES: DocsRoute[] = [
  // —— wallet ——
  {
    id: "unspent-addr",
    tab: "wallet",
    method: "GET",
    path: "/boxes/unspent/byAddress/{address}",
    source: "index",
    title: { en: "Unspent boxes", ru: "Непотраченные боксы" },
    blurb: {
      en: "Confirmed UTXOs of the address. total is the address summary, not a COUNT on boxes. Prefer cursor over a large offset.",
      ru: "Подтверждённые UTXO адреса. total — из сводки адреса, не COUNT по boxes. Дальше — cursor, не большой offset.",
    },
    query: {
      en: "limit ≤ 100 · offset ≤ 500 · cursor",
      ru: "limit ≤ 100 · offset ≤ 500 · cursor",
    },
  },
  {
    id: "addr-unspent",
    tab: "wallet",
    method: "GET",
    path: "/addresses/{address}/boxes/unspent",
    source: "index",
    title: { en: "Unspent boxes (address path)", ru: "Непотраченные боксы (путь адреса)" },
    blurb: {
      en: "Same unspent set as /boxes/unspent/byAddress. Keyset. total from the address summary.",
      ru: "Тот же набор, что /boxes/unspent/byAddress. Keyset. total из сводки адреса.",
    },
  },
  {
    id: "unspent-mempool",
    tab: "wallet",
    method: "GET",
    path: "/boxes/unspent/unconfirmed/byAddress/{address}",
    source: "ram",
    title: { en: "Mempool boxes", ru: "Боксы в мемпуле" },
    blurb: {
      en: "Unconfirmed outputs that would land on this address.",
      ru: "Неподтверждённые выходы, которые попадут на этот адрес.",
    },
  },
  {
    id: "boxes-addr",
    tab: "wallet",
    method: "GET",
    path: "/boxes/byAddress/{address}",
    source: "index",
    title: { en: "All boxes", ru: "Все боксы" },
    blurb: {
      en: "Spent and unspent. total is this page size. Continue with nextCursor.",
      ru: "Потраченные и нет. total — размер этой страницы. Дальше nextCursor.",
    },
    query: {
      en: "limit ≤ 100 · offset ≤ 500 · cursor",
      ru: "limit ≤ 100 · offset ≤ 500 · cursor",
    },
  },
  {
    id: "unspent-token",
    tab: "wallet",
    method: "GET",
    path: "/boxes/unspent/byTokenId/{tokenId}",
    source: "index",
    title: { en: "Boxes by token", ru: "Боксы по токену" },
    blurb: {
      en: "Unspent boxes that still hold this token id.",
      ru: "Непотраченные боксы с этим token id.",
    },
  },
  {
    id: "boxes-tree",
    tab: "wallet",
    method: "GET",
    path: "/boxes/byErgoTree/{tree}",
    source: "index",
    title: { en: "Boxes by ErgoTree", ru: "Боксы по ErgoTree" },
    blurb: {
      en: "Boxes with this exact tree hex. limit ≤ 100, offset ≤ 500. No total. Timeout 4s → 504.",
      ru: "Боксы с этим точным hex дерева. limit ≤ 100, offset ≤ 500. Без total. Timeout 4s → 504.",
    },
    query: { en: "limit · offset", ru: "limit · offset" },
    tryPath:
      "/v1/boxes/byErgoTree/0008cd033e299a9add2321db9220fd34d41b75ce6a2dd0564fd6032205c39b32ef59da98?limit=3",
  },
  {
    id: "boxes-tree-unspent",
    tab: "wallet",
    method: "GET",
    path: "/boxes/unspent/byErgoTree/{tree}",
    source: "index",
    title: { en: "Unspent by ErgoTree", ru: "Непотраченные по ErgoTree" },
    blurb: {
      en: "Same exact tree, unspent only. Same page caps.",
      ru: "То же точное дерево, только непотраченные. Те же границы страницы.",
    },
    query: { en: "limit · offset", ru: "limit · offset" },
  },
  {
    id: "boxes-template",
    tab: "wallet",
    method: "GET",
    path: "/boxes/byErgoTreeTemplateHash/{hash}",
    source: "index",
    title: { en: "Boxes by template hash", ru: "Боксы по хешу шаблона" },
    blurb: {
      en: "Every box whose ErgoTree shares this template. Hash is SHA-256 of the template bytes, 64 hex — the same value as ergoTreeTemplateHash on the box. One contract family, many scripts. limit ≤ 100, offset ≤ 500. No total. Timeout 4s → 504.",
      ru: "Все боксы, у которых ErgoTree с этим шаблоном. Хеш — SHA-256 байт шаблона, 64 hex, то же значение, что ergoTreeTemplateHash на боксе. Одна семья контракта, много скриптов. limit ≤ 100, offset ≤ 500. Без total. Timeout 4s → 504.",
    },
    query: { en: "limit · offset", ru: "limit · offset" },
    tryPath:
      "/v1/boxes/byErgoTreeTemplateHash/83359e0ba727b204f33acf2b8e0ded97fd0005c9b833258fbd364a1e70e5eb46?limit=3",
  },
  {
    id: "boxes-template-unspent",
    tab: "wallet",
    method: "GET",
    path: "/boxes/unspent/byErgoTreeTemplateHash/{hash}",
    source: "index",
    title: { en: "Unspent by template hash", ru: "Непотраченные по хешу шаблона" },
    blurb: {
      en: "Same template hash, unspent only. Same page caps.",
      ru: "Тот же хеш шаблона, только непотраченные. Те же границы страницы.",
    },
    query: { en: "limit · offset", ru: "limit · offset" },
  },
  {
    id: "bal-confirmed",
    tab: "wallet",
    method: "GET",
    path: "/addresses/{address}/balance/confirmed",
    source: "index",
    title: { en: "Confirmed balance", ru: "Подтверждённый баланс" },
    blurb: {
      en: "nanoErgs and tokens. Amounts are decimal strings. At most 80 tokens; truncated is true if more. Id, amount, name — not the Tokens-tab tape.",
      ru: "nanoErgs и токены. Суммы — десятичные строки. Не больше 80 токенов; truncated = true, если их больше. Id, amount, name — не лента вкладки Tokens.",
    },
  },
  {
    id: "addr-token-tape",
    tab: "wallet",
    method: "GET",
    path: "/addresses/{address}/tokens",
    source: "index",
    title: { en: "Address token tape", ru: "Лента токенов адреса" },
    blurb: {
      en: "Tokens tab: amount, USD from defi.price_tick, first/last height on this address. Missing height is null. No box scan.",
      ru: "Вкладка Tokens: количество, USD из defi.price_tick, first/last высота у этого адреса. Нет высоты — null. Без скана боксов.",
    },
  },
  {
    id: "bal-total",
    tab: "wallet",
    method: "GET",
    path: "/addresses/{address}/balance/total",
    source: "index",
    title: { en: "Total balance", ru: "Полный баланс" },
    blurb: {
      en: "confirmed and unconfirmed. Unconfirmed is the mempool delta. Amounts are decimal strings.",
      ru: "confirmed и unconfirmed. Unconfirmed — дельта мемпула. Суммы — десятичные строки.",
    },
  },
  {
    id: "addr-txs",
    tab: "wallet",
    method: "GET",
    path: "/addresses/{address}/transactions",
    source: "index",
    title: { en: "Address transactions", ru: "Транзакции адреса" },
    blurb: {
      en: "Keyset over the address tape. total from the address summary.",
      ru: "Keyset по ленте адреса. total из сводки адреса.",
    },
  },
  {
    id: "addr-nfts",
    tab: "wallet",
    method: "GET",
    path: "/addresses/{address}/nfts",
    source: "index",
    title: { en: "Address NFTs", ru: "NFT адреса" },
    blurb: {
      en: "Tokens with emission = 1 on this address. Artwork URLs from the index.",
      ru: "Токены emission = 1 на этом адресе. URL картинок из индекса.",
    },
  },
  {
    id: "by-symbol",
    tab: "wallet",
    method: "GET",
    path: "/tokens/bySymbol/{name}",
    source: "index",
    title: { en: "Token by name", ru: "Токен по имени" },
    blurb: {
      en: "Case-insensitive name. If stored decimals are 0 and emission ≠ 1, known decimals from the Rosen / Spectrum map are filled in.",
      ru: "Имя без учёта регистра. Если decimals в индексе 0 и emission ≠ 1 — подставляем известные decimals из карты Rosen / Spectrum.",
    },
    tryPath: "/v1/tokens/bySymbol/SigUSD",
  },
  {
    id: "tokens-search",
    tab: "wallet",
    method: "GET",
    path: "/tokens/search",
    source: "index",
    title: { en: "Search tokens", ru: "Поиск токенов" },
    blurb: {
      en: "Name search on the tokens table. Parameter: query.",
      ru: "Поиск по имени в таблице tokens. Параметр: query.",
    },
    query: { en: "query", ru: "query" },
  },
  {
    id: "assets",
    tab: "wallet",
    method: "GET",
    path: "/assets",
    source: "index",
    title: { en: "Asset list", ru: "Список ассетов" },
    blurb: {
      en: "TokenInfo rows: id, name, decimals, emissionAmount (string). Separate from GET /tokens.",
      ru: "Строки TokenInfo: id, name, decimals, emissionAmount (строка). Это не GET /tokens.",
    },
    tryPath: "/v1/assets?limit=5",
  },
  {
    id: "assets-search",
    tab: "wallet",
    method: "GET",
    path: "/assets/search/byTokenId",
    source: "index",
    title: { en: "Asset by id prefix", ru: "Ассет по префиксу id" },
    blurb: {
      en: "query is a hex prefix, at least 5 characters.",
      ru: "query — hex-префикс, не короче 5 символов.",
    },
    query: { en: "query ≥ 5", ru: "query ≥ 5" },
  },
  {
    id: "epochs",
    tab: "wallet",
    method: "GET",
    path: "/epochs/params",
    source: "ram",
    title: { en: "Epoch parameters", ru: "Параметры эпохи" },
    blurb: {
      en: "Last node /info.parameters, kept in RAM.",
      ru: "Последние /info.parameters ноды, в RAM.",
    },
    tryPath: "/v1/epochs/params",
  },
  {
    id: "headers",
    tab: "wallet",
    method: "GET",
    path: "/blocks/headers",
    source: "snapshot",
    title: { en: "Block headers", ru: "Заголовки блоков" },
    blurb: {
      en: "Recent headers: id, height, timestamp, transactionsCount.",
      ru: "Свежие заголовки: id, height, timestamp, transactionsCount.",
    },
    tryPath: "/v1/blocks/headers?limit=5",
  },
  {
    id: "net-state",
    tab: "wallet",
    method: "GET",
    path: "/networkState",
    source: "snapshot",
    title: { en: "Network state", ru: "Состояние сети" },
    blurb: {
      en: "Tip height, lastBlockId, epoch params. maxBoxGix / maxTxGix = our *_gix_next − 1.",
      ru: "Высота tip, lastBlockId, параметры эпохи. maxBoxGix / maxTxGix = наш *_gix_next − 1.",
    },
    tryPath: "/v1/networkState",
  },
  {
    id: "boxes-gix-stream",
    tab: "wallet",
    method: "GET",
    path: "/boxes/unspent/byGlobalIndex/stream",
    source: "index",
    title: { en: "Unspent boxes by gix", ru: "Непотраченные боксы по gix" },
    blurb: {
      en: "JSON array. Require minGix and maxGix. Window ≤ 10000. Our gix in globalIndex and additive gix. Timeout 4s → 504.",
      ru: "JSON-массив. Нужны minGix и maxGix. Окно ≤ 10000. Наш gix в globalIndex и additive gix. Timeout 4s → 504.",
    },
    query: {
      en: "minGix · maxGix",
      ru: "minGix · maxGix",
    },
    tryPath: "/v1/boxes/unspent/byGlobalIndex/stream?minGix=0&maxGix=9",
  },
  {
    id: "txs-gix-stream",
    tab: "wallet",
    method: "GET",
    path: "/transactions/byGlobalIndex/stream",
    source: "index",
    title: { en: "Transactions by gix", ru: "Транзакции по gix" },
    blurb: {
      en: "JSON array of txs. Same window rules. Prefer a few hundred for full I/O. Our gix.",
      ru: "JSON-массив транзакций. Те же правила окна. Для полного I/O лучше сотни, не 10k. Наш gix.",
    },
    query: {
      en: "minGix · maxGix",
      ru: "minGix · maxGix",
    },
    tryPath: "/v1/transactions/byGlobalIndex/stream?minGix=0&maxGix=9",
  },
  {
    id: "net-stats",
    tab: "wallet",
    method: "GET",
    path: "/networkStats",
    source: "snapshot",
    title: { en: "Network stats", ru: "Статистика сети" },
    blurb: {
      en: "Supply, hashrate, and related KPIs from the home snapshot. No COUNT on chain tables.",
      ru: "Эмиссия, хешрейт и смежные KPI со снимка главной. COUNT по таблицам цепи нет.",
    },
    tryPath: "/v1/networkStats",
  },
  {
    id: "mp-addr",
    tab: "wallet",
    method: "GET",
    path: "/mempool/transactions/byAddress/{address}",
    source: "ram",
    title: { en: "Mempool by address", ru: "Мемпул по адресу" },
    blurb: {
      en: "Unconfirmed transactions that touch this address.",
      ru: "Неподтверждённые транзакции, которые касаются этого адреса.",
    },
  },
  {
    id: "mp-boxes",
    tab: "wallet",
    method: "GET",
    path: "/mempool/boxes/unspent",
    source: "ram",
    title: { en: "Mempool outputs", ru: "Выходы мемпула" },
    blurb: {
      en: "Unconfirmed boxes currently in RAM.",
      ru: "Неподтверждённые боксы, которые сейчас в RAM.",
    },
    tryPath: "/v1/mempool/boxes/unspent",
  },
  {
    id: "submit",
    tab: "wallet",
    method: "POST",
    path: "/mempool/transactions/submit",
    source: "node",
    title: { en: "Submit transaction", ru: "Отправить транзакцию" },
    blurb: {
      en: "Broadcast a signed transaction. Body must look like an Ergo tx. Node rejects map to rejected/submit_failed. Separate tighter rate limit.",
      ru: "Отправка подписанной транзакции. Тело — форма Ergo tx. Отказ ноды: rejected/submit_failed. Отдельный более жёсткий лимит.",
    },
  },

  // —— chain ——
  {
    id: "health",
    tab: "chain",
    method: "GET",
    path: "/health",
    source: "ram",
    title: { en: "Health", ru: "Health" },
    blurb: {
      en: "Public liveness: ok, network, height, lastPollOk, mempool count. No node URL, disk, or indexer internals.",
      ru: "Публичная живость: ok, сеть, высота, lastPollOk, мемпул. Без URL ноды, диска и внутренностей indexer.",
    },
    tryPath: "/v1/health",
  },
  {
    id: "info",
    tab: "chain",
    method: "GET",
    path: "/info",
    source: "ram",
    title: { en: "Node info", ru: "Инфо ноды" },
    blurb: {
      en: "Cached node /info plus lastBlockId and height. maxBoxGix / maxTxGix = our *_gix_next − 1.",
      ru: "Кэш /info ноды плюс lastBlockId и height. maxBoxGix / maxTxGix = наш *_gix_next − 1.",
    },
    tryPath: "/v1/info",
  },
  {
    id: "indexer",
    tab: "chain",
    method: "GET",
    path: "/indexer/status",
    source: "snapshot",
    title: { en: "Indexer status", ru: "Статус индексера" },
    blurb: {
      en: "Writer height versus chain tip. No disk or node URL.",
      ru: "Высота писателя относительно tip цепи. Без диска и URL ноды.",
    },
    tryPath: "/v1/indexer/status",
  },
  {
    id: "blocks",
    tab: "chain",
    method: "GET",
    path: "/blocks",
    source: "snapshot",
    title: { en: "Blocks", ru: "Блоки" },
    blurb: {
      en: "Recent blocks. Keyset, not OFFSET down the chain.",
      ru: "Свежие блоки. Keyset, не OFFSET вниз по цепи.",
    },
    tryPath: "/v1/blocks?limit=5",
  },
  {
    id: "block-id",
    tab: "chain",
    method: "GET",
    path: "/blocks/{id}",
    source: "index",
    title: { en: "Block", ru: "Блок" },
    blurb: {
      en: "By height or header id: header, size, transaction count.",
      ru: "По высоте или header id: заголовок, размер, число транзакций.",
    },
  },
  {
    id: "tx-id",
    tab: "chain",
    method: "GET",
    path: "/transactions/{id}",
    source: "index",
    title: { en: "Transaction", ru: "Транзакция" },
    blurb: {
      en: "Inputs, outputs, fee, inclusion height. Amounts are strings. Additive gix: our sequential index, or null (mempool / not stamped). Not a borrowed explorer number.",
      ru: "Входы, выходы, комиссия, высота включения. Суммы — строки. Additive gix: наш порядковый номер или null (мемпул / ещё не проставлен). Не чужой номер проводника.",
    },
  },
  {
    id: "tx-recent",
    tab: "chain",
    method: "GET",
    path: "/transactions/recent",
    source: "snapshot",
    title: { en: "Recent transactions", ru: "Свежие транзакции" },
    blurb: {
      en: "Latest confirmed transactions from the list snapshot.",
      ru: "Последние подтверждённые транзакции со снимка списка.",
    },
    tryPath: "/v1/transactions/recent?limit=5",
  },
  {
    id: "box-id",
    tab: "chain",
    method: "GET",
    path: "/boxes/{id}",
    source: "index",
    title: { en: "Box", ru: "Бокс" },
    blurb: {
      en: "Value, tokens, ErgoTree, registers R4–R9, spent or unspent. creationHeight is the declared rent clock; settlementHeight and blockId are the creating tx inclusion (null in mempool). Additive typed registers and tree constants/script/template hash (SHA-256 of template bytes). Additive gix: our sequential index, or null. Not a borrowed explorer number.",
      ru: "Value, токены, ErgoTree, регистры R4–R9, потрачен или нет. creationHeight — заявленные часы rent; settlementHeight и blockId — включение создающей tx (null в мемпуле). Additive типизированные регистры и константы/скрипт/хеш шаблона дерева (SHA-256 байт шаблона). Additive gix: наш порядковый номер или null. Не чужой номер проводника.",
    },
  },
  {
    id: "addr-card",
    tab: "chain",
    method: "GET",
    path: "/addresses/{address}",
    source: "index",
    title: { en: "Address", ru: "Адрес" },
    blurb: {
      en: "Address summary for the address page. Balances: /balance/confirmed and /balance/total. Additive name: from the open ergo-names registry by exact address, NFT anchor or ErgoTree template, with the project, who submitted it and a link to its file; null when unnamed.",
      ru: "Сводка для страницы адреса. Балансы: /balance/confirmed и /balance/total. Additive name: из открытого реестра ergo-names по точному адресу, NFT-якорю или шаблону ErgoTree — проект, кто заявил и ссылка на файл; null, если имени нет.",
    },
  },
  {
    id: "names-stats",
    tab: "chain",
    method: "GET",
    path: "/names/stats",
    source: "index",
    title: { en: "Named address stats", ru: "Сводка по адресам с именами" },
    blurb: {
      en: "Balance (nanoERG), tokenCount, txCount and lastTs of every address in /names/book, with the project, who named it and the registry file. Cached a minute.",
      ru: "Баланс (nanoERG), tokenCount, txCount и lastTs каждого адреса из /names/book, с проектом, кто дал имя и файлом реестра. Кэш минута.",
    },
  },
  {
    id: "names-book",
    tab: "chain",
    method: "GET",
    path: "/names/book",
    source: "index",
    title: { en: "Names registry", ru: "Реестр имён" },
    blurb: {
      en: "Every named address from github.com/kayolo-ergoscan/ergo-names: exact entries and NFT anchors resolved to the contracts that held them (current false for an earlier version). Template names are not listed; read name on /addresses/{address}. Loaded hourly; commit and syncedAt tell which registry state you see.",
      ru: "Все адреса с именами из github.com/kayolo-ergoscan/ergo-names: точные записи и NFT-якоря, разрешённые в контракты, которые их держали (current false — прежняя версия). Имена по шаблону здесь не перечислены — смотрите name в /addresses/{address}. Загрузка раз в час; commit и syncedAt показывают, какое состояние реестра вы видите.",
    },
  },
  {
    id: "richlist",
    tab: "chain",
    method: "GET",
    path: "/richlist",
    source: "snapshot",
    title: { en: "Rich list", ru: "Ричлист" },
    blurb: {
      en: "Addresses ranked by confirmed ERG.",
      ru: "Адреса по подтверждённому ERG.",
    },
    tryPath: "/v1/richlist?limit=5",
  },
  {
    id: "mempool",
    tab: "chain",
    method: "GET",
    path: "/mempool",
    source: "ram",
    title: { en: "Mempool", ru: "Мемпул" },
    blurb: {
      en: "Current unconfirmed transactions in RAM.",
      ru: "Текущие неподтверждённые транзакции в RAM.",
    },
    tryPath: "/v1/mempool",
  },
  {
    id: "mempool-id",
    tab: "chain",
    method: "GET",
    path: "/mempool/{id}",
    source: "ram",
    title: { en: "Mempool transaction", ru: "Транзакция в мемпуле" },
    blurb: {
      en: "One unconfirmed transaction by 64-hex id.",
      ru: "Одна неподтверждённая транзакция по 64-hex id.",
    },
  },
  {
    id: "fees",
    tab: "chain",
    method: "GET",
    path: "/fees/recommend",
    source: "ram",
    title: { en: "Fee rates", ru: "Комиссия" },
    blurb: {
      en: "economy, normal, turbo from the live histogram. Also /fees/histogram and /fees/eta.",
      ru: "economy, normal, turbo с живой гистограммы. Также /fees/histogram и /fees/eta.",
    },
    tryPath: "/v1/fees/recommend",
  },
  {
    id: "fees-hist",
    tab: "chain",
    method: "GET",
    path: "/fees/histogram",
    source: "ram",
    title: { en: "Fee histogram", ru: "Гистограмма комиссий" },
    blurb: {
      en: "Live mempool fee buckets and percentiles.",
      ru: "Живые корзины комиссий мемпула и перцентили.",
    },
    tryPath: "/v1/fees/histogram",
  },
  {
    id: "fees-eta",
    tab: "chain",
    method: "GET",
    path: "/fees/eta",
    source: "ram",
    title: { en: "Next block ETA", ru: "ETA следующего блока" },
    blurb: {
      en: "Countdown to the next ordering block from recent intervals.",
      ru: "Обратный отсчёт до следующего блока по недавним интервалам.",
    },
    tryPath: "/v1/fees/eta",
  },
  {
    id: "resolve",
    tab: "chain",
    method: "GET",
    path: "/resolve",
    source: "index",
    title: { en: "Resolve", ru: "Resolve" },
    blurb: {
      en: "q is an id, height, address, or token name. Height may start with # and use thousand separators. Hex order: tx → token → block → box. Returns hits[].path.",
      ru: "q — id, высота, адрес или имя токена. Высота может начинаться с # и содержать разделители разрядов. Hex: tx → token → block → box. Ответ: hits[].path.",
    },
    query: { en: "q", ru: "q" },
  },
  {
    id: "search",
    tab: "chain",
    method: "GET",
    path: "/search",
    source: "index",
    title: { en: "Search", ru: "Поиск" },
    blurb: {
      en: "Used when /resolve returns no hit.",
      ru: "Если /resolve ничего не нашёл.",
    },
    query: { en: "q", ru: "q" },
  },
  {
    id: "orbit",
    tab: "chain",
    method: "GET",
    path: "/network/orbit",
    source: "ram",
    title: { en: "Peer orbit", ru: "Орбита пиров" },
    blurb: {
      en: "Peer set drawn on the home orbit.",
      ru: "Набор пиров для орбиты на главной.",
    },
    tryPath: "/v1/network/orbit",
  },
  {
    id: "subblocks",
    tab: "chain",
    method: "GET",
    path: "/subblocks",
    source: "ram",
    title: { en: "Ordering window", ru: "Окно порядка" },
    blurb: {
      en: "Synthetic ordering-window progress. Not Matrix input blocks. Mainnet has no live IB stream.",
      ru: "Синтетическое окно порядка. Это не Matrix input blocks. На mainnet живого IB-стрима нет.",
    },
    tryPath: "/v1/subblocks",
  },
  {
    id: "prices-erg",
    tab: "chain",
    method: "GET",
    path: "/prices/erg",
    source: "snapshot",
    title: { en: "ERG price", ru: "Цена ERG" },
    blurb: {
      en: "CoinGecko ERG/USD from snapshot_kv.market (oracle writer). Home is a copy. usd, rank, volume24h, change24h. GET does not call CoinGecko. Pool quote is /prices/erg/oracle.",
      ru: "ERG/USD с CoinGecko из snapshot_kv.market (писатель оракулов). Home — копия. usd, rank, volume24h, change24h. GET CoinGecko не вызывает. Курс пула — /prices/erg/oracle.",
    },
    tryPath: "/v1/prices/erg",
  },
  {
    id: "prices-erg-oracle",
    tab: "chain",
    method: "GET",
    path: "/prices/erg/oracle",
    source: "snapshot",
    title: { en: "EIP-23 ERG/USD", ru: "EIP-23 ERG/USD" },
    blurb: {
      en: "Erg-USD pool NFT 011d3364… from snapshot_kv.market. usd, nanoPerUsd, boxId, height. Page is /oracles/ergusd. Cooperative feed is /oracles/erg-usd.",
      ru: "Пул Erg-USD NFT 011d3364… из snapshot_kv.market. usd, nanoPerUsd, boxId, height. Страница — /oracles/ergusd. Кооператив — /oracles/erg-usd.",
    },
    tag: { en: "EIP-23 · market", ru: "EIP-23 · market" },
    tryPath: "/v1/prices/erg/oracle",
  },

  // —— tokens ——
  {
    id: "tokens-catalog",
    tab: "tokens",
    method: "GET",
    path: "/tokens",
    source: "snapshot",
    title: { en: "Token catalog", ru: "Каталог токенов" },
    blurb: {
      en: "Shape is fixed: tokenId, kpis, sort. This is the /tokens page. TokenInfo list is /assets.",
      ru: "Форма фиксирована: tokenId, kpis, sort. Это страница /tokens. Список TokenInfo — /assets.",
    },
    query: { en: "q · sort · limit · offset", ru: "q · sort · limit · offset" },
    tryPath: "/v1/tokens?limit=5",
  },
  {
    id: "token-card",
    tab: "tokens",
    method: "GET",
    path: "/tokens/{id}",
    source: "index",
    title: { en: "Token", ru: "Токен" },
    blurb: {
      en: "Card by token id. Additive field id = tokenId. If stored decimals are 0 and emission ≠ 1, known decimals are filled in. isNft uses stored decimals.",
      ru: "Карточка по token id. Поле id = tokenId. Если decimals в индексе 0 и emission ≠ 1 — подставляем известные. isNft считает хранимые decimals.",
    },
  },
  {
    id: "token-holders",
    tab: "tokens",
    method: "GET",
    path: "/tokens/{id}/holders",
    source: "index",
    title: { en: "Holders", ru: "Холдеры" },
    blurb: {
      en: "Holder tape, keyset amount|address. Next replaces 25. Txs and first/last from token_balances snapshot (this token). Tokens column is this token’s amount; sharePct is % of tokens.emission.",
      ru: "Лента холдеров, keyset amount|address. Дальше подменяет 25. Txs и первая/последняя — снимок token_balances (этот токен). Tokens — сумма этого токена; sharePct — доля tokens.emission.",
    },
  },
  {
    id: "token-txs",
    tab: "tokens",
    method: "GET",
    path: "/tokens/{id}/txs",
    source: "index",
    title: { en: "Token transactions", ru: "Транзакции токена" },
    blurb: {
      en: "Tx tape, keyset height:txId. Next replaces 25. Columns: type, this token’s amount, from, to, tx, time, height. from/to are addresses of boxes that moved this token.",
      ru: "Лента транзакций, keyset height:txId. Дальше подменяет 25. Колонки: тип, сумма токена, from, to, tx, time, height. from/to — адреса боксов, где шёл этот токен.",
    },
  },
  {
    id: "token-pools",
    tab: "tokens",
    method: "GET",
    path: "/tokens/{id}/pools",
    source: "index",
    title: { en: "Pools", ru: "Пулы" },
    blurb: {
      en: "Spectrum / ergo-dex pools for this token.",
      ru: "Пулы Spectrum / ergo-dex для этого токена.",
    },
  },
  {
    id: "token-price",
    tab: "tokens",
    method: "GET",
    path: "/tokens/{id}/price",
    source: "snapshot",
    title: { en: "Token price", ru: "Цена токена" },
    blurb: {
      en: "Last price we have. ERG CoinGecko is /prices/erg. Oracle is /prices/erg/oracle.",
      ru: "Последняя цена. ERG с CoinGecko — /prices/erg. Оракул — /prices/erg/oracle.",
    },
  },
  {
    id: "nfts-catalog",
    tab: "tokens",
    method: "GET",
    path: "/nfts/catalog",
    source: "index",
    title: { en: "NFT catalog", ru: "Каталог NFT" },
    blurb: {
      en: "Tokens with emission = 1. Artwork from mint-output registers in the index.",
      ru: "Токены emission = 1. Картинки из регистров mint-выхода в индексе.",
    },
    tryPath: "/v1/nfts/catalog?limit=5",
  },
  {
    id: "nfts-recent",
    tab: "tokens",
    method: "GET",
    path: "/nfts/recent",
    source: "index",
    title: { en: "Recent NFTs", ru: "Свежие NFT" },
    blurb: {
      en: "Newest mint boxes, emission = 1.",
      ru: "Последние mint-боксы, emission = 1.",
    },
    tryPath: "/v1/nfts/recent",
  },
  {
    id: "nfts-search",
    tab: "tokens",
    method: "GET",
    path: "/nfts/search",
    source: "index",
    title: { en: "Search NFTs", ru: "Поиск NFT" },
    blurb: {
      en: "Name search, emission = 1 only.",
      ru: "Поиск по имени, только emission = 1.",
    },
    query: { en: "q", ru: "q" },
  },
  {
    id: "nfts-collections",
    tab: "tokens",
    method: "GET",
    path: "/nfts/collections",
    source: "index",
    title: { en: "Collections", ru: "Коллекции" },
    blurb: {
      en: "Name groups (#n / edition). Also /nfts/collections/{slug}.",
      ru: "Группы имён (#n / edition). Также /nfts/collections/{slug}.",
    },
    tryPath: "/v1/nfts/collections",
  },
  {
    id: "nfts-issuers",
    tab: "tokens",
    method: "GET",
    path: "/nfts/issuers",
    source: "index",
    title: { en: "Issuers", ru: "Авторы" },
    blurb: {
      en: "Issuer-box addresses (spent box_id = token_id). Also /nfts/issuers/{address}.",
      ru: "Адреса issuer-box (потраченный box_id = token_id). Также /nfts/issuers/{address}.",
    },
    tryPath: "/v1/nfts/issuers",
  },
  {
    id: "nfts-collection",
    tab: "tokens",
    method: "GET",
    path: "/nfts/collections/{slug}",
    source: "index",
    title: { en: "Collection", ru: "Коллекция" },
    blurb: {
      en: "One name-group: items, total, artwork. 404 if the slug is empty.",
      ru: "Одна группа имён: items, total, artwork. 404 если slug пустой.",
    },
  },
  {
    id: "nfts-issuer",
    tab: "tokens",
    method: "GET",
    path: "/nfts/issuers/{address}",
    source: "index",
    title: { en: "Issuer", ru: "Автор" },
    blurb: {
      en: "NFTs minted from this issuer-box address.",
      ru: "NFT, сминченные с этого адреса issuer-box.",
    },
  },

  // —— more ——
  {
    id: "defi-trades",
    tab: "more",
    method: "GET",
    path: "/defi/trades",
    source: "index",
    title: { en: "DEX trades", ru: "Сделки DEX" },
    blurb: {
      en: "Unified N2T + T2T fills from schema defi.",
      ru: "Unified N2T + T2T fills из схемы defi.",
    },
    tryPath: "/v1/defi/health",
  },
  {
    id: "defi-ranks",
    tab: "more",
    method: "GET",
    path: "/defi/ranks",
    source: "index",
    title: { en: "DEX ranks", ru: "Ранги DEX" },
    blurb: {
      en: "Pair ranks for /defi.",
      ru: "Ранги пар для /defi.",
    },
  },
  {
    id: "defi-volume-history",
    tab: "more",
    method: "GET",
    path: "/defi/volume-history",
    source: "index",
    title: { en: "DEX volume walls", ru: "Стены объёма DEX" },
    blurb: {
      en: "N2T SUM(base_amount) by UTC wall. ?days=7|30|90&venue=spectrum_cfmm|lithos_dex&poolId=.",
      ru: "N2T SUM(base_amount) по UTC-стенам. ?days=7|30|90&venue=&poolId=.",
    },
  },
  {
    id: "defi-pool-board",
    tab: "more",
    method: "GET",
    path: "/defi/pool-board",
    source: "index",
    title: { en: "ErgoDex pool board", ru: "Доска пулов ErgoDex" },
    blurb: {
      en: "All Spectrum pools from registry + pool_snap. TVL, 24h vol, all-time N2T vol, trade count, first and last fill. Per-pool traders is null. Not GET /pools.",
      ru: "Все пулы Spectrum из registry + pool_snap. TVL, объём 24ч, объём N2T за всю историю индекса, число сделок, первая и последняя. Трейдеры на пул — null. Не GET /pools.",
    },
  },
  {
    id: "defi-pools",
    tab: "more",
    method: "GET",
    path: "/defi/pools",
    source: "index",
    title: { en: "DEX pools", ru: "Пулы DEX" },
    blurb: {
      en: "Live pools with a fill, newest first. LithosDex also from the registry before the first fill. ?venue=",
      ru: "Живые пулы с fill, сначала свежие. LithosDex и из registry до первого fill. ?venue=",
    },
  },
  {
    id: "defi-pool-history",
    tab: "more",
    method: "GET",
    path: "/defi/pool-history",
    source: "index",
    title: { en: "DEX pool TVL ticks", ru: "Тики TVL пула" },
    blurb: {
      en: "Per-pool TVL / 24h vol from the writer, one point per hour, 14 days. ?poolId=&hours=24. Not a genesis walk.",
      ru: "TVL / объём 24ч по пулу от писателя, одна точка в час, 14 дней. ?poolId=&hours=24. Не genesis.",
    },
  },
  {
    id: "defi-price-history",
    tab: "more",
    method: "GET",
    path: "/defi/price-history",
    source: "index",
    title: { en: "DEX price ticks", ru: "Тики цены DEX" },
    blurb: {
      en: "Price series for a token or pool from fills.",
      ru: "Ряд цены токена или пула по fill.",
    },
  },
  {
    id: "defi-ohlc",
    tab: "more",
    method: "GET",
    path: "/defi/ohlc",
    source: "index",
    title: { en: "DEX OHLC", ru: "DEX OHLC" },
    blurb: {
      en: "Candles for a pair. Also /defi/price-history.",
      ru: "Свечи пары. Также /defi/price-history.",
    },
  },
  {
    id: "defi-health",
    tab: "more",
    method: "GET",
    path: "/defi/health",
    source: "index",
    title: { en: "DEX health", ru: "DEX health" },
    blurb: {
      en: "Projector cursor, tip, trade counts, lag.",
      ru: "Курсор проектора, tip, число сделок, лаг.",
    },
    tryPath: "/v1/defi/health",
  },
  {
    id: "defi-ageusd",
    tab: "more",
    method: "GET",
    path: "/defi/ageusd",
    source: "index",
    title: { en: "AgeUSD bank", ru: "Банк AgeUSD" },
    blurb: {
      en: "Live AgeUSD v2 bank box and leftover bank-NFT events. Not ErgoDex AMM.",
      ru: "Живой бокс банка AgeUSD v2 и события bank-NFT. Не AMM ErgoDex.",
    },
    tryPath: "/v1/defi/ageusd",
  },
  {
    id: "defi-lithos",
    tab: "more",
    method: "GET",
    path: "/defi/lithos",
    source: "index",
    title: { en: "LithosDex", ru: "LithosDex" },
    blurb: {
      en: "LithosDex page snapshot: TVL, volume, traders, fills, pools. From defi.swaps / pool_snap. Not lithos.work HTTP.",
      ru: "Снимок LithosDex: TVL, объём, трейдеры, fills, пулы. Из defi.swaps / pool_snap. Не HTTP lithos.work.",
    },
    tryPath: "/v1/defi/lithos",
  },
  {
    id: "defi-spectrum",
    tab: "more",
    method: "GET",
    path: "/defi/spectrum",
    source: "index",
    title: { en: "ErgoDex AMM", ru: "ErgoDex AMM" },
    blurb: {
      en: "ErgoDex page snapshot: TVL (≥100 ERG, else fill-gated), N2T volume + tradesCount, CFMM+N2N tape (eventsCount). ?tokenId= filters KPIs/traders/pools. From defi.swaps / pool_snap. Not spectrum.fi HTTP.",
      ru: "Снимок ErgoDex: TVL (≥100 ERG, иначе по fills), объём и tradesCount N2T, лента CFMM+N2N (eventsCount). ?tokenId= на KPI/трейдеров/пулы. Из defi.swaps / pool_snap. Не HTTP spectrum.fi.",
    },
    tryPath: "/v1/defi/spectrum",
  },
  {
    id: "rosen",
    tab: "more",
    method: "GET",
    path: "/rosen/events",
    source: "index",
    title: { en: "Rosen events", ru: "События Rosen" },
    blurb: {
      en: "Event Trigger tape from schema rosen. Writer follows tip.",
      ru: "Лента Event Trigger из схемы rosen. Писатель идёт за tip.",
    },
    tryPath: "/v1/rosen/health",
  },
  {
    id: "rosen-health",
    tab: "more",
    method: "GET",
    path: "/rosen/health",
    source: "index",
    title: { en: "Rosen health", ru: "Rosen health" },
    blurb: {
      en: "Scan height, tip, event counts.",
      ru: "Высота скана, tip, счётчики событий.",
    },
    tryPath: "/v1/rosen/health",
  },
  {
    id: "graphql",
    tab: "more",
    method: "POST",
    path: "/graphql",
    source: "index",
    title: { en: "GraphQL", ru: "GraphQL" },
    blurb: {
      en: "Our schema on this gateway. Indexed roots: box, transaction, address (keyset), token, gix windows, mempool, oracles, defi, rosen, submitTx. submitTx shares the REST submit limit; errors map to rejected/submit_failed. Amounts are strings. Depth ≤ 7.",
      ru: "Наша схема на этом шлюзе. Индексированные корни: box, transaction, address (keyset), token, окна gix, mempool, oracles, defi, rosen, submitTx. submitTx — тот же лимит, что REST submit; ошибки: rejected/submit_failed. Суммы — строки. Глубина ≤ 7.",
    },
    query: {
      en: "POST { query, variables? } · GET → 405 · depth ≤ 7",
      ru: "POST { query, variables? } · GET → 405 · глубина ≤ 7",
    },
  },
  {
    id: "oracles",
    tab: "more",
    method: "GET",
    path: "/oracles/{slug}",
    source: "index",
    title: { en: "Oracle feed", ru: "Оракул" },
    blurb: {
      en: "Live pool snap, operators, and chart ticks from schema oracle. Operator address is the P2PK in R4, not the shared datapoint P2S. slug=ergusd|erg-usd|xau-erg. GET does not scan boxes or call the node.",
      ru: "Живой снимок пула, операторы и тики графика из schema oracle. Адрес оператора — P2PK из R4, не общий P2S датапойнта. slug=ergusd|erg-usd|xau-erg. GET не сканит боксы и не зовёт ноду.",
    },
    query: {
      en: "range=7d|30d",
      ru: "range=7d|30d",
    },
    tag: { en: "schema oracle", ru: "schema oracle" },
    tryPath: "/v1/oracles/erg-usd?range=7d",
  },
  {
    id: "oracle-buyback",
    tab: "more",
    method: "GET",
    path: "/oracles/{slug}/buyback",
    source: "index",
    title: { en: "Oracle buyback", ru: "Выкуп оракула" },
    blurb: {
      en: "GORT (slug xau-erg) or DORT (slug erg-usd) buyback box from the index: ERG and tokens in the box, mint top-ups, pool swaps, returns, and the tape. Reads that NFT's boxes. Does not call the node.",
      ru: "Ящик выкупа GORT (slug xau-erg) или DORT (slug erg-usd) из индекса: ERG и токены в ящике, пополнения с минта, покупки с пула, возвраты и лента. Читает боксы этого NFT. Ноду не зовёт.",
    },
    tag: { en: "packed boxes", ru: "packed boxes" },
    tryPath: "/v1/oracles/erg-usd/buyback",
  },
  {
    id: "oracles-health",
    tab: "more",
    method: "GET",
    path: "/oracles/health",
    source: "index",
    title: { en: "Oracle projector", ru: "Проектор оракулов" },
    blurb: {
      en: "ergoscan-oracle-projector cursor: mode, scanHeight, ready, live counts per feed. ready=false until pool_snap exists. Proof for /status. Prices are snapshot_kv.market on the same writer.",
      ru: "Курсор ergoscan-oracle-projector: mode, scanHeight, ready, live по кормам. ready=false пока нет pool_snap. Доказательство для /status. Цены — snapshot_kv.market у того же писателя.",
    },
    tag: { en: "schema oracle · health", ru: "schema oracle · health" },
    tryPath: "/v1/oracles/health",
  },
  {
    id: "rent",
    tab: "more",
    method: "GET",
    path: "/rent/at-risk",
    source: "index",
    title: { en: "Storage rent", ru: "Storage rent" },
    blurb: {
      en: "Unspent boxes approaching rent. Also /rent/box/{id} and /page/rent. Additive collected.series: weekly UTC bins.",
      ru: "Непотраченные боксы ближе к rent. Также /rent/box/{id} и /page/rent. Additive collected.series: недели UTC.",
    },
    tryPath: "/v1/page/rent?tab=oldest&limit=5",
  },
  {
    id: "rent-box",
    tab: "more",
    method: "GET",
    path: "/rent/box/{id}",
    source: "index",
    title: { en: "Box rent", ru: "Rent бокса" },
    blurb: {
      en: "Storage-rent clock for one unspent box.",
      ru: "Часы storage rent для одного непотраченного бокса.",
    },
  },
  {
    id: "page-rent",
    tab: "more",
    method: "GET",
    path: "/page/rent",
    source: "snapshot",
    title: { en: "Rent page", ru: "Страница rent" },
    blurb: {
      en: "One GET for /rent: due, collected, forecast.",
      ru: "Один GET для /rent: due, collected, forecast.",
    },
    tryPath: "/v1/page/rent?tab=oldest&limit=5",
  },
  {
    id: "page-home",
    tab: "more",
    method: "GET",
    path: "/page/home",
    source: "snapshot",
    title: { en: "Home snapshot", ru: "Снимок главной" },
    blurb: {
      en: "One GET for the home dashboard.",
      ru: "Один GET для главной.",
    },
    tryPath: "/v1/page/home",
  },
  {
    id: "page-addresses",
    tab: "more",
    method: "GET",
    path: "/page/addresses",
    source: "snapshot",
    title: { en: "Addresses snapshot", ru: "Снимок адресов" },
    blurb: {
      en: "Rich-list page payload. Additive band= and kind= are comma lists (OR / union, same holder_bands CASE; live SQL when filtered). Empty = All. Mixed band+kind omits total.",
      ru: "Поле страницы адресов. Additive band= и kind= — списки через запятую (OR / union, тот же CASE, что holder_bands; при фильтре — live SQL). Пусто = All. Смешанный band+kind без total.",
    },
  },
  {
    id: "page-address",
    tab: "more",
    method: "GET",
    path: "/page/address/{id}",
    source: "index",
    title: { en: "Address page", ru: "Страница адреса" },
    blurb: {
      en: "One GET for the address card. Indexer blob has no disk fields.",
      ru: "Один GET для карточки адреса. В indexer нет disk-полей.",
    },
  },
  {
    id: "graph",
    tab: "more",
    method: "GET",
    path: "/graph/tx/{id}",
    source: "index",
    title: { en: "Transaction graph", ru: "Граф транзакции" },
    blurb: {
      en: "eUTXO neighbors of a transaction.",
      ru: "Соседи eUTXO у транзакции.",
    },
  },
  {
    id: "media",
    tab: "more",
    method: "GET",
    path: "/media/ipfs/{cid}",
    source: "index",
    title: { en: "IPFS media", ru: "IPFS-медиа" },
    blurb: {
      en: "Gateway fetch for NFT artwork by CID. No disk cache.",
      ru: "Выдача artwork NFT по CID. Кэша на диске нет.",
    },
  },
  {
    id: "ws",
    tab: "more",
    method: "GET",
    path: "/stream",
    source: "ram",
    title: { en: "WebSocket", ru: "WebSocket" },
    blurb: {
      en: "wss://ergoscan.me/v1/stream — tip and mempool updates. Not a global-index box/tx stream.",
      ru: "wss://ergoscan.me/v1/stream — обновления tip и мемпула. Это не стрим box/tx по global index.",
    },
  },
  {
    id: "openapi",
    tab: "more",
    method: "GET",
    path: "/openapi.json",
    source: "ram",
    title: { en: "OpenAPI", ru: "OpenAPI" },
    blurb: {
      en: "OpenAPI 3 for codegen. Amounts in schemas are strings.",
      ru: "OpenAPI 3 для генерации клиента. В схемах суммы — строки.",
    },
    tryPath: "/openapi.json",
  },
];
