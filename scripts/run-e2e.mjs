// Runs every browser test in tests/e2e against a production server and prints one summary.
//   npm run build && npm run test:e2e            (starts `next start` on :3111 itself if nothing is listening there)
//   npm run test:e2e -- sim-clock keyboard       (only scripts whose name contains one of the words)
// Each script prints PASS/FAIL lines and exits non-zero on any FAIL. A script that hangs is stopped after 10 minutes.
import { spawn, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import net from "node:net";
import { createRequire } from "node:module";
import { readFileSync, readdirSync as ls, statSync, existsSync } from "node:fs";

const PORT = 3111;
const BASE = process.env.BASE ?? `http://localhost:${PORT}`;
// Say which Playwright the scripts will use, so a mismatch with `npx playwright` or a global install is visible at once.
try {
  const pj = createRequire(import.meta.url).resolve("playwright/package.json");
  console.log(`playwright ${JSON.parse(readFileSync(pj, "utf8")).version} (${pj})`);
} catch { console.error("playwright is not installed for this project: run npm install, then npm run playwright:install"); process.exit(2); }
const only = process.argv.slice(2);
const files = readdirSync("tests/e2e").filter((f) => f.endsWith(".mjs") && (only.length === 0 || only.some((w) => f.includes(w)))).sort();
if (files.length === 0) { console.error("no e2e script matches"); process.exit(2); }

const listening = () => new Promise((res) => { const s = net.connect(PORT, "127.0.0.1"); s.on("connect", () => { s.destroy(); res(true); }); s.on("error", () => res(false)); });
// A stale server or a stale build makes the tests judge OLD code (the Navbar and map overflow failures were reported this way after the fix existed).
// Say so loudly instead of silently testing something else. These are warnings only: they never change the result.
const newest = (dir) => { let m = 0; for (const e of ls(dir, { withFileTypes: true })) { if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue; const f = `${dir}/${e.name}`; m = Math.max(m, e.isDirectory() ? newest(f) : statSync(f).mtimeMs); } return m; };
if (!existsSync(".next/BUILD_ID")) console.warn("WARNING: no production build (.next/BUILD_ID): run `npm run build` first.");
else {
  const built = statSync(".next/BUILD_ID").mtimeMs;
  const src = Math.max(...["app", "components", "universe", "utils", "data", "styles"].filter(existsSync).map(newest));
  if (src > built + 1000) console.warn("WARNING: source files are newer than the production build in .next: run `npm run build` first, or these tests run against old code.");
}
let server = null;
if (await listening()) console.warn(`NOTE: something is already listening on :${PORT}, so that server is used and NOT restarted. If it was started before your latest \`npm run build\`, stop it and run again (it serves the old build).`);
if (!(await listening())) {
  // The current Node runs next's own CLI: `npx` is npx.cmd on Windows and cannot be started by spawn without a shell.
  const win = process.platform === "win32";
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "ignore", detached: !win });
  for (let i = 0; i < 60 && !(await listening()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await listening())) { console.error("could not start the server (did you run npm run build?)"); process.exit(2); }
}

const rows = [];
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync("node", [`tests/e2e/${f}`], { env: { ...process.env, BASE }, encoding: "utf8", timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  const lines = (r.stdout ?? "").split("\n");
  const pass = lines.filter((l) => l.startsWith("PASS")).length;
  const failLines = lines.filter((l) => l.startsWith("FAIL"));
  const timedOut = r.error?.code === "ETIMEDOUT";
  const bad = failLines.length > 0 || r.status !== 0 || timedOut || pass === 0;
  rows.push({ f, pass, fail: failLines.length, secs: Math.round((Date.now() - t0) / 1000), bad, why: timedOut ? "timed out" : failLines.length === 0 && r.status !== 0 ? `exit ${r.status}: ${(r.stderr ?? "").trim().split("\n").pop()}` : pass === 0 ? "no PASS lines" : "" });
  console.log(`${bad ? "FAIL" : "ok  "} ${f.padEnd(28)} pass ${String(pass).padStart(3)} fail ${failLines.length} ${rows.at(-1).secs}s ${rows.at(-1).why}`);
  for (const l of failLines.slice(0, 5)) console.log("       " + l);
}
if (server) { try { if (process.platform === "win32") server.kill(); else process.kill(-server.pid); } catch {} }
const bad = rows.filter((r) => r.bad);
console.log(`\n${rows.length} scripts, ${rows.reduce((a, r) => a + r.pass, 0)} checks passed, ${bad.length} script(s) failing${bad.length ? ": " + bad.map((r) => r.f).join(", ") : ""}`);
process.exit(bad.length ? 1 : 0);
