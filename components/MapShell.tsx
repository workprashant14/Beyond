"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Box } from "lucide-react";
import Logo from "./Logo";
import SearchBar from "./SearchBar";
import ObjectInfoPanel from "./ObjectInfoPanel";
import { getObject } from "@/services/catalogue";
import { getSceneObject } from "@/universe/objects/sceneConfig";
import { isSolarId } from "@/data/solarSystem";
import { DRILL_DOWN, MAP_LEVELS, getLevel, getObjectLevel, isLevelId } from "@/universe/map/mapConfig";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const CosmicMap = dynamic(() => import("@/universe/map/CosmicMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center">
      <p className="eyebrow">Charting the cosmos…</p>
    </div>
  ),
});

function Legend({ show, onToggle, compact }: { show: boolean; onToggle: () => void; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted ${compact ? "" : "mb-2"}`}>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-cyan" aria-hidden /> Catalogued object
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-4 border-t border-dashed border-violet" aria-hidden /> Illustrative
      </span>
      <button type="button" aria-pressed={show} onClick={onToggle} className="underline-offset-4 hover:text-ink hover:underline">
        {show ? "Hide" : "Show"} illustrative
      </button>
    </div>
  );
}

export default function MapShell() {
  const router = useRouter();
  const params = useSearchParams();
  const desktop = useMediaQuery("(min-width: 640px)", true);
  const [showIllustrative, setShowIllustrative] = useState(true);

  const id = params.get("object");
  const levelParam = params.get("level");
  const objLevel = getObjectLevel(id);
  const levelId = objLevel ?? (isLevelId(levelParam) ? levelParam : "universe");
  const level = getLevel(levelId);
  const selected = id ? getObject(id) : undefined;
  const mapped = !!objLevel;

  const select = (next: string | null) =>
    router.push(next ? `/map?object=${encodeURIComponent(next)}` : `/map?level=${levelId}`, { scroll: false });

  const has3D = !!id && (isSolarId(id) || !!getSceneObject(id));
  const drill = id ? DRILL_DOWN[id] : undefined;
  const pill =
    "inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-xs text-ink transition hover:border-cyan/60";

  return (
    <div className="relative h-svh w-full overflow-hidden bg-void">
      <div className="nebula absolute inset-0 opacity-60" aria-hidden />

      <CosmicMap
        level={levelId}
        selectedId={mapped ? id : null}
        onSelect={select}
        insetRight={id && desktop ? 420 : 0}
        insetBottom={id && !desktop ? 360 : 0}
        showIllustrative={showIllustrative}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-4 sm:p-6">
        <div className="pointer-events-auto flex items-center gap-4">
          <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full">
            <ArrowLeft size={16} />
          </Link>
          <Logo className="hidden sm:inline-flex" />
        </div>
        <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3">
          <Link
            href={has3D && id ? `/explore?object=${id}` : "/explore"}
            aria-label="Open 3D explorer"
            className="glass inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-xs text-ink hover:border-cyan/60 sm:px-4"
          >
            <Box size={15} />
            <span className="hidden sm:inline">3D</span>
          </Link>
          <div className="min-w-0 flex-1">
            <SearchBar target="map" />
          </div>
        </div>
      </header>

      <nav aria-label="Map level" className="absolute inset-x-0 top-20 z-10 flex gap-2 overflow-x-auto px-4 pb-1 sm:top-24 sm:px-6">
        {MAP_LEVELS.map((l) => (
          <Link
            key={l.id}
            href={`/map?level=${l.id}`}
            aria-current={l.id === levelId ? "true" : undefined}
            className={`glass shrink-0 rounded-full px-4 py-1.5 text-xs transition hover:border-cyan/60 ${
              l.id === levelId ? "!border-cyan/70 text-cyan" : "text-muted"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      {/* mobile: compact legend under the tabs */}
      <div className="glass pointer-events-auto absolute left-4 right-4 top-[7.4rem] z-10 rounded-xl px-3 py-1.5 sm:hidden">
        <Legend compact show={showIllustrative} onToggle={() => setShowIllustrative((v) => !v)} />
      </div>

      {/* desktop: legend + honesty note */}
      <div className="glass pointer-events-auto absolute bottom-6 left-6 z-10 hidden max-w-sm rounded-2xl p-4 sm:block">
        <Legend show={showIllustrative} onToggle={() => setShowIllustrative((v) => !v)} />
        <p className="text-xs leading-relaxed text-muted">{level.note}</p>
      </div>

      {id && (
        <ObjectInfoPanel
          obj={selected}
          requestedId={id}
          inScene={false}
          basePath="/map"
          closeHref={`/map?level=${levelId}`}
          note={
            !mapped
              ? "Not placed on the 2D map yet — no verified position data for it in the project. Data above is from the catalogue."
              : levelId === "solar"
                ? "Its marker is computed for today from JPL Keplerian elements (planets: JPL's approximate-position method; the Moon: mean elements, so its place on the orbit is illustrative). Semi-major axes are compressed, not to scale."
                : "Its marker position is schematic, not a real coordinate. Measured data is above."
          }
          actions={
            <>
              {has3D && (
                <Link href={`/explore?object=${id}`} className={pill}>
                  <Box size={14} /> Open in 3D
                </Link>
              )}
              {drill && (
                <Link href={`/map?level=${drill}`} className={pill}>
                  Zoom into {getLevel(drill).label}
                </Link>
              )}
            </>
          }
        />
      )}
    </div>
  );
}
