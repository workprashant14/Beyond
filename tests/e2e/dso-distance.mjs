// Needs production server on :3111. Checks the distance rows of the deep-sky panel.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const b = await chromium.launch();
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const cases = [
  ["NGC 2632", /Parallax\s*5\.371 mas/, /Distance\s*about 6\d\d light-years/, "Observed"],
  ["NGC 5139", /Parallax\s*0\.1368 mas/, /Data unavailable[\s\S]*too small/, null],
  ["IC 2", /Redshift \(z\)\s*0\.022860/, /Distance\s*about \d+ million light-years/, "Estimated"],
];
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 700 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  const errs = [], bad = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("response", (r) => r.status() >= 400 && !/api\//.test(r.url()) && bad.push(`${r.status()} ${r.url()}`));
  for (const [id, a, d, badge] of cases) {
    await p.goto(`${BASE}/sky?dso=${encodeURIComponent(id)}`, { waitUntil: "networkidle" });
    const panel = p.getByRole("complementary", { name: "Deep-sky object information" });
    await panel.waitFor();
    const t = await panel.innerText();
    ok(a.test(t), `${name} ${id}: ${a}`);
    ok(d.test(t), `${name} ${id}: ${d}`);
    if (badge) ok(new RegExp(badge, "i").test(t.split("Distance")[1] ?? ""), `${name} ${id}: distance badge ${badge}`);
    else ok(!/Estimated|Observed/i.test((t.split("Distance")[1] ?? "").split("\n").slice(0, 6).join(" ")), `${name} ${id}: no badge on a missing distance`);
  }
  if (name === "mobile") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile: no horizontal scroll");
  await p.addScriptTag({ content: axeSrc });
  const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] }));
  ok(ax.violations.length === 0, `${name}: axe ${ax.violations.map((v) => v.id + ":" + v.nodes.length).join(", ") || "0 violations"}`);
  ok(errs.length === 0 && bad.length === 0, `${name}: console errors ${JSON.stringify(errs.slice(0, 3))}; failed requests ${JSON.stringify(bad)}`);
}
await b.close();
process.exit(fail ? 1 : 0);
