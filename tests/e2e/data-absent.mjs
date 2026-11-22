import { createRequire } from "node:module";
// Needs production server on :3111. Works whether or not the generated datasets are installed: the browser is made to see the datasets as ABSENT by answering
// every request for them with 404, exactly what a server without the files answers (request interception inside the browser; no file in the project is
// read, moved, renamed or written, and nothing needs cleaning up afterwards).
// Visits every route on desktop+mobile: no crash, no uncaught error, no failed request other than the missing data files, axe 0.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const ROUTES = ["/", "/explore", "/sky", "/map", "/milky-way", "/moons", "/missions", "/exoplanets", "/pulsars", "/quasars", "/compare", "/distance", "/tours", "/search?q=sirius"];
/** Generated datasets that are made absent. Textures stay real (they are images, not a data module). */
const ABSENT_DATA = ["**/exoplanets/**", "**/pulsars/**", "**/quasars/**", "**/smallbodies/**"];
const ABSENT = { "/exoplanets": /exoplanet/i, "/pulsars": /pulsar/i, "/quasars": /quasar/i };
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 700 }]]) {
  for (const r of ROUTES) {
    const ctx = await b.newContext({ viewport: vp });
    for (const pat of ABSENT_DATA) await ctx.route(pat, (route) => route.fulfill({ status: 404, contentType: "text/plain", body: "not found" }));
    const p = await ctx.newPage();
    const errs = [], bad = [];
    p.on("console", (m) => m.type() === "error" && !/WebGL|GPU stall|GL Driver|swiftshader|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
    p.on("pageerror", (e) => errs.push(String(e)));
    p.on("response", (x) => x.status() >= 400 && bad.push(`${x.status()} ${new URL(x.url()).pathname}`));
    const res = await p.goto(`${BASE}${r}`, { waitUntil: "load" });
    await p.waitForTimeout(2500);
    const text = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    ok(res.status() === 200 && text.length > 40, `${name} ${r}: 200 and has content (${text.length} chars)`);
    ok(!/Application error|Unhandled Runtime Error|something went wrong/i.test(text), `${name} ${r}: no error screen`);
    if (ABSENT[r]) ok(/not (been )?(built|available|found|installed)|no data|unavailable|build/i.test(text), `${name} ${r}: says the data is absent (${text.slice(0, 110)}…)`);
    ok(errs.length === 0, `${name} ${r}: console errors ${JSON.stringify(errs.slice(0, 2))}`);
    ok(bad.every((u) => /\/(quasars|exoplanets|pulsars|smallbodies|textures)\//.test(u)), `${name} ${r}: failed requests only for absent datasets ${JSON.stringify(bad)}`);
    if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${r}: no horizontal scroll`);
    await p.addScriptTag({ content: axeSrc });
    const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
    ok(ax.violations.length === 0, `${name} ${r}: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0"}`);
    await p.context().close();
  }
}
await b.close();
process.exit(fail ? 1 : 0);
