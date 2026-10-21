# Public documentation and playground

This site runs the accepted `v0.0.0-beta.3` engine, independently of development
HEAD. The site itself is maintained on the `public-site` branch so autonomous
engine development on `master` cannot implicitly change the published demo.

The project is GPL 3.0 or later; see `LICENSE` and `NOTICE.md`. The deployed site
includes the full license and a corresponding-source archive for the pinned
engine plus the committed website/build sources. Original alpha tags are not
rewritten. Dataset licensing remains separate.

Build with Node 24+, npm, Python 3.12+ and Git:

```sh
python3 tools/package/build-site.py
python3 -m http.server 8000 --directory _site --bind 127.0.0.1
```

Open http://127.0.0.1:8000/. Relative URLs also support the `/jsqlite/` GitHub
Pages base path. Only `_site/` is deployed; no runtime state, research or
development tools are copied into the Pages artifact. Its SQLite fixture is
Chinook, whose MIT license is included separately.

Queries execute in a new dedicated worker per run. The UI can terminate that
worker, including after a sixty-second watchdog; this is a demo containment
mechanism, not proof of the engine's own cancellation semantics. The UI uses
textContent for SQL result cells, preserves duplicate column names and exact
INTEGER strings, and limits results to 1,000 rows. No telemetry, query backend,
remote user-database upload, or public npm publication is involved.

The example menu groups twelve queries into catalog browsing, store reports,
deeper analysis, and a small value-type reference. Each music-store question has
an explanation of its purpose and limits: long audio tracks, a classical
playlist, genre sizes, billing-country and customer sales, monthly totals,
album listening statistics, never-purchased tracks, and per-country invoice
rankings. SQL stays editable; selecting an example does not execute it.

`site/examples.js` is the single catalog used by the UI and browser regression.
The build content-addresses that module as well as the app/worker to avoid stale
cached menus. Every preset's ordered rows, column names and cell storage classes
are compared with a committed capture from the manifest-pinned SQLite on the
exact bundled Chinook fixture. To deliberately refresh SQL evidence:

```sh
python3 test/browser/capture-public-examples.py --library /path/to/pinned/libsqlite3.so
python3 tools/package/build-site.py
JSQLITE_PLAYWRIGHT=/path/to/playwright/index.mjs node test/browser/public-site.test.mjs
```

Review capture changes, including SQL and fixture/source identities; native
SQLite and Playwright are development tools only. The Pages job runs the actual
Chromium regression before deployment without needing a native oracle there.

Pages can compress static database responses, making the wire Content-Length
different from the decoded byte length. This demo downloads its fixed fixture,
then opens a local Blob URL with the exact decoded size and revokes it after
cleanup. No changes to the pinned engine or transport guarantees are implied.

Updating the pinned engine requires a deliberately validated release selection
and refreshed browser tests. Do not simply change the site to run dirty HEAD.
