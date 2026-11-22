// Needs production server on :3111. Comet tails: controls, disclosure, a11y, console, and a screenshot for visual inspection.
// Uses a SYNTHETIC comet file (placeholder orbital numbers) served through request interception; never written to the project.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const com = (n, a, e, i, om, w) => ({ id: "C-" + n, n, k: "c", a, e, i, om, w, ma: 0, ep: 2460000.5, per: Math.round(365.25 * a ** 1.5), H: null, d: null });
const asteroid = { id: "A-1", n: "     1 Ceres", k: "a", a: 2.77, e: 0.08, i: 10.6, om: 80, w: 73, ma: 10, ep: 2460000.5, per: 1680, H: 3, d: 500 };
const data = (comets) => ({ meta: { source: "SYNTHETIC TEST FILE", built: "", asteroids: 1, comets: comets.length, query: "" }, bodies: [asteroid, ...comets] });
const run = async (name, vp, d, shot) => {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && !/WebGL|GPU stall|swiftshader|bodies\.json/i.test(m.text()) && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  if (d) await p.route("**/smallbodies/bodies.json", (r) => r.fulfill({ json: d }));
  await p.goto(`${BASE}/explore?object=sun`, { waitUntil: "networkidle" });
  const ctl = p.getByRole("region", { name: "Simulation controls" });
  // On a phone the controls show only the play/speed row until opened (so they do not cover the object panel): open the rest.
  { const more = ctl.getByRole("button", { name: /More controls/ }); if (await more.isVisible()) await more.click(); }
  await ctl.waitFor();
  await ctl.getByRole("button", { name: /Pause simulation/ }).click();
  await ctl.locator("#sim-date").fill("2023-02-25"); // the synthetic comets' epoch (mean anomaly 0 = at perihelion)
  await sleep(1500);
  if (shot) await p.screenshot({ path: shot });
  return { p, ctl, errs };
};
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 700 }]]) {
  { // no comets in file -> no tail control
    const { p, ctl, errs } = await run(name, vp, data([]), null);
    ok((await ctl.getByRole("button", { name: "Comet tails" }).count()) === 0, `${name}: no comets, no tail control`);
    ok(errs.length === 0, `${name}: no-comet console ${JSON.stringify(errs.slice(0, 2))}`);
    await p.close();
  }
  { // comets present
    const d = data([com("C/2099 A1 (Near)", 2.5, 0.9, 20, 100, 60), com("C/2099 B2 (Mid)", 4, 0.5, 40, 200, 10), com("C/2099 C3 (Far)", 30, 0.2, 10, 10, 10)]);
    const { p, ctl, errs } = await run(name, vp, d, name === "desktop" ? "/tmp/claude-0/tails.png" : null);
    const btn = ctl.getByRole("button", { name: "Comet tails" });
    ok((await btn.count()) === 1 && (await btn.getAttribute("aria-pressed")) === "true", `${name}: tail toggle shown, on by default`);
    const t = await ctl.innerText();
    ok(/artistic/i.test(t) && /point away from the Sun \(real\); length and the 3 au limit are display choices/.test(t), `${name}: Artistic badge and disclosure`);
    await btn.click();
    ok((await btn.getAttribute("aria-pressed")) === "false", `${name}: toggles off`);
    await btn.click();
    if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
    await p.addScriptTag({ content: axeSrc });
    const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
    ok(ax.violations.length === 0, `${name}: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0 violations"}`);
    ok(errs.length === 0, `${name}: console errors ${JSON.stringify(errs.slice(0, 3))}`);
    await p.close();
  }
}
await b.close();
process.exit(fail ? 1 : 0);
