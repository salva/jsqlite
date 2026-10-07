# Public alpha.5 deployment

Owner authorized GitHub publication and Pages replacement on 2026-10-07.
Accepted release source: `a3eb29659c793f630a9bd1a9c2b89836bf9bbe52`;
version/tag: `0.0.0-alpha.5` / `v0.0.0-alpha.5`.
Original accepted package SHA256:
`075ba9862fde401d5223da940c7e6549fe0aadc935415326cce104239c320514`.
The package is published unchanged, with GPL license/notice supplied alongside it.
Alpha.4 is preserved. No npm registry publication or Saivage deployment change.

Pages builds only the accepted committed release, not the later STAT4 development
commits or autonomous dirty/index changes. Engine module paths now include the
release commit prefix, avoiding stale cached modules across releases. The demo's
60-second worker watchdog and acquisition adapter remain unchanged.

Validation before publication:

- `python3 tools/package/build-site.py`: pass, pinned alpha.5 build.
- `JSQLITE_PLAYWRIGHT=/home/salva/g/ml/tmp/jsqlite-public-browser/node_modules/playwright/index.mjs JSQLITE_SITE_CHROMIUM=/usr/bin/chromium-browser node test/browser/public-site.test.mjs`:
  pass (gzip transfer, base path, rows/types/errors, cancellation/reuse, mobile,
  license/source links). Original Chinook aggregate query: 575 ms including
  worker/open/prepare/render, ten ordered rows matching native SQLite.
- Gitleaks 8.30.1, `origin/master..development/master`: 46 commits, 37 findings,
  all inspected as SHA file-identity values in evidence manifests, not credentials.
  No tracked canonical `.saivage` or `.saivage-work` state.

Existing alpha.5 independent acceptance and package/native/browser evidence remain
the release authority. These public-site tests are not new whole-engine certification.
