# CF01 containment and paired boundary capture

## Current boundary

The fallback materialized-CTE consumer is not a complete residual-WHERE
consumer. Pinned select.c8100–8140 materializes; sqlite3WhereBegin8292ff and
wherecode.c2627–2688 apply outer filtering, treating NULL as false and keeping
ON separate. The fallback's manual nested ephemeral loops implement only ON,
copy and delivery. Adding an independent comparison evaluator would preserve
the wrong semantic owner; completing general retained WHERE integration is a
larger slice. Immediate safe containment rejects **every** outer WHERE reaching
this fallback after linked resolution, before its bytecode emission. This is
not a browser limitation, algorithm substitution or product exclusion. Valid
SQL remains temporarily unsupported. Existing other WHERE owners are unchanged.

Paired `test/conformance/materialized-cte-filter-containment-native.py` and
`.test.mjs` cover aggregate/window/set producers; false/arithmetic false/NULL/
true/error/parameter filters. Native executes the valid queries with reset and
rebind. Public asserts atomic temporary rejection and repeated same-connection
reuse, unfiltered INTEGER count/full metadata/two-cycle controls, independent
OpenDup readers with ON, invalid-column precedence and separate rebind control.
No claim of filtered-query runtime/error/parameter compatibility: those queries
never publish public statements. Mixed REAL/TEXT/BLOB resource/cancellation and
all diagnostic order permutations remain untested in this containment slice.

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
