# Opt-in long-running browser query measurement

Build the pinned alpha site with `python3 tools/package/build-site.py`, then:

```sh
JSQLITE_PLAYWRIGHT=/path/to/playwright/index.mjs \
JSQLITE_BENCH_REPORT=/path/to/external/report.json \
node test/browser/long-query.mjs
```

The default is the Album/Track aggregate query and a **30-minute overall wall
deadline**. `JSQLITE_BENCH_TIMEOUT_MS` can shorten the limit for harness checks;
`JSQLITE_BENCH_SQL` can select another query. Optional
`JSQLITE_SITE_CHROMIUM=/path/to/chromium` selects an installed browser. Playwright
is development-only; nothing is added to the shipped runtime.

The worker fetches the exact demo fixture over local HTTP with gzip, opens a
Blob URL, then runs the public prepared-statement API. Download/open/prepare,
time to first row and complete stepping are separately measured. The overall
deadline covers all stages. Acquisition and each step get only the remaining
time; the Node watchdog can terminate the browser even during synchronous work.
Existing file/row/work/private limits are not weakened. The public demo keeps
its separate 60-second policy.

Progress is printed per stage/row. The terminal report includes browser/source
identity, fixture hash, timings and full typed rows, or the interrupted stage.
Timeout/error exits nonzero. Completion alone is not correctness acceptance;
compare the saved rows independently. The test is deliberately not a 30-minute
CI gate and never writes Saivage state or modifies the autonomous worktree.

## Decompose the slow query

Set the same browser environment and `JSQLITE_BREAKDOWN_DIR` to an external
evidence directory, then run `python3 test/browser/query-breakdown.py`. It runs
thirteen progressively isolated queries sequentially: filter/count, partial and
complete join, grouping without/with the join, separate aggregates, combined
aggregates, HAVING, ORDER BY and LIMIT. Each gets the benchmark's 30-minute
deadline unless overridden. It saves full individual reports and a running
summary, and compares values with the local C-backed Python SQLite version
(recorded explicitly, not asserted to be the pinned oracle). Unordered results
are compared as multisets. Different queries can select different plans, so
timing deltas localize suspects rather than proving additive operator costs.
