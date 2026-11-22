import { createRequire } from "node:module";
// Needs production server on :3111. Uses SYNTHETIC planets served by request interception (nothing is written to public/):
// the exoplanet data file is absent in this project copy. Checks the system diagram against known inputs.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const row = (n, h, a, r) => ({ n, h, m: "Transit", y: 2020, p: null, a, r, ms: null, t: null, ns: 1, np: 3, d: 10, v: null, sp: null, te: null, ra: null, dec: null, c: 0 });
const DATA = [row("SYNTH-1 b", "SYNTH-1", 0.05, 1.5), row("SYNTH-1 c", "SYNTH-1", 1.2, null), row("SYNTH-1 d", "SYNTH-1", null, 3), row("SYNTH-2 b", "SYNTH-2", 500, 11), row("SYNTH-3 b", "SYNTH-3", null, 2)];
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 700 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && !/WebGL|GPU stall|GL Driver|swiftshader|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.route("**/exoplanets/planets.json", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(DATA) }));
  await p.goto(`${BASE}/exoplanets?planet=${encodeURIComponent("SYNTH-1 c")}`, { waitUntil: "load" });
  const sec = p.getByTestId("exo-system");
  await sec.waitFor({ timeout: 15000 });
  const t = (await sec.innerText()).replace(/\s+/g, " ");
  ok(/2 planets with an orbit size/i.test(t), `${name}: counts 2 drawn planets`);
  ok(/SYNTH-1 b: 0.05 au/.test(t) && /SYNTH-1 c: 1.2 au/.test(t), `${name}: lists the real au values`);
  ok(/size not in catalogue \(hollow dot\)/.test(t), `${name}: planet c has no radius, flagged`);
  ok(/No orbit size in the catalogue, not drawn: SYNTH-1 d/.test(t), `${name}: d is listed, not drawn`);
  ok(/ARTISTIC/i.test(t) && /eccentricity is not in the bundled data/.test(t), `${name}: artistic badge and honesty note`);
  const rings = await sec.locator("svg circle[stroke]").count();
  ok(rings >= 4, `${name}: svg has orbit rings and dots (${rings})`);
  const label = await sec.locator("svg").getAttribute("aria-label");
  ok(/SYNTH-1 b at 0.05 au/.test(label ?? ""), `${name}: svg has a text alternative`);
  await p.addScriptTag({ content: axeSrc });
  const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  ok(ax.violations.length === 0, `${name}: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0"}`);
  if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
  await sec.scrollIntoViewIfNeeded();
  await p.screenshot({ path: `/tmp/claude-0/exo-${name}.png` });
  await p.goto(`${BASE}/exoplanets?planet=${encodeURIComponent("SYNTH-2 b")}`, { waitUntil: "load" });
  await p.getByTestId("exo-system").waitFor();
  ok(/off the drawn scale/.test(await p.getByTestId("exo-system").innerText()), `${name}: 500 au is flagged as off the drawn scale`);
  await p.goto(`${BASE}/exoplanets?planet=${encodeURIComponent("SYNTH-3 b")}`, { waitUntil: "load" });
  await p.getByTestId("exo-system").waitFor();
  ok(/no system diagram can be drawn/.test(await p.getByTestId("exo-system").innerText()), `${name}: no-orbit system says so`);
  ok(errs.length === 0, `${name}: console ${JSON.stringify(errs.slice(0, 2))}`);
  await p.context().close();
}
await b.close();
process.exit(fail ? 1 : 0);
