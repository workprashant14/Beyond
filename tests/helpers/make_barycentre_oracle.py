"""Regenerates tests/fixtures/barycentre-oracle.json (needs astropy): Sun and Earth-Moon-barycentre barycentric states from ERFA's built-in
ephemeris (epv00, an independent theory valid 1900-2100) for tests/statevectors.test.ts. Frame rotated ICRS -> mean ecliptic J2000
with the J2000 obliquity. Times are TDB. Units km and km/s."""
import json, numpy as np
from astropy.time import Time
from astropy.coordinates import solar_system_ephemeris, get_body_barycentric_posvel
EPS = np.radians(23.43928)
def ecl(v):
    x, y, z = v
    return [x, y*np.cos(EPS) + z*np.sin(EPS), -y*np.sin(EPS) + z*np.cos(EPS)]
rows = []
with solar_system_ephemeris.set("builtin"):
    for jd in [2415020.5, 2425000.5, 2433282.5, 2440000.5, 2446000.5, 2451545.0, 2455000.5, 2458849.5, 2460000.5, 2461000.5, 2465000.5, 2469000.5]:
        t = Time(jd, format="jd", scale="tdb")
        row = {"jd_tdb": jd}
        for body in ["sun", "earth-moon-barycenter"]:
            p, v = get_body_barycentric_posvel(body, t)
            row[body] = {"pos_km": [round(float(c), 3) for c in ecl([float(p.x.to("km").value), float(p.y.to("km").value), float(p.z.to("km").value)])],
                         "vel_km_s": [round(float(c), 9) for c in ecl([float(v.x.to("km/s").value), float(v.y.to("km/s").value), float(v.z.to("km/s").value)])]}
        rows.append(row)
json.dump({"_provenance": "astropy get_body_barycentric_posvel, solar_system_ephemeris 'builtin' (ERFA epv00), TDB, ecliptic J2000", "rows": rows}, open("tests/fixtures/barycentre-oracle.json", "w"), indent=1)
