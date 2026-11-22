import { fetchJson, LiveError } from "./http";
import { IMAGE_QUERY } from "./sources";
import type { LiveImage } from "./types";

const ENDPOINT = "https://images-api.nasa.gov/search";
const ASSET_HOST = "images-assets.nasa.gov";
const asString = (v: unknown, max = 200): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** Pure: pick up to `limit` safe, de-duplicated images from a NASA Image Library search payload. */
export function parseImages(json: unknown, limit = 4): LiveImage[] {
  const items = (json as { collection?: { items?: unknown } } | null)?.collection?.items;
  if (!Array.isArray(items)) throw new LiveError("parse", "unexpected image search shape");
  const seen = new Set<string>();
  const out: LiveImage[] = [];
  for (const item of items) {
    const it = item as { data?: unknown[]; links?: unknown[] };
    const d = (Array.isArray(it?.data) ? it.data[0] : null) as Record<string, unknown> | null;
    const link = (Array.isArray(it?.links) ? it.links : []).find(
      (l) => (l as { render?: string; rel?: string })?.render === "image" || (l as { rel?: string })?.rel === "preview",
    ) as { href?: unknown } | undefined;
    const id = asString(d?.nasa_id, 120);
    const title = asString(d?.title, 160);
    const href = asString(link?.href, 500);
    if (!d || !id || !title || !href || seen.has(id) || !/^[\w.\-]+$/.test(id) || d.media_type !== "image") continue;
    let u: URL;
    try {
      u = new URL(href);
    } catch {
      continue;
    }
    if (u.protocol !== "https:" || u.hostname !== ASSET_HOST) continue; // only NASA's own asset host
    seen.add(id);
    out.push({
      id,
      title,
      src: u.toString(),
      pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(id)}`,
      credit: [asString(d.photographer, 80) ?? asString(d.secondary_creator, 80), asString(d.center, 40)].filter(Boolean).join(" · ") || null,
      date: asString(d.date_created, 10),
    });
    if (out.length >= limit) break;
  }
  if (!out.length) throw new LiveError("not-found", "no images");
  return out;
}

export async function fetchImages(id: string, name: string): Promise<LiveImage[]> {
  const q = IMAGE_QUERY[id] ?? name;
  const url = `${ENDPOINT}?${new URLSearchParams({ q, media_type: "image", page_size: "12" })}`;
  const { json } = await fetchJson(url, { revalidate: 86_400 });
  return parseImages(json);
}
