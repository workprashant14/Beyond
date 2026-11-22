"use client";

/* eslint-disable react-hooks/immutability --
   three.js camera, uniforms and the camera-state ref are mutated on purpose in effects and the frame loop.
   That is how an imperative render loop works; nothing here is React state. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";
import Label3D from "@/universe/interaction/Label3D";
import { lookAngles, raDecToVec, starColor, starDisplayName } from "@/utils/sky";
import { horizonToEquatorial } from "@/utils/skyTime";
import { precessToJ2000 } from "@/utils/precession";
import { gridFor } from "@/utils/skyGrid";
import { DSO_GROUPS, dsoGroupIndex, dsoMagLimit, dsoMarkerPx, dsoTitle } from "@/utils/dso";
import { movedPositions, maxMoveDeg, movedRaDec, matchVertices } from "@/utils/properMotion";
import type { StarPhysFile } from "@/utils/starPhys";
import { loadStarPhys, type Constellation, type DsoSet, type SkyData } from "./skyData";

export interface SkySettings {
  lines: boolean;
  bounds: boolean;
  conLabels: boolean;
  starNames: boolean;
  /** Faintest apparent magnitude drawn. */
  magLimit: number;
  /** Visibility per deep-sky group, in DSO_GROUPS order. */
  dsoGroups: boolean[];
}

/** What a click on the sky landed on. */
export type SkyPick = { kind: "star"; hip: number } | { kind: "dso"; id: string };

export interface SkyFocus {
  ra: number;
  dec: number;
  fov: number;
  /** "min": never zoom out (stars); "exact": set the field of view (constellations). */
  mode: "min" | "exact";
  key: string;
}

const D2R = Math.PI / 180;
const FOV_MIN = 3;
const FOV_MAX = 100;

// ---------- geometry builders (pure, one buffer per layer = one draw call each) ----------

const wrap180 = (d: number) => ((d + 540) % 360) - 180;

/** Optional per-vertex mover used for proper motion: gets the vertex's running index and its J2000 place. */
export type VertexMover = (index: number, ra: number, dec: number) => [number, number];

export function figureVertices(cons: Constellation[]): [number, number][] {
  const v: [number, number][] = [];
  for (const c of cons) for (const l of c.lines) for (const p of l) v.push([p[0], p[1]]);
  return v;
}

export function figureSegments(cons: Constellation[], move?: VertexMover): Float32Array {
  let n = 0;
  for (const c of cons) for (const l of c.lines) n += Math.max(0, l.length - 1);
  const out = new Float32Array(n * 6);
  let o = 0;
  let base = 0; // running vertex index over all lines, same order as figureVertices
  for (const c of cons)
    for (const l of c.lines) {
      const at = (i: number): [number, number] => (move ? move(base + i, l[i][0], l[i][1]) : [l[i][0], l[i][1]]);
      for (let i = 0; i < l.length - 1; i++) {
        out.set(raDecToVec(...at(i)), o);
        out.set(raDecToVec(...at(i + 1)), o + 3);
        o += 6;
      }
      base += l.length;
    }
  return out;
}

/** Boundary edges follow lines of constant RA or Dec, so they are subdivided to stay on the sphere. */
export function boundarySegments(cons: Constellation[], stepDeg = 1.5): Float32Array {
  const pts: number[] = [];
  for (const c of cons)
    for (const ring of c.bounds) {
      const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring : [...ring, ring[0]];
      for (let i = 0; i < closed.length - 1; i++) {
        const [ra0, d0] = closed[i];
        const [ra1, d1] = closed[i + 1];
        const dra = wrap180(ra1 - ra0);
        const ddec = d1 - d0;
        const span = Math.max(Math.abs(dra) * Math.cos(((d0 + d1) / 2) * D2R), Math.abs(ddec));
        const steps = Math.max(1, Math.ceil(span / stepDeg));
        for (let k = 0; k < steps; k++) {
          const a = raDecToVec(ra0 + (dra * k) / steps, d0 + (ddec * k) / steps);
          const b = raDecToVec(ra0 + (dra * (k + 1)) / steps, d0 + (ddec * (k + 1)) / steps);
          pts.push(...a, ...b);
        }
      }
    }
  return Float32Array.from(pts);
}

function Segments({ data, color, opacity }: { data: Float32Array; color: string; opacity: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data, 3));
    return g;
  }, [data]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <lineSegments geometry={geo} frustumCulled={false} renderOrder={2}>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthTest={false} depthWrite={false} />
    </lineSegments>
  );
}

// ---------- stars: all in one Points object, size and alpha from magnitude, colour from B-V ----------

const VERT = /* glsl */ `
  uniform float uScale;
  uniform float uMagLimit;
  attribute float aMag;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float vis = step(aMag, uMagLimit);
    vColor = aColor;
    vAlpha = clamp(0.45 + (6.6 - aMag) * 0.14, 0.45, 1.0) * vis;
    gl_PointSize = clamp(1.4 + (6.6 - aMag) * 0.95, 1.6, 10.0) * uScale * vis;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, d) * vAlpha);
  }
`;

function StarPoints({ sky, magLimit }: { sky: SkyData; magLimit: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const col = new Float32Array(sky.n * 3);
    for (let i = 0; i < sky.n; i++) {
      const [r, gg, b] = starColor(Number.isNaN(sky.bv[i]) ? null : sky.bv[i]);
      col.set([r, gg, b], i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(sky.pos, 3));
    g.setAttribute("aMag", new THREE.BufferAttribute(sky.mag, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    return g;
  }, [sky]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 1 }, uMagLimit: { value: 6.5 } },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    mat.uniforms.uMagLimit.value = magLimit;
    invalidate();
  }, [mat, magLimit, invalidate]);
  useFrame(({ gl }) => {
    mat.uniforms.uScale.value = gl.getPixelRatio();
  });
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={1} />;
}

// ---------- labels ----------

function ConLabels({ cons, selected }: { cons: Constellation[]; selected: string | null }) {
  return (
    <>
      {cons.flatMap((c) =>
        c.labels.map((l, i) => (
          <group key={`${c.id}-${i}`} position={raDecToVec(l[0], l[1])}>
            <Label3D text={c.name} state={c.id === selected ? "selected" : "dim"} pixelHeight={11} anchorY={0.5} />
          </group>
        )),
      )}
    </>
  );
}

/** Names of bright stars, chosen per frame: only what fits on screen, more as you zoom in. */
function NameLabels({ sky, magLimit }: { sky: SkyData; magLimit: number }) {
  const { camera, size, invalidate } = useThree();
  const [shown, setShown] = useState<number[]>([]);
  const last = useRef(0);
  const keyRef = useRef("");
  const cands = useMemo(() => {
    const idx: number[] = [];
    for (let i = 0; i < sky.n; i++) if (sky.names[String(sky.hip[i])]?.n) idx.push(i);
    return idx.sort((a, b) => sky.mag[a] - sky.mag[b]);
  }, [sky]);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (t - last.current < 0.2) {
      invalidate(); // demand mode: ask for one more frame so the throttled update still happens
      return;
    }
    last.current = t;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const thr = Math.min(magLimit, fov > 60 ? 1.6 : fov > 35 ? 2.5 : fov > 18 ? 3.5 : 6.5);
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const boxes: [number, number][] = [];
    const out: number[] = [];
    for (const i of cands) {
      if (sky.mag[i] > thr || out.length >= 40) break;
      v.set(sky.pos[i * 3], sky.pos[i * 3 + 1], sky.pos[i * 3 + 2]);
      if (v.dot(fwd) <= 0) continue;
      v.project(camera);
      if (Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95) continue;
      const sx = (v.x * 0.5 + 0.5) * size.width;
      const sy = (-v.y * 0.5 + 0.5) * size.height;
      if (boxes.some(([bx, by]) => Math.abs(bx - sx) < 90 && Math.abs(by - sy) < 20)) continue;
      boxes.push([sx, sy]);
      out.push(i);
    }
    const key = out.join(",");
    if (key !== keyRef.current) {
      keyRef.current = key;
      setShown(out);
    }
  });

  return (
    <>
      {shown.map((i) => (
        <group key={sky.hip[i]} position={[sky.pos[i * 3], sky.pos[i * 3 + 1], sky.pos[i * 3 + 2]]}>
          <Label3D text={starDisplayName(sky.hip[i], sky.names[String(sky.hip[i])], undefined, undefined)} state="normal" pixelHeight={12} />
        </group>
      ))}
    </>
  );
}

function SelectionRing({ pos }: { pos: [number, number, number] | null }) {
  const ref = useRef<THREE.Sprite>(null);
  const { camera, size } = useThree();
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    g.strokeStyle = "#52e0ff";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(32, 32, 28, 0, Math.PI * 2);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(() => {
    const s = ref.current;
    if (!s) return;
    const h = (38 / size.height) * 2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360);
    s.scale.set(h, h, 1);
  });
  if (!pos) return null;
  return (
    <sprite ref={ref} position={pos} renderOrder={30} raycast={() => null}>
      <spriteMaterial map={tex} transparent depthTest={false} depthWrite={false} sizeAttenuation={false} />
    </sprite>
  );
}

// ---------- deep-sky objects: one Points layer, symbol by type, level of detail by field of view ----------

const DSO_VERT = /* glsl */ `
  uniform float uScale;
  uniform float uMagLimit;
  uniform float uZoom;
  uniform float uOn[8];
  attribute float aMag;
  attribute float aSize;
  attribute float aGroup;
  attribute float aShape;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vShape;
  varying float vOn;
  void main() {
    float on = uOn[int(aGroup + 0.5)] * step(aMag, uMagLimit);
    vColor = aColor;
    vShape = aShape;
    vOn = on;
    gl_PointSize = aSize * uScale * uZoom * on;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const DSO_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vShape;
  varying float vOn;
  float ring(float d, float r, float w) { return smoothstep(w, 0.0, abs(d - r)); }
  void main() {
    if (vOn < 0.5) discard;
    vec2 p = (gl_PointCoord - 0.5) * 2.0;
    float a;
    if (vShape < 0.5) a = ring(length(p), 0.8, 0.14);
    else if (vShape < 1.5) a = ring(max(abs(p.x), abs(p.y)), 0.75, 0.14);
    else if (vShape < 2.5) a = ring(abs(p.x) + abs(p.y), 1.0, 0.18);
    else if (vShape < 3.5) a = ring(length(vec2(p.x, p.y * 1.9)), 0.8, 0.14);
    else if (vShape < 4.5) a = max(ring(length(p), 0.8, 0.14), smoothstep(0.24, 0.14, length(p)));
    else a = max(ring(length(p), 0.8, 0.14), ring(length(p), 0.42, 0.14));
    if (a < 0.05) discard;
    gl_FragColor = vec4(vColor, a * 0.95);
  }
`;

/** Level-of-detail magnitude for display ordering only. Objects without a catalogued magnitude appear at the deepest zoom, except Messier objects. */
export function dsoRank(mag: number, desig: string): number {
  return Number.isNaN(mag) ? (/^M \d/.test(desig) ? 8 : 14.2) : mag;
}

function DsoPoints({ dso, groups }: { dso: DsoSet; groups: boolean[] }) {
  const { camera, invalidate } = useThree();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const mag = new Float32Array(dso.n), size = new Float32Array(dso.n), grp = new Float32Array(dso.n), shape = new Float32Array(dso.n), col = new Float32Array(dso.n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < dso.n; i++) {
      const gi = Math.max(0, dsoGroupIndex(dso.type[i]));
      mag[i] = dsoRank(dso.mag[i], dso.desig[i]);
      size[i] = dsoMarkerPx(Number.isNaN(dso.a[i]) ? null : dso.a[i]);
      grp[i] = gi;
      shape[i] = DSO_GROUPS[gi].shape;
      c.set(DSO_GROUPS[gi].color);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(dso.pos, 3));
    g.setAttribute("aMag", new THREE.BufferAttribute(mag, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aGroup", new THREE.BufferAttribute(grp, 1));
    g.setAttribute("aShape", new THREE.BufferAttribute(shape, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    return g;
  }, [dso]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 1 }, uMagLimit: { value: 8 }, uZoom: { value: 1 }, uOn: { value: new Array(8).fill(1) } },
        vertexShader: DSO_VERT,
        fragmentShader: DSO_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => {
    mat.uniforms.uOn.value = DSO_GROUPS.map((_, i) => (groups[i] ? 1 : 0));
    invalidate();
  }, [mat, groups, invalidate]);
  useFrame(({ gl }) => {
    const fov = (camera as THREE.PerspectiveCamera).fov;
    mat.uniforms.uScale.value = gl.getPixelRatio();
    mat.uniforms.uMagLimit.value = dsoMagLimit(fov);
    mat.uniforms.uZoom.value = Math.min(1.8, Math.max(1, Math.pow(45 / fov, 0.4)));
  });
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={3} />;
}

/** Names of deep-sky objects that fit on screen; more appear as you zoom in. */
function DsoLabels({ dso, groups }: { dso: DsoSet; groups: boolean[] }) {
  const { camera, size, invalidate } = useThree();
  const [shown, setShown] = useState<number[]>([]);
  const last = useRef(0);
  const keyRef = useRef("");
  const cands = useMemo(() => {
    const idx: number[] = [];
    for (let i = 0; i < dso.n; i++) if (dso.names[dso.id[i]] || /^M \d/.test(dso.desig[i])) idx.push(i);
    return idx.sort((a, b) => dsoRank(dso.mag[a], dso.desig[a]) - dsoRank(dso.mag[b], dso.desig[b]));
  }, [dso]);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (t - last.current < 0.2) { invalidate(); return; }
    last.current = t;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const thr = Math.min(dsoMagLimit(fov), fov > 60 ? 7 : fov > 35 ? 9 : 14.5);
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const boxes: [number, number][] = [];
    const out: number[] = [];
    for (const i of cands) {
      if (dsoRank(dso.mag[i], dso.desig[i]) > thr || out.length >= 25) break;
      if (!groups[Math.max(0, dsoGroupIndex(dso.type[i]))]) continue;
      v.set(dso.pos[i * 3], dso.pos[i * 3 + 1], dso.pos[i * 3 + 2]);
      if (v.dot(fwd) <= 0) continue;
      v.project(camera);
      if (Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95) continue;
      const sx = (v.x * 0.5 + 0.5) * size.width;
      const sy = (-v.y * 0.5 + 0.5) * size.height;
      if (boxes.some(([bx, by]) => Math.abs(bx - sx) < 110 && Math.abs(by - sy) < 26)) continue;
      boxes.push([sx, sy]);
      out.push(i);
    }
    const key = out.join(",");
    if (key !== keyRef.current) { keyRef.current = key; setShown(out); }
  });

  return (
    <>
      {shown.map((i) => (
        <group key={dso.id[i]} position={[dso.pos[i * 3], dso.pos[i * 3 + 1], dso.pos[i * 3 + 2]]}>
          <Label3D text={dsoTitle(dso.names[dso.id[i]], dso.desig[i], dso.id[i])} state="normal" pixelHeight={12} anchorY={3} />
        </group>
      ))}
    </>
  );
}

// ---------- camera: drag to look, wheel / pinch to zoom, arrows + / - from the keyboard, smooth fly-to ----------

function Rig({
  sky, dso, dsoGroups, magLimit, focus, onPick,
}: {
  sky: SkyData; dso: DsoSet | null; dsoGroups: boolean[]; magLimit: number; focus: SkyFocus | null; onPick: (pick: SkyPick | null) => void;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const reduce = useReducedMotion();
  const st = useRef({ yaw: 0, pitch: 0, fov: 75, tYaw: null as number | null, tPitch: 0, tFov: 75 });
  const pickRef = useRef(onPick);
  const dsoRef = useRef({ dso, dsoGroups });
  useEffect(() => { pickRef.current = onPick; dsoRef.current = { dso, dsoGroups }; }, [onPick, dso, dsoGroups]);

  useEffect(() => {
    const a = lookAngles(85, 5); // opening view: Orion and the winter sky
    Object.assign(st.current, { yaw: a.yaw, pitch: a.pitch });
    camera.rotation.order = "YXZ";
    invalidate();
  }, [camera, invalidate]);

  // fly to a new focus
  useEffect(() => {
    if (!focus) return;
    const s = st.current;
    const a = lookAngles(focus.ra, focus.dec);
    const fov = Math.max(FOV_MIN, Math.min(FOV_MAX, focus.mode === "min" ? Math.min(s.fov, focus.fov) : focus.fov));
    if (reduce) Object.assign(s, { yaw: a.yaw, pitch: a.pitch, fov, tYaw: null });
    else Object.assign(s, { tYaw: a.yaw, tPitch: a.pitch, tFov: fov });
    invalidate();
  }, [focus, reduce, invalidate]);

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    el.tabIndex = 0;
    el.setAttribute("role", "application");
    el.setAttribute("aria-label", "Interactive sky. Drag to look around, scroll or pinch to zoom, arrow keys and plus or minus from the keyboard.");
    const ptrs = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinch = 0;
    const s = st.current;
    const clampFov = (f: number) => Math.max(FOV_MIN, Math.min(FOV_MAX, f));
    const stop = () => { s.tYaw = null; };

    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) moved = 0;
      if (ptrs.size === 2) { const [p, q] = [...ptrs.values()]; pinch = Math.hypot(p.x - q.x, p.y - q.y); moved = 99; }
    };
    const move = (e: PointerEvent) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      stop();
      if (ptrs.size === 1) {
        const k = (s.fov * D2R) / el.clientHeight;
        s.yaw += dx * k;
        s.pitch = Math.max(-89 * D2R, Math.min(89 * D2R, s.pitch + dy * k));
        moved += Math.abs(dx) + Math.abs(dy);
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0) s.fov = clampFov((s.fov * pinch) / d);
        pinch = d;
      }
      invalidate();
    };
    const up = (e: PointerEvent) => {
      const wasSingle = ptrs.size === 1;
      ptrs.delete(e.pointerId);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (wasSingle && moved < 5) {
        const r = el.getBoundingClientRect();
        pickRef.current(pickStar(e.clientX - r.left, e.clientY - r.top));
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      stop();
      s.fov = clampFov(s.fov * Math.exp(e.deltaY * 0.0012));
      invalidate();
    };
    const key = (e: KeyboardEvent) => {
      const step = s.fov * D2R * 0.12;
      let handled = true;
      stop();
      if (e.key === "ArrowLeft") s.yaw += step;
      else if (e.key === "ArrowRight") s.yaw -= step;
      else if (e.key === "ArrowUp") s.pitch = Math.min(89 * D2R, s.pitch + step);
      else if (e.key === "ArrowDown") s.pitch = Math.max(-89 * D2R, s.pitch - step);
      else if (e.key === "+" || e.key === "=") s.fov = clampFov(s.fov * 0.85);
      else if (e.key === "-" || e.key === "_") s.fov = clampFov(s.fov / 0.85);
      else handled = false;
      if (handled) { e.preventDefault(); invalidate(); }
    };

    const v = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const ray = new THREE.Vector3();
    const candRef = { current: [] as number[] };
    function pickStar(x: number, y: number): SkyPick | null {
      camera.updateMatrixWorld();
      camera.getWorldDirection(fwd);
      let best: SkyPick | null = null, bestScore = Infinity;
      // Only objects near the pointer's direction are tested: the grid returns a superset of everything within the
      // 18 px reach, and the exact pixel test below still decides. (Angle per pixel is largest at the screen centre,
      // so a radius computed from it never undershoots.)
      const W = el.clientWidth, H = el.clientHeight;
      ray.set((x / W) * 2 - 1, -(y / H) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
      const radius = 18 * ((2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * D2R) / 2)) / H) * 1.1;
      const cand: number[] = candRef.current;
      gridFor(sky.pos, sky.n).query(ray.x, ray.y, ray.z, radius, cand);
      for (const i of cand) {
        if (sky.mag[i] > magLimit) continue;
        v.set(sky.pos[i * 3], sky.pos[i * 3 + 1], sky.pos[i * 3 + 2]);
        if (v.dot(fwd) <= 0) continue;
        v.project(camera);
        const d = Math.hypot((v.x * 0.5 + 0.5) * el.clientWidth - x, (-v.y * 0.5 + 0.5) * el.clientHeight - y);
        if (d > 18) continue;
        const score = d - (6.6 - sky.mag[i]) * 1.2; // prefer the brighter star when two are close
        if (score < bestScore) { bestScore = score; best = { kind: "star", hip: sky.hip[i] }; }
      }
      const { dso: set, dsoGroups: on } = dsoRef.current;
      if (set) {
        const limit = dsoMagLimit(s.fov);
        gridFor(set.pos, set.n).query(ray.x, ray.y, ray.z, radius, cand);
        for (const i of cand) {
          if (!on[Math.max(0, dsoGroupIndex(set.type[i]))] || dsoRank(set.mag[i], set.desig[i]) > limit) continue;
          v.set(set.pos[i * 3], set.pos[i * 3 + 1], set.pos[i * 3 + 2]);
          if (v.dot(fwd) <= 0) continue;
          v.project(camera);
          const d = Math.hypot((v.x * 0.5 + 0.5) * el.clientWidth - x, (-v.y * 0.5 + 0.5) * el.clientHeight - y);
          const reach = Math.max(12, dsoMarkerPx(Number.isNaN(set.a[i]) ? null : set.a[i]) / 2 + 4);
          if (d > reach) continue;
          const score = d - 6; // the larger symbol wins when it is close to a star
          if (score < bestScore) { bestScore = score; best = { kind: "dso", id: set.id[i] }; }
        }
      }
      return best;
    }

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("keydown", key);
    };
  }, [camera, gl, sky, magLimit, invalidate]); // dso data is read through dsoRef so the listeners are not rebuilt

  useFrame((_, dt) => {
    const s = st.current;
    if (s.tYaw !== null) {
      const k = 1 - Math.exp(-dt * 5);
      s.yaw += wrap180((s.tYaw - s.yaw) * (180 / Math.PI)) * D2R * k;
      s.pitch += (s.tPitch - s.pitch) * k;
      s.fov += (s.tFov - s.fov) * k;
      const done = Math.abs(wrap180((s.tYaw - s.yaw) * (180 / Math.PI))) < 0.05 && Math.abs(s.tPitch - s.pitch) < 0.0005 && Math.abs(s.tFov - s.fov) < 0.05;
      if (done) { s.yaw = s.tYaw; s.pitch = s.tPitch; s.fov = s.tFov; s.tYaw = null; }
      else invalidate();
    }
    const cam = camera as THREE.PerspectiveCamera;
    cam.rotation.set(s.pitch, s.yaw, 0, "YXZ");
    if (Math.abs(cam.fov - s.fov) > 1e-4) { cam.fov = s.fov; cam.updateProjectionMatrix(); }
  });

  useEffect(() => { invalidate(); }, [size, invalidate]);
  return null;
}

/** Observer location in sky coordinates: latitude and local sidereal time (degrees). */
export interface NightSky { lat: number; lst: number; /** Julian centuries from J2000 (precession); 0 = J2000 */ T?: number }

// ---------- night-sky mode: a dark ground below the horizon, the horizon line and N/E/S/W marks ----------
function Horizon({ night }: { night: NightSky }) {
  const { quat, ring, marks } = useMemo(() => {
    const at = (alt: number, az: number, r: number) => {
      // sidereal time and the horizon are tied to the equator of DATE; the 3D sky is drawn in J2000, so precess back
      const d = horizonToEquatorial(alt, az, night.lat, night.lst);
      const e = precessToJ2000(d.ra, d.dec, night.T ?? 0);
      return raDecToVec(e.ra, e.dec, r);
    };
    const zj = precessToJ2000(night.lst, night.lat, night.T ?? 0);
    const zen = new THREE.Vector3(...raDecToVec(zj.ra, zj.dec, 1));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), zen.negate());
    const pts: number[] = [];
    for (let a = 0; a < 360; a += 3) pts.push(...at(0, a, 99), ...at(0, a + 3, 99));
    return {
      quat: q,
      ring: new Float32Array(pts),
      marks: [["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([t, az]) => ({ t: t as string, p: at(4, az as number, 99) })),
    };
  }, [night.lat, night.lst, night.T]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(ring, 3));
    return g;
  }, [ring]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <>
      <mesh quaternion={quat} renderOrder={25} raycast={() => null} frustumCulled={false}>
        <sphereGeometry args={[99.5, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#03050c" transparent opacity={0.78} side={THREE.BackSide} depthTest={false} depthWrite={false} />
      </mesh>
      <lineSegments geometry={geo} renderOrder={26} frustumCulled={false}>
        <lineBasicMaterial color="#52e0ff" transparent opacity={0.7} depthTest={false} depthWrite={false} />
      </lineSegments>
      {marks.map((m) => (
        <group key={m.t} position={m.p}><Label3D text={m.t} state="selected" pixelHeight={16} anchorY={0.5} /></group>
      ))}
    </>
  );
}

export interface MotionStatus {
  /** Whole years from J2000 (negative = past). 0 = the catalogue places are shown unchanged. */
  years: number;
  state: "off" | "loading" | "ready" | "unavailable";
  /** Largest move of any star in degrees, so the disclosure can say whether it is visible. */
  maxDeg: number;
}

/**
 * Night-sky time travel: stars (and the constellation-figure corners that sit on them) are moved by their proper motion.
 * Whole-year steps so dragging the hour slider does not rebuild the sky every tick. Needs starphys.json (lazy).
 */
function useMovedSky(sky: SkyData, night: NightSky | null | undefined) {
  const years = night ? Math.round((night.T ?? 0) * 100) : 0;
  const [phys, setPhys] = useState<StarPhysFile | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (years === 0 || phys || failed) return;
    let live = true;
    loadStarPhys().then((p) => live && setPhys(p), () => live && setFailed(true));
    return () => { live = false; };
  }, [years, phys, failed]);
  const usable = phys && phys.pmra && phys.pmdec && phys.n === sky.n && phys.hip[0] === sky.hip[0] ? phys : null;
  const match = useMemo(() => (usable ? matchVertices(figureVertices(sky.constellations), sky.ra, sky.dec) : null), [sky, usable]);
  const moved = useMemo(() => {
    if (!usable || years === 0) return null;
    const pm = { pmra: usable.pmra!, pmdec: usable.pmdec!, d: usable.d, rv: usable.rv };
    const m = movedPositions(sky.ra, sky.dec, pm, years);
    const pos = new Float32Array(sky.n * 3);
    for (let i = 0; i < sky.n; i++) pos.set(raDecToVec(m.ra[i], m.dec[i]), i * 3);
    const mover: VertexMover = (idx, ra, dec) => {
      const si = match ? match[idx] : -1;
      if (si < 0) return [ra, dec];
      const a = pm.pmra[si], b = pm.pmdec[si];
      if (a == null || b == null) return [ra, dec];
      const r = movedRaDec(ra, dec, a, b, years, pm.d?.[si], pm.rv?.[si]);
      return [r.ra, r.dec];
    };
    return { view: { ...sky, pos } as SkyData, mover, maxDeg: maxMoveDeg(pm, years) };
  }, [sky, usable, years, match]);
  const status: MotionStatus = years === 0 ? { years, state: "off", maxDeg: 0 }
    : moved ? { years, state: "ready", maxDeg: moved.maxDeg }
    : failed || (phys && !usable) ? { years, state: "unavailable", maxDeg: 0 }
    : { years, state: "loading", maxDeg: 0 };
  return { view: moved?.view ?? sky, mover: moved?.mover, status };
}

export default function SkyScene({
  sky: catalogue, dso, settings, selectedHip, selectedDso, selectedCon, focus, onPick, night, onMotion,
}: {
  sky: SkyData;
  dso: DsoSet | null;
  settings: SkySettings;
  selectedHip: number | null;
  selectedDso: string | null;
  selectedCon: string | null;
  focus: SkyFocus | null;
  onPick: (pick: SkyPick | null) => void;
  night?: NightSky | null;
  onMotion?: (s: MotionStatus) => void;
}) {
  const { view: sky, mover, status } = useMovedSky(catalogue, night);
  useEffect(() => { onMotion?.(status); }, [onMotion, status.years, status.state, status.maxDeg]); // eslint-disable-line react-hooks/exhaustive-deps
  const ringPos = useMemo<[number, number, number] | null>(() => {
    if (selectedHip !== null) {
      const i = sky.indexOfHip.get(selectedHip);
      return i === undefined ? null : [sky.pos[i * 3], sky.pos[i * 3 + 1], sky.pos[i * 3 + 2]];
    }
    const j = selectedDso && dso ? dso.indexOfId.get(selectedDso) : undefined;
    return j === undefined || !dso ? null : [dso.pos[j * 3], dso.pos[j * 3 + 1], dso.pos[j * 3 + 2]];
  }, [sky, dso, selectedHip, selectedDso]);
  const figures = useMemo(() => figureSegments(sky.constellations, mover), [sky, mover]);
  const borders = useMemo(() => boundarySegments(sky.constellations), [sky]);
  const selCon = useMemo(() => (selectedCon ? sky.conById.get(selectedCon) : undefined), [sky, selectedCon]);
  const selFigure = useMemo(() => {
    if (!selCon) return null;
    let off = 0; // vertex index of this constellation's first corner within the whole set
    for (const c of sky.constellations) { if (c === selCon) break; for (const l of c.lines) off += l.length; }
    return figureSegments([selCon], mover ? (i, ra, dec) => mover(off + i, ra, dec) : undefined);
  }, [sky, selCon, mover]);
  const selBorder = useMemo(() => (selCon ? boundarySegments([selCon]) : null), [selCon]);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 0], fov: 75, near: 0.1, far: 1000 }}
    >
      <color attach="background" args={["#02030a"]} />
      <Rig sky={sky} dso={dso} dsoGroups={settings.dsoGroups} magLimit={settings.magLimit} focus={focus} onPick={onPick} />
      {settings.bounds && <Segments data={borders} color="#cccc66" opacity={0.28} />}
      {settings.lines && <Segments data={figures} color="#6f8bd8" opacity={0.55} />}
      {selFigure && <Segments data={selFigure} color="#52e0ff" opacity={0.95} />}
      {selBorder && <Segments data={selBorder} color="#52e0ff" opacity={0.5} />}
      <StarPoints sky={sky} magLimit={settings.magLimit} />
      {dso && <DsoPoints dso={dso} groups={settings.dsoGroups} />}
      {dso && settings.starNames && <DsoLabels dso={dso} groups={settings.dsoGroups} />}
      {settings.conLabels && <ConLabels cons={sky.constellations} selected={selectedCon} />}
      {settings.starNames && <NameLabels sky={sky} magLimit={settings.magLimit} />}
      <SelectionRing pos={ringPos} />
      {night && <Horizon night={night} />}
    </Canvas>
  );
}
