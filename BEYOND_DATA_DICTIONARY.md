# BEYOND — Data Dictionary

Only fields that were actually checked are described as verified. Everything else says so.

## Quasar catalogue (chunked, from SDSS DR16Q FITS)

### Files (`public/quasars/`, written by `scripts/build_quasars_fits.py`)
| File | Content |
|---|---|
| `meta.json` | `format:"chunked"`, counts, input file name + sha256, every FITS column (`name`, `format`, `unit`, `null`, `dim` read from the FITS header), chunk table with bounding boxes, sentinel notes, citation |
| `index/NNNN.json` | Columnar index records (≤ `chunkMax`, default 2,000) sorted by (5° declination band, RA, original row). Unplaced records (no valid RA/Dec) are band 99 |
| `lists/z/NNNN.json`, `lists/mag/NNNN.json` | The same index records again, in redshift order (highest first) and brightness order (brightest first), `listChunk` (500) per file |
| `detail/NNNNNN.json` | **Every column** of the original record for `detailChunk` (250) consecutive positions: `{pos0, rows:[[value per column, in meta.columns order]]}` |

### Index record fields
| Field | Source column | Meaning | Notes |
|---|---|---|---|
| `pos` | – | Position in the stable sorted order | Addresses detail records; stable for the same input and options |
| `n` | `SDSS_NAME` (auto-detected; override `--name-col`) | SDSS designation | Duplicates are reported in `counts.duplicate_names`, never removed |
| `ra`, `dec` | `RA`, `DEC` | J2000 degrees as catalogued | Raw finite values kept even if out of range; such records are "unplaced" and excluded from cone search |
| `z` | `Z` | Primary redshift as catalogued | Stored unchanged. Negative values are **not** assumed invalid. NaN/FITS null → `null` |
| `m` | `PSFMAG[3]` (i band of u,g,r,i,z) | PSF magnitude as catalogued | Only if the column has exactly 5 elements. Not converted or corrected |
| `f` | `IS_QSO_FINAL` | Quasar flag | Verified (SDSS page): in the superset, values > 0 are DR16Q quasars; ≤ 0 are non-quasars |

### Rules for missing / sentinel values
* FITS nulls: float NaN/inf and integer `TNULLn` values become JSON `null`. Nothing else is rewritten.
* Per-column sentinels are shown to the user next to the raw value, never applied silently. Verified from Lyke et al. (2020), as read from the arXiv text:
  `Z_VI` −999 = possible blazar with no meaningful redshift, −1 = not visually inspected; `Z_CONF` −1 = not visually inspected, 0 = inspected without a confident result; `THING_ID` −1 = no ID assigned; `BAL_PROB` −1 = redshift too low for a detection; QuasarNET flag −1 = not processed; `*_MATCHED` flags 1 = found, 0 = not found; unWISE flux −1 in both bands for 1001 quasars not identified with SDSS imaging; DLA parameters −1 in the first element = outside the DLA redshift range, all −1 = none detected.
* **Ordering rule (the only judgement made):** a `PSFMAG` value ≤ 0 is left out of the brightness list because it is not a physical apparent magnitude of a quasar. The value is still stored. The count is `counts.magnitude_not_ordered`.

### What is NOT verified
* The exact names, formats and units of all 183 columns were not read from SDSS documentation (the data-model page could not be fetched). They are read from **your file's FITS header** at build time and stored in `meta.json`. Per-column *descriptions* are available only for the sentinel notes above; for the rest see https://data.sdss.org/datamodel/files/BOSS_QSO/DR16Q/ and Lyke et al. (2020).
* The pipeline has been tested only on a small **synthetic** FITS file. It has **not** been run on the real `DR16Q_v4.fits`. Real counts will be in `meta.json` after you run it (expected input: 750,414 rows × 183 columns).
* Column-name auto-detection (`SDSS_NAME`, `RA`, `DEC`, `Z`, `IS_QSO_FINAL`, `PSFMAG`) is a best match; the script prints what it chose and fails if name/RA/Dec/Z are not found.

## Stars (`public/sky/`)

### `stars.json` — 5,044 stars (Hipparcos numbers, mag <= 6.0 as selected by d3-celestial)
Columnar arrays of equal length `n`: `hip` (Hipparcos number), `ra`, `dec` (J2000 degrees), `mag` (visual magnitude, lower = brighter), `bv` (B-V colour index; NaN/null when the source has none).
`starinfo.json`: per Hipparcos number `n` proper name, `b` Bayer letter, `f` Flamsteed number, `v` variable-star designation, `h` HD number, `c` constellation.

### `starphys.json` — built by `npm run build:starphys` from AT-HYG v3.2 (CC BY-SA 4.0); same order as `stars.json`
5,041 of 5,044 stars are in AT-HYG (3 are not and stay unknown). Every value is stored only when AT-HYG gives it **and** its source code is not NONE. AT-HYG has **no per-value uncertainties**, so none are stored or shown.
| Array | Meaning | Unit | Source codes (array) | Count with a value |
|---|---|---|---|---|
| `d` | Distance | parsecs (3 decimals); values >= 100,000 are AT-HYG placeholders and become null | `ds`: G3 Gaia DR3, G2 Gaia DR2, H Hipparcos, GJ Gliese | 5,036 |
| `sp` | MK spectral type as catalogued | text | `ss`: T Tycho-2 spectral table, HYG | 5,041 |
| `pmra`, `pmdec` | Proper motion in RA (already multiplied by cos dec, i.e. true angular motion) and Dec | mas/yr | `pms`: G3, G2, HYG, GJ, T, H, O | 5,041 |
| `rv` | Radial velocity, positive = receding | km/s | `rvs`: as above; HYG values are usually lower precision than Gaia (AT-HYG notes) | 5,031 |
| `ci` | B-V colour index, stored only where AT-HYG says it is B-V (`mag_src` HIP or GJ); the Tycho-2 BT-VT index is a different system and is excluded | mag | – | 5,039 |
| `hd`, `hr`, `gl` | Henry Draper number, Bright Star (Yale/HR) number, Gliese designation text | – | – | 5,040 / 5,039 / 464 |

Checks that were run: the original `d/ds/sp/ss` arrays are byte-identical to the previous build; `ci` equals the B-V in `stars.json` for all 5,039 stars (largest difference 0.000); Sirius proper motion (-546.0, -1223.1 mas/yr) matches the published Hipparcos value; rebuilding from the bundled extract reproduces the file exactly (test).
The `HYG` source code is AT-HYG's label for values taken from the older HYG database (for radial velocity: Wilson-Evans-Batten, Yale or Gliese per the AT-HYG notes); for proper motion its original catalogue is not stated there, and the UI says so.
Derived on screen (not stored): total proper motion, tangential speed = 4.74047 x (proper motion in arcsec/yr) x (distance in pc), shown as **Estimated** and only when the distance is a reliable parallax by this site's policy (see `distanceClass`). Space velocity is not computed.
Proper motion is applied only in Night-sky time travel (`utils/properMotion.ts`): u(t)=normalize(u0 + t·(pmra·e_ra + pmdec·e_dec + (rv/d)·u0)), t = whole years from J2000; the radial term needs both a distance and a radial velocity, otherwise the tangent-only model is used; stars with no catalogued motion keep their J2000 place. Outside Night sky the map shows J2000 positions as catalogued.

### `constellation-areas.json` — area of each IAU constellation region
`areas[id]` = published area in square degrees (Hydra 1302.844 largest, Crux 68.447 smallest; Serpens is one row, Caput + Cauda). Shown in the constellation panel as an artistic/conventional value (a region of the sky by convention, not a physical size) with its share of the whole sky (sphere = 41,252.96 square degrees) and the rank among 88.
Cross-check (`utils/constellationArea.ts`, `tests/constellationarea.test.ts`): area computed from the bundled boundary polygons joined by great-circle arcs. The 88 computed areas sum exactly to the sphere. Against the published values the median error is 0.4%, worst Octans -14.5% (official boundaries follow lines of constant RA and Dec, not great circles, which matters most near the poles), so the computed value is an estimate and is **not** shown to users.

## Deep-sky objects (`public/sky/dsos-bright.json`, `dsos-faint.json`; OpenNGC, CC-BY-SA-4.0)
12,094 objects (542 bright tier + 11,552 faint tier). Columnar arrays of equal length: `id`, `d` (designation, Messier number where there is one), `t` (type code: g e s0 s i sd gg gp gt = galaxies and galaxy groups; oc gc cn hii en nb rn pn snr = galactic objects), `c` (IAU constellation), `ra`, `dec` (J2000 degrees), `mag` + `mb` (V or B band), `a`, `b` (angular size, arcmin), `h` (Hubble type as catalogued), `v` (radial velocity, km/s), `z` (redshift), `p` (parallax, milliarcseconds), `names` (common names).
* `v`, `z` and `p` are OpenNGC's values taken from SIMBAD's main entry for the object (OpenNGC README). No uncertainties or per-value source are available. `z` and `v` come from the same SIMBAD value: they are present together for 10,892 objects (checked by a test); `p` is present for 1,486 (884 are galaxies, where it is not shown because a galaxy parallax is far below any measurable value).
* Redshift range in the data: -0.0016 to 0.19 (negative = approaching).
### Distances shown in the panel (calculated, never stored; `utils/dsoDistance.ts`)
| Object | Rule | Label |
|---|---|---|
| Galactic (clusters, nebulae, remnants) | distance = 1000/parallax(mas) parsecs, only if parallax >= 2 mas | Observed |
| Galactic | parallax 1 to 2 mas | Estimated (low precision) |
| Galactic | parallax < 1 mas, missing, or <= 0 | none, with the reason ("too small to give a reliable distance") |
| Galaxy | comoving distance from `z`, flat LCDM (H0 = 67.4 km/s/Mpc, Omega_m = 0.315, Planck 2018), only if z >= 0.01 | Estimated |
| Galaxy | z < 0.01 (including every negative z) or missing | none, with the reason |
7,707 of the 12,094 objects get a distance by these rules (the rest show "Data unavailable" with the reason). The thresholds (2 mas, 1 mas, z = 0.01) are this project's choices, not catalogue values: the table has no parallax error, so only large parallaxes are trusted; below z = 0.01 an object's own motion (hundreds of km/s) is comparable to the expansion. The redshift distance ignores peculiar motion (about 10% at z = 0.01) and depends on H0 (73 km/s/Mpc would give about 8% less). Omega_Lambda = 1 - Omega_m; radiation is neglected. Distances are not used to place objects in 3D.
Checks that were run: the comoving-distance code agrees with astropy FlatLambdaCDM (Tcmb0 = 0) to 1e-6 at z = 0.01 to 3; Beehive Cluster (parallax 5.371 mas) gives about 607 ly and the Pleiades (7.364 mas) about 443 ly (literature: roughly 600 and 440 ly).

## Other datasets
Moons (`public/solar/moons.json`): see `data/raw/moons/README.md`.
Field-level dictionaries for exoplanets, pulsars and small bodies are **not yet written** (those datasets are not in this project copy).
