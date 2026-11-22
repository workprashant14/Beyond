# BEYOND — Explore What Lies Beyond

Interactive universe exploration platform (Next.js App Router, React, TypeScript, Tailwind, Three.js / React Three Fiber).

## Run
```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Status
- Phase 1 complete: foundation, cinematic homepage, nav, working search.
- Phase 2 complete: 3D universe (starfield, procedural galaxies, nebulae, black holes, star markers), click-to-select with highlight, smooth fly-to camera, hierarchical object loading, loading + WebGL fallback.
- Phase 3 complete: 3D solar system (Sun, 8 planets, Moon), orbits from NASA/JPL periods and J2000 longitudes, planet spin with axial tilt, Saturn rings, follow-camera, pause/speed (1-100 days per second), orbit and label toggles, reset to today, mass/rotation rows in the info panel.
- Phase 4 complete: 2D cosmic map at /map (3 levels: Universe, Milky Way, Solar System). Wheel / drag / pinch / keyboard zoom and pan, constant-size markers with label declutter, search, selection with fly-to, info panel, 2D <-> 3D links. Catalogued objects are solid markers; dust and spiral arms are illustrative (dashed, toggleable).
- Phase 5 complete: search polish (typo tolerance, category chips, /search results page) and live NASA/JPL data (NASA Image Library, JPL SBDB, NASA Exoplanet Archive, JPL Horizons) via a server-side proxy at /api/objects/[id]/live with caching, rate limiting and honest 'unavailable' states. Run `npm run check:live` on your own machine to verify the upstream APIs.
- Phase 6 complete: 5 new catalogued objects (Triangulum Galaxy, Large Magellanic Cloud, Eagle Nebula, Cygnus X-1, 51 Pegasi b) in catalogue, 3D scene, map and search; name-typo ranking fix; security headers; deploy guide below.
- Phase 7 complete: accessibility pass (axe-core: 0 violations on all 6 page states), visible keyboard focus, reduced-motion support, search options no longer nest buttons, Sirius and Pluto added.
- Phase 8 complete: lighter galaxy rendering (point count scales with size, tested budget), extra dpr fallback for slow GPUs, custom 404 page, social metadata, robots.txt, unused starter files removed. Keyboard users can pick 3D objects from the "Objects in view" bar.
- Phase 9 complete: galaxy labels no longer overlap their galaxies; full launch checklist in LAUNCH.md.
- Atlas increments I1 to I9 are delivered (sky atlas, deep-sky objects, favorites and filters, night sky, moons, small bodies, exoplanet script, missions, compact objects, picking performance). I6 needs `npm run build:exoplanets` on your machine; I8 is only partly done. See ATLAS_ROADMAP.md for the audit, the measured numbers and the table of remaining gaps (photographic textures, real orbits, 3D moons, spacecraft trajectories, full pulsar/quasar catalogues).
- Next: follow LAUNCH.md (real-device testing and deploy).

Map layouts for the universe and galaxy levels reuse the schematic 3D positions (not real coordinates). Solar positions are computed for today from JPL Keplerian elements (compressed semi-major axes).

Solar system model: real JPL Keplerian orbits (eccentric, tilted; planets via JPL's approximate-position method, valid 1800 to 2050 AD) plus the Moon, the four Galilean moons and Titan from JPL mean elements (their place on the orbit is illustrative). Semi-major axes, sizes and moon spacing are compressed and NOT to scale. Orbit data: `data/keplerElements.ts`; bodies: `data/solarSystem.ts`.

Simulation clock (`/explore`): the clock is TDB days since J2000 (`utils/simClock.ts`, `utils/timeScales.ts`); dates you see and type are UTC. Controls: play/pause, speeds 0.1 to 100 days per second, reverse, "Jump to date" (1800-01-01 to 2050-01-01), reset to today. It stops at the ends of the valid range with a warning. For the selected body the panel shows its real distance and radius and how much larger it is drawn than true scale. Saturn's ring shadow on the globe and the globe's shadow on the rings are computed in the shader (illustrative geometry; browser test `node tests/e2e/ring-shadows.mjs`). Atmosphere glow (Venus, Earth, Mars, giant planets, Titan) is artistic; browser test `node tests/e2e/atmospheres.mjs`. Comet tails are illustrative (direction away from the Sun is real; length and the 3 au limit are display choices) and appear only for comets in the built JPL file. Browser test: `node tests/e2e/comet-tails.mjs`. Schematic outer regions (Kuiper belt, scattered disc, Oort cloud) are random dots inside the radial extents given by NASA, labelled Artistic or Theoretical; they are not object catalogues. Browser test: `node tests/e2e/outer-regions.mjs`. The constellation panel shows each region's published area and size rank (`tests/e2e/constellation-area.mjs`). `npm run probe:satellites` describes the layout of JPL's satellite mean-elements page (for the future moon pipeline; it changes no data). Dwarf planets: Pluto, Ceres, Eris, Haumea, Makemake plus Vesta, Pallas and Hygiea get a marker, label and orbit once `npm run build:smallbodies` has produced the JPL file (until then the panel says Data unavailable). Browser test: `node tests/e2e/featured-bodies.mjs`. Browser test: `node tests/e2e/sim-clock.mjs` with the production server on port 3111. Phase 4 is still in progress, see `PHASE_4_SOLAR_SYSTEM_STATUS.md`.

Scene layout (`universe/objects/sceneConfig.ts`) is artistic and not to scale.

## Data honesty
All values live in `data/objects.json`. `null` renders as "Data unavailable". Starfields and galaxy visuals are artistic unless labelled.

## Deploy (Vercel, free tier)
1. Push the project to GitHub.
2. Import it on vercel.com (framework: Next.js, no env vars needed).
3. Deploy. `/api/objects/[id]/live` runs as a serverless function; NASA/JPL are called from the server only.
Optional: set `NASA_API_KEY` in Vercel project settings (server-only) for higher NASA rate limits.
Before going live run `npm run verify` (types, lint, 300 unit tests, docs check, build), then `npm run test:e2e` (browser tests), and `npm run check:live` on a machine with internet. See `TESTING.md` for what is and is not covered.
Note: the rate limiter and live-data cache are in-memory per server instance (fine for a small site; use a shared store such as Redis for heavy traffic).

## Performance notes
Homepage ships no three.js (about 228 KB gzip JS, framework included); the 3D engine loads only on /explore. Quality adapts to the device via PerformanceMonitor.


## Sky Atlas: deep-sky layer (I2)

`/sky` now also shows 12,094 deep-sky objects from OpenNGC (CC-BY-SA-4.0): galaxies, clusters, nebulae and more. Use the "Deep sky" menu to toggle groups, click a marker for details, or open `/sky?dso=NGC%20224`. Search understands `m31`, `ngc 224`, `ngc224`, names like "Crab Nebula". Marker symbols are artistic; catalogue values are observed.

## Favorites, recents and filters (I3)

Open "Browse & saved" in `/sky`: filter deep-sky objects by type, constellation and magnitude, or reopen favorites and recently viewed items. Saved data stays in your browser only.

## Night sky (I4)

In `/sky` choose "Night sky", enter your latitude/longitude (or allow browser location) to see the horizon, compass points and what is above it, with a ±12 h time slider. Approximate (no precession/refraction); planets and the Moon are not included yet.


## Time travel (I15)

In the Sky Atlas, open Night sky, set a place, then use "Go to a date" to see the horizon for any date from year −3000 to 3000 (universal time). Catalogue positions are precessed to that date and moved by each star's catalogue proper motion (straight-line model, shown as Estimated; constellation boundaries stay fixed, figure lines follow their stars). See ATLAS_ROADMAP.md.

## Asteroids and comets (I14)

Run `npm run build:smallbodies` on your own computer (needs internet). It fetches the 1,000 brightest numbered asteroids and 200 comets from the JPL Small-Body Database and writes `public/smallbodies/bodies.json` (a placeholder with no bodies ships by default). In the Solar System view an asterisk button then shows them as a point layer; search a name to see its orbit and a marker. See ATLAS_ROADMAP.md for the model's limits.

## Pulsar Atlas (I12)

`/pulsars` lists pulsars from the ATNF Pulsar Catalogue. On the [ATNF page](https://www.atnf.csiro.au/research/pulsar/psrcat/) tick Name, JName, RAJD, DecJD, P0, DM, DIST, choose "short csv without errors", save as `psrcat.csv`, then run `npm run build:pulsars -- --file psrcat.csv` on your computer. Until then the page says the data is not built.

## Quasar Atlas (I13)

`/quasars` lists a subset (100 to 50,000 rows) of a quasar catalogue that you export yourself as CSV (name, RA and Dec in decimal degrees, redshift, optional magnitude). Run `npm run build:quasars -- --file q.csv --source "SDSS DR16Q (Lyke et al. 2020)" --band i`; the script prints the columns it matched. Check the licence of the catalogue you use. The full 750,000-quasar catalogue is not supported (see ATLAS_ROADMAP.md).

## Optional NASA surface images (I11)

By default every world uses an artistic procedural texture. Run `npm run build:textures` once on your own computer (needs internet) to download NASA images into `public/textures/`; the Moon and Jupiter are fetched by default (Jupiter's rights were marked verified on your instruction after reading the JPL Image Use Policy), Mercury only with `-- --include-unverified` after you read its image-use policy (printed by the script). The credit and honest description appear in the panel only after that body's image has actually loaded; if the image is missing, broken or the index cannot be read, the procedural texture stays and no NASA credit is shown. `index.json` is written ASCII-escaped (`\u00b0` for °), so no editor or terminal can show it as mojibake. Delete the downloaded `.jpg` files and reset `public/textures/index.json` to `{"generated":"none","textures":[]}` to go back to procedural textures (an empty index ships so the browser does not log a 404).

## Star distance and luminosity

The star panel shows catalogued spectral type, distance, absolute magnitude and visible-light luminosity for 5,036 of the 5,044 stars, from AT-HYG (CC BY-SA 4.0). Distances are labelled Observed or Estimated by source and distance; luminosity is visible-light only, not total output. Rebuild with `npm run build:starphys`. Details and limits: ATLAS_ROADMAP.md.

## Moons Atlas (I5)

`/moons` lists 177 natural satellites with radius, density, GM, calculated mass, magnitude and albedo from the NASA/JPL satellite table. Values with "±" are measurements; values without are adopted by the source and marked Estimated. Rebuild data with `npm run build:moons`. Dwarf planets, asteroids, comets and the Kuiper/Oort regions are not included yet.

## Small bodies and regions (I5)

The catalogue now includes Eris, Haumea, Makemake, Vesta, comet 67P, the main asteroid belt, the Kuiper Belt and the Oort Cloud (labelled theoretical), each with values quoted from NASA Science pages and "Data unavailable" where the page gives none.

## Exoplanet Atlas (I6)

Run `npm run build:exoplanets` once on your own computer (needs internet) to download the NASA Exoplanet Archive table into `public/exoplanets/`; then `/exoplanets` lists the confirmed planets. Until then the page says the data is not built. `-- --file x.csv` uses a CSV you downloaded yourself.

Use `-- --out some/dir` for smoke tests: the dataset and SOURCES.md go there instead of `public/exoplanets`, so test data can never end up in the shipped dataset. `public/exoplanets/planets.json` is generated on your machine and is not part of the project archive; extracting a new archive therefore never overwrites your real dataset.

## Missions (I7)

Voyager 1 and 2, James Webb, Hubble, Parker Solar Probe, New Horizons and the ISS are in the catalogue (search "voyager", "webb", ...) with facts quoted from NASA Science. Dated figures are marked as such, and contradictions on NASA's own pages are flagged instead of hidden.

## Compact objects (I8, partly done)

Crab Pulsar, PSR J1748-2446ad and quasar 3C 273 are in the catalogue with NASA-quoted facts only; large pulsar and quasar catalogues are not included yet.

## Performance (I9)

Measured numbers and the reasoning for what was and was not optimised are in `ATLAS_ROADMAP.md` (Increment I9). Pointer picking uses an angular grid; tiled catalogues are not needed at the current 17,000 objects.

## Compare (I17)

`/compare?a=earth&b=jupiter` shows two catalogue objects side by side. Diameter and mass ratios appear only when both values are written in a precise form (e.g. `12,742 km`); otherwise the page says the ratio is unavailable. Browser test: `node tests/e2e/compare.mjs` with the production server on port 3111.

## Guided tours (I18)

`/tours` offers four short guided paths through the 3D universe (`data/tours.ts`). Add a tour by adding an entry there; every stop must be a catalogue object that exists in the 3D scene and the pointer text must contain no numbers (both enforced by `tests/tours.test.ts`). Browser test: `node tests/e2e/tours.mjs` with the production server on port 3111.

## Distance between bodies (I19)

`/distance` gives the separation of the Sun and the eight planets on any date from 1800 to 2050 (JPL approximate positions, Estimated). Browser test: `node tests/e2e/distance.mjs` with the production server on port 3111.

## Milky Way structure (I20)

`/milky-way` shows a clearly-labelled schematic and a list of sourced measurements (add or correct facts in `data/milkyWayStructure.ts`; each needs a quote and URL, enforced by `tests/milkyway.test.ts`). Browser test: `node tests/e2e/milky-way.mjs` with the production server on port 3111.

## Vendored source data (`data/raw/`)

`data/raw/` is part of the project and must be kept and shipped (about 4 MB): `moons/satellites.csv` (NASA/JPL satellite table, MIT, used by `npm test` and `npm run build:moons`), `athyg/hip-extract.csv` (star distances, `build:starphys`) and `openngc/` (deep-sky catalogue, `build:sky`). Each folder has a README or LICENSE naming its source. If `npm test` reports a missing file there, your copy is incomplete: re-extract the full archive. Do not exclude `data/raw/` when zipping or copying the project.

## Full quasar catalogue (SDSS DR16Q FITS)
`npm run build:quasars:fits -- --fits "..\Beyond Data\Quasars\DR16Q_v4.fits"` (needs `pip install astropy numpy`) converts the whole catalogue into small chunks under `public/quasars/` that the `/quasars` page loads on demand. The original FITS file is only read. Tested on a synthetic FITS file; run it on the real file and read the counts it prints. Details: BEYOND_DATA_DICTIONARY.md, BEYOND_DEPLOYMENT.md.

## Star data (distance, proper motion, radial velocity)
`npm run build:starphys` rebuilds `public/sky/starphys.json` from the bundled extract. To refresh from the full AT-HYG catalogue (about 2.5 million rows; it is streamed line by line, so memory use is small): `npm run build:starphys -- --file athyg.csv.gz --write-extract` (repeat `--file` if the download is in parts). Source codes and rules: BEYOND_DATA_DICTIONARY.md.

## Deep-sky distances
The deep-sky panel shows a redshift for galaxies and a parallax for clusters and nebulae when the catalogue has one, and a distance only where that is trustworthy: a large parallax (Observed) or a redshift of 0.01 or more (Estimated, Planck 2018 cosmology). Everything else says why no distance is shown. After editing `data/raw/openngc` run `npm run build:sky`. Rules and checks: BEYOND_DATA_DICTIONARY.md.

## Which data is actually built? `npm run data:status`
Lists every generated dataset in `public/` with its record count and a state: OK, MISSING, EMPTY, PLACEHOLDER (a stub file), TEST BUILD (quasars built with `--limit-rows`) or INVALID (unreadable, wrong shape, or output count different from input count). Anything not OK shows the command that builds it. `npm run data:status -- --strict` exits with an error if anything is not OK. It only reads files.
