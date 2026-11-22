import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findPython, runPython, runTsx, tsxCli } from "./helpers/runtime";

test("runTsx starts the project's own tsx through the current Node (no npx) and passes output and exit status through", () => {
  assert.match(tsxCli(), /tsx[\\/]dist[\\/]cli\.mjs$/);
  const dir = mkdtempSync(join(tmpdir(), "beyond-rt-"));
  writeFileSync(join(dir, "ok.ts"), 'const n: number = 2; console.log("out", n * 21); console.error("err");');
  writeFileSync(join(dir, "bad.ts"), "process.exit(3);");
  const ok = runTsx([join(dir, "ok.ts")], dir);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout.trim(), "out 42");
  assert.equal(ok.stderr.trim(), "err", "stderr is exactly what the script wrote: no colour codes, no Node warnings");
  assert.equal(runTsx([join(dir, "bad.ts")], dir).status, 3);
});

test("findPython returns an interpreter that really imports the modules, and undefined when a module does not exist", () => {
  const py = findPython(["sys", "json"]);
  assert.ok(py, "some Python 3 (python3, python or py -3) must exist to run the helper scripts");
  const r = runPython(py!, ["-c", "import sys; print(sys.version_info[0])"]);
  assert.equal(r.stdout.trim(), "3");
  assert.equal(findPython(["definitely_not_a_module_xyz"]), undefined);
});

test("output stays plain text even when the parent environment forces colour or sets NO_COLOR (what npm and some terminals do)", () => {
  const dir = mkdtempSync(join(tmpdir(), "beyond-rt-"));
  writeFileSync(join(dir, "n.ts"), 'console.log("out", 42);');
  const saved = { f: process.env.FORCE_COLOR, n: process.env.NO_COLOR };
  try {
    for (const [f, n] of [["1", undefined], ["3", undefined], ["1", "1"], [undefined, "1"]] as const) {
      if (f === undefined) delete process.env.FORCE_COLOR; else process.env.FORCE_COLOR = f;
      if (n === undefined) delete process.env.NO_COLOR; else process.env.NO_COLOR = n;
      const r = runTsx([join(dir, "n.ts")], dir);
      assert.equal(r.stdout.trim(), "out 42", `FORCE_COLOR=${f} NO_COLOR=${n}`);
      assert.equal(r.stderr, "", `no warning with FORCE_COLOR=${f} NO_COLOR=${n}: ${r.stderr}`);
    }
  } finally {
    if (saved.f === undefined) delete process.env.FORCE_COLOR; else process.env.FORCE_COLOR = saved.f;
    if (saved.n === undefined) delete process.env.NO_COLOR; else process.env.NO_COLOR = saved.n;
  }
});
