import { getObject } from "@/services/catalogue";
import type { DataSource } from "@/types/celestial";
import { cached } from "./cache";
import { LiveError } from "./http";
import { fetchImages } from "./nasaImages";
import { fetchSbdb } from "./jplSbdb";
import { fetchExoplanet } from "./exoplanets";
import { fetchHorizons } from "./horizons";
import { EXOPLANET_NAMES, HORIZONS_TARGET, SBDB_TARGET } from "./sources";
import type { LiveResponse, Section, Unavailable } from "./types";

const HOUR = 3_600_000;
const SRC = {
  images: { label: "NASA Image and Video Library", url: "https://images.nasa.gov/" },
  sbdb: { label: "JPL Small-Body Database", url: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html" },
  horizons: { label: "JPL Horizons System", url: "https://ssd.jpl.nasa.gov/horizons/" },
  exo: { label: "NASA Exoplanet Archive", url: "https://exoplanetarchive.ipac.caltech.edu/" },
} satisfies Record<string, DataSource>;

/** Run one upstream call; any failure becomes an `unavailable` section, never an exception. */
async function section<T>(sources: DataSource[], run: () => Promise<T>): Promise<Section<T>> {
  try {
    return { status: "ok", data: await run(), sources, fetchedAt: new Date().toISOString() };
  } catch (e) {
    if (e instanceof LiveError) return { status: "unavailable", reason: e.reason, detail: e.message };
    return { status: "unavailable", reason: "network", detail: "unexpected error" };
  }
}

// Successes are cached for a long time, failures only briefly so we recover quickly without hammering upstream.
const ttl = (hoursOk: number) => (v: Section<unknown>) => (v.status === "ok" ? hoursOk * HOUR : 30_000);

export async function getLiveData(id: string, now: Date = new Date()): Promise<LiveResponse> {
  const obj = getObject(id);
  if (!obj) throw new LiveError("not-found", "unknown object");

  const images = cached(`img:${id}`, ttl(24), () => section([SRC.images], () => fetchImages(id, obj.name)));

  const hz = HORIZONS_TARGET[id];
  const sbdb = SBDB_TARGET[id];
  const exo = EXOPLANET_NAMES[id];
  const none: Unavailable = { status: "unavailable", reason: "no-source" };

  const measurements: Promise<Section<import("./types").LiveRow[]>> = hz
    ? cached(`hz:${id}:${Math.floor(now.getTime() / HOUR)}`, ttl(1), () => section([SRC.horizons], () => fetchHorizons(hz, now)))
    : sbdb
      ? cached(`sbdb:${id}`, ttl(24), () => section([SRC.sbdb], () => fetchSbdb(sbdb)))
      : exo
        ? cached(`exo:${id}`, ttl(24), () => section([SRC.exo], () => fetchExoplanet(exo)))
        : Promise.resolve(none);

  const [i, m] = await Promise.all([images, measurements]);
  return { id, images: i, measurements: m };
}
