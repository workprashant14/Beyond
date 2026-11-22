# BEYOND — Data Sources

| Dataset | Source | Licence / terms | Retrieved / status | Notes |
|---|---|---|---|---|
| Constellation areas (88) | Wikipedia, "IAU designated constellations by solid angle" (published table, read 2026-11-17 via a summarising fetch tool) | CC BY-SA (Wikipedia text; the areas themselves are facts defined by the IAU boundaries) | `public/sky/constellation-areas.json` | Integrity-checked: ids match, sum = sphere within rounding, each within 15% of the area computed from the bundled boundaries |
| Stars (5,044, mag ≤ 6), constellations (88) | d3-celestial 0.7.35 (Olaf Frohn) | BSD-3-Clause | Bundled in `public/sky/` | Positions J2000; Hipparcos numbers |
| Star physical data (5,044): distance, spectral type, proper motion, radial velocity, B-V, HD/HR/Gliese | AT-HYG v3.2 (https://github.com/astronexus/hyg-database; now at https://codeberg.org/astronexus/athyg), extract in `data/raw/athyg/hip-extract.csv` | CC BY-SA 4.0 (`data/raw/athyg/LICENSE`) | Rebuilt from the full 2,552,165-row catalogue (two local gz parts) on 2026-11-15; 5,041 of 5,044 stars found | No per-value uncertainties; source codes per field in BEYOND_DATA_DICTIONARY.md |
| Deep-sky objects (12,094) | OpenNGC (Mattia Verga et al.) | CC-BY-SA-4.0 (derived files shared under the same licence) | Bundled; NGC.csv sha256 54abea0b57b0…, addendum c93f983dda67… | Redshift and parallax (SIMBAD main values, via OpenNGC) now used; see dictionary for the distance rules |
| Moons (177) | `data/raw/moons` (satellites.csv, MIT) | see `data/raw/moons/LICENSE-MIT` | Bundled `public/solar/moons.json` | |
| Planet orbits | JPL approximate Keplerian elements | NASA/JPL public data | In `data/keplerElements.ts` | Valid 1800–2050 only |
| Exoplanets | NASA Exoplanet Archive PSCompPars (TAP) | NASA archive terms; cite the archive | **Not in this project copy**; `npm run build:exoplanets` on a machine with internet | |
| Pulsars | ATNF Pulsar Catalogue | check ATNF terms | **Not in this copy**; `npm run build:pulsars` | |
| Small bodies | JPL Small-Body Database API | NASA/JPL | **Not in this copy**; `npm run build:smallbodies` | |
| Quasars | SDSS DR16Q (Lyke et al. 2020, ApJS 250, 8) | SDSS data-use/citation policy: https://www.sdss4.org/collaboration/citing-sdss/ (not verified here) | Supplied by you locally (`Beyond Data/Quasars/DR16Q_v4.fits`). **I did not download or process it**; only a synthetic FITS was used for tests | Raw FITS must stay outside Git (`.gitignore` blocks `*.fits`) |
| Surface photographs | NASA/JPL images listed in `data/textureManifest.ts` | per-image; Mercury unverified, so not used | **None installed** | Credit shown only after the image loads |

Coordinate system for sky catalogues: ICRS/J2000 degrees unless a file says otherwise. Retrieval dates for datasets built on your machine are recorded in each generated `meta.json`.
