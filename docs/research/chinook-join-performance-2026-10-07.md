# Chinook aggregate join slowdown — isolated diagnosis

## Outcome and boundary

The slowdown persists in committed development version
`0947820269571354384fc2db20549db08a265576`: the unchanged original query takes
**125.341 seconds executing**, excluding acquisition/open/prepare. Its ten rows
match native SQLite. This investigation changes only diagnostic harness/docs in
the public clone, not engine source, public demo assets or Saivage state. No repair
or instance notification is performed. This is not alpha acceptance or a general
performance/compatibility claim.

Two independently evidenced contributors are **missing aggregate WHERE-planner
consumption** and **expensive timer-based cooperative scheduling**. The result is
not explained merely by using TypeScript/JavaScript instead of C.

## Exact inputs and observations

The committed source was exported with `git archive` from the autonomous repo into
`/home/salva/g/ml/tmp/jsqlite-public-browser/latest-09478202/source`, then built with
its own `npm ci --ignore-scripts --no-audit --no-fund` and `npm run build`
(TypeScript 5.9.3). No dirty files were exported. A separate site root uses that
`dist/` and the unchanged Chinook fixture, SHA256
`7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`.
Build hashes remained unchanged after profiling.

All browser runs used the existing long-query worker, local gzip HTTP acquisition,
Blob URL, public prepare/step/column/finalize/close API, installed Chromium and the
30-minute diagnostic limit. Runs were sequential, fresh-browser observations, not
statistical distributions. The query is the original album summary documented in
`test/browser/long-query.mjs` (albums 1–20, grouping, aggregates, HAVING, ordering,
LIMIT 10).

| Original query experiment | Execution seconds | Recorded yield-await seconds |
| --- | ---: | ---: |
| Unmodified latest engine | 125.341 | not instrumented |
| Instrumented original timer scheduler | 120.586 | 101.034 |
| Instrumented MessageChannel task yielding | 7.957 | 0.782 |
| Instrumented microtask yielding | 7.661 | 0.014 |

The three instrumented runs emit identical programs and per-address instruction
counts, with **6,110,645 dispatches**, **1,215,888 scan record loads/chunks**,
**23,882 dispatch yields**, **151 private-state yields**, and a last-dispatch work
counter of **8,584,633**. The counter is sampled before the last dispatch, not
claimed as an exact native-equivalent work denominator. No overflow yields occur.
All six substantive runs (including the controls below) match native rows after
restoring INTEGER/REAL types from the worker's recorded storage classes.

## 1. Missing aggregate planner/caller functionality

The fixture contains 347 albums and 3,503 tracks. The aggregate program opens both
table roots with `OpenRead`, rewinds Track **347 times**, and executes its inner
`Next` and ON rejection **1,215,541 times = 347 × 3,503**. Only after ON succeeds
does it test the album-range WHERE expression (3,503 times). Only **204 rows** reach
the group sorter. There are no selected index/rowid seeks in this joined producer.
Sorting and aggregate callbacks do not account for the million-row scan.

In this exact commit's `src/internal/vdbe.ts`:

- `compileAggregateSelect`, lines 6825–6844, emits direct nested scans for ordinary
  grouped INNER joins. Its shared planned join producer is used for RIGHT paths,
  not this query.
- Lines 6909–6928 similarly emit unplanned nested scans for ordinary multi-source
  aggregates without GROUP BY, explaining the slow minimal `COUNT(*)` query.
- The ordinary SELECT caller invokes `planWhere` around line 3527. A control query
  selecting all matching `(AlbumId, TrackId)` pairs, without an aggregate, chooses
  one Track scan and **3,503 Album `SeekRowid` operations**, not a Cartesian scan.
  It produces all 204 correct rows in **1.346 s**, with **53,569 dispatches** and
  208 timer yields. The scan-load counter excludes the separate seek-record loader.
- The minimal joined `COUNT(*)`, with diagnostic microtask scheduling, still does
  **6,103,133 dispatches** and the full Cartesian scan, taking **7.047 s**.

Thus the engine already possesses a materially better ordinary join route;
aggregate production does not consume it here. This is missing translated
planner-to-aggregate functionality, not an inherent language requirement. The
ordinary control still scans all Track rows: it does not prove native-equivalent
index selection or complete join-range propagation.

Pinned SQLite `src/select.c` lines 8531–8534 (GROUP BY) and 8884–8904 (ungrouped
aggregate) call `sqlite3WhereBegin` and `sqlite3WhereEnd` around aggregate input.
The inspected source bytes were compared against the manifest-authenticated
3.53.4 archive (SHA256
`d18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b`).

For a development comparison, Python's C-backed **SQLite 3.46.1**, NOT the pinned
3.53.4 oracle, chooses Track's `IFK_TrackAlbumId` range index and Album's primary-key
seek. The original query's warm median across 100 runs is **0.160 ms**, with
6,998 progress callbacks at interval one; minimal join COUNT has median **0.021 ms**
and 1,648 callbacks. Native/TS instruction counts are not equivalent denominators.

## 2. Scheduling overhead introduced by the port

The main VM loop in the exact commit's `src/internal/vdbe.ts:7261` yields through
`setTimeout(resolve, 0)` when the work counter is divisible by 256. Private-state
checkpoints use the same scheduler at line 7578. In the instrumented original run,
dispatch yield-await latency averages **4.205 ms**. The observed delay is consistent
with Chromium's nested-timer minimum delay, not a zero-duration yield.

Total recorded yield-await time is approximately **84%** of the instrumented
120.586-second execution. This is elapsed suspension latency, not necessarily CPU
time spent inside timer code. Replacing only the diagnostic scheduler with
MessageChannel reduces the same-work query to 7.957 s while retaining task yields.
Microtasks provide a second diagnostic control but are not a safe drop-in fix:
they do not provide equivalent opportunities for browser task-delivered signals.

Other run-to-run differences include JIT/GC/pacing and instrumentation costs;
subtracting the recorded original waits does not predict the alternative run's
exact CPU time. The remaining 7–8 seconds still perform avoidable million-row
decoding/comparison/VM work. This investigation does not separately quantify
BigInt, Mem allocation, decoding or async overhead against a matched-work native
program. It does establish that the two-minute duration is not inevitable JS cost.

## Evidence, commands and validation

Full reports and typed rows reside in the external evidence directory
`/home/salva/g/ml/tmp/jsqlite-public-browser/latest-09478202/`:
`identity.json`, `build-and-source-identity.json`, `original-query.json`,
`profile-{original,message-channel,microtask}.json`, `plain-join.json`,
`join-count.json`, `native.json`, and `diagnostic-summary.json`.

Baseline environment (profiling uses the same command plus
`JSQLITE_BENCH_PROFILE=original|message-channel|microtask` and separate reports):

```sh
JSQLITE_PLAYWRIGHT=/home/salva/g/ml/tmp/jsqlite-public-browser/node_modules/playwright/index.mjs \
JSQLITE_SITE_CHROMIUM=/usr/bin/chromium-browser \
JSQLITE_BENCH_SITE_ROOT=/home/salva/g/ml/tmp/jsqlite-public-browser/latest-09478202/site \
JSQLITE_BENCH_ENGINE_COMMIT=0947820269571354384fc2db20549db08a265576 \
JSQLITE_BENCH_REPORT=/home/salva/g/ml/tmp/jsqlite-public-browser/latest-09478202/original-query.json \
node test/browser/long-query.mjs
```

Controls use `JSQLITE_BENCH_SQL`:

```sql
SELECT a.AlbumId,t.TrackId FROM Album AS a
JOIN Track AS t ON t.AlbumId=a.AlbumId WHERE a.AlbumId BETWEEN 1 AND 20;
SELECT COUNT(*) FROM Album AS a
JOIN Track AS t ON t.AlbumId=a.AlbumId WHERE a.AlbumId BETWEEN 1 AND 20;
```

Harness smoke validation: `SELECT 1 AS n` on the pinned alpha, unprofiled and all
three profile modes, each completed with the expected typed row. Invalid scheduler
and custom root without commit attribution each rejected with nonzero exit.
`node --check test/browser/long-query.mjs` and `git diff --check` passed. Profile
instrumentation changes served bytes only; it is not an engine repair or public
demo policy change. Full compatibility, cancellation equivalence and repair
acceptance remain outside this diagnosis.
