"""Regenerates tests/fixtures/planets-oracle.json (needs astropy). Independent low-precision planet positions for tests/ephemeris.test.ts."""
import json, numpy as np, astropy.units as u
from astropy.time import Time
from astropy.coordinates import get_body_barycentric, solar_system_ephemeris
solar_system_ephemeris.set("builtin")
eps = np.radians(84381.406 / 3600)
def ecl(v):
    c, s = np.cos(eps), np.sin(eps)
    return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c]
out = []
for jd in [2415020.5, 2433282.5, 2451545.0, 2461000.5, 2469807.5]:
    t = Time(jd, format="jd", scale="tdb")
    sun = get_body_barycentric("sun", t)
    row = {"jd": jd, "bodies": {}}
    for b, n in [("mercury", "mercury"), ("venus", "venus"), ("earth-moon-barycenter", "earth"), ("mars", "mars"), ("jupiter", "jupiter"), ("saturn", "saturn"), ("uranus", "uranus"), ("neptune", "neptune")]:
        p = get_body_barycentric(b, t) - sun
        row["bodies"][n] = [round(float(x), 9) for x in ecl([p.x.to(u.au).value, p.y.to(u.au).value, p.z.to(u.au).value])]
    out.append(row)
json.dump({"_provenance": "see tests/ephemeris.test.ts", "dates": out}, open("tests/fixtures/planets-oracle.json", "w"), indent=1)
