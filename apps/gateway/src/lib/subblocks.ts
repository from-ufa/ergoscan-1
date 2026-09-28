/**
 * Synthetic ordering-window planner (not Matrix input blocks).
 */
import {
  SUBBLOCK_DISCLAIMER,
  type PulseSource,
  type SubblockPulse,
  type SubblockSnapshot,
} from "@ergoscan/shared";

export class SubblockEngine {
  private slots = 30;
  private source: PulseSource = "synthetic";
  private tipHeight = 0;
  private lastBlockTs = Date.now();
  private avgIntervalMs = 120_000;
  private lastEmittedIndex = -1;

  setParams(slots: number, source: PulseSource = "synthetic"): void {
    if (Number.isFinite(slots) && slots > 0) this.slots = Math.floor(slots);
    this.source = source;
  }

  resync(p: { tipHeight: number; lastBlockTs: number; avgIntervalMs: number }): void {
    const newTip = p.tipHeight !== this.tipHeight;
    this.tipHeight = p.tipHeight;
    this.lastBlockTs = p.lastBlockTs;
    this.avgIntervalMs = Math.max(1, p.avgIntervalMs);
    if (newTip) this.lastEmittedIndex = -1;
  }

  private progress(): { windowProgress: number; currentIndex: number } {
    const elapsed = Math.max(0, Date.now() - this.lastBlockTs);
    const windowProgress = Math.min(1, elapsed / this.avgIntervalMs);
    const currentIndex = Math.min(
      this.slots - 1,
      Math.max(0, Math.floor(windowProgress * this.slots))
    );
    return { windowProgress, currentIndex };
  }

  private pulse(index: number, ts: number, windowProgress: number): SubblockPulse {
    return {
      id: `${this.tipHeight}-${index}-${ts}`,
      orderingHeight: this.tipHeight,
      index,
      total: this.slots,
      ts,
      phase: "provisional",
      windowProgress,
      source: this.source,
    };
  }

  snapshot(): SubblockSnapshot {
    const { windowProgress, currentIndex } = this.progress();
    const ts = Date.now();
    const pulses: SubblockPulse[] = [];
    for (let i = 0; i <= currentIndex; i++) {
      pulses.push(this.pulse(i, ts, windowProgress));
    }
    return {
      plan: {
        orderingHeight: this.tipHeight,
        slots: this.slots,
        windowStartTs: this.lastBlockTs,
        windowEndTs: this.lastBlockTs + this.avgIntervalMs,
        avgIntervalMs: this.avgIntervalMs,
        source: this.source,
      },
      currentIndex,
      pulses,
      disclaimer: SUBBLOCK_DISCLAIMER,
    };
  }

  tick(): SubblockPulse[] {
    const { windowProgress, currentIndex } = this.progress();
    const ts = Date.now();
    const out: SubblockPulse[] = [];
    while (this.lastEmittedIndex < currentIndex) {
      this.lastEmittedIndex += 1;
      out.push(this.pulse(this.lastEmittedIndex, ts, windowProgress));
    }
    return out;
  }
}
