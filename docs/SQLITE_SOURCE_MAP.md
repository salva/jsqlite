

## Shared scalar metadata admission

`expr.c:sqlite3CodeSubselect` SRT_Mem and `pragma.c:pragmaVtabFilter` map to
shared scalar lowering and the finite metadata producer respectively. Their
correlated scalar aggregate-expression composition lacks Filter production in
`vdbe.ts:compileInnerTableSelect`; its `planWhere` call converts only
`WherePlanningUnsupportedError` to public temporary unsupported. Existing
singleton conversion and module/AggInfo ownership are unchanged. Regression:
`metadata-scalar-error.test.mjs`. [Evidence and boundary](research/metadata-destination-correction.md#shared-scalar-planner-admission-boundary).
## Metadata identity admission boundary

`resolve.c:lookupName` selects real columns before implicit rowid candidates;
`pragma.c:pragmaVtabCursorClear/pragmaVtabNext/pragmaVtabRowid` owns the native
cursor counter. `resolve.ts:direct` rejects a selected metadata-module identity
before AggInfo or correlated consumers can bind it; singleton
`vdbe.ts:bindColumns` retains the same temporary boundary. Physical and JSON
identity remain separate. Tests: `metadata-identity-boundary.test.mjs` and
`tvf-group.test.mjs`. [Diagnosis and evidence](research/metadata-destination-correction.md).

## Mixed module predicate readiness

The mixed physical/module producer resolves WHERE/ON against both declarations before partitioning bound dependencies. INNER/CROSS physical-ready conjuncts execute once before module arguments/Filter and are removed from inner residual evaluation. Module-dependent terms retain inner-row positioning; LEFT match/null-extension ordering is unchanged. Child Select prerequisites follow linked source identities through nested/compound children; shared Mem/Set/Exists lowering retains positioned parent cursor/register locations. `resolve.c:resolveSelectStep` pOuterNC/pPrior and `select.c:multiSelect` TK_ALL map to `compileScalarSelect` and its WHERE-arm `compileCteUnionAll` consumer retaining linked compound-arm plans, positioned caller binding and one enclosing prepared LIMIT/OFFSET owner; arm consumers preserve Exists runtime EList elision after prepare validation and do not re-resolve against an empty outer scope or decrement the shared counter twice. Physical-ready children run in the later pass at that same ready level, while module-dependent children remain after Filter (`whereexpr.c:exprSelectUsage`). Regression: `json-child-readiness.test.mjs`; correction evidence: [[card:card-m-f-k]] status. This bounded readiness translation follows `resolve.c:lookupName`, `select.c:sqlite3SelectPrep` and `wherecode.c:sqlite3WhereCodeOneLoopStart` prereqAll/notReady and TERM_CODED ownership, not a general virtual-table planner substitution. Tests: `json-mixed-readiness.test.mjs`, `json-mixed-resolution-controls.test.mjs`, `json-mixed-resolution.test.mjs`. Revision-bound author evidence and remaining acceptance obligations: [[card:card-m-f-k]] accepted status615/622.

## Linked JSON module enrollment and selected execution

## Joined destination and row identity closure

`select.c:selectInnerLoop` SRT_Exists / `multiSelect` TK_ALL → `vdbe.ts:resolvedScalarSubqueryEmitter` no-source/compound branches: prepare validation, projection suppression, WHERE/OFFSET/shared LIMIT/Once/source-order presence exit. All-encoding/reset/error controls: `expression-subquery-composition.test.mjs`. `select.c:columnType/sqlite3GenerateColumnNames` negative column/IPK and COLLATE branches → `jsonResultMetadata` and mixed producer independent module-rowid caller; tests `json-mixed-ordered.test.mjs`, `json-table-functions.test.mjs`. [Scoped integration evidence](research/card-m-f-k-production-integration.md#reviewer-repair-integration). JSON planner modules remain production dependencies; experiment copies are excluded from this delivery.


- `select.c:selectExpander/cannotBeFunction`, `json.c:jsonEachConnect` → `resolve.ts:expandAndResolveSelect`, `json-table-plan.ts:jsonTableDeclaration`: genuine module declaration, catalog precedence, callable rejection and hidden-column metadata. Tests: `json-module-enrollment`, `hidden-source-expansion`.
- `where.c:whereLoopAddVirtualOne/whereLoopAddVirtual/whereLoopInsert`, `json.c:jsonEachBestIndex` → `where-json-loops.ts`, `where-plan.ts`: linked hidden constraints, usable-mask retries, shared dominance/budget insertion and selected argv. Tests: `json-virtual-candidates`, `json-table-plan`. IN/LIMIT virtual terms/orderByConsumed remain unmapped here.
- `expr.c:sqlite3CodeSubselect`, `select.c:selectInnerLoop`, `wherecode.c:sqlite3WhereCodeOneLoopStart` → `vdbe.ts:compileWideSubquery/compileInnerTableSelect`: linked outer storage/readiness, conditional Once, normalized LIMIT, shared Mem/Set/Exists, register payload/rowid, OFFSET and common module cleanup. Mixed AggInfo captures selected rows; retained physical input materializes into an actual ephemeral cursor before reading. Tests: `correlated-json-exists`, `scalar-linked-context`, `json-aggregate-paths`.

Current bounded evidence and remaining validation gaps: [integration evidence](research/card-m-f-k-production-integration.md), [[card:card-m-f-k]] status. This mapping is not a general virtual-table compatibility claim.


## Aggregate immutable-view substitution

`select.c:substExpr/substSelect` column-owner substitution →
`vdbe.ts:compileAggregateSelect` immutable-view branch re-resolves the substituted
SELECT via `resolveTransientArm`, retaining the shared VM/destination but replacing
obsolete expression carriers. Public nested-view/aggregate destination and
source-control coverage: `test/conformance/select-scalar-child.test.mjs`.
[Bounded working-tree evidence](research/card-m-f-k-production-integration.md).


# SQLite source map

## Ordinary CTE + mixed JSON source identity

`select.c:resolveFromTermToCte` SrcItem Table/subquery/CteUse and tag-select-0488 → `cte.ts:lowerOrdinaryCtes`, `vdbe.ts:transientSourceTable`, mixed `compileTableSelectProducer` and aggregate module adapter. Tests: `cte-module-owner.test.mjs` (all encodings; metadata, two executions, aliases/LIMIT, empty/NULL LEFT, changed bindings/reset, derived/recursive temporary admission and CTE rowid rejection); `cte-module-resources.test.mjs` covers combined retained budgets and lifecycle. [Bounded adaptation and native evidence](research/cte-module-owner/README.md).

## Retained GROUP scalar destinations

| Pinned upstream owner | Current TS owner | Tests/evidence |
| --- | --- | --- |
| `select.c:sqlite3Select` SF_Aggregate dispatch; `selectInnerLoop` SRT_Coroutine/Mem/Exists | `vdbe.ts` retained child aggregate dispatch and `compileDerivedProducer`, scalar subquery destination composition; EXISTS presence-only consumer after transient resolution | `retained-no-from-group.test.mjs`, `retained-group-native-public.test.mjs` |
| `resolve.c:resolveAlias`, aggregate argument/FILTER/ORDER ownership | `resolve.ts:resolvedExpressionCarrier` canonical identity plus original `sourceReduction`; aggregate modifier linked binding in `vdbe.ts` | alias FILTER/ordered group_concat/parenthesized max in no-FROM GROUP tests |
| GROUP sort/accumulator/HAVING and output LIMIT branches | shared aggregate compiler, existing private sorter and statement lifecycle (not independent evaluator) | `retained-group-resources.test.mjs`; [bounded native/control/resource accounting](research/retained-group-delivery.md) |



### Read-only metadata PRAGMA (bounded consumers)

`pragma.c:pragmaVtabConnect/pragmaVtabBestIndex/pragmaVtabFilter/pragmaVtabNext` → `pragma.ts:METADATA_MODULE_COLUMNS/metadataHiddenColumns/metadataSource`, `resolve.ts:moduleSourceSchema` → VDBE MetadataFilter/Next and canonical mixed projection. Bounded SELECT consumers admit `pragma_database_list`, `pragma_table_info`, `pragma_table_xinfo`, `pragma_index_list`, `pragma_index_info`, `pragma_index_xinfo` and `pragma_foreign_key_list` through genuine module declarations and shared MetadataFilter/Next. `pragma_database_list` has no hidden columns and accepts zero arguments; the other six declare hidden `arg`/`schema`. Resident main/temp filenames are empty strings, never Fetch URLs. Canonical visible-star expansion precedes mixed-source ORDER ordinals/aliases and result metadata. This is finite module admission, not general virtual-table planner parity; module reverse/RIGHT/FULL/NATURAL/USING shapes remain unadmitted. The TS producer shares catalog traversal with direct PRAGMA rather than nesting public SQL execution; hidden-field width follows upstream Result0 versus Result1/SchemaOpt flags. [Source comparison and retained public regressions](research/card-m-f-k-production-integration.md#metadata-family-restoration); finite independent acceptance: [[card:card-m-f-l]] status16.

Pinned `parse.y:1714–1721` → `parse.ts:productionAction` PRAGMA semantic ownership → `index.ts:prepare` admission → `pragma.ts:compilePragma` → normal `VdbeStatement`. `pragma.c:PragTyp_TABLE_INFO/INDEX_LIST/INDEX_INFO/FOREIGN_KEY_LIST/DATABASE_LIST` and `vdbeaux.c:sqlite3VdbeMultiLoad` map to catalog traversal and literal register loads/ResultRow. `build.c:sqlite3AddColumn` standard types, `sqlite3AddDefaultValue` and `malloc.c:sqlite3DbSpanDup` map to stored-DDL type/default-span producers. Generated `pragma.h`/`mkpragmatab.tcl` supplies result column names. `parse.y:plus_num` → numeric PRAGMA argument terminal; `build.c:sqlite3CreateIndex` linked order/azColl spelling and `convertToWithoutRowidTable` layout → schema Index/layout (folded lookup plus retained metadata name) → index metadata; [argument/collation regression evidence](research/card-e-n-pragma-red/argument-collation-repair.md); `sqlite3CreateForeignKey` pNextFrom prepending → reversed schema declaration-order FK consumption. `pragmaLocate`/`mkpragmatab.tcl` → pinned `pragma-names.ts` distinguishes unknown no-op from known untranslated forms; explicit-temp initialization → connection temp-residency state. Btree/Pager memory filename → empty snapshot filename (not acquisition URL). `db-public.mjs` and `memory-db.py` cover Db rows/residency and no-ops. `index-public.mjs` compares index/FK paths with independent pinned `index-native.json`. [Native/public repair evidence and remaining forms](research/card-e-n-pragma-red/REPAIR.md).

`build.c:viewGetColumnNames` → `resolve.ts:resolvedViewTable` (same stored-view source owner), `select.c:sqlite3ColumnsFromExprList/sqlite3SubqueryColumnTypes` → transient naming and metadata NONE-affinity retention → common TABLE_INFO emission. [VIEW evidence](research/card-e-n-pragma-red/VIEW.md) covers prepare-time derivation, not row inference; the bounded table-valued consumers share this same producer.

`pragma.c:pragmaVtabConnect/BestIndex/Filter/Next/Column`, `whereexpr.c:sqlite3WhereTabFuncArgs`, `wherecode.c` ready-term and VFilter/VNext lowering → `pragma.ts:metadataSource/metadataRows` shared catalog producer (table/view branches use `metadataTableSource/tableMetadataRows`), `METADATA_MODULE_COLUMNS/metadataHiddenColumns/metadataColumnDeclaredType`, `pragma.ts:setMetadataDatabases`/`index.ts:prepare` connection descriptor/residency binding, and `vdbe.ts` bounded private-source admission, MetadataFilter/Next state and shared result/cleanup. Seven bounded families: `pragma_table_info`, `pragma_table_xinfo`, `pragma_index_list`, `pragma_index_info`, `pragma_index_xinfo`, `pragma_foreign_key_list`, and sole-source `pragma_database_list`; logical/generated/view metadata is not a parallel evaluator. Result1+SchemaOpt families have hidden arg/schema slots: hidden EQ constraints and positional args bind through ordinary expressions; Result0 database_list has zero hidden slots/max arity zero and emits resident main/explicit-empty-temp descriptors with empty-text memory filenames. Ready outer INNER WHERE/ON prerequisites precede Filter, LEFT matching/null completion remains distinct; `select.c:sqlite3SelectPrep/selectExpander` expand before `resolve.c:resolveOrderGroupBy` → canonical mixed-source visible-result descriptors exclude hidden slots and feed ORDER ordinal/alias resolution, projection, metadata and destination width. [Expand-before-resolve repair evidence](research/card-e-n-pragma-red/TVF-STAR-ORDER.md). [Index/FK producer evidence](research/card-e-n-pragma-red/TVF-INDEX-FK.md) and [Result0/residency/star evidence](research/card-e-n-pragma-red/TVF-DB.md) extend the [initial table/view TVF evidence](research/card-e-n-pragma-red/TVF.md) and [independent assessment](research/card-e-n-pragma-red/independent-tvf-assessment.md). Explicit temp remains empty; attached schemas, database_list joins, metadata rowid and generic virtual-table/planner breadth remain unsupported. The mixed-source column binder rejects qualified metadata identity before JSON identity-register admission; physical and JSON identity remain separate. [R1 native/rejection evidence](research/card-e-n-pragma-red/TVF.md#r1-identity-boundary-repair).

`pragma.c:pragmaVtabConnect/Filter/Column/Next` + `select.c:sqlite3SelectPrep/AggInfo` → `vdbe.ts:compileAggregateSelect` retained metadata module NameContext and payload input → shared MetadataFilter/Next producer and grouped sorter. The source descriptor has no physical scan; hidden arg/schema preserve empty declared type. The scan selects hidden EQ inputs before Filter and evaluates residual WHERE once before aggregate input; the aggregate consumer does not repeat that predicate. [Bounded GROUP evidence](research/card-e-n-pragma-red/TVF-GROUP.md).


Current upstream → TypeScript → test/evidence navigation. The source root is
`reference/sqlite/sqlite-src-3530400/`, pinned by
[manifest](../reference/sqlite/manifest.json). [Translation guide](TRANSLATION.md)
owns current design; [API](api.md) owns the public contract. This map does not
claim complete upstream coverage or reproduce execution inventories.

## Ordinary materialized producer cursors

- build.c sqlite3SrcListAssignCursors / Parse.nTab; select.c tag-select-0488,
  selectInnerLoop SRT_EphemTab → vdbe.ts compileCteDerivedSources and fallback:
  shared-builder physical input cursor mapping, separate destination, fill/return
  and OpenDup reuse. compileRepeatedImmutableView reserves resolved input slots
  before allocating owner/dup, preserving the same Parse.nTab frontier invariant.
  Tests: select-repeated-view-parent.test.mjs (native companion),
  select-repeated-view-parent-builder.test.mjs, from-subquery-routes.test.mjs,
  select-cte-order-owner.test.mjs,
  select-cte-fallback-destination-owner.test.mjs (all encodings, bind/reset).
  expr.c sqlite3ExprAnalyzeAggregates (iDistinct = Parse.nTab++) →
  compileScalarSelect derived aggregate-expression input cursorFor mapping before
  DISTINCT/order allocation; select-scalar-child.test.mjs and
  select-scalar-cursor-owner.test.mjs (allocation invariant/all-encoding public resets).
  [Evidence and bounded residuals](research/limited-cte-cursor-ownership.md).

## Retained derived aggregate input

- select.c flatten restriction9, SRT_Coroutine and AggInfo input; where.c
  wherePathMatchSubqueryOB → vdbe.ts compileAggregateSelect input/adjacentGroups,
  resolvedScalarSubqueryEmitter linked outer binding and shared child cursors.
  Installed input/NameContext prevents late flattening; scalar compound merge
  receives the same SelectDest (select.c selectInnerLoop SRT_Coroutine).
  Regression coverage: cte-execution.test.mjs and recursive-cte-aggregate.test.mjs;
  [handoff evidence](research/cte-aggregate-handoff-repair.md).
- build.c sqlite3FinishCoding / vdbeaux.c sqlite3VdbeMakeReady Parse.nVar →
  select-compiler.ts aggregate publication of shared parameters.
- Public tests: derived-order-limit-aggregate.test.mjs (independent pinned producer
  derived-order-limit-aggregate-native.py), derived-aggregate-resources.test.mjs.
  [Bounded evidence and accounting](research/retained-aggregate-delivery.md).

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
| `select.c:multiSelect`, `multiSelectByMerge`, `multiSelectCollSeq` | `resolveCompoundMergeOrder` / `emitScalarCompoundMerge` and compound/table/CTE/derived producers in [vdbe.ts](../src/internal/vdbe.ts); shared destinations | [compound collation](../test/conformance/compound-collation.test.mjs), [UNION ALL](../test/conformance/compound-union-all.test.mjs), [VALUES unsupported](../test/conformance/compound-values-unsupported.test.mjs); [[card:card-j]], [[card:card-t]] |
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
and callback-scoped payload. `btree.c:IndexMoveto` overflow branch and
`accessPayload/copyPayload/PagerGet/unref` map to `private-blobkey-pages.ts`
overflow loops and module-private `copyBorrowedBytes`: same bounded page chain,
checkpoint, copy and cleanup, with view liveness checked immediately before a
native typed-array bulk copy. [Capability boundary and tests](research/card-s-i/private-blobkey-copy-capability.md).
No borrowed membership evaluator remains; unrelated DISTINCT/set-operator cursors retain their own contracts. [Packed public evidence](research/card-m-packed-membership.md)
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
  duplicate/queue order remain separate. `select.c:sqlite3Select` retained
  materialization → `compileRecursiveJoinedSelect` → ephemeral destination →
  shared `compileInnerTableSelect`/`compileAggregateSelect`, with retained cursor
  handles skipped by physical OpenRead. VDBE Rewind/Next/Column/Rowid dispatch
  ephemeral handles through the existing private cursor primitive. Tests:
  `recursive-cte-join.test.mjs` and `cte-admission.test.mjs` (pre-emission
  specialization decline preserves derived/multiple recursive dispatch); [native/public evidence and boundaries](research/recursive-join/README.md).
  Evidence [[card:card-n]], [[card:card-n-c]], [[card:card-t-d]].
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


### Additional bounded index/FK table-valued PRAGMA consumers

`pragma_index_list`, `pragma_index_info`, `pragma_index_xinfo` and `pragma_foreign_key_list` share direct-PRAGMA catalog traversal and existing statement-owned metadata Filter/Next/Column state with table_info/xinfo. Hidden arg/schema retain empty declared type versus NULL visible type, normal runtime binding/reset and physical-left correlated schema joins with explicit projections. Qualified metadata identity remains temporarily unsupported; JSON/physical rowid ownership is separate. Mixed metadata stars expand visible fields in source order, excluding hidden arg/schema. Sole-source `pragma_database_list` has zero hidden slots (Result0), max arity zero, and consumes resident main/explicit-empty-temp descriptors; filenames remain empty text by the immutable-memory API boundary. Joins involving database_list remain temporarily unsupported. This is not generic vtab admission. Native evidence and precise boundaries: [index/FK TVF evidence](research/card-e-n-pragma-red/TVF-INDEX-FK.md).


### Standard declared-type metadata

build.c sqlite3AddColumn1530–1586 / util.c sqlite3ColumnType104 / select.c columnTypeImpl → parse.ts declaredTypeSource → schema columns → resolver descriptors. Standard/custom/null metadata boundaries: declared-type-standard-native.test.mjs (allenc/reset/alias/generated/STRICT/view/catalog) and original multisource test16:1. [Evidence and separate generated-value gap](research/card-k-c-declared-type/README.md).

## Generated REAL opcode mapping

Pinned expr.c:sqlite3ExprCodeGeneratedColumn/GetColumnOfTable → generated lowering → vdbe.c:OP_Affinity/OP_TypeCheck → vdbe.ts:opcodeRealAffinity → existing Mem IntReal/double. Native/public generated-real-value-native.test.mjs exercises six-byte boundaries, STRICT/STORED/VIRTUAL and represented callers.

[Isolated candidate evidence and remaining boundaries](research/card-t-generated-real/README.md). Candidate pending independent review; not MAIN incorporation.

- `window.c:selectWindowRewriteExprCb` generated projection / `select.c:columnTypeImpl`
  → `resolve.ts:resolvedProducerProjection` and recursive grouped lowering in
  `vdbe.ts`; lifted terminals retain lexical bindings, generated result ordinals
  own descriptors, ephemeral recursive sources have no physical origin.
  [Eight-case pinned typed/metadata parity](research/recursive-group-window/README.md).

## JSON grouped identity metadata

`select.c:selectInnerLoop/codeDistinct/computeLimitRegisters/generateSortTail` →
`vdbe.ts:compileTableSelectProducer` mixed JSON projection, Found/IdxInsert,
KeyInfo/Sorter and SelectDest; `json-mixed-ordered.test.mjs` four-module,
three-encoding typed row/metadata/reset matrix.
[Evidence](research/card-r-d-ordered-consumer.md).

`wherecode.c:sqlite3WhereCodeOneLoopStart` prerequisite and outer-join deferral
branches, plus `resolve.c:lookupName` and `whereexpr.c` source usage → mixed
`compileTableSelectProducer` complete-scope binding before source-identity AND-term lowering:
INNER/CROSS terms precede JSON/metadata Filter; inner-dependent terms remain
residual. LEFT retains ON-match/WHERE/null-extension ownership. Public typed
rows, full descriptors, step-error phase and repeated execution/reset controls:
`json-mixed-readiness.test.mjs`, [native/source evidence](research/card-r-d-readiness.md).
Visible/hidden name-collision prepare errors and qualified controls:
`json-mixed-resolution*.test.mjs`, [resolution evidence](research/card-r-d-resolution.md).

`json.c:jsonEachConnect` schema-owned virtual declaration and
`select.c:columnTypeImpl` negative TK_COLUMN/iPKey/schema origin branches →
`vdbe.ts:compileAggregateSelect` SELECT-private TableNode provenance
binding → `resolve.ts:descriptor` original-source metadata → existing aggregate
saved-phase result descriptor. Dedicated row identities remain independent of
JSON parse offsets/id. [Pinned capture and public regression](research/card-r-d-grouped-rowid-metadata.md)
cover duplicate aliases, computed/physical controls, all4 modules/all encodings
and NULL extension/reset; no generic module or planner parity claim.

### Linked NOTNULL range owner

Pinned `whereexpr.c:1331–1360` turns a non-rowid column NOTNULL test outside
outer-ON into a linked virtual `x > NULL` term (`TERM_VNULL`), with zero RHS
prerequisites and the parent's dependency mask. `where-plan.ts:analyzeClause`
retains that parent/child relationship as `virtualNull`; it is not an ordinary
SQL NULL comparison. `wherecode.c:1997/2099` exempts this bound from NULL guards;
the ordinary, joined and recursive-OR range consumers in `vdbe.ts` use the same
flag for start/end guard suppression. `wherecode.c:aStartOp` maps to
`where-prefix.ts:emitPrefixSeek`: zero-key Rewind/Last, not a zero-field seek;
when `nConstraint == nSkip`, already-positioned prefix columns fall through
without a redundant suffix seek. `where.c:sqlite3WhereEnd` maps to shared
`finishPrefixLoop` restart/exit patching.

Current positional stat1 skipscan ownership is `where-plan.ts:btreeLoops` →
shared `where-prefix.ts` → the existing ordinary/joined/recursive-OR consumers,
not an eager distinct-prefix scan. Native/typed selection and boundary evidence,
including NOTNULL direction/end and joined no-start continuation, is retained in
[owner evidence](research/card-s-g/IMPLEMENTATION.md#notnull-linked-range-repair-continuation).
[Generated-fixture closure](research/card-w-current-integration-outcome.md) and
`test/storage/skipscan-prefix-seek.test.mjs`, `skipscan-seekscan-state.test.mjs`,
`test/conformance/skipscan-position-owner.test.mjs` and
`skipscan-docs.test.mjs` map current primitive/control/document contracts.
Historical disabled-caller checkpoints in the owner evidence are not current
production exclusions. These bounded mappings do not establish arbitrary
optimizer or STAT4 sample parity.

## Bounded STAT4 sample consumers

| Pinned upstream owner | Current TS owner | Tests/evidence |
| --- | --- | --- |
| `analyze.c:loadStat4`, sample counts/record acquisition; `vdbemem.c:sqlite3Stat4ProbeSetValue` and ProbeFree | `schema.ts:loadStat4Samples` acquires encoded records; `stat4-probe.ts:Stat4Probe` shares Mem affinity/comparison and restores active prefixes/all-slot cleanup | `stat4-loader-primitive.test.mjs`, `stat4-probe-primitive.test.mjs`; [mapped review](research/card-s-h/d-diagnosis/MAPPED_REVIEW.md) |
| `where.c:whereKeyStats` (1718), equality/IN/range estimators | `stat4-estimate.ts:whereKeyStats` virtual-prefix search; `where-plan.ts:sampleEquality`, `sampleRange` consume contiguous prefix/literal equality, IS/NULL, literal-list IN and scalar range/DESC estimates | `stat4-keystats.test.mjs`, `docs/research/card-s-h/public-first.test.mjs`; [integrated evidence](research/card-s-h/main-integration/) |
| `where.c:sqlite3WhereBegin` second pass (7086–7106), HIGHTRUTH/HEURTRUTH | `where-plan.ts:WhereTruthState`, `buildAll` reconstruct whole loop groups with restored construction budget and progress checks; probe callers restore prefix state on failure | `docs/research/card-s-h/caller-first.test.mjs`, `stat4-schema-lifecycle.test.mjs`; same integrated evidence |

These are bounded delivered consumers, not independent histograms or arbitrary native plan/cost parity. Wider vector/function/subquery probes and general STAT4 skipscan sample-range refinements remain gaps. Parameter-sensitive reprepare is separately mapped in the current guide; this sample slice alone does not certify general reprepare parity.

## Right-nested correlated membership residual

`expr.c:sqlite3CodeRhsOfIN/sqlite3ExprCodeIN` → `vdbe.ts:compileWideSubquery` linked joined binding, correlated no-Once SRT_Set and packed probe; RIGHT downstream readiness remains with joined continuation. Exact original positives and adjacent atomic ordered-compound gate: `test/conformance/right-nested.test.mjs`. [Native-first typed three-encoding and affected control/lifecycle evidence](research/right-nested-in/README.md). No runtime admission change or general nested-join completeness claimed.

Ordered filtered/projected single-output ordinary table arms use resolved scan destinations into the same-VM A/B merge; separate order/permutation and full-output duplicate keys, initial-empty A scheduling, balanced UNION/ALL and independent ALL capacities map to `select.c:multiSelectByMerge` and `resolve.c:resolveCompoundOrderBy`. [Current bounded source/test evidence](research/card-j-d-b-a-c-filtered/MERGE.md). Unordered table sets retain typed ephemeral production.

### Ordered mixed metadata consumers

`select.c:selectInnerLoop/pushOntoSorter/generateSortTail`, `resolve.c:resolveOrderGroupBy` and `wherecode.c` ready-term/LEFT completion map to the shared mixed-source `compileSelect` binder, candidate subroutine, SorterInsert and drain/destination in `vdbe.ts`. Metadata retains `MetadataFilter/Next` and the shared catalog producer, not JSON identity. Bounded admission, comparison and native-backed tests: [TVF-ORDER](research/card-e-n-pragma-red/TVF-ORDER.md). DISTINCT/LIMIT joins, metadata identity and database_list joins remain deferred.

### Metadata module declaration and resident caller restoration

`pragma.c:pragmaVtabConnect/pragmaVtabFilter` and registry Result0/Result1/SchemaOpt → `pragma.ts:METADATA_MODULE_COLUMNS/metadataHiddenColumns/metadataSource`; `resolve.ts:moduleSourceSchema` enrolls all seven genuine declarations. `index.ts:setMetadataDatabases` binds connection resident main/temp state. `select.c:sqlite3SelectPrep` visible expansion and ORDER resolution → mixed metadata canonical projection in `vdbe.ts`; MetadataFilter/Next appends only declared hidden payload. Tests: retained `card-e-n-pragma-red` tvf-five/db/order/star-order/bindings/admission/boundaries and `test/conformance/metadata-restoration.test.mjs`. [Bounded evidence and qualifications](research/card-m-f-k-production-integration.md#metadata-family-restoration).

### Metadata singleton destination correction

`select.c:selectInnerLoop` SelectDest → `vdbe.ts:compileTableSelectProducer`
singleton and mixed consume callbacks with register high-water synchronization,
including sorter drain. Filter/Next retains iteration ownership; shared AggInfo
retains aggregate semantics. Native typed/full-metadata/reset coverage:
`test/conformance/metadata-destination.test.mjs`; [evidence and boundaries](research/metadata-destination-correction.md).
