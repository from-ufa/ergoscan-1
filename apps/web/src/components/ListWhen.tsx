import { formatClockTime, formatNumericDate } from "@/lib/format";

/** Time column: clock on the first line, numeric date on the second. */
export function ListWhen({
  ts,
  locale,
}: {
  ts: number | null | undefined;
  locale?: string;
}) {
  const time = formatClockTime(ts, locale);
  const date = formatNumericDate(ts, locale);
  if (time === "—" && date === "—") {
    return <span className="text-[var(--muted)]">—</span>;
  }
  return (
    <div>
      <p className="tabular-nums">{time}</p>
      <p className="mt-0.5 text-[11px] text-[var(--muted)]">{date}</p>
    </div>
  );
}
