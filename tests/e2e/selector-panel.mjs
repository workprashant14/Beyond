// Object selector row vs. info panel: the panel must never cover the chips, X must only hide the panel,
// and Solar System <-> Milky Way transitions must leave no stale overlay. Needs the production server (see scripts/run-e2e.mjs).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE ?? "http://localhost:3111";
const SIZES = [[1920, 1080], [1695, 879], [1366, 768], [1024, 768], [768, 1024], [390, 844]];
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
let failed = 0;
let total = 0;
const check = (name, ok, got) => { total++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (got ${got})`}`); if (!ok) failed++; };

const search = (pg) => decodeURIComponent(new URL(pg.url()).search);
const panelTitle = (pg) => pg.locator("aside[aria-label='Object information'] h2").first().textContent({ timeout: 1500 }).catch(() => null);
const chip = (pg, name) => pg.getByRole("navigation", { name: "Objects in view" }).getByRole("link", { name, exact: true });

/** True when the real topmost element at the centre of the (scrolled-into-view) locator is the locator itself. */
async function hitTestable(pg, loc) {
  await loc.evaluate((el) => el.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" }));
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.left < 0 || r.right > innerWidth) return `off-screen ${Math.round(r.left)}..${Math.round(r.right)}`;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top && (el === top || el.contains(top)) ? true : `covered by ${top?.tagName}.${String(top?.className).slice(0, 40)}`;
  });
}

async function waitPanel(pg, name) {
  for (let i = 0; i < 20; i++) { if ((await panelTitle(pg)) === name) return true; await pg.waitForTimeout(150); }
  return false;
}

for (const [w, h] of SIZES) {
  const tag = `${w}x${h}`;
  const pg = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  pg.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  pg.on("pageerror", (e) => errors.push(String(e)));
  await pg.goto(`${BASE}/explore?object=io`, { waitUntil: "load" });
  await pg.waitForSelector("canvas", { timeout: 20000 });
  await pg.waitForTimeout(1500);

  check(`${tag}: Io panel is open`, await waitPanel(pg, "Io"), await panelTitle(pg));

  // Geometry: the panel starts below the bottom edge of the selector row (desktop/tablet) or is a bottom sheet (phone).
  const g = await pg.evaluate(() => {
    const n = document.querySelector("nav[aria-label='Objects in view']").getBoundingClientRect();
    const a = document.querySelector("aside[aria-label='Object information']").getBoundingClientRect();
    const overlap = !(a.right <= n.left || a.left >= n.right || a.bottom <= n.top || a.top >= n.bottom);
    return { overlap, navBottom: Math.round(n.bottom), panelTop: Math.round(a.top) };
  });
  check(`${tag}: panel does not overlap the selector row`, !g.overlap, JSON.stringify(g));

  // Every chip is hit-testable (nothing on top of it) with the panel open; click Titan, Uranus, Neptune in turn.
  for (const name of ["Titan", "Uranus", "Neptune"]) {
    check(`${tag}: ${name} chip is not covered (Io selected)`, (await hitTestable(pg, chip(pg, name))) === true, await hitTestable(pg, chip(pg, name)));
    await chip(pg, name).click();
    // router.push commits asynchronously: poll for the URL instead of reading it the instant after the click.
    for (let i = 0; i < 30 && !search(pg).includes(`object=${name.toLowerCase()}`); i++) await pg.waitForTimeout(100);
    check(`${tag}: click ${name} updates URL`, search(pg).includes(`object=${name.toLowerCase()}`), search(pg));
    check(`${tag}: panel shows ${name}`, await waitPanel(pg, name), await panelTitle(pg));
    check(`${tag}: ${name} chip highlighted`, (await chip(pg, name).getAttribute("aria-current")) === "true", "no aria-current");
  }
  const allChips = await pg.getByRole("navigation", { name: "Objects in view" }).getByRole("link").allTextContents();
  for (const need of ["← Milky Way", "Solar System", "Sun", "Mercury", "Venus", "Earth", "Moon", "Mars", "Jupiter", "Io", "Europa", "Ganymede", "Callisto", "Saturn", "Titan", "Uranus", "Neptune"]) {
    if (!allChips.map((t) => t.trim()).includes(need)) check(`${tag}: chip "${need}" present`, false, allChips.join(","));
  }
  check(`${tag}: all 17 selector chips still present`, allChips.length >= 17, allChips.length);
  const canvasesBefore = await pg.locator("canvas").count();

  // X hides only the panel.
  await pg.getByRole("button", { name: "Close panel" }).click();
  await pg.waitForTimeout(400);
  check(`${tag}: X hides the panel`, (await pg.locator("aside[aria-label='Object information']").count()) === 0, "panel still there");
  check(`${tag}: X keeps the Solar System selection in the URL`, search(pg).includes("object=neptune"), search(pg));
  check(`${tag}: X keeps the scene mounted`, (await pg.locator("canvas").count()) === canvasesBefore && canvasesBefore > 0, `${canvasesBefore} -> ${await pg.locator("canvas").count()}`);
  check(`${tag}: X keeps the selector row (Solar System controls too)`, (await chip(pg, "Titan").count()) === 1 && (await pg.getByRole("region", { name: "Simulation controls" }).count()) + (await pg.locator("section[aria-label='Simulation controls']").count()) > 0, "missing");
  check(`${tag}: Titan still clickable after X`, (await hitTestable(pg, chip(pg, "Titan"))) === true, await hitTestable(pg, chip(pg, "Titan")));

  // Selecting another object reopens the panel.
  await chip(pg, "Mars").click();
  check(`${tag}: selecting Mars after X reopens the panel`, await waitPanel(pg, "Mars"), await panelTitle(pg));
  // Re-selecting the same object after closing also reopens it.
  await pg.getByRole("button", { name: "Close panel" }).click();
  await pg.waitForTimeout(300);
  await chip(pg, "Mars").click();
  check(`${tag}: re-selecting the same object reopens the panel`, await waitPanel(pg, "Mars"), await panelTitle(pg));

  // Solar System -> Milky Way: no stale panel, navigation and scene reachable.
  await chip(pg, "← Milky Way").click();
  for (let i = 0; i < 30 && !search(pg).includes("object=milky-way"); i++) await pg.waitForTimeout(100);
  check(`${tag}: Milky Way URL`, search(pg).includes("object=milky-way"), search(pg));
  check(`${tag}: Milky Way panel replaces the Mars panel`, await waitPanel(pg, "Milky Way"), await panelTitle(pg));
  await pg.waitForTimeout(800);
  check(`${tag}: only one info panel on screen`, (await pg.locator("aside[aria-label='Object information']").count()) === 1, await pg.locator("aside[aria-label='Object information']").count());
  check(`${tag}: no Solar System selector left over`, (await chip(pg, "Neptune").count()) === 0, "Neptune chip still present");
  check(`${tag}: Back link reachable`, (await hitTestable(pg, pg.getByRole("link", { name: "Back to home" }))) === true, await hitTestable(pg, pg.getByRole("link", { name: "Back to home" })));
  check(`${tag}: 2D map link reachable`, (await hitTestable(pg, pg.getByRole("link", { name: "Open 2D map" }))) === true, await hitTestable(pg, pg.getByRole("link", { name: "Open 2D map" })));
  // The 3D canvas receives input: some point not under a panel/header hits the canvas, and dragging does not throw.
  const hit = await pg.evaluate(() => {
    for (let y = Math.round(innerHeight * 0.3); y < innerHeight * 0.9; y += 40)
      for (let x = 20; x < innerWidth; x += 40) {
        const el = document.elementFromPoint(x, y);
        if (el && el.tagName === "CANVAS") return { x, y };
      }
    return null;
  });
  check(`${tag}: scene canvas is hit-testable (no invisible overlay)`, !!hit, "no canvas hit");
  if (hit) { await pg.mouse.move(hit.x, hit.y); await pg.mouse.down(); await pg.mouse.move(hit.x + 30, hit.y + 10, { steps: 4 }); await pg.mouse.up(); }

  // Milky Way -> Solar System via the panel's related link or the URL, then back: selector returns.
  await pg.goto(`${BASE}/explore?object=solar-system`, { waitUntil: "load" });
  await pg.waitForSelector("canvas", { timeout: 20000 });
  check(`${tag}: back in Solar System, Neptune chip reachable`, (await hitTestable(pg, chip(pg, "Neptune"))) === true, await hitTestable(pg, chip(pg, "Neptune")));
  check(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await pg.close();
}

console.log(`${total - failed}/${total} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
