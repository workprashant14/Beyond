/**
 * Downloads NASA surface images listed in data/textureManifest.ts into public/textures/ and writes index.json.
 * Run on your own computer (needs internet): npm run build:textures
 *   --include-unverified   also fetch images whose separate image-use policy was not read (read it first)
 * Images that are not full-globe (2:1) maps are rejected, and images wider than 4,096 px are shrunk when sharp is available.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { TEXTURE_SOURCES, isFullGlobeAspect, type TextureIndex, type TextureIndexEntry } from "../data/textureManifest";

const OUT = "public/textures";

/**
 * JSON with every non-ASCII character written as a \uXXXX escape. The file then reads identically in any editor or terminal code page
 * (Windows PowerShell shows UTF-8 "—" as "â€”", and an ANSI re-save would really corrupt it), while JSON.parse returns the exact same text.
 */
export function toAsciiJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
const MAX_WIDTH = 4096;
const includeUnverified = process.argv.includes("--include-unverified");

/** JPEG size from its start-of-frame marker (fallback when sharp is not installed). */
export function jpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  let sharp: typeof import("sharp") | null = null;
  try { sharp = (await import("sharp")).default as unknown as typeof import("sharp"); } catch { /* optional */ }
  const textures: TextureIndexEntry[] = [];
  for (const s of TEXTURE_SOURCES) {
    if (s.rights !== "verified" && !includeUnverified) {
      console.log(`skip   ${s.id}: image-use policy not read (${s.policyUrl}). Read it, then use --include-unverified.`);
      continue;
    }
    try {
      const res = await fetch(s.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let buf: Buffer = Buffer.from(await res.arrayBuffer());
      const dims = jpegSize(buf);
      if (!dims) throw new Error("not a readable JPEG");
      if (!isFullGlobeAspect(dims.width, dims.height)) {
        console.log(`reject ${s.id}: ${dims.width}x${dims.height} is not a 2:1 full-globe map, so it would be stretched wrongly.`);
        continue;
      }
      let { width, height } = dims;
      if (width > MAX_WIDTH) {
        if (!sharp) { console.log(`reject ${s.id}: ${width} px wide and sharp is not installed to shrink it.`); continue; }
        buf = await (sharp as unknown as (b: Buffer) => { resize: (w: number, h: number) => { jpeg: (o: object) => { toBuffer: () => Promise<Buffer> } } })(buf).resize(MAX_WIDTH, MAX_WIDTH / 2).jpeg({ quality: 88 }).toBuffer();
        width = MAX_WIDTH; height = MAX_WIDTH / 2;
      }
      const file = `${s.id}.jpg`;
      writeFileSync(`${OUT}/${file}`, buf);
      textures.push({ id: s.id, file, width, height, title: s.title, credit: s.credit, page: s.page, nature: s.nature });
      console.log(`ok     ${s.id}: ${width}x${height}, ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      console.log(`failed ${s.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  const index: TextureIndex = { generated: new Date().toISOString(), textures };
  writeFileSync(`${OUT}/index.json`, toAsciiJson(index));
  console.log(`${textures.length} texture(s) written to ${OUT}/. Bodies without one keep the procedural artistic texture.`);
}
if (process.argv[1]?.endsWith("build-textures.ts")) void main();
