import { AddressStatTile } from "@/components/AddressStatTile";
import { HolderMark } from "@/components/HolderMark";
import { mergeBands, type HolderBandId } from "@/lib/holder-bands";
import { INK } from "@/lib/palette";

const RANK_INK: Record<HolderBandId, string> = {
  dust: INK.sky,
  stacker: INK.cyan,
  believer: INK.green,
  guardian: INK.gold,
  overlord: INK.coral,
};

export function HolderBandStrip({
  raw,
  t,
  loc,
  selected,
  onSelect,
  enterFrom = 0,
}: {
  raw: unknown;
  t: (key: string) => string;
  loc: string;
  selected?: readonly HolderBandId[] | null;
  onSelect?: (id: HolderBandId) => void;
  enterFrom?: number;
}) {
  const rows = mergeBands(raw);
  const on = new Set(selected ?? []);
  return (
    <>
      {rows.map((b, i) => {
        const id = b.id as HolderBandId;
        return (
          <AddressStatTile
            key={b.id}
            enter={enterFrom + i}
            label={t(`addresses.band.${id}`)}
            n={b.n}
            caption={t(`addresses.band.${id}Range`)}
            detail={t(`addresses.band.${id}RangeFull`)}
            hint={t(`addresses.band.${id}Flavor`)}
            ink={RANK_INK[id]}
            loc={loc}
            mark={<HolderMark id={id} className="h-9 w-9 shrink-0" />}
            selected={on.has(id)}
            onSelect={onSelect ? () => onSelect(id) : undefined}
          />
        );
      })}
    </>
  );
}
