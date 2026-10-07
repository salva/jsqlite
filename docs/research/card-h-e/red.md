# Scheduler red evidence — [[card:card-h-e]]

## Inputs and method

2026-10-07 red node, HEAD `7f534d95c7d59ef557c419d8ded8e5ed1fe29eca` plus existing peer edits (preserved; no product edits by this card). Compile current source into a purpose-named work directory, avoiding shared dist rebuilds. Public empty fixture from generation `g-fee22cf861600cad6529c65e4a6561aeedca2a0405e64643575b7752aa9d2fd0`; actual Chromium Fetch/open/prepare/step/typed accessors. Recursive aggregate 10,000 terms is independent of the optimized Chinook plan. Default 10,000,000 work cap unchanged. No scheduler swap, microtask comparison, SQL fast path, CPU-time subtraction or replay.

Commands:

```sh
node node_modules/typescript/bin/tsc -p tsconfig.build.json --outDir "$SAIVAGE_CARD_WORK_ROOT/scheduler-red/dist"
TMPDIR="$SAIVAGE_CARD_WORK_ROOT/browser-capability/tmp" PLAYWRIGHT_BROWSERS_PATH="$SAIVAGE_CARD_WORK_ROOT/browser-capability/browsers" node /opt/saivage-jsqlite2/node_modules/playwright/cli.js install chromium
PLAYWRIGHT_BROWSERS_PATH="$SAIVAGE_CARD_WORK_ROOT/browser-capability/browsers" JSQLITE_SCHEDULER_DIST="$SAIVAGE_CARD_WORK_ROOT/scheduler-red/dist" node test/browser/scheduler-latency-red.mjs
node --check test/browser/scheduler-latency-red.mjs
```

Compile succeeded (a subsequent unrelated nonexistent options.ts grep made the combined inspection command exit2). Browser installation exit0. Final probe exit0 means **red reproduced**, not adaptation accepted; syntax check exit0. Earlier probe attempts failed: absent default browser installation (first masked by incorrect fixture-server cleanup), wrong PrepareResult use, and BigInt report serialization. Harness corrected; no product repair. Explicit scoped browser cache then used. No operator clone or configuration changes.

## Results

Chromium 148.0.7778.96, Playwright installation at documented dev-only path. Three sequential same-page runs: elapsed 4782.2 / 4842.0 / 4764.2 ms; measured awaited timer intervals 4539.8 / 4588.6 / 4563.5 ms (94.7–95.8% of elapsed). 1093 timer yields each; p50 4.2 ms, p95 4.3 ms each; maxima 5.6 / 7.4 / 6.3 ms. Real 5ms interval pulse counts 955 / 968 / 953: existing timers are responsive, but latency is dominated by scheduler waits.

Each run: 34-op lowered program, 190012 dispatches, 280012 statement-wide work units; identical per-PC histograms; exact INTEGER results sum=50005000, count=10000; ROW then DONE. Full lowered programs, per-PC inventories, distribution summary and served VM hashes in [red-report.json](red-report.json), SHA256 `fb13460e2b31732cb14a20210c39f4ccd85271d61bcd15075b184dd0b376d4f1`. Original served VM hash `6e71340aba647a1b330f73815a412f43edfa53ae7dc1c7345a42b007ae94e6a8`; observational served VM hash `04fb544b9ec24fb9f3bfe2d07a291b62b109270882a58c5c1e63281424ef9dae`. Instrumentation counts increments/PC only, not production behavior changes. Timer intervals are measured directly around callbacks, not inferred CPU/JIT savings. Count includes the observed VM timer calls; this query contains no overflow fixture.

## Owning-path comparison and next-node boundaries

Read current guide expression safety-budget and async Function rationale, API stepping/lifecycle, source map, mutable audit (including JSON pretty revision corrections), pinned vdbe.c interrupt/progress branches and vdbeapi/vdbeaux reset/finalize ownership. SQLite checks interruption on entry and jump/check_for_interrupt; progress uses nVmStep thresholds including prior execution, exits via abort_due_to_error with SQLITE_INTERRUPT; reset halts partial execution, transfers prior error, clears result/error resources; finalize resets then deletes. Native check ownership does not prescribe browser task delivery or timer delay.

Current TS main loop checks controls then yields at work%256 before dispatch; PC increments only for dispatch. Overflow reconstruction yields after each nonfirst payload chunk, cursor/PC held. Scalar inputs charge/check/yield at work%256. Private control charges/checks/yields at work%256 then performs final check (zero-unit checkpoints only check); private-state owners await these checkpoints for copy/growth/comparison/movement. Function generic synchronous charge/check does **not** independently task-yield; json_pretty async Function delegates checkpoints to private control. Generic scalar traversal's synchronous bounded checks cannot receive fresh task-delivered abort until returning to an async checkpoint. Error catch maps/saves first error, halts, then finally releases admission; reset clears work/PC and retains bindings. These are semantic contracts to retain, not justification to replace algorithms.

This red establishes current substantial-path timer latency, not all-family adaptation acceptance. No host primitive selected yet. Green must first extend/control tests for actual task-delivered abort, nonzero deadlines, limits, reset/finalize/reuse, exclusive admission, all encodings and exact types/work/no replay across main/private/scalar/overflow; add fallback and resource/port cleanup tests when scheduler design is chosen. Pulse responsiveness here alone is insufficient fairness proof. Native oracle comparison, repeated adapted fairness/latency and regression/type/package/accounting checks remain future work. No hard real-time, whole-release, new SQL or performance guarantee follows. Current guide/API/audit contracts intentionally unchanged during red.
