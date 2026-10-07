# Bounded scheduler repair evidence — [[card:card-h-e]]

Baseline HEAD `7f534d95c7d59ef557c419d8ded8e5ed1fe29eca`; working source includes preserved unrelated peer bitwise edits. Repair is confined to shared host scheduling and affected Vdbe waits/reset plus post-main-yield control recheck. [Decision](decision.md) preceded implementation; [red](red.md) and original reproducer/predicate remain intact. Pinned owners were read: vdbe.c entry/check_for_interrupt/progress/abort branches, vdbeapi reset/finalize and vdbeaux Reset/Halt. Await does not advance PC/register/cursor or accounting; main resumption now checks controls before dispatch, like native interruption before the next body operation. Private/scalar-input loops retain checks on next charge; overflow retains checks before each chunk and before decode. Saved execution error, halt and finally admission release remain unchanged. Scheduler owns only task resources, closed before promise resolution. No SQL lowering/cap change.

## Verification

Final Chromium148.0.7778.96 six adapted runs (two new pages, three runs each): elapsed138.7/123.0/80.0 and152.9/124.2/81.0ms versus baseline4782.2/4842.0/4764.2ms. Exact 34-op program,190012 dispatches,280012 work, per-PC histogram and typed INTEGER results unchanged in every run. Timer turns136 each, actual awaited timer intervals2.4/3.0/2.2 and2.7/2.3/2.2ms; p50=0, p95≈0.1ms, max≈0.2ms. Real5ms interval counts27/24/16 and30/25/16 satisfy progress assertions. Full served-byte hashes/programs/histograms: [batch2](green-latency-2.json), [batch3](green-latency-3.json). Earlier exploratory adapted batch [batch1](green-latency-1.json) precedes final main resumption check; final batches supersede it for acceptance. Measurement is awaited elapsed, not CPU/JIT subtraction. Periodic timer nesting is broken by message tasks in this Chromium, not a universal timer guarantee.

`test/browser/scheduler-latency-green.mjs` invokes the unchanged red reproducer and requires its specific red latency assertion to fail, then compares all evidence and asserts lower latency/timer progress. Child exit1 is expected **only** for that predicate, not ignored arbitrary failures. Green wrapper exit0. Controls repeatedly passed; final [controls](controls.json): three encodings × main/private UNION copy/scalar input/async json_pretty; actual timer-delivered AbortSignal, cause and saved error identity,1ms deadline, work limits, pending reset/finalize/exclusive admission misuse, reset/reuse and exact results. Main reset rerun retains exact work/perPC. Typed REAL/NULL/BLOB/INTEGER accessors remain distinct. Overflow public fixture checks task abort, work limit and TEXT reuse. Instrumented browser resource run max2live ports,0after resume; real absent-channel fallback retained timer progress (966ticks). Unit tests additionally cover channel-post failure fallback, cleanup and cadence/reset.

Commands (workspace root; disposable outputs beneath card root):

```sh
node --experimental-strip-types --test test/select/task-scheduler.test.mjs
npm run typecheck
node node_modules/typescript/bin/tsc -p tsconfig.build.json --outDir "$SAIVAGE_CARD_WORK_ROOT/scheduler-green/dist"
PLAYWRIGHT_BROWSERS_PATH="$SAIVAGE_CARD_WORK_ROOT/browser-capability/browsers" JSQLITE_SCHEDULER_DIST="$SAIVAGE_CARD_WORK_ROOT/scheduler-green/dist" node test/browser/scheduler-latency-green.mjs
PLAYWRIGHT_BROWSERS_PATH="$SAIVAGE_CARD_WORK_ROOT/browser-capability/browsers" JSQLITE_SCHEDULER_DIST="$SAIVAGE_CARD_WORK_ROOT/scheduler-green/dist" node test/browser/scheduler-controls.mjs
node --experimental-strip-types --test test/select/first-select.test.mjs test/select/task-scheduler.test.mjs test/storage/skipscan-seekscan-vdbe.test.mjs
npm run test:conformance:accounting
npm run test:package-boundary
node --experimental-strip-types test/conformance/run-expression-bounded-ts.mjs
npm run test:package
node --experimental-strip-types --test test/conformance/run-special-window-ts.mjs test/conformance/aggregate-context-opcodes.test.mjs
sh tools/oracle/build.sh
python3 test/conformance/run-first-select-native.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"
```

All final commands exit0: type/build; scheduler2tests; focused regression16/16 ([log](regression.log)); accounting generator38upstream+9companions and manifests; package boundary; bounded expression six groups; package distributable ([log](package.log)); special-window/aggregate43/43 ([log](window.log)); pinned native build and first-select ([log](native-first.log)). Independently source-ID-checked ctypes public prepare/step/column_type/int64/finalize capture confirms substantial SQL INTEGER results and101terminal ([native](native.json)); native progress timing is not browser fairness proof. Detailed command streams remain in card work artifacts. Earlier controls used an honestly unsupported recursive ORDER consumer and failed prepare; corrected harness uses admitted UNION copy, not engine expansion. Tests-first scheduler import failed missing module before implementation. Browser family tests were completed after initial scheduler implementation, a sequencing limitation versus brief; no claim that all family tests preceded consumption.

## Boundary

Explicit one-in-eight timer opportunities preserve bounded task fairness evidence, not hard real-time or background-tab responsiveness. Synchronous scalar function traversal checks cannot receive fresh same-agent task abort mid-call; existing async input/pretty/private checkpoints remain. Port acquisition that throws falls back; host-level termination or unusual broken delivery cannot be guaranteed. No whole-release recertification, optimized Chinook retiming, native allocation/progress parity or new algorithm/SQL support claim. Peer edits preserved; guide/API/map/audit current assertions describe only this bounded adaptation.
