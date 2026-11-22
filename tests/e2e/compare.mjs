// Run with the production server on :3111. Checks deep link, ratios, prose fallback, swap, axe, console, mobile.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const b = await chromium.launch();
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 700 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`${BASE}/compare?a=earth&b=jupiter`, { waitUntil: "networkidle" });
  const t = await p.locator("main").innerText();
  ok(/12,742 km/.test(t) && /139,820 km/.test(t), `${name}: both diameters shown`);
  ok(/Jupiter is 11\.0× Earth in diameter/.test(t), `${name}: diameter ratio`);
  ok(/Jupiter is 3\d\d(\.\d+)?× Earth in mass|Jupiter is 3\d\d× Earth in mass/.test(t), `${name}: mass ratio`);
  ok(/Data unavailable/.test(t), `${name}: missing value says Data unavailable`);
  if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal page scroll");
  await p.getByRole("button", { name: "Swap objects" }).click();
  await p.waitForURL(/a=jupiter&b=earth/);
  ok(true, `${name}: swap updates URL`);
  await p.goto(`${BASE}/compare?a=earth&b=nope`, { waitUntil: "networkidle" });
  ok(/not in the catalogue/.test(await p.locator("main").innerText()), `${name}: unknown id handled`);
  await p.goto(`${BASE}/compare?a=earth&b=moon`, { waitUntil: "networkidle" });
  await p.addScriptTag({ content: axeSrc });
  const v = await p.evaluate(() => axe.run());
  ok(v.violations.length === 0, `${name}: axe clean ${v.violations.map((x) => x.id + ":" + x.nodes.length).join(",")}`);
  ok(errs.length === 0, `${name}: no console errors ${errs.join("|")}`);
}
await b.close();
process.exit(fail ? 1 : 0);
