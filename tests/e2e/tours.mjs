// Needs production server on :3111.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSrc = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE ?? "http://localhost:3111";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 375, height: 700 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`${BASE}/tours`, { waitUntil: "networkidle" });
  ok((await p.getByRole("link", { name: "Start tour" }).count()) === 4, `${name}: 4 tours listed`);
  await p.getByRole("link", { name: "Start tour" }).first().click();
  await p.waitForURL(/tour=solar-system&object=sun/);
  const bar = p.getByRole("region", { name: /Guided tour/ });
  ok(/stop 1 of 10/i.test(await bar.innerText()), `${name}: starts at stop 1 of 10`);
  await bar.getByRole("link", { name: "Next" }).click();
  await p.waitForURL(/object=mercury/);
  ok(/stop 2 of 10/i.test(await bar.innerText()) && /Mercury/.test(await bar.innerText()), `${name}: next goes to Mercury`);
  ok(/tour=solar-system/.test(p.url()), `${name}: tour param kept`);
  await bar.getByRole("link", { name: "Back" }).click();
  await p.waitForURL(/object=sun/);
  ok(true, `${name}: back works`);
  await p.addScriptTag({ content: axeSrc });
  const v = await p.evaluate(() => axe.run());
  ok(v.violations.length === 0, `${name}: axe ${v.violations.map((x) => x.id + ":" + x.nodes.length).join(",")}`);
  await bar.getByRole("link", { name: "Exit tour" }).click();
  await p.waitForURL((u) => !u.search.includes("tour="));
  ok((await p.getByRole("region", { name: /Guided tour/ }).count()) === 0, `${name}: exit removes bar`);
  await p.goto(`${BASE}/explore?tour=black-holes&object=m87`, { waitUntil: "networkidle" });
  ok(/Finish/.test(await p.getByRole("region", { name: /Guided tour/ }).innerText()), `${name}: last stop shows Finish`);
  ok(errs.length === 0, `${name}: no console errors ${errs.join("|").slice(0, 200)}`);
}
await b.close();
process.exit(fail ? 1 : 0);
