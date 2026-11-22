// Browser-side profile of the small-body layer at 100x (running vs paused). Needs the production server on :3111 (PORT=3111 npm start).
// Not a pass/fail test: prints evidence (CPU profile self-time, WebGL call counts/time/bytes, long tasks, CDP metrics, fps).
// Same SYNTHETIC 20,000-body file and viewport as tests/e2e/smallbody-stress.mjs.   Usage: node scripts/profile-smallbody.mjs [rounds]
import { createRequire } from "node:module";
import os from "node:os";
const { chromium } = createRequire(import.meta.url)("playwright");
import { warnIfStaleBuild } from "./stale-build.mjs";
const BASE = process.env.BASE ?? "http://localhost:3111";
await warnIfStaleBuild(BASE);
const N = Number(process.env.N ?? 20000);
const ROUNDS = Number(process.argv[2] ?? 3);
// --control: sample only the paused state, over and over. If the frame rate still jumps between fast and slow modes, the cause is not the simulation.
const CONTROL = process.argv.includes("--control");
// --only=<state>: sample only that state, over and over (states: paused, running, running-noupload, running-nowrite). Tells whether a state alone makes the page slow.
// --dpr=<n>: pin the app's render resolution (adds ?dpr=n; the adaptive PerformanceMonitor is then off). Without it the app moves between 1.5, 1 and 0.75 by itself.
const DPR = (process.argv.find((a) => a.startsWith("--dpr=")) ?? "").slice(6);
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7);
const ONLY_NAME = { paused: "paused", running: "running", "running-noupload": "running, upload skipped", "running-nowrite": "running, position write skipped" }[ONLY];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bodies = Array.from({ length: N }, (_, k) => ({ id: "S" + k, n: `${k + 1} Synthetic${k + 1}`, k: "a", a: 2 + (k % 100) / 40, e: 0.05 + (k % 30) / 100, i: k % 20, om: k % 360, w: (k * 7) % 360, ma: (k * 13) % 360, ep: 2460000.5, per: 1000, H: 10, d: null }));
const data = { meta: { source: "SYNTHETIC", built: "", asteroids: N, comets: 0, query: "" }, bodies };
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.addInitScript(() => {
  window.__sbDebug = { skipWrite: false, skipUpload: false, stats: { frames: 0, updated: 0, ranges: 0, floatsUploaded: 0, ms: 0, evals: 0, fallbacks: 0, iters: 0, open: 0, trigFree: 0 } };
  const S = (window.__gl = { calls: {}, ms: {}, bytes: 0, subCalls: 0, long: 0, longMs: 0 });
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) for (const fn of ["bufferSubData", "bufferData", "drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced", "readPixels", "flush", "finish"]) {
    const o = C.prototype[fn]; if (!o) continue;
    C.prototype[fn] = function (...a) {
      const t = performance.now(); const r = o.apply(this, a); const d = performance.now() - t;
      S.calls[fn] = (S.calls[fn] ?? 0) + 1; S.ms[fn] = (S.ms[fn] ?? 0) + d;
      // WebGL2 form bufferSubData(target, dstByteOffset, srcData, srcOffset, length): only `length` elements are copied, not the whole array.
      if (fn === "bufferSubData" && a[2]?.byteLength) S.bytes += a[4] !== undefined ? a[4] * (a[2].BYTES_PER_ELEMENT ?? 1) : a[2].byteLength;
      if (fn === "bufferData" && a[1]?.byteLength) S.bytes += a[1].byteLength;
      return r;
    };
  }
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { S.long++; S.longMs += e.duration; } }).observe({ entryTypes: ["longtask"] });
});
await p.route("**/smallbodies/bodies.json", (r) => r.fulfill({ json: data }));
await p.goto(`${BASE}/explore?object=solar-system${DPR ? `&dpr=${DPR}` : ""}`, { waitUntil: "networkidle" }).catch((err) => {
  console.error(`\nCannot reach ${BASE}. This script needs the production server running in ANOTHER terminal that stays open:\n  1) npm run build   (only if you changed code since the last build)\n  2) npm start       (wait for "Ready", it listens on :3111)\n  3) in a second terminal: node scripts/profile-smallbody.mjs ...\n(${String(err.message).split("\n")[0]})`);
  process.exit(2);
});
await sleep(2500);
const ctl = p.getByRole("region", { name: "Simulation controls" });
await ctl.getByRole("button", { name: "100×" }).click();
const cdp = await p.context().newCDPSession(p);
await cdp.send("Performance.enable"); await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
// Machine-level evidence, taken in this script's own process (not in the page): system-wide CPU busy % over each sample and the time of a fixed
// arithmetic loop right after it. If a slow sample comes with a slower loop or a fully busy system, the machine (power plan, thermal limit,
// another program) changed speed, not the page.
const cpuTimes = () => os.cpus().reduce((a, c) => ({ idle: a.idle + c.times.idle, all: a.all + c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq }), { idle: 0, all: 0 });
const calib = () => { const t = performance.now(); let x = 0; for (let i = 1; i < 6e6; i++) x += Math.sin(i) * 1e-9; return performance.now() - t + (x > 1e9 ? 1 : 0); };
const press = async (name) => { const btn = ctl.getByRole("button", { name }); if (await btn.isVisible()) await btn.click(); };
const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
const MS = 4000;
async function sample(label) {
  await p.evaluate(() => { const S = window.__gl; S.calls = {}; S.ms = {}; S.bytes = 0; S.long = 0; S.longMs = 0; });
  const m0 = await metrics();
  const c0 = cpuTimes();
  await cdp.send("Profiler.start");
  const fps = await p.evaluate((dur) => new Promise((res) => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const f = () => { n++; const t = performance.now(); worst = Math.max(worst, t - last); last = t; if (t - t0 < dur) requestAnimationFrame(f); else res({ fps: n / ((t - t0) / 1000), frames: n, worst }); }; requestAnimationFrame(f); }), MS);
  const { profile } = await cdp.send("Profiler.stop");
  const m1 = await metrics();
  const c1 = cpuTimes();
  const canvasW = await p.evaluate(() => document.querySelector("canvas")?.width ?? 0);
  const sysBusy = 100 * (1 - (c1.idle - c0.idle) / Math.max(c1.all - c0.all, 1));
  const cal = calib();
  const gl = await p.evaluate(() => JSON.parse(JSON.stringify(window.__gl)));
  // self time per function from the sampling profile
  const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { const n = byId.get(id); const key = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop().slice(0, 28)}:${n.callFrame.lineNumber}`; self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000); });
  const top = [...self.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
  const d = (k) => ((m1[k] - m0[k]) * 1000) / (MS / 1000);
  return { label, canvasW, sysBusy, cal, ...fps, js: d("ScriptDuration"), task: d("TaskDuration"), layout: d("LayoutDuration") + d("RecalcStyleDuration"), heapMB: (m1.JSHeapUsedSize - m0.JSHeapUsedSize) / 1e6, heapAbs: m1.JSHeapUsedSize / 1e6, nodes: m1.Nodes, limit: (await ctl.getByText(/The clock stopped/).count()) > 0, gl, top };
}
const VARIANTS = ONLY_NAME ? [ONLY_NAME] : CONTROL ? ["paused"] : ["paused", "running", "running, upload skipped", "running, position write skipped"];
const setVariant = async (v) => {
  await p.evaluate((v) => { window.__sbDebug.skipUpload = v === "running, upload skipped"; window.__sbDebug.skipWrite = v === "running, position write skipped"; }, v);
  // 100x for minutes reaches the clock's end date (2050) and the clock stops itself ("The clock stopped at ..."): go back to today first.
  await ctl.getByRole("button", { name: "Reset to today's date" }).click(); await sleep(300);
  if (v === "paused") { await press(/Pause simulation/); await sleep(700); } else { await press(/Play simulation/); await sleep(400); }
};
const out = [];
for (let r = 0; r < (CONTROL || ONLY_NAME ? ROUNDS * 4 : ROUNDS); r++) {
  const order = VARIANTS.map((_, i) => VARIANTS[(i + r) % VARIANTS.length]); // cyclic Latin square: every variant sees every position
  if (r % 2) order.reverse();
  for (const v of order) {
    await setVariant(v);
    await p.evaluate(() => { const t = window.__sbDebug.stats; for (const k in t) t[k] = 0; });
    const x = await sample(v); x.r = r + 1;
    x.sb = await p.evaluate(() => ({ ...window.__sbDebug.stats }));
    out.push(x);
    const g = x.gl, sb = x.sb, f = Math.max(sb.frames, 1);
    console.log(`round ${r + 1} ${v.padEnd(32)} fps ${x.fps.toFixed(1)} | canvas ${x.canvasW}px wide | system CPU busy ${x.sysBusy.toFixed(0)}%, fixed-loop ${x.cal.toFixed(0)} ms | JS heap ${x.heapAbs.toFixed(0)} MB, DOM nodes ${x.nodes}${x.limit ? ", CLOCK LIMIT REACHED" : ""} | JS ${x.js.toFixed(0)} ms/s task ${x.task.toFixed(0)} | long tasks ${g.long} | small-body useFrame ${(sb.ms / f).toFixed(2)} ms/frame, ${(sb.updated / f).toFixed(0)} bodies/frame, ${(sb.ranges / f).toFixed(2)} ranges/frame, ${(sb.floatsUploaded * 4 / f / 1024).toFixed(0)} KB/frame requested | kepler cold-start fallbacks ${sb.fallbacks}/${sb.evals} evals (${(100 * sb.trigFree / Math.max(sb.evals, 1)).toFixed(0)}% trig-free), ${(sb.iters / Math.max(sb.evals, 1)).toFixed(2)} Newton its/eval`);
    console.log(`     GL: bufferSubData ${(g.calls.bufferSubData ?? 0) / (MS / 1000) | 0}/s ${((g.ms.bufferSubData ?? 0) / (MS / 1000)).toFixed(2)} ms/s, ${(g.bytes / (MS / 1000) / 1024).toFixed(0)} KB/s actually copied | draw calls ${((g.calls.drawElements ?? 0) + (g.calls.drawArrays ?? 0)) / (MS / 1000) | 0}/s | top self: ` + x.top.slice(0, 4).map(([k, t]) => `${k.split(" ")[0]} ${t.toFixed(0)}`).join(", "));
  }
}
{
  const info = await p.evaluate(() => ({ policy: window.__dprPolicy ?? null, log: window.__dprLog ?? [] }));
  console.log(info.policy ? `render-resolution policy: ${info.policy}; events: ${info.log.map((e) => `${(e.t / 1000).toFixed(1)}s ${e.event}${e.fps !== undefined ? ` (fps ${e.fps}, refresh ${e.refresh})` : ""}`).join("; ")}` : "WARNING: no render-resolution policy marker: this page runs code from before the 2.25x bounds.");
}
const stat = (a) => { const m = a.reduce((x, y) => x + y) / a.length; return { m, sd: Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(a.length - 1, 1)) }; };
console.log("\nsummary (fps per round; drop is paired within each round against that round's paused sample)");
for (const v of VARIANTS) {
  const rows = out.filter((o) => o.label === v);
  const fp = stat(rows.map((o) => o.fps));
  const drops = rows.map((o) => { const q = out.find((z) => z.r === o.r && z.label === "paused"); return q ? 100 * (1 - o.fps / q.fps) : NaN; }).filter(Number.isFinite);
  const d = drops.length ? stat(drops) : { m: NaN, sd: NaN };
  const med = [...rows.map((o) => o.fps)].sort((a, b) => a - b)[Math.floor(rows.length / 2)];
  console.log(`${v.padEnd(32)} fps ${rows.map((o) => o.fps.toFixed(1)).join(", ")}  mean ${fp.m.toFixed(1)} median ${med.toFixed(1)} sd ${fp.sd.toFixed(1)}${drops.length ? `  drop vs paused: mean ${d.m.toFixed(1)}% sd ${d.sd.toFixed(1)}` : "  (no paused samples in this run: compare medians across runs)"}`);
}
await b.close();
