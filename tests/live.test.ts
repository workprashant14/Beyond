/**
 * NOTE ON FIXTURES: the payloads below are SYNTHETIC. They follow the shapes in
 * the official docs (JPL SBDB API 1.3, NASA Exoplanet Archive TAP, NASA Image
 * Library, JPL Horizons text layout) but are NOT recorded live responses. They
 * prove our parsing, error handling and safety rules, not that upstream still
 * returns exactly this. Use `npm run check:live` on a networked machine for that.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { parseImages } from "@/services/live/nasaImages";
import { parseSbdb } from "@/services/live/jplSbdb";
import { parseExoplanet } from "@/services/live/exoplanets";
import { parseHorizons, horizonsRows } from "@/services/live/horizons";
import { getLiveData } from "@/services/live";
import { cached, clearCache } from "@/services/live/cache";
import { LiveError } from "@/services/live/http";
import { rateLimit } from "@/utils/rateLimit";

const img = (id: string, href: string, extra: Record<string, unknown> = {}) => ({
  data: [{ nasa_id: id, title: `Title ${id}`, center: "JPL", photographer: "A. Person", date_created: "2019-04-10T00:00:00Z", media_type: "image", ...extra }],
  links: [{ href, rel: "preview", render: "image" }],
});
const GOOD = (id: string) => `https://images-assets.nasa.gov/image/${id}/${id}~thumb.jpg`;

test("images: keeps NASA https assets, drops foreign hosts / http / duplicates / non-images", () => {
  const out = parseImages({
    collection: {
      items: [
        img("PIA1", GOOD("PIA1")),
        img("PIA1", GOOD("PIA1")), // duplicate
        img("EVIL", "https://evil.example.com/x.jpg"),
        img("HTTP", "http://images-assets.nasa.gov/x.jpg"),
        img("VID", GOOD("VID"), { media_type: "video" }),
        img("bad id!", GOOD("x")),
        img("PIA2", GOOD("PIA2")),
      ],
    },
  });
  assert.deepEqual(out.map((i) => i.id), ["PIA1", "PIA2"]);
  assert.equal(out[0].pageUrl, "https://images.nasa.gov/details/PIA1");
  assert.equal(out[0].credit, "A. Person · JPL");
  assert.equal(out[0].date, "2019-04-10");
});
test("images: empty -> not-found, bad shape -> parse", () => {
  assert.throws(() => parseImages({ collection: { items: [] } }), (e: LiveError) => e.reason === "not-found");
  assert.throws(() => parseImages({ nope: 1 }), (e: LiveError) => e.reason === "parse");
  assert.throws(() => parseImages(null), (e: LiveError) => e.reason === "parse");
});

const SBDB = {
  object: { fullname: "1 Ceres", orbit_class: { name: "Main-belt Asteroid" } },
  orbit: { elements: [{ name: "a", value: "2.7656" }, { name: "e", value: "0.0796" }, { name: "i", value: "10.58" }, { name: "per", value: "1681.2" }] },
  phys_par: [{ name: "diameter", value: "939.4", units: "km" }, { name: "rot_per", value: "9.074", units: "h" }],
  discovery: { who: "G. Piazzi", date: "1801-Jan-01", location: "Palermo" },
};
test("sbdb: rows from a normal payload; missing values say Data unavailable", () => {
  const rows = Object.fromEntries(parseSbdb(SBDB).map((r) => [r.label, r.value]));
  assert.equal(rows["JPL designation"], "1 Ceres");
  assert.equal(rows["Diameter"], "939 km");
  assert.equal(rows["Orbital period"], "4.6 Earth years");
  assert.equal(rows["Discovery"], "G. Piazzi · 1801-Jan-01 · Palermo");
  assert.equal(rows["Albedo"], "Data unavailable");
});
test("sbdb: 300 -> ambiguous, no object -> not-found, junk -> parse", () => {
  assert.throws(() => parseSbdb({ code: 300, list: [] }, 300), (e: LiveError) => e.reason === "ambiguous");
  assert.throws(() => parseSbdb({ message: "no match" }), (e: LiveError) => e.reason === "not-found");
  assert.throws(() => parseSbdb("x"), (e: LiveError) => e.reason === "parse");
});

test("exoplanet: nulls become Data unavailable, ly conversion, K->C", () => {
  const rows = Object.fromEntries(
    parseExoplanet([{ pl_name: "Proxima Cen b", hostname: "Proxima Cen", pl_rade: null, pl_bmasse: 1.07, pl_orbper: 11.19, pl_eqt: 234, sy_dist: 1.3012, disc_year: 2016, discoverymethod: "Radial Velocity" }]).map((r) => [r.label, r.value]),
  );
  assert.equal(rows["Radius"], "Data unavailable");
  assert.equal(rows["Mass"], "1.07 Earth masses");
  assert.equal(rows["Distance"], "4.24 light-years");
  assert.equal(rows["Equilibrium temperature"], "234 K (-39 °C)");
  assert.equal(rows["Discovery"], "2016 · Radial Velocity");
});
test("exoplanet: [] -> not-found, non-array -> parse", () => {
  assert.throws(() => parseExoplanet([]), (e: LiveError) => e.reason === "not-found");
  assert.throws(() => parseExoplanet({}), (e: LiveError) => e.reason === "parse");
});

const HZ = (rg: string, lt: string) => ({
  signature: { version: "1.2" },
  result: `header text\n$$SOE\n2461348.000000000 = A.D. 2026-Nov-08 00:00:00.0000 TDB\n X = 1.0E-01 Y = 2.0E-01 Z = 3.0E-05\n VX=-1.0E-02 VY= 1.0E-02 VZ= 1.0E-06\n LT= ${lt} RG= ${rg} RR= 1.0E-05\n$$EOE\nfooter`,
});
test("horizons: parses RG/LT/epoch; rows for Earth and Moon", () => {
  const v = parseHorizons(HZ("9.9E-01", "5.7E-03"));
  assert.equal(v.rangeAU, 0.99);
  assert.equal(v.epoch, "2026-Nov-08 00:00:00.0000");
  const earth = horizonsRows(v, "Distance from the Sun", false);
  assert.match(earth[0].value, /^0\.99 AU \(≈ 148 million km\)$/);
  assert.match(earth[1].value, /^8\.2 minutes$/);
  const moon = horizonsRows(parseHorizons(HZ("2.5695E-03", "1.4838E-05")), "Distance from Earth", true);
  assert.equal(moon[0].value, "384,398 km".replace("384,398", Math.round(2.5695e-3 * 149597870.7).toLocaleString("en-US")) );
  assert.match(moon[1].value, /seconds$/);
});
test("horizons: error / no block / missing fields never produce numbers", () => {
  assert.throws(() => parseHorizons({ error: "x" }), (e: LiveError) => e.reason === "not-found");
  assert.throws(() => parseHorizons({ result: "no block" }), (e: LiveError) => e.reason === "parse");
  assert.throws(() => parseHorizons({ result: "$$SOE\nnothing\n$$EOE" }), (e: LiveError) => e.reason === "parse");
  assert.throws(() => parseHorizons(null), (e: LiveError) => e.reason === "parse");
});

// ---------- end-to-end through getLiveData with a faked fetch ----------
type Handler = (url: URL) => Response | Promise<Response>;
const realFetch = globalThis.fetch;
let calls: URL[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const install = (h: Handler) => {
  calls = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const u = new URL(String(input));
    calls.push(u);
    return h(u);
  }) as typeof fetch;
};
beforeEach(() => {
  clearCache();
  globalThis.fetch = realFetch;
});

const happy: Handler = (u) => {
  if (u.hostname === "images-api.nasa.gov") return json({ collection: { items: [img("PIA9", GOOD("PIA9"))] } });
  if (u.hostname === "ssd.jpl.nasa.gov") return json(HZ("1.0E+00", "5.8E-03"));
  if (u.hostname === "ssd-api.jpl.nasa.gov") return json(SBDB);
  if (u.hostname === "exoplanetarchive.ipac.caltech.edu") return json([{ pl_name: "TRAPPIST-1 e", pl_orbper: 6.1 }]);
  return new Response("blocked", { status: 500 });
};

test("getLiveData: planet = Horizons + images; comet = SBDB; exoplanet = archive; galaxy = no-source", async () => {
  install(happy);
  const earth = await getLiveData("earth", new Date("2026-11-08T05:30:00Z"));
  assert.equal(earth.images.status, "ok");
  assert.equal(earth.measurements.status, "ok");
  const ceres = await getLiveData("ceres");
  assert.equal(ceres.measurements.status === "ok" && ceres.measurements.sources[0].label, "JPL Small-Body Database");
  const t1e = await getLiveData("trappist-1e");
  assert.equal(t1e.measurements.status, "ok");
  const mw = await getLiveData("milky-way");
  assert.deepEqual(mw.measurements, { status: "unavailable", reason: "no-source" });
});

test("security: only allow-listed NASA/JPL hosts are ever contacted, always https", async () => {
  install(happy);
  for (const id of ["earth", "moon", "sun", "ceres", "halley", "proxima-b", "andromeda"]) await getLiveData(id);
  const allowed = new Set(["images-api.nasa.gov", "ssd.jpl.nasa.gov", "ssd-api.jpl.nasa.gov", "exoplanetarchive.ipac.caltech.edu"]);
  assert.ok(calls.length > 0);
  for (const u of calls) {
    assert.equal(u.protocol, "https:");
    assert.ok(allowed.has(u.hostname), `unexpected host ${u.hostname}`);
  }
});

test("horizons request carries the required, correctly quoted parameters", async () => {
  install(happy);
  await getLiveData("mars", new Date("2026-11-08T05:30:00Z"));
  const u = calls.find((c) => c.hostname === "ssd.jpl.nasa.gov")!;
  const p = u.searchParams;
  assert.equal(p.get("format"), "json");
  assert.equal(p.get("COMMAND"), "'499'");
  assert.equal(p.get("CENTER"), "'500@10'");
  assert.equal(p.get("EPHEM_TYPE"), "'VECTORS'");
  assert.equal(p.get("VEC_TABLE"), "'3'");
  assert.equal(p.get("OUT_UNITS"), "'AU-D'");
  assert.equal(p.get("START_TIME"), "'2026-11-08 05:00'");
});

test("failures degrade to 'unavailable' sections and never throw", async () => {
  const cases: [string, Handler, string][] = [
    ["network down", () => { throw new TypeError("fetch failed"); }, "network"],
    ["timeout", () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); }, "timeout"],
    ["HTTP 503", () => new Response("down", { status: 503 }), "http"],
    ["HTTP 404", () => new Response("nope", { status: 404 }), "not-found"],
    ["not JSON", () => new Response("<html>oops</html>", { status: 200 }), "parse"],
    ["wrong shape", () => json({ hello: "world" }), "parse"],
  ];
  for (const [name, h, reason] of cases) {
    clearCache();
    install(h);
    const r = await getLiveData("jupiter");
    assert.equal(r.images.status, "unavailable", `${name}: images`);
    assert.equal(r.measurements.status, "unavailable", `${name}: measurements`);
    assert.equal(r.images.status === "unavailable" && r.images.reason, reason, `${name}: reason`);
  }
});

test("one failing source does not break the other", async () => {
  install((u) => (u.hostname === "images-api.nasa.gov" ? new Response("x", { status: 500 }) : happy(u)));
  const r = await getLiveData("earth");
  assert.equal(r.images.status, "unavailable");
  assert.equal(r.measurements.status, "ok");
});

test("cache: concurrent + repeated requests hit upstream once per source", async () => {
  install(happy);
  await Promise.all([getLiveData("saturn"), getLiveData("saturn"), getLiveData("saturn")]);
  await getLiveData("saturn");
  assert.equal(calls.filter((c) => c.hostname === "images-api.nasa.gov").length, 1);
  assert.equal(calls.filter((c) => c.hostname === "ssd.jpl.nasa.gov").length, 1);
});

test("unknown object id throws not-found (route turns this into 404 before calling)", async () => {
  await assert.rejects(getLiveData("nope"), (e: LiveError) => e.reason === "not-found");
});

test("rate limiter blocks after the limit and recovers after the window", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) assert.equal(rateLimit("ip-a", 5, 60_000, t0).ok, true);
  const blocked = rateLimit("ip-a", 5, 60_000, t0 + 1000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter > 0);
  assert.equal(rateLimit("ip-b", 5, 60_000, t0).ok, true);
  assert.equal(rateLimit("ip-a", 5, 60_000, t0 + 61_000).ok, true);
});

test("cache: success is kept for its TTL, a failure is retried after the short TTL", async () => {
  let clock = 1_000;
  const now = () => clock;
  let n = 0;
  const load = async () => ({ ok: ++n > 1 }); // first call "fails", second succeeds
  const ttl = (v: { ok: boolean }) => (v.ok ? 3_600_000 : 30_000);
  assert.deepEqual(await cached("k", ttl, load, now), { ok: false });
  clock += 10_000; // still inside the 30 s failure window
  assert.deepEqual(await cached("k", ttl, load, now), { ok: false });
  assert.equal(n, 1);
  clock += 25_000; // failure window over -> retried
  assert.deepEqual(await cached("k", ttl, load, now), { ok: true });
  assert.equal(n, 2);
  clock += 1_800_000; // success still cached
  await cached("k", ttl, load, now);
  assert.equal(n, 2);
});

import { clientIp } from "@/utils/clientIp";
const hdr = (v?: string) => ({ get: (k: string) => (k === "x-forwarded-for" ? (v ?? null) : null) });

test("clientIp: counts trusted proxies from the right, so a spoofed first entry is ignored", () => {
  assert.equal(clientIp(hdr("6.6.6.6, 203.0.113.9"), 1), "203.0.113.9"); // attacker prepended 6.6.6.6
  assert.equal(clientIp(hdr("203.0.113.9"), 1), "203.0.113.9");
  assert.equal(clientIp(hdr("6.6.6.6, 203.0.113.9, 10.0.0.2"), 2), "203.0.113.9");
  assert.equal(clientIp(hdr("2001:db8::1"), 1), "2001:db8::1");
});

test("clientIp: missing, too-short, junk or disabled header falls back to 'unknown'", () => {
  assert.equal(clientIp(hdr(undefined), 1), "unknown");
  assert.equal(clientIp(hdr("1.2.3.4"), 2), "unknown");
  assert.equal(clientIp(hdr("<script>alert(1)</script>"), 1), "unknown");
  assert.equal(clientIp(hdr("1.2.3.4"), 0), "unknown");
});

test("rateLimit: memory stays bounded under a flood of distinct keys", () => {
  const t = 5_000_000;
  for (let i = 0; i < 25_000; i++) rateLimit(`flood-${i}`, 40, 60_000, t);
  // the newest key must still be tracked and limited normally
  for (let i = 0; i < 39; i++) assert.equal(rateLimit("flood-24999", 40, 60_000, t).ok, true);
  assert.equal(rateLimit("flood-24999", 40, 60_000, t).ok, false);
});
