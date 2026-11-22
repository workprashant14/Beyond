// Needs production server on :3111. Atmosphere glow: toggle, disclosure, shader compile errors, a11y, screenshots for inspection.
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
  const errs = [], shader = [];
  p.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (/Shader Error|WebGLProgram|GLSL|compile/i.test(m.text())) shader.push(m.text());
    else if (m.type() === "error" && !/WebGL|GPU stall|swiftshader|bodies\.json/i.test(m.text())) errs.push(m.text());
  });
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`${BASE}/explore?object=earth`, { waitUntil: "networkidle" });
  const ctl = p.getByRole("region", { name: "Simulation controls" });
  // On a phone the controls show only the play/speed row until opened (so they do not cover the object panel): open the rest.
  { const more = ctl.getByRole("button", { name: /More controls/ }); if (await more.isVisible()) await more.click(); }
  await ctl.waitFor();
  await ctl.getByRole("button", { name: /Pause simulation/ }).click();
  await sleep(2500);
  if (name === "desktop") await p.screenshot({ path: "/tmp/claude-0/atmo-on.png", clip: { x: 300, y: 120, width: 700, height: 560 } });
  const btn = ctl.getByRole("button", { name: "Atmosphere glow" });
  ok((await btn.getAttribute("aria-pressed")) === "true", `${name}: glow on by default`);
  ok(/Colour and thickness are artistic, not measured/.test(await ctl.innerText()), `${name}: artistic disclosure`);
  await btn.click(); await sleep(600);
  ok((await btn.getAttribute("aria-pressed")) === "false", `${name}: toggles off`);
  if (name === "desktop") await p.screenshot({ path: "/tmp/claude-0/atmo-off.png", clip: { x: 300, y: 120, width: 700, height: 560 } });
  await btn.click();
  for (const id of ["venus", "jupiter", "titan", "mercury"]) { await p.goto(`${BASE}/explore?object=${id}`, { waitUntil: "networkidle" }); await sleep(900); }
  if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
  await p.addScriptTag({ content: axeSrc });
  const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  ok(ax.violations.length === 0, `${name}: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0 violations"}`);
  ok(shader.length === 0, `${name}: no shader compile errors ${JSON.stringify(shader.slice(0, 2))}`);
  ok(errs.length === 0, `${name}: console errors ${JSON.stringify(errs.slice(0, 3))}`);
  await p.close();
}
await b.close();
process.exit(fail ? 1 : 0);
