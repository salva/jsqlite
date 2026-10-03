# Scoped real-browser coverage

Development-only runner: the page imports built `/dist/index.js` and its emitted
ESM closure, then uses actual browser Fetch over loopback HTTP to acquire
immutable SQLite bytes. No native/WASM/server SQL evaluator or Fetch mock.
Build/package production belongs to [[card:card-v-a]]; **finish builds before
running browser suites**, since rebuilds remove dist. Independent bounded review
[[card:card-v-d]] verified the current artifact and delivery. This is not global
SQLite compatibility or product-release approval.

## Setup and run (repository root)

Provide `SAIVAGE_CARD_WORK_ROOT` for disposable tooling/reports. Playwright is
**dev-only**, not a runtime dependency. The validated installation is Playwright
1.60.0 at `/opt/saivage-jsqlite2/node_modules/playwright`. If absent, install into
a purpose-named child of the work root with npm and point `JSQLITE_PLAYWRIGHT`
to that installation's `index.mjs`; use its `cli.js` for browser installation.

```sh
mkdir -p "$SAIVAGE_CARD_WORK_ROOT/browser-capability/tmp"
export TMPDIR="$SAIVAGE_CARD_WORK_ROOT/browser-capability/tmp"
export PLAYWRIGHT_BROWSERS_PATH="$SAIVAGE_CARD_WORK_ROOT/browser-capability/browsers"
export JSQLITE_PLAYWRIGHT=/opt/saivage-jsqlite2/node_modules/playwright/index.mjs
node /opt/saivage-jsqlite2/node_modules/playwright/cli.js install chromium
node /opt/saivage-jsqlite2/node_modules/playwright/cli.js install-deps chromium
# Local vendored demo fixture, checked against the same digest-bound descriptor.
export JSQLITE_CHINOOK=examples/browser/chinook.sqlite
unset JSQLITE_BROWSER_CASE JSQLITE_BROWSER_LANE JSQLITE_CHROMIUM
# Run only after build/package work has completed.
timeout 180s node test/browser/run.mjs
```

Installation may require network/system-package privileges; test execution has
**no live-network dependency**. Browser tooling uses Playwright's default
installed Chromium selection. This runner does not read `JSQLITE_CHROMIUM`.
Independent demo tests (a separate runner) previously failed at launch with
SIGTRAP when given an explicit full-Chrome executable override; default tooling
subsequently passed. Cause was not established: no arbitrary-executable override
reliability claim follows from the default-tooling results.

Current unfiltered lane with local Chinook: **38 declared/executed, 38 pass**,
Chromium 148.0.7778.96 / Playwright 1.60.0, including repeated independent review.
Without `JSQLITE_CHINOOK`, that optional case is omitted and selection reports it
(37 current cases). Chinook bytes/license are now vendored by the demo; see
[CHINOOK-LICENSE.md](CHINOOK-LICENSE.md) and `examples/browser/CHINOOK-LICENSE.md`.

## Current versus roadmap gap lanes

See [LANES.md](LANES.md) for source ownership, live-budget evidence and scope.
The two unchanged derived-composition probes remain runnable **failures**, not
conformance passes or dependencies for current-admission browser validation:

```sh
# Archive the current report before running another lane.
cp "$SAIVAGE_CARD_WORK_ROOT/browser-e2e/report.json" "$SAIVAGE_CARD_WORK_ROOT/browser-e2e/current-report.json"
JSQLITE_BROWSER_LANE=gap timeout 180s node test/browser/run.mjs
# Currently exits 1: 2 executed, 2 fail unsupported at prepare.
cp "$SAIVAGE_CARD_WORK_ROOT/browser-e2e/report.json" "$SAIVAGE_CARD_WORK_ROOT/browser-e2e/gap-report.json"
# Optional combined lane; retains failures, not a 40/40 pass claim.
JSQLITE_BROWSER_LANE=all timeout 180s node test/browser/run.mjs
# Development-only emitted-ESM shared-ownership observation:
timeout 30s node test/browser/observe-window-budget.mjs
```

`JSQLITE_BROWSER_CASE` optionally filters IDs; filtering is reported, not a full
suite pass. Reports record lane, gap IDs/SQL/provenance, browser/tool version,
source ID, served module hashes, fixture/capture identity, requests and per-case
results. `report.json` is overwritten on each invocation; archive separately.
Nonzero exits/timeouts must not be interpreted as passing unexecuted cases.
Each case has a fresh context, 5s navigation and 15s evaluation watchdog. External
180s timeout is essential: setup/context cleanup is not separately bounded, and
setup failure can precede report creation. No monolithic runner is invoked.

## Assertions and provenance

Ordered pinned native captures own expected values/metadata, not browser output:
INTEGER decimal bigint, REAL IEEE754 bits, TEXT UTF8 bytes, BLOB bytes and NULL
explicit tags. Public columnType and ordered metadata are checked positionally;
reset reexecutes captured rows. Per-case provenance identifies source assertions.
Representative current joins, aggregates, derived subquery, CTE lexical shadowing,
windows, JSON and primary-index rows are covered; index rows imply no plan-selection
credit. Three physical encodings have aggregate/index/lifecycle coverage.

Lifecycle uses actual prepare/bind/step/reset/clear/finalize/close/closeDeferred:
binding copies/retention, BUSY close, zombie completion, misuse, saved errors and
cleanup retaining primary failures. Controls cover host-timer abort while yielding,
overlap rejection, deadline/work/row/result/file/private-entry/key/byte limits and
connection reuse. Prepare nth_value-without-OVER preserves native error code/message.
Malformed header, HTTP404 and truncated body test acquisition errors. Valid
header/schema plus corrupted t1 root flags test SQLITE_CORRUPT11 **during step**,
including saved reset error; not merely open-time malformed-format rejection.

Admitted aggregate-window ordinal44 rows are independently native captured.
Development-only observation confirms sorter192 plus buffer144 logical bytes on
one live execution budget. Public browser success336/reset and limit200/cleanup
exercise shared budgeting: 200 admits either standalone store but not their live
combined reservation. These are browser logical-byte adaptation units, **not C
allocation parity**. Browser mechanics and lifecycle controls earn no extra
upstream compatibility credit.

Recapture independently to work-root files and compare, rather than overwriting
expectations based on browser results:

```sh
python3 test/browser/capture-json.py /path/to/pinned/libsqlite3-oracle.so > "$SAIVAGE_CARD_WORK_ROOT/browser-e2e/json-recapture.json"
python3 test/browser/capture-budget.py /path/to/pinned/libsqlite3-oracle.so > "$SAIVAGE_CARD_WORK_ROOT/browser-e2e/budget-recapture.json"
python3 test/browser/capture-window.py /path/to/pinned/libsqlite3-oracle.so > "$SAIVAGE_CARD_WORK_ROOT/browser-e2e/window-recapture.json"
# Each must match its committed *-native.json file (cmp).
```

These scripts are dev-only ctypes, source-ID checked, read-only fixture captures;
never invoked at browser runtime. JSON maps to pinned json.c paths; budget/window
provenance and fixture owners are recorded with captures and in LANES.md.

## Security, evidence and limits

Fixtures/ESM are exact allowlisted bytes; HTTP handlers accept no SQL or caller
filesystem paths. All non-test-origin browser requests are aborted; CSP restricts
scripts/connect to self, service workers are blocked. Digest-bound Chinook and
fixtures execute locally. Package closure/security checks supplement real browser
execution, not replace it or certify universal security.

Independent [[card:card-v-d]] review rebuilt/checked current package identity
(31 emitted JS modules), reran current38, failing gap2, ownership, native captures
and demo sequentially. See [its exact findings and historical failures](record:///status.md?card=card-v-d&v=6).
Earlier harness authoring failures, historical 29/33-case runs and preliminary
unproved gaps are retained in [card-v-b history](record:///status.md?card=card-v-b&v=24)
and [BUDGET-GAP.md](BUDGET-GAP.md); that historical admission boundary is superseded
by the owner lane decision described in LANES.md, not competing current guidance.
Preserve future expectation failures and report reproductions to semantic/root
owners; never rewrite expected values for engine defects.

Only Chromium has been tested. Representative scoped coverage is not exhaustive
corruption/CORS/parser/storage/scalar lifetime coverage, a numerical whole-SQLite
denominator, temporal native parity, or proof of monolithic termination. Broader
source-fidelity/admission debt remains; the two gap probes explicitly expose some
of it. Independent bounded delivery acceptance does not waive global product debt.
