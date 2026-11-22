// Needs production server on :3111. SYNTHETIC 20,000-body file served through request interception (placeholder orbits, timing/plumbing only).
// Frame rates here come from a software-rendered browser and are only comparable with each other, never with a real GPU.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import { warnIfStaleBuild } from "../../scripts/stale-build.mjs";
const BASE = process.env.BASE ?? "http://localhost:3111";
await warnIfStaleBuild(BASE);
const N = Number(process.env.N ?? 20000);
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bodies = Array.from({ length: N }, (_, k) => ({ id: "S" + k, n: `${k + 1} Synthetic${k + 1}`, k: "a", a: 2 + (k % 100) / 40, e: 0.05 + (k % 30) / 100, i: k % 20, om: k % 360, w: (k * 7) % 360, ma: (k * 13) % 360, ep: 2460000.5, per: 1000, H: 10, d: null }));
const data = { meta: { source: "SYNTHETIC", built: "", asteroids: N, comets: 0, query: "" }, bodies };
const measure = async (withData) => {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && !/WebGL|GPU stall|swiftshader|bodies\.json/i.test(m.text()) && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  if (withData) await p.route("**/smallbodies/bodies.json", (r) => r.fulfill({ json: data }));
  await p.goto(`${BASE}/explore?object=solar-system`, { waitUntil: "networkidle" });
  await sleep(2500);
  const ctl = p.getByRole("region", { name: "Simulation controls" });
  await ctl.getByRole("button", { name: "100×" }).click();
  const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  return { p, ctl, fps, errs };
};
const base = await measure(false);
console.log(`baseline (no small bodies): ${base.fps.toFixed(1)} fps`);
await base.p.close();
const s = await measure(true);
console.log(`${N} synthetic bodies: ${s.fps.toFixed(1)} fps`);
ok(new RegExp(`${N.toLocaleString("en-US")} asteroids`).test(await s.ctl.innerText()), `UI reports ${N} asteroids`);
await s.ctl.getByRole("searchbox", { name: "Find an asteroid or comet by name" }).fill("19999 Synthetic");
await sleep(300);
const hit = s.ctl.getByRole("button", { name: /19999 Synthetic19999/ });
ok((await hit.count()) >= 1, "search finds a body among the 20,000");
await hit.first().click();
await sleep(500);
ok(/semi-major axis/.test(await s.ctl.innerText()), "selecting it opens its orbit card");
// Running vs paused, measured the robust way. A single sequential fps pair is dominated by software-rasteriser noise (about 1000 ms of
// every second is CPU rasterisation of the points, and it drifts between samples), so instead: alternate running and paused rounds in the
// SAME page and compare medians, and also compare the page's own JavaScript time per second (CDP ScriptDuration), which is what the
// position updates actually cost and which does not include rasterisation.
const cdp = await s.p.context().newCDPSession(s.p);
await cdp.send("Performance.enable");
const script = async () => (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "ScriptDuration").value;
const sample = async (ms) => {
  const s0 = await script();
  const fps = await s.p.evaluate((dur) => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < dur) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }), ms);
  const jsMsPerSec = ((await script()) - s0) * 1000 / (ms / 1000);
  return { fps, js: jsMsPerSec };
};
// The app changes its own render resolution while it runs (drei PerformanceMonitor: 1.5 <-> 1), and 1.5 has 2.25x the pixels of 1. A change in the
// middle of a running/paused comparison moves fps by tens of percent whatever the small bodies do (seen on the user's machine: 60 fps at 1280 px wide,
// 42 fps at 1920 px wide). So wait until the canvas size has been stable for 6 s before measuring, and report the size per round. Nothing else changes:
// same rounds, bodies, speed, assertions and 20 % threshold.
const canvasW = () => s.p.evaluate(() => document.querySelector("canvas")?.width ?? 0);
{
  let w = await canvasW(), since = Date.now();
  for (let i = 0; i < 160 && Date.now() - since < 6000; i++) { await sleep(250); const n = await canvasW(); if (n !== w) { w = n; since = Date.now(); } }
  console.log(`render resolution settled: canvas ${w}px wide`);
}
const widths = [];
const median = (v) => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)];
// Eight rounds, ABBA order (running first in even rounds, paused first in odd ones) so that a slow drift of the machine (clock boost, thermal
// throttling, other programs) falls equally on both states instead of always on "paused", which used to be measured right after "running".
const ROUNDS = 8;
const run = [], idle = [];
// The button is labelled with the action it performs; click it only when the simulation is not already in the wanted state.
const press = async (name) => { const btn = s.ctl.getByRole("button", { name }); if (await btn.isVisible()) await btn.click(); };
const playing = async () => { await press(/Play simulation/); await sleep(300); return sample(1500); };
const paused = async () => { await press(/Pause simulation/); await sleep(500); /* lets one full slice cycle finish and settle */ return sample(1500); };
for (let r = 0; r < ROUNDS; r++) {
  let a, b;
  if (r % 2 === 0) { a = await playing(); b = await paused(); } else { b = await paused(); a = await playing(); }
  run.push(a); idle.push(b); widths.push(await canvasW());
  console.log(`round ${r + 1}${r % 2 ? " (paused first)" : ""}: running ${a.fps.toFixed(1)} fps, paused ${b.fps.toFixed(1)} fps, drop ${(100 * (1 - a.fps / b.fps)).toFixed(1)}%`);
}
// Evidence for any resolution change: the page's own log of the adaptive-resolution events (see universe/engine/UniverseScene.tsx).
{
  const info = await s.p.evaluate(() => ({ policy: window.__dprPolicy ?? null, log: window.__dprLog ?? [] }));
  if (!info.policy) console.log("WARNING: this page has no render-resolution policy marker: it runs code from before the 2.25x bounds (stale build, or the server was not restarted after `npm run build`).");
  else console.log(`render-resolution policy: ${info.policy}; events: ${info.log.map((e) => `${(e.t / 1000).toFixed(1)}s ${e.event}${e.fps !== undefined ? ` (fps ${e.fps}, refresh ${e.refresh})` : ""}`).join("; ")}`);
}
if (new Set(widths).size > 1) console.log(`NOTE: the render resolution changed during the rounds (canvas widths ${widths.join(", ")}); fps in those rounds is not comparable.`);
const runFps = median(run.map((x) => x.fps)), idleFps = median(idle.map((x) => x.fps));
const runJs = median(run.map((x) => x.js)), idleJs = median(idle.map((x) => x.js));
console.log(`running fps ${runFps.toFixed(1)} / paused fps ${idleFps.toFixed(1)} (medians of ${ROUNDS} ABBA-ordered rounds)`);
console.log(`page JavaScript ms per second: running ${runJs.toFixed(1)} / paused ${idleJs.toFixed(1)}`);
// The guarantee: once settled, the layer does no per-frame position work. JS time must clearly drop when paused.
ok(idleJs <= runJs * 0.8, `settled layer costs nothing: paused JS time ${idleJs.toFixed(1)} ms/s is well below running ${runJs.toFixed(1)} ms/s`);
ok(idleFps >= runFps * 0.9, `pausing does not make it slower (median paused ${idleFps.toFixed(1)} vs running ${runFps.toFixed(1)} fps)`);
// The drop from the baseline is software rasterisation of the points on the CPU (it is the same while paused), not position updates:
ok(runFps >= idleFps * 0.8, `position updates cost under 20% of the frame rate while running at 100x (${runFps.toFixed(1)} running vs ${idleFps.toFixed(1)} paused fps)`);
ok(s.errs.length === 0, `console errors ${JSON.stringify(s.errs.slice(0, 3))}`);
await b.close();
process.exit(fail ? 1 : 0);
