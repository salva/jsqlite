# LEFT consumer delta evidence — [[card:card-n-c]]

## Identity and integration boundary

Local integrated workspace based on `14e212736d8379a4a4d8d7cf26f9657a6c27eb6e`, with substantial pre-existing peer source/index edits. `left-source.patch` is the **owned source delta against that pre-repair workspace**, not HEAD. Apply exact hunks to matching integrated inputs, never replace whole files or stage peer edits. It covers vdbe.ts, private-state.ts and resolve.ts. No independent approval or MAIN commit is claimed. Cached binary diff SHA256 remained `5154f2de98af71882c4060838fa4638ebdeee73b892ddc20639cb4e17c793a8e` before/after (proc-0edb0cd367c9 and proc-6a90ecd2f773).

Source rationale: pinned select.c Queue/Current and retained SrcItem paths feed existing shared WHERE consumers. LEFT match state already resets inside each inner-loop entry; no new join evaluator is needed. Admission now permits LEFT, not RIGHT. VM NullRow previously cleared only physical records; private Column read stale/unpositioned rows. Handle-local nullRow governs private Column/Rowid/IfNullRow. OpenEphemeral/OpenDup initialize it true independently; Rewind publishes emptiness, Next publishes exhaustion, and completed integer SeekRowid clears it even on miss (the caller jumps, not reads). Shared clear/sort invalidates positions without resetting per-handle flags; reading resumes after Rewind. OpenDup shares entries, not NullRow. Pinned columnTypeImpl follows the right-most compound arm into Current; direct self columns report CTE table/origin with database NULL, computed expressions no origin. Resolution now links that producer rather than returning all-null provenance indiscriminately.

## Native/public comparison

`left-native.json` and `left-public.json`: ten SQL shapes × UTF-8/16le/16be, twice after reset, full metadata and typed cells. `left-capture.py` checks pinned sourceid `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`. Images use existing test/fixtures/recursive-join inputs. These are companion observations, **zero new upstream credit**.

Commands (fresh capture output directory required):

```sh
COMMON_CHECKPOINT_SOURCE="$PWD" COMMON_CHECKPOINT_OUTPUT="$SAIVAGE_CARD_WORK_ROOT/left-repair/native" python3 docs/research/recursive-join/left-capture.py "$PWD/.saivage/work/cards/card-e-l/oracle-build/build/libsqlite3-oracle.so"
COMMON_CHECKPOINT_SOURCE="$PWD" COMMON_CHECKPOINT_OUTPUT="$SAIVAGE_CARD_WORK_ROOT/left-repair/native" node --experimental-strip-types docs/research/card-w-common-checkpoint/public-probe.mjs
```

Native completed proc-e77927c04adc; final public/assertion proc-fc720a018e06 proves **30/30 match**, including both original reproducers, ON/WHERE, empty/NULL/duplicates, body ORDER/LIMIT/OFFSET versus consumer, group count and correlated scalar read. Earlier expanded observation exposed NULL companion metadata divergence (proc-eb7304a822d2), not a passing30 run. That discrepancy is resolved by producer metadata linkage. A first metadata implementation incorrectly passed an arm as SelectNode: 12 focused failures (proc-6d2c6fd322c8), corrected by constructing the SelectNode retaining parser-wide fields. No expectation was weakened.

## OpenDup corrective candidate (supersedes initial-state claims above)

Independent [[card:card-n-d]] v147's gap was confirmed in owner red187: initial Column/Rowid threw and finalize repeated the invariant; IfNullRow returned99. The new `ephemeral-null-row.test.mjs` retains the exact three opcode tails and assertions, plus original OpenEphemeral, live-owner/duplicate isolation, empty Rewind, exhausted Next, Close/reopen and reset/finalize. Object-level controls additionally distinguish successful/failed SeekRowid and shared clear/sort flag locality. No SQL-text workaround or new evaluator.

Pinned branch comparison: `vdbe.c` OpenDup4490/OpenEphemeral4619 set nullRow=1; Rewind6399 publishes empty result; Next6510ff sets nullRow on exhaustion; SeekRowid5535ff clears it after completed integer lookup even on miss; ResetSorter7006ff clears storage without resetting VdbeCursor.nullRow. Thus clear/sort no longer force flags false on every sharing handle. Sort is the existing browser representation's explicit reorder phase; it invalidates positions, and its callers perform Rewind before reading. The internal EphemeralResetPosition uses a before-first position and now keeps reads NULL until Next positions it. Failed SeekRowid requires the existing caller jump, not a fabricated NULL-row rule. No unrelated cursor algorithm substitution.

Only `src/internal/private-state.ts` production bytes changed for this correction; vdbe/resolve remain the prior LEFT candidate. Amended `left-source.patch` SHA256 **d40476cd519abcd8bd262f070ef79787a770055aec51631124be8874e0cc2915** replaces the previous patch for review, against the **same preserved peer preimage, not HEAD**. Preimage SHA256: vdbe `4f3f994f865f3dad211e067f33e0cf53d05e7a7062ba17fae9b36fc1f40d561f`; private-state `612e2551032f9c6add58e08b215ced85d7d346250e2a62a466d381df336d4fce`; resolve `9cab63c7b2777f1e7b8a61e13de91559a009312b2a7d30a855d86ed16f9513db`. Candidate private-state SHA256 `242ddcbe41df368b11888a8674a10718b51072316d27bda0d735cd7c1394f3d1`; vdbe/resolve hashes remain in prior evidence. Reverse-applying the regenerated patch to copied candidate files and recursively comparing restored files with the preserved preimage passed (proc-33e1538f5e09); cached binary diff remained `5154f2de98af71882c4060838fa4638ebdeee73b892ddc20639cb4e17c793a8e`. Initial reverse-check command used a post-cd PWD and failed to locate its patch (proc-4331128f4ce9); fixed by capturing the absolute patch path before cd, not ignored.

Correction inventory: private-state.ts; extended ephemeral-null-row.test.mjs; TRANSLATION.md, SQLITE_SOURCE_MAP.md, mutable fidelity audit current branch assertions; this evidence document; regenerated left-source.patch. Prior LEFT tests/metadata/admission changes and native/public JSON/capture inputs unchanged.

Final corrected checks: `work:///cards/card-n-c/processes/proc-2d2f3c6f573b/stdout.log`, exit0/empty stderr under `set -e`: same ten-file serial command listed below, now **101/101** (original91 plus10 added tests), no skip/cancel/todo,37.05s; then recursive manifest, `npx tsc --noEmit`, `git diff --check` pass. Initial corrected subset9/9 (proc-7a3e666e873f) and intermediate100/100 (proc-cd0deb6150db) precede the exact-tail assertion added last; final101 is authoritative. The exact independent tails all return NULL and finalize cleanly.

Current public execution rerun against retained pinned native input: proc-56c0edb7865a exit0, explicit **30/30** JSON match assertion (typed cells/fullmetadata/two resets). No fresh native-library capture this correction. Independent147's24 adversarial matches remain pre-correction evidence, not rerun evidence. Historical upstream credit unchanged. Author checks are not independent acceptance; corrected review and exact-hunk integration remain outstanding. No staging, commit, CAS, release or full-suite claim.

## Prior focused verification (pre-correction)

Completed exit0 `work:///cards/card-n-c/processes/proc-fc720a018e06/stdout.log` (stderr empty), under `set -e`:
- Public probe plus explicit JSON assertion30/30.
- `node --experimental-strip-types --test --test-concurrency=1` on recursive-cte-left, ephemeral-null-row, recursive-cte-join, cte-admission, recursive-cte-aggregate, cte-execution, select-recursive-builder, recursive-group-window-projection, compound-private-key-position and relational-private-lifecycle `.test.mjs`: **91/91**, no skips/cancel/todo, 33.15s total.
- `python3 test/conformance/recursive-cte-manifest.test.py`: unchanged five upstream assertions + two no-credit companions,21 native encoding executions.
- `npx tsc --noEmit`; `git diff --check`: pass.

LEFT tests include both direction metadata/reset, bind/rebind, work/entry bounds, pre-abort/deadline, timer abort/sticky state; cursor test covers local NullRow versus duplicate and reposition/clear. Existing INNER/aggregate/CTE/view/window-neighbor tests are regression evidence, not joined-window support. Materialized producer work/private space precedes consumer rows; no native-planner identity or streaming promise. Product budgets unchanged; no full suite, GUI browser, original225 reconciliation or broad recursive acceptance. Independent delta review/integration remains necessary. RIGHT/FULL, repeated recursive references and joined window/compound backlog remains actionable.
