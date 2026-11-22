// Captures the galaxy views used for before/after comparison: node scripts/shoot-galaxies.mjs <outDir> [baseUrl]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const out = process.argv[2] ?? "docs/realism/after";
const base = process.argv[3] ?? "http://localhost:3111";
const IDS = ["milky-way", "andromeda", "triangulum", "lmc", "m87"];
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const id of IDS) {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await p.goto(`${base}/explore?object=${id}`, { waitUntil: "load" });
  await p.waitForSelector("canvas", { timeout: 60000 });
  await p.getByRole("button", { name: "Close panel" }).click().catch(() => {});
  await p.waitForTimeout(6000); // camera fly-in
  await p.screenshot({ path: `${out}/${id}.png` });
  await p.close();
}
await b.close();
