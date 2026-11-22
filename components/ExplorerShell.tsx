"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Map as MapIcon } from "lucide-react";
import Logo from "./Logo";
import SearchBar from "./SearchBar";
import ObjectInfoPanel from "./ObjectInfoPanel";
import SolarControls from "./SolarControls";
import TourBar from "./TourBar";
import { getTour } from "@/data/tours";
import { getObject } from "@/services/catalogue";
import { getSceneObject } from "@/universe/objects/sceneConfig";
import { resolveGalaxy } from "@/universe/objects/galaxy/resolve";
import { getVisibleSet } from "@/universe/navigation/visibility";
import { INITIAL_SIM, type SimState } from "@/universe/engine/simTypes";
import { SOLAR_BODIES, isSolarId } from "@/data/solarSystem";
import { useWebGLSupport } from "@/hooks/useWebGLSupport";

const UniverseScene = dynamic(() => import("@/universe/engine/UniverseScene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center">
      <p className="eyebrow">Initialising universe…</p>
    </div>
  ),
});

export default function ExplorerShell() {
  const router = useRouter();
  const params = useSearchParams();
  const webgl = useWebGLSupport();
  const [sim, setSim] = useState<SimState>(INITIAL_SIM);
  const dateRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLParagraphElement>(null);

  const id = params.get("object");
  const tour = getTour(params.get("tour"));
  const selected = id ? getObject(id) : undefined;
  const solar = isSolarId(id);
  const sceneId = solar || getSceneObject(id) ? id : null;

  // Honest provenance of a galaxy's 3D look (catalogue morphology vs procedural structure).
  const so = getSceneObject(id);
  const galaxyNote = so?.kind === "galaxy" ? resolveGalaxy(so.id, so.seed, so.position).note
    : so?.hostGalaxy ? `Artistic visualization, not to scale. The black hole and its accretion disk are artistic. ${resolveGalaxy(so.hostGalaxy, so.seed, so.position).note.replace("Artistic visualization, not to scale. ", "Host galaxy: ")}`
    : undefined;

  const quickNav = solar
    ? [{ id: "solar-system" }, ...SOLAR_BODIES]
    : getVisibleSet(sceneId).objects;

  // X hides only the panel for the current object; any selection (even of the same object) reopens it.
  const [closedId, setClosedId] = useState<string | null>(null);
  const panelOpen = !!id && closedId !== id;

  const select = (next: string | null) => {
    setClosedId(null);
    router.push(next ? `/explore?${tour ? `tour=${tour.id}&` : ""}object=${encodeURIComponent(next)}` : "/explore", { scroll: false });
  };

  return (
    <div className="relative h-svh w-full overflow-hidden bg-void">
      <div className="absolute inset-0">
        {webgl === false ? (
          <div className="grid h-full w-full place-items-center p-6 text-center">
            <div className="max-w-sm">
              <p className="eyebrow">WebGL unavailable</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Your browser or device can’t run the 3D renderer. You can still search objects and read their data;
                try enabling hardware acceleration or another browser for the 3D view.
              </p>
            </div>
          </div>
        ) : webgl ? (
          <UniverseScene
            selectedId={sceneId}
            onSelect={select}
            sim={sim}
            dateRef={dateRef as React.RefObject<HTMLElement | null>}
            onSmallSelect={(smallSel) => setSim((s) => ({ ...s, smallSel }))}
            readoutRef={readoutRef as React.RefObject<HTMLElement | null>}
            onClockLimit={(limit) => setSim((s) => (s.limit === limit && s.paused ? s : { ...s, paused: true, limit }))}
          />
        ) : null}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto flex items-center gap-4">
          <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full">
            <ArrowLeft size={16} />
          </Link>
          <Logo className="hidden sm:inline-flex" />
        </div>
        <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3">
          <Link
            href={id ? `/map?object=${encodeURIComponent(id)}` : "/map"}
            aria-label="Open 2D map"
            className="glass inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-xs text-ink hover:border-cyan/60 sm:px-4"
          >
            <MapIcon size={15} />
            <span className="hidden sm:inline">2D map</span>
          </Link>
          <div className="min-w-0 flex-1">
            <SearchBar />
          </div>
        </div>
      </header>

      <nav
        aria-label="Objects in view"
        className="absolute inset-x-0 top-20 z-10 flex gap-2 overflow-x-auto px-4 pb-1 sm:top-24 sm:px-6"
      >
        {solar && (
          <Link
            href="/explore?object=milky-way"
            className="glass shrink-0 rounded-full px-4 py-1.5 text-xs text-muted transition hover:border-cyan/60"
          >
            ← Milky Way
          </Link>
        )}
        {quickNav.map((o) => (
          <Link
            key={o.id}
            href={`/explore?object=${o.id}`}
            onClick={() => setClosedId(null)}
            aria-current={o.id === sceneId ? "true" : undefined}
            className={`glass shrink-0 rounded-full px-4 py-1.5 text-xs transition hover:border-cyan/60 ${
              o.id === sceneId ? "!border-cyan/70 text-cyan" : "text-muted"
            }`}
          >
            {getObject(o.id)?.name ?? o.id}
          </Link>
        ))}
      </nav>

      {solar ? (
        <SolarControls sim={sim} onChange={(p) => setSim((s) => ({ ...s, ...p }))} dateRef={dateRef} readoutRef={readoutRef} />
      ) : (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-xs sm:bottom-6 sm:left-6">
          <p className="glass rounded-xl px-4 py-3 text-xs leading-relaxed text-muted">
            <span className="eyebrow !text-[0.6rem]">Artistic visualization</span>
            <br />
            Positions, sizes and looks are schematic, not to scale. Drag to rotate, scroll to zoom, right-drag to pan,
            click an object to fly to it. Measured data is in the panel.
          </p>
        </div>
      )}

      {tour && <TourBar tour={tour} objectId={id} />}

      {id && panelOpen && <ObjectInfoPanel
          onClose={() => setClosedId(id)}
          obj={selected}
          note={galaxyNote}
          requestedId={id}
          inScene={!!sceneId}
          actions={id === "milky-way" ? (
            <Link href="/milky-way" className="glass inline-flex h-9 items-center rounded-full px-4 text-xs !border-cyan/60 text-cyan">Structure and measurements</Link>
          ) : undefined}
        />}
    </div>
  );
}
