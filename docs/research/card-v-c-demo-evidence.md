# [[card:card-v-c]] static demo evidence

## Scope and diagnosis

The accepted red check found only `examples/read-only.ts`, no static HTML entry,
README serve command or demo link. Repair is an integration consumer of existing
public API/dist, not an engine algorithm substitution. Existing [[card:card-v-a]]
build/API guidance remains unchanged; README adds an adjacent demo quickstart.
Fixture and Playwright conventions reuse [[card:card-v-b]] work without requiring
its corpus lanes to pass. No peer dirty engine/tests/research files are owned here.

Native capture uses SQLite 3.53.4 source ID from the manifest, asserted at runtime,
and the unchanged existing Chinook bytes/digest. The accompanying MIT notice is
copied from `test/browser/CHINOOK-LICENSE.md`. `test/demo/capture.py` owns native
recapture, never browser execution. Browser reads only local dist, HTML/JS, JSON
and database. `expected.json` preserves storage classes and exact integer strings.

## Source comparison for consumer cleanup

Read pinned `src/vdbeapi.c:sqlite3_finalize` (105 onward): reset records status,
delete destroys statement even when status is an error, then API exit. Read
`src/main.c:sqlite3Close` child-statement checks. Current API/translation lifecycle
requires statement finalization before connection close and distinguishes saved
execution errors from successful destruction. Demo keeps operation error primary,
then finalize, then close, always attempting close after finalize throws. No
cleanup at only the UI failure site; the common `execute` owner handles open,
prepare, step and cleanup transitions. Failed open publishes no db; prepare
failure closes the acquired db; step failure finalizes then closes. Indexed
metadata and values retain ordered names/types. No independent SQL evaluator.

## Actual commands and outcomes (2026-10-03)

- Node v24.18.0. `npm run build`: exit 0, pinned TS 5.9.3 build.
- `python3 test/demo/capture.py .saivage/work/cards/card-c-b/oracle-build/build/libsqlite3-oracle.so > examples/browser/expected.json`: exit 0; native source ID asserted, fixture length/digest asserted. Captures join and scalar storage-class cases. Oracle path is local evidence, not a runtime dependency.
- First browser attempt: initial Album/Track join + group count filtered to three
  albums timed out at the demo's 10-second operation bound. Did not treat this as
  conformance success or raise runtime timeout to conceal it.
- Second attempt: prefiltered FROM subqueries failed prepare with `sqlite: no
  such table: a`. No supported-composition claim or engine repair in this demo
  slice. These engine breadth/performance gaps remain outside its acceptance.
- Third attempt: deterministic Album/Track join ordered by AlbumId/TrackId,
  LIMIT 3, recaptured independently; browser exit 0. Selected SQL is visible and
  meaningful current join behavior, not an aggregate claim.
- `JSQLITE_CHROMIUM="$PWD/.saivage/work/cards/card-v-b/browser-capability/browsers/chromium-1223/chrome-linux64/chrome" node test/demo/browser.test.mjs`:
  exit 0, Playwright 1.60.0, real headless Chromium **148.0.7778.96**. All
  non-loopback-origin requests blocked. PASS both typed row/name expectations and
  positional metadata; successful done/finalized/closed; failed open transport
  error/no handle; prepare failure/closed; integer overflow step error remains
  primary, finalize destroys and close succeeds; injected independent finalize
  and close errors recorded in order, neither masks operation error. No page JS
  errors. Real-engine step-failure case and injected precedence case are distinct.

The preserved red structural reproducer is `test/demo/entry.test.mjs`; it now
passes. Further final recapture/build/browser commands and commit identity are in
[[card:card-v-c]] status. This adds bounded browser smoke evidence only, not full
SQLite compatibility, exact planner/performance parity or release approval.
