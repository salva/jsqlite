# Parameter-sensitive STAT4 reprepare evidence — [[card:card-h-b]]

## Source and representation

Pinned SQLite 3.53.4: prepare.c sqlite3Reprepare886/LockAndPrepare, vdbeapi.c
step retry933, unbind1693, clear/transfer bindings, vdbeaux.c swap127,
SetVarmask5389 and ResetStepResult; vdbemem.c ProbeSetValue2027 and where.c
sample-probe consumers. Public SQL is retained by a connection-owned compile
closure; stable encoding, limits/schema/environment adapt native saved prep flags
(no configurable prepare flags in this API). Original bindings remain their Mem
owner instead of transfer through a disposable public handle. Compile publishes
immutable program state off-handle; only success replaces program/registers.
Failure preserves old program/bindings and saves primary error. Immutable schema
needs one parameter-expiration replacement, not the native repeated SCHEMA loop.
This is a bounded branch translation, not an independently optimized evaluator.

Initial sample extraction sets mask and returns unavailable; only reprepare reads
bound values. Explicit NULL is not unavailable. Bit31 conservatively covers every
slot32+. The existing builder/planner/probe carries the context; no ambient global
or parallel planner. Sample reservations include bound-value copy capacity.

## Native-first

`capture.py` consumes a separately built pinned STAT4-enabled shared library via
public C APIs. Native has no production dependency. `native.json` retains typed
rows, bound EQP, reprepare counts, clear and slot1/31/32/33 cases in three encodings.
Fixtures are accepted card-s-h skewed fixtures; their hashes are in capture.

Native build: configure/make sqlite3.c under the card work root then
`cc -O2 -fPIC -shared -DSQLITE_ENABLE_STAT4 -DSQLITE_ENABLE_COLUMN_METADATA sqlite3.c -lm -o stat4.so`.
Initial counts/plan evidence: processes proc-e9a0e84f58b9 and proc-d19219326cdb.
Fresh extended capture: proc-95d5d188a16a (exit0). First attempted extended capture
failed because its BLOB descriptor used the wrong helper representation; corrected
to `{type:'blob',hex:...}`; proc-79941c0b98fc records that failure.

## Baseline and implementation checks

Unchanged initial public reproducer: **0/3**, hot 0 retained indexSeeks1 instead
of SCAN t. `work:///cards/card-h-b/processes/proc-56eaf70b6418/stdout.log`.
First implementation attempt typechecked but strip-types rejected parameter
properties; corrected to explicit fields (proc-93a1e4a98f67). First focused green
3/3 (proc-84e2f4d99d1b).

Extended public tests retain hot/rare access, typed INTEGER/REAL/NULL/TEXT/BLOB,
NOCASE/RTRIM, metadata, clear and high-slot search/scan; direct owning-primitive
tests observe compile count for irrelevant/bit31 binds, zero mask, copy affinity,
and compiler failure/reset/finalize primary-error retention. Final focused8/8:
`work:///cards/card-h-b/processes/proc-fa63a8b00610/stdout.log`.
Affected probe/controls/first-SELECT + typecheck + package + diff check exit0:
`work:///cards/card-h-b/processes/proc-c36bbd83804b/stdout.log` (before the final
zero-mask test addition).

## Full regression limits

Full `node --experimental-strip-types --test test/**/*.test.mjs` attempted:
4786 tests, 4764 pass,17 fail,5 skipped. `proc-a7f70934a3e7` records exit1;
complete log is in the card work root `parameter-reprepare-native/full-node.log`.
Failures include absent card-work Chinook fixture/other fixture paths, unavailable
browser tooling, and repeated-right-full actual-yield assertions. A subsequent
STAT4 public + prepare controls + repeated-right-full run also exited1
(`proc-4d10c68ab955`); it does not confer regression acceptance. Typecheck/package
boundary/diff check separately exit0 (`proc-271da41d0060`). Do not relabel the full
run green or claim all failures are unrelated without independent comparison.

Broader combinations, exhaustive resource failure frontiers, mutable-schema
reprepare and configurable prepFlags are not proven. Existing synchronous parser
construction limits apply during saved-SQL parse; progress checks bound compiler
work, but no host-task suspension inside parser/planner construction is claimed.
Independent review and coherent scoped commit remain pending; peer staged/dirty
index/cache work was preserved, not reset or included in a sweeping commit.

## Integration reconciliation

Independent source diagnosis and finite lifecycle/resource/browser coverage from
[[card:card-h-d]] status152 supersede the earlier pending-focused-coverage claim;
no redundant test added. Its fresh purpose-built Chromium3/3 repeated and Node
170/170 evidence is reused for unchanged inputs, not whole-suite certification.
Source installation/error provenance and current docs were reviewed in the
integration slice; production/test/doc hunks are isolated with an alternate index,
excluding peer bitwise evaluator, schema/cache edits, overflow docs and staged
research removals. Scope and post-commit results are in the current h-b record.

Original full14fail/5skip diagnosis is retained in `independent-diagnosis.md`.
Integration provisioned upstream Chinook in the card-work `chinook-fixture`
(download URL documented in schema test), set CHINOOK_DB, and used independently
provisioned Chromium engines without changing operator config. Full literal Node
glob now attempts4820: **4811 pass,4 fail,5 skip** (`proc-7e4aab249d50`, exit1).
Nine missing-Chinook failures and missing browser executable are resolved; the
three stale timer-only repeated-right assertions were already resolved by the
independent test commit. Remaining four failures: two r1-native/capture.json
missing-input executions (standalone and imported), cascading skipscan GE
consumer after-hook, and r2-native/capture.json missing input. These external
oracle captures are not fabricated or replaced with TS expected values.
Five explicit existing skipscan companion tests remain skipped (cursors,
concurrent sorter, page-local corruption, sorter memory, native corruption).
This inventory does not waive any product assertion; no genuine regression is
observed among completed assertions. Missing captures and skipped companions
remain a precise verification boundary, not whole-suite green.
