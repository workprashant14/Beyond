// Needs production server on :3111. Dwarf-planet layer: (A) file not built -> honest note; (B) a SYNTHETIC file served through request interception
// (placeholder orbital numbers, test only, never written to the project) -> chips, selection and no errors.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rec = (n, a, e, i) => ({ id: "S-" + n, n, k: "a", a, e, i, om: 80, w: 40, ma: 10, ep: 2460000.5, per: Math.round(365.25 * a ** 1.5), H: 3, d: 500 });
const FULL = ["134340 Pluto (1930 BA)", "     1 Ceres", "136199 Eris (2003 UB313)", "136108 Haumea (2003 EL61)", "136472 Makemake (2005 FY9)", "     4 Vesta", "     2 Pallas", "    10 Hygiea"];
const ORB = [[39.5, 0.25, 17], [2.77, 0.08, 10.6], [68, 0.44, 44], [43, 0.19, 28], [45.5, 0.16, 29], [2.36, 0.09, 7], [2.77, 0.23, 34.8], [3.14, 0.11, 3.8]];
const PLACEHOLDER = { meta: { source: "none", built: "", asteroids: 0, comets: 0, query: "" }, bodies: [] }; // identical to the shipped public/smallbodies/bodies.json
const file = (names) => ({ meta: { source: "SYNTHETIC TEST FILE", built: "", asteroids: names.length, comets: 0, query: "" }, bodies: names.map((n) => { const k = FULL.indexOf(n); return rec(n, ...ORB[k]); }) });
const run = async (name, vp, data) => {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && !/WebGL|GPU stall|swiftshader|bodies\.json/i.test(m.text()) && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  // data === null is scenario A, "not built": the browser is given the same placeholder file the project ships (source "none", no bodies), whether or not
  // the real file is installed. Request interception only: no project file is read, moved or written.
  await p.route("**/smallbodies/bodies.json", (r) => r.fulfill({ json: data ?? PLACEHOLDER }));
  await p.goto(`${BASE}/explore?object=earth`, { waitUntil: "networkidle" });
  const ctl = p.getByRole("region", { name: "Simulation controls" });
  // On a phone the controls show only the play/speed row until opened (so they do not cover the object panel): open the rest.
  { const more = ctl.getByRole("button", { name: /More controls/ }); if (await more.isVisible()) await more.click(); }
  await ctl.waitFor(); await sleep(800);
  return { p, ctl, errs };
};
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 700 }]]) {
  { // A: not built
    const { p, ctl, errs } = await run(name, vp, null);
    const t = await ctl.innerText();
    ok(/Dwarf planets, asteroids and comets: Data unavailable/.test(t) && /build:smallbodies/.test(t), `${name} A: not-built note shown`);
    ok((await ctl.getByRole("list", { name: "Dwarf planets and large asteroids" }).count()) === 0, `${name} A: no featured chips without data`);
    ok(errs.length === 0, `${name} A: console errors ${JSON.stringify(errs.slice(0, 3))}`);
    await p.close();
  }
  { // B: partial synthetic file (Pluto, Ceres, Vesta)
    const { p, ctl, errs } = await run(name, vp, file([FULL[0], FULL[1], FULL[5]]));
    const list = ctl.getByRole("list", { name: "Dwarf planets and large asteroids" });
    const names = await list.getByRole("button").allInnerTexts();
    ok(JSON.stringify(names) === JSON.stringify(["Pluto", "Ceres", "Vesta"]), `${name} B: chips ${JSON.stringify(names)}`);
    ok(/Not in the built file: Eris, Haumea, Makemake, Pallas, Hygiea\./.test(await ctl.innerText()), `${name} B: missing bodies listed, not invented`);
    await list.getByRole("button", { name: "Pluto" }).click();
    await sleep(400);
    ok((await ctl.innerText()).includes("134340 Pluto") && /Asteroid · semi-major axis/.test(await ctl.innerText()), `${name} B: selecting Pluto opens its orbit card`);
    ok((await list.getByRole("button", { name: "Pluto" }).getAttribute("aria-pressed")) === "true", `${name} B: Pluto chip pressed`);
    if (name === "desktop") await p.screenshot({ path: "/tmp/claude-0/featured-desktop.png" });
    if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
    await p.addScriptTag({ content: axeSrc });
    const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
    ok(ax.violations.length === 0, `${name} B: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0 violations"}`);
    ok(errs.length === 0, `${name} B: console errors ${JSON.stringify(errs.slice(0, 3))}`);
    await p.close();
  }
  { // C: all eight
    const { p, ctl, errs } = await run(name, vp, file(FULL));
    const n = (await ctl.getByRole("list", { name: "Dwarf planets and large asteroids" }).getByRole("button").allInnerTexts()).length;
    ok(n === 8 && !/Not in the built file/.test(await ctl.innerText()), `${name} C: all 8 chips, nothing missing (${n})`);
    ok(errs.length === 0, `${name} C: console errors ${JSON.stringify(errs.slice(0, 3))}`);
    await p.close();
  }
}
await b.close();
process.exit(fail ? 1 : 0);
