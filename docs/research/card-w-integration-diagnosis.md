# Current integration diagnosis — [[card:card-w]]

## Outcome

**Failing test**, not broad green. No runtime, expectation, harness, package script or scope change made in this diagnosis. No commit/staging performed. Existing dirty bitwise/index/research/cache paths preserved.

Entry and exit HEAD: `d9d6759c44aa5366ea5f32d0b64f4d13badb11a5`. Index empty. [inputs.json](card-w-diagnosis/inputs.json) records tree, index hash, dirty paths, every tracked working-file hash, exact 224-file expanded inventory and environment (Node24.18.0/Python3.12.3). Final rehash found **zero tracked input drift**. Most tests below run dirty working sources; committed archive attribution is separate.

## Commands and actual outcomes

- Original four-red regression files: `timeout --kill-after=5s 60s node --experimental-strip-types --test test/conformance/run-expression-bounded-ts.mjs test/conformance/run-ordinary-scalars-pattern-ts.mjs test/conformance/run-order-limit-contract-ts.mjs`:12/12 exit0. The three files now cover all four original failure sites. Combined with candidate lifecycle, private endpoint, scalar-limit Mem owner:19/19 exit0 (`proc-dece796def9a`). [Focused log](card-w-diagnosis/combined.log).
- Historical broad pattern reconstructed from `record:///status.md?card=card-s-d-b&v=20`: conformance `*.test.mjs`, `run-*-ts.mjs`, storage/parser `*.test.mjs`, excluding audit requiring argv; both Chinook variables point to local `examples/browser/chinook.sqlite`. Historical6ba3 tree matches183 files before exclusion, not an invented42-file list. Historical1539/1543 exit1 (`proc-1f0a8bb19cdb`) remains unwaived. Original42-file monolithic command not reconstructed. Read retained original process head plus current records; no causal inference from old failures.
- Current expanded pattern: **224 files:216 completed exit0,3 fail,5 timeout**. [Per-file command/exit/duration manifest](card-w-diagnosis/results.json). Each component ran `node --experimental-strip-types --test FILE`,30-second process-group watchdog with3-second TERM grace then KILL. First17 records serial; parent deliberately stopped/replaced for throughput (`proc-116191885b3d` killed, NOT pass); remainder8 independent processes (`proc-e52bcc9c7630` exit1). One interrupted in-flight component rerun by replacement. Complete logs remain in `$SAIVAGE_CARD_WORK_ROOT/integration-diagnosis`; [log hashes](card-w-diagnosis/component-log-hashes.json); failures/timeouts copied alongside manifest. No case-level compatibility denominator inferred from file counts.
- Two failures are real missing prerequisites: r1/r2 native captures absent. Fresh `timeout180s sh tools/oracle/build.sh` exit0 verified official archive and manifest source ID; metadata/math/JSON/three-encoding profile passed. `capture-where-operand-admission.py --library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" --output-dir "$SAIVAGE_CARD_WORK_ROOT/r1-native"`, corresponding `capture-where-order-consumption.py` to r2, then both public tests =>2/2 exit0;117/63 prepared cases,234/126 native executions plus6 errors (`proc-d92f06d6ff31`). Earlier missing-fixture exits retained, not silently rewritten.
- Remaining engine red: `multisource-inner-oracle.test.mjs`,7/8 exit1, independently repeated dirty and exact `git archive HEAD` committed export. Local fixture `test/conformance/fixtures/multisource-inner-oracle.db`; SQL `SELECT a.x+1 AS q,b.x FROM a JOIN b ON q=b.x+1`. Expected INTEGER `[2n,1n]`; observed `[]`. Independently freshly built manifest-pinned3.53.4 library returns INTEGER2,INTEGER1,prepare0,DONE101 (`proc-dece796def9a`). Route root to existing joined alias/resolution/lowering owner [[card:card-t-d]]; no engine patch authorized here. This is a current repro, not an assertion that any particular prior fix caused it.
- Five30-second watchdogs: compound-collation, compound-union-all, expression-subquery-chinook, json-table-functions, multisource-inner-order. All classified timeout, not pass or proven engine loop. Compound-union-all has23 tests and repeated `server.close` cleanup, no `closeAllConnections`; two separately selected cases pass in~3s each. Several current tests spend~3s in HTTP cleanup per case. This supplies concrete resource/cleanup investigation leads, **not conclusive cause**. No limits inflated. A supported terminating aggregate harness and cleanup discriminator still need implementation in a later node.
- Typecheck, package boundary, build:all exit0 (`proc-4b4e1e36aca7`). Fresh dirty artifact `dist/index.js` SHA256 `8761f8d8d147a88d7d92e5a97707fdcbe20d55cad8cf0c180977d1b14774d074`; module entry digest alone is not whole-artifact identity. Serial real browser on rebuilt closure, local Chinook, Playwright1.60.0 existing dev installation, pinned installed Chromium:current38/38 and original gap2/2 exit0 (`proc-5c94743aab07`); exact browser/module report retained in [current](card-w-diagnosis/browser-current.json)/[gap](card-w-diagnosis/browser-gap.json). No old tarball credited with fixes.
- `timeout --kill-after=3s 30s node --experimental-vm-modules test/package-distributable.test.mjs`:**124 timeout**, unresolved; no package pass claim. Separate audit runner with explicit local Chinook argv:56/56 exit0. No live-network Chinook prerequisite or shipped native runtime.

## Next bounded work

Repair orchestration/fixture prerequisite integration and investigate HTTP cleanup versus genuine blocked execution with direct watchdog evidence. Keep aggregate failures truthful and terminating, rerun full expanded list after changes. Resolve package watchdog separately. Exact historical42-file inventory remains unavailable; native scalar/LIKE recapture, broad committed-source run and exhaustive browser/engine interruption parity were not performed. Product scope unchanged; no compatibility percentage claimed.


## Repair node: bounded harness, not semantic replacement

`npm run test:integration` now expands the current historical-pattern inventory,
provides local Chinook paths, builds the pinned dev oracle and independently
creates r1/r2 prerequisite captures, then runs each file in an independent
process group with the original30s watchdog (8-way concurrency). It writes
`$SAIVAGE_CARD_WORK_ROOT/integration-run/manifest.json` with source/index hashes,
exact commands, every exit/log digest, prerequisite failures/not-run classification
and final input drift. Any fail/timeout/drift produces aggregate exit1. Build
prerequisites have a finite180s watchdog, not enlarged engine limits. This
Python/POSIX development tool adds no browser/native runtime dependency.

Test teardown now calls `closeTestServer` **after** connection/statement cleanup
in five formerly timed-out suites. It stops accepting HTTP then closes retained
Fetch sockets, including unread responses after expected acquisition failure.
No SQL interruption/expectation/error is suppressed. A stalled-body HTTP
regression verifies that teardown terminates; real-exit/watchdog/ignored-TERM
harness regressions prove nonzero failure and process-group escalation.

Focused HTTP repair:50/50 exit0 in<1s (compound-collation, JSON table,
multisource ORDER plus teardown regression). Earlier combined attempt accidentally
omitted CHINOOK_DB and failed explicitly; corrected supported runner supplies it.
Compound-union-all and Chinook subquery still timeout, but now localized:
`--test-name-pattern='table INTERSECT preserves'` alone times out8s;
SQL `SELECT i AS v FROM storage_values INTERSECT SELECT r FROM storage_values
ORDER BY v`, fixture storage-p4096, expected INTEGER0,1; paired mixed UNION ALL
case in same test not proven reached. Route existing compound owner [[card:card-g]].
B4-only Chinook timeout8s: `SELECT count(*) FROM Track t WHERE EXISTS(SELECT 1
FROM InvoiceLine il JOIN Invoice i ON i.InvoiceId=il.InvoiceId WHERE
il.TrackId=t.TrackId)`, expected INTEGER1984; route [[card:card-t-d]]. These
external watchdogs are not proof of native divergence or engine interruptibility;
no new oracle capture for those timeouts. ON alias remains the independently
native-confirmed engine red. Ordinary four-red/combined owners rerun19/19 exit0.

Package timeout remains unmodified: recorded package commands completed build,
rebuild, typecheck, boundary and dry-run pack before stalled actual pack. No
package pass inferred, no npm configuration/remotes changed. Current repair
changes no runtime bytes, so prior rebuilt browser38+2 applies to unchanged
runtime, not a new packaging acceptance. No commit performed; harness/docs only
are candidates for review.


First supported full run (proc-3db15ca2438f):225 files,221 completed,
1 fail (native-confirmed alias),3 timeouts (compound INTERSECT, Chinook B4,
window-rewrite), aggregate exit1, tracked input drift empty. All three pinned
oracle/capture prerequisites completed exit0; missing-fixture failures resolved.
Newly exposed window-rewrite cleanup debt had68 assertions pass before watchdog;
same test-server teardown replacement yields91/91 exit0 within original30s
watchdog. No SQL assertion, test selection, timeout or work limit changed. First
full manifest and all residual nonzero logs retained under card-w-repair.
Second full run includes that cleanup change; result recorded separately below.


Second full CURRENT run (proc-e5c03aabd15e):225 files,220 completed,
1 fail,4 timeouts, aggregate exit1, zero tracked input drift. Window-rewrite
completed after cleanup repair; residual INTERSECT/B4/alias remained. Additional
row-width-isolated-public and ordinary-scalars-format watchdogs appeared under
8-way scheduling; no causal attribution or waiver. Final manifest and all
nonzero logs copied to card-w-repair/final-full-manifest.json and final-*.log.
This variation prevents declaring reliable broad-green orchestration acceptance.
Next useful bounded attempt: serial discrimination of these two new timeouts,
then tune scheduling (not time/work limits) or repair proven HTTP cleanup only.
Harness-focused tests and50/50 cleanup targets pass, but global outcome remains
still_failing. No engine patch or commit. Package watchdog remains unresolved.

## Repair completion: bounded serial orchestration

The two variable8-way watchdogs independently completed without edits or raised
limits: row-width12.498s and format16.474s (proc-dfc762162fc9; separate serial
manifests). This supports reducing scheduling contention, not attributing every
historical hang to it. Runner now defaults to one file at a time; explicit
`--jobs N` permits positive concurrency. The30s watchdog and3s TERM grace are
unchanged. Hash inputs now include selected untracked tests and runner/helper.

Reproduction from project root with Python3/POSIX and Node24.18.0:
`npm run test:integration:harness`; `npm run test:integration` (or
`npm run test:integration -- FILE...`). Supply `SAIVAGE_CARD_WORK_ROOT` as a
purpose-scoped writable work directory; output is its `integration-run` child.
Full selection builds the pinned oracle and native captures with180s bounded
prerequisites; compiler/Python are development requirements only. Both Chinook
variables use the vendored local database, not live network. Concurrent invocations
must use distinct work roots to avoid overwriting manifests. No npm/native runtime
configuration is changed.

Final serial CURRENT run proc-6f6d89e0f60c terminated aggregate exit1:
**225 selected,222 completed exit0,1 fail,2 timeout,0 not-run**; all three
prerequisites exit0, tracked/selected input drift empty. Manifest and residual
logs: `card-w-repair/serial-full-manifest.json`, `serial-*.log`. Row-width12.449s,
format16.339s, window16.256s all completed under the original30s bound. Original
four-red and combined19/19 evidence above remains applicable, and their files
also completed in this full run. The two residual watchdogs (INTERSECT/B4) and
native-confirmed alias red are preserved; no engine repair here. Route alias/B4
root follow-up to [[card:card-t-d]]; compound to existing compound semantic owner
(the earlier specific card-g suggestion is not verified here). Exact SQL, fixtures,
typed outcomes and oracle gaps are above. These are concrete semantic-owner next
attempts, not harness acceptance prerequisites or silently skipped failures.

Focused repair tests pass: runner normal/nonzero/watchdog/ignored-TERM cases
and positive-jobs validation2/2 exit0 (proc-8209d01b77d4); retained HTTP-body
teardown1/1 exit0 (proc-6f6d89e0f60c). Diff whitespace check0. No expectations,
engine budgets, or product support changed. HEAD remains d9d6759; index empty;
unrelated dirty files preserved. Harness/docs/teardown candidates remain
uncommitted for review. Repair outcome **tests_passing** means focused harness
repair, not integrated broad-green. Historical1539/1543 exit1, unreconstructed
42-file list, package watchdog, and full committed broad/browser/package gaps
remain unwaived. Browser38+gap2/build evidence above applies only to unchanged
runtime inputs, not a fresh published artifact. No compatibility percentage.

## Current diagnosis after approved owner integration

The preceding failures remain snapshot-specific history. Approved owner repairs
now yield dirty-original225 and exact-index-export225 both completed exit0 with
no fail/timeout/not-run and input drift[]. The first export's missing extracted
parse.y prerequisite failure is retained, followed by a full successful rerun,
not counted green from a focused rerun alone. Fresh exact artifact/package and
browser current38/gap2 evidence also pass. See
[current bounded integration outcome](card-w-current-integration-outcome.md)
for snapshot tree, manifests, actual artifact hashes, reproducible command and
remaining historical42-file/nontermination-attribution gaps. Current workflow
is diagnosis: reviewed integration remains staged, not committed here.
