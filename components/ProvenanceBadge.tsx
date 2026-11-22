import { DATA_KIND, type DataKind } from "@/types/provenance";

const STYLE: Record<DataKind, string> = {
  observed: "border-cyan/50 text-cyan",
  estimated: "border-amber-300/50 text-amber-200",
  artistic: "border-violet-300/50 text-violet-200",
  theoretical: "border-rose-300/50 text-rose-200",
};

/** Small pill that says what kind of data a value is. The label text always carries the meaning, colour is only a hint. */
export default function ProvenanceBadge({ kind }: { kind: DataKind }) {
  return (
    <span
      title={DATA_KIND[kind].blurb}
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-px text-[10px] uppercase tracking-wider ${STYLE[kind]}`}
    >
      {DATA_KIND[kind].label}
    </span>
  );
}

export function ProvenanceLegend() {
  return (
    <ul className="mt-2 space-y-1.5">
      {(Object.keys(DATA_KIND) as DataKind[]).map((k) => (
        <li key={k} className="flex items-start gap-2">
          <ProvenanceBadge kind={k} />
          <span className="text-[11px] leading-snug text-muted">{DATA_KIND[k].blurb}</span>
        </li>
      ))}
    </ul>
  );
}
