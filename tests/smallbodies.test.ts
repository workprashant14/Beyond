import { test } from "node:test";
import assert from "node:assert/strict";
import { COMET_CONSTRAINT, cometQueryUrl, parseSbdbQuery, smallBodyPosition, smallBodyOrbitPath, searchSmallBodies, jdToDate, type SmallBody } from "../utils/smallBodies";
import { norm, solveHyperbolicKepler } from "../utils/kepler";

// SYNTHETIC rows (invented objects) that follow the documented field names; they test the code, not real orbits.
const AST = { fields: ["full_name", "spkid", "a", "e", "i", "om", "w", "ma", "epoch", "per", "H", "diameter"], data: [
  ["  1 Test", "20000001", "2.77", "0.08", "10.6", "80.3", "73.6", "60.1", "2461000.5", "1680", "3.3", "939"],
  ["  2 Bad e", "20000002", "2.5", "1.2", "5", "5", "5", "5", "2461000.5", null, null, null],
  ["  3 NoElems", "20000003", null, "0.1", "5", "5", "5", "5", "2461000.5", null, null, null],
  ["  4 Round", "20000004", "1.0", "0", "0", "0", "0", "0", "2451545.0", null, "20.1", null],
] };
const COM = { fields: ["full_name", "spkid", "e", "i", "om", "w", "epoch", "tp", "q"], data: [
  ["Test comet", "90000001", "0.64", "7.0", "36.3", "22.1", "2461000.5", "2460900.5", "1.2"],
  ["Open", "90000002", "1.3", "7.0", "36.3", "22.1", "2461000.5", "2460900.5", "1.2"],
  ["Parabolic", "90000003", "1", "7.0", "36.3", "22.1", "2461000.5", "2460900.5", "1.2"],
  ["Negative e", "90000004", "-0.1", "7.0", "36.3", "22.1", "2461000.5", "2460900.5", "1.2"],
] };

test("asteroid rows parse by field name; invalid or hyperbolic rows are dropped and counted", () => {
  const r = parseSbdbQuery(AST, "a");
  assert.equal(r.bodies.length, 2); assert.equal(r.dropped, 2);
  assert.equal(r.bodies[0].n, "1 Test"); assert.equal(r.bodies[0].a, 2.77); assert.equal(r.bodies[0].per, 1680); assert.equal(r.bodies[0].d, 939);
  assert.equal(r.bodies[1].H, 20.1); assert.equal(r.bodies[1].d, null);
  assert.ok(Math.abs(r.bodies[1].per! - 365.25636) < 1e-6, "missing period is derived from a");
});

test("comet: a from q and e, mean anomaly derived from perihelion time", () => {
  const r = parseSbdbQuery(COM, "c");
  assert.equal(r.bodies.length, 2); assert.equal(r.dropped, 2, "parabolic and negative e are dropped");
  const c = r.bodies[0];
  assert.ok(Math.abs(c.a - 1.2 / 0.36) < 1e-9);
  // epoch is 100 days after perihelion: mean anomaly = 360 * 100 / period
  assert.ok(Math.abs(c.ma - ((360 * 100) / c.per!) % 360) < 1e-9);
});

test("wrong shapes and missing fields fail loudly", () => {
  assert.throws(() => parseSbdbQuery({ hello: 1 }, "a"), /expected/);
  assert.throws(() => parseSbdbQuery({ fields: ["full_name"], data: [] }, "a"), /missing fields/);
});

test("propagation: at the epoch M is the given anomaly, distance stays between q and Q, and one period returns to the start", () => {
  const b = parseSbdbQuery(AST, "a").bodies[0];
  const dEpoch = b.ep - 2451545.0;
  for (const dd of [0, 100, 700, 4000]) {
    const r = norm(smallBodyPosition(b, dEpoch + dd));
    assert.ok(r >= b.a * (1 - b.e) - 1e-9 && r <= b.a * (1 + b.e) + 1e-9, `r=${r}`);
  }
  const p0 = smallBodyPosition(b, dEpoch), p1 = smallBodyPosition(b, dEpoch + b.per!);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(p0[k] - p1[k]) < 1e-9);
});

test("a circular, untilted body with M=0 at J2000 sits on +x at 1 au and a quarter year later on +y", () => {
  const b = parseSbdbQuery(AST, "a").bodies[1];
  const p = smallBodyPosition(b, 0);
  assert.ok(Math.abs(p[0] - 1) < 1e-9 && Math.abs(p[1]) < 1e-9);
  const q = smallBodyPosition(b, b.per! / 4);
  assert.ok(Math.abs(q[0]) < 1e-6 && Math.abs(q[1] - 1) < 1e-6);
});

test("orbit path matches the orbit's size; search and dates", () => {
  const b = parseSbdbQuery(AST, "a").bodies[0];
  const rs = smallBodyOrbitPath(b, 360).points.map(norm);
  assert.ok(Math.abs(Math.min(...rs) - 2.77 * 0.92) < 1e-3 && Math.abs(Math.max(...rs) - 2.77 * 1.08) < 1e-3);
  const all: SmallBody[] = [...parseSbdbQuery(AST, "a").bodies, ...parseSbdbQuery(COM, "c").bodies];
  assert.deepEqual(searchSmallBodies(all, "test").map((x) => x.id), ["90000001", "20000001"]); // names starting with the text come first
  assert.equal(searchSmallBodies(all, "").length, 0);
  assert.equal(jdToDate(2451545.0), "2000-01-01");
});

// ---- open (hyperbolic) orbits: synthetic comet with q = 1 au, e = 1.2, perihelion at JD 2460900.5
const OPEN = parseSbdbQuery(COM, "c").bodies[1];

test("open orbit: parsed with a < 0, no period, mean anomaly from the Gaussian constant", () => {
  assert.equal(OPEN.n, "Open");
  assert.ok(Math.abs(OPEN.a - 1.2 / (1 - 1.3)) < 1e-12 && OPEN.a < 0);
  assert.equal(OPEN.per, null);
  const aa = Math.abs(OPEN.a);
  assert.ok(Math.abs(OPEN.ma - (0.01720209895 / aa ** 1.5) * 100 * (180 / Math.PI)) < 1e-9);
});

test("hyperbolic Kepler equation is solved for large and negative anomalies", () => {
  for (const e of [1.0001, 1.3, 3, 50]) for (const M of [-500, -3, -0.1, 0, 0.2, 7, 900]) {
    const H = solveHyperbolicKepler(M, e);
    assert.ok(Math.abs(e * Math.sinh(H) - H - M) < 1e-7 * Math.max(1, Math.abs(M)), `e=${e} M=${M}`);
  }
});

test("open orbit physics: perihelion distance and speed at tp, symmetry, and growing distance away from it", () => {
  const tp = 2460900.5 - 2451545.0; // days since J2000
  const r0 = norm(smallBodyPosition(OPEN, tp));
  assert.ok(Math.abs(r0 - 1.2) < 1e-9, `r at perihelion ${r0}`);
  // speed at perihelion = sqrt(mu (1 + e) / q), mu = k^2 (au^3 / day^2)
  const h = 1e-3, p1 = smallBodyPosition(OPEN, tp + h), p2 = smallBodyPosition(OPEN, tp - h);
  const v = Math.hypot(p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]) / (2 * h);
  assert.ok(Math.abs(v - Math.sqrt(0.01720209895 ** 2 * 2.3 / 1.2)) < 1e-6, `v=${v}`);
  for (const dt of [50, 400]) {
    const a = norm(smallBodyPosition(OPEN, tp + dt)), b = norm(smallBodyPosition(OPEN, tp - dt));
    assert.ok(Math.abs(a - b) < 1e-9, "symmetric about perihelion");
    assert.ok(a > r0);
  }
  assert.ok(norm(smallBodyPosition(OPEN, tp + 4000)) > norm(smallBodyPosition(OPEN, tp + 400)));
  // the orbit equation r = |a| (e cosh H - 1) on the conic: r(1 + e cos nu) = p with p = q (1 + e)
  const pos = smallBodyPosition(OPEN, tp + 300);
  const r = norm(pos);
  assert.ok(r > 1.2 && r < 1e3);
});

test("open orbit path: not closed, passes through perihelion, ends near the drawing limit", () => {
  const path = smallBodyOrbitPath(OPEN, 200);
  assert.equal(path.closed, false);
  const rs = path.points.map(norm);
  assert.ok(Math.abs(Math.min(...rs) - 1.2) < 0.01);
  assert.ok(Math.abs(rs[0] - 60) < 1e-6 && Math.abs(rs[rs.length - 1] - 60) < 1e-6);
});

// ---------- comet query construction ----------
const EP = "https://ssd-api.jpl.nasa.gov/sbdb_query.api";
const CF = "full_name,spkid,e,i,om,w,epoch,tp,q,H";

/** Minimal evaluator for the constraint grammar used here ("field|LT|x", "field|GT|x", "field|DF", AND, OR), so the test checks what the filter SELECTS, not just its text. */
type Cond = string | { AND: Cond[] } | { OR: Cond[] };
const passes = (c: Cond, row: Record<string, number | null>): boolean => {
  if (typeof c !== "string") return "AND" in c ? c.AND.every((x) => passes(x, row)) : c.OR.some((x) => passes(x, row));
  const [f, op, v] = c.split("|");
  const x = row[f];
  if (op === "DF") return x !== null && x !== undefined;
  if (x === null || x === undefined) return false;
  if (op === "LT") return x < Number(v);
  if (op === "GT") return x > Number(v);
  throw new Error(`unsupported operator ${op}`);
};
const full = { i: 10, om: 20, w: 30, tp: 2460000, q: 0.5 };

test("comet query: sb-cdata survives URL encoding and decodes to exactly the constraint", () => {
  const url = cometQueryUrl(EP, CF, 200);
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, EP);
  assert.equal(u.searchParams.get("sb-kind"), "c");
  assert.equal(u.searchParams.get("sort"), "q");
  assert.equal(u.searchParams.get("limit"), "200");
  assert.equal(u.searchParams.get("fields"), CF);
  assert.deepEqual(JSON.parse(u.searchParams.get("sb-cdata")!), COMET_CONSTRAINT);
  assert.deepEqual(COMET_CONSTRAINT, { AND: [{ OR: ["e|LT|0.999999999", "e|GT|1.000000001"] }, "i|DF", "om|DF", "w|DF", "tp|DF", "q|DF"] });
  // raw JSON characters must not appear unencoded in the query string
  assert.ok(!/[{}"|\[\]]/.test(url.split("sb-cdata=")[1].split("&")[0]), "constraint must be percent-encoded");
  assert.equal(cometQueryUrl(EP, CF, 37).includes("limit=37"), true);
});

test("comet constraint selects elliptical and hyperbolic comets and never exactly parabolic ones", () => {
  const sel = (e: number | null, o: Partial<typeof full> = {}) => passes(COMET_CONSTRAINT as Cond, { e, ...full, ...o } as Record<string, number | null>);
  assert.equal(sel(0.5), true, "elliptical");
  assert.equal(sel(0.9999), true, "nearly parabolic but still elliptical");
  assert.equal(sel(1.2), true, "hyperbolic");
  assert.equal(sel(1.00001), true, "slightly hyperbolic");
  assert.equal(sel(1), false, "exactly parabolic (SOHO sungrazer case)");
  assert.equal(sel(0.9999999995), false, "within 1e-9 of parabolic");
  assert.equal(sel(1.0000000005), false, "within 1e-9 of parabolic");
  assert.equal(sel(null), false, "eccentricity unknown");
  for (const k of ["i", "om", "w", "tp", "q"] as const) assert.equal(sel(0.5, { [k]: null }), false, `${k} undefined`);
});

test("the query's parabolic margin matches the parser's, so nothing the query selects is dropped for being parabolic", () => {
  const mk = (e: number) => ({ fields: ["full_name", "spkid", "e", "i", "om", "w", "epoch", "tp", "q", "H"], data: [["C/X", "1", e, 10, 20, 30, 2460000, 2459900, 0.5, 10]] });
  for (const e of [0.999999998, 1.000000002, 0.3, 1.5]) {
    assert.equal(passes(COMET_CONSTRAINT as Cond, { e, ...full }), true, `query selects e=${e}`);
    assert.equal(parseSbdbQuery(mk(e), "c").bodies.length, 1, `parser keeps e=${e}`);
  }
  for (const e of [1, 0.9999999995, 1.0000000005]) {
    assert.equal(passes(COMET_CONSTRAINT as Cond, { e, ...full }), false, `query rejects e=${e}`);
    assert.equal(parseSbdbQuery(mk(e), "c").bodies.length, 0, `parser rejects e=${e}`);
  }
});

test("asteroid query is unchanged by the comet filter", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("scripts/build-smallbodies.ts", "utf8");
  assert.ok(src.includes("`${ENDPOINT}?fields=${A_FIELDS}&sb-kind=a&sb-ns=n&sort=H&limit=${nA}&full-prec=true`"));
});
