import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  raDecToVec, lookAngles, formatRA, formatDec, formatMag, estimateTempK, starColor, distanceLyFromParallax,
  bayerName, flamsteedName, starDisplayName,
} from "../utils/sky";
import { DATA_KIND } from "../types/provenance";

const near = (a: number, b: number, tol: number, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const load = <T>(f: string) => JSON.parse(readFileSync(`public/sky/${f}`, "utf8")) as T;

test("celestial sphere orientation: pole is +Y, equinox +X, RA 90deg is -Z (east is counter-clockwise from the north)", () => {
  const [x0, y0, z0] = raDecToVec(0, 0, 1);
  near(x0, 1, 1e-9); near(y0, 0, 1e-9); near(z0, 0, 1e-9);
  const [x1, , z1] = raDecToVec(90, 0, 1);
  near(x1, 0, 1e-9); near(z1, -1, 1e-9);
  near(raDecToVec(0, 90, 1)[1], 1, 1e-9);
});

test("lookAngles points a YXZ camera at the requested direction", () => {
  for (const [ra, dec] of [[101.29, -16.72], [279.23, 38.78], [0, 0], [200, 60]]) {
    const { yaw, pitch } = lookAngles(ra, dec);
    const fwd = [-Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.cos(yaw)];
    const want = raDecToVec(ra, dec, 1);
    for (let i = 0; i < 3; i++) near(fwd[i], want[i], 1e-9, `axis ${i} for ${ra},${dec}`);
  }
});

test("coordinate formatting matches known values for Sirius", () => {
  assert.equal(formatRA(101.2872), "6h 45m 09s"); // 06h45m08.9s
  assert.equal(formatDec(-16.7161), "−16° 42′ 58″");
  assert.equal(formatMag(-1.44), "−1.44");
});

test("temperature estimate from B-V is sensible and bounded", () => {
  near(estimateTempK(0.65)!, 5778, 80, "Sun-like colour");
  near(estimateTempK(0.009)!, 10000, 400, "Sirius");
  assert.ok(estimateTempK(1.5)! < 4200, "red giant is cool");
  assert.equal(estimateTempK(null), null);
  assert.equal(estimateTempK(3), null);
  const [r, , b] = starColor(1.6); assert.ok(r > b, "cool stars render red");
  const [r2, , b2] = starColor(-0.2); assert.ok(b2 > r2, "hot stars render blue");
});

test("parallax distance only when the measurement is good", () => {
  near(distanceLyFromParallax(379.21, 1.58)!, 8.6, 0.05, "Sirius ~8.6 ly");
  assert.equal(distanceLyFromParallax(null, null), null);
  assert.equal(distanceLyFromParallax(-1, 0.5), null);
  assert.equal(distanceLyFromParallax(2, 1), null, "S/N below 5 is refused");
});

test("designations", () => {
  assert.equal(bayerName("α", "Canis Majoris"), "α Canis Majoris");
  assert.equal(bayerName("α", "Canis Majoris", true), "Alpha Canis Majoris");
  assert.equal(bayerName("κ1", "Cygni"), "κ¹ Cygni");
  assert.equal(bayerName("c", "Puppis"), "c Puppis");
  assert.equal(bayerName("undefined3", "Tauri"), null);
  assert.equal(flamsteedName("61", "Cygni"), "61 Cygni");
  assert.equal(starDisplayName(32349, { n: "Sirius" }, "Canis Majoris", "CMa"), "Sirius");
  assert.equal(starDisplayName(1, { b: "β" }, "Phoenicis", "Phe"), "β Phoenicis");
  assert.equal(starDisplayName(63, { v: "CG" }, "Andromedae", "And"), "CG And");
  assert.equal(starDisplayName(5, undefined, undefined, undefined), "HIP 5");
});

test("sky data: exactly the 88 IAU constellations, each with figure, label and boundary", () => {
  const cons = load<{ id: string; name: string; gen: string; labels: number[][]; lines: number[][][]; bounds: number[][][] }[]>("constellations.json");
  assert.equal(cons.length, 88);
  assert.equal(new Set(cons.map((c) => c.id)).size, 88);
  assert.equal(new Set(cons.map((c) => c.name)).size, 88);
  for (const want of ["Orion", "Ursa Major", "Ursa Minor", "Cassiopeia", "Scorpius", "Leo", "Cygnus", "Lyra", "Andromeda", "Crux", "Serpens"]) {
    assert.ok(cons.some((c) => c.name === want), `missing ${want}`);
  }
  for (const c of cons) {
    assert.ok(c.labels.length >= 1 && c.lines.length >= 1 && c.bounds.length >= 1, `${c.name} incomplete`);
    for (const [ra, dec] of [...c.labels, ...c.lines.flat(), ...c.bounds.flat()]) {
      assert.ok(ra >= 0 && ra < 360 && dec >= -90 && dec <= 90, `${c.name} bad coordinate ${ra},${dec}`);
    }
  }
  assert.equal(cons.find((c) => c.name === "Serpens")!.labels.length, 2, "Serpens Caput + Cauda");
});

test("sky data: star catalogue ranges and well-known reference stars", () => {
  const s = load<{ n: number; hip: number[]; ra: number[]; dec: number[]; mag: number[]; bv: (number | null)[] }>("stars.json");
  assert.equal(s.n, s.hip.length);
  assert.ok(s.n > 5000);
  assert.equal(new Set(s.hip).size, s.n, "HIP numbers are unique");
  for (let i = 0; i < s.n; i++) {
    assert.ok(s.ra[i] >= 0 && s.ra[i] < 360 && s.dec[i] >= -90 && s.dec[i] <= 90 && s.mag[i] > -2 && s.mag[i] < 6.6, `star ${s.hip[i]}`);
  }
  // Reference values from standard catalogues: RA/Dec J2000 and V magnitude (tolerances allow rounding and epoch effects).
  const ref: [number, string, number, number, number][] = [
    [32349, "Sirius", 101.287, -16.716, -1.44],
    [91262, "Vega", 279.235, 38.784, 0.03],
    [27989, "Betelgeuse", 88.793, 7.407, 0.45],
    [24436, "Rigel", 78.634, -8.202, 0.18],
    [11767, "Polaris", 37.95, 89.264, 1.97],
  ];
  for (const [hip, name, ra, dec, mag] of ref) {
    const i = s.hip.indexOf(hip);
    assert.ok(i >= 0, `${name} missing`);
    near(s.ra[i], ra, 0.05, `${name} RA`); near(s.dec[i], dec, 0.05, `${name} Dec`); near(s.mag[i], mag, 0.1, `${name} mag`);
  }
});

test("constellation figures sit on real catalogued stars", () => {
  const s = load<{ ra: number[]; dec: number[] }>("stars.json");
  const cons = load<{ lines: number[][][] }[]>("constellations.json");
  let total = 0, off = 0;
  for (const c of cons) for (const [ra, dec] of c.lines.flat()) {
    total++;
    let best = 1e9;
    for (let i = 0; i < s.ra.length; i++) {
      const dr = ((ra - s.ra[i] + 540) % 360) - 180;
      best = Math.min(best, Math.hypot(dr * Math.cos((dec * Math.PI) / 180), dec - s.dec[i]));
    }
    if (best > 0.05) off++;
  }
  assert.ok(total > 800);
  assert.ok(off <= 3, `${off} of ${total} figure vertices are not on a catalogued star`);
});

test("every data kind is described", () => {
  for (const k of ["observed", "estimated", "artistic", "theoretical"] as const) assert.ok(DATA_KIND[k].label && DATA_KIND[k].blurb);
});

// ---------- SIMBAD parser (synthetic fixtures built from the documented TAP JSON shape; the live service was not reachable from the build sandbox) ----------
import { parseSimbad, getStarLive } from "../services/live/simbad";
import { clearCache } from "../services/live/cache";
import type { LiveError } from "../services/live/http";

const SIMBAD = {
  metadata: [{ name: "main_id" }, { name: "otype" }, { name: "sp_type" }, { name: "plx_value" }, { name: "plx_err" }],
  data: [["SYNTHETIC star", "**", "A0mA1Va", 379.21, 1.58]],
};
const rowsOf = (j: unknown) => Object.fromEntries(parseSimbad(j).map((r) => [r.label, r.value]));

test("simbad: parses by column name and derives distance from a good parallax", () => {
  const r = rowsOf(SIMBAD);
  assert.equal(r["SIMBAD identifier"], "SYNTHETIC star");
  assert.equal(r["Object type"], "Double or multiple star");
  assert.equal(r["Spectral type"], "A0mA1Va");
  assert.match(r["Parallax"], /379\.21 mas ± 1\.58/);
  assert.match(r["Distance"], /about 8\.6 light-years/);
  const shuffled = { metadata: [...SIMBAD.metadata].reverse(), data: [[...SIMBAD.data[0]].reverse()] };
  assert.deepEqual(rowsOf(shuffled), r, "column order must not matter");
});

test("simbad: poor or missing parallax never yields a distance; unknown codes stay raw", () => {
  const noisy = { ...SIMBAD, data: [["X", "Zz*", null, 2, 1.5]] };
  const r = rowsOf(noisy);
  assert.equal(r["Distance"], "Data unavailable");
  assert.equal(r["Spectral type"], "Data unavailable");
  assert.match(r["Object type"], /type code “Zz\*”/);
  assert.equal(rowsOf({ ...SIMBAD, data: [["X", null, null, null, null]] })["Parallax"], "Data unavailable");
});

test("simbad: odd payloads fail loudly, not with wrong numbers", () => {
  assert.throws(() => parseSimbad(null), (e: LiveError) => e.reason === "parse");
  assert.throws(() => parseSimbad({ metadata: [], data: [] }), (e: LiveError) => e.reason === "not-found");
  assert.throws(() => parseSimbad({ metadata: [{ name: "foo" }], data: [[1]] }), (e: LiveError) => e.reason === "parse");
});

test("getStarLive: query targets the HIP identifier, failures degrade to 'unavailable', hosts are fixed", async () => {
  const real = globalThis.fetch;
  clearCache();
  let seen: URL | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL) => { seen = new URL(String(input)); return new Response(JSON.stringify(SIMBAD)); }) as typeof fetch;
  const ok = await getStarLive(32349);
  assert.equal(ok.measurements.status, "ok");
  assert.equal(seen!.hostname, "simbad.cds.unistra.fr");
  assert.match(seen!.searchParams.get("query")!, /i\.id = 'HIP 32349'/);
  clearCache();
  globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
  const bad = await getStarLive(1);
  assert.equal(bad.measurements.status, "unavailable");
  globalThis.fetch = real;
  clearCache();
  const invalid = await getStarLive(-5);
  assert.ok(invalid.measurements.status === "unavailable" && invalid.measurements.reason === "not-found", "invalid HIP is refused before any request");
});

// ---------- sky search ----------
import { searchSky, buildSkyIndex } from "../utils/skySearch";
import { raDecToVec as _r } from "../utils/sky";
import type { SkyData } from "../universe/sky/skyData";

function fakeSky(): SkyData {
  const s = load<{ n: number; hip: number[]; ra: number[]; dec: number[]; mag: number[]; bv: (number | null)[]; con: string[] }>("stars.json");
  const names = load<SkyData["names"]>("starinfo.json");
  const constellations = load<SkyData["constellations"]>("constellations.json");
  return {
    n: s.n, hip: Int32Array.from(s.hip), ra: Float32Array.from(s.ra), dec: Float32Array.from(s.dec), mag: Float32Array.from(s.mag),
    bv: Float32Array.from(s.bv, (v) => v ?? NaN), pos: new Float32Array(s.n * 3), names, con: s.con, constellations,
    conById: new Map(constellations.map((c) => [c.id, c])), indexOfHip: new Map(s.hip.map((h, i) => [h, i])),
  };
}

test("sky search finds stars by proper name, Bayer name, HIP and HD numbers, and constellations by name or abbreviation", () => {
  const sky = fakeSky();
  void _r;
  const top = (q: string) => searchSky(sky, q, 3)[0];
  assert.deepEqual([top("betelgeuse").kind, top("betelgeuse").id], ["star", "27989"]);
  assert.equal(top("alpha orionis").id, "27989", "Bayer name");
  assert.equal(top("alpha ori").id, "27989", "Bayer name with IAU abbreviation");
  assert.equal(top("hip 32349").name, "Sirius");
  assert.equal(top("hd 48915").name, "Sirius");
  assert.deepEqual([top("ursa major").kind, top("ursa major").id], ["con", "UMa"]);
  assert.deepEqual([top("cyg").kind, top("cyg").id], ["con", "Cyg"]);
  assert.equal(top("zzzzqq"), undefined);
  assert.deepEqual(searchSky(sky, "", 5), []);
});

test("sky search can skip stars the main catalogue already offers, and orders by relevance then brightness", () => {
  const sky = fakeSky();
  assert.ok(!searchSky(sky, "sirius", 5, new Set(["sirius"])).some((h) => h.name === "Sirius"));
  const r = searchSky(sky, "alpha", 5);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score);
  assert.ok(buildSkyIndex(sky).length === sky.n + 88);
});

// ---------- deep-sky objects ----------
import { DSO_TYPE, DSO_GROUPS, dsoGroupIndex, dsoMagLimit, dsoMarkerPx, dsoFocusFov, compactKey, messierName, formatArcmin, dsoTitle, isDsoType } from "../utils/dso";

interface RawDso { n: number; id: string[]; d: string[]; t: string[]; c: string[]; ra: number[]; dec: number[]; mag: (number | null)[]; mb: string[]; a: (number | null)[]; b: (number | null)[]; h: string[]; v: (number | null)[]; z: (number | null)[]; p: (number | null)[]; names: Record<string, string> }
const bright = load<RawDso>("dsos-bright.json");
const faint = load<RawDso>("dsos-faint.json");

test("dso data: tiers are disjoint, typed, in range, constellation-tagged, and exclude stars/duplicates/dark nebulae", () => {
  const cons = new Set(load<{ id: string }[]>("constellations.json").map((c) => c.id));
  assert.equal(new Set([...bright.id, ...faint.id]).size, bright.n + faint.n, "ids unique across tiers");
  assert.equal(bright.n + faint.n, 12094);
  for (const s of [bright, faint]) {
    for (const k of ["id", "d", "t", "c", "ra", "dec", "mag", "mb", "a", "b", "h", "v"] as const) assert.equal(s[k].length, s.n, k);
    for (let i = 0; i < s.n; i++) {
      assert.ok(isDsoType(s.t[i]), `unknown type ${s.t[i]} for ${s.id[i]}`);
      assert.ok(s.ra[i] >= 0 && s.ra[i] < 360 && s.dec[i] >= -90 && s.dec[i] <= 90, `${s.id[i]} position`);
      const m = s.mag[i]; assert.ok(m === null || (m > -5 && m < 30), `${s.id[i]} mag ${m}`);
      assert.ok(s.c[i] === "" || cons.has(s.c[i]), `${s.id[i]} constellation ${s.c[i]}`);
      assert.equal(s.mb[i] === "", m === null, `${s.id[i]} band/mag consistency`);
    }
  }
  assert.ok(bright.mag.every((m, i) => (m !== null && m <= 10) || /^M \d/.test(bright.d[i])), "bright tier is mag <= 10 or Messier");
  assert.ok(faint.mag.every((m, i) => (m === null || m > 10) && !/^M \d/.test(faint.d[i])), "faint tier holds the rest");
  assert.ok(bright.n < 700, "first load stays small");
});

test("dso data: Messier objects match well-known catalogue values (including M 87, which another dataset had wrong)", () => {
  const all = { d: [...bright.d, ...faint.d] };
  const messier = all.d.filter((d) => /^M \d+$/.test(d));
  assert.ok(messier.length >= 105, `only ${messier.length} Messier objects`);
  const at = (d: string) => { const i = bright.d.indexOf(d); assert.ok(i >= 0, `${d} missing from bright tier`); return i; };
  // [designation, type, constellation, RA, Dec] from standard catalogues, J2000
  const ref: [string, string | null, string, number, number][] = [
    ["M 31", "s", "And", 10.685, 41.269],
    ["M 1", null, "Tau", 83.633, 22.014],
    ["M 13", "gc", "Her", 250.423, 36.46],
    ["M 57", "pn", "Lyr", 283.396, 33.029],
    ["M 87", "e", "Vir", 187.706, 12.391],
    ["M 51", "s", "CVn", 202.47, 47.195],
    ["M 42", null, "Ori", 83.82, -5.39],
  ];
  for (const [d, t, c, ra, dec] of ref) {
    const i = at(d);
    if (t) assert.equal(bright.t[i], t, `${d} type`);
    assert.equal(bright.c[i], c, `${d} constellation`);
    near(bright.ra[i], ra, 0.05, `${d} RA`); near(bright.dec[i], dec, 0.05, `${d} Dec`);
  }
  const m31 = at("M 31");
  near(bright.mag[m31]!, 3.44, 0.05, "M31 V magnitude"); assert.equal(bright.mb[m31], "V");
  assert.equal(bright.names["NGC 224"], "Andromeda Galaxy");
  assert.ok(bright.v[m31]! < 0, "M31 approaches us (negative radial velocity)");
});

test("dso utils: legend covers every group, helpers behave", () => {
  for (const t of Object.keys(DSO_TYPE)) assert.ok(dsoGroupIndex(t) >= 0 && dsoGroupIndex(t) < DSO_GROUPS.length);
  assert.equal(dsoGroupIndex("zz"), -1);
  assert.equal(DSO_GROUPS.length, 8);
  assert.equal(DSO_TYPE.hii.group, "nebula");
  assert.ok(dsoMagLimit(90) < dsoMagLimit(40) && dsoMagLimit(40) < dsoMagLimit(20) && dsoMagLimit(20) < dsoMagLimit(5), "zoom reveals fainter objects");
  assert.equal(dsoMarkerPx(null), 9);
  assert.ok(dsoMarkerPx(189) > dsoMarkerPx(2) && dsoMarkerPx(1e6) <= 22);
  assert.ok(dsoFocusFov(189) > dsoFocusFov(1) && dsoFocusFov(1) === 6 && dsoFocusFov(1e5) === 45);
  assert.equal(compactKey("NGC 224"), "ngc224");
  assert.equal(messierName("M 31"), "Messier 31");
  assert.equal(messierName("NGC 224"), null);
  assert.equal(formatArcmin(189.1, 61.7), "189′ × 62′");
  assert.equal(formatArcmin(5, 5), "5′");
  assert.equal(formatArcmin(null, null), null);
  assert.equal(dsoTitle("Andromeda Galaxy", "M 31", "NGC 224"), "Andromeda Galaxy");
  assert.equal(dsoTitle(undefined, "M 2", "NGC 7089"), "Messier 2");
  assert.equal(dsoTitle(undefined, "NGC 1", "NGC 1"), "NGC 1");
});

// ---------- SIMBAD for deep-sky objects (synthetic fixture) ----------
import { parseSimbadDso, isSimbadIdent, getDsoLive } from "../services/live/simbad";

const DSO_JSON = { metadata: [{ name: "main_id" }, { name: "otype" }, { name: "morph_type" }, { name: "rvz_redshift" }], data: [["SYNTHETIC galaxy", "GiG", "SA(s)b", -0.001001]] };

test("simbad dso: parses by column name, shows redshift as measured, never derives a distance", () => {
  const r = Object.fromEntries(parseSimbadDso(DSO_JSON).map((x) => [x.label, x.value]));
  assert.equal(r["Object type"], "Galaxy in a group of galaxies");
  assert.equal(r["Morphological type"], "SA(s)b");
  assert.match(r["Redshift (z)"], /^-0\.001/);
  assert.ok(!Object.keys(r).some((k) => /distance/i.test(k)));
  const none = Object.fromEntries(parseSimbadDso({ ...DSO_JSON, data: [["X", null, null, null]] }).map((x) => [x.label, x.value]));
  assert.equal(none["Redshift (z)"], "Data unavailable");
  assert.throws(() => parseSimbadDso({ metadata: [{ name: "x" }], data: [[1]] }), (e: LiveError) => e.reason === "parse");
});

test("simbad dso: identifiers that could alter the query are refused before any request", async () => {
  for (const ok of ["NGC 224", "M 31", "IC 4703", "NGC 1952A", "Mel 22"]) assert.ok(isSimbadIdent(ok), ok);
  for (const bad of ["NGC 224' OR 1=1 --", "", "a;b", "NGC", "1234", "NGC  224", "WAYTOOLONGIDENT 12345"]) assert.ok(!isSimbadIdent(bad), bad);
  const real = globalThis.fetch; let called = 0;
  globalThis.fetch = (async () => { called++; return new Response("{}"); }) as typeof fetch;
  clearCache();
  const r = await getDsoLive("x'; DROP");
  globalThis.fetch = real;
  assert.equal(called, 0);
  assert.ok(r.measurements.status === "unavailable");
});

// ---------- deep-sky search ----------
import type { DsoSet } from "../universe/sky/skyData";
import { raDecToVec as rdv } from "../utils/sky";

function fakeDso(): DsoSet {
  const parts = [bright, faint];
  const join = <T>(k: "id" | "d" | "t" | "c" | "mb" | "h"): T[] => parts.flatMap((p) => p[k]) as T[];
  const num = (k: "ra" | "dec") => Float32Array.from(parts.flatMap((p) => p[k]));
  const nn = (k: "mag" | "a" | "b" | "v") => Float32Array.from(parts.flatMap((p) => p[k]).map((x) => (x === null ? NaN : x)));
  const id = join<string>("id");
  const ra = num("ra"), dec = num("dec");
  const pos = new Float32Array(id.length * 3);
  id.forEach((_, i) => pos.set(rdv(ra[i], dec[i]), i * 3));
  return {
    n: id.length, id, desig: join<string>("d"), type: join<string>("t"), con: join<string>("c"), ra, dec, mag: nn("mag"), magBand: join<string>("mb"),
    a: nn("a"), b: nn("b"), hubble: join<string>("h"), radVel: nn("v"), redshift: Float64Array.from(parts.flatMap((p) => p.z).map((x) => (x === null ? NaN : x))), parallax: Float64Array.from(parts.flatMap((p) => p.p).map((x) => (x === null ? NaN : x))), names: Object.assign({}, bright.names, faint.names), pos,
    indexOfId: new Map(id.map((x, i) => [x, i])),
  };
}

test("deep-sky search: Messier, NGC and IC numbers (with or without a space), proper names and Messier names", () => {
  const sky = fakeSky(), dso = fakeDso();
  const top = (q: string) => searchSky(sky, q, 3, new Set(), dso)[0];
  for (const q of ["m31", "m 31", "ngc 224", "ngc224", "andromeda galaxy", "messier 31"]) {
    assert.deepEqual([top(q).kind, top(q).id], ["dso", "NGC 224"], q);
  }
  assert.equal(top("crab nebula").id, "NGC 1952");
  assert.equal(top("m87").id, "NGC 4486");
  assert.equal(top("ic 4703").kind, "dso");
  assert.match(top("m31").sub, /Spiral galaxy · Andromeda · NGC 224/);
  // stars and constellations still win their own queries
  assert.equal(top("betelgeuse").kind, "star");
  assert.equal(top("ursa major").kind, "con");
});

// ---------- saved items ----------
import { parseSaved } from "../utils/savedSky";
test("saved items: corrupt or hostile storage never throws and invalid entries are dropped", () => {
  assert.deepEqual(parseSaved(null), { fav: [], rec: [] });
  assert.deepEqual(parseSaved("not json"), { fav: [], rec: [] });
  assert.deepEqual(parseSaved('{"fav":"x","rec":5}'), { fav: [], rec: [] });
  const ok = { k: "dso", id: "NGC 224", name: "Andromeda Galaxy" };
  const r = parseSaved(JSON.stringify({ fav: [ok, { k: "evil", id: "x", name: "y" }, { k: "star", id: 5, name: "n" }, null], rec: [ok] }));
  assert.deepEqual(r.fav, [ok]);
  assert.deepEqual(r.rec, [ok]);
});

// ---------- night-sky geometry ----------
import { compassPoint, equatorialToHorizon, gmstDeg, horizonToEquatorial, lstDeg } from "../utils/skyTime";
test("sidereal time matches published reference values", () => {
  // Meeus example 12.a: 1987 April 10, 0h UT -> GMST 13h 10m 46.3668s
  const g = gmstDeg(new Date(Date.UTC(1987, 3, 10, 0, 0, 0))) / 15;
  assert.ok(Math.abs(g - (13 + 10 / 60 + 46.3668 / 3600)) < 1e-5, String(g));
  // J2000.0 epoch: GMST = 280.46061837 degrees
  assert.ok(Math.abs(gmstDeg(new Date(Date.UTC(2000, 0, 1, 12))) - 280.46061837) < 1e-6);
  assert.ok(Math.abs(lstDeg(new Date(Date.UTC(2000, 0, 1, 12)), 10) - 290.46061837) < 1e-6);
});
test("horizon conversion: pole altitude equals latitude, meridian is due south, round trip", () => {
  assert.ok(Math.abs(equatorialToHorizon(0, 90, 40, 123).alt - 40) < 1e-9);
  const m = equatorialToHorizon(100, 10, 40, 100); // on the meridian, south of zenith
  assert.ok(Math.abs(m.az - 180) < 1e-6 && Math.abs(m.alt - 60) < 1e-6, JSON.stringify(m));
  const rising = equatorialToHorizon(100 + 90, 0, 0, 100); // hour angle -6h: equator object is on the east horizon
  const setting = equatorialToHorizon(100 - 90, 0, 0, 100); // hour angle +6h: west horizon
  assert.ok(Math.abs(setting.az - 270) < 1e-6);
  assert.ok(Math.abs(rising.alt) < 1e-6 && Math.abs(rising.az - 90) < 1e-6, JSON.stringify(rising));
  for (const [alt, az, lat, lst] of [[30, 200, 28.6, 77], [-10, 15, -33, 300], [80, 270, 60, 5]]) {
    const e = horizonToEquatorial(alt, az, lat, lst), h = equatorialToHorizon(e.ra, e.dec, lat, lst);
    assert.ok(Math.abs(h.alt - alt) < 1e-6 && Math.abs(((h.az - az + 540) % 360) - 180) < 1e-6, JSON.stringify([alt, az, h]));
  }
  assert.equal(compassPoint(0), "N"); assert.equal(compassPoint(181), "S"); assert.equal(compassPoint(359), "N");
});

// ---------- moons ----------
import { readFileSync as rfs, existsSync } from "node:fs";
import { parseVal, parseMoonCsv, massKg, formatMass } from "../utils/moons";
test("moon values: uncertainty, band letters, unknown markers and trailing dots parse faithfully", () => {
  assert.deepEqual(parseVal("1737.5±0.1"), { v: 1737.5, b: "V", u: 0.1 });
  assert.deepEqual(parseVal("170.±25."), { v: 170, b: "V", u: 25 });
  assert.deepEqual(parseVal("14.2R"), { v: 14.2, b: "R" });
  assert.deepEqual(parseVal("22.9V±0.1"), { v: 22.9, b: "V", u: 0.1 });
  assert.equal(parseVal("?"), null);
  assert.equal(parseVal(""), null);
  assert.equal(parseVal("abc"), null);
});
test("moon catalogue: 177 moons, known reference values, derived masses match published ones", () => {
  // The source table is vendored in the repository (data/raw/moons, MIT). If it is missing the checkout or archive is incomplete.
  assert.ok(
    existsSync("data/raw/moons/satellites.csv"),
    "data/raw/moons/satellites.csv is missing. It is a vendored source file that must be shipped with the project (see data/raw/moons/README.md): re-extract the full archive including data/raw/, or restore it from the commit named in that README.",
  );
  const moons = parseMoonCsv(rfs("data/raw/moons/satellites.csv", "utf8"));
  assert.equal(moons.length, 177);
  assert.equal(new Set(moons.map((m) => m.n)).size, 177);
  const by = (n: string) => moons.find((m) => m.n === n)!;
  assert.equal(by("Titan").p, "Saturn");
  assert.equal(by("Titan").r!.v, 2574.73);
  assert.equal(by("Charon").p, "Pluto");
  // GM / G: Moon 7.346e22 kg, Titan 1.345e23 kg, Ganymede 1.4819e23 kg
  assert.ok(Math.abs(massKg(by("Moon").g!.v) / 7.346e22 - 1) < 1e-3);
  assert.ok(Math.abs(massKg(by("Titan").g!.v) / 1.3452e23 - 1) < 1e-3);
  assert.ok(Math.abs(massKg(by("Ganymede").g!.v) / 1.4819e23 - 1) < 1e-3);
  assert.match(formatMass(7.346e22), /^7\.35 × 10²² kg$/);
  // generated file stays in sync with the raw table
  const gen = JSON.parse(rfs("public/solar/moons.json", "utf8"));
  assert.deepEqual(gen, moons);
});

// ---------- exoplanets ----------
import { parseCsv, parseExoCsv, queryExo, distanceLy, fmtNum, EXO_COLUMNS } from "../utils/exoplanets";
const EXO_HEAD = Object.values(EXO_COLUMNS).join(",");
// Synthetic rows for parser tests only: not real planets and never shipped as data.
const row = (o: Record<string, string>) => Object.values(EXO_COLUMNS).map((c) => o[c] ?? "").join(",");
test("CSV parser: quotes, doubled quotes, embedded newline, CRLF, BOM", () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x,y","he said ""hi"""\r\n"line1\nline2",z\r\n'), [["a", "b"], ["x,y", 'he said "hi"'], ["line1\nline2", "z"]]);
});
test("exoplanet CSV: empty cells are null (never zero), numbers parse, nameless rows dropped, schema change is an error", () => {
  const csv = [EXO_HEAD,
    row({ pl_name: "Test-1 b", hostname: "Test-1", discoverymethod: "Transit", disc_year: "2020", pl_orbper: "3.5", pl_rade: "1.2", sy_dist: "10" }),
    row({ pl_name: '"Odd, name b"', hostname: "Odd", pl_bmasse: "abc" }),
    row({ hostname: "NoPlanetName" }),
  ].join("\n");
  const r = parseExoCsv(csv);
  assert.equal(r.length, 2);
  assert.equal(r[0].r, 1.2); assert.equal(r[0].ms, null); assert.equal(r[0].a, null); assert.equal(r[0].y, 2020);
  assert.equal(r[1].n, "Odd, name b"); assert.equal(r[1].ms, null);
  assert.throws(() => parseExoCsv("pl_name,hostname\nA,B"), /columns missing/);
  assert.equal(distanceLy(null), null);
  assert.ok(Math.abs(distanceLy(10)! - 32.61564) < 1e-9);
  assert.equal(fmtNum(null, "d"), null);
  assert.equal(fmtNum(3.14159, "d"), "3.14 d");
});
test("exoplanet query: text over planet and host names, method filter, unknown values sort last", () => {
  const mk = (n: string, h: string, o: Partial<import("../utils/exoplanets").Exoplanet>) => ({ n, h, m: "Transit", y: null, p: null, a: null, r: null, ms: null, t: null, ns: null, np: null, d: null, v: null, sp: null, te: null, ra: null, dec: null, c: null, ...o });
  const all = [mk("A b", "Alpha", { d: 50 }), mk("B b", "Beta", { d: null }), mk("C b", "Alpha", { d: 5, m: "Radial Velocity" })];
  assert.deepEqual(queryExo(all, { text: "", method: "", sort: "distance" }).map((x) => x.n), ["C b", "A b", "B b"]);
  assert.deepEqual(queryExo(all, { text: "alpha", method: "Transit", sort: "name" }).map((x) => x.n), ["A b"]);
});

// ---------- spatial grid ----------
import { SkyGrid } from "../utils/skyGrid";
test("SkyGrid: every point within the radius is returned (vs brute force), including poles and the longitude seam, and the scan is much smaller than the catalogue", () => {
  let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const n = 20000, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { // uniform on the sphere, radius 100
    const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), r = Math.sqrt(1 - z * z);
    pos.set([100 * r * Math.cos(t), 100 * z, 100 * r * Math.sin(t)], i * 3);
  }
  const grid = new SkyGrid(pos, n);
  const out: number[] = [];
  let scanned = 0, queries = 0;
  const dirs: [number, number, number][] = [[0, 1, 0], [0, -1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, 1], [0, 0, -1], [0.001, 0.9999995, 0.001]];
  for (let q = 0; q < 400; q++) { const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), r = Math.sqrt(1 - z * z); dirs.push([r * Math.cos(t), z, r * Math.sin(t)]); }
  for (const d of dirs) {
    const norm = Math.hypot(...d); const [dx, dy, dz] = d.map((c) => c / norm);
    for (const radius of [0.002, 0.01, 0.05, 0.3]) {
      grid.query(dx, dy, dz, radius, out);
      const got = new Set(out);
      for (let i = 0; i < n; i++) {
        const cos = (pos[i * 3] * dx + pos[i * 3 + 1] * dy + pos[i * 3 + 2] * dz) / 100;
        if (Math.acos(Math.max(-1, Math.min(1, cos))) <= radius) assert.ok(got.has(i), `missed point ${i} (radius ${radius}, dir ${d})`);
      }
      if (radius <= 0.01) { scanned += out.length; queries++; }
    }
  }
  assert.ok(scanned / queries < n * 0.02, `average candidates ${scanned / queries} of ${n}`);
  assert.equal(new Set(out).size, out.length, "no duplicate candidates");
});
