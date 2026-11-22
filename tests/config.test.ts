import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Guards against an accidentally emptied / edited next.config.ts (this once silently removed all Tailwind CSS). */
test("next.config.ts keeps the settings the app depends on", () => {
  const src = readFileSync("next.config.ts", "utf8");
  assert.ok(src.length > 200, "next.config.ts looks truncated");
  assert.match(src, /cacheComponents:\s*true/);
  assert.match(src, /@tailwindcss\/turbopack/, "Tailwind turbopack loader rule is missing");
  assert.match(src, /images-assets\.nasa\.gov/);
});

test("globals.css still pulls in Tailwind", () => {
  assert.match(readFileSync("app/globals.css", "utf8"), /@import\s+"tailwindcss"/);
});

test("security headers are configured", () => {
  const src = readFileSync("next.config.ts", "utf8");
  for (const h of ["X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy"]) assert.ok(src.includes(h), h);
});

test("permissions policy allows geolocation for this site only (night-sky mode) and still blocks camera and microphone", () => {
  const src = readFileSync("next.config.ts", "utf8");
  assert.ok(src.includes("geolocation=(self)"));
  assert.ok(src.includes("camera=()") && src.includes("microphone=()"));
});

test("roadmap table has no stale statuses: every increment I1 to I9 is marked done or partly done", () => {
  const src = readFileSync("ATLAS_ROADMAP.md", "utf8");
  for (let i = 1; i <= 9; i++) {
    const row = src.split("\n").find((l) => l.startsWith(`| I${i} |`));
    assert.ok(row, `row I${i} missing`);
    assert.match(row!, /done/i, `row I${i} still looks unfinished: ${row!.slice(0, 80)}`);
  }
  assert.ok(src.includes("## Remaining gaps"));
});
