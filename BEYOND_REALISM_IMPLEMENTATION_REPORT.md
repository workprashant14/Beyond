# BEYOND — Realism Implementation Report

Status: **Phase 1 (star backdrop) and Phase 2 (galaxy morphologies) are done and verified as described below. Nebulae (Phase 3), deep-space layout and the later phases are NOT implemented.** This report does not claim the full upgrade.

## 1. Existing visual problems (from code + screenshots of /explore, milky-way, orion-nebula, andromeda, /sky)

| # | Problem | Evidence |
|---|---------|----------|
| 1 | Universe backdrop was 5000 uniform-random points on a shell, same size, near-identical white/blue tint, fixed 1.4 px | `StarfieldPoints.tsx`; screenshot: even dots, no brightness hierarchy |
| 2 | Galaxies: one model for every galaxy (4 arms, ~7000 additive points + a glow sprite); no ellipticals/irregulars, no dust lanes, no inclination from data | `SpiralGalaxy.tsx`, `ObjectVisual.tsx`; Andromeda and the Milky Way look the same |
| 3 | Nebulae: 350 gaussian point sprites at 7 % opacity, no filaments, dust lanes or illumination; Orion is a faint pink smudge | `NebulaCloud.tsx`; orion screenshot |
| 4 | Scene layout is hand-placed and schematic, not catalogue-positioned | `sceneConfig.ts` |
| 5 | Real catalogue data (Hipparcos 5044 stars with mag and B-V, OpenNGC DSOs, constellations) is only used on `/sky`, not in the 3D universe | `universe/sky/*` vs `universe/engine/*` |
| 6 | No galaxy clusters / large-scale structure; far objects are not placed by distance | `sceneConfig.ts` |
| 7 | Moons: 6 in 3D, static elements (from the earlier Solar System audit, still open) | `BEYOND_SOLAR_SYSTEM_AUDIT.md` partial |

## 2. Phase 1 — done: catalogue star backdrop

Files:
- `utils/starBackdrop.ts` (new, pure, unit-tested): builds the backdrop buffers.
- `universe/engine/CatalogueStarfield.tsx` (new): one-draw-call shader Points; lazy-loads `/sky/stars.json` via existing `loadSky`; falls back to the old `StarfieldPoints` while loading or if loading fails.
- `universe/engine/UniverseScene.tsx`: one line swapped (`StarfieldPoints` → `CatalogueStarfield`). `StarfieldPoints.tsx` is kept as the fallback.
- `tests/starbackdrop.test.ts` (new, 6 tests).

Techniques: per-star point size and alpha from apparent magnitude (flux ∝ 10^(−0.4 m)); gaussian core, soft halo only for the brightest stars (restrained glow, no bloom pass); colour from B-V via the existing `starColor`; additive blending, `depthWrite:false`, `renderOrder:-10` so it never occludes or intercepts objects; the points follow the camera, so the backdrop has no parallax (treated as infinitely distant); device profiles (desktop 30 000 / mobile 9 000 / low 4 000 fill stars; all catalogue stars are always drawn).

## 3. Data vs. procedural (important)

- **Sourced (Observed):** the 5044 Hipparcos stars — direction (RA/Dec), apparent magnitude, B-V colour. Source: `public/sky/stars.json` (see `public/sky/SOURCES.md`).
- **Procedural (not real stars):** the faint fill (mag 6.5–10.5). Positions, magnitudes and colours are seeded random. Only two things are physically motivated: counts per magnitude grow ≈3.2× per magnitude, and the fill is concentrated toward the real J2000 galactic plane (pole RA 192.85948°, Dec 27.12825°) so a Milky Way band exists.
- **Not accurate:** no per-star distance is used, so there is no real depth or parallax. The backdrop's orientation is equatorial J2000 and is **not** tied to the scene's schematic Milky Way model, which is itself not to scale. The UI note "Artistic visualization" stays correct.
- The fill is not shown in the object panel and is not selectable; it never claims to be catalogue data.

## 4. Verification (sandbox: Chromium + SwiftShader software GL, not a real GPU)

- `tsc --noEmit`: clean. Lint: clean (one `react-hooks/immutability` error found in my first version and fixed).
- Unit tests: 326 total, 325 pass, 0 fail, 1 skipped (pre-existing: real small-body data absent).
- e2e (full): 27 scripts, 1374 checks, 0 failing. `selector-panel` re-run after the final lint fix: 186/186. No test was changed or weakened.
- Production build: OK.
- Rendering A/B in the sandbox (rAF fps, 1280×800, SwiftShader): old backdrop 55.5 / 20.0 fps (universe / milky-way); new 55.0 / 19.5. No measurable regression. **These are sandbox numbers, not consumer-GPU numbers**; not measured on a real GPU or on a phone.
- Extra download: `stars.json` 201 KB (already used by /sky, cached).
- Not verified: mobile device rendering (only 390×844 viewport layouts via existing e2e), real GPU performance, the Milky Way band's look from a direction toward the galactic plane (screenshot taken looking away from it).

## 5. Remaining limitations

Everything in section 1 rows 2–7 is still open: galaxy types, nebula volume, catalogue positioning, clusters, LOD per object type, quality settings UI, moons. Orion/Andromeda etc. still look as before.

## 6. Recommended next phases (in order)

1. **Galaxy types:** shader-based disk with density gradient, bulge, dust lanes; elliptical and irregular models selected by `objects.json` type; inclination only where a catalogue value exists, otherwise labelled Artistic.
2. **Nebulae:** layered noise billboards (3–5 slices) with filaments and dust lanes, colour by emission type (data field if present), parallax from layer depth.
3. **Deep-space layout:** place DSOs from OpenNGC RA/Dec with distance-compressed radius (documented as compressed); add the real Local Group members.
4. **Quality profile + adaptive count** wired to the existing `PerformanceMonitor`; frustum/LOD per object.
5. Clusters / large-scale structure only if a free catalogue is approved (needs your decision; no big downloads without it).


---

# Phase 2 — Realistic galaxy rendering

## P2.1 Audit (what existed, what the data really has)

Galaxies in the scene: `milky-way`, `andromeda`, `triangulum`, `lmc` (kind `galaxy`) and the host galaxy of `m87` (kind `black-hole` with `hostGalaxy`). `data/objects.json` has **no** galaxy type, RA/Dec, angular size, inclination or magnitude: only `distance` and `diameter` as free text (diameter is null for all but the Milky Way). Scene positions are schematic. The usable catalogue fields come from OpenNGC and are stored in `data/galaxyMorphology.json` (built by `scripts/build-galaxy-morphology.mjs` from the local, un-committed OpenNGC CSV): Hubble type, major/minor axis (arcmin), position angle, B magnitude. The Milky Way is not in OpenNGC: only "barred spiral" from its summary; no inclination.

| Galaxy | Hubble (OpenNGC) | Major/minor ('), PA | Model |
|---|---|---|---|
| Andromeda | Sb | 177.8 / 69.7, 35° | spiral |
| Triangulum | Sc | 62.1 / 36.7, 23° | spiral (looser, more flocculent) |
| M87 (host) | E | 7.11 / 6.67, 153° | elliptical |
| LMC | SBm | 646 / 550, 170° | irregular (Magellanic) |
| Milky Way | none | none | spiral, bar forced from the object summary; scene tilt (no inclination) |

## P2.2 Files (all under the existing architecture; the old `SpiralGalaxy.tsx` was replaced by the per-type models)

- `utils/galaxyMorph.ts`: pure, unit-tested: Hubble classification, inclination estimate, sky-frame orientation, parameters, star sampling, spiral arm/dust functions. `tests/galaxymorph.test.ts`.
- `universe/objects/galaxy/`: `GalaxyVisual` (picks model, orientation), `SpiralGalaxyModel`, `EllipticalGalaxyModel` + `EllipsoidGlow`, `IrregularGalaxyModel`, `DiskLight`, `GalaxyStars`, `glsl.ts`, `resolve.ts`.
- `universe/objects/ObjectVisual.tsx`, `sceneConfig.ts`: route galaxies and M87's host through `GalaxyVisual`.
- `data/galaxyMorphology.json`, `scripts/build-galaxy-morphology.mjs`, `utils/deviceProfile.ts` (star-count scale per device profile).
- `tests/e2e/galaxies.mjs` (new), `scripts/profile-galaxies.mjs` (new; I fixed one lint warning in it by turning a ternary statement into if/else).

## P2.3 Techniques

Spiral: log-spiral arms with two unequal arms and radial wobble, exponential disk, bulge, optional bar, dust lanes on the inner edge of the arms (patchy through noise), colour from warm old stars at the centre to blue in the arms, a few pink star-forming knots; pitch and bulge size follow the Hubble stage (Sb vs Sc differ). Elliptical: Hernquist star distribution plus an analytic Sérsic (n=2.5) glow whose projected ellipse is recomputed per frame, so the shape is right from any angle; no arms. Irregular: off-centre clumps, lopsided bar and diffuse disk with patchy dust; no arms, no symmetry. Resolved stars are one Points draw call per galaxy with per-star colour and size; the diffuse light is a shader on a quad; distance LOD thins the star draw range and drops a noise octave; frustum culling on for the stars. Visual layers set `raycast = null`, so selection goes through the existing selectable wrapper.

## P2.4 Real data vs procedural

- **Sourced (OpenNGC):** Hubble type chooses spiral/elliptical/irregular model and the Sb/Sc stage; position angle and axis ratio orient the object **as seen from the scene origin**; the scene origin and +Y stand in for the viewer and celestial north, so this is a schematic orientation, not a true sky frame.
- **Estimated:** inclination, from the apparent axis ratio with a thick-disk formula (q0 = 0.2). Used only for galaxies that have both axes (not the Milky Way).
- **Procedural / artistic:** arm count and winding, arm phases, dust lanes, clumps, star positions, colours, brightness, sizes, rotation. Size is schematic, not to scale. The panel text for every galaxy says so and names which catalogue fields were used (`morphologyNote`).
- Not used because absent: distance as a number, apparent magnitude, angular size for placement.

## P2.5 Verification (sandbox Chromium + SwiftShader, software GL)

- `tsc --noEmit` clean. `npm test`: 338 tests, 337 pass, 0 fail, 1 skipped (pre-existing). `npm run lint`: clean (after the warning fix). `npm run docs:check`: OK. Production build OK.
- e2e full run: **28 scripts, 1441 checks, 0 failing** (includes `galaxies.mjs`: panel provenance text for 5 galaxies at 1280×800 and 390×844, no shader/page errors, click-selection of Andromeda/LMC/M87 from the default view). No test or threshold changed.
- Screenshots, same camera and settings, panels hidden: `docs/realism/verified/before-*.jpg` (Phase 1 build) and `after-*.jpg` (current) for Andromeda, Milky Way, M87, LMC, Triangulum. Older captures from earlier work are in `docs/realism/before|after`.
- Visually checked: three morphologies are clearly different (spiral with bulge, arms and dust; smooth elliptical glow without arms; asymmetric clumpy irregular). Andromeda is inclined from catalogue values instead of face-on.

## P2.6 Performance (rAF fps, 1280×800, software rasteriser, median of 3; `scripts/profile-galaxies.mjs`)

| View | Phase 1 build | Phase 2 build |
|---|---|---|
| Universe (5 galaxies) | 50.7 | 58.7 |
| Milky Way | 20.7 | 15.3 |
| Andromeda close-up | 54.0 | 31.0 |
| LMC close-up | 60.3 | 30.0 |
| M87 close-up | 31.3 | 56.7 |

**Close-ups are slower in this sandbox** (Andromeda, LMC, Milky Way): the new diffuse-light shaders cost fill rate, which a CPU rasteriser pays heavily. The universe view and M87 were as fast or faster, but run-to-run noise here is large. No real GPU, laptop iGPU or phone was measured, so I cannot say whether consumer hardware stays comfortable; the existing adaptive resolution (PerformanceMonitor) will lower resolution if it does not. A real-device run of `scripts/profile-galaxies.mjs` is needed.

## P2.7 Remaining limitations

- Andromeda's arms read as two fairly thin, ring-like bands, not the diffuse, mottled arms of a telescope photograph; contrast and width need another pass (the arm constants are shared with the JS twin and unit tests, so change them together).
- The Milky Way is still a generic barred spiral with a scene tilt: no inclination, no real structure from `data/milkyWayStructure.ts`.
- Position angle is applied in a schematic frame, not a true RA/Dec frame; galaxy positions are still hand-placed.
- Dust is a visual darkening of procedural light, not a measured dust map.
- Performance on real hardware and mobile not measured; shader detail LOD is coarse (one threshold).
- Only five galaxies exist in the 3D scene; no galaxy catalogue for more.

## P2.8 Next

Phase 3 (nebulae) only after your approval. Before it, a real-hardware fps run and a decision whether to adjust arm width/contrast.
