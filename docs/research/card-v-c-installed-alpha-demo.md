# [[card:card-v-c]] PRIVATE LOCAL installed-alpha demo scaffold

## Reproducible installed consumer (not alpha certification)

Reuse [[card:card-v-a]] explicit-commit [package scaffold](card-v-a-alpha-scaffold.md)
(current coordination a70928b6) and the existing static demo. No engine repair,
registry/public repository/external distribution or operator config changes.
The owner sequence is stabilize current core → PRIVATE LOCAL versioned alpha →
residual breadth under unchanged SPEC. STAT4 admission gate c87ef40 remains
routed to root/original semantic owners, not this demo slice. Do not advertise
alpha acceptance while that and fresh core/candidate verification are unresolved.

```sh
python3 tools/package/local-alpha.py \
  --commit <full-40-hex-committed-source> --version 0.0.0-alpha.1 --name alpha-candidate
# Tooling may be installed once in a purpose-named work child; runtime is offline.
export JSQLITE_PLAYWRIGHT=/path/to/playwright/index.mjs
export JSQLITE_CHROMIUM=/path/to/chromium/chrome
python3 tools/package/installed-demo.py \
  --package-manifest "$SAIVAGE_CARD_WORK_ROOT/alpha-candidate/local-alpha-manifest.json" \
  --name alpha-installed-demo
python3 -m http.server 8000 --bind 127.0.0.1 \
  --directory "$SAIVAGE_CARD_WORK_ROOT/alpha-installed-demo"
```

Open `/examples/browser/index.html` on that loopback server. Each work name must
be new. Packaging exports exactly committed source, overlays only package/lock
version, builds/packs and records identities. Installed-demo verifies tarball
SHA256, private alpha version and exact exported demo inputs; independently
installs the tarball offline into its own consumer; compares every installed
file to packed inventory. It copies **that source's** demo and changes only its
single engine import to `../../node_modules/jsqlite2/dist/index.js`. No worktree
`dist` is copied/served and no engine changes are overlaid. Browser test accepts
`JSQLITE_DEMO_ROOT` for this installed consumer, blocks non-origin requests,
checks positional typed rows/names, failed-open and prepare/step cleanup, and
independent primary/secondary cleanup error ordering. It records manifests,
command exits/stdout/stderr hashes, harness/tooling hashes and post-run drift.

## Proposed local release-note boundaries

**Status: scaffold only; version is identity, not certification.** Final note must
name reviewed stabilized source commit/tree, actual version/tarball SHA256,
packed/installed closure, demo SQL/fixture/expectation hashes, reference/native
source/profile/library identities, browser/tool versions, fresh command outcomes
and unresolved gates. Current package manifest supplies source/pin/CURRENT fixture
and artifact identities; installed-demo supplies demo/installed/browser evidence.
Native profile/reference extraction and core acceptance remain independent pending
inputs, never inferred from a historical smoke success.

- **Demonstrated bounded support:** exact installed scaffold below runs current
  public `open`/prepare/step/indexed metadata/column/finalize/close for visible
  ordered Album/Track join and integer/real/null/blob discriminator. Error and
  cleanup transitions tested. Bind/reset/CTEs/windows/functions and other
  implemented paths have source/owner tests in current API/guide, but this demo
  is not fresh alpha evidence for all those intersections. Admission is semantic
  graph/producer/consumer based, not a SQL-text allowlist.
- **Temporary in-scope gaps:** unsupported semantic compositions, planner/statistics
  omissions and declaration metadata limitations remain debt. Current API names
  boundaries such as WITHOUT ROWID RIGHT/FULL match tracking and joined IN SELECT
  in selected outer-join routes. Guide carries revision-specific STAT4 rejection
  claims alongside newer work; freshly verified committed owners and gate decide
  status, not historical predictions. No universal percentage or old38/gap2
  denominator. Any wrong advertised row/type/error, leak or timeout requires
  attribution, not expectation weakening/watchdog inflation. Remaining breadth
  stays on SPEC backlog after stabilized alpha.
- **Permanent exclusions:** only SPEC's mutating SQL/transactions/savepoints and
  file/schema mutation; runtime native/WASM/embedded engine; external extensions,
  host callbacks/application virtual tables; CLI/Tcl/shell/server/protocol
  compatibility; WAL/journal recovery/sidecar application. Static HTTP serving is
  development file transport, not a server query backend. Development native
  fixture/oracle capture is allowed. No new exclusion or narrowed scope.

Current authorities: [API](../api.md), [guide](../TRANSLATION.md),
[proposed alpha contract](card-v-private-alpha.md), [SPEC](../SPEC.md). The old
aggregate timeout/subquery failure in demo evidence remains history, not a
current universal admission statement.

## Scaffold run identities and actual outcomes (2026-10-05)

Consumed package owner's existing scaffold, **not stabilized candidate**:
source `ab3beac0ae4c6ae012a05403255e7beb20c591e9`, tree
`0eea9ff2b01f179eb107d86322648e6b5632f1d6`, version `0.0.0-alpha.1`,
tarball SHA256 `725e373f7679bc804aba83cc4026e6852de316d785a33db3e76ae98a9e8e6693`.
Demo bytes/SQL/expected JSON are verified against that manifest's tracked hashes;
Chinook digest remains `7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`.

First installed-demo attempt installed/verifed package, then failed browser launch:
old card-v-b Chromium path had been removed. Recorded exit 1; no product failure
or success inferred. Installed Chromium development tooling in this card's
`installed-demo-browser` child with Playwright 1.60.0 (install exit 0).
Rerun with `PLAYWRIGHT_BROWSERS_PATH` succeeded (exit 0), Chromium
148.0.7778.96: join/type rows and metadata positions, failed open, prepare failure,
step overflow/finalize/close and injected cleanup precedence all PASS. No page
errors/non-origin network allowed. Manifest in status record; scaffold-only flag
and pending candidate gates preserved.

**Pending mandatory rerun:** once root provides stabilized reviewed exact source
and matching fixture/native evidence, create a NEW versioned local artifact,
install independently, rerun actual demo/quickstart/browser cleanup checks and
join their exact identities to core integration acceptance. This scaffold run and
historical dist success cannot certify that future alpha.
