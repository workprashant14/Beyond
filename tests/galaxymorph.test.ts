import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  classifyHubble, inclinationDeg, axisRatio, diskBasis, ellipsoidBasis, apparentAxisRatio, skyFrame,
  makeParams, sampleStars, armField, armPhase, type Vec3, type Morph,
} from "../utils/galaxyMorph";
import { SCENE_OBJECTS } from "../universe/objects/sceneConfig";
import morph from "../data/galaxyMorphology.json";

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const M = morph.galaxies as Record<string, Morph>;

test("Hubble types map to the three rendering classes", () => {
  for (const h of ["E", "E0", "E5", "S0", "S0-a"]) assert.equal(classifyHubble(h).cls, "elliptical", h);
  for (const h of ["Sa", "Sb", "Sbc", "Sc", "Scd", "Sd", "SBb", "SBc", "SABbc"]) assert.equal(classifyHubble(h).cls, "spiral", h);
  for (const h of ["SBm", "Sm", "Irr", "I", "IB"]) assert.equal(classifyHubble(h).cls, "irregular", h);
  assert.equal(classifyHubble("SBb").bar, true);
  assert.equal(classifyHubble("Sb").bar, false);
  assert.equal(classifyHubble("Sb").stage, classifyHubble("SBb").stage); // same Hubble stage with or without a bar
  assert.ok(Math.abs(classifyHubble("Sb").stage - 2 / 7) < 1e-9);
  assert.equal(classifyHubble(null, "spiral").cls, "spiral"); // no catalogue type: documented default, not invented data
  assert.ok(classifyHubble("Sa").stage < classifyHubble("Sc").stage);
});

test("the catalogue records for the scene galaxies classify as expected", () => {
  assert.equal(classifyHubble(M.andromeda.hubble).cls, "spiral");
  assert.equal(classifyHubble(M.triangulum.hubble).cls, "spiral");
  assert.equal(classifyHubble(M.m87.hubble).cls, "elliptical");
  assert.equal(classifyHubble(M.lmc.hubble).cls, "irregular");
  assert.equal(M["milky-way"].hubble, null); // not in OpenNGC: nothing invented
});

test("galaxyMorphology.json matches the local OpenNGC rows (skipped if the raw data is absent)", { skip: !existsSync("data/raw/openngc/NGC.csv") }, () => {
  const rows = new Map<string, string[]>();
  const head = readFileSync("data/raw/openngc/NGC.csv", "utf8").split(/\r?\n/)[0].split(";");
  for (const l of readFileSync("data/raw/openngc/NGC.csv", "utf8").split(/\r?\n/).slice(1)) { const v = l.split(";"); rows.set(v[0], v); }
  const col = (r: string[], n: string) => r[head.indexOf(n)];
  for (const [id, ngc] of [["andromeda", "NGC0224"], ["triangulum", "NGC0598"], ["m87", "NGC4486"]] as const) {
    const r = rows.get(ngc)!;
    assert.equal(M[id].hubble, col(r, "Hubble"), id);
    assert.equal(M[id].majAxArcmin, Number(col(r, "MajAx")), id);
    assert.equal(M[id].minAxArcmin, Number(col(r, "MinAx")), id);
    assert.equal(M[id].posAngDeg, Number(col(r, "PosAng")), id);
  }
});

test("inclination from axis ratio: face-on, edge-on, monotonic, null without data", () => {
  assert.ok(Math.abs(inclinationDeg(10, 10)! - 0) < 1e-9);
  assert.equal(inclinationDeg(10, 1), 90);
  assert.ok(inclinationDeg(10, 7)! < inclinationDeg(10, 4)!);
  assert.equal(inclinationDeg(null, 3), null);
  const a = inclinationDeg(M.andromeda.majAxArcmin, M.andromeda.minAxArcmin)!;
  assert.ok(a > 60 && a < 80, `Andromeda estimate ${a}`); // literature ~77 deg; the estimate must be in that region
  assert.ok(Math.abs(axisRatio(177.83, 69.66)! - 0.3917) < 1e-3);
});

test("disk orientation reproduces the requested apparent axis ratio and position angle", () => {
  const views: Vec3[] = [[-0.6, -0.2, 0.77], [0.3, 0.9, 0.3], [0, 0, 1], [0.99, 0.05, 0.1]];
  for (const v of views) for (const [pa, inc] of [[35, 67], [153, 20], [0, 80], [170, 35]] as const) {
    const b = diskBasis(v, pa, inc);
    const len = (x: Vec3) => Math.hypot(...x);
    for (const x of [b.x, b.y, b.z]) assert.ok(Math.abs(len(x) - 1) < 1e-9);
    assert.ok(Math.abs(dot(b.x, b.y)) < 1e-9 && Math.abs(dot(b.x, b.z)) < 1e-9 && Math.abs(dot(b.y, b.z)) < 1e-9);
    const c = cross(b.x, b.y); // right-handed: X x Y = Z
    assert.ok(Math.abs(c[0] - b.z[0]) + Math.abs(c[1] - b.z[1]) + Math.abs(c[2] - b.z[2]) < 1e-9);
    assert.ok(Math.abs(apparentAxisRatio(b.y, v) - Math.cos((inc * Math.PI) / 180)) < 1e-9);
    // major axis lies in the sky plane at the requested position angle (east of north)
    const f = skyFrame(v);
    assert.ok(Math.abs(dot(b.x, f.v)) < 1e-9);
    const paBack = (((Math.atan2(dot(b.x, f.east), dot(b.x, f.north)) * 180) / Math.PI) + 360) % 360;
    assert.ok(Math.abs(paBack - pa) < 1e-6, `pa ${paBack} vs ${pa}`);
  }
});

test("ellipsoid basis: major axis in the sky plane, line of sight along the view direction", () => {
  const v: Vec3 = [-0.5, 0.2, 0.84];
  const b = ellipsoidBasis(v, 153);
  assert.ok(Math.abs(dot(b.x, v) / Math.hypot(...v)) < 1e-9);
  assert.ok(Math.abs(Math.abs(dot(b.z, v) / Math.hypot(...v)) - 1) < 1e-9);
});

test("spiral stars concentrate on arms, avoid dust lanes and are not rotationally uniform", () => {
  const p = makeParams(classifyHubble("Sc"), 29, M.triangulum);
  const s = sampleStars(p, 30000);
  let nearArm = 0, inDust = 0, disk = 0;
  const bins = new Array(12).fill(0);
  for (let i = 0; i < s.n; i++) {
    const x = s.pos[i * 3], z = s.pos[i * 3 + 2];
    const r = Math.hypot(x, z);
    if (r < 0.35 || r > 0.9) continue;
    disk++;
    const th = Math.atan2(z, x);
    const f = armField(p, r, th);
    if (f.arm > 0.4) nearArm++;
    if (f.dust > 0.5 && f.arm < 0.3) inDust++;
    bins[Math.floor(((th + Math.PI) / (2 * Math.PI)) * 12) % 12]++;
  }
  // an unstructured disk would put roughly the arm-area fraction (computed by Monte Carlo) in arms
  let area = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) { const r = 0.35 + 0.55 * ((i * 0.618) % 1), th = ((i * 0.7548) % 1) * 2 * Math.PI - Math.PI; if (armField(p, r, th).arm > 0.4) area++; }
  assert.ok(nearArm / disk > (area / N) * 1.5, `arm fraction ${nearArm / disk} vs uniform ${area / N}`);
  assert.ok(inDust / disk < 0.05, `dust-lane star fraction ${inDust / disk}`);
  assert.ok(Math.max(...bins) / Math.min(...bins) > 1.15, "azimuth histogram should not be flat");
});

test("different seeds give different spirals (no identical-looking galaxies)", () => {
  const a = makeParams(classifyHubble("Sb"), 23, M.andromeda), b = makeParams(classifyHubble("Sb"), 11, null, true);
  assert.notEqual(a.phi0, b.phi0);
  assert.notDeepEqual(a.wob, b.wob);
  assert.notEqual(armPhase(a, 0, 0.6), armPhase(b, 0, 0.6));
  const sa = sampleStars(a, 500), sb = sampleStars(b, 500);
  assert.notDeepEqual(Array.from(sa.pos.slice(0, 30)), Array.from(sb.pos.slice(0, 30)));
  assert.equal(b.bar, true); // Milky Way: "barred spiral" from the object description
});

test("elliptical stars have no spiral structure and follow the catalogue axis ratio", () => {
  const p = makeParams(classifyHubble("E"), 5, M.m87);
  assert.ok(Math.abs(p.q - 6.67 / 7.11) < 1e-6);
  const s = sampleStars(p, 20000);
  const q = makeParams(classifyHubble("E"), 5, { ...M.m87, majAxArcmin: 10, minAxArcmin: 5 });
  assert.ok(Math.abs(q.q - 0.5) < 1e-9);
  const flat = sampleStars(q, 20000);
  const spread = (st: typeof s, k: number) => { let m = 0; for (let i = 0; i < st.n; i++) m += st.pos[i * 3 + k] ** 2; return Math.sqrt(m / st.n); };
  assert.ok(spread(flat, 1) < spread(flat, 0) * 0.6, "flattened ellipsoid is thinner along the minor axis");
  assert.ok(spread(s, 1) / spread(s, 0) > 0.85, "near-round ellipsoid stays near-round");
  // density falls with radius (smooth gradient, bright centre)
  const rad = (i: number) => Math.hypot(s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]);
  let inner = 0, outer = 0;
  for (let i = 0; i < s.n; i++) { const r = rad(i); if (r < 0.2) inner++; else if (r > 0.6 && r < 0.8) outer++; }
  // compare densities (count per volume): the thin shell holds far more volume than the inner ball
  const dens = (n: number, r0: number, r1: number) => n / (r1 ** 3 - r0 ** 3);
  assert.ok(dens(inner, 0, 0.2) > dens(outer, 0.6, 0.8) * 10, `inner ${inner} outer ${outer}`);
  // all colours old/yellow: red >= blue for every star
  for (let i = 0; i < s.n; i++) assert.ok(s.col[i * 3] >= s.col[i * 3 + 2] - 1e-6);
});

test("irregular galaxies are asymmetric and have clumps, not arms", () => {
  const p = makeParams(classifyHubble("SBm"), 53, M.lmc);
  assert.ok(p.clumps.length >= 7);
  const s = sampleStars(p, 20000);
  let cx = 0, cz = 0;
  for (let i = 0; i < s.n; i++) { cx += s.pos[i * 3]; cz += s.pos[i * 3 + 2]; }
  cx /= s.n; cz /= s.n;
  assert.ok(Math.hypot(cx, cz) > 0.02, `centre of light offset ${Math.hypot(cx, cz)}`); // lopsided
  const q = makeParams(classifyHubble("SBm"), 54, M.lmc);
  assert.notDeepEqual(p.clumps, q.clumps);
  for (let i = 0; i < s.n; i++) assert.ok(Math.hypot(s.pos[i * 3], s.pos[i * 3 + 2]) <= 1.05);
});

test("every scene galaxy has a catalogue record; M87* has a host galaxy; positions are unchanged", () => {
  for (const o of SCENE_OBJECTS.filter((x) => x.kind === "galaxy")) assert.ok(o.id in M, o.id);
  const m87 = SCENE_OBJECTS.find((o) => o.id === "m87")!;
  assert.equal(m87.hostGalaxy, "m87");
  assert.deepEqual(m87.position, [-170, -25, -130]);
  assert.deepEqual(SCENE_OBJECTS.find((o) => o.id === "andromeda")!.position, [150, 28, -110]);
});

test("sampling is deterministic and finite", () => {
  const p = makeParams(classifyHubble("Sb"), 23, M.andromeda);
  const a = sampleStars(p, 2000), b = sampleStars(p, 2000);
  assert.deepEqual(Array.from(a.pos), Array.from(b.pos));
  assert.ok(Array.from(a.pos).every(Number.isFinite) && Array.from(a.col).every(Number.isFinite) && Array.from(a.size).every(Number.isFinite));
});
