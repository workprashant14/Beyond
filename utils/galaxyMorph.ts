import { mulberry32 } from "./random";

/**
 * Galaxy morphology for the 3D universe scene. Pure functions (no three.js), so everything here is unit-tested.
 *
 * SOURCED (data/galaxyMorphology.json, from OpenNGC): Hubble type, apparent major/minor axis, position angle.
 * ESTIMATED: inclination, from the apparent axis ratio with the classic thick-disk formula (see inclinationDeg).
 * PROCEDURAL: arm winding, arm phases, dust lanes, clumps, star colours, star counts. Nothing about these is measured.
 */
export type GalaxyClass = "spiral" | "elliptical" | "irregular";
export type Vec3 = [number, number, number];

export interface Morph {
  openngc: string | null;
  hubble: string | null;
  majAxArcmin: number | null;
  minAxArcmin: number | null;
  posAngDeg: number | null;
  bMag: number | null;
  note?: string;
}

export interface HubbleInfo {
  cls: GalaxyClass;
  /** Barred (SB...) spiral. */
  bar: boolean;
  /** 0 (Sa) .. 1 (Sd) along the Hubble sequence; 0.5 when not a spiral. */
  stage: number;
  /** S0 (lenticular): drawn with the elliptical model. */
  lenticular: boolean;
}

const SPIRAL_STAGES: Record<string, number> = { a: 1, ab: 2, b: 3, bc: 4, c: 5, cd: 6, d: 7, dm: 8 };

/** Maps an OpenNGC Hubble string to a rendering class. `fallback` is used only when the catalogue has no type. */
export function classifyHubble(hubble: string | null | undefined, fallback: GalaxyClass = "spiral"): HubbleInfo {
  const h = (hubble ?? "").trim();
  if (!h) return { cls: fallback, bar: false, stage: 0.5, lenticular: false };
  if (/^E/i.test(h)) return { cls: "elliptical", bar: false, stage: 0.5, lenticular: false };
  if (/^S0/i.test(h)) return { cls: "elliptical", bar: /^SB0/i.test(h), stage: 0.5, lenticular: true };
  if (/^(I|Irr)/i.test(h)) return { cls: "irregular", bar: /^IB/i.test(h), stage: 0.5, lenticular: false };
  // Case-sensitive on purpose: "Sb" (unbarred, stage b) must not be read as "SB" (barred).
  const m = /^(SAB|SB|SA|S)([a-z]*)/.exec(h);
  if (m) {
    const tail = m[2];
    const bar = m[1] === "SB" || m[1] === "SAB";
    if (tail === "m") return { cls: "irregular", bar, stage: 1, lenticular: false }; // Sm: Magellanic irregular
    const s = SPIRAL_STAGES[tail];
    if (s) return { cls: "spiral", bar, stage: (s - 1) / 7, lenticular: false };
    return { cls: "spiral", bar, stage: 0.5, lenticular: false };
  }
  return { cls: fallback, bar: false, stage: 0.5, lenticular: false };
}

/**
 * Inclination (degrees; 0 = face-on, 90 = edge-on) from the apparent axis ratio q = b/a with an intrinsic disk
 * thickness q0 (Hubble 1926): cos^2 i = (q^2 - q0^2) / (1 - q0^2). It is an ESTIMATE, not a measurement.
 */
export function inclinationDeg(majAx: number | null, minAx: number | null, q0 = 0.2): number | null {
  if (!majAx || !minAx || majAx <= 0 || minAx <= 0) return null;
  const q = Math.min(1, minAx / majAx);
  if (q <= q0) return 90;
  return (Math.acos(Math.sqrt((q * q - q0 * q0) / (1 - q0 * q0))) * 180) / Math.PI;
}

/** Apparent axis ratio b/a, or null. */
export function axisRatio(majAx: number | null, minAx: number | null): number | null {
  if (!majAx || !minAx || majAx <= 0 || minAx <= 0) return null;
  return Math.min(1, minAx / majAx);
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export interface SkyFrame {
  /** Unit vector from the galaxy toward the viewer. */
  v: Vec3;
  /** Sky north and east (both perpendicular to v). Scene +Y plays the role of celestial north (the scene has no RA/Dec frame). */
  north: Vec3;
  east: Vec3;
}

export function skyFrame(viewDir: Vec3): SkyFrame {
  const v = norm(viewDir);
  let north = add([0, 1, 0], scale(v, -v[1]));
  if (Math.hypot(...north) < 1e-6) north = add([0, 0, 1], scale(v, -v[2]));
  north = norm(north);
  const d = scale(v, -1); // looking direction
  const east = cross(north, d); // right = d x north; east = -right
  return { v, north, east: norm(east) };
}

export interface DiskBasis {
  /** Major axis (in the sky plane), disk normal, and the in-disk minor axis. Right-handed: X x Y = Z. */
  x: Vec3;
  y: Vec3;
  z: Vec3;
}

/**
 * Orientation of a thin disk seen from `viewDir` so that its apparent major axis points along position angle `paDeg`
 * (east of north) and its apparent axis ratio equals cos(inclination).
 */
export function diskBasis(viewDir: Vec3, paDeg: number, inclDeg: number): DiskBasis {
  const f = skyFrame(viewDir);
  const pa = (paDeg * Math.PI) / 180;
  const m = norm(add(scale(f.north, Math.cos(pa)), scale(f.east, Math.sin(pa))));
  const p = cross(f.v, m); // in the sky plane, perpendicular to m
  const i = (inclDeg * Math.PI) / 180;
  const w = norm(add(scale(p, Math.cos(i)), scale(f.v, Math.sin(i))));
  const n = cross(w, m);
  return { x: m, y: n, z: w };
}

/** Basis for an ellipsoid whose projection on the sky has major axis along PA: local x = major, y = sky-minor, z = line of sight. */
export function ellipsoidBasis(viewDir: Vec3, paDeg: number): DiskBasis {
  const f = skyFrame(viewDir);
  const pa = (paDeg * Math.PI) / 180;
  const m = norm(add(scale(f.north, Math.cos(pa)), scale(f.east, Math.sin(pa))));
  const p = cross(f.v, m);
  return { x: m, y: p, z: f.v };
}

/** Apparent axis ratio of a thin disk with this normal seen along viewDir (should equal cos(inclination)). */
export function apparentAxisRatio(normal: Vec3, viewDir: Vec3): number {
  return Math.abs(dot(norm(normal), norm(viewDir)));
}

// ------------------------------------------------------------------ parameters

export interface Clump { x: number; z: number; sigma: number; w: number; hii: boolean }

export interface GalaxyParams {
  cls: GalaxyClass;
  seed: number;
  stage: number;
  bar: boolean;
  lenticular: boolean;
  /** Spiral: tan(pitch angle), arm phase at r0, wobble phases, arm strengths, disk scale length (units of the galaxy radius). */
  pitchTan: number;
  phi0: number;
  wob: [number, number];
  armStr: [number, number];
  scaleH: number;
  bulgeFrac: number;
  bulgeR: number;
  barAng: number;
  barLen: number;
  barWid: number;
  /** Elliptical: apparent axis ratio b/a (visual default 0.85 when the catalogue has none). */
  q: number;
  /** Irregular: off-centre star-forming clumps. */
  clumps: Clump[];
  /** Irregular: bar centre offset. */
  barOff: [number, number];
  /** Small-scale clumpiness 0..1 (later Hubble stages are more flocculent). */
  flocc: number;
}

/** Radius at which log-spiral arms start (units of the galaxy radius). */
export const ARM_R0 = 0.12;
/** Arm half-width: sigma(r) = ARM_SIGMA0 + ARM_SIGMA1 * r (shader uses the same constants). */
export const ARM_SIGMA0 = 0.05;
export const ARM_SIGMA1 = 0.075;

export function makeParams(info: HubbleInfo, seed: number, morph: Morph | null, forceBar = false): GalaxyParams {
  const rand = mulberry32((seed * 2654435761) >>> 0);
  const t = info.stage;
  const pitchDeg = 8 + 14 * t;
  const bar = info.bar || forceBar;
  const barAng = rand() * Math.PI;
  const qCat = axisRatio(morph?.majAxArcmin ?? null, morph?.minAxArcmin ?? null);
  const clumps: Clump[] = [];
  if (info.cls === "irregular") {
    const n = 7 + Math.floor(rand() * 3);
    const bias = rand() * Math.PI * 2; // the galaxy is lopsided toward one side
    for (let k = 0; k < n; k++) {
      const a = bias + (rand() - 0.5) * 3.2;
      const r = 0.08 + Math.pow(rand(), 0.8) * 0.62;
      clumps.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, sigma: 0.05 + rand() * 0.14, w: 0.4 + rand() * 1.1, hii: rand() < 0.4 });
    }
  }
  return {
    cls: info.cls,
    seed,
    stage: t,
    bar,
    lenticular: info.lenticular,
    pitchTan: Math.tan((pitchDeg * Math.PI) / 180),
    phi0: bar ? barAng : rand() * Math.PI * 2,
    wob: [rand() * 6.28, rand() * 6.28],
    armStr: [0.85 + rand() * 0.15, 0.55 + rand() * 0.3], // deliberately unequal arms
    scaleH: 0.27 - 0.06 * t,
    bulgeFrac: 0.3 - 0.24 * t,
    bulgeR: 0.3 - 0.12 * t,
    barAng,
    barLen: 0.3 + rand() * 0.06,
    barWid: 0.07,
    q: qCat ?? 0.85,
    clumps,
    barOff: [(rand() - 0.5) * 0.25, (rand() - 0.5) * 0.25],
    flocc: t,
  };
}

// ------------------------------------------------------------------ spiral structure (JS twin of the GLSL in SpiralGalaxyModel)

const TAU = Math.PI * 2;
const wrap = (a: number) => a - TAU * Math.round(a / TAU);

/** Azimuth of arm k at radius r. */
export function armPhase(p: Pick<GalaxyParams, "pitchTan" | "phi0" | "wob">, k: number, r: number): number {
  const rr = Math.max(r, ARM_R0);
  return p.phi0 + k * Math.PI + Math.log(rr / ARM_R0) / p.pitchTan + 0.25 * Math.sin(3 * rr + p.wob[0]) + 0.15 * Math.sin(7 * rr + p.wob[1]);
}

/** Arm brightness (0..~1) and dust-lane strength (0..~1) at (r, theta). Dust sits on the inner side of each arm. */
export function armField(p: Pick<GalaxyParams, "pitchTan" | "phi0" | "wob" | "armStr">, r: number, theta: number): { arm: number; dust: number } {
  let arm = 0;
  let dust = 0;
  const sigma = ARM_SIGMA0 + ARM_SIGMA1 * r;
  for (let k = 0; k < 2; k++) {
    const d = wrap(theta - armPhase(p, k, r)) * r; // arc distance across the arm
    arm += p.armStr[k] * Math.exp(-0.5 * (d / sigma) ** 2);
    const dd = (d + 1.5 * sigma) / (0.55 * sigma);
    dust += p.armStr[k] * Math.exp(-0.5 * dd * dd);
  }
  const rampIn = Math.min(1, Math.max(0, (r - 0.1) / 0.15));
  return { arm: Math.min(1.2, arm), dust: Math.min(1, dust * rampIn) };
}

// ------------------------------------------------------------------ star sampling

export interface StarSet {
  /** Local positions in units of the galaxy radius; the disk lies in the XZ plane. */
  pos: Float32Array;
  col: Float32Array;
  /** Relative brightness/size 0.4..~3. */
  size: Float32Array;
  n: number;
}

const OLD: Vec3 = [1.0, 0.8, 0.54];
const MID: Vec3 = [0.97, 0.9, 0.78];
const BLUE: Vec3 = [0.62, 0.76, 1.0];
const HII: Vec3 = [1.0, 0.42, 0.52];
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function sampleStars(p: GalaxyParams, count: number): StarSet {
  const rand = mulberry32((p.seed * 40503 + 7) >>> 0);
  const gauss = () => (rand() + rand() + rand() + rand() - 2) / 2 * 1.7;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0;
    let c: Vec3 = MID;
    let b = 0.6 + 0.9 * rand() * rand(); // brightness tail: a few bright stars, many faint
    if (p.cls === "elliptical") {
      // Hernquist profile r = a s/(1-s), s = sqrt(u): cuspy core, smooth falloff; redrawn beyond the visual edge.
      let r = 2;
      for (let tries = 0; tries < 8 && r > 1; tries++) { const s = Math.sqrt(rand()); r = 0.22 * s / (1 - s + 1e-3); }
      if (r > 1) r = rand() * 0.3;
      const mu = rand() * 2 - 1, ph = rand() * TAU, s2 = Math.sqrt(1 - mu * mu);
      const flat = p.lenticular ? 0.45 : 1;
      x = r * s2 * Math.cos(ph);
      y = r * mu * p.q * flat;
      z = r * s2 * Math.sin(ph) * Math.sqrt(p.q) * flat;
      c = mix3(OLD, MID, Math.min(1, r * 1.4));
      b *= 0.8;
    } else if (p.cls === "spiral") {
      const u = rand();
      const barF = p.bar ? 0.1 : 0;
      if (u < p.bulgeFrac) {
        const r = Math.min(0.55, (p.bulgeR * 0.45) / Math.sqrt(Math.pow(rand() + 1e-4, -2 / 3) - 1));
        const mu = rand() * 2 - 1, ph = rand() * TAU, s2 = Math.sqrt(1 - mu * mu);
        x = r * s2 * Math.cos(ph); y = r * mu * 0.8; z = r * s2 * Math.sin(ph);
        c = mix3(OLD, MID, Math.min(1, r * 2));
      } else if (u < p.bulgeFrac + barF) {
        const a = (rand() * 2 - 1) * p.barLen, w = gauss() * p.barWid * 0.7;
        const ca = Math.cos(p.barAng), sa = Math.sin(p.barAng);
        x = a * ca - w * sa; z = a * sa + w * ca; y = gauss() * 0.02;
        c = mix3(OLD, MID, 0.4);
      } else {
        // exponential disk; azimuth accepted by arm/dust weight (average acceptance ~0.4)
        let r = 0, th = 0;
        for (let tries = 0; tries < 40; tries++) {
          const rr = -p.scaleH * Math.log(1 - rand() * (1 - Math.exp(-1 / p.scaleH)));
          const tt = rand() * TAU;
          const f = armField(p, rr, tt);
          const wgt = (0.3 + 1.3 * f.arm * (0.6 + 0.4 * (1 - p.flocc * 0.5))) * (1 - 0.88 * f.dust);
          r = rr; th = tt;
          if (rand() < wgt / 1.6) break;
        }
        x = Math.cos(th) * r; z = Math.sin(th) * r;
        y = gauss() * 0.022 * (1 - 0.5 * r);
        const f = armField(p, r, th);
        c = mix3(mix3(OLD, MID, Math.min(1, r * 1.6)), BLUE, Math.min(1, f.arm * 0.9 * (0.4 + r)));
        if (f.arm > 0.35 && rand() < 0.05) { c = HII; b *= 1.6; }
      }
    } else {
      // irregular: mixture of off-centre clumps, a lopsided bar and a faint diffuse disk; no symmetry, no arms
      const tot = p.clumps.reduce((s, k) => s + k.w, 0) + 1.2 + 0.9;
      let pick = rand() * tot;
      let placed = false;
      for (const k of p.clumps) {
        pick -= k.w;
        if (pick < 0) {
          x = k.x + gauss() * k.sigma; z = k.z + gauss() * k.sigma; y = gauss() * 0.04;
          c = k.hii && rand() < 0.18 ? HII : mix3(BLUE, MID, rand() * 0.5);
          if (c === HII) b *= 1.5;
          placed = true;
          break;
        }
      }
      if (!placed) {
        if (pick < 1.2) { // bar, off-centre
          const a = gauss() * 0.34, w = gauss() * 0.1;
          const ca = Math.cos(p.barAng), sa = Math.sin(p.barAng);
          x = p.barOff[0] + a * ca - w * sa; z = p.barOff[1] + a * sa + w * ca; y = gauss() * 0.04;
          c = mix3(OLD, MID, 0.5);
        } else {
          x = gauss() * 0.42 + p.barOff[0]; z = gauss() * 0.36 + p.barOff[1]; y = gauss() * 0.06;
          c = mix3(OLD, MID, rand());
          b *= 0.7;
        }
      }
      const rr = Math.hypot(x, z);
      if (rr > 1) { x /= rr * 1.02; z /= rr * 1.02; }
    }
    pos.set([x, y, z], i * 3);
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    size[i] = 0.5 + b * 1.1;
  }
  return { pos, col, size, n: count };
}

/** Where the catalogue morphology came from, for the info panel (honest labelling). */
export function morphologyNote(m: Morph | null, info: HubbleInfo, inclEst: number | null): string {
  const kind = info.cls === "spiral" ? "spiral" : info.cls === "elliptical" ? "elliptical" : "irregular";
  const src = m?.hubble
    ? `Catalogue (OpenNGC): Hubble type ${m.hubble}${m.posAngDeg !== null ? `, position angle ${m.posAngDeg}°` : ""}${inclEst !== null ? `; inclination about ${Math.round(inclEst)}° is estimated from the apparent axis ratio` : ""}.`
    : "Catalogue morphology: only the object description (barred spiral); no inclination is used.";
  return `Artistic visualization, not to scale. The ${kind} look is procedural: arms, dust lanes, clumps and star colours are not measured. ${src}`;
}
