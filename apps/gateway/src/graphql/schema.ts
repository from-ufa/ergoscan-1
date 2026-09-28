/**
 * Our GraphQL — not a port of nautls / SigmaSpace / gql.ergoplatform.com.
 * Only indexed roots. No ErgoTree / template-hash / unbounded unspent.
 */
export const GRAPHQL_SDL = /* GraphQL */ `
  type Query {
    info: Info!
    state: State!
    box(id: ID!): Box
    transaction(id: ID!): Transaction
    address(id: ID!): Address
    token(id: ID!): Token
    boxesByGix(minGix: String!, maxGix: String!): [Box!]!
    transactionsByGix(minGix: String!, maxGix: String!): [Transaction!]!
    mempool: Mempool!
    oracles: Oracles!
    defi: Defi!
    rosen: Rosen!
  }

  type Mutation {
    submitTx(signedJson: String!): SubmitResult!
  }

  type Info {
    gateway: String!
    height: Int
    lastBlockId: String
    maxBoxGix: String
    maxTxGix: String
    network: String!
  }

  type State {
    height: Int
    lastBlockId: String
    maxBoxGix: String
    maxTxGix: String
    network: String!
    source: String!
  }

  type Asset {
    tokenId: String!
    amount: String!
  }

  type Box {
    boxId: ID!
    value: String!
    address: String
    ergoTree: String
    transactionId: String
    spentTransactionId: String
    index: Int
    gix: String
    creationHeight: Int
    blockId: String
    assets: [Asset!]!
    additionalRegisters: String
  }

  type Transaction {
    id: ID!
    blockId: String
    inclusionHeight: Int
    timestamp: String
    index: Int
    gix: String
    size: Int
    fee: String
    inputs: [Box!]!
    outputs: [Box!]!
  }

  type BoxPage {
    items: [Box!]!
    hasMore: Boolean!
    nextCursor: String
  }

  type TxHead {
    id: ID!
    inclusionHeight: Int
    timestamp: String
    size: Int
    fee: String
  }

  type TxPage {
    items: [TxHead!]!
    hasMore: Boolean!
    nextCursor: String
  }

  type AddressBalance {
    nanoErgs: String!
    tokens: [Asset!]!
  }

  type Address {
    address: ID!
    used: Boolean!
    balance: AddressBalance
    unspent(cursor: String, limit: Int = 50): BoxPage
    transactions(cursor: String, limit: Int = 50): TxPage
  }

  type Token {
    tokenId: ID!
    name: String
    decimals: Int
    emission: String
    boxId: String
  }

  type MempoolTx {
    id: ID!
    size: Int
  }

  type Mempool {
    size: Int!
    transactions(limit: Int = 50): [MempoolTx!]!
  }

  type Oracles {
    ready: Boolean!
    mode: String
    scanHeight: Int
    feed(slug: String!): OracleFeed
  }

  type OracleFeed {
    slug: String!
    ready: Boolean!
    pair: String!
    quote: Float
    live: Int
    poolBoxId: String
  }

  type Defi {
    ready: Boolean!
    source: String!
  }

  type Rosen {
    ready: Boolean!
    eventsTotal: Int
    scanHeight: Int
    source: String!
  }

  type SubmitResult {
    id: String
    error: String
  }
`;

export const GRAPHQL_MAX_DEPTH = 7;
export const GRAPHQL_MAX_BODY = 16_384;
