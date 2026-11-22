// Needs production server on :3111. Real-browser check of the Solar System clock controls.
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
  p.on("console", (m) => m.type() === "error" && !/WebGL|GPU stall|swiftshader/i.test(m.text()) && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`${BASE}/explore?object=earth`, { waitUntil: "networkidle" });
  const ctl = p.getByRole("region", { name: "Simulation controls" });
  // On a phone the controls show only the play/speed row until opened (so they do not cover the object panel): open the rest.
  { const more = ctl.getByRole("button", { name: /More controls/ }); if (await more.isVisible()) await more.click(); }
  await ctl.waitFor();
  const date = () => ctl.getByTestId("sim-date").innerText();
  const today = new Date().toISOString().slice(0, 10);
  await sleep(600);
  // The clock is already running at 10 days/s, so allow for page-load time: it must be within a few weeks of today, not 1970 or 1800.
  ok(Math.abs(new Date(await date()) - new Date(today)) < 60 * 86400000, `${name}: starts near today (${await date()})`);
  // pause, jump to a date
  await ctl.getByRole("button", { name: /Pause simulation/ }).click();
  await ctl.locator("#sim-date").fill("1969-07-20");
  await sleep(700);
  ok((await date()) === "1969-07-20", `${name}: date picker jumps to 1969-07-20 (${await date()})`);
  const txt = await ctl.innerText();
  ok(/real distance from the Sun/.test(txt) && /larger than true scale/.test(txt), `${name}: real-vs-drawn readout shows`);
  ok(/orbital speed (29|30)\.\d\d km\/s/.test(txt), `${name}: Earth orbital speed shown`);
  // reverse run
  await ctl.getByRole("button", { name: "Run time backwards" }).click();
  await ctl.getByRole("button", { name: /Play simulation/ }).click();
  await ctl.getByRole("button", { name: "100×" }).click();
  await sleep(1500);
  const rev = await date();
  ok(rev < "1969-07-20", `${name}: reverse moves earlier (${rev})`);
  // run into the 1800 limit
  await ctl.locator("#sim-date").fill("1800-01-10");
  await sleep(500);
  await sleep(2500);
  ok(await ctl.getByRole("status").filter({ hasText: "stopped at 1800-01-01" }).count() === 1, `${name}: stops at 1800-01-01 with a warning`);
  ok((await date()) === "1800-01-01", `${name}: date held at 1800-01-01 (${await date()})`);
  // forward away from limit
  await ctl.getByRole("button", { name: "Run time backwards" }).click();
  await ctl.getByRole("button", { name: /Play simulation/ }).click();
  await sleep(800);
  ok(await ctl.getByRole("status").count() === 0 && (await date()) > "1800-01-01", `${name}: forward leaves the limit (${await date()})`);
  // reset
  await ctl.getByRole("button", { name: /Pause simulation/ }).click();
  await ctl.getByRole("button", { name: "Reset to today's date" }).click();
  await sleep(600);
  ok((await date()) === today, `${name}: reset returns to today (${await date()})`);
  await p.goto(`${BASE}/explore?object=sun`, { waitUntil: "networkidle" });
  await p.getByRole("region", { name: "Simulation controls" }).getByRole("button", { name: /Pause simulation/ }).click();
  { const more = p.getByRole("region", { name: "Simulation controls" }).getByRole("button", { name: /More controls/ }); if (await more.isVisible()) await more.click(); } // phone: the readout is in the part that opens on request
  await sleep(600);
  const sunTxt = await p.getByRole("region", { name: "Simulation controls" }).innerText();
  ok(/Sun radii\) from the Solar System barycentre/.test(sunTxt), `${name}: Sun shows barycentre offset`);
  if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
  await p.addScriptTag({ content: axeSrc });
  const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  ok(ax.violations.length === 0, `${name}: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0 violations"}`);
  ok(errs.length === 0, `${name}: console errors ${JSON.stringify(errs.slice(0, 3))}`);
}
await b.close();
process.exit(fail ? 1 : 0);
