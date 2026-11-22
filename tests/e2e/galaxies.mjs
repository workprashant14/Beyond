// Galaxy rendering + interaction: every galaxy loads without shader/page errors, shows catalogue-based provenance in the panel,
// stays selectable by clicking the 3D scene (visual layers must not intercept raycasts), and M87* gets its host galaxy.
// Needs the production server (see scripts/run-e2e.mjs).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE ?? "http://localhost:3111";
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
let failed = 0, total = 0;
const check = (name, ok, got) => { total++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (got ${got})`}`); if (!ok) failed++; };
const search = (pg) => decodeURIComponent(new URL(pg.url()).search);
const sleep = (pg, ms) => pg.waitForTimeout(ms);

const GALAXIES = [
  ["milky-way", "Milky Way", /procedural/i, /barred spiral/i],
  ["andromeda", "Andromeda Galaxy", /Hubble type Sb/, /position angle 35/],
  ["triangulum", "Triangulum Galaxy", /Hubble type Sc/, /position angle 23/],
  ["lmc", "Large Magellanic Cloud", /Hubble type SBm/, /irregular/],
  ["m87", "M87*", /Host galaxy/, /Hubble type E/],
];

for (const [w, h] of [[1280, 800], [390, 844]]) {
  const tag = `${w}x${h}`;
  for (const [id, name, re1, re2] of GALAXIES) {
    const pg = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    pg.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    pg.on("pageerror", (e) => errors.push(String(e)));
    await pg.goto(`${BASE}/explore?object=${id}`, { waitUntil: "load" });
    await pg.waitForSelector("canvas", { timeout: 60000 });
    await sleep(pg, 2500);
    const panel = pg.locator("aside[aria-label='Object information']");
    check(`${tag}: ${id} panel shows ${name}`, ((await panel.locator("h2").first().textContent().catch(() => "")) ?? "").trim() === name, await panel.locator("h2").first().textContent().catch(() => null));
    const text = (await panel.textContent().catch(() => "")) ?? "";
    check(`${tag}: ${id} panel says artistic, not to scale`, /not to scale/i.test(text), text.slice(0, 80));
    check(`${tag}: ${id} panel labels the visual provenance (${re1})`, re1.test(text), text.slice(0, 200));
    check(`${tag}: ${id} panel names the catalogue data (${re2})`, re2.test(text), text.slice(0, 200));
    check(`${tag}: ${id} no shader/page errors`, errors.filter((e) => !/Failed to load resource|NASA|JPL/i.test(e)).length === 0, errors.slice(0, 2).join(" | "));
    check(`${tag}: ${id} canvas visible and sized`, await pg.locator("canvas").first().evaluate((c) => c.width > 100 && c.height > 100), "bad canvas");
    await pg.close();
  }
}

// Click-selection from the home view: visual layers must not block raycasting (default camera, 1280x800).
{
  const pg = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  pg.on("pageerror", (e) => errors.push(String(e)));
  await pg.goto(`${BASE}/explore`, { waitUntil: "load" });
  await pg.waitForSelector("canvas", { timeout: 60000 });
  await sleep(pg, 3500);
  for (const [id, x, y] of [["andromeda", 980, 255], ["lmc", 417, 545], ["m87", 293, 355]]) {
    await pg.mouse.click(x, y);
    for (let i = 0; i < 30 && !search(pg).includes(`object=${id}`); i++) await sleep(pg, 100);
    check(`click on ${id} selects it`, search(pg).includes(`object=${id}`), search(pg));
    await pg.goto(`${BASE}/explore`, { waitUntil: "load" });
    await pg.waitForSelector("canvas", { timeout: 60000 });
    await sleep(pg, 3000);
  }
  check("no page errors during click selection", errors.length === 0, errors.slice(0, 2).join(" | "));
  await pg.close();
}

// Search navigation reaches each galaxy.
{
  const pg = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await pg.goto(`${BASE}/explore`, { waitUntil: "load" });
  await pg.waitForSelector("canvas", { timeout: 60000 });
  for (const [q, id] of [["Andromeda", "andromeda"], ["Large Magellanic", "lmc"], ["Triangulum", "triangulum"]]) {
    const box = pg.getByRole("combobox").first().or(pg.locator("input[type='search'], input[placeholder*='Search']").first());
    await box.fill(q);
    await sleep(pg, 500);
    await pg.keyboard.press("Enter");
    for (let i = 0; i < 30 && !search(pg).includes(`object=${id}`); i++) await sleep(pg, 100);
    check(`search "${q}" navigates to ${id}`, search(pg).includes(`object=${id}`), search(pg));
  }
  await pg.close();
}

console.log(`${total - failed}/${total} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
