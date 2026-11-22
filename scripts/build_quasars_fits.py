#!/usr/bin/env python3
"""
Converts the SDSS DR16Q FITS catalogue (DR16Q_v4.fits, 750,414 rows x 183 columns) into website-ready chunks.
The original FITS file is only READ; it must stay outside the repository.

  python scripts/build_quasars_fits.py --fits "../Beyond Data/Quasars/DR16Q_v4.fits"
  npm run build:quasars:fits -- --fits "..\\Beyond Data\\Quasars\\DR16Q_v4.fits"

Needs:  pip install astropy numpy

Output (default public/quasars/, detail default public/quasars/detail/):
  meta.json             format "chunked", counts, every FITS column (name, format, unit, null, dim), chunk table (bounding boxes),
                        sentinel notes, provenance, citation
  index/NNNN.json       columnar index records (n, ra, dec, z, m, f), sorted by (declination band, RA, original row)
  lists/z/NNNN.json     the same index records again, in redshift order (highest first), LIST_CHUNK per file, so one page of
                        "highest redshift" is one small request instead of dozens (records without a redshift are not listed)
  lists/mag/NNNN.json   likewise in brightness order (brightest first; records without a usable magnitude are not listed)
  detail/NNNNNN.json    ALL columns of the original record for DETAIL_CHUNK consecutive positions (lazy loaded one at a time)

Rules followed:
  * No record is dropped. A record whose RA/Dec is not a finite, in-range number goes to the "unplaced" group (ra/dec null) and is counted.
  * Values are stored as read. NaN and the FITS null value (TNULLn) become JSON null. No other value is treated as invalid: a negative
    number is NOT assumed to be a sentinel (SDSS defines meaning per column, see BEYOND_DATA_DICTIONARY.md).
  * Output is deterministic: the same input and options give byte-identical chunk files (only meta.built differs; pass --built to fix it).
  * The only judgement used is for ORDERING: a PSFMAG value <= 0 is not a physical apparent magnitude of a quasar, so it is left out of
    lists/mag. The stored value is unchanged. The count is reported in meta.json (counts.magnitude_not_ordered).
"""
import argparse, hashlib, json, math, os, sys, datetime
import numpy as np

CHUNK = 2_000           # max index records per chunk file (~120 KB each; small enough that a designation or cone search loads few chunks)
DETAIL_CHUNK = 250      # consecutive positions per detail file
LIST_CHUNK = 500        # records per file in the redshift / brightness lists
FORMAT_VERSION = 1

# Column names are matched case-insensitively against this list. The first match wins; the choice is printed and stored in meta.json.
CANDIDATES = {
    "name": ["SDSS_NAME", "SDSSJ", "SDSS_NAME_DR16", "NAME"],
    "ra": ["RA", "RAJ2000"],
    "dec": ["DEC", "DEJ2000", "DECJ2000"],
    "z": ["Z", "Z_PIPE"],
    "flag": ["IS_QSO_FINAL"],
    "mag": ["PSFMAG"],
}
MAG_BAND_INDEX = 3  # SDSS u,g,r,i,z -> i is index 3. Only used when the column has exactly 5 elements.

# Sentinel meanings that were read from the DR16Q paper (Lyke et al. 2020, Section 8 / 3.x / 7.3). Shown to the user, never applied silently.
SENTINEL_NOTES = {
    "IS_QSO_FINAL": "values of 0 or less denote non-quasars (superset only; the quasar-only file contains selected quasars)",
    "Z_VI": "-999 = possible blazar, no meaningful redshift from an emission feature; -1 = not visually inspected",
    "Z_CONF": "-1 = not visually inspected; 0 = inspected but no confident redshift or classification",
    "THING_ID": "-1 = no THING_ID was assigned",
    "BAL_PROB": "-1 = redshift too low for a detection within the spectroscopic wavelength range",
    "QN_*": "-1 = not processed by QuasarNET (column-specific; check the data model)",
    "GALEX_MATCHED / UKIDSS_MATCHED / FIRST_MATCHED / GAIA_MATCHED": "1 = found in that catalogue, 0 = not found",
    "UNWISE flux": "-1 in both bands for the 1001 quasars not identified with SDSS imaging",
    "DLA parameters": "-1 in the first element = outside the redshift range for DLA systems; all -1 = no DLA detected",
}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def pick(names_upper, key, override):
    if override:
        if override.upper() not in names_upper:
            raise SystemExit(f"column '{override}' not found. The file has: {', '.join(names_upper.values())}")
        return names_upper[override.upper()]
    for c in CANDIDATES[key]:
        if c in names_upper:
            return names_upper[c]
    return None


def jsonable(arr):
    """numpy array -> python list, NaN -> None, shortest float32 text, bytes -> str. Vector columns become nested lists."""
    a = np.asarray(arr)
    if a.dtype.kind in "SU":
        flat = [x.decode("ascii", "replace").strip() if isinstance(x, bytes) else str(x).strip() for x in a.reshape(-1)]
        return np.array(flat, dtype=object).reshape(a.shape).tolist()
    if a.dtype.kind == "f":
        out = np.empty(a.shape, dtype=object)
        flat_in, flat_out = a.reshape(-1), out.reshape(-1)
        is32 = a.dtype.itemsize == 4
        for i, v in enumerate(flat_in):
            if not math.isfinite(v):
                flat_out[i] = None            # NaN / inf are not representable in JSON; recorded as null
            else:
                flat_out[i] = float(str(v)) if is32 else float(v)   # str(float32) is the shortest text that round-trips
        return out.tolist()
    if a.dtype.kind == "b":
        return a.astype(int).tolist()
    return a.tolist()


def dumps(obj):
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=True, allow_nan=False, sort_keys=True)


def write(path, text, mode="w"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, mode) as f:
        f.write(text)
    os.replace(tmp, path)


def sha256_of(path, limit=None):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(1 << 24)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fits", required=True, help="path to DR16Q_v4.fits (read only)")
    ap.add_argument("--out", default="public/quasars")
    ap.add_argument("--detail-out", default=None, help="default <out>/detail; put it elsewhere to host the large files separately")
    ap.add_argument("--detail", choices=["all", "none"], default="all")
    ap.add_argument("--hdu", type=int, default=1)
    ap.add_argument("--limit-rows", type=int, default=None, help="TEST ONLY: use only the first N rows; recorded in meta.json")
    ap.add_argument("--source", default="SDSS DR16Q quasar catalogue (Lyke et al. 2020, ApJS 250, 8; 2020ApJS..250....8L)")
    ap.add_argument("--built", default=None, help="timestamp for meta.built (default: now); fix it to get byte-identical meta.json")
    ap.add_argument("--chunk", type=int, default=CHUNK, help="max index records per chunk file")
    ap.add_argument("--detail-chunk", type=int, default=DETAIL_CHUNK, help="positions per detail file")
    ap.add_argument("--list-chunk", type=int, default=LIST_CHUNK, help="records per redshift/brightness list file")
    ap.add_argument("--no-hash", action="store_true", help="skip the sha256 of the input file")
    for k in CANDIDATES:
        ap.add_argument(f"--{k}-col", default=None)
    args = ap.parse_args()

    try:
        from astropy.io import fits
    except ImportError:
        raise SystemExit("astropy is required: pip install astropy numpy")

    CHUNK_N, DETAIL_N = args.chunk, args.detail_chunk
    LIST_N = args.list_chunk
    if CHUNK_N < 1 or DETAIL_N < 1 or LIST_N < 1:
        raise SystemExit("--chunk and --detail-chunk must be positive")
    detail_out = args.detail_out or os.path.join(args.out, "detail")
    log(f"reading {args.fits}")
    hdul = fits.open(args.fits, memmap=True, mode="readonly")
    hdu = hdul[args.hdu]
    cols = hdu.columns
    total_rows = int(hdu.header["NAXIS2"])
    n_cols = len(cols)
    N = total_rows if args.limit_rows is None else min(total_rows, args.limit_rows)
    log(f"FITS table: {total_rows} rows x {n_cols} columns" + (f" (using first {N}: TEST MODE)" if N != total_rows else ""))

    names_upper = {c.name.upper(): c.name for c in cols}
    if len(names_upper) != n_cols:
        raise SystemExit("duplicate column names (case-insensitive) in the FITS file; refusing to guess")
    use = {k: pick(names_upper, k, getattr(args, f"{k}_col")) for k in CANDIDATES}
    miss = [k for k in ("name", "ra", "dec", "z") if not use[k]]
    if miss:
        raise SystemExit(f"could not find a column for: {', '.join(miss)}. The file has: {', '.join(c.name for c in cols)}. Use --name-col --ra-col --dec-col --z-col.")
    log("columns used: " + ", ".join(f"{k}={v}" for k, v in use.items()))

    data = hdu.data

    def column(name, n=N):
        return np.asarray(data[name][:n])

    # ---- index columns (small: 6 columns x N rows) ----
    name = [x.decode("ascii", "replace").strip() if isinstance(x, bytes) else str(x).strip() for x in column(use["name"])]
    ra = column(use["ra"]).astype(np.float64)
    dec = column(use["dec"]).astype(np.float64)
    z_raw = column(use["z"])          # original dtype is kept for output (float32 stays float32 text)
    z = z_raw.astype(np.float64)
    flag = column(use["flag"]) if use["flag"] else None
    mag = mag_raw = None
    if use["mag"]:
        m = column(use["mag"])
        if m.ndim == 2 and m.shape[1] == 5:
            mag_raw = m[:, MAG_BAND_INDEX]
            mag = mag_raw.astype(np.float64)
            log(f"magnitude: {use['mag']}[{MAG_BAND_INDEX}] (i band of u,g,r,i,z)")
        else:
            log(f"{use['mag']} does not have 5 elements; magnitudes skipped")

    # TNULL handling for the index integer column(s)
    nulls = {c.name: c.null for c in cols if getattr(c, "null", None) is not None}
    if flag is not None and use["flag"] in nulls:
        flag_null = flag == nulls[use["flag"]]
    else:
        flag_null = None

    placed = np.isfinite(ra) & np.isfinite(dec) & (ra >= 0) & (ra < 360) & (dec >= -90) & (dec <= 90)
    unplaced = int((~placed).sum())
    band = np.where(placed, np.floor((np.where(placed, dec, 0) + 90.0) / 5.0).astype(np.int64), 99)
    band = np.minimum(band, np.where(placed, 35, 99))  # dec = +90 falls in the last band
    rowid = np.arange(N)
    # deterministic order: band, then RA, then original row number
    order = np.lexsort((rowid, np.where(placed, ra, 0.0), band))
    log(f"sorted {N} records into declination bands; unplaced (no valid RA/Dec) = {unplaced}")

    # chunk table: chunks never cross a band, so bounding boxes stay tight
    chunks, pos = [], 0
    sorted_band = band[order]
    starts = np.flatnonzero(np.r_[True, sorted_band[1:] != sorted_band[:-1]])
    ends = np.r_[starts[1:], N]
    for s, e in zip(starts, ends):
        for a in range(int(s), int(e), CHUNK_N):
            b = min(a + CHUNK_N, int(e))
            rows = order[a:b]
            ok = placed[rows]
            ch = {"pos0": a, "n": b - a, "band": int(sorted_band[a])}
            if ok.any():
                ch.update(ra0=float(ra[rows][ok].min()), ra1=float(ra[rows][ok].max()), dec0=float(dec[rows][ok].min()), dec1=float(dec[rows][ok].max()))
            chunks.append(ch)

    for i, ch in enumerate(chunks):
        rows = order[ch["pos0"]: ch["pos0"] + ch["n"]]
        rec = {
            "pos0": ch["pos0"],
            "n": [name[r] for r in rows],
            "ra": [float(ra[r]) if np.isfinite(ra[r]) else None for r in rows],   # raw value kept even if the record is "unplaced"
            "dec": [float(dec[r]) if np.isfinite(dec[r]) else None for r in rows],
            "z": jsonable(z_raw[rows]),
            "m": jsonable(mag_raw[rows]) if mag is not None else None,
            "f": ([None if (flag_null is not None and flag_null[r]) else int(flag[r]) for r in rows] if flag is not None else None),
        }
        write(os.path.join(args.out, "index", f"{i:04d}.json"), dumps(rec))
    log(f"wrote {len(chunks)} index chunks")

    # ---- sorted lists (redshift, brightness): index records repeated in sorted order so a page is one small file ----
    def index_record(pos_list, rows):
        return {
            "pos": [int(x) for x in pos_list],
            "n": [name[r] for r in rows],
            "ra": [float(ra[r]) if np.isfinite(ra[r]) else None for r in rows],
            "dec": [float(dec[r]) if np.isfinite(dec[r]) else None for r in rows],
            "z": jsonable(z_raw[rows]),
            "m": jsonable(mag_raw[rows]) if mag is not None else None,
            "f": ([None if (flag_null is not None and flag_null[r]) else int(flag[r]) for r in rows] if flag is not None else None),
        }

    def write_list(kind, sorted_pos):
        for i, a in enumerate(range(0, len(sorted_pos), LIST_N)):
            sp = sorted_pos[a: a + LIST_N]
            write(os.path.join(args.out, "lists", kind, f"{i:04d}.json"), dumps(index_record(sp, order[sp])))
        return (len(sorted_pos) + LIST_N - 1) // LIST_N

    zz = z[order]
    zi = np.flatnonzero(np.isfinite(zz))
    zsort = zi[np.lexsort((zi, -zz[zi]))]
    z_files = write_list("z", zsort)
    mag_not_ordered = None
    mag_count = 0
    mag_files = 0
    if mag is not None:
        mm = mag[order]
        finite = np.isfinite(mm)
        ok = finite & (mm > 0)
        mag_not_ordered = int((~ok).sum())
        mi = np.flatnonzero(ok)
        mag_count = int(len(mi))
        msort = mi[np.lexsort((mi, mm[mi]))]
        mag_files = write_list("mag", msort)
        log(f"magnitude: {int(finite.sum())} finite, {int((finite & (mm <= 0)).sum())} with value <= 0 left out of the ordering (stored unchanged), min={float(np.nanmin(mm[ok])) if ok.any() else None}, max={float(np.nanmax(mm[ok])) if ok.any() else None}")
    log(f"wrote {z_files} redshift list files and {mag_files} brightness list files")

    # ---- detail chunks: every column, original values, row-wise arrays aligned with meta.columns ----
    n_detail = 0
    if args.detail == "all":
        names = [c.name for c in cols]
        for d0 in range(0, N, DETAIL_N):
            rows = order[d0: d0 + DETAIL_N]
            srt = np.sort(rows)                      # fancy-index in file order for memmap speed, then restore
            back = np.searchsorted(srt, rows)
            sub = data[srt]
            per_col = []
            for nm in names:
                col = np.asarray(sub[nm])
                nul = nulls.get(nm)
                if nul is not None and col.dtype.kind in "iu":
                    colj = col.astype(object)
                    colj[col == nul] = None
                    colj = colj.tolist()
                else:
                    colj = jsonable(col)
                per_col.append([colj[j] for j in back])
            rec = {"pos0": d0, "rows": [[per_col[c][r] for c in range(len(names))] for r in range(len(rows))]}
            write(os.path.join(detail_out, f"{d0 // DETAIL_N:06d}.json"), dumps(rec))
            n_detail += 1
            if n_detail % 100 == 0:
                log(f"detail chunks: {n_detail}/{(N + DETAIL_N - 1) // DETAIL_N}")
        log(f"wrote {n_detail} detail chunks to {detail_out}")

    # ---- duplicates (reported, never removed) ----
    seen, dup = set(), 0
    for nm in name:
        if nm in seen:
            dup += 1
        seen.add(nm)

    meta = {
        "format": "chunked",
        "version": FORMAT_VERSION,
        "source": args.source,
        "band": "i" if mag is not None else None,
        "built": args.built or datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "input": {
            "file": os.path.basename(args.fits),
            "sha256": None if args.no_hash else sha256_of(args.fits),
            "rows": total_rows,
            "columns": n_cols,
            "rows_used": N,
            "test_limit": args.limit_rows,
        },
        "count": N,
        "counts": {
            "input_rows": total_rows,
            "output_records": N,
            "unplaced_no_valid_ra_dec": unplaced,
            "duplicate_names": dup,
            "redshift_ordered": int(len(zsort)),
            "magnitude_ordered": mag_count,
            "magnitude_not_ordered": mag_not_ordered,
            "index_chunks": len(chunks),
            "list_files_z": z_files,
            "list_files_mag": mag_files,
            "detail_chunks": n_detail,
        },
        "chunkMax": CHUNK_N,
        "listChunk": LIST_N,
        "detailChunk": DETAIL_N,
        "hasDetail": args.detail == "all",
        "columnsUsed": use,
        "magnitudeNote": "i-band PSFMAG as catalogued (SDSS asinh-style magnitudes are not corrected or converted); null when absent",
        "ordering": "chunks are sorted by (5-degree declination band, RA, original row); unplaced records form band 99",
        "chunks": chunks,
        "columns": [
            {"name": c.name, "format": str(c.format), "unit": (str(c.unit) if c.unit else None), "null": (int(c.null) if getattr(c, "null", None) is not None else None), "dim": getattr(c, "dim", None)}
            for c in cols
        ],
        "sentinelNotes": SENTINEL_NOTES,
        "citation": "Lyke, B. W. et al. 2020, The Astrophysical Journal Supplement Series, 250, 8 (2020ApJS..250....8L). Data: SDSS. See https://www.sdss4.org/dr16/algorithms/qso_catalog/",
        "licence": "Not bundled with this project. Check SDSS data-use terms (https://www.sdss4.org/collaboration/citing-sdss/) before publishing derived files.",
    }
    write(os.path.join(args.out, "meta.json"), json.dumps(meta, separators=(",", ":"), ensure_ascii=True, allow_nan=False))
    def folder_mb(sub):
        tot = 0
        for r, _, fs in os.walk(sub):
            tot += sum(os.path.getsize(os.path.join(r, f)) for f in fs)
        return tot / 1e6
    sizes = {"index": folder_mb(os.path.join(args.out, "index")), "lists": folder_mb(os.path.join(args.out, "lists")), "detail": folder_mb(detail_out) if os.path.isdir(detail_out) else 0}
    log("output size (MB, uncompressed): " + ", ".join(f"{k}={v:.1f}" for k, v in sizes.items()) + "  (GitHub rejects single files over 100 MB; every file here is far smaller, but check the TOTAL before committing)")
    log(f"done: {N} of {total_rows} records, {unplaced} unplaced, {dup} duplicate names, {len(chunks)} index chunks, {n_detail} detail chunks")
    hdul.close()


if __name__ == "__main__":
    main()
