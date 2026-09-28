/**
 * Small catalog of well-known token ids + platform labels.
 * Classification of live txs is tx-shape (P2PK vs contract), not these brands.
 */

export type KnownTokenMeta = {
  name: string;
  platform?: string;
  category?: string;
};

/** Live `/v1/platforms` reports `knownTokens: 7` — keep that count. */
export const KNOWN_TOKENS: Record<string, KnownTokenMeta> = {
  "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04": {
    name: "SigmaUSD",
    platform: "sigmausd",
    category: "stable",
  },
  "003bd19d0187117f130b62e1bcab0939929ff5c7709f843c5c4dd158949285d0": {
    name: "SigmaRSV",
    platform: "sigmausd",
    category: "stable",
  },
  "00bd762484086cf560d3127eb53f0769d76244d9737636bceafd96348dacc56d": {
    name: "Gluon GAU",
    platform: "gluon",
    category: "stable",
  },
  "8b08cdd5449a9592a9e79711d7d79249d7a03c535d17efaee83e216e80a44c4b": {
    name: "Rosen",
    platform: "rosen",
    category: "bridge",
  },
  "9a06d9e545a41fd51eeffc5e20d818073bf820c700998e1dca01d4e448dac76c": {
    name: "Spectrum Finance",
    platform: "spectrum",
    category: "defi",
  },
  "d71693c49a84fbbecd4908c94813b46514b18b67a99952dc1e6e4791556de413": {
    name: "ErgoPad",
    category: "defi",
  },
  "1fd6e032e8476c4aa54c18c1a308dce83940e8f4a28f576440513ed7326ad489": {
    name: "Paideia",
    platform: "paideia",
    category: "defi",
  },
};

export type PlatformInfo = {
  id: string;
  name: string;
  category: string;
};

export const PLATFORMS: PlatformInfo[] = [
  { id: "sigmausd", name: "SigmaUSD", category: "stable" },
  { id: "gluon", name: "Gluon", category: "stable" },
  { id: "rosen", name: "Rosen Bridge", category: "bridge" },
  { id: "spectrum", name: "Spectrum DEX", category: "defi" },
  { id: "duckpools", name: "Duckpools", category: "defi" },
  { id: "ergodex", name: "ErgoDEX / AMM", category: "defi" },
  { id: "oracle", name: "Oracle pool", category: "oracle" },
  { id: "paideia", name: "Paideia DAO", category: "defi" },
  { id: "mixer", name: "ErgoMixer / privacy", category: "mixer" },
  { id: "auction", name: "Auction / marketplace", category: "nft" },
  { id: "agent", name: "Contract / agent deploy", category: "agent" },
  { id: "eip4-mint", name: "EIP-4 mint", category: "token" },
];

export function listPlatforms(): PlatformInfo[] {
  return PLATFORMS;
}
