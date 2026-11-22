// Frame rate of the galaxy views against a running production server (npm run build && npm start, default port 3000;
// use BASE=http://localhost:3111 for the e2e server). Prints rAF fps per view, 3 passes. Compare machines, not absolute numbers:
// headless Chromium + SwiftShader is a software rasteriser and much slower than a real GPU.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3000";
const VIEWS = [["universe (5 galaxies)", "/explore"], ["milky-way", "/explore?object=milky-way"], ["andromeda", "/explore?object=andromeda"], ["lmc (irregular)", "/explore?object=lmc"], ["m87 (elliptical)", "/explore?object=m87"]];
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const [label, url] of VIEWS) {
  const runs = [];
  for (let k = 0; k < 3; k++) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await p.goto(BASE + url, { waitUntil: "load" });
    await p.waitForSelector("canvas", { timeout: 60000 });
    await p.waitForTimeout(4000);
    runs.push(await p.evaluate(() => new Promise((r) => { let c = 0; const s = performance.now(); const f = () => { c++; if (performance.now() - s < 3000) requestAnimationFrame(f); else r(c / 3); }; requestAnimationFrame(f); })));
    await p.close();
  }
  console.log(`${label.padEnd(24)} ${runs.map((x) => x.toFixed(1)).join("  ")}  median ${[...runs].sort((a, b) => a - b)[1].toFixed(1)} fps`);
}
await browser.close();
