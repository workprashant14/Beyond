// Needs production server on :3111.
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
  await p.goto(`${BASE}/distance?a=earth&b=mars&date=2018-07-31`, { waitUntil: "networkidle" });
  let t = await p.locator("main").innerText();
  ok(/0\.38\d au/.test(t) && /57\.\d\d million km/.test(t), `${name}: Mars 2018 opposition ~0.385 au / ~57.6 M km`);
  ok(/Light travel time\s*3\.\d minutes/.test(t), `${name}: light time ~3.2 min`);
  ok(/Estimated/i.test(t), `${name}: Estimated badge`);
  ok(/Closest in this window/.test(t), `${name}: chart summary`);
  if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
  await p.getByRole("button", { name: "Swap bodies" }).click();
  await p.waitForURL(/a=mars&b=earth/);
  ok(true, `${name}: swap`);
  await p.goto(`${BASE}/distance?a=earth&b=mars&date=2100-01-01`, { waitUntil: "networkidle" });
  ok(/outside 1800.2050/.test(await p.locator("main").innerText()), `${name}: out-of-range refused`);
  await p.goto(`${BASE}/distance?a=moon&b=zzz&date=junk`, { waitUntil: "networkidle" });
  t = await p.locator("main").innerText();
  ok(/not a valid date/.test(t) && /au/.test(t), `${name}: bad params fall back safely`);
  await p.goto(`${BASE}/distance`, { waitUntil: "networkidle" });
  ok(/Light travel time/.test(await p.locator("main").innerText()), `${name}: defaults work`);
  await p.addScriptTag({ content: axeSrc });
  const v = await p.evaluate(() => axe.run());
  ok(v.violations.length === 0, `${name}: axe ${v.violations.map((x) => x.id + ":" + x.nodes.length).join(",")}`);
  ok(errs.length === 0, `${name}: no console errors ${errs.join("|").slice(0, 300)}`);
}
await b.close();
process.exit(fail ? 1 : 0);
