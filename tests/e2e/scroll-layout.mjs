// Needs production server on :3111. Every route at five window sizes: content that is taller than the window can be scrolled to its end with the
// scrollbar, the mouse wheel and the keyboard; nothing sticks out sideways; floating panels fit inside the window and scroll on their own when
// their content is longer; no visible control is permanently out of reach. Set REPORT=1 to print one line per route and size.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.BASE ?? "http://localhost:3111";
const SIZES = [[1920, 1080], [1647, 882], [1366, 768], [768, 1024], [390, 844]];
const ROUTES = (process.env.ROUTES ?? "/,/explore,/explore?object=solar-system,/explore?object=earth,/explore?object=saturn,/map,/sky,/sky?star=32349,/compare,/distance,/exoplanets,/milky-way,/missions,/moons,/pulsars,/quasars,/search?q=mars,/tours").split(",");
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fail = 0, pass = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const report = [];

const probe = () => {
  const vw = innerWidth, vh = innerHeight;
  const se = document.scrollingElement;
  const clippedByAncestor = (el) => {
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const o = getComputedStyle(a);
      if (o.overflowX !== "visible" || o.overflowY !== "visible") return a;
    }
    return null;
  };
  const visible = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0 && !el.closest("[aria-hidden='true']") && !el.closest("canvas"); };
  const name = (e) => (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
  // 1. things sticking out of the window sideways (nobody clips them: no scroll container in between)
  const sideways = [];
  for (const e of document.body.querySelectorAll("*")) {
    if (!visible(e) || e.closest("svg") && e.tagName !== "svg") continue;
    const r = e.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && getComputedStyle(e).position !== "fixed" && !clippedByAncestor(e) && e.tagName !== "HTML") sideways.push(`${e.tagName}.${String(e.className).slice(0, 40)} "${name(e)}" right=${Math.round(r.right)}`);
  }
  // 2. floating panels
  const panels = [...document.querySelectorAll("aside, [role=dialog], [role=region], nav[aria-label]")].filter(visible).filter((e) => { const p = getComputedStyle(e).position; return p === "absolute" || p === "fixed" || p === "sticky"; });
  const panelIssues = [];
  for (const p of panels) {
    const r = p.getBoundingClientRect(), cs = getComputedStyle(p);
    if (p.closest("header")) continue;
    if (r.bottom > vh + 1 || r.top < -1 || r.right > vw + 1 || r.left < -1) panelIssues.push(`outside window: ${name(p)} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}] in ${vw}x${vh}`);
    if (p.scrollHeight > p.clientHeight + 1 && !/(auto|scroll)/.test(cs.overflowY)) {
      // a flex panel whose child list scrolls is fine: look for any scrolling descendant that holds the overflow
      const inner = [...p.querySelectorAll("*")].some((d) => /(auto|scroll)/.test(getComputedStyle(d).overflowY) && d.scrollHeight > d.clientHeight - 1);
      if (!inner) panelIssues.push(`content cut, panel cannot scroll: ${name(p)} (${p.scrollHeight} > ${p.clientHeight})`);
    }
  }
  // 3. controls out of reach: not in the window, not reachable by scrolling the page or their own container
  const unreachable = [];
  const controls = [...document.querySelectorAll("a[href], button, input, select, textarea, summary, [tabindex='0']")].filter(visible);
  for (const c of controls) {
    const r = c.getBoundingClientRect();
    if (r.bottom <= vh && r.top >= 0 && r.left >= 0 && r.right <= vw) continue;
    if (getComputedStyle(c).position === "fixed") { unreachable.push(`fixed control outside window: ${name(c)}`); continue; }
    c.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    const r2 = c.getBoundingClientRect();
    if (r2.bottom > vh + 1 || r2.top < -1 || r2.right > vw + 1 || r2.left < -1) unreachable.push(`${name(c)} [${Math.round(r2.left)},${Math.round(r2.top)},${Math.round(r2.right)},${Math.round(r2.bottom)}]`);
  }
  scrollTo({ top: 0, left: 0, behavior: "instant" });
  return { vw, vh, docH: se.scrollHeight, docW: se.scrollWidth, clientW: se.clientWidth, htmlOverflowY: getComputedStyle(document.documentElement).overflowY, bodyOverflowY: getComputedStyle(document.body).overflowY, sideways: sideways.slice(0, 5), hScroll: se.scrollWidth > se.clientWidth + 1, panelIssues, unreachable: unreachable.slice(0, 6), unreachableCount: unreachable.length };
};

for (const [w, h] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  for (const r of ROUTES) {
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(`${BASE}${r}`, { waitUntil: "load" });
    await p.waitForTimeout(r.startsWith("/explore") || r.startsWith("/sky") || r === "/map" ? 3000 : 900);
    const tag = `${r} @${w}x${h}`;
    const m = await p.evaluate(probe);
    const tall = m.docH > m.vh + 1;
    let scrolledTo = 0, wheel = false, key = false, endVisible = true;
    if (tall) {
      ok(!/hidden|clip/.test(m.htmlOverflowY) && !/hidden|clip/.test(m.bodyOverflowY), `${tag}: html/body vertical overflow not hidden (${m.htmlOverflowY}/${m.bodyOverflowY})`);
      await p.mouse.move(w / 2, h / 2);
      await p.mouse.wheel(0, 600);
      for (let t = 0; t < 8 && !wheel; t++) { await p.waitForTimeout(250); wheel = (await p.evaluate(() => scrollY)) > 0; }
      ok(wheel, `${tag}: mouse wheel scrolls the page`);
      await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await p.keyboard.press("End");
      await p.waitForTimeout(700);
      scrolledTo = await p.evaluate(() => scrollY);
      key = scrolledTo >= m.docH - m.vh - 2;
      ok(key, `${tag}: End key reaches the bottom (${Math.round(scrolledTo)} of ${m.docH - m.vh})`);
      endVisible = await p.evaluate(() => { const last = [...document.body.querySelectorAll("footer, main > *:last-child, body > * > *:last-child")].pop(); return !last || last.getBoundingClientRect().bottom <= innerHeight + 2; });
      ok(endVisible, `${tag}: last element ends inside the window at the bottom`);
    }
    ok(!m.hScroll, `${tag}: no horizontal page scroll (${m.docW} > ${m.clientW})`);
    ok(m.sideways.length === 0, `${tag}: nothing sticks out sideways ${JSON.stringify(m.sideways)}`);
    ok(m.panelIssues.length === 0, `${tag}: panels fit and scroll ${JSON.stringify(m.panelIssues)}`);
    ok(m.unreachableCount === 0, `${tag}: no control out of reach ${JSON.stringify(m.unreachable)}`);
    ok(errs.length === 0, `${tag}: page errors ${JSON.stringify(errs.slice(0, 2))}`);
    report.push({ route: r, size: `${w}x${h}`, docH: m.docH, tall, wheel: tall ? wheel : "n/a", end: tall ? key && endVisible : "n/a", hScroll: m.hScroll, sideways: m.sideways.length, panels: m.panelIssues.length, unreachable: m.unreachableCount });
    await p.close();
  }
  await ctx.close();
}
// The navigation: the "More" menu stays inside the window, and the phone menu scrolls on its own in a short window (a landscape phone).
{
  const nav = async (w, h, fn) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); await p.goto(`${BASE}/`, { waitUntil: "load" }); await p.waitForTimeout(800); await fn(p); await c.close(); };
  for (const [w, h] of [[1280, 720], [1366, 768], [1647, 882], [1920, 1080]]) {
    await nav(w, h, async (p) => {
      const barOk = await p.evaluate(() => { const r = [...document.querySelectorAll("header a, header button")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect().right); return Math.max(...r) <= innerWidth + 1; });
      ok(barOk, `navigation bar fits inside ${w}x${h}`);
      // A Windows window has a classic scrollbar of about 17 px that headless Chromium does not draw: the bar must still fit with that much less width.
      const free = await p.evaluate(() => { const row = document.querySelector("header").firstElementChild, cs = getComputedStyle(row); const inner = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); return inner - [...row.children].filter((e) => getComputedStyle(e).display !== "none").reduce((a, e) => a + e.getBoundingClientRect().width, 0); });
      ok(free >= 17, `navigation bar keeps room for a 17 px scrollbar at ${w}x${h} (${Math.round(free)} px spare)`);
      await p.getByRole("button", { name: /^More/ }).click();
      const menu = await p.evaluate(() => { const u = document.querySelector("header nav ul ul"); const r = u.getBoundingClientRect(); return { inside: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.left >= 0, links: u.querySelectorAll("a").length }; });
      ok(menu.inside && menu.links === 8, `More menu inside ${w}x${h} with ${menu.links} links`);
      await p.keyboard.press("Escape");
      ok((await p.locator("header nav ul ul").count()) === 0, `Escape closes the More menu at ${w}x${h}`);
    });
  }
  for (const [w, h] of [[390, 844], [768, 1024], [844, 390], [390, 400]]) {
    await nav(w, h, async (p) => {
      await p.getByRole("button", { name: "Open menu" }).click();
      const m = await p.evaluate(() => { const u = document.querySelector("header > ul"); const r = u.getBoundingClientRect(), cs = getComputedStyle(u); const last = u.querySelector("li:last-child a"); last.scrollIntoView({ block: "end", behavior: "instant" }); const lr = last.getBoundingClientRect(); return { bottom: r.bottom, vh: innerHeight, canScroll: u.scrollHeight > u.clientHeight + 1, oy: cs.overflowY, lastInside: lr.bottom <= innerHeight + 1 && lr.top >= 0, links: u.querySelectorAll("a").length }; });
      ok(m.bottom <= m.vh + 1, `phone menu fits inside ${w}x${h} (bottom ${Math.round(m.bottom)})`);
      ok(m.links === 15 && m.lastInside, `phone menu: all 15 links reachable at ${w}x${h}`);
      ok(!m.canScroll || /(auto|scroll)/.test(m.oy), `phone menu scrolls on its own when taller than the window at ${w}x${h}`);
    });
  }
}
// Two floating panels never cover each other: with an object selected, the simulation controls and the object panel do not overlap, and the
// object's title is the element on top where it is drawn (on a phone the object panel used to sit underneath the controls).
for (const [w, h] of SIZES) {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  await p.goto(`${BASE}/explore?object=saturn`, { waitUntil: "load" });
  await p.waitForTimeout(3000);
  const o = await p.evaluate(() => {
    const a = document.querySelector("section[aria-label='Simulation controls']").getBoundingClientRect();
    const i = document.querySelector("aside[aria-label='Object information']");
    const r = i.getBoundingClientRect(), h1 = i.querySelector("h1, h2");
    const t = h1.getBoundingClientRect();
    const top = document.elementFromPoint(t.left + Math.min(10, t.width / 2), t.top + t.height / 2);
    const area = Math.max(0, Math.min(a.right, r.right) - Math.max(a.left, r.left)) * Math.max(0, Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top));
    return { area: Math.round(area), titleOnTop: i.contains(top) };
  });
  ok(o.area === 0, `${w}x${h}: simulation controls and object panel do not overlap (${o.area} px²)`);
  ok(o.titleOnTop, `${w}x${h}: the object title is not covered by another panel`);
  await c.close();
}
// On a phone the rest of the controls open on request and then scroll inside their own panel.
{
  const c = await b.newContext({ viewport: { width: 390, height: 520 } }); // short enough that the opened controls are taller than the window
  const p = await c.newPage();
  await p.goto(`${BASE}/explore?object=solar-system`, { waitUntil: "load" });
  await p.waitForTimeout(2500);
  const btn = p.getByRole("button", { name: /More controls/ });
  ok((await btn.getAttribute("aria-expanded")) === "false", "phone: extra controls start collapsed");
  await btn.click();
  const m = await p.evaluate(() => { const s = document.querySelector("section[aria-label='Simulation controls']"); const r = s.getBoundingClientRect(); return { inside: r.bottom <= innerHeight + 1, scrolls: s.scrollHeight > s.clientHeight && /(auto|scroll)/.test(getComputedStyle(s).overflowY) }; });
  ok(m.inside && m.scrolls, `phone: opened controls fit inside the window and scroll on their own (${JSON.stringify(m)})`);
  await p.getByRole("button", { name: "Hide more controls" }).click();
  ok(await p.getByRole("button", { name: "Atmosphere glow" }).isHidden(), "phone: Hide collapses them again");
  await c.close();
}
if (process.env.REPORT) for (const x of report) console.log(JSON.stringify(x));
console.log(`${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
