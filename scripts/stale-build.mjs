// Shared by the scripts that are started directly with `node` (tests/e2e/smallbody-stress.mjs, scripts/profile-smallbody.mjs): the same
// stale-code warnings as scripts/run-e2e.mjs. `next start` serves whatever `.next` held when it started, so after unpacking new sources without
// `npm run build` (or after building without restarting the server) a run silently judges OLD code. Warnings only; the result is never changed.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

const newest = (dir) => {
  let m = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue;
    const f = `${dir}/${e.name}`;
    m = Math.max(m, e.isDirectory() ? newest(f) : statSync(f).mtimeMs);
  }
  return m;
};

export async function warnIfStaleBuild(base) {
  if (!existsSync(".next/BUILD_ID")) { console.warn("WARNING: no production build (.next/BUILD_ID): run `npm run build`, then `npm start`."); return; }
  const built = statSync(".next/BUILD_ID").mtimeMs;
  const src = Math.max(0, ...["app", "components", "universe", "utils", "data", "styles", "services"].filter(existsSync).map(newest));
  if (src > built + 1000) console.warn("WARNING: source files are newer than the production build in .next. This run tests OLD code. Stop the server (Ctrl+C), run `npm run build`, then `npm start`, then run this again.");
  try {
    const id = readFileSync(".next/BUILD_ID", "utf8").trim();
    const r = await fetch(`${base}/_next/static/${id}/_buildManifest.js`);
    if (r.status !== 200) console.warn(`WARNING: the server on ${base} is not serving the current build (${id}); it was started before the last \`npm run build\`. Stop it (Ctrl+C) and run \`npm start\` again.`);
  } catch { /* server not reachable: the script reports that itself */ }
}
