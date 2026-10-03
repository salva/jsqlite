# Card-u documentation reconciliation evidence

Owned by [[card:card-u]]. Documentation-only handoff at the supplied accepted t/s
boundary; no engine/test source, operator inputs, scope, guarantees or compatibility
credit changed. Root roadmap work continues.

## Capture and preservation

Initial inspected HEAD: `adfd6a4ba6e7da9b8ca7d9d3f23117b23472f654`.
Initial `git status --short` already contained dirty `src/internal/vdbe.ts`,
`test/conformance/run-advanced-index-ts.test.mjs`, peer card-t research and Python
cache. These remain unrelated and unstaged. `AGENTS.md` development-input duty,
SPEC, PLAN and the source manifest were read; operator-owned inputs were not
edited. Complete old guide/map/API/README/PLAN/oracle bytes are retained in
[history](card-u-history/README.md); its manifest records hashes/section/line
provenance. This is not deletion of evidence for size.

Record provenance consulted: [[card:card-t]] status v96 (including the finite
technical disposition, review-v6 F1 rejection and controlled endpoint remedy),
[[card:card-s]] status v60, [[card:card-r]] status v18,
[[card:card-o]] status v20 and [[card:card-k]] status v9. The invocation supplies
root inspection/DONE and accepted boundary context; older status records alone
are not inferred to be independent final acceptance. No review is overwritten.
Existing t research links retain intermediate reds and exact attributed exports.
The mutable audit explicitly labels its original baseline as prediction-only;
its current tail records the actual WR NOT INDEXED and DeferredSeek continuation
repairs. Those current branch statements, not baseline generalizations, were
compared with the current source.

## Reconciled current statements

- README/PLAN: input-only/first-SELECT ceiling replaced by current bounded breadth,
  without a new full-engine or Stage-4 completion claim. Stage sequencing remains.
- Guide: one current ownership/control contract per subsystem replaces competing
  proposal/correction diaries. Full history remains linked and hash-preserved.
- Source map: current upstream → TS → tests/evidence navigation replaces repeated
  command inventories. Window and multisource mapping is no longer a blanket gate.
- API: stable public declaration/lifecycle core retained, current admission
  consolidated. `declaredType: string | null` may be empty when available; hidden
  JSON json/root metadata is not normalized to null. JSON registry/table/aggregate
  support is current, not unavailable; json_pretty remains temporary unsupported.
- Compound rationale: lack of a native resumable stack/missing coroutine machinery
  is marked historical and insufficient. `select.c:multiSelectByMerge` allocates
  A/B coroutine registers in one Parse/Vdbe and emits InitCoroutine/Yield/EOF/
  duplicate/output branches; TS has that machinery. `vdbe.ts:emitScalarCompoundMerge`
  actually emits linked A/B coroutine/CompareJump/output/EOF control.
  Other finite ordered scalar/VALUES/literal-parent routes still materialize with
  typed sorter/set destinations. Bounded provisional Planner disposition and
  actual admission/evidence survive; native intermediate-error/work/suspension
  parity and route-specific necessity in TS remain unproved. This gap is reported
  for the owning Planner, not invented approval or a docs-only engine refactor.

Current source inspected: public declarations and prepare/lifecycle in
`src/index.ts`; `compileSelect` selection/publication in select-compiler;
SelectProgramBuilder/SelectDest; resolver identities; finite compound and retained
source consumers in vdbe; private seek owner and awaited VM consumer. The controlled
seek loop charges each visited entry, rechecks live state after await and publishes
position after success. Pinned select.c coroutine and destination branches,
vdbe.c seek/deferred positioning, where.c loop end, JSON declarations/names and
source identity were used for affected statements. Naming a routine is navigation,
not new fidelity proof.

## Oracle invocation: executed, not inferred

`tools/oracle/sqlite_oracle.c` requires exactly `--self-check SOURCE_ID`; argv[2]
is directly compared to sqlite3_sourceid. `build.sh` already extracts the manifest
source-ID string correctly. The old docs supplied the manifest pathname instead.
No implementation was changed.

Commands in this activation:

```sh
tools/oracle/build.sh > "$SAIVAGE_CARD_WORK_ROOT/oracle-build-u.log" 2>&1
"$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/sqlite-oracle" \
  --self-check "$PWD/reference/sqlite/manifest.json"
SOURCE_ID=$(python3 -c 'import json; print(json.load(open("reference/sqlite/manifest.json"))["sqliteSourceId"])')
"$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/sqlite-oracle" --self-check "$SOURCE_ID"
sha256sum "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/sqlite-oracle"
```

Build exit 0. Old invocation exit **1**, stderr `source id mismatch`; final
sequential shell success does not erase that failure. Corrected invocation exit 0,
reports SQLite 3.53.4 and exact pinned source ID, metadata/math options and true
JSON/math/UTF-16/UTF-8/floating-point/metadata/autoreset probes.
Built binary SHA-256:
`9c0409f5ead3d28ebd6971182b05f3d16a10f088643a9338b497e442504c01fd`.
Build work is under the purpose-named card work root `oracle-build`, not committed.
The output stream is retained at
`work:///cards/card-u/processes/proc-6e6ac2165208/stdout.log` and stderr counterpart.
This is oracle setup verification, not SQL compatibility credit.

## Validation and explicit gaps

Initial relative-link/hash validation found one not-yet-authored target,
`card-u-consolidation.md`; exit 1 retained. Archive SHA checks already passed.
Subsequent validation and milestone hash are recorded below after completion.
Public API and representative accepted subsystem tests are focused coherence
checks, not reacceptance of the full t/s export or a broad compatibility run.

Remaining explicit gaps: route-specific exceptional materialization rationale;
native intermediate scheduling/error/work parity; full semantic analyzer/deeper
transient correlation; broader optimizer/BIGNULL proof and arbitrary composition.
Those are consuming roadmap questions, not a new universal cleanup gate.
No incidental engine defect was reproduced or repaired by this documentation card.
The package's first-select version string remains unchanged as metadata outside
this bounded documentation slice, not a current capability ceiling.

Explicit pinned file:symbol validation initially found one stale historical name:
`sqlite3BtreeMovetoUnpacked` is not present at this pin. Current pinned API splits
`sqlite3BtreeTableMoveto` and `sqlite3BtreeIndexMoveto`; the private rowid comparison
now cites the actual TableMoveto owner. This was a documentation correction only.
The first symbol checker failed (even though its sequential shell ended 0); it is
not reported as a passing check. Rerun results follow in the final evidence section.

## Final focused verification and diff review

`node --experimental-strip-types --test
 test/conformance/compound-collation.test.mjs
 test/conformance/json-table-functions.test.mjs
 test/conformance/private-endpoint-seek-control.test.mjs` passed **23/23**,
zero fail/cancel/skip/todo. The subsequent `npm run typecheck` exited 0.
Complete retained output: `work:///cards/card-u/processes/proc-e64a5821417f/stdout.log`.
This verifies touched metadata/JSON, compound collation and controlled seek
statements at current inputs; no fresh whole-project/export compatibility run.

Final `set -e` validation: relative Markdown targets/anchors, all six archive
SHA-256 values and 22 explicit pinned file:symbol references passed;
`git diff --check` passed. Stable API examples/declarations, current guide/map,
README/PLAN and exact oracle diff were inspected. Old normative material was
preserved byte-for-byte, not silently edited in the history carrier.
Peer untracked research remains untouched; current guidance links its durable
card records instead of making this commit depend on uncommitted research files.
No runtime/test/config files are staged by this card.
