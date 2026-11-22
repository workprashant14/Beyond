import { createRequire } from "node:module";
// Needs production server on :3111. Keyboard only: Tab through each page; every stop has an accessible name and a visible focus indicator; no keyboard trap (focus leaves and returns to the start).
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.BASE ?? "http://localhost:3111";
const ROUTES = (process.env.ROUTES ?? "/,/explore,/sky,/sky?star=32349,/moons,/search?q=mars,/compare,/distance,/tours,/exoplanets").split(",");
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
for (const r of ROUTES) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await p.goto(`${BASE}${r}`, { waitUntil: "load" });
  await p.waitForTimeout(2000);
  const stops = [];
  let first = null, trapped = true;
  for (let i = 0; i < 400; i++) {
    await p.keyboard.press("Tab");
    await p.waitForTimeout(250); // focus styles transition in
    const s = await p.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return { body: true };
      const cs = getComputedStyle(e);
      const name = (e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") && document.getElementById(e.getAttribute("aria-labelledby"))?.textContent || e.textContent || e.getAttribute("title") || [...(e.labels ?? [])].map((l) => l.textContent).join(" ") || e.getAttribute("placeholder") || e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent || "").trim();
      const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      const visibleShadow = (el) => /rgba?\((?:\d+, ){2}\d+(?:, (?:0?\.\d*[1-9]\d*|1))?\)\s+\d+(?:\.\d+)?px/.test(getComputedStyle(el).boxShadow);
      // a control inside a wrapper that glows on focus-within (the search boxes) counts
      const ring = visibleShadow(e) || [e.parentElement, e.parentElement?.parentElement].some((x) => x && visibleShadow(x));
      const r = e.getBoundingClientRect();
      return { tag: e.tagName, name, visibleFocus: outline || ring, w: r.width, h: r.height, key: e.tagName + (e.id || "") + name.slice(0, 20) + Math.round(r.x) + "," + Math.round(r.y) };
    });
    if (s.body) { trapped = false; break; }
    if (first === null) first = s.key;
    else if (s.key === first) { trapped = false; break; }
    // A native date input has several Tab stops inside it (day, month, year, calendar button); the same element repeating is one control, and the browser draws the focus ring for its inner parts.
    if (stops.length && stops[stops.length - 1].key === s.key) continue;
    stops.push(s);
  }
  const noName = stops.filter((s) => !s.name && s.w > 0);
  const noFocus = stops.filter((s) => !s.visibleFocus && s.w > 0);
  ok(stops.length >= 3, `${r}: ${stops.length} keyboard stops`);
  ok(noName.length === 0, `${r}: every stop has a name ${JSON.stringify(noName.slice(0, 3).map((s) => s.tag))}`);
  ok(noFocus.length === 0, `${r}: every stop shows a focus indicator ${JSON.stringify(noFocus.slice(0, 3).map((s) => s.tag + ":" + s.name.slice(0, 20)))}`);
  ok(!trapped || stops.length < 400, `${r}: no keyboard trap (left the page or cycled within 400 Tab presses)`);
  await p.context().close();
}
await b.close();
process.exit(fail ? 1 : 0);
