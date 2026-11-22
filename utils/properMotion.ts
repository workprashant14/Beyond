/**
 * Proper motion for the night-sky time slider.
 *
 * Model: the star moves in a straight line in space (constant velocity), seen from the Sun:
 *   u(t) = normalize(u0 + t * (pmra * e_ra + pmdec * e_dec + (rv / d) * u0)),
 * with t in years from J2000 and pmra already multiplied by cos(dec) (true angular rate, as in starphys.json).
 * The rv/d term is the radial motion (perspective); it needs a distance and a radial velocity. Without them (or when
 * rv is unknown) the star is moved on the plain tangent-plane model, which is the same as rv = 0.
 * Matches astropy's SkyCoord.apply_space_motion (ERFA pmsafe) in tests/fixtures/pm_oracle.json.
 * Not modelled: acceleration, light-time, binary orbits. Stars with no proper motion in the catalogue stay at their
 * J2000 place. The result is an Estimated position, not an observation.
 */
const D2R = Math.PI / 180;
/** Milliarcseconds to radians. */
export const MAS = D2R / 3600000;

/** km/s to parsecs per year (IAU: 1 pc = 3.0856775814914e13 km, Julian year 365.25 d). */
export const KMS_TO_PC_YR = 365.25 * 86400 / 3.0856775814914e13;

export function movedRaDec(raDeg: number, decDeg: number, pmra: number, pmdec: number, years: number, distPc?: number | null, rvKms?: number | null): { ra: number; dec: number } {
  const a = raDeg * D2R, d = decDeg * D2R;
  const [sa, ca, sd, cd] = [Math.sin(a), Math.cos(a), Math.sin(d), Math.cos(d)];
  const k = years * MAS;
  const radial = distPc && distPc > 0 && rvKms != null ? (rvKms * KMS_TO_PC_YR * years) / distPc : 0;
  const x = cd * ca * (1 + radial) + k * (pmra * -sa + pmdec * -sd * ca);
  const y = cd * sa * (1 + radial) + k * (pmra * ca + pmdec * -sd * sa);
  const z = sd * (1 + radial) + k * (pmdec * cd);
  return { ra: ((Math.atan2(y, x) / D2R) % 360 + 360) % 360, dec: Math.asin(Math.max(-1, Math.min(1, z / Math.hypot(x, y, z)))) / D2R };
}

export interface PmTable { pmra: ArrayLike<number | null>; pmdec: ArrayLike<number | null>; d?: ArrayLike<number | null>; rv?: ArrayLike<number | null> }

/** Moved RA/Dec (degrees) for every star; stars without a proper motion keep their catalogue place. */
export function movedPositions(ra: ArrayLike<number>, dec: ArrayLike<number>, pm: PmTable, years: number): { ra: Float64Array; dec: Float64Array } {
  const n = ra.length;
  const outRa = new Float64Array(n), outDec = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = pm.pmra[i], b = pm.pmdec[i];
    if (a === null || b === null || a === undefined || b === undefined || years === 0) { outRa[i] = ra[i]; outDec[i] = dec[i]; continue; }
    const m = movedRaDec(ra[i], dec[i], a, b, years, pm.d?.[i], pm.rv?.[i]);
    outRa[i] = m.ra; outDec[i] = m.dec;
  }
  return { ra: outRa, dec: outDec };
}

/** Largest angular move in degrees over `years` among stars with a proper motion (to tell whether the correction is visible). */
export function maxMoveDeg(pm: PmTable, years: number): number {
  let m = 0;
  for (let i = 0; i < pm.pmra.length; i++) {
    const a = pm.pmra[i], b = pm.pmdec[i];
    if (a == null || b == null) continue;
    m = Math.max(m, Math.hypot(a, b));
  }
  return (m * Math.abs(years) * MAS) / D2R;
}

/**
 * Index of the catalogue star each figure vertex sits on (-1 = none within tolerance). Figure vertices are
 * the J2000 places of the stars they join, so a vertex that matches a star is moved with it; others stay put.
 */
export function matchVertices(verts: [number, number][], ra: ArrayLike<number>, dec: ArrayLike<number>, tolDeg = 0.05): Int32Array {
  const out = new Int32Array(verts.length).fill(-1);
  const tol = tolDeg * D2R;
  const cut = Math.cos(tol);
  const vec = (r: number, d: number) => [Math.cos(d * D2R) * Math.cos(r * D2R), Math.cos(d * D2R) * Math.sin(r * D2R), Math.sin(d * D2R)];
  const sv = new Float64Array(ra.length * 3);
  for (let i = 0; i < ra.length; i++) sv.set(vec(ra[i], dec[i]), i * 3);
  verts.forEach(([r, d], k) => {
    const [x, y, z] = vec(r, d);
    let best = -1, bd = cut;
    for (let i = 0; i < ra.length; i++) {
      const dot = x * sv[i * 3] + y * sv[i * 3 + 1] + z * sv[i * 3 + 2];
      if (dot > bd) { bd = dot; best = i; }
    }
    out[k] = best;
  });
  return out;
}
