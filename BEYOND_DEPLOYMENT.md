# BEYOND — Deployment notes (quasar data part; other parts in LAUNCH.md)

## Build the quasar data (your computer)
```
pip install astropy numpy
npm run build:quasars:fits -- --fits "..\Beyond Data\Quasars\DR16Q_v4.fits"
```
(`python` must be on PATH; on macOS/Linux call `python3 scripts/build_quasars_fits.py --fits ...`.)
Useful options: `--limit-rows 5000` (quick trial, page shows "TEST BUILD"), `--detail none` (index only), `--detail-out DIR` (write the large detail files somewhere else), `--no-hash` (skip the input sha256), `--chunk`, `--list-chunk`, `--detail-chunk`.
The script prints the output size when it finishes.

Measured on a **synthetic** stress file (750,414 rows x 182 columns, 845 MB, random numbers, not SDSS data) in a 2-core, 7 GB sandbox: 250 s, peak memory 1.1 GB; output index 60 MB (394 files), redshift+brightness lists 130 MB (3,002 files), detail 2.17 GB (3,002 files), meta.json 66 KB. The real DR16Q file is about twice as large (1.7 GB), so expect roughly 2 to 5 GB of detail and a longer run; your numbers will differ. The index+lists (~190 MB, 3,900 small files) are the part you may want in `public/`; host `detail/` separately.

## Hosting
* `index/`, `lists/`, `meta.json` are small per file (~100–300 KB) and fine in `public/quasars/`. Check the total before committing; GitHub rejects any single file over 100 MB and large repositories become slow.
* `detail/` can be hosted separately (object storage / CDN with gzip or brotli). Set `NEXT_PUBLIC_QUASAR_DETAIL_BASE=https://your-host/quasars-detail` at build time. It is a public URL, not a secret. If detail files are missing, the page still works and shows "The full record could not be loaded".
* The deployed site never needs the `Beyond Data` folder.
* Never commit `DR16Q_v4.fits` (`*.fits` is in `.gitignore`).

## Verify after deploying
Open `/quasars`: it should show the record count from `meta.json`; open one record and expand "Full catalogue record".
