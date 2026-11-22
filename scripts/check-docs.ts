/**
 * Documentation consistency check: every `npm run <script>` named in a top-level *.md exists in package.json,
 * and every backticked repo path (utils/…, components/…, scripts/…, tests/…, public/…, data/…, universe/…, app/…) exists,
 * unless it is a generated/absent-by-design path listed in GENERATED. Exit 1 on any miss.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
/** Paths that are built on the user's machine or are patterns, not shipped files. */
const GENERATED = [/^public\/(exoplanets|pulsars|quasars)\//, /^data\/raw\//, /^public\/textures\/.+\.(jpg|png|webp)$/, /^public\/smallbodies\/.+/];

/** Files the docs describe as PLANNED (not built yet). Remove an entry when the file is built; the check then guards it. */
export const PLANNED = ["app/opengraph-image.png", "utils/ephemeris.ts", "components/BodyPanel.tsx", "scripts/build-satellite-elements.ts"];

export function checkDoc(name: string, text: string, scripts: Record<string, string>, exists: (p: string) => boolean): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/npm run ([a-z0-9:_-]+)/gi)) if (!(m[1] in scripts)) out.push(`${name}: npm run ${m[1]} does not exist`);
  for (const m of text.matchAll(/`((?:utils|components|scripts|tests|public|data|universe|app|hooks|types)\/[A-Za-z0-9_./\-[\]]+)`/g)) {
    const p = m[1].replace(/[.,;:]+$/, "");
    if (/[*[\]{}<>]/.test(p) || p.endsWith("/")) continue; // patterns and directories
    if (GENERATED.some((g) => g.test(p))) continue;
    if (PLANNED.includes(p)) { if (exists(p)) out.push(`${name}: ${p} now exists, remove it from PLANNED in scripts/check-docs.ts`); continue; }
    if (!exists(p)) out.push(`${name}: path ${p} does not exist`);
  }
  return out;
}

if (process.argv[1]?.endsWith("check-docs.ts")) {
  const problems: string[] = [];
  for (const f of readdirSync(root).filter((x) => x.endsWith(".md"))) {
    problems.push(...checkDoc(f, readFileSync(join(root, f), "utf8"), pkg.scripts, (p) => existsSync(join(root, p))));
  }
  console.log(problems.length ? problems.join("\n") : "docs: all npm scripts and repo paths named in the top-level .md files exist");
  process.exit(problems.length ? 1 : 0);
}
