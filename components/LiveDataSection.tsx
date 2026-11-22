"use client";

import Image from "next/image";
import { useLiveData } from "@/hooks/useLiveData";
import type { LiveResponse, Section, UnavailableReason } from "@/services/live/types";
import { UNAVAILABLE } from "@/utils/format";

const WHY: Record<UnavailableReason, string> = {
  network: "Couldn’t reach the NASA/JPL service.",
  timeout: "The NASA/JPL service took too long to answer.",
  http: "The NASA/JPL service reported a problem.",
  parse: "The service replied in an unexpected format.",
  "not-found": "The service has no matching record.",
  ambiguous: "The service matched several objects, so none is shown.",
  "no-source": "No live data source is connected for this object yet.",
};

const Muted = ({ children }: { children: React.ReactNode }) => <p className="text-xs leading-relaxed text-muted">{children}</p>;

function SourceLine({ s }: { s: Extract<Section<unknown>, { status: "ok" }> }) {
  return (
    <p className="mt-2 text-[11px] text-muted">
      {s.sources.map((x, i) => (
        <span key={x.url}>
          {i > 0 && " · "}
          <a href={x.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-ink hover:underline">
            {x.label}
          </a>
        </span>
      ))}{" "}
      · fetched {new Date(s.fetchedAt).toISOString().slice(0, 16).replace("T", " ")} UTC
    </p>
  );
}

function Measurements({ s }: { s: LiveResponse["measurements"] }) {
  if (s.status === "unavailable") return s.reason === "no-source" ? null : <Muted>Live measurements: {WHY[s.reason]}</Muted>;
  return (
    <div>
      <h4 className="eyebrow !text-[0.62rem]">Live measurements</h4>
      <dl className="mt-3 divide-y divide-line border-y border-line text-sm">
        {s.data.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 py-2.5">
            <dt className="text-muted">{r.label}</dt>
            <dd className={`text-right ${r.value === UNAVAILABLE ? "text-muted" : "text-ink"}`}>
              {r.value}
              {r.note && <span className="block text-[11px] text-muted">{r.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <SourceLine s={s} />
    </div>
  );
}

function Images({ s }: { s: LiveResponse["images"] }) {
  if (s.status === "unavailable") return <Muted>NASA images: {WHY[s.reason]}</Muted>;
  return (
    <div>
      <h4 className="eyebrow !text-[0.62rem]">Images</h4>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {s.data.map((im) => (
          <li key={im.id}>
            <a href={im.pageUrl} target="_blank" rel="noreferrer" className="group block">
              <Image
                src={im.src}
                alt={im.title}
                width={320}
                height={240}
                unoptimized
                loading="lazy"
                className="aspect-[4/3] w-full rounded-lg border border-line object-cover transition group-hover:border-cyan/60"
              />
              <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-muted group-hover:text-ink">{im.title}</span>
              {im.credit && <span className="block text-[10px] text-muted">{im.credit}</span>}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Search results from the NASA Image and Video Library; an image may show a related view rather than this exact object.
      </p>
      <SourceLine s={s} />
    </div>
  );
}

export default function LiveDataSection({ id }: { id: string }) {
  const { state, retry } = useLiveData(id);

  return (
    <section aria-label="Live NASA and JPL data" aria-busy={state.status === "loading"} className="mt-6 space-y-6 border-t border-line pt-6">
      <div>
        <h3 className="eyebrow !text-[0.62rem]">Live data · NASA / JPL</h3>
        <Muted>Fetched on demand from NASA and JPL services. Shown separately from the built-in catalogue above.</Muted>
      </div>

      {state.status === "loading" && (
        <div role="status" className="space-y-3" aria-label="Loading live data">
          <div className="h-4 w-2/3 animate-pulse rounded bg-white/8 motion-reduce:animate-none" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-white/8 motion-reduce:animate-none" />
          <div className="grid grid-cols-2 gap-2">
            <div className="aspect-[4/3] animate-pulse rounded-lg bg-white/8 motion-reduce:animate-none" />
            <div className="aspect-[4/3] animate-pulse rounded-lg bg-white/8 motion-reduce:animate-none" />
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="rounded-lg border border-line px-3 py-3 text-xs text-muted">
          {state.message}{" "}
          <button type="button" onClick={retry} className="text-cyan underline-offset-4 hover:underline">
            Retry
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <Measurements s={state.data.measurements} />
          <Images s={state.data.images} />
        </>
      )}
    </section>
  );
}
