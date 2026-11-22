"""Regenerates tests/fixtures/time-oracle.json (needs astropy): TT-UTC and TDB-TT from ERFA for tests/timescales.test.ts."""
import json
from astropy.time import Time
rows = []
for jd in [2441317.5, 2441499.5, 2443144.5, 2446247.5, 2451544.5, 2451545.0, 2453736.5, 2455000.0, 2457204.5, 2457754.5, 2460000.5, 2461000.5, 2465000.5]:
    t = Time(jd, format="jd", scale="utc")
    rows.append({"jd_utc": jd, "tt_minus_utc": round(float((t.tt.jd - t.jd) * 86400), 6), "tdb_minus_tt": round(float((t.tdb.jd - t.tt.jd) * 86400), 9)})
json.dump({"_provenance": "astropy (ERFA) Time(jd, scale='utc') -> tt, tdb", "rows": rows}, open("tests/fixtures/time-oracle.json", "w"), indent=1)
