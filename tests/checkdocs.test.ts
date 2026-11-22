import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkDoc } from "../scripts/check-docs";

const scripts = { test: "x", "build:moons": "y" };
const has = (...ps: string[]) => (p: string) => ps.includes(p);

describe("docs consistency checker", () => {
  it("accepts real scripts and existing paths", () => {
    assert.deepEqual(checkDoc("a.md", "Run `npm run build:moons` and edit `utils/x.ts`.", scripts, has("utils/x.ts")), []);
  });
  it("reports a missing npm script and a missing path", () => {
    const r = checkDoc("a.md", "npm run nope; see `utils/gone.ts`", scripts, has());
    assert.equal(r.length, 2);
    assert.match(r[0], /npm run nope/);
    assert.match(r[1], /utils\/gone\.ts/);
  });
  it("ignores built-on-your-machine data, patterns and directories", () => {
    assert.deepEqual(checkDoc("a.md", "`public/quasars/index.json` `data/raw/x.csv` `utils/*.ts` `tests/e2e/`", scripts, has()), []);
  });
  it("planned files pass while absent and are flagged once they exist", () => {
    assert.deepEqual(checkDoc("a.md", "`utils/ephemeris.ts`", scripts, has()), []);
    assert.equal(checkDoc("a.md", "`utils/ephemeris.ts`", scripts, has("utils/ephemeris.ts")).length, 1);
  });
});
