import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTROVERSY_TEXT, EXO_ALL_COLUMNS, EXO_COLUMNS, exoStats, fmtExact, fmtSigned, limitKind, paramBadge, paramDetail, parseExoCsv, parseReference, queryExo, safeUrl,
  type Exoplanet,
} from "../utils/exoplanets";
import { LIVE_COLUMNS, parseExoplanet } from "../services/live/exoplanets";

/*
 * FIXTURES. Rows are shaped after what the NASA Exoplanet Archive overview pages show for these planets (values and uncertainties as
 * written there; limit flag 1 for Kepler-80 f mass as reported by the project owner). They are NOT verbatim archive responses: the
 * reference cells, reference URLs (example.org) and every cell not named in a test are invented for testing and never shipped as data.
 */
const HEAD = EXO_ALL_COLUMNS.join(",");
const row = (o: Record<string, string>) => EXO_ALL_COLUMNS.map((c) => (c in o ? o[c] : "")).join(",");
const a = (label: string, href = "https://example.org/ref") => `"<a refstr=""${label}"" href=""${href}"" target=ref>${label}</a>"`;
const csv = (...rows: string[]) => [HEAD, ...rows].join("\n");

const V2376 = row({ pl_name: "V2376 Ori b", hostname: "V2376 Ori", discoverymethod: "Imaging", disc_year: "2025", pl_eqt: "2100", pl_eqterr1: "200", pl_eqterr2: "-300", pl_eqtlim: "0", pl_eqt_reflink: a("Vila et al. 2025"), pl_bmasse: "6357", pl_bmasseerr1: "3178", pl_bmasseerr2: "-3178", pl_bmassprov: "Mass", pl_bmasse_reflink: a("Vila et al. 2025"), pl_orbsmax: "71", pl_orbsmaxerr1: "21", pl_orbsmaxerr2: "-21", pl_controv_flag: "0" });
const KEPLER80F = row({ pl_name: "Kepler-80 f", hostname: "Kepler-80", discoverymethod: "Transit", disc_year: "2012", pl_orbper: "0.98678527", pl_orbpererr1: "4.2e-7", pl_orbpererr2: "-4.2e-7", pl_orbperlim: "0", pl_bmasse: "12651.5", pl_bmasselim: "1", pl_bmassprov: "Mass", pl_bmasse_reflink: a("Ofir et al. 2025"), pl_controv_flag: "0" });
const COCONUTS = row({ pl_name: "COCONUTS-2 b", hostname: "COCONUTS-2", discoverymethod: "Imaging", disc_year: "2021", pl_rade: "12.58", pl_radeerr1: "0.06", pl_radeerr2: "-0.04", pl_rade_reflink: a("Kiman et al. 2026"), pl_bmasse: "2543", pl_bmasseerr1: "636", pl_bmasseerr2: "-636", pl_bmasse_reflink: a("Zhang et al. 2025"), pl_orbper: "402000000", pl_orbpererr1: "470000000", pl_orbpererr2: "-100000000", pl_orbper_reflink: a("Zhang et al. 2021"), pl_eqt: "493", pl_eqterr1: "9", pl_eqterr2: "-9", pl_eqt_reflink: a("Kiman et al. 2026"), pl_controv_flag: "0" });
const KOI55B = row({ pl_name: "KOI-55 b", hostname: "KOI-55", discoverymethod: "Pulsation Timing Variations", disc_year: "2011", pl_orbper: "0.240104", pl_orbpererr1: "0.000004", pl_orbpererr2: "-0.000004", pl_orbper_reflink: a("Charpinet et al. 2011"), pl_rade: "0.759", pl_rade_reflink: a("Charpinet et al. 2011"), pl_controv_flag: "1" });
const UCAC4 = row({ pl_name: "UCAC4 328-061594 b", hostname: "UCAC4 328-061594", discoverymethod: "Imaging", disc_year: "2024", pl_bmasse: "6674", pl_bmasse_reflink: a("Rothermich et al. 2024"), pl_orbsmax: "19000", pl_orbsmax_reflink: a("Rothermich et al. 2024"), pl_controv_flag: "0" });
const ALL = parseExoCsv(csv(V2376, KEPLER80F, COCONUTS, KOI55B, UCAC4));
const by = (n: string) => ALL.find((x) => x.n === n)!;

test("1. CSV with the additional columns parses: values, errors, limit flag, reference, mass provenance", () => {
  const v = by("V2376 Ori b");
  assert.equal(v.t, 2100);
  assert.deepEqual(v.u!.t, { e1: 200, e2: -300, l: 0, r: { l: "Vila et al. 2025", u: "https://example.org/ref" } });
  assert.equal(v.mp, "Mass");
  assert.equal(v.c, 0);
});

test("2. missing uncertainty stays missing (never 0)", () => {
  const u = by("UCAC4 328-061594 b");
  assert.equal(u.ms, 6674);
  assert.equal(u.u!.ms!.e1, undefined);
  assert.equal(u.u!.ms!.e2, undefined);
  const d = paramDetail(u, "ms");
  assert.equal(d.upper, null);
  assert.equal(d.lower, null);
  assert.equal(JSON.stringify(u).includes('"e1":0'), false);
});

test("3. asymmetric uncertainties are kept exactly, with the archive's signs (V2376 Ori b Teq +200/-300; COCONUTS-2 b radius +0.06/-0.04)", () => {
  const t = paramDetail(by("V2376 Ori b"), "t");
  assert.equal(t.upper, 200);
  assert.equal(t.lower, -300);
  assert.equal(fmtSigned(t.upper!), "+200");
  assert.equal(fmtSigned(t.lower!), "−300");
  const r = paramDetail(by("COCONUTS-2 b"), "r");
  assert.equal(r.upper, 0.06);
  assert.equal(r.lower, -0.04);
});

test("4. limit flags are preserved raw, and only flag 1 is read as an upper limit", () => {
  assert.equal(paramDetail(by("Kepler-80 f"), "ms").rawLimit, 1);
  assert.equal(paramDetail(by("Kepler-80 f"), "ms").limit, "upper");
  assert.equal(paramDetail(by("Kepler-80 f"), "p").rawLimit, 0);
  assert.equal(limitKind(0), "none");
  assert.equal(limitKind(null), "none");
  assert.equal(limitKind(undefined), "none");
  assert.equal(limitKind(1), "upper");
  assert.equal(limitKind(-1), "unverified", "-1 is not assumed to mean anything");
  assert.equal(limitKind(2), "unverified");
  const m = parseExoCsv(csv(row({ pl_name: "X b", hostname: "X", pl_rade: "3", pl_radelim: "-1" })));
  assert.equal(m[0].u!.r!.l, -1, "the raw flag survives parsing");
});

test("5. mass provenance is preserved as written", () => {
  const rows = parseExoCsv(csv(row({ pl_name: "A b", hostname: "A", pl_bmasse: "1", pl_bmassprov: "Msini" }), row({ pl_name: "B b", hostname: "B", pl_bmasse: "1", pl_bmassprov: "M*sin(i)/sin(i)" })));
  assert.equal(rows[0].mp, "Msini");
  assert.equal(rows[1].mp, "M*sin(i)/sin(i)");
  assert.equal(by("COCONUTS-2 b").mp, undefined, "a planet with no provenance cell has none");
});

test("6. references stay independent per parameter (COCONUTS-2 b)", () => {
  const c = by("COCONUTS-2 b");
  assert.equal(paramDetail(c, "r").ref!.l, "Kiman et al. 2026");
  assert.equal(paramDetail(c, "ms").ref!.l, "Zhang et al. 2025");
  assert.equal(paramDetail(c, "p").ref!.l, "Zhang et al. 2021");
  assert.equal(paramDetail(c, "t").ref!.l, "Kiman et al. 2026");
  assert.equal(new Set(["r", "ms", "p"].map((k) => paramDetail(c, k as "r").ref!.l)).size, 3);
});

test("7. CALCULATED_VALUE is a calculated source, not a publication; no link is kept for it", () => {
  assert.deepEqual(parseReference("CALCULATED_VALUE"), { l: "CALCULATED_VALUE", k: "calc" });
  assert.deepEqual(parseReference('<a refstr=CALCULATED_VALUE href=https://example.org/x target=ref>Calculated Value</a>'), { l: "CALCULATED_VALUE", k: "calc" });
  assert.deepEqual(parseReference("calculated value"), { l: "CALCULATED_VALUE", k: "calc" });
  const p = parseExoCsv(csv(row({ pl_name: "C b", hostname: "C", pl_rade: "1.1", pl_rade_reflink: "CALCULATED_VALUE" })))[0];
  assert.equal(paramDetail(p, "r").origin, "calculated");
  assert.equal(paramDetail(by("V2376 Ori b"), "t").origin, "measured");
  assert.equal(paramDetail(by("KOI-55 b"), "r").origin, "measured");
});

test("reference parsing never keeps HTML and only keeps safe links", () => {
  assert.deepEqual(parseReference('<a href="https://example.org/p?a=1&amp;b=2">Smith &amp; Jones 2020</a>'), { l: "Smith & Jones 2020", u: "https://example.org/p?a=1&b=2" });
  assert.equal(parseReference('<a href="javascript:alert(1)">Evil 2020</a>')!.u, undefined);
  assert.equal(parseReference('<a href="data:text/html,<script>1</script>">Evil</a>')!.u, undefined);
  assert.equal(parseReference('<a href="https://user:pw@example.org/">Cred</a>')!.u, undefined);
  assert.equal(parseReference('<a href="/relative">Rel</a>')!.u, undefined);
  const s = parseReference('<script>alert(1)</script><b>Bold</b> Ref 2020');
  assert.ok(!/[<>]/.test(s!.l), s!.l);
  assert.equal(parseReference("Plain Author 2019")!.l, "Plain Author 2019");
  assert.deepEqual(parseReference("https://example.org/paper"), { l: "https://example.org/paper", u: "https://example.org/paper" });
  assert.equal(parseReference(""), null);
  assert.equal(parseReference("   "), null);
  assert.equal(parseReference("<a></a>"), null);
  assert.equal(safeUrl("ftp://example.org"), undefined);
  assert.ok(parseReference("x".repeat(500))!.l.length <= 200);
});

test("8. controversy wording is neutral and accurate", () => {
  assert.equal(by("KOI-55 b").c, 1);
  assert.match(CONTROVERSY_TEXT, /confirmation status has been questioned in the published literature/);
  assert.match(CONTROVERSY_TEXT, /flag, not a ruling/);
  assert.doesNotMatch(CONTROVERSY_TEXT, /false|disprov|refut|does not exist|not real|disputed/i);
});

test("9. malformed numbers, short rows and junk never crash the parser", () => {
  const bad = row({ pl_name: "Bad b", hostname: "Bad", pl_rade: "abc", pl_radeerr1: "x", pl_radeerr2: "1e999", pl_radelim: "?", pl_orbper: "NaN", pl_bmasse: "2", pl_bmasseerr1: "--", pl_bmasse_reflink: "<a href=" });
  const out = parseExoCsv(csv(bad, "just,two", "", `${V2376}`));
  assert.equal(out.find((x) => x.n === "Bad b")!.r, null);
  assert.equal(out.find((x) => x.n === "Bad b")!.p, null);
  assert.equal(out.find((x) => x.n === "Bad b")!.u?.ms?.e1, undefined);
  assert.ok(out.some((x) => x.n === "V2376 Ori b"));
  assert.throws(() => parseExoCsv(""), /empty CSV/);
  assert.throws(() => parseExoCsv("pl_name,hostname\nA,B"), /archive columns missing/);
});

test("older CSVs without the extra columns still parse (no detail, no crash)", () => {
  const old = [Object.values(EXO_COLUMNS).join(","), Object.values(EXO_COLUMNS).map((c) => ({ pl_name: "Old b", hostname: "Old", pl_orbper: "3.5" } as Record<string, string>)[c] ?? "").join(",")].join("\n");
  const p = parseExoCsv(old)[0];
  assert.equal(p.p, 3.5);
  assert.equal(p.u, undefined);
  assert.equal(p.mp, undefined);
});

test("10. search, method filter and sorting still work on records that carry detail", () => {
  assert.deepEqual(queryExo(ALL, { text: "kepler", method: "", sort: "name" }).map((x) => x.n), ["Kepler-80 f"]);
  assert.deepEqual(queryExo(ALL, { text: "", method: "Imaging", sort: "name" }).map((x) => x.n), ["COCONUTS-2 b", "UCAC4 328-061594 b", "V2376 Ori b"]);
  assert.equal(queryExo(ALL, { text: "", method: "", sort: "year" })[0].n, "V2376 Ori b");
  assert.equal(queryExo(ALL, { text: "", method: "", sort: "radius" })[0].n, "COCONUTS-2 b");
});

test("11. old or incomplete records are safe to read and count", () => {
  const legacy = { n: "Legacy b", h: "Legacy", m: null, y: null, p: 5, a: null, r: null, ms: null, t: null, ns: null, np: null, d: null, v: null, sp: null, te: null, ra: null, dec: null, c: null } as Exoplanet;
  const d = paramDetail(legacy, "p");
  assert.deepEqual([d.value, d.upper, d.lower, d.ref, d.origin, d.limit, d.rawLimit], [5, null, null, null, "unknown", "none", null]);
  assert.equal(paramDetail(legacy, "ms").value, null);
  const st = exoStats([legacy, legacy]);
  assert.equal(st.records, 2);
  assert.equal(st.duplicates, 1);
  assert.equal(st.valuesWithNoReference, 2);
});

test("formatting: exact values are not rounded", () => {
  assert.equal(fmtExact(12651.5), "12,651.5");
  assert.equal(fmtExact(0.98678527), "0.98678527");
  assert.equal(fmtExact(0.1 + 0.2), "0.3");
  assert.equal(fmtExact(402000000), "402,000,000");
});

test("dataset statistics count limits, provenance, missing detail and controversy", () => {
  const s = exoStats(ALL);
  assert.equal(s.records, 5);
  assert.equal(s.duplicates, 0);
  assert.equal(s.controversial, 1);
  assert.equal(s.limitFlags["1"], 1);
  assert.equal(s.massProvenance["Mass"], 2);
  assert.ok(s.valuesWithNoUncertainty >= 3);
  // in the fixtures V2376 Ori b's semi-major axis and Kepler-80 f's period have no reference cell
  assert.equal(s.valuesWithNoReference, 2);
});

// ---- live service ----
const live = (o: Record<string, unknown>) => Object.fromEntries(parseExoplanet([o]).map((r) => [r.label, r]));

test("12. live query lists exact columns (no select *) including all detail columns", () => {
  for (const c of ["pl_bmasselim", "pl_eqterr2", "pl_orbsmax_reflink", "pl_bmassprov", "pl_controv_flag"]) assert.ok(LIVE_COLUMNS.includes(c), c);
  assert.equal(LIVE_COLUMNS.includes("*"), false);
});

test("13. live: Kepler-80 f mass is an upper limit, never an ordinary measured mass", () => {
  const r = live({ pl_name: "Kepler-80 f", hostname: "Kepler-80", pl_bmasse: 12651.5, pl_bmasselim: 1, pl_bmassprov: "Mass", pl_bmasse_reflink: '<a refstr="Ofir et al. 2025" href="https://example.org/o">Ofir et al. 2025</a>' });
  assert.equal(r["Mass"].value, "< 12,651.5 Earth masses");
  assert.match(r["Mass"].note!, /upper limit, not a measured value/);
  assert.match(r["Mass"].note!, /reference: Ofir et al\. 2025/);
  assert.match(r["Mass"].note!, /mass type: Mass/);
  assert.doesNotMatch(r["Mass"].value, /^12/);
});

test("14. live: V2376 Ori b shows the asymmetric temperature uncertainty and its reference", () => {
  const r = live({ pl_name: "V2376 Ori b", hostname: "V2376 Ori", pl_eqt: 2100, pl_eqterr1: 200, pl_eqterr2: -300, pl_eqtlim: 0, pl_eqt_reflink: "Vila et al. 2025" });
  assert.equal(r["Equilibrium temperature"].value, "2,100 K (+200 / −300)");
  assert.match(r["Equilibrium temperature"].note!, /reference: Vila et al\. 2025/);
});

test("15. live: COCONUTS-2 b keeps one reference per parameter", () => {
  const r = live({ pl_name: "COCONUTS-2 b", hostname: "COCONUTS-2", pl_rade: 12.58, pl_rade_reflink: "Kiman et al. 2026", pl_bmasse: 2543, pl_bmasse_reflink: "Zhang et al. 2025", pl_orbper: 402000000, pl_orbper_reflink: "Zhang et al. 2021" });
  assert.match(r["Radius"].note!, /Kiman et al\. 2026/);
  assert.match(r["Mass"].note!, /Zhang et al\. 2025/);
  assert.match(r["Orbital period"].note!, /Zhang et al\. 2021/);
  assert.doesNotMatch(r["Mass"].note!, /Kiman|2021/);
});

test("16. KOI-55 b: the controversy flag is shown neutrally, in the static data and the live rows", () => {
  assert.equal(paramDetail(by("KOI-55 b"), "p").value, 0.240104);
  const r = live({ pl_name: "KOI-55 b", hostname: "KOI-55", pl_controv_flag: 1 });
  assert.equal(r["Archive flag"].value, "Controversial");
  assert.equal(r["Archive flag"].note, CONTROVERSY_TEXT);
  assert.equal(live({ pl_name: "Calm b", hostname: "Calm", pl_controv_flag: 0 })["Archive flag"], undefined);
});

test("live: calculated values are labelled calculated; unverified flags are shown raw; plain output unchanged without detail", () => {
  const c = live({ pl_name: "C b", hostname: "C", pl_rade: 1.1, pl_rade_reflink: "CALCULATED_VALUE" });
  assert.match(c["Radius"].note!, /calculated by the archive \(CALCULATED_VALUE\), not a publication/);
  assert.doesNotMatch(c["Radius"].note!, /reference:/);
  const u = live({ pl_name: "U b", hostname: "U", pl_rade: 2, pl_radelim: -1 });
  assert.match(u["Radius"].note!, /archive limit flag -1/);
  assert.match(u["Radius"].note!, /not verified/);
  const p = live({ pl_name: "P b", hostname: "P", pl_rade: 1.234, pl_bmasse: 1.07 });
  assert.equal(p["Radius"].value, "1.23 Earth radii");
  assert.equal(p["Mass"].value, "1.07 Earth masses");
  assert.equal(p["Mass"].note, "best available estimate");
});

test("badges: planet parameters are not all labelled as direct observations", () => {
  const mk = (over: Partial<ReturnType<typeof paramDetail>>) => ({ key: "ms" as const, value: 5, upper: null, lower: null, limit: "none" as const, rawLimit: null, ref: null, origin: "measured" as const, ...over });
  assert.equal(paramBadge(mk({}), false), null, "an ordinary published value gets no 'observed' badge");
  assert.equal(paramBadge(mk({ origin: "calculated" }), false), "estimated");
  assert.equal(paramBadge(mk({}), true), "estimated", "equilibrium temperature is computed");
  assert.equal(paramBadge(mk({ limit: "upper", rawLimit: 1 }), true), null, "an upper limit is not a measurement and gets no badge");
  assert.equal(paramBadge(mk({ limit: "unverified", rawLimit: -1 }), true), null);
  assert.equal(paramBadge(mk({ value: null }), true), null);
});
