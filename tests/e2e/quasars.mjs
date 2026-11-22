// Needs production server on :3111 and python3 with astropy. Builds a SYNTHETIC DR16Q-shaped FITS (tests/helpers/make_synthetic_dr16q.py) into a temp folder with the real pipeline (--limit-rows 3000, so the page says TEST BUILD) and serves it by request interception: nothing is written to public/.
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync as rf } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const dir = mkdtempSync(join(tmpdir(), "qtest-"));
const fitsPath = join(dir, "synthetic_dr16q.fits"), outDir = join(dir, "out");
// python3, python, or the Windows launcher `py -3`: the first that can import astropy and numpy
const PY = [["python3"], ["python"], ["py", "-3"]].find(([c, ...pre]) => { const t = spawnSync(c, [...pre, "-c", "import astropy, numpy"], { encoding: "utf8" }); return !t.error && t.status === 0; });
if (!PY) { console.log("FAIL no Python with astropy and numpy found (tried python3, python, py -3)"); process.exit(1); }
const run = (args) => spawnSync(PY[0], [...PY.slice(1), ...args], { encoding: "utf8" });
let r1 = run(["tests/helpers/make_synthetic_dr16q.py", fitsPath, "3000"]);
let r2 = r1.status === 0 ? run(["scripts/build_quasars_fits.py", "--fits", fitsPath, "--out", outDir, "--limit-rows", "3000"]) : r1;
if (r2.status !== 0) { console.log("FAIL could not build the synthetic quasar data: " + (r2.stderr || r2.stdout).split("\n").slice(-4).join(" ")); process.exit(1); }
const MIME = { ".json": "application/json", ".bin": "application/octet-stream" };
const b = await chromium.launch();
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 700 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  const errs = [], reqs = [], bad = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("request", (r) => reqs.push(r.url()));
  await p.route("**/quasars/**", (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/quasars\//, "");
    const f = join(outDir, rel);
    if (!existsSync(f)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: MIME[extname(f)] ?? "application/octet-stream", body: rf(f) });
  });
  p.on("response", (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
  await p.goto(`${BASE}/quasars`, { waitUntil: "load" });
  await p.getByText(/records from/).first().waitFor({ timeout: 20000 });
  let t = await p.locator("main").innerText();
  ok(/records from/.test(t) && /TEST BUILD/.test(t), `${name}: catalogue view loads and says it is a test build`);
  // the summary line can appear a moment before the list is painted: wait (up to 5 s) for the list, then still require exactly 50
  let rows = 0;
  for (let k = 0; k < 20; k++) { rows = await p.locator("main ul li button").count(); if (rows > 0) break; await p.waitForTimeout(250); }
  ok(rows === 50, `${name}: first page has 50 rows (got ${rows})`);
  const idx = reqs.filter((u) => /\/quasars\/index\//.test(u)).length, lst = reqs.filter((u) => /\/quasars\/lists\/z\//.test(u)).length;
  ok(lst === 1 && idx === 0 && !reqs.some((u) => /quasars\.json|\/detail\//.test(u)), `${name}: first page = ${lst} list file, ${idx} index chunks, no detail yet`);
  // z order high to low
  const zs = (await p.locator("main ul li button span.text-xs").allInnerTexts()).map((s) => Number(s.replace(/.*z = /, "")));
  ok(zs.every((z, i) => i === 0 || zs[i - 1] >= z), `${name}: redshift sorted high to low`);
  // open first record -> detail fetched lazily
  await p.locator("main ul li button").first().click();
  await p.waitForURL(/quasar=/);
  await p.getByText(/Full catalogue record/).click();
  await p.waitForSelector("table");
  t = await p.locator("main").innerText();
  ok(/SDSS_NAME/.test(t) && /PSFMAG/.test(t) && /Observed/i.test(t), `${name}: detail shows columns and Observed badge`);
  ok(reqs.some((u) => /\/detail\/\d{6}\.json/.test(u)), `${name}: detail file fetched only after opening`);
  // reload with the URL opens the same record
  const url = p.url(); await p.goto(url, { waitUntil: "load" });
  await p.locator("main ul li [aria-expanded=true], :text-matches('Full catalogue record')").first().waitFor({ timeout: 20000 }).catch(() => {});
  ok((await p.locator("main ul li [aria-expanded=true]").count()) + (await p.getByText(/Full catalogue record/).count()) >= 1, `${name}: direct link opens the record`);
  // cone search with bad input then valid input
  await p.getByLabel("RA (deg)").fill("500"); await p.getByLabel("Dec (deg)").fill("10"); await p.getByRole("button", { name: "Search around position" }).click();
  ok(/Enter RA 0 to/.test(await p.locator("main").innerText()), `${name}: invalid cone is refused with a message`);
  await p.getByLabel("RA (deg)").fill("120"); await p.getByLabel("Radius (deg)").fill("30"); await p.getByLabel("Dec (deg)").fill("20"); await p.getByRole("button", { name: "Search around position" }).click();
  await p.waitForFunction(() => /\d+ results?/.test(document.querySelector("main")?.innerText ?? ""));
  ok(/\d+ results?/.test(await p.locator("main").innerText()), `${name}: cone search lists results`);
  // designation search that is not a designation
  await p.getByLabel("Search quasars by designation").fill("hello"); await p.getByRole("button", { name: "Search", exact: true }).click();
  await p.waitForFunction(() => /not indexed/.test(document.querySelector("main")?.innerText ?? ""));
  ok(true, `${name}: free text is not guessed`);
  if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
  await p.addScriptTag({ content: axeSrc });
  const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  ok(ax.violations.length === 0, `${name}: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0 violations"}`);
  ok(errs.length === 0 && bad.length === 0, `${name}: console errors ${JSON.stringify(errs)}; failed requests ${JSON.stringify(bad)}`);
}
await b.close();
process.exit(fail ? 1 : 0);
