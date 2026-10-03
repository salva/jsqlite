# Scoped real-browser coverage

Development-only runner; the page imports the existing built `/dist/index.js` ESM
and its full emitted JS closure, then uses actual browser Fetch against loopback
HTTP immutable fixture bytes. No native/WASM/server SQL evaluator or Fetch mock.
No package/build configuration is changed here. Coordinate artifact production
with [[card:card-v-a]]; passing an existing dist does not prove source freshness.

## Run

From repository root, provide `SAIVAGE_CARD_WORK_ROOT` for disposable tooling and
reports. Install Playwright as development tooling outside the runtime package
(the validated installation was `/opt/saivage-jsqlite2/node_modules/playwright`,
version 1.60.0). If unavailable, install into a purpose-named child of the work
root with npm, not into the runtime dependency graph. Then:

```sh
mkdir -p "$SAIVAGE_CARD_WORK_ROOT/browser-capability/tmp"
export TMPDIR="$SAIVAGE_CARD_WORK_ROOT/browser-capability/tmp"
export PLAYWRIGHT_BROWSERS_PATH="$SAIVAGE_CARD_WORK_ROOT/browser-capability/browsers"
export JSQLITE_PLAYWRIGHT=/opt/saivage-jsqlite2/node_modules/playwright/index.mjs
node /opt/saivage-jsqlite2/node_modules/playwright/cli.js install chromium
node /opt/saivage-jsqlite2/node_modules/playwright/cli.js install-deps chromium
# Optional: existing local Chinook bytes, verified against the public descriptor.
export JSQLITE_CHINOOK=.saivage/work/cards/card-e-h/chinook-fixture/Chinook_Sqlite.sqlite
timeout 180s node test/browser/run.mjs
```

Installation may require network/system-package privileges; **test execution
requires no live network**. All non-test-origin browser requests are aborted.
Fixtures are exact allowlisted bytes; HTTP handlers accept no SQL or filesystem
paths from requests. CSP restricts scripts/connect to self. Service workers are
blocked. Chinook use is permitted by `CHINOOK-LICENSE.md` (Luis Rocha notice,
fetched from upstream LICENSE.md); bytes are not vendored by this test. Without
`JSQLITE_CHINOOK` the case is omitted explicitly in report selection metadata.

`JSQLITE_BROWSER_CASE` optionally filters IDs; filtering is reported, not a full
suite pass. Each case uses a fresh context, 5s navigation and 15s evaluation
watchdog. External 180s process timeout is essential: context close/setup is not
independently watchdog-bounded. Nonzero exit or external timeout must not be
interpreted as passing unexecuted cases. The runner saves completed cases to
`$SAIVAGE_CARD_WORK_ROOT/browser-e2e/report.json`; it overwrites that file per
run. Archive it separately if needed. A setup failure can precede report creation.
The report inventories every served emitted JS module SHA256, physical fixture
encoding/digest, native capture hashes, source ID, selection, browser/tool version,
requests and per-case pass/fail/timeout. No monolithic runner is invoked.

## Assertion provenance and scope

Assertions were authored before harness execution. Ordered native captures are
reused for aggregate, multisource joins, derived subquery, window success and
ntile error, and exact primary index lookup in all three encodings. Capture IDs
and owning source test assertions remain in per-case provenance. CTE lexical
shadowing reuses the public with1-3.4 discriminator. Browser controls/lifecycle
are contract assertions, not new upstream compatibility credit. No plan-selection
credit is inferred from public index rows.

`capture-json.py` is a separate development-only ctypes capture against the
pinned native library: it verifies source ID, opens the CURRENT empty fixture
read-only and captures ordered metadata and tagged values. Reproduce with:

```sh
python3 test/browser/capture-json.py /path/to/pinned/libsqlite3-oracle.so > test/browser/json-native.json
```

JSON expectations follow pinned `src/json.c` jsonValidFunc NULL/JSON5 flag and
jsonExtractFunc scalar value paths, plus the existing JSON foundation tests.
Native captures, not browser output, own expectations. REAL uses IEEE754 bits,
INTEGER decimal bigint, TEXT UTF8 bytes, BLOB bytes and NULL explicit tags.
Public columnType and ordered metadata are checked without numeric coercion.
Reset re-executes captures. Three-encoding lifecycle checks bind copies, retained
bindings, clear, BUSY close, zombie closeDeferred, statement finalize and misuse.
Control cases test host-timer cancellation during yielding work, overlap rejection,
deadline, work, rows, result bytes, private entries and file bytes, malformed file
and HTTP errors, saved reset errors and connection reuse. Cleanup continues after
errors and keeps the primary error.

## Evidence and limitations

Chromium 148.0.7778.96 executed 29/29 scoped cases successfully (including two
independently native-captured JSON cases and optional licensed Chinook count).
Earlier harness setup failed on selecting a prepare-error window capture as a
success; corrected to native success window1-7.3 without changing expectations.
No engine failure was found. These are representative assertions, **not global
acceptance**, not a new upstream assertion denominator. Independent acceptance
remains required. Only Chromium tested; existing dist freshness is unestablished.
No exhaustive prepare-error, corruption/CORS/stream-failure, key/aggregate-byte
limits, temporal native parity or whole upstream suite claim. Preserve future
native expectation failures and report reproductions to original/root owners,
never rewrite expected values for engine defects.
