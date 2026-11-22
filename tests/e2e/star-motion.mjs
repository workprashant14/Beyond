// Needs production server on :3111. Opens Sirius (HIP 32349) and a star without a trustworthy distance.
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
  const errs = [], bad = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("response", (r) => r.status() >= 400 && !/api\//.test(r.url()) && bad.push(`${r.status()} ${r.url()}`));
  await p.goto(`${BASE}/sky?star=32349`, { waitUntil: "networkidle" });
  const panel = p.getByRole("complementary", { name: "Star information" });
  await panel.waitFor();
  await p.waitForFunction(() => /Proper motion/.test(document.querySelector("aside[aria-label='Star information']")?.innerText ?? ""));
  const t = await panel.innerText();
  ok(/-546\.0 mas\/yr in RA, -1223\.1 mas\/yr in Dec \(total 1339\.\d\)/.test(t), `${name}: Sirius proper motion shown`);
  ok(/-9\.4 km\/s/.test(t) && /moving away from the Sun/.test(t) && /HYG/.test(t), `${name}: radial velocity with direction note and its source`);
  ok(/Speed across the sky\s*≈ 16\.\d km\/s/.test(t) && /Estimated/i.test(t), `${name}: tangential speed shown as Estimated`);
  ok(/HR 2491/.test(t) && /HD 48915/.test(t) && /Gl 244A/.test(t), `${name}: HD, HR and Gliese identifiers`);
  ok(/no uncertainty/.test(t), `${name}: says the table has no uncertainty`);
  if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
  await p.addScriptTag({ content: axeSrc });
  const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  ok(ax.violations.length === 0, `${name}: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0 violations"}`);
  ok(errs.length === 0 && bad.length === 0, `${name}: console errors ${JSON.stringify(errs.slice(0, 3))}; failed requests ${JSON.stringify(bad)}`);
}
await b.close();
process.exit(fail ? 1 : 0);
