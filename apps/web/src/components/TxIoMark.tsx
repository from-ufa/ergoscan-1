/** Compact in → out counts. Same mark on the block tape and the tx value tile. */
export function TxIoMark({
  inputs,
  outputs,
  inLabel,
  outLabel,
}: {
  inputs: number;
  outputs: number;
  inLabel: string;
  outLabel: string;
}) {
  if (!inputs && !outputs) {
    return <span className="text-[var(--muted)]">—</span>;
  }
  return (
    <div className="tx-io" aria-label={`${inputs} ${inLabel}, ${outputs} ${outLabel}`}>
      <div className="tx-io-side">
        <p className="tx-io-n">{inputs}</p>
        <p className="tx-io-k">{inLabel}</p>
      </div>
      <span className="tx-io-flow" aria-hidden>
        <svg viewBox="0 0 28 12" width="28" height="12">
          <path className="tx-io-rail" d="M1.5 6h20" />
          <path className="tx-io-pulse" d="M1.5 6h20" />
          <path className="tx-io-head" d="M18.5 2.75 25 6l-6.5 3.25" />
        </svg>
      </span>
      <div className="tx-io-side tx-io-side-out">
        <p className="tx-io-n">{outputs}</p>
        <p className="tx-io-k">{outLabel}</p>
      </div>
    </div>
  );
}
