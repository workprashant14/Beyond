// Needs production server on :3111. Schematic outer regions: toggles, provenance badges, disclosure, a11y, console.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 700 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && !/WebGL|GPU stall|swiftshader|bodies\.json/i.test(m.text()) && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`${BASE}/explore?object=solar-system`, { waitUntil: "networkidle" });
  const ctl = p.getByRole("region", { name: "Simulation controls" });
  // On a phone the controls show only the play/speed row until opened (so they do not cover the object panel): open the rest.
  { const more = ctl.getByRole("button", { name: /More controls/ }); if (await more.isVisible()) await more.click(); }
  await ctl.waitFor(); await sleep(1500);
  const grp = ctl.getByRole("group", { name: "Schematic outer regions" });
  const press = async (n) => (await grp.getByRole("button", { name: n }).getAttribute("aria-pressed")) === "true";
  ok((await press("Kuiper belt")) && (await press("Scattered disc")) && !(await press("Oort cloud")), `${name}: defaults Kuiper+scattered on, Oort off`);
  let t = await ctl.innerText();
  ok(/Random dots inside real extents, not real objects/.test(t) && /artistic/i.test(t) && !/theoretical/i.test(t.split("Outer regions")[1] ?? ""), `${name}: artistic badge and disclosure shown, no theoretical badge yet`);
  await grp.getByRole("button", { name: "Oort cloud" }).click();
  await sleep(500);
  t = await ctl.innerText();
  ok((await press("Oort cloud")) && /theoretical/i.test(t) && /log-compressed/.test(t), `${name}: Oort on adds theoretical badge and log-compression note`);
  await ctl.locator("summary", { hasText: "Extents, sources and caveats" }).click();
  t = await ctl.innerText();
  ok(/30 to 55 au/.test(t) && /5,000 to 100,000 au/.test(t) && /Never directly observed/.test(t) && /disagree/.test(t) && /1,000 au/.test(t), `${name}: extents, sources and caveats are readable`);
  await grp.getByRole("button", { name: "Kuiper belt" }).click();
  ok(!(await press("Kuiper belt")), `${name}: Kuiper toggles off`);
  if (name === "desktop") {
    await grp.getByRole("button", { name: "Kuiper belt" }).click();
    await p.mouse.move(640, 300);
    for (let k = 0; k < 14; k++) { await p.mouse.wheel(0, 400); await sleep(60); }
    await sleep(1500);
    await p.screenshot({ path: "/tmp/claude-0/regions-wide.png" });
  }
  if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
  await p.addScriptTag({ content: axeSrc });
  const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  ok(ax.violations.length === 0, `${name}: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0 violations"}`);
  ok(errs.length === 0, `${name}: console errors ${JSON.stringify(errs.slice(0, 3))}`);
  await p.close();
}
await b.close();
process.exit(fail ? 1 : 0);
