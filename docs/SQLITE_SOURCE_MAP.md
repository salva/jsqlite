# SQLite source map

Current upstream → TypeScript → test/evidence navigation. The source root is
`reference/sqlite/sqlite-src-3530400/`, pinned by
[manifest](../reference/sqlite/manifest.json). [Translation guide](TRANSLATION.md)
owns current design; [API](api.md) owns the public contract. This map does not
claim complete upstream coverage or reproduce execution inventories.

The [complete prior map](research/card-u-history/SQLITE_SOURCE_MAP.md) preserves
original line/section pointers and run provenance; [history manifest](research/card-u-history/manifest.json)
records exact capture identity. [Oracle](oracle.md) owns reproducible development
setup. Baseline findings in the [mutable audit](reviews/translation-fidelity-2026-09-14.md)
require current producer/consumer verification, not automatic acceptance.

## Distributable integration

The existing translated API/runtime closure is emitted unchanged by
[tsconfig.build.json](../tsconfig.build.json) and [build tooling](../tools/package/build.mjs).
[Package regression](../test/package-distributable.test.mjs) validates the actual
local tarball, named ESM/public declarations and browser-global execution;
[evidence](research/card-v-a-package-evidence.md) records inventory and limitations.
This integration has no new C algorithm mapping or SQL coverage credit.
[Static demo consumer](../examples/browser/query.js) uses those public lifecycle
and column APIs; [browser regression](../test/demo/browser.test.mjs) and
[evidence](research/card-v-c-demo-evidence.md) check local Fetch, positional types,
failed-open and operation/finalize/close ordering without a query backend.

## API and immutable database

| Pinned implementing owners | Current TS owners | Tests/evidence navigation |
|---|---|---|
| `sqlite.h.in`; `main.c:sqlite3Close`; `prepare.c:sqlite3Prepare`; `vdbeapi.c:sqlite3_step`, `sqlite3_reset`, `sqlite3_finalize`, bind/column APIs | [src/index.ts](../src/index.ts), statement VM lifecycle in [vdbe.ts](../src/internal/vdbe.ts) | [test/select](../test/select/), [API lifecycle](api.md#lifecycle-and-cleanup); [[card:card-b]], [[card:card-t]] |
| `pager.c` read acquisition; `btree.c:sqlite3BtreeOpen`, page initialization/traversal/overflow routines | [storage.ts](../src/internal/storage.ts), [btree.ts](../src/internal/btree.ts): `BtreeDatabase`, `openBtreeDatabase` | [test/storage](../test/storage/), [test/storage](../test/storage/); prior map “Pinned source and usable development cache”, “Stage 3” storage sections |
| `vdbeaux.c:sqlite3VdbeSerialGet`, record comparison; `vdbemem.c`; `utf.c` | [record.ts](../src/internal/record.ts), [mem.ts](../src/internal/mem.ts), [utf.ts](../src/internal/utf.ts), [comparison.ts](../src/internal/comparison.ts) | [test/conformance](../test/conformance/), prior map “Stage 3 comparison/collation/record-key mapping”, “Internal Mem/value slice” |
| `build.c`, `pragma.c` schema metadata, `prepare.c` initialization and `select.c` view/result descriptors | [schema.ts](../src/internal/schema.ts), parser and resolver | [API metadata](api.md#stepping-bounded-work-and-rows); [[card:card-e]], [[card:card-r]] metadata evidence |

Immutable whole-file residency and browser async Fetch replace pager write/locking
machinery, not record/page semantics. UTF-8/UTF-16le/UTF-16be and overflow/bounds
remain required. WITHOUT ROWID primary layouts are not ordinary rowid roots.

## SELECT resolution and construction

| Pinned owners | Current TS path | Tests/evidence |
|---|---|---|
| `tokenize.c:sqlite3GetToken`, `parse.y`, generated Lemon parser, `prepare.c` tail/error flow | [tokenize.ts](../src/internal/tokenize.ts), [parse.ts](../src/internal/parse.ts), [lemon-runtime.ts](../src/internal/lemon-runtime.ts), [admission.ts](../src/internal/admission.ts) | [test/parser](../test/parser/); prior guide “Stage 3 parser and schema representation decision”; [[card:card-e]] |
| `resolve.c:lookupName`, `resolveExprStep`, `resolveSelectStep`; `expr.c` collation/affinity/subquery lowering | [resolve.ts](../src/internal/resolve.ts): `expandAndResolveSelect`, linked NameContext/aggregate owners; shared expression codegen in [vdbe.ts](../src/internal/vdbe.ts) | [[card:card-t-c]]; [linked scalar census](record:///status.md?card=card-t-c); prior guide/source map aggregate/subquery ownership sections |
| `select.c:sqlite3Select`, `sqlite3SelectDestInit`, `selectInnerLoop` | [select-compiler.ts](../src/internal/select-compiler.ts): `compileSelect`; [select-program.ts](../src/internal/select-program.ts): `SelectProgramBuilder`, `emitSelectDestination`; selected generators in [vdbe.ts](../src/internal/vdbe.ts) | [[card:card-t-b]], [[card:card-t-d]]; [fallthrough census](record:///status.md?card=card-t-b), [current integration evidence](record:///status.md?card=card-t-d) |
| `vdbe.c:sqlite3VdbeExec`, coroutine/branch/column/value operations | [vdbe.ts](../src/internal/vdbe.ts), [vdbe-primitives.ts](../src/internal/vdbe-primitives.ts) | [relational lifecycle](../test/conformance/relational-private-lifecycle.test.mjs), [aggregate lifecycle](../test/conformance/aggregate-group-lifecycle.test.mjs); [[card:card-t]] changed-export records |

Shared builder/parameters/destinations own selected compilation and publication;
branch decline precedes emission and selected errors propagate. Linked identities
and phase select physical/sorter/saved/coroutine registers. Accepted bounded
migrations do not establish full AggInfo/analyzer or arbitrary composition.

## WHERE and joins

`whereLoopAddBtreeIndex` exploration (where.c3284,3580ff) maps to suspended
`capabilities` proposals and immediate `whereLoopInsert` in `btreeLoops`;
exhaustion closes exploration, not just admissions. `whereLoopAddAll`4966/5025ff
maps to `planWhere` shared budget/per-source continuation. Private production
budget tests observe stopped composite leaf construction and later-index access.

Ordered `whereLoopFindLesser/whereLoopInsert` (where.c2744–2939) and bounded
`wherePathSolver` (5835ff) map to `whereLoopInsertCandidates/wherePathSolver`
in `where-plan.ts`; `where-plan-ordered-red.test.mjs` discriminates replacement,
drop/tail deletion, sort/prerequisite identity, setup/budget and vector ties.
`indexMightHelpWithOrderBy` (where.c3664ff) → `btreeLoops` sort-identity
production: reject unordered indexes, retain same-cursor rowid/IPK usefulness
before key-column matching, separately from complete order proof.
`in-range-stat-choice-red.test.mjs` covers competing unforced/forced persistent
indexes before/after ANALYZE in all encodings; `where-plan-analysis.test.mjs`
checks identity retention with unsatisfied physical ORDER.
[Decisions and bounded evidence](research/card-s-d-a-ordered-where.md); indexed
row-size metadata and OR-set/automatic-index/STAT4/star branches remain gaps.

`whereexpr.c:sqlite3WhereExprAnalyze` → [where-plan.ts](../src/internal/where-plan.ts)
terms/dependencies. `where.c:whereLoopAddBtree`, `wherePathSolver`,
`sqlite3WhereBegin`, `sqlite3WhereEnd` → candidate/path/level state and SELECT
caller in [vdbe.ts](../src/internal/vdbe.ts). `wherecode.c` → seek/range/deferred
positioning and residual checks; `resolve.c` → resolved ORDER/alias/column identity.

Tests: [multisource-inner-order](../test/conformance/multisource-inner-order.test.mjs),
[multisource-left](../test/conformance/multisource-left.test.mjs),
[multisource-right-full](../test/conformance/multisource-right-full.test.mjs),
[advanced-index runner](../test/conformance/run-advanced-index-ts.test.mjs).
Evidence: [[card:card-k]], [[card:card-s]],
[card-s status](record:///status.md?card=card-s), prior map advanced-index/selected
WHERE sections, [mutable audit tail](reviews/translation-fidelity-2026-09-14.md).

Current boundaries: one RIGHT/FULL barrier; selected expression/partial/covering/
WITHOUT ROWID paths, not optimizer completeness. Genuine IPK/rowid proof and
complete resolved ORDER/NULL flags precede plan consumption. Conservative typed
sorting handles unproved BIGNULL ordering. Ordinary continuation must revisit
`scan.loopStart` including DeferredSeek before projecting a new row. WR NOT INDEXED
uses the primary layout. Prior baseline seek/scan predictions are historical,
not universal current failures.

## Sort, compound and aggregates

| Pinned owners | TS consumers | Tests/evidence |
|---|---|---|
| `select.c:pushOntoSorter`, `generateSortTail`, `computeLimitRegisters`, `DistinctCtx`, `SortCtx`; `vdbe.c` sorter/ephemeral ops | [vdbe.ts](../src/internal/vdbe.ts), [private-state.ts](../src/internal/private-state.ts), [comparison.ts](../src/internal/comparison.ts) | [relational lifecycle](../test/conformance/relational-private-lifecycle.test.mjs); prior guide ORDER/DISTINCT/LIMIT sections |
| `select.c:multiSelect`, `multiSelectByMerge`, `multiSelectCollSeq` | `emitScalarCompoundMerge` and compound/table/CTE/derived producers in [vdbe.ts](../src/internal/vdbe.ts); shared destinations | [compound collation](../test/conformance/compound-collation.test.mjs), [UNION ALL](../test/conformance/compound-union-all.test.mjs), [VALUES unsupported](../test/conformance/compound-values-unsupported.test.mjs); [[card:card-j]], [[card:card-t]] |
| `select.c:updateAccumulator`, grouped/non-grouped codegen; `resolve.c` aggregate analysis; `func.c` callbacks | linked aggregate phases in [resolve.ts](../src/internal/resolve.ts), lowering/VM in [vdbe.ts](../src/internal/vdbe.ts), [functions.ts](../src/internal/functions.ts) | [aggregate lifecycle](../test/conformance/aggregate-group-lifecycle.test.mjs), [JSON numeric groups](../test/conformance/json-group-numeric-types.test.mjs); [[card:card-l]], [[card:card-t-c]] |
| `expr.c:sqlite3CodeSubselect`, `sqlite3ExprCodeIN`, RHS construction | linked scalar/EXISTS/IN destinations and correlated rebuild/Once control in [vdbe.ts](../src/internal/vdbe.ts) | [[card:card-m]], [[card:card-t-c]]; prior map expression-subquery sections |

[Surviving finite adaptations](TRANSLATION.md#surviving-finite-materialization-adaptation)
are not the same-VM coroutine merge algorithm. [Finite disposition](record:///status.md?card=card-t&v=96)
and [[card:card-t]] retain bounded evidence and limitations; lack of a native
resumable stack is not a current platform rationale. IN borrowed arrays preserve
finite gates and charged cleanup but do not claim general storage/complexity parity.

## Derived sources, CTE and windows

- `select.c:flattenSubquery`, SrcItem coroutine/materialized branches,
  `resolve.c` transient descriptors → [cte.ts](../src/internal/cte.ts),
  [resolve.ts](../src/internal/resolve.ts), same-builder producers in
  [vdbe.ts](../src/internal/vdbe.ts). Evidence [[card:card-m]], [[card:card-n]],
  [[card:card-t]]; prior map subquery/view and ordinary WITH sections.
- `select.c:generateWithRecursiveQuery` Queue/Current/setup/recursive/destination
  control → `recursiveCteOwner`, `CtePrepareContext`, recursive generators in
  [vdbe.ts](../src/internal/vdbe.ts). Body versus consumer LIMIT ownership and
  duplicate/queue order remain separate. Evidence [[card:card-n]], [[card:card-t-d]].
- `window.c:sqlite3WindowRewrite`, `sqlite3WindowCodeInit`,
  `sqlite3WindowCodeStep`, `windowCacheFrame` →
  [window-rewrite.ts](../src/internal/window-rewrite.ts): `sqlite3WindowRewrite`,
  shared lowering in [vdbe.ts](../src/internal/vdbe.ts).
  Tests [retained endpoint integration](../test/conformance/select-window-retained-endpoint-integration.test.mjs),
  [first/nth endpoint](../test/conformance/window-first-nth-endpoint-owner.test.mjs).
  Evidence [[card:card-o]], [[card:card-t]] and prior map window sections.
- `btree.c:sqlite3BtreeTableMoveto`, `vdbe.c:OP_SeekRowid` → finite private
  `seekRowid` in [private-state.ts](../src/internal/private-state.ts), awaited VM
  caller. Controlled async linear adaptation is not native Btree complexity.
  [Primitive tests](../test/conformance/private-endpoint-seek-control.test.mjs),
  [public tests](../test/conformance/window-endpoint-seek-control-public.test.mjs),
  [repair evidence](record:///status.md?card=card-t-d&v=456).

Windows and multi-source/CTE consumers are no longer blanket preimplementation
gates; actual bounded semantic branches govern admission. Cached EXCLUDE/frame
schedules retain endpoint ownership; arbitrary cross-feature composition is not
promised.

## Functions and encoding

`func.c`, `printf.c:sqlite3_str_vappendf`, `date.c`, `json.c`, `utf.c`,
`vdbemem.c` → [functions.ts](../src/internal/functions.ts),
[ordinary-scalars.ts](../src/internal/ordinary-scalars.ts),
[pattern.ts](../src/internal/pattern.ts), [printf.ts](../src/internal/printf.ts),
[date-time.ts](../src/internal/date-time.ts), [math.ts](../src/internal/math.ts),
[json.ts](../src/internal/json.ts), [utf.ts](../src/internal/utf.ts),
[mem.ts](../src/internal/mem.ts).

JSON parser/path/mutation/JSONB and aggregate/table callbacks are translated
internals, not host JSON.parse semantics. Tests
[JSON full scalar](../test/conformance/json-scalar-full.test.mjs),
[table functions](../test/conformance/json-table-functions.test.mjs),
[aggregate paths](../test/conformance/json-aggregate-paths.test.mjs),
[BLOB document](../test/conformance/json-blob-document.test.mjs),
[pattern/window](../test/conformance/ordinary-scalars-pattern-window.test.mjs).
Evidence [[card:card-p]], [[card:card-q]], [[card:card-r]] and
[card-r metadata status](record:///status.md?card=card-r).
`json_pretty` remains temporary unsupported; built-in JSON is not a blanket gap.
Exact function tranche runs/IDs remain in existing oracle/conformance research,
not duplicated here.

### Retained FROM hidden ORDER key correction (2026-10-03)

`resolve.c:resolveOrderGroupBy` EList alias/ordinal then NameContext column
ownership -> `vdbe.ts:compileDerivedProducer` orderIndex now denotes producer
register index, not parent projected register index. `select.c:flattenSubquery`
(11), `fromClauseTermCanBeCoroutine` (1a), 0482 / SRT_Coroutine -> existing
InitCoroutine/Yield/EndCoroutine and separate child/parent sorters. Tests:
`subquery-view-foundation.test.mjs` retained hidden ORDER key / route cases.
Original browser gap lane now executes both original probes successfully;
no general retained expression ORDER or full FROM compatibility claim.

Nullable selected equality keys: `wherecode.c:codeAllEqualityTerms`976–980 →
ordinary/joined `vdbe.ts` equalityNullGuards, separate from range addrNxt guards.
Equality NULL breaks the level (including all IN iterations); LEFT unmatched
continuation is preserved; IS/ISNULL keys remain searchable. Frozen pinned
controls: `candidate-lifecycle-public.test.mjs`, `cases/candidate-lifecycle-native.json`;
development capture `capture-candidate-lifecycle.py` (post-implementation,
pre-consuming-test). No public diagnostic API or runtime oracle dependency.


### Revision 2026-10-04 — bounded numeric seek / LEFT continuation supersession

This revision supersedes **only** the earlier absent NUMERIC-copy claims in the
row-width checkpoints (including checkpoint34 and audit2026-10-04d), not their
historical reds or pending e/root qualifications. See
[causal repair/evidence note](research/seek-rowid-numeric-repair.md).
Commits `4fa06e2441b978406cbd285b34ff4e6a25868ebc` and
`5713c0f68bfb733ecb4e527fc74841394066ceac` correct these bounded owners:

- Pinned `vdbe.c:5495 OP_SeekRowid` copies the input Mem and applies NUMERIC
  affinity before integer gating/cursor access, preserving original binding
  payload/type. `vdbemem.c:sqlite3VdbeIntegerAffinity` uses the **exact bigint
  slot for IntReal**, including both signed64 endpoints and values above2^53.
  Existing REAL instead uses double-to-integer roundtrip equality and **strict
  signed64 endpoint exclusion**. This is distinct from the narrower
  `sqlite3RealSameAsInt` text-numericization rule; it is not a text shortcut.
- `where.c:sqlite3WhereEnd` distinguishes continuation, advancement and LEFT
  synthetic-null re-entry. TS `nextAt` enters LEFT null-pass / RIGHT Return
  guards; `advanceAt` identifies the actual singleton Goto or movement opcode.
  Singleton target patching now uses advanceAt, not an offset into nextAt.
  ON matching remains before null extension; WHERE remains after positioning.
- `where.c:wherePathSatisfiesOrderBy` /5273 WHERE_ONEROW supports only the bounded
  represented proof: **FINAL ordered producer after exact rowid-equality
  singleton predecessors**. Statistical nOut0 is not uniqueness. Outer ordering
  before later fanout is NEVER promoted by this proof. Other joined paths retain
  zero global order; this is not general multi-source ordering acceptance.

Fresh strict singular-public ordinary execution on the disclosed peer-dirty
runtime completed **69/69** cases across UTF8/UTF16LE/UTF16BE, exact rows/errors
and every exact/min/max private bound, with no prepare waiver or increased limit.
Earlier63/69 with six LEFT limits and66/69 with three sorter minima remain
historical failures, causally repaired rather than waived. Primitive IntReal
coverage is not a claim of a public IntReal producer. No public API change.
Runtime commit/tree and fresh five-fix delivery evidence are in current executor
status for [[card:card-s-b-a-a-b-a-a-a]]. Native fixtures/pin evidence are not TS
execution credit. Shared dirty work is NOT a clean export; e aggregate1962/1490/472,
cFAILED, joined-WR and broader historical reds remain unwaived/separately owned.
