import { createRequire } from "node:module";
// Needs production server on :3111. Black-hole panels show the computed event-horizon size, labelled Estimated, with a source link.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const EXPECT = { "sgr-a": /13 million km.*18 times the Sun's radius/s, m87: /130 au.*130 times the Earth-Sun distance/s, "cygnus-x1": /63 km.*smaller than the Earth/s };
for (const base of ["/explore", "/map"]) for (const [id, re] of Object.entries(EXPECT)) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && !/WebGL|GPU stall|GL Driver|swiftshader|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`${BASE}${base}?object=${id}`, { waitUntil: "load" });
  const sec = p.getByTestId("bh-horizon");
  await sec.waitFor({ timeout: 15000 });
  const t = (await sec.innerText()).replace(/\s+/g, " ");
  ok(re.test(t) && /ESTIMATED/i.test(t) && /spinning/i.test(t), `${base} ${id}: ${t.slice(0, 150)}`);
  ok(await sec.locator("a[href^=http]").count() === 1, `${base} ${id}: one mass-source link`);
  await p.addScriptTag({ content: axeSrc });
  const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  ok(ax.violations.length === 0, `${base} ${id}: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0"}`);
  ok(errs.length === 0, `${base} ${id}: console ${JSON.stringify(errs.slice(0, 2))}`);
  await p.context().close();
}
const p2 = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p2.goto(`${BASE}/explore?object=jupiter`, { waitUntil: "load" });
await p2.waitForTimeout(1500);
ok(await p2.getByTestId("bh-horizon").count() === 0, "non-black-hole object has no horizon section");
await b.close();
process.exit(fail ? 1 : 0);
