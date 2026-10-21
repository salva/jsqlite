# SQLite source map

### Selected scalar SELECT-IN LOOP

`expr.c:sqlite3CodeRhsOfIN` / `select.c:SRT_Set` →
`vdbe.ts:compileWideSubquery/compileSelectedInRhs`, `where-in-producer.ts` retain
linked producer, KeyInfo/affinity, Once and original parameter ownership.
`wherecode.c:codeINTerm` / `where.c:sqlite3WhereEnd` → `where-in-loop.ts`,
`vdbe.ts:emitInAdvance` and selected ordinary/join/OR callers position, copy,
skip NULL and unwind RHS slots inside-out. `vdbe.c` endpoint/movement/Column →
`private-in-dispatch.ts`, `private-key-vm.ts`; `btree.c` reverse traversal →
`private-blobkey-pages.ts`. Public chosen/executed native comparisons:
`selected-select-in-red.test.mjs`; `selected-select-in-null-prefix.test.mjs`
maps codeAllEqualityTerms slot-order/early-NULL bypass (ordinary and LEFT), with
native program ordering and zero-private admission witness.
`selected-select-in-affinity.test.mjs` maps codeAllEqualityTerms SELECT-IN BLOB
seek/end affinity ownership through ordinary, joined and recursive joined-OR
public execution; linked SRT_Set producer owns the coercion. Linked producer/VM and private cursor controls
accompany it. `vdbe.c:SeekHit/IfNoHope/NotFound` → physical `IndexCursor.seekHit`,
`prefixExists`, selected caller `IndexSeekHit/IndexIfNoHope` and equality-prefix
success publication; `selected-select-in-earlyout.test.mjs` and pinned capture
`capture-select-in-earlyout.py` cover non-SeekScan SELECT-IN prefix earlyout,
NULL/empty/LEFT and reset/repeat boundaries. Selected list-IN uses the same
cursor hit/prefix owner after its fused non-NULL value producer; the same capture
and test cover absent/present/NULL/empty/join/LEFT/reverse/two-slot and mixed slots.
[Evidence/boundaries](research/selected-select-in-delivery.md).

### SQL numeric semantic production

`tokenize.c:CC_DIGIT` QNUMBER dispatch, `parse.y:term ::= QNUMBER`,
`util.c:sqlite3DequoteNumber` → `parse.ts:terminal/productionAction` validate
separator neighbors and replace the reduction-owned semantic terminal, retaining
raw lexical bytes/spans. Both `stat4ValueFromExpr` and VDBE
`expressionFromReduction` consume the same normalized INTEGER/FLOAT leaf;
strings are not normalized. `sqlite3DequoteNumber` opcode update →
`parse.ts:canonicalNumericReduction` via Lemon's post-action publication callback:
only QNUMBER publishes its generated INTEGER/FLOAT rule/signature while LR goto
and trace retain the actual rule. `expr.c:sqlite3ExprCompare` numeric semantic
identity → existing `resolve.ts:expressionStructurallyEqual`, now consuming the
canonical production without equality relaxation. `test/parser/numeric-identity.test.mjs`
and mandatory `resolver.test.mjs` cover separator/plain identity, REAL/token/unary
nonidentity and raw spans/trace; pinned public prepare controls are retained in
`numeric-identity-native.jsonl`. [Evidence and bounded tests](research/card-s-h/NUMERIC_PRODUCTION.md).

### RIGHT/FULL WITHOUT ROWID identity

`where.c:7393–7425` per-level nKeyCol/KeyInfo match store and disabling
WHERE_IDX_ONLY → `vdbe.ts:compileInnerTableSelect` rightStates and primary-bound
RHS interior. `wherecode.c:2738–2802/sqlite3WhereRightJoinLoop` PK aiColumn reads,
ON-before-WHERE insertion and unmatched membership → shared `emitPrimaryKeyRead`,
`case5KeyInfo`, packed MakeRecord/IdxInsert/Found; drain receives the active
column binding and positions the interior primary reader before Gosub.
`emitCase5Identity` shares only PK reads, not the OR algorithm.
`without-rowid-right-full.test.mjs` compares pinned typed values/metadata in all
encodings across two resets, mixed rowid/WR, RTRIM duplicate-prefix and empty
sources; [evidence and boundaries](research/recursive-join/wr-right-full-evidence.md).

### JSON5 value-name and label admission

`json.c:aNanInfName/jsonTranslateTextToBlob` → `Parser.literal`: ordered,
case-insensitive name prefix plus source alphanumeric boundary produces FLOAT
`9e999` or actual NULL. Standard lowercase literals retain distinct failure/
fallthrough rules; signed numeric inf retains its different suffix admission.
`Parser.object` rejects successfully parsed non-TEXT labels before identifier
fallback; quoted labels remain strings. Complete-text trailing NUL is C EOF.
No independent whole-token scanner or NaN-shaped numeric node is used for names.
[Source comparison and finite native/public tests](research/card-r-a-json-token-green.md).


### Quoted string production and TEXT5 rendering

`json.c:jsonTranslateTextToBlob(parse_string)` → `Parser.str`: admission,
current error cursor and TEXT/TEXTJ/TEXT5 tag production share one pass; quoted
labels and values immediately consume its raw-spelling/tag result. Single quote
syntax alone leaves TEXT; raw nonzero controls are JSON5-only TEXT5, NUL fails
at the current cursor. `jsonTranslateBlobToText(TEXT5)` → `translateStringSteps`
escapes raw controls through the shared canonical quoting primitive. Container
separator mismatch preserves current cursor before consumption.
[Source comparison, finite tests and resource boundaries](research/card-r-a-json-string-green.md).


## JSON5 whitespace and comment production

Pinned `json.c:json5Whitespace` → `json.ts:Parser.ws/spaceAt`: exact ASCII
and UTF8-codepoint classes, line-comment CR/LF/U+2028/U+2029 ends and complete-only
block-comment cursor commits. Required-child EOF preserves the caller's entry
cursor; top-level trailing whitespace uses the separate conversion path. Existing
strict/JSON5 parser modes encode native nonstandard admission. Label continuation
shares the classifier; `value` owns native literal/alnum boundaries so comments
following null/true/false reach the scanner. JSON's UTF8 decoder preserves BOM
for parser admission instead of silently dropping it. No JS-whitespace broadening.
[Source comparison and finite native/public evidence](research/card-r-a-json-ws-green.md).
The synchronous JSONB validator still lacks per-byte cooperative yield/charge;
representative VM admission checks do not establish resource-accounting parity.

## TEXT JSON label and escape error ownership

Pinned `json.c:jsonTranslateTextToBlob` object fallback and string escape branches
map to `json.ts:Parser.label/str/object`. Unquoted labels retain raw spelling and
TEXT/TEXTJ tag using `sqlite3JsonId1/2` and `jsonIs4HexB` admission, with decoded
keys supplied to consumers. Colon lookahead does not consume the failing token;
its recursive parse failure takes precedence. Quoted invalid escape offsets name
the escape code, not the following digit. JSONB-first document classification and
TEXT character-position publication remain separate, unchanged callers.
[Finite source/native/public evidence](research/card-r-a-json-text-green.md).


## JSON scalar admission and SQL text coercion

`json.c:jsonTypeFunc/jsonArrayLengthFunc` → `jsonInspectionNode` then the
respective type/count consumer: document admission precedes private path coercion,
NULL, lookup, missing/error and publication. `jsonSqlText` factors the existing
extraction private-Mem cast/release; extraction, edits, validity and error-position
inspection reuse it. Paths alone terminate at NUL. `jsonInsertIntoBlob` root
array-insert is a no-op after value admission; `jsonErrorFunc` tests JSONB admission
before text fallback. Ordinary VDBE Function arguments remain uncoerced inputs;
registry arities/flags are unchanged. Test: `json-scalar-admission.test.mjs`;
[source comparison and bounded evidence](research/card-r-b-scalar-admission.md).

## JSON numeric semantic production

`json.c:jsonTranslateTextToBlob` numeric branches → `json.ts:nodeNumber`;
JSONB decoding retains `numericType` and payload rather than reparsing spelling.
`jsonReturnFromBlob` → `numericResult` (INT/INT5 sign/hex/overflow versus
FLOAT/FLOAT5 double), reusing `mem.ts:atoi64Prefix/atof` util.c scanners.
`jsonTranslateBlobToText` → `renderNumeric`; `jsonbValidityCheck` →
`jsonbValidityCheck`, shared by deep validity and error-position, deliberately
distinct from scalar conversion. [Validation evidence](research/card-r-a-jsonb-validation-green.md). `jsonTypeName`
consumes the same header. Multipath JSON_BLOB reparses accumulated JSON text as
upstream `jsonReturnString` does. Test: `json-numeric-type.test.mjs`;
[pinned evidence and boundaries](research/card-r-b-numeric.md).

## JSON extraction and abbreviated arrow paths

`json.c:jsonExtractFunc` maps to `json.ts:jsonExtractFunc` and thin extraction/
arrow wrappers: document-first admission, sequential private TEXT conversion,
lookup/error/NULL order, single versus multipath shaping and JSON_BLOB/JSON_SQL/
JSON_JSON flags. `parseJsonMem` releases its private conversion Mem on success
and error. VDBE Function dispatch retains result-size/checkpoint ownership.
Tests: `json-extract-sequence.test.mjs`, [typed pinned oracle and boundaries](research/card-r-b-extract.md).

`json.c:jsonExtractFunc` JSON_ABPATH / JSON_SQL and `jsonAllAlphanum` map to
`json.ts:jsonArrow`: document-before-path ordering, owned Mem text conversion,
original storage-class index production, full/bracket/label paths, original-path
error reporting and subtype suppression for `->>`. Existing `jsonLookup` /
`pathStep` own reached traversal. Expression arrow lowering feeds the ordinary
VDBE Function dispatcher, which enforces output size. Tests:
`json-arrow-path.test.mjs`; [typed pinned oracle and boundaries](research/card-r-b-arrow.md).

Physical/JSON Window inputs now enter the shared Window rewrite before scalar
module projection, retaining positioned sourceRow payload and independent rowid.
Finite typed/full-metadata and lifecycle author evidence, source comparison and
remaining acceptance gates: [mixed Window correction](research/mixed-json-window/README.md).

## Shared scalar metadata admission

`expr.c:sqlite3CodeSubselect` SRT_Mem and `select.c` aggregate ownership map to
`resolvedScalarSubqueryEmitter`: aggregate EList expressions dispatch to AggInfo,
not the physical planner. `pragma.c:pragmaVtabFilter` arguments use linked
carriers and positioned parent binding in `compileTableSelectProducer`, whose
Filter/Next consume callback supplies AggInfo. The exact correlated expression
passes. Zero-source GROUP BY maps `resolve.c` SF_Aggregate to
`compileScalarSelect` → `compileAggregateSelect`, including nonaggregate ELists.
`compileTableSelectProducer`'s grouped IN and AggInfo's grouped nested expressions
use `compileWideSubquery`; joined scalar aggregation preserves Exists versus Mem.
Linked result descriptors own grouped correlated metadata. `selectInnerLoop`'s
Exists projection omission and pre-projection OFFSET map to grouped emission;
`select.c:7637–7656` IgnorableDistinct maps to AggInfo's destination-derived
result clauses: Exists suppresses DISTINCT and the result sorter in grouped and
ungrouped output; Mem/Set retain DISTINCT-before-OFFSET. The linked native/public
controls include the multi-group DISTINCT/Exists/OFFSET F4 witness.
[Source branches, callers and finite native controls](research/grouped-scalar-correction.md).
`compileWideSubquery` retains schema/module production and scalar
limits; singleton module cursor slots come from the shared builder. Singleton
`bindColumns` binds TK_IN's lhs from the positioned module payload; its rhs
retains its linked SELECT and shared SRT_Set destination. Finite native controls
pass in three encodings, not exhaustive compatibility. Typed planner rejection stays
public. Regressions: `metadata-scalar-error.test.mjs` (execution expectation)
and `metadata-scalar-filter.test.mjs` (native controls), plus
`metadata-scalar-bind.test.mjs` (bound/rebound/reset, cancellation and private
SRT_Set budget controls; pinned `scalar-bind-native.json`). These bind controls
alone do not establish evaluation counts or mid-execution cancellation.
`expr.c:sqlite3CodeSubselect` conditional Once/reset and correlated invocation →
[metadata-scalar-invocation.test.mjs](../test/conformance/metadata-scalar-invocation.test.mjs),
with [capture-metadata-scalar-invocation.py](../tools/oracle/capture-metadata-scalar-invocation.py)
and [scalar-invocation-native.json](research/card-e-n-pragma-red/scalar-invocation-native.json):
exact counts for Once/correlated/conditional/skipped branches, repeated bind/reset,
INTEGER/NULL and full metadata across encodings. Public checkpoints after child
progress check cancellation/saved-error/reset/reuse; deterministic native callbacks
are not RNG parity or native AbortSignal semantics, nor exhaustive interruption or
budget-schedule coverage. Bounded combined artifact a745aa62 is accepted in
[[card:card-e-l]] `record:///status.md?card=card-e-l&v=254`; root original18/expanded36
remains a separate [[card:card-w]] gate.
[Scalar delivery evidence](research/metadata-scalar-delivery.md).
[Evidence and boundary](research/metadata-destination-correction.md#shared-scalar-planner-admission-boundary).

## Metadata cursor identity (bounded consumers)

`resolve.c:lookupName` → `resolve.ts:direct`: real columns precede implicit
rowid candidates. `pragma.c:pragmaVtabCursorClear/pragmaVtabNext/pragmaVtabRowid`
→ `vdbe.ts:MetadataFilter/MetadataNext` per-cursor counter and explicit identity
register; singleton/mixed binders and declared metadata aggregate payloads retain that
identity independently of visible fields. `metadata-identity.test.mjs` compares
pinned `identity-native.json` (capture: `tools/oracle/capture-metadata-identity.py`)
including full metadata/reset/all encodings. Physical scalar child bindings map
outer logical columns through the selected covering index (where.c:WhereEnd),
with table-storage mapping for non-covering scans. `where-metadata-loops.ts`
translates pragmaVtabBestIndex last-hidden-EQ selection and prerequisite masks;
selected constraint reductions carry omit ownership into WHERE/ON emission.
`vdbemem.c:valueToText/sqlite3ValueText` → `Mem.valueText` private UTF-8
representation (preserves producer type); pragmaVtabFilter copies its NUL-prefix
after clearing the prior cursor. `mem-core.test.mjs` and native identity controls
cover numeric/NULL/BLOB/text conversion and selected versus duplicate residuals.
`compileInnerTableSelect` gives each metadata occurrence its own Filter/Next/Close
cursor and declaration-width register payload. Two-source, hidden-EQ, Result0
and empty LEFT controls pass in the native corpus. `bindResolvedExpression`
retains resolved source identity; singleton module rebinding preserves linked
outer locations rather than comparing remapped cursor numbers. Correlated
outer-rowid aggregate predicates and positive `metadata-identity-boundary.test.mjs`
controls pass. `window.c:sqlite3WindowRewrite` → module window admission and
`compileWindowSelectLowering` sourceRow registration: the shared WHERE coroutine
publishes declaration payload plus identity to existing window buffer bindings.
`select.c` AggInfo input → seven-family declared metadata aggregate enrollment,
including Result0 database_list; no B-tree descriptor is fabricated. Native
controls cover aggregate/window identity in all seven families, empty input and
window LIMIT. Independent finite producer/caller acceptance for the 15-path delta
at `404b6d00` (tree `f2bdce253622`) is recorded in [[card:card-e-l]]
`record:///status.md?card=card-e-l&v=269`; this is not general virtual-table parity.
Detailed source/native evidence: [identity rationale](research/card-e-n-pragma-red/IDENTITY.md)
and [[card:card-e-n]] status.

## Mixed module predicate readiness

The mixed physical/module producer resolves WHERE/ON against both declarations before partitioning bound dependencies. INNER/CROSS physical-ready conjuncts execute once before module arguments/Filter and are removed from inner residual evaluation. Module-dependent terms retain inner-row positioning; LEFT match/null-extension ordering is unchanged. Child Select prerequisites follow linked source identities through nested/compound children; shared Mem/Set/Exists lowering retains positioned parent cursor/register locations. `resolve.c:resolveSelectStep` pOuterNC/pPrior and `select.c:multiSelect` TK_ALL map to `compileScalarSelect` and its WHERE-arm `compileCteUnionAll` consumer retaining linked compound-arm plans, positioned caller binding and one enclosing prepared LIMIT/OFFSET owner; arm consumers preserve Exists runtime EList elision after prepare validation and do not re-resolve against an empty outer scope or decrement the shared counter twice. Physical-ready children run in the later pass at that same ready level, while module-dependent children remain after Filter (`whereexpr.c:exprSelectUsage`). Regression: `json-child-readiness.test.mjs`; correction evidence: [[card:card-m-f-k]] status. This bounded readiness translation follows `resolve.c:lookupName`, `select.c:sqlite3SelectPrep` and `wherecode.c:sqlite3WhereCodeOneLoopStart` prereqAll/notReady and TERM_CODED ownership, not a general virtual-table planner substitution. Tests: `json-mixed-readiness.test.mjs`, `json-mixed-resolution-controls.test.mjs`, `json-mixed-resolution.test.mjs`. Revision-bound author evidence and remaining acceptance obligations: [[card:card-m-f-k]] accepted status615/622.

Bounded JOIN/retained compound arms now use the same enclosing VM resolved
producer and projected full-row delivery for widths two/three. Retained children
are limited to existing single-table ORDER/LIMIT producers. Sequential ALL and
full-key coroutine merge keep their existing ownership. This is bounded author
implementation, not arbitrary composition or independent compatibility approval.
Source mapping, native/public tests and outstanding verification are in
[JOIN/retained evidence](research/join-retained-compound-implementation.md).
Unordered ALL dispatches bounded retained JOIN arms to the same resolved full-row
producer before arm emission, using expanded EList widths (including stars), not
raw syntax-item counts. Resolved arity is checked before producer lowering;
resolved result references also preserve demanded retained payloads.
[Expanded-width source/native/public controls](research/compound-expanded-width-evidence.md).
Specialized linked scalar/IN/EXISTS retain their
arity and shape gates; ordered/set table subqueries are not blanket-admitted.
[Linked contracts and accounting](research/join-retained-compound-contracts-evidence.md)
records finite native/error/invocation, live-key, rollback and cleanup controls.


## Linked JSON module enrollment and selected execution

- `json.c:jsonEachColumn` / `select.c:selectInnerLoop` requested values → `vdbe.ts:jsonColumnDemand`, legacy resolved binders, JsonTableRewind → `json.ts:openJsonTableCursor` demanded conversion. Ten positional slots remain; undemanded fields are NULL through sourceRow/AggInfo snapshots, explicit hidden TEXT/BLOB retains owning Mem copies. Final `finalizeJsonColumnReads` instruction selection maps each occurrence’s producer-slot reads to `JsonTableColumn` (null-extension writes to `JsonTableNullColumn`), preserving instruction addresses and ordinary owning snapshot Copies. `openJsonTableCursor.column` converts only executed reads; Rewind/Next position traversal. See [runtime-demand correction](research/card-r-d-lazy-column-repair.md). Handcrafted VM consumers read into separate owning registers before ResultRow/Close; Next targets include those reads. Direct cursor eager defaults do not apply to VM producer slots. Tests: `json-producer-close.test.mjs`; [caller audit/evidence](research/card-r-d-lifecycle-callers.md). Tests: `json-hidden-demand.test.mjs`, `json-hidden-consumers.test.mjs`; boundaries/evidence: [column demand](research/card-r-d-hidden-demand.md).

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

`wherecode.c` VFilter argv / `resolve.c` generated SELF / `expr.c:sqlite3ExprCodeGeneratedColumn` → physical-left scalar metadata dispatch to `compileInnerTableSelect`, `resolvedGeneratedExpressionCarrier`, `bindResolvedExpression` and shared `IfNullRow`/storage lowering. `pragma.c:pragmaVtabFilter/Next` → unchanged MetadataFilter/Next. Native typed/full-metadata regression: `metadata-generated.test.mjs`, captured by `capture-metadata-generated.py`; [source comparison and finite evidence](research/card-e-n-pragma-red/GENERATED.md). `select.c:updateAccumulator` positioned direct-mode row → metadata `compileAggregateSelect` caller → `compileInnerTableSelect.sourceRow/consumeRow` → existing AggInfo payload registers including independent identities; no scalar projection reparse. `metadata-generated-aggregate.test.mjs` compares typed/full metadata, two reset cycles and all encodings using `capture-metadata-generated.py --aggregate`.

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

- select.c flattenSubquery restrictions 8/9/11/19, tags0482/0488 and
  selectInnerLoop SRT_EphemTab → vdbe.ts compileRetainedFilter:
  resolved transient producer tables, shared-builder ORDER/LIMIT child fill,
  private retained cursor mapping → compileInnerTableSelect WHERE/FULL/order
  consumer. select.c computeLimitRegisters and wherecode.c coroutine first/next
  plus where.c materialized Gosub → parent LIMIT before sourceProducers invocation;
  register-backed Yield rows or callable Once fill and retained FULL replay.
  select.c disableUnusedSubqueryResultColumns/tag0440 → resolved parent column
  uses (including nested scopes), ORDER-result dependencies and slot-preserving
  NULL rewrite before both bodies; original validation/metadata remain intact.
  parse.y VARIABLE / expr.c sqlite3ExprAssignVarNumber → retainSelectParameters:
  complete SelectNode.tokens in byte order plus generated reduction carriers,
  position identity shared by all existing CTE/compound/retained helper callers.
  Tests: retained-filter.test.mjs with pinned metadata/typed/reset/error oracle;
  from-subquery-routes.test.mjs retains the original t1 ORDER/LIMIT+WHERE case
  with exact-fixture native metadata/typed/reset proof and mixed-module prepare boundary
  ([contract adjudication](research/original-test-contract.md));
  [evidence](research/retained-filter.md), [demand correction](research/retained-filter-demand.md).

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

`where.c:whereLoopOutputAdjust` (3037ff, `pExpr->pRight` at3090) →
`where-plan.ts:outputAdjust/expressionOperand`: live ordinal RHS projection,
no per-insertion child array or cross-call mutable-graph memo. Progress/error
ordering and all-encoding borrowed-carrier replacement are covered by
`where-plan-analysis.test.mjs` (output RHS projection); original150+150/21002
budget stress remains unchanged. Bounded timing evidence: [[card:card-s-f-b]] status.


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

Current boundaries: JSON `json.c:jsonEachFilter/Next/Rowid` and
`wherecode.c:2738–2958` → `vdbe.ts:compileInnerTableSelect` module rowIdentity,
register-prefix nulling and common-interior unmatched Filter replay;
`json-right-full.test.mjs` tests both physical/module directions, independent
aliases, duplicates, metadata, ordered output and reset against pinned native output.
`select.c:checkOnExpr/selectCheckOnClauses` → `resolve.ts` linked source-identity
checks for outer table-function arguments and constrained ON clauses, including
nested/compound children; `vdbe.ts` RIGHT fallback filters prereq against its
positioned prefix. Prepare/error-phase and finite coverage:
[JSON evidence](research/recursive-join/json-right-full-evidence.md).
Per-barrier RIGHT/FULL state; selected expression/partial/covering/
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
  ephemeral handles through the existing private cursor primitive. `where.c`
  LEFT match/NullRow completion → shared LEFT loops with retained cursor readiness;
  `vdbe.c` OpenEphemeral/OpenDup initialize independent null-row handles;
  Rewind/Next publish empty/exhausted flags; SeekRowid clears after integer seek;
  NullRow/Column/Rowid/IfNullRow consume handle-local state without deleting
  shared records. Clear/sort preserve flags while invalidating positions.
  [Branch evidence](research/recursive-join/left-evidence.md). `select.c:columnTypeImpl`
  follows the right-most recursive arm to Current-table metadata. Tests:
  `recursive-cte-left.test.mjs`, `ephemeral-null-row.test.mjs`,
  `recursive-cte-join.test.mjs` and `cte-admission.test.mjs` (pre-emission
  specialization decline preserves derived/multiple recursive dispatch);
  `select.c:tag-select-0484` CteUse reuse → `compileRecursiveJoinedSelect` one
  retained producer plus per-alias OpenDup cursors, shared WHERE/AggInfo consumers.
  `recursive-cte-repeated.test.mjs` covers INNER/CROSS/LEFT/GROUP, correlation,
  queue/consumer controls, resets/rebinds and bounds/cancellation;
  [repeated-reader comparison and typed native/public evidence](research/recursive-join/repeated-evidence.md).
  [Native/public evidence and boundaries](research/recursive-join/README.md).
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

`date.c:setDateTimeToCurrent/osLocaltime/toLocaltime/parseModifier(utc)`,
`vdbeapi.c:sqlite3StmtCurrentTime`, `vdbe.c:iCurrentTime` and
`os.c:sqlite3OsCurrentTimeInt64` → private `date-time.ts` environment,
`index.ts` symbol enrollment and `VdbeStatement` Function clock. Entry reset
and UTC provenance use the shared producer; failed clock acquisition remains
uncached so later calls retry as `sqlite3StmtCurrentTime` does.
`resolve.c:resolveExprStep` registration checks/Expr.op2 → generated carrier and
both virtual bindings → PureFunc/P5 → FunctionContext.notPure → reached date
branches. Tests: `run-date-time-provider-ts.mjs`, `run-date-time-provider-failure-ts.mjs`,
`run-date-time-generated-matrix-ts.mjs` (native metadata/nested/STORED matrix),
`run-date-time-once-ts.mjs` (expr.c constant walker), `run-date-time-entry-ts.mjs`
(real-task/independent entry cache) and `run-date-time-registration-ts.mjs`.
[Admission assessment](research/card-q-a-a-provider-admission.md),
[repair evidence and residual matrix](research/card-q-a-b-provider-repair.md).
`date.c:strftimeFunc` format/NULL short-circuit precedes `isDate` in
`evaluateDateTime`; generated native/public matrix and ordinary provider/failure
runners cover NULL formats and reached nonNULL neighbors. Constant scalar Once
is a charged opcode: bounded-expression regression retains a finite23-fail/24-row
boundary for `hex(?1)`, including saved-error/reset/reuse (same evidence link).
`date.c:isDate`/`setRawDateNumber` → shared `isDate`/`parse`/`rawDateNumber`;
`timediffFunc` → sequential complete `isDate` admission before calendar consumers;
value_text → private
`Mem.valueText`, with consumer-owned C-NUL boundaries in parse/format/apply.
`parseModifier` numeric prefix/unit branches overwrite incoming n before use;
unixepoch/auto preserve floating add-before-round and range-before-cast order.
[Argument receipts/generator and public runner](research/card-q-a-b-date-admission.md)
cover these paths without changing selected upstream denominators.

`json.c:jsonLookupStep` reached-step path parsing and shape/NOTFOUND exits →
`json.ts:pathStep/jsonLookup/editNode/pathLabelIndex` (unparsed tail threaded into construction;
raw quoted spans plus escape flags, producer-label byte comparison via `jsonReadLabel`,
retained mutation labels with deferred TEXT rendering; [quoted-path evidence](research/card-r-b-quoted-path.md);
bounded index digit accumulation and contextual from-end NOTFOUND before delimiter
validation). [Index boundary matrix](../test/conformance/json-from-end-delimiter-order.test.mjs)
compares all shared scalar consumers against [pinned native capture](research/card-r-b-from-end-native.json).
`json.c:jsonMergePatch/jsonPatchFunc/jsonBlobEdit/jsonBlobOverwrite/jsonAfterEditSizeAdjust`
→ `json.ts:mergePatchBlob/JsonPatchBlob/jsonPatch` → shared VDBE json_patch/jsonb_patch:
private byte-buffer edits, per-member first-match scan, raw-label copy, overwrite
header widening, recursive delta/depth and target-before-patch parsing.
`json.c:jsonLabelCompare/jsonLabelCompareEscaped/jsonUnescapeOneChar` → byte-span
`jsonRawLabelEqual/jsonEscapedLabelEqual`; `jsonTranslateBlobToText` → `jsonBlobText`
→ owned UTF-8 Mem TEXT (byte consumers do not decode). Public tests:
`json-mergepatch-duplicate-delete.test.mjs`, `json-mergepatch-byte-order.test.mjs`,
`json-mergepatch-raw-label.test.mjs`;
[native evidence/limits](research/card-r-b-mergepatch.md).

[Path reachability](../test/conformance/json-path-reachability.test.mjs) covers
reached errors versus unreached suffixes across extraction/type/length/arrows and
TEXT/JSONB mutation callers. Scoped author evidence: [[card:card-r-b]] status.

`json.c:jsonLookupStep` missing-key/array-end branches and
`jsonCreateEditSubstructure` → `json.ts:editNode/createEditSubstructure`, using
private copy-on-write containers and retaining label encodings. Regression:
[missing edit substructure](../test/conformance/json-missing-edit-substructure.test.mjs)
(TEXT/JSONB, no-shell bounds, scalar shape, sequential edits, reset/reuse);
scoped author evidence and remaining matrix: [[card:card-r-b]] status.

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
  `select.c:sqlite3ColumnsFromExprList` direct-column naming and SRT_Coroutine
  producer ownership map to `transientSourceTable` and retained-source
  `compileWindowSelectLowering`/`compileInnerTableSelect` for CTE/module input.
  [Composition tests and boundary](research/cte-json-window-composition.md).

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
| `analyze.c:loadStat4`, sample counts/record acquisition; `vdbemem.c:sqlite3Stat4ProbeSetValue` and ProbeFree | `schema.ts:loadStat4Samples` acquires encoded records; `stat4-record.ts` privately retains owned padded identity for scalar/probe borrowing while public reads copy; `stat4-probe.ts:Stat4Probe` shares Mem affinity/comparison and restores active prefixes/all-slot cleanup | `stat4-loader-primitive.test.mjs`, `stat4-probe-primitive.test.mjs`, `stat4-owned-sample.test.mjs`; [ownership evidence](research/card-s-h/SAMPLE_OWNERSHIP.md); [mapped review](research/card-s-h/d-diagnosis/MAPPED_REVIEW.md) |
| `where.c:whereKeyStats` (1718), equality/IN/range estimators | `stat4-estimate.ts:whereKeyStats` virtual-prefix search; `where-plan.ts:sampleEquality`, `sampleRange` consume contiguous prefix/literal equality, IS/NULL, literal-list IN and scalar range/DESC estimates | `stat4-keystats.test.mjs`, `docs/research/card-s-h/public-first.test.mjs`; [integrated evidence](research/card-s-h/main-integration/) |
| `where.c:sqlite3WhereBegin` second pass (7086–7106), HIGHTRUTH/HEURTRUTH | `where-plan.ts:WhereTruthState`, `buildAll` reconstruct whole loop groups with restored construction budget and progress checks; probe callers restore prefix state on failure | `docs/research/card-s-h/caller-first.test.mjs`, `stat4-schema-lifecycle.test.mjs`; same integrated evidence |

| `where.c:whereRangeSkipScanEst`, `vdbemem.c:sqlite3Stat4Column` | `stat4-skipscan.ts:stat4Column/stat4SkipScanRange` scalar sample extraction/count loop; `where-plan.ts:indexLoopEstimate` invalid-prefix branch consumes adjustment or close-bound fallback | `docs/research/card-s-h/skiprange-*.test.mjs`, `numeric-production.test.mjs`; [useful native/profile evidence](research/card-s-h/skiprange-native.json) |

These are bounded delivered consumers, not independent histograms or arbitrary native plan/cost parity. Wider vector/function/subquery probes and remaining STAT4 skipscan sample-range refinements remain gaps. Parameter-sensitive reprepare is separately mapped in the current guide; this sample slice alone does not certify general reprepare parity.

## Right-nested correlated membership residual

`expr.c:sqlite3CodeRhsOfIN/sqlite3ExprCodeIN` → `vdbe.ts:compileWideSubquery` linked joined binding, correlated no-Once SRT_Set and packed probe; RIGHT downstream readiness remains with joined continuation. Exact original positives and adjacent atomic ordered-compound gate: `test/conformance/right-nested.test.mjs`. [Native-first typed three-encoding and affected control/lifecycle evidence](research/right-nested-in/README.md). No runtime admission change or general nested-join completeness claimed.

Ordered filtered/projected full-row ordinary table arms use resolved scan destinations into the same-VM A/B merge; separate order/permutation and full-output duplicate keys, initial-empty A scheduling, balanced UNION/ALL and independent ALL capacities map to `select.c:multiSelectByMerge` and `resolve.c:resolveCompoundOrderBy`. [Current bounded source/test evidence](research/card-j-d-b-a-c-filtered/MERGE.md). Unordered ordinary table UNION ALL scans sequentially; unordered non-ALL uses the same full-row merge via `select.c:multiSelect`'s invented ORDER route. Local DISTINCT remains scan-owned typed ephemeral production. [Wide native/source evidence](research/compound-wide-repair.md).

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

## VM host delivery control boundary

| Pinned source | Execution owner | Tests and rationale |
| --- | --- | --- |
| `vdbe.c:check_for_interrupt`, `vdbeaux.c:sqlite3VdbeReset` | VM private work/control remains per-unit; [host admission](../src/internal/vdbe-host-admission.ts) is separate conditional task transport | [private continuation/reset and stable merge](../test/select/vdbe-private-continuation.test.mjs), [source comparison/evidence](research/card-t-d-vm-admission-disposition.md) |


## Direct JSON Window input

Single-source JSON each/tree Window inputs now consume the original shared WHERE
coroutine with source-identity register locations and independent rowid, rather
than B-tree Column/Rowid. Existing window rewrite/frame owners remain unchanged.
This is bounded progressive admission, not arbitrary module/window support.
Pinned metadata/typed rows and reset comparisons:60 variants/180 native runs;
no new upstream assertion credit or denominator change. Direct controls include
admission and suspended cancellation/deadline recovery. See
[finite evidence](research/direct-json-window/README.md).

- `expr.c:TK_AGG_COLUMN/useSortingIdx`, `select.c:updateAccumulator` grouped sorter drain → `vdbe.ts:bindSorterSnapshot` recursively selects saved register leaves for module aggregate arguments before expression lowering; producer conversion occurs before Next/EOF, drain Copies retain ownership. Tests: `json-grouped-snapshot.test.mjs` (nested arithmetic/CASE/COALESCE/cast/IN/BETWEEN, four modules, TEXT/actual JSONB, all public encodings, reset). [Evidence and bounded guarantees](research/card-r-d-grouped-snapshot.md).

| `json.c:jsonTranslateTextToBlob`, `jsonbPayloadSize`, `jsonValidFunc`, `jsonbValidityCheck`, `jsonTranslateBlobToText` | `json.ts:Parser.value`, `jsonbSize`, `jsonValid` | `json-foundation-boundaries.test.mjs`; [depth/header evidence](research/card-r-a-json-boundary-green.md) |

| `json.c:jsonTranslateTextToBlob` numeric production; `jsonConvertTextToBlob`; `jsonErrorFunc` | `json.ts:Parser.numeric`, `Parser.parse`, `jsonErrorPosition` | `json-numeric-production.test.mjs`; [evidence](research/card-r-a-numeric-green.md) |

| `json.c:jsonbValidityCheck`, `jsonArgIsJsonb`, `jsonValidFunc`, `jsonErrorFunc`, `jsonUnescapeOneChar`, `jsonBytesToBypass`; `utf.c:sqlite3Utf8ReadLimited` | `json.ts:jsonbValiditySteps`, `jsonbUnescapeLengthSteps`, `jsonArgIsJsonbSteps`, `jsonValidSteps`, `jsonErrorPositionSteps`; `vdbe.ts:Function/PureFunc` async drivers | `jsonb-validation.test.mjs`, `jsonb-unicode.test.mjs`; [recursive unescape evidence](research/card-r-a-jsonb-unicode-green.md); [shared validator/error evidence](research/card-r-a-jsonb-validation-green.md); [cooperative owner/caller evidence](research/card-r-a-json-validation-progress.md); [nested TEXT5 bypass controls](research/card-r-a-json-text5-progress.md) |

| `json.c:jsonEachFilter` document admission → sqlite3_value_text(root) → sqlite3Strlen30/lookup | `vdbe.ts:JsonTableRewind` passes Mem; `json.ts:openJsonTableCursor/jsonSqlText` owns ordered private conversion and C-string path | `json-table-root.test.mjs`; [pinned typed/metadata/error/lifecycle evidence](research/json-table-root/README.md) |

## JSON semantic error ownership

`json.c:jsonEachPathLength` reverse candidate lookup/payload comparison and
`jsonExtractFunc` diagnostic conversion map to json.ts private path-error
classification; array-insertion contextual conversion has a separate sentinel.
Control failures are never inferred from message text. Tests:
`json-root-parent-errors.test.mjs`, `json-root-parent-native.test.mjs`,
`json-path-control.test.mjs`. [Owner source comparison](research/card-r-b-lazy-jsonb-delivery/root-parent-errors/evidence.md);
[combined independent verification](research/card-r-e-json-final-verification.md).

### Enabled math and combined scalar callers

`func.c:ceilingFunc/logFunc/math1Func/math2Func/piFunc` and
`vdbe.c:numericType` → `math.ts`, `Mem.valueNumericTypeCopy` → registry
`functions.ts` → resolver/`select-compiler.ts` Function lowering → `vdbe.ts`.
Tests: `run-math-cases-ts.mjs` (23 cases/69 typed observations, 30 registration
rows/29 names), `math-manifest.test.py`; INTEGER-preserving rounding and
second-operand log coercion retain source ownership. ECMAScript Math is the
browser-safe libm adaptation; finite host last-bit qualifications persist.
DATE/provider mappings above use the same combined callers, not a parallel
execution path. [Combined provenance/validation](research/card-q-a-b-combined-r3.md).

`select.c:selectInnerLoop` nResultCol/nSdst → `compileSimpleTableCompound` resolved expanded width, contiguous row and full-row local DISTINCT ephemeral destination (not compound set accumulation). `multiSelectByMerge` duplicate versus ORDER keys → existing shared merge with full-row callback payload and retained-arm identity. [Tests](../test/conformance/compound-multi-output.test.mjs), [repair evidence](research/multi-output-compound-repair.md).

## Retained recursive prefix RIGHT/FULL

`select.c` CteUse/tag-select-0484 and `wherecode.c:sqlite3WhereRightJoinLoop`
→ `vdbe.ts:compileRecursiveJoinedSelect` retainedCursors/cursorFor → existing
`compileInnerTableSelect` per-barrier match/drain. Physical identity remains rowid;
retained RHS uses `private-state.ts:rowid` insertion sequence+1 at both sites.
Drain carries retainedCursors/cursorFor; preceding handles receive NullRow.
[Native/public metadata, duplicate and alias discriminators](research/recursive-join/right-full-evidence.md).

## Joined metadata Window input

`window.c:sqlite3WindowRewrite/CodeStep`, `windowAggFinal/windowCodeOp` and
`pragma.c:pragmaVtabFilter/Next` map to `vdbe.ts:compileTableSelectProducer`,
`compileWindowSelectLowering` original-input WHERE coroutine and disjoint
cumulative-peer/generic-RANGE drains. Genuine metadata source identity is carried
by sourceRow registers, not physical Rowid. Tests: `joined-metadata-window.test.mjs`
and `joined-metadata-window-controls.test.mjs`; [source comparison/native evidence](research/joined-metadata-window/README.md).
No additional upstream assertion credit or general module planner closure.

## Bounded recursive JOIN-arm compounds

Same-operator UNION/UNION ALL consumers admit recursive INNER/CROSS/LEFT arms and physical arms through the existing full-row compound merge. One lazy Once-guarded retained recursive producer supplies independent OpenDup readers; Queue/Current retains body controls while the compound owner retains outer ORDER/LIMIT, arity and full-row duplicate semantics. Leftmost setup-expression collation is independent of rightmost metadata provenance. Materialization charges the full requested producer before its first row; this is not streaming or native work/allocation parity. Mixed operators, grouped/window/derived arms and additional recursive declarations remain temporary gaps in this route; RIGHT/FULL and physical producer-term joins remain outside this slice.

Pinned `select.c:multiSelect/multiSelectByMerge`, CteUse tag-select-0484 and `selectAddColumnTypeAndCollation` map to `vdbe.ts:compileRecursiveCompoundSelect/compileSimpleTableCompound/prepareRecursiveSource` and `select-compiler.ts` dispatch. `test/conformance/recursive-cte-compound.test.mjs` and [source comparison and finite native/public evidence](research/recursive-join/compound-evidence.md) cover this boundary, without additional upstream assertion credit.
