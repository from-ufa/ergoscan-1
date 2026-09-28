/**
 * HTTP prefetch for upcoming block heights. SQL stays serial in indexHeight.
 * PREFETCH_BLOCKS=1 turns this into one-at-a-time (rollback).
 *
 * start() always attaches a rejection handler so neighbors the tick never
 * take() cannot become unhandledRejection (Node default → exit 1).
 */
export function createBlockPrefetch<T>(opts: {
  load: (height: number) => Promise<T>;
  concurrency: number;
}): {
  ensure: (heights: number[]) => void;
  take: (height: number) => Promise<T>;
  drop: (height: number) => void;
  dropFrom: (height: number) => void;
} {
  const concurrency = Math.max(1, Math.trunc(opts.concurrency) || 1);
  const inflight = new Map<number, Promise<T>>();
  let active = 0;
  const waiters: Array<() => void> = [];

  function acquire(): Promise<void> {
    if (active < concurrency) {
      active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      waiters.push(() => {
        active++;
        resolve();
      });
    });
  }

  function release(): void {
    active--;
    const next = waiters.shift();
    if (next) next();
  }

  function start(height: number): Promise<T> {
    const p = (async () => {
      await acquire();
      try {
        return await opts.load(height);
      } finally {
        release();
      }
    })();
    inflight.set(height, p);
    void p.catch(() => {
      /* taken: take() still sees the rejection; untouched neighbors stay quiet */
    });
    return p;
  }

  function ensure(heights: number[]): void {
    for (const raw of heights) {
      const h = Math.trunc(raw);
      if (!Number.isFinite(h) || h < 0) continue;
      if (inflight.has(h)) continue;
      start(h);
    }
  }

  async function take(height: number): Promise<T> {
    const h = Math.trunc(height);
    ensure([h]);
    const p = inflight.get(h);
    if (!p) throw new Error(`prefetch missing ${h}`);
    try {
      return await p;
    } catch (e) {
      inflight.delete(h);
      throw e;
    }
  }

  function drop(height: number): void {
    inflight.delete(Math.trunc(height));
  }

  function dropFrom(height: number): void {
    const lo = Math.trunc(height);
    for (const h of [...inflight.keys()]) {
      if (h >= lo) inflight.delete(h);
    }
  }

  return { ensure, take, drop, dropFrom };
}
