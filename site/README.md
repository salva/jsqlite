# Public documentation and playground

This site runs the accepted `v0.0.0-alpha.5` engine, independently of development
HEAD. The site itself is maintained on the `public-site` branch so autonomous
engine development on `master` cannot implicitly change the published demo.

The project is GPL 3.0 or later; see `LICENSE` and `NOTICE.md`. The deployed site
includes the full license and a corresponding-source archive for the pinned
engine plus the committed website/build sources. The original alpha tag is not
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

Pages can compress static database responses, making the wire Content-Length
different from the decoded byte length. This demo downloads its fixed fixture,
then opens a local Blob URL with the exact decoded size and revokes it after
cleanup. No changes to the pinned engine or transport guarantees are implied.

Updating the pinned engine requires a deliberately validated release selection
and refreshed browser tests. Do not simply change the site to run dirty HEAD.
