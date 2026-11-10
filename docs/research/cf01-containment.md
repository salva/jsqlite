# CF01 containment and paired boundary capture

## Current boundary

Beta9 routes one explicitly MATERIALIZED physical/aggregate producer through
`compileResolvedTableProducer` and `compileInnerTableSelect`. Its transient table
uses CTE naming rules; `fromClauseTermCanBeCoroutine` consumes actual CTE flags,
so MATERIALIZED remains a fence. The shared callable fill retains Once inside
Gosub/Return; WHERE positioning invokes it before reading. Existing linked
residual predicates, projection and destination replace manual fallback consumer
decisions on this slice. This is ordinary source translation, not an algorithm
substitution. Repeated readers still use the old OpenDup branch; window/set and
repeated-source outer WHERE remain atomically typed temporary after resolution.
The fallback itself is not a complete residual-WHERE owner. Pinned select.c
8100–8140,8292,8346 and wherecode.c2627–2688 remain the comparison points.

`materialized-cte-linked-consumer{.test.mjs,-native.py}` covers M0/M1/M2/M3,
false/arithmetic false/NULL/true/error, parameters/rebind, empty producer,
consumer LIMIT/OFFSET, full five metadata fields, INTEGER storage and two cycles
in all encodings. Existing containment tests preserve window/set rejection,
repeated reader control and name-error precedence. Native's older aggregate
matrix is retained, not erased.

## Beta9 author evidence and next gates

Input is approved CF02 badc9ec11eaee42d7598c0249b4a31a17d88357a/tree
1b82e1767ee99c84eeac43f0e06aec556dbfd921, not mutable root. Candidate is a task
copy at `/work/jsqlite2/cf01-candidate`; original CF02 input remains untouched.
Before repair the new public test failed at prepare in all encodings
(proc-85f5caadebd5). First repair passed value/filter/projection controls but
exposed a test mistake: reset must rethrow saved malformed-JSON error. Corrected
the assertion, not lifecycle implementation (proc-13f1980f523e).

proc-147628367ac4 ran native 33 controls then serial public linked3/containment3/
CF02-resolution3 successfully. Each file used timeout100s, Node test100000ms.
Exact native command:
`PYTHONDONTWRITEBYTECODE=1 timeout 100s python3 test/conformance/materialized-cte-linked-consumer-native.py /work/jsqlite2/.saivage/work/cards/card-w/current9c847-verification/native/oracle-build/build/libsqlite3-oracle.so`.
It checks pinned SourceID, not a fresh oracle build/hash. Public command per file:
`timeout 100s /opt/node-v24.18.0-linux-x64/bin/node --experimental-strip-types --test --test-concurrency=1 --test-timeout=100000 <file>`.
proc-16d91c2c6fd3 also passed the linked3 and explicit isolated compiler:
`timeout 100s /opt/node-v24.18.0-linux-x64/bin/node /work/jsqlite2/.saivage/work/cards/card-t-c/beta8-c1-tooling/node_modules/typescript/bin/tsc -p tsconfig.json`.
Primary output is in those process stdout artifacts under this card; status
links the exact returned locators. No ancestor dependency installation/use.

Added controls pass INTEGER/REAL/TEXT/BLOB/NULL across all encodings, physical
origin metadata, separate body/consumer LIMIT, pre-abort and live timer cancellation,
retained reservation refunds and early-reset/rebind reuse. proc-f1b7c642fd5c is
public3/3 after those additions; proc-6413b5f4d95a native passes all added storage
and limit controls but public failed due to an accidentally malformed test edit,
not runtime lowering. Corrected that edit; no production workaround. The native
storage loop is additional to the printed eleven-case count.
Further broader affected-path regressions, independent nonauthor caller/source
review and combined root gates remain open. Cancellation test proves timer abort
and zero retained budgets at failure/reset, not an instrumented peak reservation
before cancellation. CF03–06 are separate.
Filtered-query runtime/error/parameter compatibility is not claimed for the
still-rejected window/set/repeated-source fallback: those filtered queries do not
publish public statements. The migrated singleton has the finite mixed-storage,
parameter and cancellation/reset controls above, not exhaustive allocation or
diagnostic-order coverage. In particular the timer test does not establish a
positive private peak before abort.

R43 corrects the migrated physical child owner: pinned select.c:5315 excludes
CTE SrcItems from unused-result pruning, even for a single reader. The retained
producer passes actual CTE identity to that optimization, preserving runtime
child-expression evaluation without disabling ordinary-derived demand pruning.
Paired linked-consumer tests cover unused-child malformed JSON at step/reset,
two cycles in all encodings, empty and nonfailing multi-column CTEs, and an
ordinary retained ORDER/LIMIT control. The no-ORDER singleton physical-derived
coroutine now also applies the same unused-result primitive before body lowering;
`singleton-retained-demand.test.mjs` preserves the exact witness, demanded/star
errors, prepare validation and parameter numbering. This does not widen outer
WHERE admission. Revision-bound commands/results and patch identity are in
[[card:card-t-d]] status210 and its repair successor; CTE correction provenance
remains in [[card:card-t-c]] red494 and its repair successor.

## Q21 source-owned capture/caller closure

Run from the checkout; Python3 standard library, qualified Node24 strip-types,
and a pinned metadata/math-enabled native oracle plus sqlite-fixture helper are
required. No npm or ancestor dependencies. Existing source build recipe is
`tools/oracle/build.sh` (SQLite archive verified by `verify-source.py`, then
configure/make and cc for oracle/helper/library, profile self-check). If building,
use only a fresh task-owned oracle work root: build.sh removes that selected
work root. Do not point it at another card's build. Existing borrowed executables
are read/execute-only, never rebuilt or cleaned here.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 tools/oracle/capture-expression-boundaries.py \
 --library "$ORACLE_BUILD/build/libsqlite3-oracle.so" \
 --fixture-helper "$ORACLE_BUILD/build/sqlite-fixture" \
 --node "$NODE24" --output "$FRESH_TASK_OUTPUT"
```

This recipe runs the actual source-owned DB producer (`sqlite_fixture.c`) for
all three subquery encodings into its new output directory and verifies byte
identity against the three CURRENT caller-consumed DBs. It does not regenerate
or mutate CURRENT. For full catalog generation, existing
`tools/oracle/generate-fixtures.py --manifest reference/sqlite/manifest.json
--profile <build>/profile.json --oracle <build>/build/sqlite-oracle --spec-dir
<spec-directory> --fixture-root <fresh-task-fixture-root>` owns that path (the
current implementation does not consume spec-dir). This is not required merely
to capture these three paired suites.

Then the capture calls, natively **and** publicly, each of:
- `test/conformance/select-collate-scalar-width{-native.py,.test.mjs}` (C1)
- `test/conformance/function-descriptor-resolution{-native.py,.test.mjs}` (P1)
- `test/conformance/function-registration-boundaries{-native.py,.test.mjs}` (R36)

Native argv is Python `<name>-native.py <library>`; each checks manifest SourceID.
Public argv is Node `--experimental-strip-types --test --test-concurrency=1
--test-timeout=100000 <name>.test.mjs`. Each subprocess has100s bound, sequential.
The receipt records exact commands, exits, output hashes, executable identities,
paired suite inputs, DB/catalog/CURRENT, source owners and producer recipe hashes.
The full source import closure remains the checkout, not a portable copied-six-
files test bundle; receipt hashes are not whole-tree authentication. Failure
aborts without a success receipt; partial outputs must not be treated as success.

Author execution: proc-321aa556d505, output
`/work/jsqlite2/.saivage/work/cards/card-t-c/q21-capture/receipt.json` and adjacent
native/public outputs. All9 producer/pair commands completed0; regenerated DBs
exactly matched caller inputs. Native C1 7 valid/3 errors, P1 9 diagnostics/5
controls, R36 60 cases per encoding; public3/4/4 pass. This supplies a recipe and
author receipt for root-routed W, **not** central enrollment/independent acceptance.
Exact input identities and focused check commands are in current card status.
