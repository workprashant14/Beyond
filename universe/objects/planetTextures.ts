import * as THREE from "three";

/**
 * Procedural, ARTISTIC planet textures drawn on a canvas (no image downloads,
 * no licensing concerns). They hint at each world's look but are not maps.
 * Client-only: call from inside the Canvas.
 */
export type PlanetTexture =
  | "sun" | "mercury" | "venus" | "earth" | "mars" | "jupiter" | "saturn" | "uranus" | "neptune" | "moon";

type RGB = [number, number, number];
type Painter = (x: number, y: number, z: number, lat: number) => RGB;

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => {
  const k = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};
const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

function hash(x: number, y: number, z: number, s: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483629) ^ Math.imul(s, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function noise3(x: number, y: number, z: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, s);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

/** Fractal noise normalised to roughly 0..1. */
function fbm(x: number, y: number, z: number, s: number, oct = 4): number {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * noise3(x * f, y * f, z * f, s + i * 17);
    norm += a;
    f *= 2;
    a *= 0.5;
  }
  return sum / norm;
}

const bands = (lat: number, x: number, y: number, z: number, freq: number, turb: number, s: number) =>
  Math.sin(lat * freq + (fbm(x * 3, y * 3, z * 3, s) - 0.5) * turb) * 0.5 + 0.5;

const PAINTERS: Record<PlanetTexture, Painter> = {
  sun: (x, y, z) => mix(hex("#ff8a1f"), hex("#fff1a8"), fbm(x * 5, y * 5, z * 5, 3) * 1.4 - 0.15),
  mercury: (x, y, z) => {
    const g = 0.33 + 0.4 * fbm(x * 3, y * 3, z * 3, 5);
    const crater = fbm(x * 10, y * 10, z * 10, 9) > 0.62 ? 0.78 : 1;
    return scale([g * 255, g * 245, g * 232], crater);
  },
  moon: (x, y, z) => {
    const g = 0.5 + 0.35 * fbm(x * 4, y * 4, z * 4, 8);
    const maria = fbm(x * 1.6, y * 1.6, z * 1.6, 2) < 0.46 ? 0.62 : 1;
    const crater = fbm(x * 12, y * 12, z * 12, 4) > 0.64 ? 0.85 : 1;
    return scale([g * 235, g * 233, g * 228], maria * crater);
  },
  venus: (x, y, z) => mix(hex("#c9a15f"), hex("#f3e3b8"), fbm(x * 2.5, y * 5, z * 2.5, 6) * 1.3 - 0.1),
  earth: (x, y, z, lat) => {
    const h = fbm(x * 2.2 + 3, y * 2.2, z * 2.2, 11);
    const al = Math.abs(lat);
    let c: RGB =
      h < 0.52
        ? mix(hex("#10346b"), hex("#2f74c0"), (h - 0.3) / 0.22)
        : mix(hex("#3d7a3a"), hex("#a59468"), (h - 0.52) / 0.18);
    if (h >= 0.52 && al < 0.35) c = mix(c, hex("#c9b27a"), 0.3);
    if (al > 1.25) c = mix(c, hex("#f2f6ff"), (al - 1.25) * 6);
    const cl = fbm(x * 3.5, y * 3.5 + 7, z * 3.5, 23);
    if (cl > 0.57) c = mix(c, hex("#ffffff"), Math.min(0.85, (cl - 0.57) * 4));
    return c;
  },
  mars: (x, y, z, lat) => {
    let c = mix(hex("#7b3b22"), hex("#c9693a"), fbm(x * 2.5, y * 2.5, z * 2.5, 13) * 1.4 - 0.2);
    if (Math.abs(lat) > 1.38) c = mix(c, hex("#f0ece8"), 0.85);
    return c;
  },
  jupiter: (x, y, z, lat) => {
    const s = bands(lat, x, y, z, 15, 1.7, 5);
    return scale(mix(hex("#b57f55"), hex("#f0e0c4"), s), 0.88 + 0.2 * fbm(x * 8, y * 8, z * 8, 7));
  },
  saturn: (x, y, z, lat) => {
    const s = bands(lat, x, y, z, 11, 0.6, 15);
    return scale(mix(hex("#c8b078"), hex("#ecdcab"), s), 0.94 + 0.1 * fbm(x * 8, y * 8, z * 8, 4));
  },
  uranus: (x, y, z, lat) => mix(hex("#8fd6dc"), hex("#b5ecef"), bands(lat, x, y, z, 6, 0.4, 21)),
  neptune: (x, y, z, lat) => {
    let c = mix(hex("#2f4fd0"), hex("#5f86ff"), bands(lat, x, y, z, 9, 1.1, 31));
    if (fbm(x * 5, y * 9, z * 5, 40) > 0.68) c = mix(c, hex("#ffffff"), 0.35);
    return c;
  },
};

const cache = new Map<string, THREE.CanvasTexture>();

export function getPlanetTexture(kind: PlanetTexture): THREE.CanvasTexture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const W = 256, H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const paint = PAINTERS[kind];
  for (let py = 0; py < H; py++) {
    const lat = (0.5 - (py + 0.5) / H) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let px = 0; px < W; px++) {
      const lon = ((px + 0.5) / W) * Math.PI * 2;
      const [r, g, b] = paint(cl * Math.cos(lon), sl, cl * Math.sin(lon), lat);
      const i = (py * W + px) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(kind, tex);
  return tex;
}

/** Planar ring texture; pairs with RingGeometry(inner, outer) where inner/outer = 0.565. */
export function getRingTexture(): THREE.CanvasTexture {
  const hit = cache.get("rings");
  if (hit) return hit;
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const f = Math.hypot(px + 0.5 - S / 2, py + 0.5 - S / 2) / (S / 2);
      const t = (f - 0.565) / 0.435;
      const i = (py * S + px) * 4;
      if (f > 1 || t < 0) continue;
      let a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 70)) * (0.6 + 0.4 * Math.sin(t * 23 + 1));
      if (t > 0.58 && t < 0.64) a *= 0.06; // Cassini-like gap
      if (t > 0.3 && t < 0.58) a = Math.min(1, a * 1.25);
      const shade = 0.8 + 0.2 * Math.sin(t * 140);
      img.data[i] = 220 * shade;
      img.data[i + 1] = 202 * shade;
      img.data[i + 2] = 160 * shade;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set("rings", tex);
  return tex;
}
