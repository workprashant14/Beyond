// Real-browser click-selection check. Needs a running production server: npm run build && PORT=3111 npm start
// Run: node tests/e2e/click-selection.mjs (set NODE_PATH to the global node_modules if playwright is not installed locally)   (uses the preinstalled playwright; software GL, so allow ~1 minute)
import { createRequire } from "node:module";
// require() honours NODE_PATH, so a globally installed playwright is found too (ES imports are not).
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE ?? "http://localhost:3111";
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const pg = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
pg.on("console", (m) => m.type() === "error" && errors.push(m.text()));
pg.on("pageerror", (e) => errors.push(String(e)));
const search = () => decodeURIComponent(new URL(pg.url()).search);
let failed = 0;
const check = (name, ok, got) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${ok ? "" : `(got ${got})`}`); if (!ok) failed++; };

// Solar System: the Sun sits at the centre of the first view.
await pg.goto(`${BASE}/explore?object=solar-system`); await pg.waitForTimeout(5000);
await pg.mouse.click(640, 400); await pg.waitForTimeout(1200);
check("solar system: click on the Sun selects it", search() === "?object=sun", search());

// Sky Atlas: the selected object is centred; clear the selection, click the centre, expect the same object back.
for (const q of ["star=32349", "star=27989", "dso=NGC 224", "dso=NGC 1976", "dso=NGC 5139"]) {
  await pg.goto(`${BASE}/sky?${encodeURIComponent(q).replace("%3D", "=")}`); await pg.waitForTimeout(6000);
  await pg.getByRole("button", { name: /close|clear selection|deselect/i }).first().click(); await pg.waitForTimeout(800);
  await pg.mouse.click(640, 400); await pg.waitForTimeout(1500);
  check(`sky: click picks ${q}`, search() === `?${q}`, search());
}
check("no console errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
