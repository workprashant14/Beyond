# BEYOND Universe Atlas – audit and roadmap

## 1. Audit of the codebase before this expansion (about 4,750 lines of TS/TSX)
- **Catalogue:** 28 hand-curated objects in `data/objects.json`, all with sources; unknown values are `null`. Good for honesty, but it cannot scale to thousands of objects, and search, scenes and the map all assume this small list.
- **Scenes:** `/explore` (3D, R3F) and `/map` (SVG) place each catalogue object by hand (`sceneConfig.ts`, `mapConfig.ts`). No coordinate system; positions are artistic.
- **Live data:** server proxy with cache, rate limit and honest "unavailable" states (NASA Images, JPL SBDB, Exoplanet Archive, Horizons). Reusable pattern; now also used for SIMBAD.
- **Missing for an atlas:** real sky coordinates, a bulk star/DSO data layer, constellations, per-datum provenance, a search index beyond 28 objects.

## 2. Data sources actually reachable from the build sandbox
| Source | Reachable | Use |
|---|---|---|
| npm / GitHub (open datasets) | yes | Hipparcos-numbered stars, IAU constellations, DSOs via `d3-celestial` (BSD-3) |
| NASA, JPL, ESA, SIMBAD, Gaia, Exoplanet Archive | no | only through code that runs on your machine or the deployed server (unverified here) |

Rule: nothing is typed in from memory. Data comes from a source file, a live query, or stays "Data unavailable".

## 3. Increments
| # | Scope | Status |
|---|---|---|
| I1 | Sky Atlas: all 88 IAU constellations (figures, boundaries, names), 5,044 Hipparcos stars (magnitude ≤ 6), star panel with IDs/position/magnitude/colour/estimated temperature, SIMBAD live lookup (spectral type, parallax distance), provenance badges, search by name/Bayer/HIP/HD, constellation browser | **done** |
| I2 | Deep-sky objects from the open DSO set (nebula types, clusters, galaxies) drawn in the sky view, with type filter and search | **done**: 12,094 OpenNGC objects in two tiers |
| I3 | Discovery UX: favourites, recently explored, filters (type, distance, constellation) | **done** for deep-sky objects (type, constellation, magnitude); no distance filter (no bundled distances) |
| I4 | Night-sky mode: your location + time → altitude/azimuth view (sidereal-time maths; needs location permission) | **done**, approximate (no precession or refraction, no planets/Moon) |
| I5 | Solar system: major moons, Pluto/Ceres/Eris/Haumea/Makemake, asteroids, comets, Kuiper Belt, Oort Cloud (labelled theoretical) | DONE (as catalogue entries, not 3D orbits): Moons Atlas + Eris, Haumea, Makemake, Vesta, 67P, asteroid belt, Kuiper Belt, Oort Cloud |
| I6 | Exoplanet systems: build script that downloads the NASA Exoplanet Archive table on your machine and writes data files | DONE (script + atlas page); the real download is untested here, data NOT bundled |
| I7 | Missions: Voyagers, JWST, Hubble, Parker Solar Probe, New Horizons, ISS | DONE as catalogue entries with NASA-quoted facts; no live trajectories drawn |
| I8 | Compact objects: black holes, neutron stars, pulsars, quasars | PARTLY DONE: 3 NASA-quoted entries added (Crab Pulsar, PSR J1748-2446ad, 3C 273); catalogue-scale lists NOT included |
| I9 | Performance at scale: spatial index, LOD, tiling | DONE for today's data: measured, spatial grid for picking; tiling deliberately NOT built (no data large enough to need it) |

## 4. Provenance classes (implemented in `types/provenance.ts`, shown as badges)
Observed · Estimated (method stated) · Artistic / conventional · Theoretical.

## 5. Performance design
- Stars: one `Points` object, size/alpha from magnitude in the shader, one draw call (instancing is not needed for point sprites).
- `frameloop="demand"`: the sky renders only when something changes, so an idle tab uses no GPU.
- Labels: chosen per frame, decluttered in screen space, capped at 40, more as you zoom in.
- Data: about 130 KB gzip, fetched on first need (sky page or first search focus), cached for the session.
- Picking: nearest-star in screen space on click only. Frustum culling is done by the GPU; spatial partitioning is deliberately deferred until the catalogue exceeds roughly 100k points, where it starts to pay for itself (5k points are faster brute-force).
- Gaia has about 1.8 billion sources and cannot be shipped or drawn whole; the plan is a bright subset plus tiles, built by a script you run.

## 6. Known limits of I1
- Magnitude ≤ 6 only (naked-eye stars). Distance and spectral type are now bundled (see "Star distance and luminosity" below); SIMBAD still adds a live lookup at runtime (not verified from this sandbox).
- Binary / variable / giant status is shown only when SIMBAD's object type says so.
- Constellation figure/boundary data and star positions are as packaged by d3-celestial; I verified them against known reference stars and checked that figure vertices lie on catalogued stars, but I did not compare against the original IAU/ESA files.
- The default view is the celestial sphere from the centre; the local-horizon view was added later as "Night sky" (I4).


## Increment I2 — Deep-sky objects (DONE)

- Source: OpenNGC (CC-BY-SA-4.0, Mattia Verga and contributors), vendored under `data/raw/openngc`. d3-celestial's DSO positions were off by 1-19 degrees for some objects, so they are NOT used.
- 12,094 objects in two tiers: bright (542, loaded with the Sky Atlas) and faint (11,552, ~250 KB gz, fetched only on request or when a URL/search points to one).
- Rendering: one `Points` layer with SDF shapes per type group, per-group toggles (Deep sky menu), magnitude LOD by field of view.
- Panel: type, constellation, RA/Dec, magnitude (band noted), size, Hubble type, radial velocity. No bundled distance: shown as "Data unavailable". Live SIMBAD enrichment via same-origin proxy (unverified from this sandbox).
- Search: names, Messier, NGC/IC numbers with or without space. Faint tier loads only for NGC/IC/PGC/UGC-style queries.
- Provenance: catalogue values Observed; symbols and constellation regions Artistic / conventional.
- Known limits: constellation of each object is computed by spherical containment (98.92% agreement with source labels, differences near boundaries); curated 3D-scene objects (e.g. M31) also appear as separate search hits.

## Increment I3 — Favorites, recents, filters (DONE)

- "Browse & saved" panel in /sky: Browse (deep-sky filter by type group, constellation, magnitude limit; brightest 100 shown), Favorites, Recent.
- Favorites and recents live only in this browser's localStorage (`beyond.sky.saved.v1`), parsed defensively; blocked storage falls back to memory. Nothing is sent anywhere.
- Star button in every panel toggles a favorite.
- Limits: no distance filter, because the bundled catalogues contain no distances (they are not invented). Filters cover deep-sky objects; faint tier must be enabled to browse the full 12,094. Star filters (spectral class, etc.) need data not bundled yet.

## Increment I4 — Night-sky mode (DONE)

- "Night sky" in /sky: enter latitude/longitude or use browser location (asked only on click; coordinates never leave the browser). Shows a dark ground, horizon line, N/E/S/W marks, looks toward the equator-facing side. Time slider ±12 h; selected object shows altitude and compass direction.
- Maths (`utils/skyTime.ts`): GMST polynomial (Meeus ch. 12) checked against Meeus examples 12.a and 13.b (Venus altitude/azimuth within 0.001 degrees).
- Label: Estimated. No precession (about 0.4 degrees), no refraction, time taken as UTC, no planets/Moon yet.
- Fix: the site's Permissions-Policy header blocked geolocation entirely (`geolocation=()`); now `geolocation=(self)`. Camera and microphone remain blocked.
- Note: the night-sky code (skyTime, SkyNight, Horizon, shell wiring) was already in the tree when I4 began, not written by me. I audited it (tests, independent reference values, browser run, axe) rather than trusting it.


## Increment I5 — Moons Atlas and small bodies (DONE, without 3D orbits)

- Source: NASA/JPL "Planetary Satellite Physical Parameters" via devstronomy/nasa-data-scraper (MIT; commit f311254c, vendored unchanged in `data/raw/moons`). `npm run build:moons` writes `public/solar/moons.json` (21 KB).
- `/moons`: 177 moons (Earth 1, Mars 2, Jupiter 67, Saturn 61, Uranus 27, Neptune 14, Pluto 5), filter by parent, search, sort, deep link `/moons?m=Titan`; also in the site search.
- Provenance rule: a value with a stated uncertainty is Observed; a value without one is adopted/assumed by the source and is labelled Estimated. Mass is calculated as GM / G (Estimated). "?" stays "Data unavailable".
- Small bodies and regions (added to `data/objects.json`, new categories "Asteroid" and "Region"): Eris, Haumea, Makemake, Vesta, comet 67P/Churyumov-Gerasimenko, main asteroid belt, Kuiper Belt, Oort Cloud. Every value is quoted from the NASA Science page named in its Sources list (fetched 2026-11-10; pages show "last updated" Sep to Oct 2026, Nov 2024 for 67P). Anything the page does not state stays "Data unavailable" (for example Vesta's diameter and orbit, Eris's mass, the asteroid belt's edges in AU).
- Oort Cloud is labelled THEORETICAL (its caveat replaces the default note in the panel); the Kuiper Belt and asteroid belt carry caveats that boundaries and populations are estimates. Pluto and Ceres were already present from earlier phases and were not changed.
- Live data: Eris, Haumea, Makemake, Vesta and 67P were added to the JPL SBDB lookup table (same server-side proxy as Halley/Ceres/Pluto). Not testable from this sandbox (JPL blocked); on failure the panel shows the honest "unavailable" state.
- Still NOT done: moons and small bodies are not drawn orbiting in 3D (no orbital elements in the bundled data), no comet/asteroid orbit database (needs a user-run JPL SBDB script, same approach as I6), and the Kuiper Belt/Oort Cloud have no 3D drawing. The NASA values were read from page text, not cross-checked against SBDB.


## Increment I6 — Exoplanet Atlas (DONE; data must be built on your machine)

- `npm run build:exoplanets` downloads the NASA Exoplanet Archive table `pscomppars` (confirmed planets, composite parameters) through the archive's TAP service as CSV and writes `public/exoplanets/planets.json` plus `SOURCES.md`. Column names and the TAP endpoint were checked against the archive's documentation. Options: `-- --file x.csv` uses a CSV you downloaded yourself.
- Safety: the file is replaced only after the CSV parsed cleanly with all expected columns and at least 1,000 planets; a changed archive schema is an error, not silent data loss. Empty cells stay null ("Data unavailable"), never zero.
- `/exoplanets`: search planet/host, filter by discovery method, sort (newest, nearest, largest radius, name), 100 rows at a time, expandable details with provenance badges, deep link `/exoplanets?planet=...`. Equilibrium temperature is labelled Estimated; light-years are converted from the archive's parsecs. Controversial planets are flagged.
- Until the script has been run, the page says plainly that the data has not been built. No exoplanet numbers are shipped.
- Verified here: the CSV parser and script pipeline with synthetic rows (tests plus a 1,500-row synthetic file, removed before packaging), the "too few rows keeps the old file" guard, the honest network failure message, and the whole page in Chrome with that synthetic file. NOT verified here: the live download (this sandbox cannot reach the archive) and the real archive's data.
- Not done: exoplanet systems are not drawn in 3D, and exoplanets are not yet in the site-wide search bar (the file is about 1 MB, so it is only loaded on /exoplanets).
- Accessibility fix found on the way: "Data unavailable" used a low-contrast grey (`text-muted/70`); it now uses the normal muted colour everywhere. Axe is 0 on exoplanet, moon, small-body, star and deep-sky panels.


## Increment I7 — Missions (DONE as catalogue entries)

- New category "Spacecraft": Voyager 1, Voyager 2, James Webb Space Telescope, Hubble Space Telescope, Parker Solar Probe, New Horizons, International Space Station. Each value is quoted from the NASA Science page listed in its Sources (fetched 2026-11-10; page dates: Voyager 1 Nov 2026, Voyager 2 Sep 2026, Webb Nov 2026, Hubble Sep 2026, Parker Mar 2026, New Horizons May 2026, ISS factsheet Dec 2025). The panel row "Discovery" reads "Launch" for these.
- Dated figures are labelled as NASA's stated values for that date, not live. Where NASA's own page contradicts itself (Voyager 2 interstellar entry 25 Nov vs 10 Dec 2018, Voyager 2 Saturn date, New Horizons Pluto distance, Parker closest approach, Voyager 1 instrument count) the contradiction is stated in the caveat or the number is omitted, never silently resolved. Missing facts (Webb mirror size, Hubble exact launch date, ISS speed/mass) are left out.
- Live: Voyager 1/2, New Horizons and Parker were added to the JPL Horizons table (ids -31, -32, -98, -96; distance from the Sun through the existing server proxy). Not testable from this sandbox; failures show the honest "unavailable" state. Hubble, Webb and the ISS have no live row (Earth-orbiting or L2; the ISS is not a Horizons target).
- Not done: no mission trajectories or positions are drawn in 3D or on the map, and the figures are snapshots until the live rows work on your network.


## Increment I8 — Compact objects (PARTLY DONE)

- Already in the catalogue from earlier phases: Sagittarius A*, M87 black hole, Cygnus X-1.
- Added, each value quoted from NASA Science (fetched 2026-11-10): Crab Pulsar (new category "Pulsar"), PSR J1748-2446ad (NASA's "fastest known pulsar", spin only), 3C 273 (new category "Quasar"; first quasar identified, Virgo, about 2.5 billion years of light travel time). Nothing the pages do not state is given (no Crab Pulsar spin period, no 3C 273 magnitude or redshift, no position or distance for PSR J1748-2446ad). Caveats explain this in each panel.
- Class facts used only as source text: neutron stars form from stars roughly 7 to 19 solar masses and hold up to about two solar masses in a city-sized sphere; quasars are galaxy cores powered by supermassive black holes. Not turned into entries of their own.
- NOT done: no catalogue-scale lists (ATNF pulsar catalogue of thousands of pulsars, quasar catalogues, stellar black-hole lists). Those need a verified, reachable source and a user-run build script like I6; the ATNF catalogue's file format was not verifiable from this sandbox, so no script was written for it rather than guessing the format. No 3D drawing of these objects.
- Test note: category searches ("black holes", "nebulae") now also return the quasar/pulsar as a weak hit after the exact matches, because their NASA text mentions black holes and the Crab Nebula; the tests assert the exact matches come first.


## Increment I9 — Performance at scale (DONE for current data; tiling deferred on purpose)

Measured first, then changed only what the measurements justified (desktop CPU in Node for pick timing; headless Chrome with software GL for the rest, which says nothing about a real Intel iGPU):

| What | Result |
|---|---|
| Idle cost on /sky | 0 draw calls in 3 s (demand rendering works; the label throttle does not keep the scene redrawing) |
| Pointer pick over all 17,138 objects (5,000 stars + 12,094 deep-sky) | 0.57 ms with the old linear scan; about 1 microsecond with the new grid (about 33 candidates) |
| Grid build | 8 ms once per catalogue (rebuilt when the faint tier is added) |
| Data on first need | about 130 KB gzip for stars, names, constellations and bright deep-sky objects; the faint deep-sky tier adds about 255 KB gzip only when requested |
| JS heap in the page | 13 MB with the bright tier, 19 MB with the faint tier (headless Chrome, before/after load) |
| Time to first draw (local server, software GL) | about 0.8 to 0.9 s |

- Changed: `utils/skyGrid.ts` is an angular grid (3-degree latitude bands, equal-width longitude cells, compressed arrays). Picking asks it for objects near the pointer's direction, then runs the same exact pixel test as before. A test compares it with brute force on 20,000 random points, including both poles and the longitude seam, and a budget test checks the real catalogue (worst case under 400 candidates). Real Chrome clicks on Sirius, M31 and Aldebaran select the right object, 10 px off still hits, a click 78 px away selects the genuinely nearest star.
- Already in place from earlier phases: one draw call each for stars and deep-sky objects (instanced points with GPU-side magnitude and group culling), magnitude/field-of-view LOD, progressive loading of the faint tier, throttled labels from a short named-object list, textures created lazily.
- NOT built, deliberately: tiled/streamed catalogues (HEALPix-style tiles, Gaia subsets). At 17,000 objects the whole catalogue is smaller than one photo, picking is microseconds and idle cost is zero, so tiling would add complexity with no benefit today. Revisit when a catalogue of roughly 100,000 or more objects is added: split by sky region into tiles of about 2,000 to 10,000 objects, load the tiles in and near the view, keep the grid per tile. Draw cost, not picking, will then be the limit and must be measured on a real iGPU.
- Not measured: real frame rate on an Intel iGPU, memory on a 16 GB machine under long sessions, mobile devices.


## Star distance and luminosity (DONE)

- Source: AT-HYG (HYGLike v3.2, CC BY-SA 4.0, attribution shown in the star panel), extract in `data/raw/athyg/`, built by `npm run build:starphys` into `public/sky/starphys.json` (same order as `stars.json`). 5,036 stars have a distance, 5,041 a spectral type (and, since Phase 3, proper motion, radial velocity and HR/Gliese numbers; see BEYOND_DATA_DICTIONARY.md); 3 stars were not found in the catalogue and show "Data unavailable".
- Each distance carries its source (Gaia DR3 "G3", Gaia DR2 "G2", Hipparcos "H", Gliese "GJ"). The table has no per-star errors, so the Observed/Estimated label is this site's policy: Gaia up to 1,000 pc Observed, up to 3,000 pc Estimated (rough); Hipparcos/Gliese up to 200 pc Observed, up to 1,000 pc Estimated; farther: not shown.
- Absolute magnitude M = m + 5 − 5·log10(d) and visible-light luminosity 10^((4.83 − M)/2.5) are computed in the browser, labelled Estimated. They ignore dust and are NOT total (bolometric) luminosity; hot and cool stars radiate much outside visible light.
- Why AT-HYG and not Hipparcos only: for 1,392 of these stars the Gaia-based distance differs from the Hipparcos-only one by more than 10 % (314 by more than 30 %, e.g. HIP 3504: 1,954.65 pc vs 215.52 pc). Whether the Gaia distances are geometric or photogeometric was not verified, so the panel says only "Gaia DR3".
- Not checked: the AT-HYG values were not compared against the original Gaia/Hipparcos catalogues.
- Incident: while doing this, a parallel pipeline (`scripts/build-starphys.ts`, `data/raw/athyg/`) already existed in the working tree and my write to `utils/starPhys.ts` overwrote that contributor's file. I rebuilt the needed type and helpers, removed my duplicate HYG-only pipeline, and kept the contributor's AT-HYG pipeline.

## Increment I10 — Real orbits (DONE for planets and six moons)

- Data: `data/keplerElements.ts`, transcribed on 2026-11-11 from JPL's "Approximate Positions of the Major Planets" Table 1 and "Planetary Satellite Mean Elements" (epoch 2000-01-01.5 TDB). The pages were read through a fetch tool that summarises text, so the numbers are also guarded by `tests/orbits.test.ts`: periods from both `a` and the longitude rate match known periods within 0.1 %, perihelion distances and inclinations match published values, Earth is 0.983 AU from the Sun at J2000 and about 1.017 AU in July.
- Maths: `utils/kepler.ts` (Kepler solver, orbital rotation, Laplace-plane to ecliptic conversion). The Laplace-plane node convention follows the page's wording ("measured from the node of the reference plane on the ICRF equator").
- Scene: planets and moons use these orbits in the 3D view, the 2D map and orbit lines. Sizes and semi-major axes are compressed (logarithmic for moons); eccentricity, tilt and orientation are the real values. Moon textures are the generic artistic Moon texture, not their real surfaces.
- Honest limits: planet positions carry JPL's stated errors (Mercury 15 arcsec, Jupiter 400, Saturn 600) and the date is UTC treated as TDB (about 69 s). JPL says its mean moon elements "are not intended for ephemeris computation", so where a moon sits on its orbit on a date is illustrative; node and apsis precession are not modelled, and the table's period is used as the mean-anomaly rate. Earth uses the Earth–Moon barycentre row. Not verified: moon-table column conventions beyond the page's own legend, and no comparison against Horizons (unreachable from this sandbox).

## Increment I11 — NASA surface textures (PIPELINE DONE; images are downloaded by you)

- Choice made with the user: NASA public-domain imagery only. NASA's guidelines say its content "generally are not subject to copyright in the United States", ask for NASA to be credited, and say third-party material is marked with its owner.
- `data/textureManifest.ts` lists each image with its URL, page, credit line, an honest description of what it is, and a rights flag. `scripts/build-textures.ts` (`npm run build:textures`) downloads the JPEGs, rejects anything that is not a 2:1 full-globe map (it would be stretched), shrinks images wider than 4,096 px when sharp is available, and writes `public/textures/index.json`. Items marked "unverified" (their image-use policy page could not be read from here) are skipped unless you pass `--include-unverified` after reading that policy.
- In the app: a body keyed by its own id (a moon never borrows the Moon's photo) swaps in the image when it exists; otherwise the procedural texture stays. The panel then shows the title, credit, what the image honestly is (the Moon one is "optimized for aesthetics, not science"; Mercury is false colour) and says orientation is not calibrated.
- Tested: manifest checks, aspect rule, JPEG header reader, the script run in this sandbox (fails gracefully with no network), and a browser run with a synthetic test image (Moon swapped, Io unchanged, credit shown only for the Moon). NOT tested: a real NASA download, real image appearance, memory on an iGPU (4,096 x 2,048 is about 43 MB per texture with mipmaps).
- Why not Earth/Mars: the Blue Marble page offered only video frames, and the Mars MOLA page is an elevation-colour globe view rather than a flat map; neither was usable without guessing.

## Increment I12 — Pulsar Atlas (PIPELINE DONE; data built by you)

- `/pulsars` lists pulsars with search, class filter (millisecond pulsar = period under 30 ms, a convention labelled as such) and sorting; the panel shows period, dispersion measure, distance and position with provenance badges, and the ATNF citation (Manchester, Hobbs, Teoh & Hobbs 2005). Unknown values show "Data unavailable".
- Units checked against the catalogue documentation: P0 in seconds, DM in cm⁻³ pc, DIST in kpc ("best estimate": measured parallax first, otherwise a DM-based model distance), RAJD/DecJD in degrees. The CSV does not say which distance kind each pulsar has, so distance is labelled Estimated with that note.
- Data flow: export "short csv without errors" from the ATNF web form (steps at the top of `scripts/build-pulsars.ts`), then `npm run build:pulsars -- --file psrcat.csv`. The script refuses files with under 1,000 rows and keeps the old data on failure.
- Tested: parser, filters and sorting on synthetic CSVs (invented names and numbers); the page in a browser with a synthetic 1,200-row file (list, deep link, filter, axe, no console errors) and in the "not built" state. NOT tested: a real ATNF export (the web form was unreachable from this sandbox), so the exact separator, header and "no value" marker of the real file are assumed from the documentation. The ATNF software is GPL; the page asks only for the citation above, and no data licence statement was found, so no catalogue data is bundled.
- Pulsars are not yet drawn in the Sky Atlas or found by the global search; that needs the real data first.

## Increment I13 — Quasar subset atlas (PIPELINE DONE; data built by you)

- Chosen with the user: a subset, not the full catalogue. `/quasars` lists name, redshift, optional magnitude and position, with search and sorting (highest/lowest redshift, brightest, name). Redshift and magnitude are labelled Observed as catalogued; no distance or light-travel time is derived, because that needs a cosmological model.
- Not verified here: the real DR16Q column names (the SDSS page named only Z; VizieR's column list was not readable) and any licence (SDSS page: none stated; VizieR page: none stated). So nothing is bundled, the parser matches a documented list of common names, prints which columns it used, accepts `--name-col/--ra-col/--dec-col/--z-col/--mag-col`, rejects sexagesimal positions (RA/Dec must be decimal degrees), drops and counts unusable rows, and fails loudly otherwise. Magnitudes are shown only when you name the band with `--band`. The page shows the `--source` text you give.
- Tested: parser, overrides, rejections and sorting on synthetic CSVs (invented names and numbers); the script (usage error, 300-row run); the page in a browser with synthetic data (deep link, provenance, axe, no console errors) and in the "not built" state on a fresh server. NOT tested: a real catalogue export.
- Quasars are not yet drawn in the Sky Atlas or found by global search.

## Increment I14 — Asteroids and comets (PIPELINE DONE; data built by you)

- Source: JPL Small-Body Database query API (`sbdb_query.api`). Parameters and fields were checked against JPL's documentation: `fields`, `sort`, `limit`, `full-prec`, `sb-kind` (a or c), `sb-ns` (n = numbered); fields full_name, spkid, a (au), e, i, om, w, ma (deg), epoch (JD, TDB), tp, q, per (d), H, diameter (km). Default build: the 1,000 brightest numbered asteroids (sorted by H) and 200 comets (sorted by q).
- Not verified: the response layout (the documentation page does not describe it, so the parser expects `{"fields": [...], "data": [[...]]}` and fails loudly otherwise) and any live call (JPL is unreachable from this sandbox). The JPL pages state no licence; cite the JPL Small-Body Database.
- Model: osculating elements propagated two-body from their epoch (`utils/smallBodies.ts`, reusing the Kepler solver). Close to the epoch the place on the orbit is reasonable; it drifts as planets perturb the body, so it is labelled Estimated with the epoch shown. Comets: a = q/(1−e), period from Kepler's third law, mean anomaly derived from tp (derived, not catalogued). Scene sizes: semi-major axis compressed like the planets'; eccentricity, tilt and orientation true.
- Scene: one point layer (updated only when the date changes); the selected body gets its orbit line and a marker. Selection by name search in the controls; clicking a point is wired but was NOT tested in a browser.
- Tested: parser (valid, invalid, hyperbolic, missing fields), propagation (distance bounds, period closure, circular-orbit geometry), a browser run with a 1,200-row synthetic file (layer drawn, search, panel, axe, no console errors) and the placeholder state. NOT tested: real JPL data, performance of 10,000 bodies on an iGPU (about 1,200 solves per date change were fine in software GL).
- Fix found on the way: the optional texture index (I11) made every explorer page log a 404 when absent. Empty placeholders for `public/textures/index.json` and `public/smallbodies/bodies.json` now ship, so there is no console error.

## Verification: real click selection (2026-11-12)

- `tests/e2e/click-selection.mjs` (needs a running production server; software GL in the sandbox) drives a real browser: clicking the Sun in the Solar System view selects it; in the Sky Atlas, with the selection cleared, clicking the view centre picks Sirius, Betelgeuse, the Andromeda Galaxy (NGC 224), the Orion Nebula (NGC 1976) and Omega Centauri (NGC 5139). All passed, with no console errors.
- A separate scan with a synthetic 1,200-body file found that clicking an asteroid/comet point selects it (the check was manual, not in the saved script, because it needs test data).
- Limits: the centre-click tests prove picking at the centre of the view, not at arbitrary screen positions or on touch screens. Not tested: mobile, a real GPU.
- The deep-sky browse note now says "the deep-sky catalogue has no distances" (stars do have distances since the star-distance increment).

## Increment I15 — Time travel in the Sky Atlas (DONE)

- The Night sky panel now has a "Go to a date" form (year, month, day, hour, minute in universal time; year 0 is 1 BCE; Gregorian calendar throughout, even before 1582), a "Now" button, and the existing ±12 h slider relative to the chosen moment. Invalid dates (such as 30 February or a year outside −3000 to 3000) are refused with a message.
- Maths: `utils/precession.ts` rotates J2000 positions to the mean equator and equinox of date (and back). The horizon, cardinal marks and the selected object's altitude use the precessed frame; the sky itself stays drawn in J2000.
- Tests (`tests/precession.test.ts`, 6 tests): identity and exact round trip, separations preserved, Meeus's first-order rates at the equinox (+1.2812° RA and +0.5567° Dec per century), motion along the ecliptic of about 1.397° per century, Polaris moving toward the pole until about 2100, Thuban within 2.5° of the pole around 2800 BCE, and date-part validation.
- Browser check (Delhi, 28.61°N): Thuban stood at a constant 29° altitude at 0, 6, 12 and 18 h UT in year −2800 (a pole star: altitude equals latitude) but moved between 8° and 46° in 2026. Date validation message, year 33 formatting and axe all passed, with no console errors.
- Limits: proper motion is applied in night-sky time travel (straight-line model with radial velocity where known; accuracy falls off over thousands of years because real motion is not exactly linear; boundaries fixed, one figure corner has no matching star and stays put), no nutation or aberration, no refraction, time taken as universal time with no historical calendar conversion or Earth-rotation correction (ΔT matters only for the Sun, Moon and planets, which are not drawn here). The URL does not yet store the chosen date.

## Increment I16 — Hyperbolic (open-orbit) comets (DONE)

- Osculating e above 1 (a < 0) is now kept instead of dropped. Position uses the hyperbolic Kepler equation M = e sinh H − H with mean motion K/|a|^1.5 (K = Gaussian gravitational constant 0.01720209895, a defined value); a comet's mean anomaly at the epoch comes from its perihelion time tp. The orbit path runs out to 60 au and is drawn as an open line; in the scene each point's distance is compressed like a planet's (direction, tilt and orientation true). Parabolic rows (e = 1 within 1e-9) and negative e are still dropped and counted.
- Panel: shows perihelion distance instead of a period, says the orbit is open at the epoch only, and warns that e above 1 can change after a close planetary encounter (an osculating value is not proof the body is unbound).
- Tests (4 new): hyperbolic Kepler solver for e from 1.0001 to 50 and anomalies from −500 to 900; perihelion distance equals q; perihelion speed equals sqrt(k²(1+e)/q) (vis-viva); symmetry about perihelion and growing distance; path not closed and ending at 60 au. Browser: a synthetic open comet drew correctly, panel text and axe passed.
- Not tested: real JPL comets with e above 1 (needs your `npm run build:smallbodies`).
- Incident (2026-11-13): I16 had already been built by a parallel contributor when I started the same work, and my edit script overwrote their `smallBodyPosition` and `smallBodyOrbitPath` in `utils/smallBodies.ts`. I rewrote both to their documented contract (open orbits via the hyperbolic Kepler equation, `{points, closed}` path, 60 au limit), removed my extra code, and all 111 tests (including their 4 open-orbit tests) and a fresh browser check pass. Their original text of those two functions is not recoverable, so a diff against it is not possible; worth a quick look by them.

## Increment I17 — Compare two objects (DONE)

- Added `/compare?a=<id>&b=<id>` (`app/compare/page.tsx`, `components/CompareShell.tsx`, Navbar link): two pickers, swap button, side-by-side table of every catalogue field, per-object caveat and sources, "Data unavailable" for missing values.
- `utils/compare.ts`: a diameter or mass ratio is computed only when both values match a strict format (`12,742 km`, `5.972 × 10²⁴ kg`). Prose values ("about 940 km", "about 21 solar masses") give "ratio unavailable". Currently only about 10 objects have a parseable diameter and 10 a parseable mass, so many pairs will show no ratio. Making more values numeric means editing `data/objects.json` with sourced figures.
- Verified: `tests/compare.test.ts` (Earth vs Jupiter ratios checked against known physics: about 11× diameter, about 318× mass), `tests/e2e/compare.mjs` in real Chromium at 1280 and 375 px (deep link, swap, unknown id, axe, console, no horizontal scroll).
- Not done: comparing live data (exoplanets, pulsars, small bodies), only the 51 catalogue objects.

## Increment I18 — Guided tours (DONE)

- `/tours` lists four tours (`data/tours.ts`): Solar System inside out (10 stops), Galactic neighbourhood (7), Black holes (3), Jupiter and its big moons (5). Starting one opens `/explore?tour=<id>&object=<first stop>`; a floating `TourBar` shows stop n of N, a "what to notice" line, Back/Next/Exit. The current stop is the `object` in the URL, so browser Back, deep links and sharing work. Clicking another object during a tour keeps the tour; leaving its path shows a "Go to stop 1" prompt.
- Honesty rule, enforced by `tests/tours.test.ts`: tour text contains no digits, so every measured value and source still comes from the catalogue panel. The test also requires every stop to exist in the catalogue and in the 3D scene. Pluto was left out for that reason: it has a catalogue entry but no 3D body yet.
- Verified: `tests/e2e/tours.mjs` (real Chromium, 1280 and 375 px: list, start, next/back, URL param, exit, last-stop Finish, axe, console) and screenshots on both sizes. I fixed an overlap with the solar controls and the mobile info sheet by moving the bar to the top.
- Not done: no automatic camera storytelling beyond the existing fly-to, no narration audio, no tours for Sky Atlas, pulsars or exoplanets. On a 375 px screen the bar sits just under the quick-nav chips and may hide a few pixels of them.

## Increment I19 — Distance between Solar System bodies (DONE)

- `/distance?a=earth&b=mars&date=2018-07-31` (`utils/separation.ts`, `components/DistanceShell.tsx`, Navbar link): distance in au, million km and light-travel time between the Sun and the eight planets on a chosen date, plus a daily chart of the next 365 days with closest/farthest points. Swap button, "Use today", invalid params fall back safely.
- Data: the same JPL approximate planet elements as the 3D view (Standish & Williams, valid 1800 to 2050). Shown with an Estimated badge. Dates outside 1800 to 2050 are refused, not extrapolated. Earth is the Earth-Moon barycentre (up to about 4,700 km off). Light-time delay is not applied; distances are geometric.
- Deliberately NOT included: moons (their position along the orbit is illustrative, so a dated distance would be false precision), stars, galaxies and other catalogue objects (their catalogue distances are prose with no reliable 3D position).
- Verified: `tests/separation.test.ts` uses published reference values that do not come from this code: Earth-Sun perihelion/aphelion, Mars oppositions 2003 and 2018 (NASA 55.76 and 57.59 million km, within 2 percent), Venus inferior conjunction 2020, 499 s per au, symmetry, triangle inequality, range refusal. `tests/e2e/distance.mjs` in real Chromium at 1280 and 375 px (values, swap, out-of-range, bad params, axe, console, no horizontal scroll).
- Fixed on the way: axe intermittently failed `color-contrast` on the pulsing "Initialising universe…" loading text (measured mid-pulse, 3.9 to 4.25 against 4.5 needed). This also explains the one 17-of-18 tours e2e run I called a flake earlier. The loaders no longer pulse (explorer, map, sky, moons, pulsars, quasars). Tours e2e then passed 3 of 3 runs.
- Not done: distances to stars and galaxies, measuring inside the 3D view by clicking two objects, light-time correction.

## Increment I20 — Milky Way structure (DONE)

- `/milky-way` (`app/milky-way/page.tsx`, `data/milkyWayStructure.ts`, `utils/spiral.ts`, Navbar link, and a "Structure and measurements" button in the Explore panel for the Milky Way): a top-down schematic plus a sourced fact list. The drawing is labelled Artistic: four identical logarithmic spirals at the ~10 degree average pitch angle from Reid et al. (2019), a bar of illustrative size, the Sun at the measured radius, arbitrary angle. It is NOT a map of where arms lie.
- Facts, each with a quote and a source, read on 2026-11-13: Sun to Sgr A* 8,277 ± 9 pc (GRAVITY Collaboration, A&A 657, L12; systematic about 30 pc; about 27,000 light-years is my conversion) and 8.15 ± 0.15 kpc (Reid et al.) as two independent Observed values; arms as a four-arm spiral with spurs (Reid) and, separately, two major plus two minor arms attached to a thick bar (NASA/JPL 2008 caption). These two descriptions disagree and are both shown. The Sun sits near the Orion Arm/Spur (NASA/JPL). Disk size, bulge size and the Sun's orbital period come from a secondary source (Space.com, which contradicts itself on the period: 230 and 250 million years) and are marked Estimated.
- A section lists what is deliberately not shown because it could not be verified: halo size, bar length and angle, true arm positions, total mass and star count.
- Could not open: the NASA Science annotated-image page and the arXiv abstract page (not on the fetch allowlist), and the ESA page behind the bulge figure.
- Verified: `tests/milkyway.test.ts` (facts have quotes and https sources, conversion matches `PC_LY`, the two distances agree within error, spiral pitch angle recovered numerically). This test caught my own arithmetic slip: I first wrote 26,990 light-years, the correct rounding is 27,000. `tests/e2e/milky-way.mjs` in real Chromium at 1280 and 375 px (facts, both arm views, artistic label, links, axe, console, no horizontal scroll) plus a screenshot.
- Not done: arms drawn in the 3D scene from measured positions, a measured arm map, halo, globular clusters, stellar streams.

## Audit follow-up: code quality (2026-11-13)

From an external audit (parts 3 and 4):
- Fixed: `LAUNCH.md` still described circular, coplanar orbits. It now describes the Keplerian model, the optional data scripts, and the current limits.
- Fixed: the rate limiter trusted the FIRST `X-Forwarded-For` entry, which a caller can write, so the limit was trivially dodged and the key map could grow without bound. New `utils/clientIp.ts` counts `TRUSTED_PROXY_HOPS` entries from the right (default 1) and validates the address; the limiter now evicts oldest keys beyond 10,000. Three tests added (spoofed prefix, junk or missing header, flood bounded).
- Not fixed, by design: the limiter and cache are still per instance. A shared store (e.g. Upstash Redis) needs an account and secrets, so that is a deploy-time decision for you.
- Still open: live NASA/JPL/SIMBAD/Exoplanet Archive response formats have only been tested against synthetic fixtures. Run `npm run check:live` from a connected machine.
- Audit part 3 status: see the "Remaining gaps" table. Done since the audit text was written: asteroids and comets orbits (I14, I16), pulsar and quasar atlases (I12, I13), Keplerian moons for 6 moons (I10), Milky Way structure facts (I20, not a measured 3D model). Still open: measured 3D galaxy positions, all 177 moons, spacecraft trajectories, exoplanet 3D systems, pulsars/quasars in Sky Atlas and global search, globular clusters/streams/halo, Night Sky planets and Moon, proper motion/refraction/nutation/aberration.

## Exoplanet scientific data integrity (audit 2026-11-14)

State found: the parser, build script, detail UI, live service and 16 tests for uncertainties, limit flags, per-parameter references, mass provenance and the controversy flag were already in the project (written earlier the same day), so they were audited, not rewritten.
- Verified from NASA's column documentation: `pl_orbper_reflink`, `pl_bmasse_reflink` (same pattern for the other parameters) exist in PSCompPars ("Reference of publication used for given parameter set"); `pl_bmassprov` (Mass, M*sin(i)/sin(i), M*sini); `pl_controv_flag` (1 = confirmation status questioned in the published literature).
- NOT defined anywhere in the documentation I could read: the values of the `*lim` columns. The code therefore reads flag 1 as an upper limit (supported by Kepler-80 f mass, flag 1, shown by the archive as "<12651.5"), treats 0 or empty as no limit (an assumption), and shows any other flag (including -1) raw and uninterpreted. If you want it confirmed, query `TAP_SCHEMA.columns` for `pl_bmasselim`.
- Fixed: `public/exoplanets/planets.json` held a 5-row test file (invented example.org reference links and a fake "Unverified-flag b" planet) that would have shipped with the project and overwritten a real dataset when the archive was extracted. Removed from `public/`; the real file is built on your machine.
- Fixed: the detail view labelled mass, radius, period and orbit size "Observed". Those are published fits and can depend on models, so they now get no badge; only archive-calculated values and the equilibrium temperature are "Estimated". Tested (`paramBadge`).
- Added: `--out dir` for the build script (smoke tests cannot touch the shipped dataset).
- Encoding: no mojibake in 189 text files, all valid UTF-8, no BOM. The `â€”`/`Â·` strings are a Windows PowerShell display problem (it reads UTF-8 with the legacy code page). Use `Get-Content -Encoding utf8 file` or `chcp 65001`, or open the files in an editor.
- Checked without real archive data: build script on a 1,204-row synthetic CSV (written to a scratch folder), failure paths (too few rows keeps the existing file; no network writes nothing), UI in real Chromium on desktop and mobile widths (22 checks, axe clean, no console errors, missing-data state).
- Not done: `npm run build:exoplanets` against the live archive (the sandbox cannot reach it), so the real dataset statistics (record count, duplicates, null uncertainties, limit flags, missing references, mass provenance, controversy count) have not been seen yet. The command prints them.

## Remaining gaps (checked against the source on 2026-11-11)

| Gap | Actual state | What closing it needs |
|---|---|---|
| Photographic planet textures | **Pipeline done, no images shipped.** `npm run build:textures` downloads NASA images on your computer (this sandbox cannot reach NASA image hosts). Sources found and verified: Moon (LRO colour map), Mercury (MESSENGER, false colour), Jupiter (Cassini map). No usable global map was verified for Earth, Mars, Venus, Saturn, Uranus, Neptune or the Sun, so those stay procedural/artistic | Moon and Jupiter run as is (Jupiter marked `verified` by the project owner after reading the JPL Image Use Policy; I could not read that policy myself); Mercury needs `--include-unverified` after you read its image-use policy; other worlds need a verified 2:1 map URL added to `data/textureManifest.ts` |
| Realistic galaxy images in 3D | Procedural point-cloud galaxies | Real survey images or photographs as textured billboards, with licence/credit per image |
| Accurate 3D galaxy coordinates | Not implemented: `sceneConfig.ts` positions are schematic ("not real galactic coordinates") | Distances and directions from a verified catalogue (e.g. NED/SIMBAD) converted to galactic Cartesian coordinates, with a clear scale break between regimes |
| Real orbital mechanics | **Done for the 8 planets**: JPL Table 1 elements (valid 1800 to 2050 AD), Kepler's equation solved per frame; only the semi-major axis is compressed. Not done: dwarf planets, asteroids, comets | Element sets for those bodies (see next rows) |
| Moons orbiting planets in 3D | **Done for 6 moons**: the Moon, Io, Europa, Ganymede, Callisto, Titan, with JPL mean elements. Orbit size, shape and tilt are real; position along the orbit is illustrative. Not done: Mars's moons (pole data not readable), all other moons | JPL mean elements for the rest, plus precession, or Horizons vectors for true positions |
| Asteroid/comet orbital simulation | **Pipeline done, data not shipped.** `npm run build:smallbodies` (on your computer) fetches up to 10,000 asteroids/comets from JPL SBDB; the Solar System view shows them as a point layer with a searchable orbit. Two-body propagation only; open (hyperbolic) orbits are supported, parabolic ones skipped | Run it once with internet; perturbations (n-body) or Horizons vectors for long-range accuracy |
| Spacecraft live trajectories | Not implemented; live Horizons distance rows exist for 4 spacecraft but are unverified here | Horizons vector tables sampled over time, drawn as paths |
| Full pulsar catalogue | **Pipeline done, data not shipped**: `/pulsars` page and `npm run build:pulsars -- --file psrcat.csv` (you export the CSV from the ATNF web form). Parser is header-driven and fails loudly; it was tested on synthetic CSVs only, never on a real ATNF export | Run it once on your computer with a real export, and tell me if the real file differs from what the parser expects |
| Full quasar catalogue | **Subset pipeline done, data not shipped.** `/quasars` and `npm run build:quasars -- --file q.csv --source ... --band i` for a 100 to 50,000-row subset you export yourself. The full 750,414-quasar SDSS DR16Q (1.7 GB FITS) is deliberately not supported: it would need the tiling I9 deferred | Export a subset from a catalogue whose licence you have checked; tell me if the real column names or format differ from what the parser expects |
| Exoplanet records | `npm run build:exoplanets` exists; dataset not shipped in the ZIP by design | Run the script once on a machine with internet |
| Real-time night-sky accuracy | **Improved**: catalogue positions are precessed to the chosen date (IAU 1976, Meeus ch. 21) and any date from year −3000 to 3000 can be chosen (universal time, proleptic Gregorian). Proper motion is now applied (Estimated, straight-line). Still approximate: no nutation, aberration or refraction; Moon and planets not shown in the night sky | Refraction, planets and Moon (ephemeris needed) |
| Stars' distance and luminosity | **Done** for 5,036 of 5,044 stars (see section below). Visible-light luminosity only, no bolometric value; no per-star errors | Per-star parallax errors if a catalogue with them is added |
| Real-device performance | Not measured on an Intel iGPU | Run on the target machine |

Nothing in the table should be described as implemented in marketing text or the README.

### Texture credit reliability
- `universe/objects/photoStatus.ts` (pure): status loading/loaded/missing/error, tagged with the body id; metadata is non-null only when loaded. `TextureCredit` renders only for `loaded`. Mercury stays procedural (rights unverified). Tests: `tests/photoStatus.test.ts` (injected loaders, no network). Not verified in a browser with a real NASA image (sandbox cannot reach NASA).
