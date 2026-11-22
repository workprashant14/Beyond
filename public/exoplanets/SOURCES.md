# Exoplanet data

Source: NASA Exoplanet Archive, table pscomppars (NASA Exoplanet Archive TAP service).
Built: 2026-11-22T21:04:45.387Z
Planets: 6473
Query: `select pl_name,hostname,discoverymethod,disc_year,pl_orbper,pl_orbsmax,pl_rade,pl_bmasse,pl_eqt,sy_snum,sy_pnum,sy_dist,sy_vmag,st_spectype,st_teff,ra,dec,pl_controv_flag,pl_orbpererr1,pl_orbpererr2,pl_orbperlim,pl_orbper_reflink,pl_orbsmaxerr1,pl_orbsmaxerr2,pl_orbsmaxlim,pl_orbsmax_reflink,pl_radeerr1,pl_radeerr2,pl_radelim,pl_rade_reflink,pl_bmasseerr1,pl_bmasseerr2,pl_bmasselim,pl_bmasse_reflink,pl_eqterr1,pl_eqterr2,pl_eqtlim,pl_eqt_reflink,pl_bmassprov from pscomppars order by pl_name`

The composite table picks each parameter independently, so one row can mix values from different publications; each parameter's own reference is kept in `u`.

## Fields

Basic fields keep their short names (see `utils/exoplanets.ts`). Measurement detail is stored per parameter in the optional object `u`:

| Parameter (short key) | Value column | `e1` upper error | `e2` lower error | `l` limit flag | `r` reference |
|---|---|---|---|---|---|
| Orbital period (`p`) | pl_orbper | pl_orbpererr1 | pl_orbpererr2 | pl_orbperlim | pl_orbper_reflink |
| Semi-major axis (`a`) | pl_orbsmax | pl_orbsmaxerr1 | pl_orbsmaxerr2 | pl_orbsmaxlim | pl_orbsmax_reflink |
| Radius (`r`) | pl_rade | pl_radeerr1 | pl_radeerr2 | pl_radelim | pl_rade_reflink |
| Mass (`ms`) | pl_bmasse | pl_bmasseerr1 | pl_bmasseerr2 | pl_bmasselim | pl_bmasse_reflink |
| Equilibrium temperature (`t`) | pl_eqt | pl_eqterr1 | pl_eqterr2 | pl_eqtlim | pl_eqt_reflink |

- `mp`: mass provenance (`pl_bmassprov`), e.g. Mass or M*sin(i).
- `c`: `pl_controv_flag` (1 = the confirmation status has been questioned in the published literature).
- A key inside `u` exists only when the archive supplied that piece. Missing uncertainty is absent, never 0. `e2` keeps the archive's sign (normally negative).
- `l` is the raw limit flag. `1` is shown as an upper limit; any other non-zero flag is shown raw and uninterpreted, because the archive documentation read for this project does not define the values.
- `r` is reduced to plain text (`l`), an optional validated http(s) link (`u`) and, for the archive's CALCULATED_VALUE marker, `k: "calc"`. HTML from the archive is never kept.

The archive asks users to acknowledge it: https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html

## Build statistics

```json
{
  "records": 6473,
  "duplicates": 0,
  "parameterValues": 30885,
  "valuesWithNoUncertainty": 10836,
  "valuesWithNoReference": 0,
  "limitFlags": {
    "0": 30629,
    "1": 228,
    "-1": 28
  },
  "massProvenance": {
    "Msini": 925,
    "Mass": 2498,
    "Msin(i)/sin(i)": 15,
    "M-R relationship": 3035
  },
  "controversial": 58,
  "recordsWithMeasurementDetail": 6473
}
```
