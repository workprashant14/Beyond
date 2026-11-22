/**
 * Cross-platform helpers for tests that start other programs.
 * - runTsx: runs a TypeScript script with the project's own tsx through the CURRENT Node executable. No `npx` (on Windows it is
 *   npx.cmd, which spawnSync cannot start without a shell), no global tsx, no PATH lookup.
 * - findPython: the first interpreter that can import astropy and numpy: python3, python, or the Windows launcher `py -3`.
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export const root = join(__dirname, "..", "..");

/** Absolute path of the installed tsx CLI, taken from its own package.json "bin" entry. */
export function tsxCli(): string {
  const pkgPath = createRequire(join(root, "package.json")).resolve("tsx/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { bin: string | Record<string, string> };
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.tsx;
  return join(dirname(pkgPath), bin);
}

/**
 * Environment for a child whose output is compared as text. A parent with FORCE_COLOR set (npm, CI and some terminals do this,
 * and it reaches the child) makes Node colour numbers inside console.log with ANSI escapes, so "out 42" arrives as "out \x1b[33m42\x1b[39m".
 * FORCE_COLOR=0 switches colour off. NO_COLOR and NODE_DISABLE_COLORS are removed on purpose: Node prints a warning on stderr when
 * NO_COLOR is set together with FORCE_COLOR, which would pollute the stderr this helper hands back.
 */
export function plainOutputEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, FORCE_COLOR: "0" };
  delete env.NO_COLOR;
  delete env.NODE_DISABLE_COLORS;
  return env;
}

export function runTsx(args: string[], cwd: string = root): SpawnSyncReturns<string> {
  const r = spawnSync(process.execPath, [tsxCli(), ...args], { cwd, encoding: "utf8", env: plainOutputEnv() });
  // status null means the program could not even start: surface the real reason instead of a bare null
  if (r.error) throw new Error(`could not start ${process.execPath} ${tsxCli()}: ${r.error.message}`);
  return r;
}

export interface Python { cmd: string; pre: string[] }

/** Candidates in order; `py -3` is the Windows launcher, which exists even when `python` is only the Microsoft Store stub. */
const CANDIDATES: Python[] = [
  { cmd: "python3", pre: [] },
  { cmd: "python", pre: [] },
  { cmd: "py", pre: ["-3"] },
];

export function findPython(modules: string[] = ["astropy", "numpy"]): Python | undefined {
  return CANDIDATES.find((c) => {
    const r = spawnSync(c.cmd, [...c.pre, "-c", `import ${modules.join(", ")}`], { encoding: "utf8" });
    return !r.error && r.status === 0;
  });
}

export function runPython(py: Python, args: string[], cwd: string = root): SpawnSyncReturns<string> {
  return spawnSync(py.cmd, [...py.pre, ...args], { cwd, encoding: "utf8" });
}
