import { createRequire } from "node:module";
// Needs production server on :3111. Pages with no 3D scene must not download the three.js renderer, not even through link prefetch
// (links into /explore, /map and /sky on these pages use prefetch={false}). Detects three.js by its renderer class name in any JS response.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.BASE ?? "http://localhost:3111";
const ROUTES = ["/moons", "/missions", "/exoplanets", "/pulsars", "/quasars", "/compare", "/distance", "/tours", "/milky-way", "/search?q=mars", "/this-page-does-not-exist"];
const b = await chromium.launch();
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
for (const r of ROUTES) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const hits = [], pend = [];
  p.on("response", (x) => { if (/\.js(\?|$)/.test(x.url())) pend.push(x.text().then((t) => { if (t.includes("WebGLRenderer")) hits.push(new URL(x.url()).pathname.split("/").pop()); }).catch(() => {})); });
  await p.goto(`${BASE}${r}`, { waitUntil: "load" });
  await p.mouse.wheel(0, 4000); // bring lower links into view so any viewport prefetch would fire
  await p.waitForTimeout(3000);
  await Promise.all(pend);
  ok(hits.length === 0, `${r}: no three.js downloaded ${JSON.stringify(hits)}`);
  await p.context().close();
}
await b.close();
process.exit(fail ? 1 : 0);
