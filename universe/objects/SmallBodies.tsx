"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { smallBodyOrbitPath, smallBodyPosition } from "@/utils/smallBodies";
import { pickFeatured, type FeaturedBody } from "@/utils/featuredBodies";
import { changedRun, newSliceState, stepSlice } from "@/utils/sliceUpdate";
import SelectableObject from "@/universe/interaction/SelectableObject";
import { toScene } from "./smallBodyScene";
import { buildPropagator } from "@/utils/smallBodyFast";
import CometTails from "./CometTails";
import type { Clock } from "./SolarBodyMesh";
import { useSmallBodies } from "./smallBodyData";

/** Writes one body's scene position for the given date into the geometry buffer (outside the component: it mutates GPU buffers). */
/**
 * Tells three.js the position buffer changed (outside the component: it mutates GPU buffer state). Only the evaluated run is uploaded
 * (three.js `updateRanges`, in float elements: 3 per body); with no usable run the whole buffer is uploaded.
 */
function markUpdated(geom: THREE.BufferGeometry, run: { start: number; count: number } | null) {
  const attr = geom.attributes.position as THREE.BufferAttribute;
  attr.clearUpdateRanges();
  if (run) attr.addUpdateRange(run.start * 3, run.count * 3);
  attr.needsUpdate = true;
}

/**
 * Diagnostics hook for scripts/profile-smallbody.mjs and the stress test: a page that sets `window.__sbDebug` before load gets per-frame
 * counters and can switch the position write or the GPU upload off to isolate their cost. Without it the layer does one property read per frame.
 */
interface SbDebug {
  skipWrite?: boolean;
  skipUpload?: boolean;
  stats?: { frames: number; updated: number; ranges: number; floatsUploaded: number; ms: number; evals: number; fallbacks: number; iters: number; open: number; trigFree: number };
}
const sbDebug = (): SbDebug | undefined => (typeof window === "undefined" ? undefined : (window as unknown as { __sbDebug?: SbDebug }).__sbDebug);

/** Per-frame time budget for evaluating positions of the point layer, ms. The rest of the frame belongs to rendering. */
const SLICE_BUDGET_MS = 3;
/**
 * Update-rate contract: while the clock runs, every body is re-evaluated at least every MAX_AGE_FRAMES frames (so a body is at most two frames,
 * about 40 ms, behind the clock at 100x: roughly 3 px of motion), and at most 1/MAX_AGE_FRAMES of the buffer is evaluated and uploaded per frame.
 * Measured in scripts/profile-smallbody.mjs; see BEYOND_SMALLBODY_PERFORMANCE_REPORT.md.
 */
const MAX_AGE_FRAMES = 2;
/** Fixed bounding sphere (scene units): orbits are drawn out to about 60 au, compressed to well under 300 units. Never recomputed. */
const BOUNDS_RADIUS = 500;

interface Props { clock: React.RefObject<Clock>; selectedId: string | null; onSelect: (id: string | null) => void; labels?: boolean; orbits?: boolean; tails?: boolean }

const FEATURED_COLOR = { "dwarf-planet": "#ffb36b", asteroid: "#d9c7a3" } as const;

/**
 * One named body (dwarf planet or large asteroid): a marker of FIXED display size (not scaled to its diameter), a label and
 * its orbit line, positioned by the same two-body propagation and the same shared clock as the point layer.
 */
function FeaturedMarker({ item, clock, selected, labels, orbits, onSelect }: { item: FeaturedBody; clock: React.RefObject<Clock>; selected: boolean; labels: boolean; orbits: boolean; onSelect: () => void }) {
  const { spec, body } = item;
  const group = useRef<THREE.Group>(null);
  const orbit = useMemo(() => {
    const path = smallBodyOrbitPath(body, 256).points;
    const a = new Float32Array(path.length * 3);
    path.forEach((v, i) => toScene(body, v, a, i * 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
    return g;
  }, [body]);
  useEffect(() => () => orbit.dispose(), [orbit]);
  useFrame(() => {
    if (!group.current) return;
    const tmp = new Float32Array(3);
    toScene(body, smallBodyPosition(body, clock.current.days), tmp, 0);
    group.current.position.set(tmp[0], tmp[1], tmp[2]);
  });
  const color = FEATURED_COLOR[spec.kind];
  return (
    <>
      {orbits && (
        <lineLoop geometry={orbit}>
          <lineBasicMaterial color={color} transparent opacity={selected ? 0.7 : 0.28} depthWrite={false} />
        </lineLoop>
      )}
      <group ref={group}>
        <SelectableObject position={[0, 0, 0]} hitRadius={0.9} ringRadius={0.55} label={spec.name} selected={selected} showLabel={labels} onSelect={onSelect}>
          <mesh>
            <sphereGeometry args={[0.28, 16, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </SelectableObject>
      </group>
    </>
  );
}

/** Asteroids and comets as one point layer (two-body propagation of JPL osculating elements), plus the selected orbit. */
export default function SmallBodies({ clock, selectedId, onSelect, labels = true, orbits = true, tails = true }: Props) {
  const file = useSmallBodies();
  const bodies = file?.bodies ?? null;
  const geom = useMemo(() => {
    if (!bodies) return null;
    const g = new THREE.BufferGeometry();
    // DynamicDrawUsage: this buffer is rewritten every frame while the clock runs. three.js defaults to StaticDrawUsage, which on real GPU
    // drivers (ANGLE/D3D11, Metal) makes every re-upload a staging copy that can stall the pipeline; software GL does not show that cost.
    const position = new THREE.BufferAttribute(new Float32Array(bodies.length * 3), 3);
    position.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", position);
    const col = new Float32Array(bodies.length * 3);
    bodies.forEach((b, i) => { const c = b.k === "c" ? [0.55, 0.9, 1] : [0.85, 0.78, 0.65]; col.set(c, i * 3); });
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), BOUNDS_RADIUS);
    return g;
  }, [bodies]);
  useEffect(() => () => geom?.dispose(), [geom]);

  const featured = useMemo(() => (bodies ? pickFeatured(bodies).found : []), [bodies]);
  const slice = useMemo(() => newSliceState(), [bodies]); // eslint-disable-line react-hooks/exhaustive-deps
  const prop = useMemo(() => (bodies ? buildPropagator(bodies, toScene) : null), [bodies]);
  useFrame(() => {
    if (!bodies || !geom || !prop) return;
    const dbg = sbDebug();
    const t0 = dbg ? performance.now() : 0;
    const attr = geom.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const from = slice.cursor;
    const n = dbg?.skipWrite ? 0 : stepSlice(slice, bodies.length, clock.current.days, SLICE_BUDGET_MS, () => performance.now(), (i, d) => prop!.write(arr, i, d), Math.ceil(bodies.length / MAX_AGE_FRAMES));
    if (n > 0 && !dbg?.skipUpload) markUpdated(geom, changedRun(from, n, bodies.length));
    if (dbg?.stats) {
      const s = dbg.stats, c = prop.counters;
      s.frames++; s.updated += n; s.ranges += n > 0 ? 1 : 0; s.floatsUploaded += n > 0 && !dbg.skipUpload ? n * 3 : 0; s.ms += performance.now() - t0;
      s.evals = c.evals; s.fallbacks = c.fallbacks; s.iters = c.iters; s.open = c.open; s.trigFree = c.trigFree;
    }
  });

  const sel = useMemo(() => (bodies && selectedId ? bodies.find((b) => b.id === selectedId) ?? null : null), [bodies, selectedId]);
  const orbitGeom = useMemo(() => {
    if (!sel) return null;
    const path = smallBodyOrbitPath(sel, 256).points;
    const a = new Float32Array(path.length * 3);
    path.forEach((v, i) => toScene(sel, v, a, i * 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
    return g;
  }, [sel]);
  useEffect(() => () => orbitGeom?.dispose(), [orbitGeom]);

  const markerRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!sel || !markerRef.current) return;
    const tmp = new Float32Array(3);
    toScene(sel, smallBodyPosition(sel, clock.current.days), tmp, 0);
    markerRef.current.position.set(tmp[0], tmp[1], tmp[2]);
  });

  if (!bodies || !geom) return null;
  return (
    <group>
      <points
        geometry={geom}
        frustumCulled={false}
        onClick={(e) => {
          if (e.index === undefined) return;
          e.stopPropagation();
          onSelect(bodies[e.index]?.id ?? null);
        }}
        onPointerMissed={undefined}
      >
        <pointsMaterial size={2.2} sizeAttenuation={false} vertexColors transparent opacity={0.85} depthWrite={false} />
      </points>
      {tails && bodies && <CometTails bodies={bodies} clock={clock} selectedId={selectedId} />}
      {featured.map((f) => (
        <FeaturedMarker key={f.body.id} item={f} clock={clock} selected={selectedId === f.body.id} labels={labels} orbits={orbits} onSelect={() => onSelect(f.body.id)} />
      ))}
      {sel && orbitGeom && (
        <>
          {sel.e > 1 ? (
            <line>
              <primitive object={orbitGeom} attach="geometry" />
              <lineBasicMaterial color="#5de0ff" transparent opacity={0.6} depthWrite={false} />
            </line>
          ) : (
          <lineLoop geometry={orbitGeom}>
            <lineBasicMaterial color="#5de0ff" transparent opacity={0.6} depthWrite={false} />
          </lineLoop>
          )}
          <mesh ref={markerRef}>
            <sphereGeometry args={[0.35, 12, 12]} />
            <meshBasicMaterial color="#5de0ff" />
          </mesh>
        </>
      )}
    </group>
  );
}
