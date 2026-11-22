// Needs production server on :3111.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 700 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`${BASE}/milky-way`, { waitUntil: "networkidle" });
  const t = await p.locator("main").innerText();
  ok(/8,277 ± 9 pc/.test(t) && /8\.15 ± 0\.15 kpc/.test(t), `${name}: both distances shown`);
  ok(/two major arms/i.test(t) && /four-arm|Four major arms/i.test(t), `${name}: both arm descriptions shown`);
  ok(/Idealised drawing, not a map/.test(t) && /Artistic/i.test(t), `${name}: schematic labelled artistic`);
  ok(/could not verify/.test(t), `${name}: unverified list shown`);
  ok((await p.locator("a[href^='https://']").count()) >= 8, `${name}: source links present`);
  if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
  await p.addScriptTag({ content: axeSrc });
  const v = await p.evaluate(() => axe.run());
  ok(v.violations.length === 0, `${name}: axe ${v.violations.map((x) => x.id + ":" + x.nodes.length).join(",")}`);
  await p.goto(`${BASE}/explore?object=milky-way`, { waitUntil: "networkidle" });
  await p.getByRole("link", { name: "Structure and measurements" }).click();
  await p.waitForURL(/\/milky-way$/);
  ok(true, `${name}: explore panel links to structure page`);
  ok(errs.length === 0, `${name}: no console errors ${errs.join("|").slice(0, 300)}`);
}
await b.close();
process.exit(fail ? 1 : 0);
