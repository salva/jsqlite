# Current bounded integration outcome — [[card:card-w]]

## Postalpha fixture repair (base c8f2f666, harness-only overlay)

This checkpoint supersedes any inference that the older225-green snapshot below
still describes current HEAD. Accepted diagnosis replay:219 completed,2 failing,
4 watchdog timeouts,0 not-run, exit1. All225 were executed on committed source;
no changed runtime overlay. Detailed identity/log provenance is in the card record.

Five fixtures incorrectly treated the first zero-delay timer as the first host
suspension. The current execution scheduler uses seven channel tasks before its
timer turn. Suspension tests now gate the execution-owned `yield()` after **real**
task delivery/port cleanup and before the caller resumes. The seek instrumentation
counts that same real yield while seek is active. No checkpoints, budgets, SQL,
row expectations or cancellation/reset/admission/cleanup assertions were removed.
The shared test helper has channel and absent-channel regression cases and restores
the prototype/release on cleanup. It is not runtime code or a microtask substitute.
SQLite `vdbe.c:check_for_interrupt` owns error/progress checks; the TS scheduler is
only a host-delivery adaptation. This fixture repair makes no universal timing or
engine interruption guarantee.

The aggregate structural test now requires the single-source local scan restriction
**and** the joined `sharedJoinInput` WHERE producer feeding `insertGroupedRow`,
with local Next excluded for shared input. Upstream `select.c` GROUP BY calls
`sqlite3WhereBegin` before emitting SorterInsert; current TS `compileInnerTableSelect`
owns joined ON/match/WHERE/null/drain production. This checks current semantic
ownership rather than retaining the superseded textual branch signature.

Six formerly red/timeout files independently pass under unchanged30s watchdogs:
7+23+18+91+1+21 assertions in the initial scoped overlay. That overlay inadvertently
excluded an existing committed aggregate suffix along with peer additions; it is
not whole-file baseline credit. The final staged aggregate file restores every
committed suffix case: fresh complete aggregate10/10 exit0 under30s. No test deletion
is delivered. Combined corrected12-file selection passes0, with input/log drift[];
its aggregate evidence is the scoped7 cases plus the separate complete10 rerun.
Isolated export contains committed runtime and only
explicit test overlays, plus local fixture prerequisites. Peer aggregate-test
additions remain in main but are excluded from this evidence. This is not committed
full225-green evidence. Combined verification and earlier failures are recorded in
`record:///status.md?card=card-w`; exact input hashes/logs/manifests are under
`work:///cards/card-w/repair-task-source/`. The earlier erroneous combined scheduler
filename failed1 and is retained; correcting the file inventory is not a skip.
No native runtime, product scope change, dependency or unrelated peer edit.

## Live-timer fixture follow-up

The verification replay after the initial fixture repair terminated226 completed /
1 fail (227 selected), with no timeout/not-run and three native prerequisites0.
Its separate DISTINCT membership live-abort test still raced an unrelated timer
against a short channel-based probe: `step()` resolved before the timer fired.
Three exact-name retries passed, so that failure was retained as instability,
not dismissed. This is not evidence of a wrong typed row or engine interrupt defect.

The test now starts the same `SELECT DISTINCT a FROM t2` and300-checkpoint Found
probe, observes actual execution-owned host suspension, and holds the caller's
resume until a real zero-delay timer delivers `during-found` cancellation. It
asserts no abort before suspension, the saved cancellation on reset, and successful
statement reuse afterward. No work/checkpoint/time limit inflation or scheduler
runtime change. This deliberately tests live timer-delivered cancellation **during
an observed suspension**, not a guarantee that every short operation outlasts an
unrelated timer. Independent scheduler cadence/fallback and installed-browser timer
fairness evidence remain separate. Commands/manifests and all earlier reds are in
the current card record and `work:///cards/card-w/repair-task-source/`.
Fresh follow-up: six complete relational18-case runs (three channel, three timer)
exit0, then original225 plus helper/scheduler227-file replay exit0, all completed,
no timeout/not-run, three native prerequisites0, input/log drift[]. This is
committed runtime with explicit staged harness overlays, not committed-source
or dirty-main green. Manifest SHA8192ba5f17868063786ea6bd1ecc849d28b8ec0578c15cc3d1de46afe6f5d0a6.
Prior failed replay and historical broad failures remain retained and unwaived.

## Exact sorter-check disposition and ready-candidate boundary

Owner's unqualified “sorter-check timeout” has no distinct case identifier in the
retained record. The reconstructable postalpha sorter-associated timeout is
`aggregate-group-lifecycle.test.mjs`, case “group sorter suspension observes
cancellation, preserves first error, resets and finalizes”: committed c8f2f666
original225 replay manifest (SHA6a304db7150ada4b7bf8c29f69d6708cc28c76887b9398a213b16fdb6f0efd23)
classifies timeout after30.066s, log SHAe62529109b9057c006e0faa79774247911b31d295056548edaf8ebc11a69fc43.
Four preceding cases pass; fifth awaits intercepted first timer. The related
relational timeout instead stopped before the Found suspension case (not proof its
later sorter case was reached). Both exact names and current sorter deadline/work,
cleanup and reset cases are replayed under unchanged30s/file watchdog. The repaired
full227 run completes aggregate10/10 and relational18/18, with actual component
exits0. This disposes **these** identified fixture-ordering timeouts, not a separate
unidentified sorter timeout or the killed historical42-file monolith. No current
engine sorter timeout established; an additional owner case needs its exact
SQL/fixture/run identity before disposition. Historical evidence remains retained.

Scoped candidate comprises accepted eight test/helper overlays and two owning guide/
evidence documents only, on c8f2f666 (skipscanbb5cf804, aggregate7f534d95, scheduler
c8f2f666). Peer staged entries/bytes excluded and preserved. Independent committed
candidate replay identity and results belong in the current card record. No alpha
version, artifact, immutable alpha4, deployment or publication change. Future normal
priority local alpha remains a separate build/package/browser gate; known broader
translation, cross-browser/fairness, clean-offline-cache and unidentified historical
harness gaps are not converted to green by this bounded integration delivery.

## Historical snapshot and result

Base HEAD: `18435d0830f9daeec7aa93156e5f1cce9187b5a7` (approved compound repair).
Reviewed integration index tree: `82cec07694d5e16cbf7bde78785b471a4d73259a`.
This tree excludes unrelated root bitwise changes, advanced-index test changes,
research and caches. Integrated WHERE alias/readiness and joined-EXISTS sort
hunks are attributed to [[card:card-t-d]]; compound private state is already
committed by [[card:card-j]]. No new engine implementation by this card.

* Dirty-current original225 selection: **225 completed / 0 fail / 0 timeout /
  0 not-run**, aggregate exit0, input drift[]. Manifest
  `card-w-current-integration/dirty-original225-manifest.json`, SHA256
  `f94960b9a529bb19d475fc188a32f0c01587d9745d8ddf25fb38b361f527ea85`.
* First exact index export: **224 completed / 1 fail**, exit1. Parser generator
  lacked ignored extracted pinned `src/parse.y`; no engine assertion failed.
  `staged-full-manifest.json` and `first-staged-219.log` retain that failure
  (see manifest for authoritative log name). Supplying the extracted source
  read-only yielded focused generator2/2 exit0. This prerequisite is required,
  not waived or replaced with a skip.
* Final exact index export, `proc-6b9aaca891a9`: **225 completed / 0 fail /
  0 timeout / 0 not-run**, aggregate exit0, input drift[]. Manifest
  `card-w-current-integration/staged-final-full-manifest.json`, SHA256
  `029f18da63b0cf74081ba923937d215cd115aa9d7b2bcfb91979fae83706a1a3`.
  Per-file commands, exits, durations and log hashes are in the manifest;
  logs remain under the card work `current-integration/staged-final-NNN.log`.
  Completion output: `work:///cards/card-w/processes/proc-6b9aaca891a9/stdout.log`.
* Post-run `proc-372ec44e239f`: all1178 export inputs, extracted reference
  inputs and225 log hashes revalidated. Index patch/tree unchanged. Unrelated
  dirty VDBE, advanced-index test and runtime-review bytes matched pre-run
  hashes. A preliminary comparison of tree-ID text with `git ls-files` text
  returned false because those are different representations; actual
  `git write-tree` comparison matches exactly.

The full225 list includes the original four-red files
`run-expression-bounded-ts.mjs`, `run-ordinary-scalars-pattern-ts.mjs`,
`run-order-limit-contract-ts.mjs`, and combined affected scalar/subquery,
compound, WHERE alias/B4, endpoint, lifecycle and window paths. Original focused
12/12 and combined19/19 evidence remains in
[diagnosis chronology](card-w-integration-diagnosis.md). Final export also
passes the new membership tests. Counts are observations, not compatibility
percentages or corpus-wide completion.

## Reproduction and boundary

Use Node24.18.0, npm11.16.0, Python3.12.3, POSIX process groups, compiler and
manifest-pinned SQLite3.53.4 source archive/extraction. Verify the archive SHA256
`d18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b`;
source ID is `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
`tools/oracle/build.sh` produces the development-only library/profile in the
purpose-scoped work root. The runner invokes that build and r1/r2 capture scripts
before selecting suites requiring their native fixtures. Exact export reused
those already-generated pinned fixtures; it did not pretend to build them in
that export. No native runtime is packaged.

From the project root, with a writable, purpose-scoped `SAIVAGE_CARD_WORK_ROOT`:

```sh
npm run test:integration:harness
npm run test:integration
# To repeat the exact historical/current225 selection rather than a growing glob:
python3 - <<'PY'
import json, subprocess
m=json.load(open('docs/research/card-w-current-integration/staged-final-full-manifest.json'))
raise SystemExit(subprocess.call(['python3','tools/test/integration.py',*m['files']]))
PY
```

Runner defaults serial; positive `--jobs N` is optional, not equivalent timing
evidence. Per-file30s process-group watchdog, TERM then3s KILL grace; native
prerequisite180s bound. Failed prerequisites classify selected files not-run.
Timeout is always non-pass, never proof of engine interruption. Concurrent
invocations require separate work roots. Node commands use
`--experimental-strip-types --test FILE`. Both Chinook environment variables
point to vendored `examples/browser/chinook.sqlite`; no live-network fixture
prerequisite. Inventory excludes only the argv-requiring audit entrypoint as
previously reconstructed, not failing tests.

Harness tests freshly passed2/2 and retained-HTTP-body teardown1/1
(`proc-f1ae0c1a5418`); cached whitespace check0. Teardown closes the server then
all connections after SQL cleanup, preserving assertion failures. Coverage
checks normal exit, exact exit7, TERM timeout, ignored-TERM KILL and invalid jobs.
Thirty-second limits and engine budgets were not increased. Serial scheduling
resolved observed contention-sensitive row-width/format watchdogs; it does not
prove all old hangs had the same cause.

## Fresh artifact/browser evidence

Dirty typecheck/boundary/build and bounded package checks passed
(`proc-b21d89df29e0`); dirty tarball SHA256
`7c411dde32eff28c6da6e19d19392909b3450f987ca34fbe71e57a069957fab1`.
Exact staged-export guarded typecheck, boundary, build, package passed exit0
(`proc-2d48b3a176e9`),31 runtime modules /64 package files,366085 compressed bytes,
1870482 unpacked bytes. Fresh staged tarball SHA256
`6d5efe0226bb7fddde83c2038d39570af582a1083ef0d04542de93c03358e52a`;
`staged-package.json` SHA256
`3303c97d2b3b0ddd41576913c4719bf5aa57b4f7e80fa16df9827fe3b17227ff`.
These distinct dirty/index artifacts are not a published package claim.

Dirty and exact staged browser lanes each pass current38/38 and gap2/2
(`proc-31de8950ea44`, `proc-9873362841e0`). Playwright1.60.0,
Chromium148.0.7778.96. Reports retain actual dist module hashes and per-case
native provenance: `staged-browser-current.json` SHA256
`c3bd0b96e6e36a8fdaf59faabc3885defdb0a954975f754df144115f51ebb7f8`,
`staged-browser-gap.json` SHA256
`49611263e40d69b8971398190df3ecbcfc940f8aba522ee6dc183b12edde7d1d`.
The browser-tool download used network, not database fixture acquisition.

## Historical failures and remaining gaps

Historical immutable6ba3 broad1539/1543 exit1, killed/nonterminating monolithic
42-file harness, initial216/3/5 run, repaired221/1/3 and220/1/4 trials and
serial222/1/2 exit1 remain unwaived. These are different snapshots, not current
reds. Their exact repro SQL/typed outcomes and owner routing remain in the
chronology; source-authoritative repairs are linked through the owner report.
The original42-file command/list and exhaustive nontermination attribution
remain unreconstructed. Historical package30s watchdog124 remains a historical
nonpass; fresh bounded60s package completion is new evidence, not erasure.
No deleted assertions, skip conversions, rewritten expectations, expanded work
limits, scope changes or causal assertions from merely old reproduction.

Current diagnosis: meaningful bounded integration coverage passes. No currently
reproduced engine blocker remains in this225-file selection. This is not full
SQLite compatibility, every repository test/script, release conformance or
proof of recoverable engine interruption. Source/index snapshot evidence is
separated from dirty runtime evidence and subsequent documentation-only changes.
