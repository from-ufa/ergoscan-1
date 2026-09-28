import { txToBall, type RawTx } from "./balls.js";
import type { BallProps } from "./types.js";

const CATS = ["transfer", "token", "nft", "defi", "bridge", "oracle"] as const;

/** Synthetic mempool for offline / empty-node demos */
export function generateMockBalls(n = 48): BallProps[] {
  const now = Date.now();
  const balls: BallProps[] = [];
  for (let i = 0; i < n; i++) {
    const cat = CATS[i % CATS.length];
    const outputs =
      cat === "transfer"
        ? [{ value: 1_000_000_000 + i * 1e6 }]
        : [
            {
              value: 100_000_000,
              assets: [
                {
                  tokenId: (cat === "nft" ? "a" : "b").repeat(32).slice(0, 64),
                  amount: cat === "nft" ? 1 : 1000 + i,
                },
              ],
            },
          ];
    const tx: RawTx = {
      id: mockTxId(i, now),
      size: 200 + Math.floor(Math.random() * 2400),
      inputs: [{ boxId: mockTxId(i + 999, now) }],
      outputs,
    };
    const ball = txToBall(tx, now - Math.floor(Math.random() * 120_000));
    // force category variety for demo
    ball.category = cat;
    ball.color =
      cat === "transfer"
        ? "#5B8CFF"
        : cat === "token"
          ? "#2DD4BF"
          : cat === "nft"
            ? "#A78BFA"
            : cat === "defi"
              ? "#FBBF24"
              : cat === "bridge"
                ? "#22D3EE"
                : "#34D399";
    balls.push(ball);
  }
  return balls;
}

function mockTxId(i: number, salt: number): string {
  const h = (i * 2654435761 + salt) >>> 0;
  return (h.toString(16).padStart(8, "0") + "cafebabe".repeat(7)).slice(0, 64);
}
