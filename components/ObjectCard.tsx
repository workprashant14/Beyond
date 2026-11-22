import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CATEGORY_LABEL, type CelestialObject } from "@/types/celestial";
import { orUnavailable } from "@/utils/format";

export default function ObjectCard({ obj, compact = false }: { obj: CelestialObject; compact?: boolean }) {
  return (
    <Link
      href={`/explore?object=${obj.id}`}
      className="group glass relative flex flex-col justify-between rounded-2xl p-6 transition hover:border-cyan/40 hover:bg-white/[0.04]"
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="eyebrow !text-[0.62rem]">{CATEGORY_LABEL[obj.category]}</span>
          <ArrowUpRight size={16} className="text-muted transition group-hover:text-cyan" aria-hidden />
        </div>
        <h3 className="mt-5 text-xl font-medium tracking-tight">{obj.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{obj.summary}</p>
      </div>
      {!compact && (
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 text-xs">
          <div>
            <dt className="text-muted">Distance</dt>
            <dd className="mt-1 text-ink">{orUnavailable(obj.distance)}</dd>
          </div>
          <div>
            <dt className="text-muted">Diameter</dt>
            <dd className="mt-1 text-ink">{orUnavailable(obj.diameter)}</dd>
          </div>
        </dl>
      )}
    </Link>
  );
}
