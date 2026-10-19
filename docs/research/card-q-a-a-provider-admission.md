# Private date/time provider admission — current source reassessment

Assessment input: shared HEAD `f9c491abaaaed516812fc2e3a04608581a45c95c` plus existing shared staged/unstaged work on 2026-10-19. This is author investigation and a repair proposal, not implementation or independent acceptance. Existing date/calendar/date24, math, planner/index and cancellation work must be preserved.

## Admission decision

The private provider **already exists**. `src/internal/date-time.ts` exports a private symbol enrollment and two-method environment; `src/index.ts` carries it into prepared/reprepared programs. VDBE Function dispatch supplies a lazy clock and environment. Default host `Date` remains confined to clock/local-field acquisition. Do not add another backend, public callback, timezone database, or parallel evaluator.

Two current source divergences are proven below. Consumer work should correct their owning state transitions, not SQL-text special cases:

1. **Clock cache lifetime:** pinned `vdbe.c` clears `iCurrentTime` on each `sqlite3VdbeExec` entry (each native step), not only on reset. `vdbeapi.c:sqlite3StmtCurrentTime` then lazily obtains VFS time once during that entry. TS `VdbeStatement.#currentTime` currently survives every row until reset. The old architecture's unconditional all-rows stability promise is wrong. A constant date expression may still repeat across rows because `Once` owns its execution; that is not proof that the clock cache should span rows.
2. **UTC provenance of current time:** `date.c:setDateTimeToCurrent` sets `validJD=1,isUtc=1,isLocal=0`. TS `parse` produces current-time DT without `isUtc`. Consequently `datetime('now','utc')` incorrectly calls the local provider and may error. Fix the shared current-time constructor for omitted arguments, `now`, `subsec`/`subsecond`, and CURRENT_* wrappers; preserve the source positive-iJD success check and NULL failure behavior.

### Precise consuming handoff

At public `step` execution entry clear only the per-entry lazy clock sample, before executing VM operations, but **not at async yields or scalar calls inside that entry**. Keep reset clearing and Once behavior; independent statements must not share a cache. Subqueries/coroutines lowered into one VDBE use that same entry cache, not a second environment/cache. Validate any separately executed child caller against its actual native entry boundary rather than propagating a connection-global sample. Add first/next/done/reset and forced-yield tests with a row-dependent modifier to defeat constant-expression Once; retain existing alias/constant-clock tests as separate controls.

Repair current-time state at its producer; test `utc` provider non-invocation for all current-time forms, plus localtime invocation exactly once and repeated UTC/local flags. Do not change translated calendar arithmetic or date24 caches to accomplish this.

`Function` and `PureFunc` currently share the same dispatch and do not pass purity eligibility into date admission. Upstream `sqlite3NotPureFunc` gates `now`, omitted arguments, subsec and localtime/utc. Consumer must trace generated/schema callers before claiming eligibility coverage: add the existing FunctionContext purity signal when a real PureFunc caller is admitted; do not reject ordinary literal date calls or invent a new schema exclusion. No executed PureFunc divergence is claimed here.

## Controlled native-first evidence

Pinned SQLite 3.53.4 source ID: `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`; identity owned by `reference/sqlite/manifest.json`.

`card-q-a-a-provider-probe.c` registers a copied native VFS with controlled `xCurrentTimeInt64`, increasing by 10s per sample; `SQLITE_TESTCTRL_LOCALTIME_FAULT=2` supplies controlled `struct tm` output. These are development oracle facilities, never runtime dependencies. The initial fault=1 experiment correctly failed localtime; it was corrected to documented mode 2 before collecting the successful script evidence.

SQL: `WITH RECURSIVE x(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM x WHERE n<2) SELECT datetime('now',printf('+%d seconds',n)),datetime('now') FROM x`.

Native rows are TEXT `(00:00:00,00:00:00)`, `(00:00:11,00:00:00)`, `(00:00:22,00:00:00)` on 2000-01-01, clock counts 1/2/3; prepare count 0. The independent public TS probe gives first-column times 00:00:00/01/02, clock counts 1/1/1, prepare count 0. The constant second column is deliberately a Once control.

Native `datetime('now','utc')` returns `2000-01-01 00:00:30` with a fourth clock call and **zero** local calls. Public TS with a throwing local provider returns SQLITE_ERROR 1 `local time unavailable`. Native local/UTC roundtrip calls Unix seconds 946684800, 946692000, 946684800 and returns TEXT 02:00 / 00:00. Existing TS seam suite passes that ordinary roundtrip; the UTC iteration is not missing.

Commands executed:

```sh
sh tools/oracle/build.sh
mkdir -p "$SAIVAGE_CARD_WORK_ROOT/provider-admission"
cc -I "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build" docs/research/card-q-a-a-provider-probe.c "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3.a" -lm -o "$SAIVAGE_CARD_WORK_ROOT/provider-admission/probe"
"$SAIVAGE_CARD_WORK_ROOT/provider-admission/probe"
node --experimental-strip-types docs/research/card-q-a-a-provider-probe.mjs
node --experimental-strip-types test/conformance/run-date-time-seams-ts.mjs
python3 test/conformance/date-time-manifest.test.py
```

Build/source self-check passed. Both probes expose the divergences above (diagnostic probes, not passing parity tests). First TS probe run also exposed saved-error finalize rethrow; the probe now resets/catches the saved error before finalizing, leaving the product error order intact. Existing seams report pass/4 and manifest validator reports 29/29 selected assertions, 120 native observations, six zero-credit seam contracts. Those existing finite results do **not** cover the new counterexamples or grant additional credit. This investigation adds two controlled clock observations and one timezone-script control, no corpus-wide denominator claim.

## Local provider boundary and remaining obligations

`os.c:sqlite3OsCurrentTimeInt64` uses VFS int64 or legacy double conversion, returns status; date admission requires positive iJD. The browser default's epoch milliseconds is a legitimate representation adaptation, not permission to cache longer. A private clock exception/non-bigint/out-of-range value has no specified VFS-status mapping today; consuming implementation must explicitly map acquisition failure to source unsuccessful current-time/NULL, without swallowing cancellation or unrelated VM errors.

`date.c:osLocaltime` owns platform `localtime_r`/`localtime_s`/mutex fallback, fault error; `toLocaltime` owns equivalent-year mapping and fractional milliseconds; `utc` owns at-most-four guesses. TS contains those main provider/UTC branches already. Tuple validation checks integer year/month/day/hour/minute/second, leap/month lengths and ranges before JD conversion. Its year check is only integer, not safe integer, and constraining malformed private provider output needs a finite tuple matrix (NaN/Infinity/fractional/missing fields and leap/range cases) with saved error/reset/finalize controls. Native C `struct tm` cannot express JS NaN or missing properties: this is validation of the representation boundary, not a claimed native input divergence. Preserve `local time unavailable` for null/throw/invalid tuples, not NULL or normalized fabricated dates.

Host timezone, tzdata and platform observations remain host-dependent; exact tests use the private injection. No global TZ mutation, new product exclusion, or claim of platform necessity is justified. Rejected alternatives remain host SQL date parsing/formatting, fixed timezone semantics, broad calendar rewrite, and repeat cancellation-only milestone.

Review obligations: component and system re-review this proposal; consumer repairs plus native/public first/next/reset/yield/error and purity caller tests are still outstanding. This card delivers actionable admission design/evidence only.
