/**
 * NASA image sources for optional photographic surface textures. Nothing here is bundled: `npm run build:textures`
 * downloads the files on your own computer into public/textures/ (this build sandbox cannot reach these hosts).
 * Every URL, title and credit line below was read from the image's own NASA page on 2026-11-12.
 *
 * Reuse basis: NASA's media guidelines say NASA content "generally are not subject to copyright in the United States",
 * ask that "NASA should be acknowledged as the source", and warn that third-party material is marked with its owner.
 * `rights: "verified"` = the page is on a NASA site and carries no third-party marking; `"unverified"` = the image page
 * points to a separate image-use policy that could not be read here, so the script skips it unless you pass --include-unverified
 * after reading that policy yourself.
 */
export interface TextureSource {
  /** Body id in the 3D scene (never a texture kind: moons must not borrow the Moon's photo). */
  id: string;
  title: string;
  /** Direct image file (JPEG). */
  url: string;
  /** Page the image was described on. */
  page: string;
  credit: string;
  /** What the image honestly is. */
  nature: string;
  rights: "verified" | "unverified";
  policyUrl?: string;
}

export const TEXTURE_SOURCES: TextureSource[] = [
  {
    id: "moon",
    title: "CGI Moon Kit, colour map (2025 version, 2,048 x 1,024)",
    url: "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg",
    page: "https://svs.gsfc.nasa.gov/4720",
    credit: "NASA's Scientific Visualization Studio, from Lunar Reconnaissance Orbiter camera and laser altimeter data",
    nature: "A visualisation built from LRO data and \"optimized for aesthetics, not science\" (NASA's words).",
    rights: "verified",
  },
  {
    id: "mercury",
    title: "Enhanced Color Mercury Map (PIA17386)",
    url: "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia17/pia17386/PIA17386.jpg",
    page: "https://science.nasa.gov/photojournal/enhanced-color-mercury-map/",
    credit: "NASA/Johns Hopkins University Applied Physics Laboratory/Carnegie Institution of Washington",
    nature: "False-colour enhancement from MESSENGER's wide-angle camera: \"These colors are not what Mercury would look like to the human eye.\"",
    rights: "unverified",
    policyUrl: "http://messenger.jhuapl.edu/the_mission/image_use.html",
  },
  {
    id: "jupiter",
    title: "Cassini's Best Maps of Jupiter, cylindrical map (PIA07782)",
    url: "https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA07782.jpg",
    page: "https://www.jpl.nasa.gov/images/pia07782-cassinis-best-maps-of-jupiter-cylindrical-map/",
    credit: "NASA/JPL/Space Science Institute",
    nature: "Cassini-derived cylindrical global map of Jupiter (built from Cassini images of 11-12 December 2000), covering 360° of longitude and ±90° planetocentric latitude. The polar regions are less clearly visible. Colours are close to those the human eye would see, but not strictly true colour.",
    rights: "verified",
  },
];

/** What scripts/build-textures.ts writes next to the images (public/textures/index.json). */
export interface TextureIndexEntry {
  id: string;
  file: string;
  width: number;
  height: number;
  title: string;
  credit: string;
  page: string;
  nature: string;
}
export interface TextureIndex {
  generated: string;
  textures: TextureIndexEntry[];
}

/** A texture is only wrapped on a sphere when it spans the whole globe: width twice the height. */
export const isFullGlobeAspect = (w: number, h: number): boolean => h > 0 && Math.abs(w / h - 2) < 0.02;
