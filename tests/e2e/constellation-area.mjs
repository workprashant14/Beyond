// Needs production server on :3111. Constellation panel: area and size rank, a11y, console, network.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const b = await chromium.launch();
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const cases = [["Hya", "Hydra", /1,302\.8 square degrees \(3\.16% of the sky\)/, "1 of 88"], ["Cru", "Crux", /68\.4 square degrees \(0\.17% of the sky\)/, "88 of 88"], ["Ser", "Serpens", /636\.9 square degrees/, "23 of 88"]];
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 700 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  const errs = [], bad = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("response", (r) => r.status() >= 400 && !/api\//.test(r.url()) && bad.push(`${r.status()} ${r.url()}`));
  for (const [id, title, area, rank] of cases) {
    await p.goto(`${BASE}/sky?con=${id}`, { waitUntil: "networkidle" });
    const panel = p.getByRole("complementary", { name: "Constellation information" });
    await panel.waitFor();
    await p.waitForFunction(() => !/Loading…/.test(document.querySelector('aside[aria-label="Constellation information"]')?.textContent ?? ""), null, { timeout: 5000 });
    const t = await panel.innerText();
    ok(t.includes(title) && area.test(t), `${name} ${id}: area row`);
    ok(new RegExp(`Size rank\\s*${rank}`).test(t), `${name} ${id}: size rank ${rank}`);
    ok(/area of the IAU region \(a convention, not a physical size\); published value/.test(t), `${name} ${id}: provenance note`);
    ok(!/Area on the sky\s*Data unavailable/.test(t), `${name} ${id}: area not "Data unavailable"`);
  }
  if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
  await p.addScriptTag({ content: axeSrc });
  const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  ok(ax.violations.length === 0, `${name}: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0 violations"}`);
  ok(errs.filter((e) => !/WebGL|GPU stall/i.test(e)).length === 0, `${name}: console errors ${JSON.stringify(errs.slice(0, 2))}`);
  ok(bad.length === 0, `${name}: failed requests ${JSON.stringify(bad)}`);
  await p.close();
}
await b.close();
process.exit(fail ? 1 : 0);
