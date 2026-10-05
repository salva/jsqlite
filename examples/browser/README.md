# Static browser demo

## Private installed-alpha verification

For alpha scaffold/candidate verification use the independently installed local
versioned tarball path, **not** the worktree commands below. See
[installed-demo harness and release-note scaffold](../../docs/research/card-v-c-installed-alpha-demo.md)
for explicit-commit packaging, actual offline installation, hashes/input identities
and browser rerun. Final stabilized reviewed candidate verification is pending;
the scaffold is not alpha acceptance. The same page/query consumer is reused,
with only its copied engine import pointing to installed package ESM.

## Worktree development preview (not alpha certification)

From repository root (Node 24, Python 3 for static HTTP only):

```sh
npm ci
npm run build
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/examples/browser/index.html>. Serve the repository
root, including the complete `dist/` tree. Do not use `file://`. Choose Album /
Track join or the type discriminator and click Run. SQL is editable; only the
captured queries have expected results. The failed-open button deliberately
requests an absent local file. Errors and operation/finalize/close diagnostics
are visible. Every run acquires a fresh connection and destroys its handles.

`query.js` uses only public named `open`/`JSQLiteError`, prepare/step, indexed
metadata/column access, finalize and close. Rows are positional, not keyed by
column names. INTEGER decimal strings are labeled separately from REAL numbers
(including integral REAL), NULL, TEXT and BLOB hexadecimal bytes. This rendering
is for display, not a replacement API value contract. The table and query data
are inserted with `textContent`, not interpreted as HTML.

## Immutable inputs and expectations

`chinook.sqlite` is the existing digest-bound Chinook snapshot, copied without
modification: 1,007,616 bytes, SHA256
`7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`.
[Original descriptor](../../test/fixtures/public/chinook.json) records provenance;
[MIT notice](CHINOOK-LICENSE.md) accompanies this copy. No runtime download from
its provenance URL occurs. `expected.json` includes that descriptor, the pinned
SQLite source ID, exact SQL, ordered column names and typed ordered rows.
The `.sql` files are development capture inputs; the UI takes SQL and expectations
from the same capture. No native/oracle code is imported by the app.

Native expectations can be independently recaptured using the library built by
[oracle instructions](../../docs/oracle.md):

```sh
python3 test/demo/capture.py /path/to/pinned/libsqlite3-oracle.so > "$SAIVAGE_CARD_WORK_ROOT/demo-recapture.json"
cmp examples/browser/expected.json "$SAIVAGE_CARD_WORK_ROOT/demo-recapture.json"
```

The capture asserts the native source ID and snapshot digest before read-only
execution. Real browser regression (development Playwright installation; see
[browser tooling](../../test/browser/README.md)):

```sh
JSQLITE_PLAYWRIGHT=/path/to/playwright/index.mjs \
JSQLITE_CHROMIUM=/path/to/chromium/chrome node test/demo/browser.test.mjs
```

This starts a loopback static-file server and aborts non-origin browser requests.
The test checks actual app controls, ordered typed rows, metadata positions,
failed open, prepare/step failure and cleanup. One injected-handle test checks
independent secondary errors; it is not native conformance credit.

This is a bounded manual smoke demo, not full SQLite/release acceptance.
[API](../../docs/api.md), [current translation guidance](../../docs/TRANSLATION.md)
and [evidence](../../docs/research/card-v-c-demo-evidence.md) explain limits.
The chosen join is proven in the current browser; aggregate/subquery variants
attempted during development did not meet this smoke demo's latency/admission
needs and are not silently claimed here.
