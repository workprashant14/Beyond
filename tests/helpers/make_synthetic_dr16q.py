"""SYNTHETIC test FITS shaped like DR16Q (invented values, a handful of the real column names). Never real SDSS data."""
import sys
import numpy as np
from astropy.io import fits

out, n = sys.argv[1], int(sys.argv[2])
rng = np.random.default_rng(12345)
ra = rng.uniform(0, 360, n); dec = np.degrees(np.arcsin(rng.uniform(-1, 1, n)))
z = rng.uniform(0.1, 5, n).astype("f4")
psf = rng.uniform(17, 22, (n, 5)).astype("f4")
flag = rng.integers(0, 3, n).astype("i4")
def desig(r, d):
    h = r / 15.0
    hh = int(h); mm = int((h - hh) * 60); ss = ((h - hh) * 60 - mm) * 60
    ad = abs(d); dd = int(ad); dm = int((ad - dd) * 60); ds = ((ad - dd) * 60 - dm) * 60
    # truncated (not rounded) to 0.01 s and 0.1 arcsec, like SDSS designations
    return f"{hh:02d}{mm:02d}{int(ss*100)/100:05.2f}{'+' if d >= 0 else '-'}{dd:02d}{dm:02d}{int(ds*10)/10:04.1f}"

names = np.array([desig(r, d) for r, d in zip(ra, dec)])
# deliberate edge cases (all synthetic)
ra[0] = np.nan                 # unplaced
z[1] = np.nan                  # no redshift
z[2] = -1.0                    # negative value must NOT be treated as invalid
psf[3, 3] = -9999.0            # impossible magnitude: stored unchanged, left out of brightness ordering
flag[4] = -2147483648          # FITS null (TNULL) for the flag column
names[6] = names[5]            # duplicate name: reported, not removed
dec[7] = 90.0                  # edge of the last band
zvi = rng.uniform(0, 5, n).astype("f4"); zvi[8] = -999.0
cols = [
    fits.Column(name="SDSS_NAME", format="24A", array=names),
    fits.Column(name="RA", format="D", unit="deg", array=ra),
    fits.Column(name="DEC", format="D", unit="deg", array=dec),
    fits.Column(name="Z", format="E", array=z),
    fits.Column(name="IS_QSO_FINAL", format="J", null=-2147483648, array=flag),
    fits.Column(name="PSFMAG", format="5E", unit="mag", array=psf),
    fits.Column(name="Z_VI", format="E", array=zvi),
    fits.Column(name="THING_ID", format="K", array=np.arange(n, dtype="i8")),
]
fits.HDUList([fits.PrimaryHDU(), fits.BinTableHDU.from_columns(cols)]).writeto(out, overwrite=True)
