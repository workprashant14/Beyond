/**
 * Run on a machine with internet access:   npm run check:live
 *
 * Calls every live source for representative objects and tells you, per source,
 * whether it worked, the upstream was unreachable, or the response shape no
 * longer matches our parser ("parse" = please report it).
 */
import { getLiveData } from "@/services/live";
import type { Section } from "@/services/live/types";

const IDS = ["earth", "mars", "moon", "sun", "ceres", "halley", "proxima-b", "trappist-1e", "andromeda"];

const show = (name: string, s: Section<unknown[]>) => {
  if (s.status === "ok") {
    console.log(`   ${name.padEnd(13)} OK   (${s.data.length} items) ← ${s.sources.map((x) => x.label).join(", ")}`);
    return "ok";
  }
  console.log(`   ${name.padEnd(13)} ${s.reason === "no-source" ? "--   (no live source for this object)" : `FAIL ${s.reason}${s.detail ? ` — ${s.detail}` : ""}`}`);
  return s.reason;
};

async function main(): Promise<number> {
  const tally: Record<string, number> = {};
  for (const id of IDS) {
    console.log(`\n${id}`);
    const r = await getLiveData(id);
    for (const [name, sec] of [["images", r.images], ["measurements", r.measurements]] as const) {
      const k = show(name, sec as Section<unknown[]>);
      tally[k] = (tally[k] ?? 0) + 1;
    }
    if (r.measurements.status === "ok") for (const row of r.measurements.data.slice(0, 4)) console.log(`      · ${row.label}: ${row.value}${row.note ? ` (${row.note})` : ""}`);
    if (r.images.status === "ok") console.log(`      · first image: ${r.images.data[0].title}`);
  }
  console.log("\nSummary:", tally);
  const network = (tally.network ?? 0) + (tally.timeout ?? 0);
  if (tally.parse) console.log("\n⚠ 'parse' failures mean an upstream response shape differs from what the parser expects. Please send this output to the developer.");
  if (network) console.log("\n⚠ network/timeout failures: this machine could not reach NASA/JPL (offline, firewall or proxy).");
  return tally.parse ? 2 : (tally.ok ?? 0) === 0 ? 1 : 0;
}

main().then((code) => process.exit(code));
