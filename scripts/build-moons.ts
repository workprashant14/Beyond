/**
 * Builds public/solar/moons.json from data/raw/moons/satellites.csv (NASA/JPL satellite physical parameters via
 * devstronomy/nasa-data-scraper, MIT). Run: npm run build:moons
 * Nothing is invented: "?" and blank values become null, and a value keeps its stated uncertainty (or none).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseMoonCsv } from "../utils/moons";

const rows = parseMoonCsv(readFileSync("data/raw/moons/satellites.csv", "utf8"));
writeFileSync("public/solar/moons.json", JSON.stringify(rows));
const byPlanet: Record<string, number> = {};
for (const r of rows) byPlanet[r.p] = (byPlanet[r.p] ?? 0) + 1;
console.log(`moons: ${rows.length}`, byPlanet);
