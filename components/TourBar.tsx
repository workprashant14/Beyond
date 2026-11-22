import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getObject } from "@/services/catalogue";
import type { Tour } from "@/data/tours";

const href = (tour: string, id: string) => `/explore?tour=${tour}&object=${encodeURIComponent(id)}`;

/** Floating tour controls. The current stop is the `object` in the URL, so Back/Forward and deep links work. */
export default function TourBar({ tour, objectId }: { tour: Tour; objectId: string | null }) {
  const i = tour.steps.findIndex((s) => s.id === objectId);
  const step = i >= 0 ? tour.steps[i] : null;
  const btn = "glass inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs hover:border-cyan/60";
  return (
    <section
      aria-label={`Guided tour: ${tour.title}`}
      className="glass absolute left-4 top-[6.9rem] z-30 max-w-[calc(100%-2rem)] rounded-2xl !bg-void p-3 sm:left-6 sm:top-40 sm:max-w-sm sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow !text-[0.6rem]">Guided tour{step ? ` · stop ${i + 1} of ${tour.steps.length}` : ""}</p>
          <h2 className="mt-0.5 text-sm font-semibold sm:mt-1 sm:text-base">{tour.title}</h2>
        </div>
        <Link href={objectId ? `/explore?object=${encodeURIComponent(objectId)}` : "/explore"} aria-label="Exit tour" className="text-muted hover:text-ink">
          <X size={16} />
        </Link>
      </div>
      {step ? (
        <>
          <p className="mt-1.5 text-xs leading-snug text-muted sm:mt-2 sm:leading-relaxed">
            <span className="text-ink">{getObject(step.id)?.name ?? step.id}.</span> {step.look}
          </p>
          <div className="mt-2 flex items-center gap-2 sm:mt-3">
            {i > 0 ? (
              <Link href={href(tour.id, tour.steps[i - 1].id)} className={btn}><ChevronLeft size={14} />Back</Link>
            ) : (
              <span aria-disabled="true" className={`${btn} opacity-40`}><ChevronLeft size={14} />Back</span>
            )}
            {i < tour.steps.length - 1 ? (
              <Link href={href(tour.id, tour.steps[i + 1].id)} className={`${btn} !border-cyan/60 text-cyan`}>Next<ChevronRight size={14} /></Link>
            ) : (
              <Link href="/tours" className={`${btn} !border-cyan/60 text-cyan`}>Finish · all tours</Link>
            )}
          </div>
        </>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-muted">You have left the tour&apos;s path. {tour.blurb}</p>
          <Link href={href(tour.id, tour.steps[0].id)} className={`${btn} mt-3 !border-cyan/60 text-cyan`}>Go to stop 1</Link>
        </div>
      )}
    </section>
  );
}
