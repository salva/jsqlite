# [[card:card-t-b]] SELECT entry and destination contract status

The earlier bounded repair migrated public `src/index.ts:prepare` into `src/internal/select-compiler.ts:compileSelect`; it did **not** migrate destination or program-builder consumers. Original acceptance remains open.

## Native-first bounded output evidence

`sh tools/oracle/build.sh` built the pinned 3.53.4 source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc` under `$SAIVAGE_CARD_WORK_ROOT/oracle-build`. `python3 test/conformance/select-output-native.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"` and `node --experimental-strip-types --test test/conformance/select-output-differential.test.mjs test/conformance/select-compiler-entry.test.mjs` passed: `SELECT 1 AS a, 2.0 AS b, NULL AS n` (typed integer, real, NULL); `SELECT 1 AS v LIMIT 0` (empty); `SELECT 7 AS v UNION ALL SELECT 8 LIMIT 1 OFFSET 1` (typed integer 8); metadata, first/done, reset and finalize. `npm run typecheck` passed. Initial native probe incorrectly demanded repeated DONE without reset; corrected test, not engine. An attempted public `SELECT 1 AS v WHERE 0` failed atomically in `compileTableSelect` (temporary unsupported), hence replaced by a supported LIMIT 0 for the matched output probe; this does not establish WHERE parity.

## Producer/caller and source map

`src/index.ts:180` -> `src/internal/select-compiler.ts:compileSelect` -> `src/internal/vdbe.ts:compileScalarSelect` (including `compileSubquery` ~1942–2040: child Program relocation of register/cursor/jump, SRT_Mem/Exists/IN replacement and early exit), `compileTableSelect`/`compileInnerTableSelect` (including selected-index `where-plan.ts`), `compileAggregateSelect` (group/window), `compileRecursiveWindowSelect`, `compileRecursiveAggregateSelect`, `compileMultipleRecursiveCtes` and `compileRecursiveCteSelect` (queue/history). Pinned `select.c:112–120 sqlite3SelectDestInit` initializes destination state, `selectInnerLoop` dispatches result disposal including `select.c:1412–1454` Exists/Mem/Output/Coroutine; `expr.c:sqlite3ExprCodeTarget` takes a register target; `vdbeaux.c` builds the single program. Register/cursor allocation and labels must be shared and consumed *before* removing child relocation or result-disposal replacements. Type-only facades around finished Programs do not migrate consumers. Preserve NULL/EXISTS initialization, parameter rebinding, async budgets/cleanup and supported shapes.

## Root joint snapshot update

Root allocated SELECT entry ownership to this card and WHERE/iterator/vdbe joined ~2075–2238 and single ~2889–3144 to [[card:card-s]]. The previous generic shared-file blocker is **resolved**. No edit was made to s's ranges. `node --test test/conformance/select-program-ownership.test.mjs` exits 1 on `compileScalarSelect must consume the shared contract`, before table, aggregate and recursive producers can be marked migrated. This is structural acceptance evidence, not runtime incompatibility. The output differential passes, but native/public compound, aggregate, recursive, window, derived, joined-index and correlated-subquery probes required before their migrations have not all been independently obtained. A local scalar-only builder experiment in `vdbe.ts:1933–2059` passed typecheck but left child Program relocation intact and was reverted without staging because it does not meet the production-caller criterion. `git diff -- src/internal/vdbe.ts` currently shows only s's existing hunks. Continue producer-by-producer native probes and migrate owned hunks with root integration; do not stage mixed files/bitwise/docs wholesale. Neither this report nor the entry-only patch satisfies the full card.

### Incremental builder allocation correction (green-node check)

Pinned `src/select.c:sqlite3SelectDestInit` and `selectInnerLoop` SRT_Mem,
SRT_Exists and SRT_Output allocate/use destinations while generating the same
VDBE; `src/expr.c:sqlite3CodeSubselect` shares Parse allocation rather than
publishing a child Program. The current TS scalar child lowering still splices a
completed child Program (temporary gap), but its reserved child register and
cursor ranges and output row range now advance the same builder used by the
parent expression allocator. Previously `maximum += child.registers` and the
result-row width advanced only a parallel counter; the next builder register
could alias a child or output cell. The remaining child opcode relocation is
not yet a source-shaped lowering, and aggregate/table/compound branches still
need full consuming migration. Structural ownership tests are not a fidelity
claim; see the per-card status for exact passing tests and the earlier failure.

### Grouped aggregate range ownership (next consuming slice)

After independently comparing pinned native/public grouped rows on the read-only
`expr-relational` fixture (`test/conformance/select-aggregate-destination-*`),
`compileAggregateSelect` now reserves every live contiguous aggregate scratch
span with `SelectProgramBuilder.range`, including grouped sorter current/saved
ranges, DISTINCT and ordered aggregate arguments, and output sorter keys. It
publishes the builder's register count, not a second synchronized counter.
This follows the shared register owner in pinned `src/select.c:selectInnerLoop`
and `src/expr.c:sqlite3ExprCode*` as far as this producer's range contract;
SQL sorting/control and the independent cursor/jump strategy are unchanged.
The paired fixture only covers grouped typed output/metadata/reset; other
aggregate shapes and the scalar child Program splice remain open.

### Recursive queue consumer (next bounded migration)

For `compileRecursiveCteSelect` the shared builder now assigns Queue and,
for UNION, the immediately adjacent Distinct cursor, after reserving the
recursive VM's cursor-0 slot. It owns the priority key range and every other
register span without a parallel maximum. The queue-empty branch uses a
builder label resolved at `finish()` after the terminal Halt is placed; the
existing limit/offset and recursive-arm conditional patch sites remain live
and are not removed by this bounded migration. This follows pinned
`src/select.c:generateWithRecursiveQuery` (Queue then optional Distinct cursor,
setup, current-row/queue-empty control) with a TS VM cursor-0 reservation.
Paired source-ID checks are `test/conformance/select-recursive-builder-native.py`
and `test/conformance/select-recursive-builder.test.mjs` (queue, UNION history,
priority order, INTEGER/name/reset/finalize). Existing recursive limit, errors,
async and cleanup checks remain separate tests, not a whole SQLite equivalence
claim. The producer-only aggregate caller remains admitted; child Program
splicing elsewhere is not displaced.
