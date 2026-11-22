/**
 * Angular grid over the celestial sphere for fast "what is near this direction?" queries (picking).
 * Points are stored in latitude bands; each band is split into longitude cells of about equal angular width,
 * laid out as compressed arrays (no per-cell objects). A query returns every point that can lie within the radius,
 * a superset of the true answer: callers still run their exact pixel test on the candidates.
 */
const D2R = Math.PI / 180;

export class SkyGrid {
  private readonly bands: number;
  private readonly bandRad: number;
  /** Cells per band and the offset of each band's first cell in `start`. */
  private readonly cells: Uint16Array;
  private readonly cellBase: Uint32Array;
  private readonly start: Uint32Array;
  private readonly items: Uint32Array;

  /** @param pos x,y,z per point (any radius); @param n number of points; @param bandDeg band height in degrees */
  constructor(pos: Float32Array, n: number, bandDeg = 3) {
    this.bands = Math.ceil(180 / bandDeg);
    this.bandRad = (bandDeg * D2R);
    this.cells = new Uint16Array(this.bands);
    this.cellBase = new Uint32Array(this.bands + 1);
    for (let b = 0; b < this.bands; b++) {
      const mid = (-90 + (b + 0.5) * bandDeg) * D2R;
      this.cells[b] = Math.max(1, Math.floor((360 * Math.cos(mid)) / bandDeg));
      this.cellBase[b + 1] = this.cellBase[b] + this.cells[b];
    }
    const total = this.cellBase[this.bands];
    const counts = new Uint32Array(total + 1);
    const cellOf = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      const c = this.cellIndex(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      cellOf[i] = c;
      counts[c + 1]++;
    }
    for (let c = 0; c < total; c++) counts[c + 1] += counts[c];
    this.start = counts;
    this.items = new Uint32Array(n);
    const fill = counts.slice(0, total);
    for (let i = 0; i < n; i++) this.items[fill[cellOf[i]]++] = i;
  }

  private band(lat: number) {
    return Math.min(this.bands - 1, Math.max(0, Math.floor((lat + Math.PI / 2) / this.bandRad)));
  }
  private cellIndex(x: number, y: number, z: number) {
    const r = Math.hypot(x, y, z) || 1;
    const b = this.band(Math.asin(Math.max(-1, Math.min(1, y / r))));
    const lon = Math.atan2(z, x); // -pi..pi
    const k = Math.min(this.cells[b] - 1, Math.floor(((lon + Math.PI) / (2 * Math.PI)) * this.cells[b]));
    return this.cellBase[b] + k;
  }

  /** Fills `out` with the indices of all points within `radiusRad` of the unit direction (dx,dy,dz), plus possibly a few farther ones. */
  query(dx: number, dy: number, dz: number, radiusRad: number, out: number[]): void {
    out.length = 0;
    const lat = Math.asin(Math.max(-1, Math.min(1, dy)));
    const lon = Math.atan2(dz, dx);
    const b0 = this.band(lat - radiusRad), b1 = this.band(lat + radiusRad);
    // Every point within r of the query differs in longitude by at most asin(sin r / cos(query latitude)); if the cap reaches a pole, take whole bands.
    const sinR = Math.sin(radiusRad), cosLat = Math.cos(lat);
    const dLon = cosLat > sinR ? Math.asin(sinR / cosLat) : Math.PI;
    for (let b = b0; b <= b1; b++) {
      const n = this.cells[b];
      const base = this.cellBase[b];
      let first = 0, count = n;
      if (dLon < Math.PI) {
        count = Math.min(n, Math.ceil((2 * dLon * n) / (2 * Math.PI)) + 2);
        first = Math.floor(((lon - dLon + Math.PI) / (2 * Math.PI)) * n) - 1;
      }
      for (let k = 0; k < count; k++) {
        const cell = base + ((((first + k) % n) + n) % n);
        for (let m = this.start[cell]; m < this.start[cell + 1]; m++) out.push(this.items[m]);
      }
    }
  }
}

const cache = new WeakMap<Float32Array, SkyGrid>();
/** One grid per position array, built on first use. */
export function gridFor(pos: Float32Array, n: number): SkyGrid {
  let g = cache.get(pos);
  if (!g) { g = new SkyGrid(pos, n); cache.set(pos, g); }
  return g;
}
