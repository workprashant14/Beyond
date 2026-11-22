import { test } from "node:test";
import assert from "node:assert/strict";
import { TEXTURE_SOURCES, isFullGlobeAspect } from "../data/textureManifest";
import { jpegSize } from "../scripts/build-textures";
import { SOLAR_BODIES } from "../data/solarSystem";

test("manifest: https NASA hosts, unique ids that are real bodies, credit and honest description present", () => {
  const ids = new Set<string>();
  for (const s of TEXTURE_SOURCES) {
    assert.ok(!ids.has(s.id), `duplicate ${s.id}`); ids.add(s.id);
    assert.ok(SOLAR_BODIES.some((b) => b.id === s.id), `${s.id} is not a body`);
    for (const u of [s.url, s.page]) assert.match(u, /^https:\/\//, u);
    assert.match(new URL(s.page).hostname, /(^|\.)nasa\.gov$/, s.page);
    assert.ok(s.credit.length > 5 && s.nature.length > 20 && s.title.length > 3);
    if (s.rights === "unverified") assert.ok(s.policyUrl, `${s.id} needs its policy link`);
  }
});

test("full-globe aspect check accepts 2:1 maps and rejects others", () => {
  assert.ok(isFullGlobeAspect(2048, 1024));
  assert.ok(isFullGlobeAspect(4096, 2048));
  assert.ok(!isFullGlobeAspect(3600, 1500));
  assert.ok(!isFullGlobeAspect(1000, 0));
});

test("jpegSize reads dimensions from a real JPEG and rejects non-JPEG data", async () => {
  const sharp = (await import("sharp")).default;
  const buf = await sharp({ create: { width: 64, height: 32, channels: 3, background: "#888" } }).jpeg().toBuffer();
  assert.deepEqual(jpegSize(buf), { width: 64, height: 32 });
  assert.equal(jpegSize(Buffer.from("not an image")), null);
});
