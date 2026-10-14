# SQLite source map

### Read-only metadata PRAGMA (bounded consumers)

Pinned `parse.y:1714–1721` → `parse.ts:productionAction` PRAGMA semantic ownership → `index.ts:prepare` admission → `pragma.ts:compilePragma` → normal `VdbeStatement`. `pragma.c:PragTyp_TABLE_INFO/INDEX_LIST/INDEX_INFO/FOREIGN_KEY_LIST/DATABASE_LIST` and `vdbeaux.c:sqlite3VdbeMultiLoad` map to catalog traversal and literal register loads/ResultRow. `build.c:sqlite3AddColumn` standard types, `sqlite3AddDefaultValue` and `malloc.c:sqlite3DbSpanDup` map to stored-DDL type/default-span producers. Generated `pragma.h`/`mkpragmatab.tcl` supplies result column names. `parse.y:plus_num` → numeric PRAGMA argument terminal; `build.c:sqlite3CreateIndex` linked order/azColl spelling and `convertToWithoutRowidTable` layout → schema Index/layout (folded lookup plus retained metadata name) → index metadata; [argument/collation regression evidence](research/card-e-n-pragma-red/argument-collation-repair.md); `sqlite3CreateForeignKey` pNextFrom prepending → reversed schema declaration-order FK consumption. `pragmaLocate`/`mkpragmatab.tcl` → pinned `pragma-names.ts` distinguishes unknown no-op from known untranslated forms; explicit-temp initialization → connection temp-residency state. Btree/Pager memory filename → empty snapshot filename (not acquisition URL). `db-public.mjs` and `memory-db.py` cover Db rows/residency and no-ops. `index-public.mjs` compares index/FK paths with independent pinned `index-native.json`. [Native/public repair evidence and remaining forms](research/card-e-n-pragma-red/REPAIR.md).

`build.c:viewGetColumnNames` → `resolve.ts:resolvedViewTable` (same stored-view source owner), `select.c:sqlite3ColumnsFromExprList/sqlite3SubqueryColumnTypes` → transient naming and metadata NONE-affinity retention → common TABLE_INFO emission. [VIEW evidence](research/card-e-n-pragma-red/VIEW.md) covers prepare-time derivation, not row inference; the bounded table-valued consumers share this same producer.

`pragma.c:pragmaVtabConnect/BestIndex/Filter/Next/Column`, `whereexpr.c:sqlite3WhereTabFuncArgs`, `wherecode.c` ready-term and VFilter/VNext lowering → `pragma.ts:metadataTableSource/tableMetadataRows/metadataColumnDeclaredType`, `vdbe.ts` bounded private-source admission, MetadataFilter/Next state and shared result/cleanup. Info/xinfo only; logical/generated/view metadata is not a parallel evaluator. Hidden EQ constraints and positional args bind through ordinary expressions; ready outer INNER WHERE/ON prerequisites precede Filter, LEFT matching/null completion remains distinct. [TVF evidence](research/card-e-n-pragma-red/TVF.md), native54, binding12/39 replay, ON5, limits12 and [independent assessment](research/card-e-n-pragma-red/independent-tvf-assessment.md). Metadata rowid and generic virtual-table/planner breadth remain unsupported. The mixed-source column binder rejects qualified metadata identity before JSON identity-register admission; physical and JSON identity remain separate. [R1 native/rejection evidence](research/card-e-n-pragma-red/TVF.md#r1-identity-boundary-repair).


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
resumable stack is not a current platform rationale. Expression InSet now requires
packed BLOBKEY storage: `parse.y:seltablist` immediate `LP select RP` child →
`parse.ts:sourceList` derived SrcItem; ON/function-argument SELECTs remain expression
children, not independent metadata producers. Parser production guard and packed
all-encoding ON scalar/vector/EXISTS controls map this seam; [R1 evidence](research/card-m-packed-independent-review.md#r1-repair--srcitem-production-ownership).
`select.c:SRT_Set` → shared MakeRecord/IdxInsert destination;
`vdbe.c:OP_MakeRecord` affinity-before-size → `Mem.recordConversionBytes`
branch prediction + shared MakeRecord conditional scratch admission/finally;
[owner matrix/tests/evidence](research/card-m-conditional-conversion-admission.md)
maps no-op versus actual conversion and preserves packed admission/overlap.
`vdbe.c:OP_IdxInsert` → PrivateKeyVmCursor.insert/private BLOBKEY packed snapshot;
VDBE private control supplies synchronous bounded snapshot checks before borrowed
input copying, followed by asynchronous insertion checks. Public all-encoding
large Once/correlated reset schedules in `packed-public-resource.test.mjs` and
[repair evidence](research/card-m-packed-independent-review.md#large-packed-snapshot-control-repair)
cover the admitted-large-input caller contract;
`expr.c:sqlite3ExprCodeIN` steps 3/6 → exact seek then NULL fallback (scalar first
row only, vector traversal). `btree.c:First/Next/payload` → private cursor traversal
and callback-scoped payload. No borrowed membership evaluator remains; unrelatedDISTINCT/set-operator cursors retain their own contracts. [Packed public evidence](research/card-m-packed-membership.md)
and [source-control tests](../test/conformance/row-vector/structure.test.mjs) map
these branches, not general storage/complexity parity.

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
`json_pretty` accepted bounded delivery `f1eb053` is retained in this baseline; built-in JSON is not a blanket gap.
Exact function tranche runs/IDs remain in existing oracle/conformance research,
not duplicated here.

## Current schema, vector and packed-consumer mapping

| Pinned producer/control | Committed TS consumer | Evidence |
|---|---|---|
| `build.c:sqlite3EndTable`, `resolve.c:sqlite3ResolveSelfReference` | `schema.ts` immutable generated/STRICT publication; `parse.ts` retained DDL | [generated](research/card-t-c-generated-consumers/README.md), [STRICT](research/card-e-h-strict/README.md) |
| `expr.c:sqlite3ExprCodeGetColumn`, `vdbe.c` TypeCheck | `vdbe.ts` logical/generated binding, BUSY/finally, NullRow and single-column type check | [generated](research/card-t-c-generated-consumers/README.md), [boundaries](research/card-e-h-strict/boundaries-README.md) |
| `expr.c:sqlite3ExprVectorSize`, `sqlite3ExprCodeIN` | `vdbe.ts` field-width/vector IN destinations; `resolve.ts` linked source | [vector review](research/card-i-c-row-vector-review.md) |
| `wherecode.c:sqlite3WhereCodeOneLoopStart`, `where.c:sqlite3WhereEnd` | `where-plan.ts`, shared ordinary/INNER/scalar/represented LEFT WR PK dedup and continuation | [source comparison](research/card-s-i/source-owner-comparison.md) |
| `window.c` bounded frame comparison/step/return/inverse control | `window-rewrite.ts`, `vdbe.ts`, `mem.ts`, packed private owners | [owner correction](research/card-s-i/window-owner-correction.md) |
| `btree.c:sqlite3BtreeInsert`, `balance` | `btree.ts`, `private-state.ts`, `record.ts`; selected packed private VM consumers | [acceptance matrix](research/card-s-i/acceptance-matrix.md) |
| `where.c` selectivity, `vdbeapi.c:sqlite3_bind` expiry | `schema.ts` sample loading, `where-plan.ts` bounded consumers, `index.ts` reprepare | [reprepare](research/card-h-b-reprepare/README.md) |

Current [guide](TRANSLATION.md) and [API](api.md) own admission. The
[reconciliation archive](research/card-u-reconciliation/README.md) preserves
superseded map additions and exact run attribution without making them current
contract authority.

### Mixed physical/JSON input and metadata

`where.c:sqlite3WhereEnd` ON-match/null-extension → mixed
`vdbe.ts:compileTableSelectProducer`; `select.c` aggregate production → existing
`compileAggregateSelect` input-register/AggInfo seam with SELECT-private
`SchemaGraph.withTransientTable`. `json.c:jsonBlobChangePayloadSize/jsonEachColumn`
→ `json.ts:openJsonTableCursor` offsets; `select.c:columnType` versus column names
→ `jsonResultMetadata` COLLATE naming without origins.
`json-physical-left-red.test.mjs` and `json-mixed-integration.test.mjs` supply
public typed, metadata/error/reset evidence across three encodings;
[repair provenance](research/card-r-d-physical-json-repair.md),
[verification bounds](research/card-r-e-mixed-json-verify.md).
No host registration or generalized virtual-table planner credit.

### Review27 mixed row identity and delivery state

Mixed physical/JSON AggInfo input now retains separate physical OP_Rowid and
JSON per-scan identity slots, including grouped sorter/saved rows. JSON identity
resets to zero on rewind and increments on successful Next; unmatched LEFT
extension is SQL NULL. rowid/_rowid_/oid are not JSON id/key/offset aliases.
Direct implicit identity metadata follows select.c:columnType: INTEGER rowid
origins, or the physical IPK declared name/type. Ordinary recursive aggregate
input keeps its original layout, without the mixed rowIdentities flag.
Pinned json.c:jsonEachCursorReset/Next/Rowid, expr.c negative-column lowering and
select.c accumulator/metadata consumers map to vdbe.ts identity registers and
AggInfo source/input/group capture. All-encoding IPK/non-IPK native/public
companions are in json-mixed-rowid-integration.test.mjs;
[correction evidence](research/card-r-e-review27-correction.md).
Accepted pretty `f1eb053` bounded implementation is retained from MAIN; no
pretty source change or breadth claim is part of this mixed correction.
