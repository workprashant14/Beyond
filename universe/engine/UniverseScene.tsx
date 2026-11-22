"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { DPR_HIGH, DPR_LOW, dprBounds } from "@/utils/adaptiveDpr";
import CatalogueStarfield from "./CatalogueStarfield";
import CameraRig, { type FocusTarget, type HomeView } from "@/universe/camera/CameraRig";
import SelectableObject from "@/universe/interaction/SelectableObject";
import ObjectVisual from "@/universe/objects/ObjectVisual";
import SolarSystem from "@/universe/objects/SolarSystem";
import { bodyVisualRadius } from "@/universe/objects/SolarBodyMesh";
import { getSceneObject } from "@/universe/objects/sceneConfig";
import { getVisibleSet } from "@/universe/navigation/visibility";
import { getObject } from "@/services/catalogue";
import { getSolarBody, isSolarId } from "@/data/solarSystem";
import type { SimState } from "./simTypes";

interface Props {
  /** Selected object id (must exist in the scene), or null. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  sim: SimState;
  /** Element whose text shows the simulated date (written without React re-renders). */
  dateRef: React.RefObject<HTMLElement | null>;
  onSmallSelect?: (id: string | null) => void;
  readoutRef?: React.RefObject<HTMLElement | null>;
  onClockLimit?: (which: "start" | "end") => void;
}

const HOME_UNIVERSE: HomeView = { key: "universe", position: [0, 85, 230], target: [0, 0, 0] };
const HOME_SOLAR: HomeView = { key: "solar", position: [0, 95, 155], target: [0, 0, 0] };

/**
 * Diagnostics only: `/explore?...&dpr=1` pins the render resolution (0.5 to 2) and leaves the adaptive PerformanceMonitor off, so a benchmark measures
 * one resolution instead of a controller that moves between 1.5, 1 and 0.75 while it runs. Without the parameter nothing changes.
 */
function pinnedDprFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  const v = Number(new URLSearchParams(window.location.search).get("dpr"));
  return Number.isFinite(v) && v >= 0.5 && v <= 2 ? v : null;
}

/**
 * Diagnostics: events of the adaptive resolution (mount/unmount, decline/incline with the frame rate that caused it, every change of the pixel ratio)
 * are appended to `window.__dprLog`, and `window.__dprPolicy` names the policy in force. tests/e2e/smallbody-stress.mjs and scripts/profile-smallbody.mjs
 * print them; a page without `__dprPolicy` is running code from before the 2.25x bounds.
 */
type DprApi = { fps: number; refreshrate: number };
function logDpr(event: string, api?: DprApi) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __dprPolicy?: string; __dprLog?: { t: number; event: string; fps?: number; refresh?: number }[] };
  w.__dprPolicy = "bounds-x2.25";
  (w.__dprLog ??= []).push({ t: Math.round(performance.now()), event, fps: api?.fps, refresh: api?.refreshrate });
}

export default function UniverseScene({ selectedId, onSelect, sim, dateRef, onSmallSelect, readoutRef, onClockLimit }: Props) {
  const [pinnedDpr] = useState(pinnedDprFromUrl);
  const [adaptiveDpr, setDpr] = useState(DPR_HIGH);
  const dpr = pinnedDpr ?? adaptiveDpr;
  useEffect(() => { logDpr("mount"); return () => logDpr("unmount"); }, []);
  useEffect(() => { logDpr(`dpr ${dpr}`); }, [dpr]);
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);

  const world = isSolarId(selectedId) ? "solar" : "universe";
  const { objects, activeParent } = useMemo(() => getVisibleSet(selectedId), [selectedId]);

  const focus = useMemo<FocusTarget | null>(() => {
    if (world === "solar") {
      const b = getSolarBody(selectedId);
      if (!b) return { key: "solar-system", position: [0, 0, 0], distance: 170 };
      const distance = b.kind === "star" ? 20 : b.kind === "moon" ? 2.6 : Math.max(bodyVisualRadius(b) * 7, 4);
      return { key: b.id, position: [0, 0, 0], distance, followId: b.id };
    }
    const s = getSceneObject(selectedId);
    return s ? { key: s.id, position: s.position, distance: s.focusDistance } : null;
  }, [selectedId, world]);

  if (lost) {
    return (
      <div className="grid h-full w-full place-items-center p-6 text-center">
        <div>
          <p className="eyebrow">Graphics context lost</p>
          <p className="mt-3 text-sm text-muted">Your browser stopped the 3D renderer. Reload the page to continue.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-full border border-line px-5 py-2 text-sm hover:border-cyan/60"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Canvas
        dpr={dpr}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        camera={{ position: [0, 85, 230], fov: 55, near: 0.1, far: 4000 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setLost(true);
          });
          requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
        }}
        onPointerMissed={() => {
          if (world === "solar") {
            if (selectedId !== "solar-system") onSelect("solar-system");
          } else if (selectedId) {
            onSelect(null);
          }
        }}
      >
        <color attach="background" args={["#02030a"]} />
        {pinnedDpr === null && <PerformanceMonitor bounds={dprBounds} onDecline={(api) => { logDpr("decline", api); setDpr(DPR_LOW); }} onIncline={(api) => { logDpr("incline", api); setDpr(DPR_HIGH); }} onFallback={() => setDpr(0.75)} />}
        <Suspense fallback={null}>
          <CatalogueStarfield radius={1500} />
          {world === "solar" ? (
            <SolarSystem selectedId={selectedId} onSelect={onSelect} sim={sim} dateRef={dateRef} onSmallSelect={onSmallSelect} readoutRef={readoutRef} onClockLimit={onClockLimit} />
          ) : (
            objects.map((o) => {
              const cat = getObject(o.id);
              return (
                <SelectableObject
                  key={o.id}
                  position={o.position}
                  hitRadius={Math.max(o.radius * (o.kind === "galaxy" ? 0.9 : 1.3), (o.hostRadius ?? 0) * 0.75, 2)}
                  ringRadius={o.kind === "galaxy" ? o.radius : o.hostRadius ?? Math.max(o.radius * 1.8, 2.4)}
                  label={cat?.name ?? o.id}
                  labelOffset={o.kind === "galaxy" ? o.radius * 0.95 : (o.hostRadius ?? 0) * 0.95}
                  selected={o.id === selectedId}
                  hitDisabled={o.id === activeParent}
                  onSelect={() => onSelect(o.id)}
                >
                  <ObjectVisual obj={o} />
                </SelectableObject>
              );
            })
          )}
        </Suspense>
        <CameraRig focus={focus} home={world === "solar" ? HOME_SOLAR : HOME_UNIVERSE} />
      </Canvas>

      {/* brief fade when switching between the universe and the solar system */}
      <div
        key={world}
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-void opacity-0 motion-safe:animate-[beyond-fade_0.7s_ease-out_forwards]"
      />

      <div
        aria-hidden={ready}
        className={`pointer-events-none absolute inset-0 grid place-items-center bg-void transition-opacity duration-700 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      >
        <p className="eyebrow">Initialising universe…</p>
      </div>
    </>
  );
}
