# SQLite-to-TypeScript translation guide

Development integration orchestration (`tools/test/integration.py`) uses one
frozen ordered inventory; prerequisites are prepared once per invocation with
a 180-second ceiling per prerequisite. Test files execute serially in
batches of at most 80 files. Owner-selected independent safety ceilings are
60 seconds per file and 600 seconds per batch; there is no whole-suite time cap.
A batch ceiling interrupts its current component, records that batch's unrun
tail and proceeds to the next batch; any failure, timeout, unrun file or input
drift makes the invocation fail. These are runner limits, not acceptable SQL
latency or permission to weaken resource/abort assertions. Historical 30-second
failures retain their original status. Controls: `test/integration-runner.test.py`;
current integration evidence: [[card:card-w]].

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


### JSON5 whitespace and comment production

Pinned `json.c:json5Whitespace` → `json.ts:Parser.ws/spaceAt`: exact ASCII
and UTF8-codepoint classes, line-comment CR/LF/U+2028/U+2029 ends and complete-only
block-comment cursor commits. Required-child EOF preserves the caller's entry
cursor; top-level trailing whitespace uses the separate conversion path. Existing
strict/JSON5 parser modes encode native nonstandard admission. Label continuation
shares the classifier; `value` owns native literal/alnum boundaries so comments
following null/true/false reach the scanner. JSON's UTF8 decoder preserves BOM
for parser admission instead of silently dropping it. No JS-whitespace broadening.
[Source comparison and finite native/public evidence](research/card-r-a-json-ws-green.md).
Strict JSONB validation and json_error_position use a shared resumable source-ordered validator/parser, driven asynchronously by Function/PureFunc after admission. Reached elements and scalar-payload chunks, including consecutive TEXT5 line-continuation bypass inside unescape, charge work and allow scheduler suspension; flags4 keeps its superficial short circuit. This is bounded cooperative execution, not exact native heap/accounting parity. [Evidence and limits](research/card-r-a-json-validation-progress.md).

### TEXT JSON label and escape error ownership

Pinned `json.c:jsonTranslateTextToBlob` object fallback and string escape branches
map to `json.ts:Parser.label/str/object`. Unquoted labels retain raw spelling and
TEXT/TEXTJ tag using `sqlite3JsonId1/2` and `jsonIs4HexB` admission, with decoded
keys supplied to consumers. Colon lookahead does not consume the failing token;
its recursive parse failure takes precedence. Quoted invalid escape offsets name
the escape code, not the following digit. JSONB-first document classification and
TEXT character-position publication remain separate, unchanged callers.
[Finite source/native/public evidence](research/card-r-a-json-text-green.md).


Physical/JSON Window inputs now enter the shared Window rewrite before scalar
module projection, retaining positioned sourceRow payload and independent rowid.
Finite typed/full-metadata and lifecycle author evidence, source comparison and
remaining acceptance gates: [mixed Window correction](research/mixed-json-window/README.md).

Shared scalar aggregate expressions now dispatch to AggInfo by aggregate
ownership throughout EList rather than only a root aggregate node. The metadata
producer receives the linked argument carrier and positioned parent binding;
Filter/Next feeds the existing consume destination. Correlated count(*)+sum(cid)
now passes the exact three-encoding reproducer. Zero-source GROUP BY (including
nonaggregate ELists) delegates to AggInfo with the linked binding and Mem/Exists/Set
destination; EXISTS omits runtime EList and irrelevant result DISTINCT/ordering
(`select.c` IgnorableDistinct), so grouped OFFSET without effective DISTINCT/result
sorting precedes projection. Mem/Set retain DISTINCT-before-OFFSET semantics. [Scoped source comparison
and controls](research/grouped-scalar-correction.md) cover FIRST/LIMIT, empty/NULL/HAVING,
bind/reset and nested arguments, not exhaustive composition. Nested metadata IN now binds its lhs from the positioned module row
while retaining the rhs SELECT's independent linked producer/destination. The
finite native controls pass across all three encodings; this is not exhaustive
composition or lifecycle acceptance. Bound/rebound arguments, retained reset,
clearBindings, pre-step cancellation/reuse and SRT_Set private-entry exhaustion
have finite public controls in `metadata-scalar-bind.test.mjs`, compared to the
pinned `scalar-bind-native.json` receipt for typed result/reset behavior. These
bind controls alone do not establish volatile evaluation counts or mid-execution cancellation.
Separate [invocation controls](../test/conformance/metadata-scalar-invocation.test.mjs),
with the [native capture](../tools/oracle/capture-metadata-scalar-invocation.py) and
[receipt](research/card-e-n-pragma-red/scalar-invocation-native.json), compare exact
calls for Once, correlated and conditional invocation and skipped branches across
bind/reset cycles in all encodings, including INTEGER/NULL and full metadata.
Public cancellation observes a checkpoint after correlated child progress and
checks saved-error identity, reset and reuse. Native deterministic callbacks do
not establish RNG parity or native AbortSignal behavior; these are representative
controls, not exhaustive interruption or budget schedules. Bounded combined-input
acceptance is recorded for a745aa62 in [[card:card-e-l]]
`record:///status.md?card=card-e-l&v=254`; root original18/expanded36 remains a
separate [[card:card-w]] gate.
The typed unsupported conversion remains
for genuinely unsupported plans. Remaining breadth is an implementation gap, not
platform constraints. [Scalar delivery evidence](research/metadata-scalar-delivery.md).
[Source comparison and remaining boundary](research/metadata-destination-correction.md#shared-scalar-planner-admission-boundary).

Metadata cursor identity: `MetadataFilter`/`MetadataNext` own a
per-occurrence BigInt counter (first row 1), carried independently of visible
cid/seq through singleton and mixed producers and the declared seven-family aggregate
payload. Native/public controls pass singleton aliases across all seven families,
empty, ORDER/GROUP and representative LEFT/shadow cases. This is not accepted
feature closure: correlated scalar/EXISTS consumers retain covering-index
column locations and generic inner loops now enroll metadata Filter/Next with
independent cursor/register ownership. Native controls cover two occurrences,
hidden EQ, empty LEFT null-extension and Result0 joins. Linked column expressions
retain their resolved source owner through singleton rebinding: parent columns
keep their positioned location while local module columns become payload registers
(`resolve.c:lookupName` NameContext walk). Correlated outer-rowid aggregate
predicates and the positive former-boundary controls now pass. Single and joined resident
metadata window inputs use the existing WHERE coroutine/sourceRow handoff;
window buffer bindings copy the module's real identity register, not a B-tree
Rowid or JSON payload. Cumulative RANGE/GROUPS selects the peer-owned drain,
not the overlapping per-row RANGE drain: xValue runs once per peer and the
result register survives each peer's Return/Yield. [Bounded native/source evidence](research/joined-metadata-window/README.md).
Aggregate enrollment uses the same real declarations
for all seven families, including zero-hidden-column database_list. The finite
15-path identity producer/caller delta at `404b6d00` (tree `f2bdce253622`)
has independent acceptance in [[card:card-e-l]]
`record:///status.md?card=card-e-l&v=269`; broader composition remains unfinished. Generic metadata
loops retain the exact selected hidden-EQ reduction for argv/omit: only that
constraint is omitted from WHERE/ON residuals, not duplicate or unrelated terms.
Filter clears the old cursor before `Mem.valueText` converts arguments to UTF-8
and copies the NUL-terminated prefix, matching pragmaVtabFilter. The conversion
uses a private Mem because the TS representation has one byte-kind slot, unlike
C's coexisting MEM_Str/MEM_Blob flags; producer storage classes remain intact.
Physical
and JSON identity remain separate; these are implementation gaps, not browser
constraints. Current author evidence and remaining obligations: [[card:card-e-n]]
status.
[Source comparison](research/metadata-destination-correction.md).

### Mixed module predicate readiness

The mixed physical/module producer resolves WHERE/ON against both declarations before partitioning bound dependencies. INNER/CROSS physical-ready conjuncts execute once before module arguments/Filter and are removed from inner residual evaluation. Module-dependent terms retain inner-row positioning; LEFT match/null-extension ordering is unchanged. Child Select prerequisites now follow linked source identities through nested/compound children, including SrcItem table-function arguments (`whereexpr.c:exprSelectUsage` pFuncArg), excluding child-local sources from the enclosing mask; shared Mem/Set/Exists lowering retains positioned parent cursor/register locations. Physical-ready children run in the later pass at that same ready level; module-dependent children remain after Filter (`whereexpr.c:exprSelectUsage`). Regression: `json-child-readiness.test.mjs`; correction evidence: [[card:card-m-f-k]] status. This bounded readiness translation follows `resolve.c:lookupName`, `select.c:sqlite3SelectPrep` and `wherecode.c:sqlite3WhereCodeOneLoopStart` prereqAll/notReady and TERM_CODED ownership, not a general virtual-table planner substitution. Tests: `json-mixed-readiness.test.mjs`, `json-mixed-resolution-controls.test.mjs`, `json-mixed-resolution.test.mjs`. Revision-bound author evidence and remaining acceptance obligations: [[card:card-m-f-k]] accepted status615/622.

### Linked JSON module enrollment and selected rows

### Joined expression destination and mixed row identity

Mixed physical/JSON RIGHT/FULL uses the common per-barrier match/interior/drain
owner. Module rowIdentity, not visible key/id/value, supplies membership; prefix
NULL extension clears module registers. Unmatched JSON Filter reevaluates its
selected arguments after prefix NULL extension. Like native jsonEachFilter, it
resets traversal and parses the new input; no universal native parse reuse or
immutable-argument guarantee is assumed. Linked outer-join table-function
arguments reject forward source references, including nested SELECT arms;
RIGHT fallback templates must be ready against the positioned prefix. Shared
readiness, LTORJ, residuals, lazy Column/hidden demand
and SelectDest remain authoritative. Finite native typed/metadata/reset evidence
and unresolved phase/composition obligations:
[JSON join evidence](research/recursive-join/json-right-full-evidence.md).

Joined no-source and admitted UNION ALL EXISTS children validate result expressions at prepare, but emit presence rather than result-value operations. WHERE precedes OFFSET; normalized LIMIT/Once and shared compound counters retain source-order early exit. Scalar Mem destinations still evaluate their projection (`select.c:selectInnerLoop`, SRT_Exists and `multiSelect` TK_ALL). Mixed JSON/physical metadata maps negative physical indexes through the declared IPK before implicit rowid, keeps module rowid in its independent register including LEFT null-extension, and gives COLLATE expression-span/alias names with NULL type/origins. This is not general virtual-table planner parity. [Integration inventory and evidence](research/card-m-f-k-production-integration.md#reviewer-repair-integration).


`expandAndResolveSelect` enrolls genuine `JsonModuleSourceSchema` declarations after catalog/transient/view lookup, preserving callable catalog rejection and hidden-field rules. The four ASCII-folded module names expose eight visible fields, two explicit-only hidden fields and independent rowid; visible declared types are NULL, hidden types empty. No module declaration supplies a physical root page or indexes.

`where-json-loops.ts` translates the usable hidden-EQ BestIndex candidates and dependency-mask retries into ordinary WhereLoop insertion and path selection. WHERE then source-ordered ON constraints precede linked function arguments; residuals, affinity barriers and join ownership remain intact. Selected argv require positioned, not merely lexically visible, sources. IN/LIMIT virtual terms and orderByConsumed are not implemented by this candidate adapter; this is not complete virtual-table planner parity.

`compileWideSubquery` retains linked plans, parent binding, conditional Once and shared Mem/Set/Exists destinations. `compileInnerTableSelect` publishes ten positional register slots plus independent rowid per module occurrence; resolved column demand controls production, and undemanded slots are NULL rather than copied hidden input. Legacy module binders record resolved demand as well. Explicit hidden fields retain owned Mem copies across yields and aggregate/Window snapshots; visible star excludes them. Final instruction selection maps reads of each occurrence’s disjoint producer range to JsonTableColumn, so runtime WHERE/CASE/COALESCE/Exists branches control requested conversion; ordinary saved/delivered registers remain owning snapshots, not cursor aliases. Grouped module aggregate arguments recursively bind producer-register leaves to the sorter-owned row, preserving affinity/collation and unrelated registers; nested CASE/call/cast/arithmetic must not read the exhausted live cursor (expr.c TK_AGG_COLUMN/useSortingIdx). See [snapshot correction evidence](research/card-r-d-grouped-snapshot.md). Null-extension writes become null-column state checked before conversion; rewind/advance/close reset that state. Standalone star lowers individual column reads rather than publishing unproduced slots. Static demand remains conservative planning/snapshot information, not permission to produce skipped expressions. Handcrafted VM programs must execute `JsonTableColumn` into separate owning registers while positioned, before publishing or closing; `rowStart` slots are producer identities, not result storage, and `ResultRow` does not implicitly convert them. Branch targets must include inserted reads, including each successful Next re-entry. Parse-image/path retention and full-row defaults for direct internal cursor callers remain. This eager direct-cursor API default does not apply to VM Rewind/Next. See [caller-transition evidence](research/card-r-d-lifecycle-callers.md). Source comparison, allocation witnesses and bounded verification: [JSON column demand](research/card-r-d-hidden-demand.md) and [runtime column production](research/card-r-d-lazy-column-repair.md). All module occurrences retain common close on exhaustion or scalar/Exists early return. Prepared LIMIT guards precede Filter; WHERE and OFFSET precede publication; Exists validates but never executes EList. Nested scalar emitters inherit positioned outer bindings. No-source UNION ALL lowering, including the `compileCteUnionAll` WHERE-arm route, consumes the original linked plan and caller binding for each arm; the compound alone owns the prepared/shared LIMIT/OFFSET while arms publish to the same Mem/Set/Exists destination without re-resolving in an empty outer scope (`resolve.c:resolveSelectStep`, `select.c:multiSelect` TK_ALL). Physical-left/module-right CROSS/INNER/LEFT paths share selected-loop readiness and unmatched-row nulling. Aggregate input captures the same selected row into AggInfo; retained physical producers fill genuine ephemeral storage before scanning, rather than opening resolution-only rootPage=0 descriptors against the database.

Source owners: `select.c:selectExpander/selectInnerLoop`, `expr.c:sqlite3CodeSubselect`, `where.c:whereLoopAddVirtual/whereLoopInsert`, `wherecode.c:sqlite3WhereCodeOneLoopStart`, `json.c:jsonEachBestIndex/jsonEachFilter`. Tests: `correlated-json-exists.test.mjs`, `json-virtual-candidates.test.mjs`, `json-table-plan.test.mjs`, `scalar-linked-context.test.mjs`, `hidden-source-expansion.test.mjs`, `json-module-enrollment.test.mjs`. Bounded integration and unresolved full-suite evidence: [production integration](research/card-m-f-k-production-integration.md), [[card:card-m-f-k]] status. These receipts do not establish zero remaining lowering gaps or general JSON compatibility.


# SQLite-to-TypeScript translation guide

### Mixed JSON sources retain ordinary CTE identity

The mixed JSON consumer binds lowered CTE descriptors through the existing transient Table/producer/private-cursor path; it must not look the CTE name up as a physical table. The aggregate adapter preserves that descriptor and linked origin plan. Unenrolled derived mixed-module sources decline with a typed temporary prepare gap before either adapter attempts catalog lookup. This bounded route eagerly materializes even when SQLite could flatten or coroutine: first-row work/latency and retained memory are not planner parity. [Boundary and source evidence](research/cte-module-owner/README.md).

### Ordinary materialized producer cursor ownership

Table-backed ordinary CTE fills allocate physical input cursors from the enclosing
SelectProgramBuilder, separately from the materialized SelectDest cursor. Resolved
child-local cursor IDs are semantic carriers, not shared VDBE slots (build.c
sqlite3SrcListAssignCursors / Parse.nTab). The fill returns with its destination
intact; repeated consumers use OpenDup and position independently. LIMIT/OFFSET
terminates the producer, not its parent. Repeated immutable view fills that use
resolved cursor IDs directly reserve those slots in the enclosing builder before
allocating the materialized owner and duplicate reader, mirroring Parse.nTab's
advancing frontier. No cursor invariant is suppressed.
[Bounded repair evidence](research/limited-cte-cursor-ownership.md).

Retained table-backed ORDER/LIMIT FROM sources with an outer WHERE use
`compileRetainedFilter`: transient producer descriptors feed the existing WHERE
consumer through retained private cursors, including FULL join match/null-extension
and parent sorting. Producer LIMIT/OFFSET completes before parent predicates;
flattenSubquery restrictions 8/9/11/19 remain intact. Producers are emitted behind
InitCoroutine or callable Once/Return materialization, then invoked at WHERE scan
entry after parent LIMIT/OFFSET initialization. Register-backed coroutine rows
feed ordinary predicate/projection bindings; retained cursors own materialized
FULL replay, including an initially empty left input. Child ORDER/top-N may block
before its first Yield. Before either producer body is lowered, tag0440-style
column demand keeps parent/nested uses and selected ORDER dependencies, replacing
unused child result slots with NULL. Original child validation and transient
metadata precede pruning; DISTINCT/aggregate/window/correlated cases retain their
source guards. Parameter preassignment consumes the complete original parser token
carrier in byte order, including JOIN ON, source arguments and nested SELECTs,
before result pruning or execution-order lowering. The unpublished validation lowering costs prepare work but adds no
runtime evaluator or bytecode to the delivered program. This is translated demand control, not an eager-fill
substitution. It admits noncompound single-table ORDER/LIMIT children, not
arbitrary derived/CTE shapes. [Source comparison and finite evidence](research/retained-filter.md)
and [invocation correction](research/retained-filter-demand.md).
Original t1 fixture contract and cross-owner merge-gate adjudication:
[bounded native/public evidence](research/original-test-contract.md).

The retained FROM route derives preceding-subquery facts from derived/CTE
producer ownership and schema views, not source position. The select.c:7290–7295
walk checks every crossed join edge (LEFT/RIGHT imply native JT_OUTER even
without the OUTER keyword). Physical-table prefixes remain coroutine eligible;
prior subqueries and join barriers retain materialization. Existing CteUse,
self-view reuse and destination/lifecycle gates remain separate. Source and
regression evidence: [coroutine caller correction](research/from-coroutine-prefix.md).

## Read-only metadata PRAGMA (bounded consumers)

Physical-left two-source scalar metadata consumers use the shared resolved WHERE producer, rather than the JSON name-only adapter. Filter argv, projection, ON/WHERE and ORDER therefore share generated SELF/BUSY dependency lowering, physical storage identity and NullRow-before-generated evaluation. The metadata BestIndex owner selects/omits usable hidden EQ inputs at the positioned prefix; Filter remains per outer row. Aggregate consume callbacks enroll genuine positioned source payloads and independent rowids through the shared resolved WHERE producer before AggInfo consumption, without reparsing a scalar projection. Bounded count/sum and GROUP/HAVING consumers use the same generated SELF/storage and LEFT/error-readiness owners. This is not broader join or general virtual-table admission. [Source comparison and native regression evidence](research/card-e-n-pragma-red/GENERATED.md).

`PRAGMA [main.]table_info` and `table_xinfo` accept omitted, parenthesized or `=` table-name arguments through pinned Lemon command semantics. Immutable catalog columns lower to ordinary VDBE literal loads/ResultRow, preserving logical declaration order, compact visible cid, generated hidden 2/3, PK ordinal and retained default span. Explicit temp is empty; absent databases error. Views derive names and types at prepare through the existing stored-view SELECT expansion/resolution owner, without executing rows. View columns do not inherit base PK, notnull, defaults or generated hidden flags; explicit names, duplicate-name disambiguation, nested/circular views and NONE versus BLOB affinity follow the same source graph. Bounded SELECT consumers admit `pragma_database_list`, `pragma_table_info`, `pragma_table_xinfo`, `pragma_index_list`, `pragma_index_info`, `pragma_index_xinfo` and `pragma_foreign_key_list` through genuine module declarations and shared MetadataFilter/Next. `pragma_database_list` has no hidden columns and accepts zero arguments; the other six declare hidden `arg`/`schema`. Resident main/temp filenames are empty strings, never Fetch URLs. Canonical visible-star expansion precedes mixed-source ORDER ordinals/aliases and result metadata. This is finite module admission, not general virtual-table planner parity; module reverse/RIGHT/FULL/NATURAL/USING shapes remain unadmitted. Declarations enroll before aggregate analysis. Their existing MetadataFilter/Next producer feeds shared AggInfo for single-source or physical-rowid-table plus module aggregation; modules are never synthetic B-trees. Singleton and mixed producers must honor the caller's consume destination, synchronizing register high-water before and after callback lowering, including sorter drain; temporary producer payloads must not escape as public result rows. Regression and revision-bound evidence: [metadata destination correction](research/metadata-destination-correction.md). This is not general virtual-table planner support: other shapes remain unadmitted. [Repair and native comparison evidence](research/card-m-f-k-production-integration.md#metadata-aggregate-declaration-repair). `index_list`, `index_info`, `index_xinfo` and `foreign_key_list` consume the same linked catalog graph: linked index order/origin/partial flags, logical column ordinals versus physical suffix fields, expression/rowid sentinels, key bits/collations/direction (Index.azColl spelling retained separately from folded KeyInfo lookup), and reverse-declaration FK order/actions. WITHOUT ROWID table names may denote their PK index.  `database_list` reports the resident immutable memory snapshot as main with empty filename (not the Fetch URL or native-oracle path); explicit temp PRAGMA preparation opens an empty temp metadata state, subsequently listed with empty filename. Unknown names absent from the pinned pragma registry prepare as zero-column no-ops, even with arguments; known untranslated names remain unsupported. The seven bounded metadata table-valued consumers are implemented as described below; other pragma functions remain unadmitted. No mutating or extension operation is enabled. This is bounded common metadata coverage, not arbitrary PRAGMA support. Source/verification and outstanding coverage: [card-e-n repair evidence](research/card-e-n-pragma-red/REPAIR.md) and [VIEW derivation](research/card-e-n-pragma-red/VIEW.md).

### Represented joined scalar IN residual

Joined correlated scalar IN uses the shared packed SRT_Set/IN membership path,
including resolved outer references after right-join NULL extension. Per-row child
production is not cached as uncorrelated; typed membership preserves empty/NULL
fallback ordering. `right-nested.test.mjs` checks represented in-left rows,
metadata and reset in three encodings against the pinned oracle, replacing an
obsolete temporary-rejection expectation without expanding runtime admission.
[Bounded integration evidence](research/card-w-current-integration-outcome.md#nested-residual-expectation-reconciliation-approved900-overlay)
records source comparisons and fresh native corroboration; arbitrary nested IN
composition remains unestablished.

### Case5 residual ownership

Pinned `wherecode.c` Case5 propagates recursive `untestedTerms` before disabling
the owned OR parent: fully tested selected parents omit repeated common-body truth;
unready arm terms retain their residual for the later ready frontier. Other
conjuncts remain independently owned. `vdbe.ts:emitJoinedOr` checks arm dependency
masks at that frontier and records only owned parent identities; the ordinary OR
consumer removes only selected parent terms after arm truth evaluation before
dedup/Gosub. This is not blanket TERM_CODED omission for all predicates.
Current source/control evidence is retained in
[Case5 owner evidence](research/card-s-g/IMPLEMENTATION.md) and
`test/conformance/or-residual-contract.test.mjs`; native joined/OR companions
remain bounded evidence, not arbitrary correlated-OR completeness.

### Positional stat1 range ownership

Represented skipscan uses the shared WHERE candidate/positional-prefix consumers,
not a precomputed distinct-prefix evaluator. Linked NOTNULL virtual bounds retain
their parent dependencies and suppress ordinary SQL NULL guards; zero-key starts
use Rewind/Last and already-positioned skipped prefixes avoid redundant seeks.
Current source/control mappings and bounded caller exclusions are in
[Linked NOTNULL range owner](SQLITE_SOURCE_MAP.md#linked-notnull-range-owner) and
[the public contract](api.md). [Owner evidence](research/card-s-g/IMPLEMENTATION.md)
preserves historical disabled-caller checkpoints separately from current paths;
[bounded integration evidence](research/card-w-current-integration-outcome.md)
does not imply general optimizer or STAT4 sample parity.

## Authority and current use

Current committed boundary and dirty-proposal separation: [reconciliation](research/card-u-reconciliation/README.md). The [functional-first beta view](PLAN.md#functional-first-beta-view) separates represented functionality, functional gaps, optimization and delivery evidence.

[SPEC](SPEC.md) owns product scope; [PLAN](PLAN.md) owns sequencing. This is the
current engineering entrypoint, not a compatibility certificate or a new gate on
bounded work. The source is SQLite 3.53.4 pinned by the
[manifest](../reference/sqlite/manifest.json). Upstream paths below are relative
to `reference/sqlite/sqlite-src-3530400/`. The [source map](SQLITE_SOURCE_MAP.md)
links implementing routines, TS owners, tests and evidence. [api.md](api.md) owns
the public contract; actual admission is graph/semantic-branch based, not a list of
SQL strings. Unsupported in-scope shapes remain **temporary**, not exclusions.

The current engine is beyond first SELECT: represented joins, compounds,
aggregates, subqueries/views, ordinary and recursive CTEs, windows, ordinary/math/
date-time/JSON functions, and selected WHERE/index routes execute through the
public API. This does not imply arbitrary cross-feature composition or full
SQLite planner equivalence. Accepted bounded outcomes of [[card:card-t]],
[[card:card-s]], [[card:card-r]], [[card:card-o]] and [[card:card-k]] are retained;
this documentation milestone adds no test credit and does not reopen their
architecture. Root continues the read-only roadmap.

## Development inputs and evidence

Before relevant work, read this core and its subsystem section, the applicable
revision of the [mutable fidelity audit](reviews/translation-fidelity-2026-09-14.md),
and the pinned implementing C branches. The audit's original baseline predictions
are not current facts. Compare producers and consumers, initial/reset state,
first/next/seek/empty transitions, destinations, and error/cleanup order through
the actual public execution path. Repair the owning primitive and its callers,
not one SQL spelling. Retain unimplemented syntax sufficiently to reject it
honestly. Tests precede implementation; independent pinned-oracle comparisons
must retain INTEGER/REAL, NULL, text encoding, BLOB, metadata and errors.

Ordinary objects, BigInt, async I/O and browser-safe buffers adapt representation;
they do not license a parallel evaluator. Exceptional substitutions need a
concrete platform constraint, upstream comparison, preserved observables and
source-based tests. Planner/Reviewer decide technical choices; only product
scope/guarantee changes require owner authorization. Decisions remain mutable.

The complete pre-consolidation guide, map, API and roadmap are preserved in
[card-u history](research/card-u-history/README.md), with exact capture hashes,
original headings/lines and provenance. Detailed commands, checkpoints and failed
runs belong there, existing research or durable card records, not normative
current guidance. [Card-u reconciliation evidence](research/card-u-consolidation.md)
records verification and open evidence gaps. Consult history for provenance, not
as an alternative current contract.

## Local distributable boundary

`tsconfig.build.json` emits only the current `src/` engine through pinned TS 5.9.3,
with relative JS import rewriting; `tools/package/build.mjs` cleans output and
normalizes declaration module specifiers via their AST. Repeated ordinary prepack
calls may restore a content-verified clean output snapshot; invalidation, cold-build
and failure controls are documented in [build controls](../tools/package/README.md).
No bundler, runtime
dependency or evaluator substitution is introduced. The private experimental
package allowlists emitted JS/declarations; native/reference/test/tool inputs
remain outside the tarball. [Package evidence](research/card-v-a-package-evidence.md)
records exact local build/consumer/artifact checks and their browser-VM limitation.
This is packaging readiness, not translation compatibility or registry approval.
The [static demo](../examples/browser/README.md) consumes that same public ESM
closure with local immutable Chinook bytes, indexed typed rows and explicit
cleanup; [real-browser evidence](research/card-v-c-demo-evidence.md) is bounded
smoke coverage, not an additional evaluator or full compatibility claim.

## Shared representations and ownership

- `sqlite3` → the public connection plus internal schema/database/limits state.
  One immutable main database is owned by a connection; statements are children.
  No runtime native engine, writes, WAL recovery, host extensions or arbitrary
  external virtual-table modules are introduced.
- `Parse`, `Expr`, `Select`, `SrcList`, `NameContext` → the generated-parser graph,
  linked resolution contexts and enclosing compilation state. Preserve expression
  identity, parent lexical depth, source cursor identity, aliases, collation and
  affinity until their consuming lowering. Tokens/spans own syntax and exact tail;
  they are not an independent evaluator.
- `Vdbe`, `Mem` → immutable published operations and mutable statement VM state.
  INTEGER is signed int64 BigInt; REAL remains double even when integral. NULL,
  TEXT, BLOB, subtype, cached conversions and ownership are distinct state.
  Borrowed record/page values must not outlive their owner; copied public BLOBs
  must not expose mutable internal buffers.
- `KeyInfo`, `UnpackedRecord` → typed full-key descriptors and record values.
  Encoding, collation, sort direction and NULL flags belong to the key consumer;
  no host string/number comparison or `Array.sort` substitutes for SQL comparison.
- `Pager`, `MemPage`, `BtCursor` → bounded immutable bytes, validated page/record
  views and cursors. Private sorter/ephemeral storage is statement-owned and
  separate from the immutable physical database.

## Connection, execution and cleanup

`main.c`, `prepare.c`, `vdbeapi.c`, `vdbeaux.c` map to `src/index.ts` and the
compiler/VM. `open()` performs Fetch acquisition, bounds and format validation;
`prepare()` compiles only the first statement and publishes no statement on
failure. Empty SQL returns no statement with an exact UTF-8-byte tail offset.
One connection rejects overlapping stateful operations, including while a VM is
suspended; separate connections may overlap.

`step()` owns PC, registers, cursors, row publication and work checks. Async
suspension retains those states and connection admission; it is not a second
query interpreter. Failure retains the primary error and releases private state
in the owning cleanup path. `reset()` clears execution/current row and private
state while preserving bindings; `finalize()` is terminal; close owns children.
Cancellation, timeout, work/row/result/private limits remain mandatory across
physical, coroutine and materialized producers. Exact C work-count, intermediate
error and suspension parity is not established merely by matching final rows.
See [API lifecycle and errors](api.md#lifecycle-and-cleanup).

## Immutable storage and schema

Committed generated STORED/VIRTUAL definitions resolve in the immutable SELF TABLE
owner before publication (`build.c:sqlite3EndTable`,
`resolve.c:sqlite3ResolveSelfReference`). Logical binding selects STORED physical
layout or expands VIRTUAL dependencies with per-source BUSY/finally lifetime;
NullRow and aggregate/saved-register ownership precede expansion. Selected
covering generated reads use logical index fields, not dependency ordinals.
STRICT metadata validates INT/INTEGER/REAL/TEXT/BLOB/ANY in declaration order
after PK errors; ANY has BLOB affinity, unlike ordinary ANY. VIRTUAL STRICT
reads consume single-column TypeCheck. This is read semantics, not write
validation. Retained triggers do not execute writes. Full NC_GenCol/walker/lazy
schema and generic index-expression parity remain unclaimed. [Committed schema,
generated and STRICT evidence](research/card-u-reconciliation/README.md#committed-functional-scope).

`pager.c`, `btree.c`, `vdbeaux.c`, `vdbemem.c` and `utf.c` own acquisition,
page traversal, record decoding and text conversion. TS owners are `storage.ts`,
`btree.ts`, `record.ts`, `utf.ts`, `schema.ts`. The read-only adaptation holds
bounded validated file bytes rather than implementing dirty-page journals and
write locks. Overflow chains and page/record bounds must remain checked; cursor
position before/after seek, first, next and EOF follows the relevant upstream
branch, not a post-crash workaround. Persistent comparison/demand/cache ownership
follows the [current primitive mapping](SQLITE_SOURCE_MAP.md#persistent-cursor-demand-and-comparison-primitives)
and [source-based dispositions](research/wr-matched-evidence.md#persistent-primitive-consolidation--author-decisions).
Physical Next/Prev invalidate demand records and rowid state on EOF as well as
successful movement, matching `vdbe.c:next_tail`; no old payload is published as
current after DONE. The persistent `CursorRecord` demand cache
follows OP_Column's terminal-header check: once the requested header parse reaches
its end, the data offsets must consume the full payload before that field is
published. Earlier demanded fields do not force unused serial headers. Generic
`RawRecordReader` unpacking retains its separate trailing-byte contract. Source
branches and finite repair evidence: [[card:card-s-c-d-e]] status; the focused
source-derived cache controls are in `test/storage/record-primitives.test.mjs`.

Schema loading reads immutable `sqlite_schema` internally and parses definitions
into table/column/index/view descriptors. Declared affinity, collation, INTEGER
PRIMARY KEY identity, ordinary index fields, expression/partial predicates and
WITHOUT ROWID primary layout are distinct facts. A generic PRIMARY KEY is not a
rowid proof. UTF-8, UTF-16le and UTF-16be remain required. Ordinary public SELECT from
`main.sqlite_schema`/`sqlite_master` is supported through physical root-page1 and
the same SELECT pipeline, with the bounded metadata/alias/composition rules in
[the catalog API contract](api.md#immutable-catalog-select). Internal graph
construction is not a host graph-registration/introspection-extension API and does
not authorize writes or write-time constraint enforcement.

## Parsing, resolution and SELECT construction

`tokenize.c`, `parse.y`/Lemon, `resolve.c`, `expr.c`, `select.c` own the pipeline.
`tokenize.ts`, `parse.ts`, `lemon-runtime.ts`, `resolve.ts`, `admission.ts`,
`select-compiler.ts` and `vdbe.ts` implement it. Generated reductions retain
compound arms, VALUES rows, CTE/window clauses, spans and nested Select identity.
Graph admission traverses represented nested constructs before program publication;
syntax errors, semantic errors and temporary unsupported are not interchangeable.

`compileSelect` is the production entry. `SelectProgramBuilder` owns shared
operation addresses, register ranges, cursor allocation and labels, corresponding
to `Parse.nMem/nTab` and one Vdbe. Parameters and `SelectDest` flow into selected
producers. A specialized branch may decline **before emission**; after selection
its error propagates, not a catch-and-try fallback. Enclosing entry publishes
operations and Halt. Shared destination emission covers output, scalar Mem,
EXISTS, set, sorter, ephemeral, coroutine and represented aggregate-expression
consumers. Legitimate algorithm-specific schedules remain; accepted migration
does not mean all semantic analysis or specialization has been translated.

Linked column/aggregate owners select physical source, transient coroutine row,
group sorter or saved/finalized registers according to phase. Scalar, EXISTS and
IN consumers use linked source identity and correlation depth, not source-name
string substitution. Broader analyzer/index-expression/RIGHT invalidation and
unrepresented deep/transient compositions remain roadmap debt, not a reason to
repeat accepted bounded migrations. Detailed accepted seam evidence is linked in
the [source map](SQLITE_SOURCE_MAP.md#select-resolution-and-construction).

### Retained derived aggregate input

An ORDER/LIMIT child that cannot flatten into an aggregate (select.c restriction
9) remains a linked SRT_Coroutine producer. Once its input and resolved
NameContext are installed, aggregate compilation does not flatten it again:
AggInfo consumes that same transient source identity. Scalar compound producers
receive the enclosing SelectDest as well as the row callback, so merge output
resumes the consumer instead of publishing child ResultRow values. AggInfo consumes its shared row
registers; synthetic transient sources never OpenRead. Child cursors are allocated
from the enclosing builder so a correlated scalar cannot exhaust its outer scan. Scalar derived aggregate-expression producers also map physical inputs through that
builder before allocating DISTINCT/order state, keeping those cursors disjoint
([cursor ownership evidence](research/limited-cte-cursor-ownership.md)).
The enclosing compileSelect publishes the shared parameter inventory (Parse.nVar)
with the finished program. GROUP BY may consume adjacent child keys directly when
resolved result identity/collation proves adjacency; wherePathMatchSubqueryOB
ignores direction for grouping, so this is not an ascending output promise.
Other output ordering retains its own sorter. Budgets and error cleanup remain
execution-wide, not per child. Bounded tests/evidence and exclusions:
[retained aggregate evidence](research/retained-aggregate-delivery.md).

## WHERE, joins and physical indexes

The [runtime automatic-index/Bloom decision](research/where-autoindex-admission.md)
is the current bounded beta.5 proposal: native costed transient covering indexes,
shared packed private-Btree build/probe, source Bloom hash/filter and execution-owned
Once/resource lifetime, with native-FIRST captures and existing-owner handoff.
Production-private dispatch snapshots carry opaque realm-local execution and program
identities: reset starts a fresh execution, while retained code keeps its plan
identity; reprepare changes the plan, not the execution entry. Snapshots are detached
and frozen. These are diagnostic identities, not SQL/schema hashes or cross-worker
identities. The lifetime follows `vdbeaux.c:sqlite3VdbeRewind`/Reset readiness and the
actual TS execution entry, not a test adapter. Identity controls live in
`test/select/vdbe-private-continuation.test.mjs` and the existing native-receipt
consumer baseline; they do not establish complete resource/safety observation.
The same private snapshot distinguishes emitted opcode names from unique actually
dispatched names, recorded at VM dispatch entry (including an entered opcode
that subsequently fails). Both arrays are frozen detached copies; reset clears
dispatch history. They are TS lowered opcode names, not native EXPLAIN names or
successful-operation counts. Unreached emitted code is never dispatch evidence.
Filter lowering also identifies its authoritative probe cursor for observation.
A present candidate is resolved once: failed lower-bound seek or the initial
prefix rejection increments `collisionRejects`; a matching first prefix clears
it so duplicate exhaustion is not a collision. New Filter and halt clear pending
candidates. Completed automatic builds are counted only on reaching the Once
build-exit address, including empty Rewind exits, not OpenAutoindex entry.
Postbuild reads/movements of that source-table cursor are counted explicitly;
build-phase reads are excluded. Version1 work snapshots expose these completions,
successful inserts, Filter probes, actual private/persistent prefix seeks and
covering-table accesses. They do not establish resource/fault/lifetime acceptance.
Empty builds retain emitted FilterAdd but never report it dispatched.
The same private snapshot exposes the actual shared byte-budget owner ID,
cumulative successful charges/refunds, live owned bytes and byte highwater.
These count deterministic private-state budget units, not total JS heap or Mem
usage. Budget replacement records both ownership transfers only after admission;
failed reservations leave accounting unchanged. Counters persist through cleanup
and reset for release inspection; first step of the next execution installs a
fresh budget owner and zero counters. The old snapshot remains detached. Pages,
scratch/Mem highwater and the complete pending work/lifetime contract remain open.
Capacity highwater/page/scratch/Mem ownership remains pending. Live/release
snapshots now count distinct actual cursor slots, reusable Once state and live
Bloom storage bytes. Halt clears Once together with execution resources; reset
also restores READY. `AUTO_REAL_SURVIVOR=1` in the existing receipt consumer
pauses an independent actual SQL statement after a row, verifies its positive
ownership and byte-for-byte unchanged observation across done/reset/finalize and
post-row cancel/timeout cleanup, then resumes complete native-expected rows.
It also checks saved-error identity on repeated step and direct error-finalize,
consumption on reset/repeated reset, fresh execution identities on retry, and
legacy busy-close refusal without destroying the live statement. The runner
covers automatic (including positive INNER/LEFT) and persistent standalone
fixtures. The owner uses a bound unlimited LIMIT: reset/rebind repeats complete
native rows with a fresh execution and unchanged program. Separate connections
exercise deferred close with both distinct owners live, owner finalization,
rejected new prepare and complete independent survivor continuation. Existing
cancel/timeout first-error schedules remain intact. Actual parameter-sensitive standalone reprepare now uses the same survivor owner
with a native-first STAT4 join witness (`where-autoindex-real-reprepare.mjs`).
Binding expiration must replace the program while preserving fresh execution,
positive FilterAdd/probe/seek work, native rows/metadata, cleanup and independent
survival, including deferred close. LIMIT-only rebinding remains a retained-program
control. Representative replacement-planning work-limit failures now run before
publication, with retained plan identity, saved error reset/finalize, balanced
failed-entry accounting and independent survivor continuation. They do not claim
partial-allocation or every construction-failure branch; residual safety breadth
remains open. See [[card:card-s-j-c]] status for revision-bound evidence.
`AUTO_REAL_PROGRESS=1` interrupts automatic build after successful insertion and
probe after completed build/positive probes; standalone requires positive actual
FilterAdd with zero probes for build, positive FilterAdd/probes for probe. These
controls use the existing VM host-admission
seam, asserting exact public cancel/timeout, saved-error identity, refunds and
unchanged independently live SQL survival before retry/native-result comparison.
`AUTO_REAL_PAGE_FAULT=1` uses the existing arena hook to throw on second page
allocation; `AUTO_REAL_FILTER_FAULT=1` throws after filter byte reservation before
publication (automatic and standalone). Both require exact first/saved error,
release, survivor and successful retry. These serial source-owned research
controls restore transport/clock/hooks in finally; they add no production option
or testing registry. `AUTO_REAL_RECORD_FAULT=1` targets actual packRecord
backing allocation after a successful automatic insert through a serial restored
allocator proxy. `AUTO_REAL_CORRUPTION=1` traces actual collision-probe cell
consumption, then corrupts exactly a consumed pointer slot (format error) or an
observed unconsumed slot (native rows unchanged, damaged slot never parsed).
The native-first collision variant `--collision-payload-bytes 240` produces
nonroot selected-cell and entirely unconsumed-page witnesses in every encoding;
the original small fixture remains a leaf-root control. It retains the broad
index-pointer and untraversed page-one signature controls. These bounded
single-slot witnesses are not exhaustive corruption validation. Error controls require first/saved error,
full release, independent real survivor and native retry.
They add no production seam. Evidence and scope: `record:///status.md?card=card-s-j-c`.
`AUTO_REAL_CAPACITY=1` adds actual
maxBytes H−1/H/H+1 runs with all other limits nonbinding and a separate live SQL
survivor excluded. The same runner admits positive `inner` and `original`
(LEFT) receipts and asserts actual completed builds/inserts/seeks, zero postbuild
table lookups, positive record/scratch/Mem/payload/page highwaters and zero live
backing categories after release in every encoding. These are separate peaks,
not proof of simultaneous category maxima. H includes build and probe scratch, so H−1 may fail at a probe
after successful build but must precede any result row in these fixtures. Public
limit errors preserve the underlying PrivateStateLimitError cause and reset
returns the identical saved error. The same runner separately exercises
maxEntries and maxKeyBytes H−1/H/H+1 with other limits nonbinding. Their H is
the maximum policy demand across execution-owned consumers, not a sum of
per-cursor entry counts. Key demand includes both packed payload bytes and
unpacked seek Mem bytes; the larger representation can set H. Entry counts
include pending packed cells; balancing transfers must not count new entries.
The observations describe configured private limits, not total JS memory.
The same standalone fixture now exercises all three public capacity dimensions
against its actual filter/sorter owner and independently live survivor.
Shared snapshots additionally expose live/highwater `packedPages`: physical
4096-byte backing pages admitted by arena append and released by arena close,
including retained freelist/header pages and partial opens. They do not count
persistent source pages or JS heap; page renumber/reuse does not allocate again.
Partial-open and two-live-arena controls cover aggregate peak and surviving pages;
actual automatic progress asserts positive live pages and halt asserts zero.
Scratch/Mem highwater and exhaustive fault/lifetime schedules remain open.
The packed cursor's `withPayload` now reports `payloadScratchBytes` and
`payloadScratchHighwaterBytes` on its actual shared budget owner. This is the
await-owned payload copy (payload length plus the existing 64-unit charge), a
subset of aggregate bytes, not all scratch or Mem storage. Admission precedes
publication; callback failure refunds in finally. Native `btree.c:accessPayload`
uses caller storage; the TS copy bounds borrowed-page lifetime across awaits.
Focused paused-callback/error controls exercise positive live/highwater and
cleanup; actual SQL receipt controls require zero live payload scratch on release.
Absent-bit and collision-with-no-match probes need not read a payload through
this owner. The same budget also reports `scratchBytes`/`scratchHighwaterBytes`
for explicit arena cursor scratch, seek-prefix copies and MakeRecord conversion
overlap, including payload scratch as a subset (not a second aggregate charge).
`recordBytes`/`recordHighwaterBytes` separately track packed MakeRecord register
ownership through replacement, insertion consumption and halt. Admission still
precedes allocation; failed admission changes no counters. These are deterministic
admitted units, not a count of all live VM Mem or JS temporaries. Ordinary VM
register owned TEXT/BLOB backing now uses the same execution owner and reports
`memBytes`/`memHighwaterBytes`: copy/set admission precedes backing allocation,
borrowed/static bytes retain their producer owner, move transfers ownership, and
numeric replacement/reset/error/halt/finalize refund owned backing. Scalar slots,
bindings, detached temporary Mem and aggregate/rowset internals are not counted
by this category. UTF8→UTF16 conversion derives exact byte demand from decoded
JS code units and admits replacement overlap before encoding bytes; JS string
storage is not counted. UTF16→UTF8 admits and retains native `2*evenLength+1`
backing capacity before conversion; its logical result subarray retains that
allocation, so capacity and old/new overlap remain charged until replacement or
release. maxLength still bounds logical result length. Adopt producer allocation
remains publication-admitted and needs separate inventory. UTF-16 endian swap reuses
owned storage or admits borrowed/static copying before allocation.
Numeric stringify admits its exact ASCII byte demand before byte production
through the same Mem owner, refunding a failed producer; JS numeric rendering
and native reusable allocator capacity are not heap-accounted units.
UTF-16 endian translation follows pinned MakeWriteable then in-place swap:
owned backing is reused; borrowed/static backing is admitted before copying,
with odd trailing bytes preserved. Arena control, leases/raw
leases, revoked-view capabilities, derived overflow-cell staging, balance/transfer
controls and packed temporary copies now use this same scratch category. Packed
page backing stays aggregate-only with separate page counts; replacement overlap
is scratch. Admission and cleanup order are unchanged and payload scratch remains
a subset, not an extra charge. Temporary/conversion allocation completeness and
all-consumer capacity remain open; this is not native heap parity or full Mem acceptance. Owner regression
and evidence: `test/value/private-demand-observation.test.mjs`,
[[card:card-s-j-c]] status.
Ordinary two-physical-rowid INNER/LEFT SQL now enrolls native-costed automatic candidates and lowers selected descriptors to shared packed build/probe/covering execution. Independent standalone Bloom is enrolled for ordinary rowid INNER/CROSS persistent equality loops, including deeper-ready construction/pull-down. IPK standalone equality is now enrolled: build hashes Rowid, probe uses MustBeInt's no-match continuation before Filter and authoritative SeekRowid. Local LEFT and indexed IN filters now build at their own level; outer/IN levels are excluded from later grouped construction and pull-down, not from local filtering. Filter misses use the initiating next-IN/outer continuation, retaining LEFT null extension. Scalar child bindings and aggregate positioned-row callbacks now retain the same source-local build/probe ownership in the shared program; full-count and first-row-return controls cover both exhaustion and early child return. Physical standalone filters also coexist with retained derived producers: producer-owned sources are excluded as build targets, while physical builds/probes retain their source-level Once and continuation and materialized siblings keep their callable fill/reader identities. Exhaustion and ordered LIMIT-return controls cover a later independent materialized sibling. Independent materialized producer readers also admit native-costed automatic covering builds after their callable Gosub, with the ephemeral setup discount applied per producer rather than to physical siblings. This retains the existing Once, partial build predicate, affinity, packed covering and authoritative seek owners. Coroutine-to-automatic conversion, generalized bound consumers and finite safety acceptance remain unfinished. RIGHT drain is not a standalone-selection witness: its native Bloom belongs to separate match-membership/Found machinery, which TS still omits. See [[card:card-s-j-c]] status and [boundary evidence](research/where-autoindex-boundary.md) for exact current evidence.
The shared `PrivateKeyVmCursor` now supplies packed Seek*/Idx* bounds through
existing IndexSeekPrefix/IndexPrefixEnd dispatch, independently of exact Found/IN.
VM Rewind/Last, Next/Prev and Column also dispatch to the same packed cursor
first/last/next/previous/column owners,
including empty/nullRow handling; no decoded-row adapter is involved.
OpenEphemeral reuse clears content but retains existing KeyInfo for non-growing
width, as upstream does; it is not a rekey operation. Growth installs new KeyInfo.
Packed insertion accepts nonempty records narrower than retained KeyInfo, using
actual unpacked field count for positioning (native btreeMoveto); it does not
pad missing fields or require totalFieldCount equality.
Shared Mem filterHash and execution-owned charged FilterInit/FilterAdd/Filter
primitives are available; FilterInit represents native zero-filled Blob storage
with a separate private owner so ordinary Mem copies cannot alias mutable filter
state. Replacement prereleases that owner before new allocation admission,
matching native Blob/SetZeroBlob release-before-expansion; a failed replacement
fails execution rather than retaining or restoring old bits. Cancellation and
elapsed deadlines use shared execution checkpoints/first-error cleanup; no
private filter owner controls another statement's packed cursor. SQL consumers emit these operations. Lowering applies native
probe affinity to the live key registers **before Filter**, not only to the
private snapshot inside IndexSeekPrefix; build FilterAdd follows MakeRecord's
live-register affinity. Shared hash intentionally does not coerce by itself.
MakeRecord currently publishes a fresh packed Uint8Array instead of reusing
native Mem.zMalloc: replacement admits old plus new packed charges until
publication, then refunds the old charge. This bounded representation trades
higher transient capacity for simple immutable record ownership; it is not a
browser necessity or native allocation parity. Exact admission/reuse controls
are retained in [primitive evidence](research/where-autoindex-primitives.md).
Composed all-encoding VM controls cover mixed numeric/TEXT, REAL/IntReal, NULL/IS,
BLOB and collations, including authoritative rejection after a present bit and a
missing-prefilter-affinity negative control. Source-owned automatic driving-term
and declared-index quality admission plus native setup/run/output costs feed the
ordinary Btree candidate builder through an explicit internal lowering-capability
opt-in (`CandidateOptions.automaticIndex`). Automatic loops are inserted before
zero-setup alternatives, participate in native declared-equality replacement and
cost pruning, and reach the solver's actual smallouter gate. No SQL caller opts
in, so unlowered loops cannot displace executable SQL plans. Automatic ready-key/
covering/KeyInfo descriptors retain high-column colUsed expansion from driving
expressions even with empty caller covering requests; native bit63 expansion
includes duplicate high-key payload fields. Resolved nested residual/RHS
references also own that bit; an implicit high WITHOUT ROWID PK alone does not
append high payload. Generated-column references (stored or virtual) expand
colUsed to all table columns, including low payload and bit63, independent of
expression dependencies. INTEGER PRIMARY KEY caller coverage normalizes to the
single rowid identity tail rather than adding an IPK payload, matching pinned
rowidUsed versus colUsed and resolve/extraCols control flow (see
[primitive evidence](research/where-autoindex-primitives.md)). Automatic and
independent standalone Bloom descriptors retain explicit readiness/proof inputs. Native output adjustment now publishes immutable
`selfCulling` on ordinary loops from unused, exact-local nonvirtual terms, with
null-rejecting operator gates on outer targets. `standaloneBloomDescriptors(path,
enabled)` consumes that semantic owner directly; callers cannot inject a separate
proof set. The ordinary rowid INNER/CROSS persistent-index and IPK equality SQL producer enables independent standalone descriptors, builds ready later filters under the same Once (`where.c:sqlite3ConstructBloomFilter`), and consumes ready later filters before the first seek (`wherecode.c:filterPullDown`). Each consumed filter uses the initiating level's absent/NULL continuation and is omitted at its original level; dependent RHS waits for its source. Live affinity precedes hash and authoritative seek. Native independent/dependent three-source controls and current author evidence are recorded in [[card:card-s-j-c]] status. Native IPK controls cover heterogeneous local conversion, independent deeper-ready pull-down, and dependent CROSS JOIN placement after its prerequisite seek. The ordinary-JOIN dependent-IPK witness now uses the native ordered path and enrolls both filters: `wherePathSatisfiesOrderBy` requires carrying a matched rowid prefix across order-distinct loop boundaries, not discarding order after the first non-singleton loop. `where-plan.ts:joinedOrder` supplies that direct-column physical-rowid proof to the ordered solver; full scans and rowid ranges retain their local rowid direction even for multi-source ORDER lists. Expression-index and WITHOUT ROWID extensions remain conservative. The CROSS control remains an independent runtime continuation control. Range/frame standalone consumers remain unfinished. Indexed equality skip-scan now constructs all nEq physical fields (including skipped prefixes), probes locally only after prefix positioning and affinity, and skips nSkip in filterPullDown without suppressing ready grouped construction. This follows the separate native construction/consumer branches, not an algorithm substitution; [native-first bounded evidence](research/where-autoindex-boundary.md) covers two skip filters with local construction/probes separated by their authoritative seeks. Automatic SQL uses Once/OpenAutoindex, source-local safe build predicates, MakeRecord/FilterAdd/IdxInsert, live-affinity Filter and SeekGE/IdxGT duplicate traversal; covering Column and LEFT NullRow share the packed cursor owner. See [[card:card-s-j-b]] status for bounded native-FIRST evidence and outstanding resource/observation gates. With the matching resolved owner, descriptors retain
single-table partial-build predicates; virtual terms, other-source columns,
subqueries, volatile functions and unsafe outer-join provenance are excluded.
Collation/multipage prefix transitions now have direct cursor and VM dispatch
coverage across all encodings (BINARY/NOCASE/RTRIM, ascending/descending cursor
KeyInfo, forward/reverse dispatch and reset). This is primitive coverage, not SQL
runtime enrollment or full consumer/resource acceptance;
[primitive evidence](research/where-autoindex-primitives.md) bounds this delivery.
[Executable boundary and pending private work contract](research/where-autoindex-boundary.md)
provide native negative-bit/collision and semantic controls, not runtime acceptance.
The [beta.4 two-axis inventory](research/where-beta4-admission.md) is historical
7d9/W174/V19 evidence, not current input certification or a new MOST recommendation.
Current bounded71ad G84/K-f35 and e00e W186 reconciliation have separate applicability
in the linked decision; no fresh green509 or beta.5 closure is claimed.

Selected scalar uncorrelated SELECT-IN retains the linked resolved SELECT and
original parameters. expr.c candidate/uniqueness gates choose direct base-table
ROWID or compatible single-column UNIQUE physical RHS cursors; other cases
produce native-shaped SRT_Set into a UNIQUE private Btree. Physical RHS direction
is independent of the LHS direction and retains its own KeyInfo. Both paths
position/copy/skip NULL before selected LHS prefix/range seeks. Ordinary,
joined and recursive-OR slot callers share inside-out RHS advancement; seek/end
failure advances rather than rewinding the innermost slot. LEFT NULL guards
retain WhereEnd's initial unopened-cursor guard target; only EARLYOUT retargets
them past IfNoHope to movement after bypassed affinity. Both directions and
vector fields are covered in `where-in-loop.test.mjs` and
`private-in-left-continuation.test.mjs`. Joined equality-slot
admission publishes invocation-owned disableTerm state only for exact enforced
conjuncts at their prerequisite frontier: ordinary WHERE cannot be omitted on a
LEFT level; an owning ON conjunct can, before match/null-extension production.
Unrelated predicates remain residual. The [joined reuse evidence](research/selected-select-in-delivery.md#joined-direct-rhs-residual-ownership)
covers native typed/metadata and actual no-materialization controls. The
[physical RHS controls](research/selected-select-in-delivery.md#physical-rhs-coverage-promotion)
add native selected/offpath corruption and public synchronous DESC movement
cancel/deadline/reset/retry at zero private quota, plus selected two-branch OR;
they do not exhaust ROWID/ASC fault timing or arbitrary OR schedules. Private endpoint,
movement and Column dispatch precedes persistent dispatch, publishing jumps only
after success. Equality slots are produced and NULL-guarded in index order,
before later IN construction/positioning, following codeAllEqualityTerms; LEFT
null-extension bypasses RHS movement through its production nullPass guard.
SELECT-IN comparison affinity belongs to RHS production/eligibility: SRT_Set
coerces fallback values, while direct reuse requires compatible affinity. Seek and equality
prefix-end slots use BLOB/no-op affinity, as in codeAllEqualityTerms. Range,
ordinary equality and list-IN slots retain their own comparison affinity.
List-IN register iteration is retained.

Bounded native/public evidence covers forced/unforced scalar and range, two-slot,
INNER/LEFT/OR compositions, metadata, parameter clear/rebind and between-row
cancellation/reset/retry across three encodings. NULL-prefix early bypass has
native-backed ordinary/LEFT evidence. Non-SeekScan SELECT-IN slots after an
equality prefix now translate codeINTerm/WhereEnd SeekHit/IfNoHope: cursor-owned
hit depth is clamped at slot entry, raised by successful equality-prefix checks,
and tested before movement using a partial-key B-tree lookup. NULL skips this
check; LEFT null-extension skips both check and movement. Public native-backed
absent/present/empty/NULL, joined/LEFT, reverse and two-slot controls cover this
branch. Selected list-IN slots now share this prefix earlyout at the fused
non-NULL list-value boundary, retaining existing ordered-register production.
Physical DESC LHS coverage still needs dedicated evidence. Selected/off-path
malformed index pages and injected private-page admission/acquire failures now
have public retry/reset/finalize controls with measured zero retained private
ledger. These deterministic boundary injections are not browser allocator
exhaustion or malformed private-byte proof. Recursive joined OR has a selected affinity/typed-row witness,
not exhaustive composition coverage. Direct ROWID/UNIQUE ASC/DESC reuse has
three-encoding scalar/reset/source-gate controls, not the full lifecycle and
composition matrix. Selected vector prefixes and correlated frontier rebuilds have
bounded native-backed coverage described below; general vector-strategy and
composition completeness do not follow. These remaining gaps are not product exclusions. See
[scoped evidence and limitations](research/selected-select-in-delivery.md).

ON hit/match recording precedes ready non-ON WHERE constraints and downstream
positioning, including null/unmatched continuations. Nested SELECT dependencies
retain enclosing-source readiness. Selected rowid OR uses source-owned arms and
private dedup; selected persistent WR OR uses typed physical PK dedup.
Parameter-sensitive represented STAT4 programs retain bindings through bounded
reprepare; vectors/function/subquery costing probes and general plan parity are
not established. [Retained reprepare evidence](research/card-h-b-reprepare/README.md).

`whereexpr.c`, `where.c`, `wherecode.c` produce terms, candidate loops, paths and
loop control; `where-plan.ts` and the ordinary SELECT caller consume them.
Joined WHERE residuals are emitted at their ready loop frontier, not deferred
wholesale to the innermost row. OR branch-consumption assertions distinguish
independent outer restrictions from arm-local residuals: the outer predicate
runs once per admitted outer row, while a selected commuted child consumes its
original arm before the shared Gosub. `or-commuted-child.test.mjs` checks both
intervals, branch roots, typed native rows, error controls and reset.
Ordinary levels translate the pinned covered,
noncorrelated, then correlated-subquery passes: `WhereTerm.variableSelect`
retains resolver correlation independently of readiness masks, and coverage
walks this cursor's columns without entering SELECTs. Actual column consumption
substitutes available selected physical fields (including rowid tails) on both
covering and non-covering loops, leaving missing fields on the table cursor with
its pending seek. Semantic affinity/collation stay with the resolved column;
RIGHT shared-drain reads retain their primary-reader contract. This preserves rejection
and error order, not just scan cost. Existing LEFT match/null-extension and RIGHT
subroutine single-pass placement and LTORJ deferral remain authoritative. Correlated RHS
production still rebuilds at each required invocation; no cross-invocation cache
or residual deletion is used. Correlated EXISTS retains the shared UNION ALL
LIMIT: ready outer-only restrictions precede inner rewind, and a first-arm hit
skips later arms; an empty first arm still reaches required errors. Once and
reset remain distinct invocation owners. [Source and finite lazy/error controls](research/join-retained-compound-contracts-evidence.md).
[Frontier repair evidence and limits](record:///status.md?card=card-s-c-d-e).
`WhereClause/WhereTerm`, `WhereLoop/WherePath/WhereLevel`, BigInt source masks and
LogEst estimates retain dependency and join-barrier ownership. Output adjustment
reads the current syntactic RHS directly from the parser carrier (the analogue
of `Expr.pRight`), without allocating an operand inventory or memoizing borrowed
mutable graphs; progress checking still precedes the read. This preserves live
operand identity across calls. See [[card:card-s-f-b]] status for bounded
performance evidence; it is not whole-suite acceptance. The represented
solver uses the upstream bounded path-choice shape; it is not full optimizer
coverage. Alias/ordinal ORDER resolution occurs before immutable plan handoff.

Ordinary comma/CROSS/INNER/LEFT and represented repeated/mixed rowid RIGHT/FULL
barriers are admitted at the documented gates. ON belongs to match testing; LEFT null extension precedes
WHERE. Outer-ON conjunctions consume `whereexpr.c:sqlite3WhereSplit` base
terms in source order, with correlated (`TERM_VARSELECT`) terms deferred after
noncorrelated terms by `wherecode.c`. They do not branch on the original unsplit
AND: uncorrelated scalar-first error ordering therefore differs from correlated
scalar-first ordering. The full RIGHT-aware analysis owns these terms even when
matched access planning falls back. Within each unsplit term, joined predicate
AND/OR/NOT rejection follows the mutually recursive
`expr.c:sqlite3ExprIfTrue/sqlite3ExprIfFalse` branches: polarity and JUMPIFNULL
propagate through nested boolean operands, with `exprEvalRhsFirst` postponing
the sole subquery-bearing operand. Value-producing booleans retain three-valued
evaluation; callers retain one patched rejection continuation. Leaf predicates
use the existing expression compiler. Scalar comparisons combine both operand
affinities via `expr.c:codeCompare/binaryCompareP5/sqlite3CompareAffinity`, just
as vector fields do: either numeric column affinity selects NUMERIC; two
nonnumeric affiliated operands select no conversion; a sole affinity wins.
This preserves original projected storage values and applies conversion only
to comparison temporaries. [Cross-affinity repair evidence](research/scalar-comparison-affinity.md).
This is not full specialized comparison/TRUTH/BETWEEN branch-lowering credit. Native typed error/reset and
unchanged FULL gate receipts are in [[card:card-k-e]] status; bounded independent acceptance is attributed to parent
[[card:card-s]] status51 (G84/K-f35), not general expression-lowering closure.
RIGHT/FULL has per-barrier unmatched-row tracking/drain, using rowid
or the complete typed WITHOUT ROWID primary key (KeyInfo order/collation/encoding).
The RHS interior reads the primary reader, positioned by deferred selected access
or the active drain key; covering-only RHS binding stays disabled as in pinned
`where.c`. Up to three physical rowid tables with exactly one RIGHT/FULL barrier
(without USING/NATURAL) participate in matched persistent-index planning: LTORJ/RIGHT
prerequisites retain source order, outer ON admits only its RHS, and WHERE stays
post-match/null-extension. The match set takes physical rowid from the selected
index tail before WHERE, independently of deferred primary fetch. A two-source
rowid LHS / WITHOUT ROWID RHS RIGHT/FULL pair also admits selected matched access:
the secondary's complete physical PK positions the shared primary reader using
exact NotFound/continue, then feeds the existing KeyInfo match set. Wider barriers,
WR-LHS/multiple-WR/module selected matched access retain fallback; their existing execution is
not selected-access credit. No algorithm substitution or platform necessity is
claimed. [WR caller source comparison and finite author evidence](research/wr-matched-evidence.md)
tracks the two-source extension; bounded independent acceptance is attributed to
parent [[card:card-s]] status51/G84/K-f35. Fresh-drain invocation carries `WHERE_RIGHT_JOIN` semantics even after its source jointype is cleared: selected WR secondary access must use exact primary NotFound/continue, not deferred lookup; covering substitution remains disabled. Mixed storage-class composite PK, descending/NOCASE identity, physical-empty LHS, metadata/reset and native damaged/stale-secondary controls are mapped in `wr-boundary.test.mjs` and the linked evidence. Representative selected-RHS corrupt required/off-path and post-selected
execution/match-capacity cleanup controls are retained, not exhaustive composition
coverage. [Source comparison and bounded controls](research/right-matched-evidence.md).
The bounded three-source extension is independently accepted in
[[card:card-s]] [review18](record:///review.md?card=card-s&v=18), separately from
ROOT integration and general optimizer parity.
[Source/caller ordering argument, expression identity and native controls](research/three-source-matched-evidence.md).
Expression-index query leaves resolve against the designated source before schema
identity comparison; another alias cannot become that source. Nested COLLATE and
operator/function structure remain part of identity (no algebraic equivalence).
See
[WR source and finite evidence](research/recursive-join/wr-right-full-evidence.md).
Arbitrary
aggregate/correlation compositions are not implied. USING/NATURAL projection and metadata must
retain the semantic source selected by the resolver.

Selected index routes include represented rowid/ordinary, covering, expression,
partial and WITHOUT ROWID access. Eligibility/proof precedes consumption: collation,
affinity, real IPK identity, predicate implication, dependency and complete ORDER
terms/NULL flags cannot be inferred from a helper's successful example. Conservative
typed sorting remains for unproved nondefault-NULL ordering; no native BIGNULL
two-pass optimization claim. WITHOUT ROWID `NOT INDEXED` still traverses the
primary index layout, not a rowid table root. Loop continuation returns to
`scan.loopStart` including deferred positioning before projection; every new
DeferredSeek target invalidates the base-row cache. Preserve accepted selected
WHERE evidence, without general optimizer or plan-identity credit.

### Optional STAT4 loading and selectivity consumers

Numeric SQL tokens with separators pass through the source QNUMBER semantic
production before probe extraction and ordinary VDBE lowering. The parser validates
separator neighbors and retains raw lexical spans for names/errors while both
consumers see one normalized INTEGER/FLOAT terminal and its matching generated
semantic production. Lemon retains the actual QNUMBER parse trace/goto; a
parser-owned publication callback canonicalizes only that numeric reduction's
rule/signature, so structural resolver identity sees the same expression as the
plain spelling without relaxing other equality boundaries. This is the pinned
`sqlite3DequoteNumber` path, not string/affinity conversion or an alternate numeric
evaluator. [Bounded numeric evidence](research/card-s-h/NUMERIC_PRODUCTION.md).

Immutable schema loading retains represented sqlite_stat4 samples and selected
bounded costing consumers. Schema-owned padded records are acquired once;
internal scalar/probe readers borrow their identity through a module-private
WeakMap, while ordinary sample.p readers still receive defensive copies. This
is a TypeScript encapsulation adaptation to native IndexSample.p, not a new
algorithm or public budget: checked field/transcode reservations remain at their
existing consumers, with no per-read full-record clone. Loader-to-both-reader
allocation-order and retry evidence: [sample ownership](research/card-s-h/SAMPLE_OWNERSHIP.md).
Reprepare expiry uses the native low-slot/shared-high
mask shape and preserves bindings on failure/reset. Vectors/function/subquery
probes and general native cost/plan parity remain gaps. The represented
invalid-prefix scalar range path now uses native `whereRangeSkipScanEst` sample
counts through `stat4-skipscan.ts`, including close-bound fallback, not a general
histogram or a guarantee for every skipscan refinement. [Consumer review](research/card-s-h/d-diagnosis/MAPPED_REVIEW.md)
and [reprepare evidence](research/card-h-b-reprepare/README.md).

## ORDER, DISTINCT, compounds and VALUES

`select.c:selectInnerLoop`, `pushOntoSorter`, `generateSortTail`,
`computeLimitRegisters`, `multiSelect`, `multiSelectByMerge` own these paths.
Typed sorter/ephemeral destinations compare complete keys and payloads; DISTINCT
uses NULL-equal/numeric-equal set semantics. ORDER uses result alias, ordinal,
structural expression and then admitted source expression precedence; complete
collation/direction/NULL flags reach the consumer. Equal complete ORDER keys have
no public deterministic-order guarantee.

LIMIT/OFFSET lowering uses VM registers, not host statement fields. LIMIT is
coerced first; zero bypasses OFFSET evaluation/coercion and row production in
represented ordinary and compound SELECTs. `SELECT 1 LIMIT 0 OFFSET 'x'` and
`SELECT 1 LIMIT 0 OFFSET NULL` finish DONE, not datatype mismatch. Nonzero LIMIT
then evaluates/coerces OFFSET. Scalar/EXISTS destinations retain their SELECT-owned
normalization. [Source/native adjudication and correction provenance](research/card-u-rule-correction/README.md).
Negative LIMIT is unlimited and negative
OFFSET is zero. Ordered positive LIMIT bounds retention to LIMIT+OFFSET.

Structured VALUES compiles each retained row, validates every arm width, and
preserves arm-level set semantics. Compound collation searches result expressions
across arms using upstream ownership; no leftmost-default shortcut. Represented
scalar/set and table/CTE/aggregate compound branches use shared destinations,
including same-VM coroutine merge where implemented. Unordered non-ALL table
compounds use the shared full-key merge, following pinned multiSelect's invented
ORDER route; ephemeral replacement does not preserve its representatives.
Result COLLATE retains lookup/collation ownership but has expression naming and
no physical type/origin metadata. [Wide evidence](research/compound-wide-repair.md). Bounded JOIN/retained compound arms now use the same enclosing VM resolved
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


Bounded single-source,
full-row ordinary table set arms resolve retained WHERE and projection
carriers on their shared scan cursor; false/NULL predicates skip delivery. Shared
parameters retain lexical generated-terminal identity before LIMIT/WHERE lowering.
Explicit ORDER COLLATE set-rewrite metadata follows native rightmost type/origin
with leftmost names, separately from compound key collation. Tests and current
working-copy boundaries: [filtered compound evidence](research/card-j-d-b-a-c-filtered/README.md).
Unordered ordinary table UNION ALL arms scan sequentially. Ordered ordinary
and unordered non-ALL full-row table arms feed per-arm sorter coroutines and the existing
same-VM A/B merge owner; initial empty A ends EXCEPT/INTERSECT without evaluating
B, while UNION/ALL positions B. WHERE, projection and local DISTINCT remain
scan-owned, and lexical parameters and metadata retain their preceding owners.
The bounded merge is committed on MAIN; this is not general merge parity. The shared owner now splits maximal identical UNION/ALL suffixes
using SQLite's balanced split, copies independent LIMIT+OFFSET capacities only
for ALL, bounds leaf sorter retention and producer delivery, and charges each
visited merge/duplicate comparison term to the shared yielding work owner.
Mixed operators remain left-associated and set membership is not truncated.
Shared/table ORDER resolution now visits each arm's alias then expression
identity before proceeding rightward, preserving native precedence. Minimal HEAD-relative integration excludes unrelated metadata-TVF/schema changes;
exact committed-source and integrated bounded evidence is linked below.
[Revision-bound repair and attempted hypothesis evidence](research/card-j-d-b-a-c-filtered/MERGE.md).

### Surviving finite materialization adaptation

Some finite scalar/VALUES ordered UNION ALL and finite literal-parent set routes
still materialize through typed sorter/set storage. This is not the general
upstream merge algorithm: pinned `multiSelectByMerge` builds A/B bodies on the
**same VM**, with coroutine registers, PC/Yield/EndCoroutine and destination-driven
output/duplicate/EOF branches. TS now has that machinery and uses it in other
compound/retained-source paths. The former assertion that TypeScript lacks a
native resumable stack, or that avoiding unimplemented coroutines itself explains
a browser adaptation, is **historical and insufficient**.

The surviving tradeoff is bounded browser-resident private storage and finite
producer bookkeeping: retain typed keys, multiplicity, result metadata, admitted
ordering and LIMIT/OFFSET, while disclosing eager retention and different work,
error and suspension schedules. Planner's bounded disposition and finite export
proof are preserved in [[card:card-t]] records and
[finite disposition](record:///status.md?card=card-t&v=96).
This is not a ban on materialization (upstream also has legitimate materialized
destinations), nor permission to materialize arbitrary producers. The evidence
does not establish that these exceptional routes are necessary in TypeScript or
that native intermediate-error/work/suspension parity holds. Owning Planner should
refine the concrete route-specific resource rationale as those routes are next
consumed; do not invent approval or refactor the engine in this docs handoff.
Public limit/cancellation guarantees are unchanged.

## Aggregates and expression subqueries

Committed vectors preserve field width, typed comparison/NULL ownership and
multi-column IN destinations; scalar consumers remain width one. Selected
uncorrelated SELECT-IN now has identity-bearing field children and grouped RHS
cursor iteration with selected-slot projection/reordering before RHS KeyInfo and
construction (wherecode.c removeUnindexableInClauseTerms). Reduced ORDER result
references remap to selected slots; removed references retain original resolved
expressions, including clause COLLATE. GROUP ordinal/alias bindings retain their
original expression identity on every linked arm. The table sorter consumes
resolved references rather than rebinding raw ordinals to reduced width. Result
slots govern value reuse only: sorter KeyInfo derives collation from the resolved
ORDER expression, reapplying clause COLLATE over inherited result collation
(resolveAlias / sqlite3KeyInfoFromExprList). This applies to both reduced producers
and original full-tuple residuals; direction and NULL sort flags remain clause-owned.
[Projection evidence](research/selected-select-in-delivery.md#r14-result-reference-repair).
Physical UNIQUE RHS
mapping or shared UNIQUE SRT_Set deduplicates the projected keys, including partial
vector prefixes; the full tuple remains residual. OR arms reuse AND-owned field
analysis, preserving parent identity, and INDEXED BY constrains each recursive
branch rather than suppressing OR candidates. The physical OR caller uses the
shared linked subquery emitter for full-tuple residuals. Selected correlated
scalar/vector RHS sets rebuild at the chosen ready outer invocation, using the
original linked SELECT and caller source locations; EP_VarSelect suppresses Once.
Vector field children retain RHS prerequisite masks and cannot drive their own
dependency source. OpenEphemeral releases its previous private tree on reentry.
Parent tuple residuals and LEFT/ON fences remain conservative. Finite typed
LEFT ON/WHERE, OR, empty/rebind and awaited-movement interruption/retry now have
three-encoding witnesses including live-owner rebuild interruption/retry and
terminal owned-byte-accounting refunds; a bounded 20k-LHS selected/scan work contrast also
has native-first tests organized into three mandatory per-encoding files sharing
one unchanged workload/assertion body, with serial file60 passes. This is test
organization, not a runtime speedup; aggregate batch limits and historical timing
risk remain applicable ([evidence](research/selected-select-in-delivery.md#useful20k-same-work-organization)). Native-first selected-root
corruption witnesses now cover correlated CROSS/LEFT ON/LEFT WHERE/OR, saved
errors, reset/retry, owned-byte refunds and unaffected NOT INDEXED controls.
The bounded ordinary first-source derived route with one physical producer
resolves transient descriptors before source-identity substitution, qualifies
moved producer expressions without capturing nested local names, and retains
later caller SrcItems/join flags. The existing selected-IN native/public witness
covers typed rows, metadata and reset/rebind across encodings. Substitution
collects resolved compound-arm bindings and traverses every nested arm and its
semantic/reduction carriers (native `substSelect(...,1)`), without capturing
local aliases. Source-free compound IN dependencies enter the existing shared
SRT_Set producer rather than the scalar SRT_Mem fallback; flattening eligibility
and retained/window owners are unchanged. Ordinary scalar/EXISTS/IN child readers
and their Set destinations allocate distinct physical cursors from the enclosing
SelectProgramBuilder; resolver identities do not reserve live Parse.nTab slots.
This includes readers introduced by view expansion (`expr.c:sqlite3FindInIndex`
allocates its IN cursor with `pParse->nTab++`). Regression:
`select-scalar-child.test.mjs` nested view member and twice/reset cases, plus
`w172-owner.test.mjs` emitted reader/Set/DISTINCT cursor separation and all-encoding
native five-field metadata/error controls. [Validation evidence](research/w172-owner-evidence.md).
[Nested evidence](research/selected-select-in-delivery.md#nested-compound-substitution).
Joined retained DISTINCT, ORDER/LIMIT and GROUP/HAVING/aggregate producers over one physical source use
the existing resolved producer route: native coroutine eligibility selects yielding
versus callable Once materialization while physical siblings retain their identities.
Child ordering and row limits finish in that destination before parent predicates
or correlated selected-IN probes; flattening restrictions remain intact.
GROUP/HAVING and aggregate children dispatch to the existing AggInfo owner in
both unpublished validation and shared destination emission, not ordinary table
lowering. Group finalization/HAVING precedes Yield or ephemeral insertion.
[Grouped caller evidence](research/selected-select-in-delivery.md#retained-group-caller-repair).
[Retained-limit source comparison and finite evidence](research/selected-select-in-delivery.md#retained-orderlimit-caller-repair).
Expanded stars, broader derived prerequisite composition, resource bounds and
whole-goal coverage remain open obligations, not exclusions. Current evidence: [finite composition and faults](research/selected-select-in-delivery.md#correlated-finite-composition-and-fault-evidence).
This is not vector index-strategy completeness. See `expr.c:sqlite3ExprVectorSize`,
`sqlite3ExprCodeIN` and the [vector review](research/card-i-c-row-vector-review.md).
Generated dependency BUSY ownership flows through CASE/BETWEEN/IN-list and
aggregate argument/filter/order edges, not only binary expression children.

`select.c:updateAccumulator`, aggregate code generation, `resolve.c` aggregate
analysis and `func.c` callbacks own grouped/ungrouped state. Shared Mem operations
in `vdbe.ts` consume grouping keys, direct/sorter/saved column phases, aggregate
argument DISTINCT/FILTER/order, finalized leaves, HAVING and parent destinations.
Empty ungrouped aggregates differ from no groups; bare min/max column ownership,
INTEGER/REAL SUM/AVG/total distinctions and JSON subtype must survive publication.
No general AggInfo/analyzer completeness follows from bounded source/saved-phase
migration. Represented GROUP/ORDER/DISTINCT/LIMIT and join/derived/CTE compositions
are admitted only through their actual semantic branches.

No-FROM expression callers enroll retained derived/CTE source metadata through
`resolveTransientArm` before handing a linked plan to the aggregate owner;
transient aliases are not catalog tables. Immutable-view aggregate substitution
rebuilds the linked plan for the transformed SELECT while retaining the enclosing
builder/destination; pre-substitution expression carriers cannot bind replaced
column reductions. Producer LIMIT/OFFSET stays in the
coroutine, distinct from the consumer destination limiter. Focused evidence and
remaining composition gaps are in [the integration record](research/card-m-f-k-production-integration.md).

Retained single-source GROUP/aggregate producers, including zero-source GROUP
without an aggregate EList call, use the shared aggregate owner and
SRT_Coroutine feeding parent Mem/Exists destinations. GROUP is an aggregate
classification, not evidence of an EList function. Lexical aggregate modifier
edges survive alias/parenthesis normalization alongside canonical linked identity.
EXISTS validates its EList at prepare but observes presence without evaluating
its values; Mem returns the first admitted row or NULL. Physical unsafe scan gates
remain distinct from grouped sorter ownership. This bounded composition is not
arbitrary transient-expression projection or arbitrary compound admission.
GROUP sorters precede output LIMIT: reducing LIMIT alone does not reduce their
entry admission. Shared limits, saved errors, reset/rebind and refunds apply to
producer and consumer together. Source/control/native/resource evidence and exact
scope accounting: [GROUP delivery](research/retained-group-delivery.md).

`expr.c` scalar/EXISTS/IN lowering uses one VM, linked parent identity and phase,
conditional Once for uncorrelated producers and rebuild/reset for correlated
producers. `parse.y:seltablist` installs a derived source only from its immediate
`LP select RP` child; nested SELECTs in ON or table-function arguments retain
expression ownership. Correlated ON membership consequently reaches the linked
join resolver rather than independent derived-table metadata resolution. Source
and all-encoding scalar/vector/EXISTS controls: [R1 repair evidence](research/card-m-packed-independent-review.md#r1-repair--srcitem-production-ownership). Empty scalar is NULL, EXISTS is INTEGER boolean, and IN preserves
NULL/empty/negation semantics. Linked `compileWideSubquery` IN destinations now
use explicit packed KeyInfo, SRT_Set MakeRecord/IdxInsert and private BLOBKEY;
CodeIN probes exact non-NULL keys then traverses records for NULL fallback;
scalar fallback checks only the first sorted row (expr.c step 6), vector fallback
continues after definite field mismatches. InSet requires packed cursors: the
superseded borrowed membership evaluator has been removed, including aggregate
join-key/projection and table LIMIT callers. Auxiliary compound set cursors remain
separate consumers, not InSet fallback.
First/Next includes index interior records; payload snapshots and LHS copies own
charged scratch across awaits. MakeRecord predicts conversion scratch from
the Mem representation and requested affinity/encoding: no allowance for
no-conversion INTEGER/NULL/BLOB or same-encoding TEXT; actual numeric text
scanning/stringification and UTF translation remain admitted before mutation
and through packed admission. This is a conservative logical-byte bound, not
native heap parity. [Conditional admission matrix and coordination](research/card-m-conditional-conversion-admission.md). Public VDBE private control also supplies synchronous
snapshot work/cancellation/deadline checks before copying borrowed packed inputs;
copying cannot yield until the immutable snapshot exists, then insertion resumes
normal asynchronous checkpoints. [Large-input repair evidence](research/card-m-packed-independent-review.md#large-packed-snapshot-control-repair)
bounds this copy-before-await adaptation, not native allocation/latency parity. NULL fallback decodes exactly KeyInfo width with
RawRecordReader inside the payload callback, rejecting extra/missing fields without
an unbounded intermediate decoded array. LHS admission conservatively covers owned copy
plus UTF encoding expansion and numeric text scratch. Packed Set record temporaries
are dead after IdxInsert and refunded after awaited insertion, including errors;
non-Set packed callers retain their own register contract. Shared MakeRecord
admits conservative transient conversion scratch before live affinity/encoding
mutation, retains it through packing, and refunds it on every exit. Output/input
overlap rejects before mutation. Immutable replacement retains old and new packed
charges until publication; this is not native output-buffer reuse/accounting parity.
Conditional conversion admission is delivered in45bbacf0, with evidencec51719d4
and [bounded independent approval](record:///status.md?card=card-m-f-d&v=161);
[parent review](record:///review.md?card=card-m&v=28) retains the mechanism's
technical acceptance, not whole-lane closure. The
[28a admission/peak handoff](research/card-w-conversion-admission-handoff.md)
is historical failure provenance: its no-conversion concurrent charge is corrected,
not a pending owning-engine decision or a reason for cap inflation. Root/w
exact225, full-current and Chromium48 verification plus obsolete rejection-companion
reconciliation remain separate cross-owner obligations. Literal vector-list IN
also uses packed records, with statement encoding
installed at cursor admission and explicit packed ClearEphemeral reuse. Other
scalar/VALUES, aggregate and legacy LIMIT expression destinations now opt into
packed Set records too. Intermediate compound DISTINCT/set-operator cursors retain
their own borrowed contracts; they are not membership probes. Joined scalar IN with ordinary RHS LIMIT/OFFSET uses the same wide SRT_Set
producer as vector IN, preserving `computeLimitRegisters`/MustBeInt and the
LIMIT-zero-before-OFFSET branch. MustBeInt applies shared Mem NUMERIC affinity
before testing INTEGER, including decimal/exponent/whitespace text and lossless
REAL conversion; it does not independently parse integer text. The opcode's
optional nonzero P2 follows native `jump0`: unsuccessful conversion branches to
the supplied no-match continuation; omitted/zero P2 retains datatype mismatch
for LIMIT. Embedding relocates only nonzero P2. Primitive conversion/reset/error
coverage is in `test/value/must-be-int-continuation.test.mjs`; this does not yet
enroll IPK standalone producers or establish their native placement witnesses.
Int64 REAL
endpoints remain noninteger per `sqlite3VdbeIntegerAffinity`, unlike exact INTEGER
text endpoints. [Numeric-affinity repair evidence](research/card-m-packed-independent-review.md#mustbeint-numeric-affinity-repair)
retains native typed-row/error/reset controls and the bounded test inventory. NameResolutionError retains Parse's extended
code through every SELECT compiler boundary; missing collation is primary1/
extended257 (`callback.c:sqlite3GetCollSeq`), not an undifferentiated name error.
[Joined error repair evidence](research/card-m-packed-independent-review.md#joined-error-repair)
compares pinned phases, saved errors and recovery, plus valid LIMIT boundaries.
Representative public control/resource/refund and unpublished/published writer
ownership schedules are covered in the [independent review](research/card-m-packed-independent-review.md#verify-packed-writer-ownership-schedules).
No concrete practical joined-IN gap remains reproduced in this admitted slice.
These bounded checks do not establish exhaustive native allocation/error schedules
or general IN/storage/work parity; persistent/rowid/NOOP optimization remains backlog
where the correct packed route exists. Current attempt and test limitations: [[card:card-m-f-k]]
[status](record:///status.md?card=card-m-f-k); see also
[API admission](api.md#current-sql-admission) and
[native-first packed membership evidence](research/card-m-packed-membership.md).

## Derived sources, views and CTEs

`select.c:flattenSubquery`, coroutine/materialized SrcItem branches and
`resolve.c` own retained sources. `cte.ts`, resolution and shared SELECT lowering
retain names, lexical scope, descriptors and destinations. Flatten only where
semantics are preserved; otherwise an admitted producer feeds coroutine or private
materialization with independent reader positions. Child LIMIT/ORDER and parent
LIMIT/ORDER are separate owners. Views preserve explicit/inferred column names,
collation and origin. No nested public Statement or native fallback is used.

`CtePrepareContext` records With/Cte use, scope and materialization decisions;
recursive ownership is not guessed from a table-name string. Ordinary WITH admits
represented flatten/coroutine/materialized/repeated-source routes. Recursive
`generateWithRecursiveQuery` lowering uses iterative Queue/Current state, setup,
duplicate tracking, queue ORDER and body LIMIT/OFFSET distinct from outer consumer
limits. Recursive aggregates and windows are consumers, not permission for
aggregates/windows in the recursive term. A recursive declaration (including repeated outer aliases) joined to
physical tables or its other aliases uses a retained insertion-order ephemeral destination feeding the
shared WHERE loops and AggInfo (including GROUP/HAVING); producer queue order,
deduplication and LIMIT remain separate from consumer controls. This physical-only
specialization declines outside its admission before resolution or builder mutation,
so represented derived-input and multiple-recursive-declaration consumers retain
their semantic owners; selected compilation errors remain terminal. INNER/CROSS
and LEFT consumers in either source order use the same retained cursor. Shared
LEFT lowering resets match state per outer row; handle-local NullRow makes
private Column/Rowid reads NULL until repositioning, without deleting producer
records. OpenEphemeral/OpenDup start null-row independently; Rewind sets the flag
from emptiness, Next sets it on exhaustion, and completed integer SeekRowid clears
it even on a miss (whose caller takes the failure jump). Shared clear/sort invalidates
positions but preserves each handle's flag; callers rewind before reading.
[Cursor branch evidence](research/recursive-join/left-evidence.md).
Repeated aliases share one producer/storage lifetime and use OpenDup handles with
independent reader positions and NULL state (select.c CteUse tag-select-0484).
Retained recursive readers support RIGHT/FULL on either side through the existing
per-barrier WHERE owner. Match and drain use the same insertion INTKEY identity
(`Entry.sequence+1`), not values or scan positions; retained binding suppresses
physical reopening and producer replay. Unrepresented joined compound/window
shapes remain temporary gaps. [Bounded evidence](research/recursive-join/right-full-evidence.md).
The represented recursive physical INNER
join plus row_number window is supported, not a missing-feature prediction.
[Repeated-reader source comparison and evidence](research/recursive-join/repeated-evidence.md). Materializing this retained input charges all producer
rows before consumer output; it does not promise streaming latency or planner
parity. [Source comparison and evidence](research/recursive-join/README.md).

## Bounded recursive JOIN-arm compounds

Same-operator UNION/UNION ALL consumers admit recursive INNER/CROSS/LEFT arms and physical arms through the existing full-row compound merge. One lazy Once-guarded retained recursive producer supplies independent OpenDup readers; Queue/Current retains body controls while the compound owner retains outer ORDER/LIMIT, arity and full-row duplicate semantics. Leftmost setup-expression collation is independent of rightmost metadata provenance. Materialization charges the full requested producer before its first row; this is not streaming or native work/allocation parity. Mixed operators, grouped/window/derived arms and additional recursive declarations remain temporary gaps in this route; RIGHT/FULL and physical producer-term joins remain outside this slice.

`test/conformance/recursive-cte-compound.test.mjs` and [source comparison and finite native/public evidence](research/recursive-join/compound-evidence.md) cover this boundary, without additional upstream assertion credit.

## Windows and private storage

Current registered bounded frame paths retain pending input/end-peer ownership,
independent current/start/end positions, EOF-before-inverse and deletion before
Next. RANGE offsets use typed Mem int64/overflow and storage-class/collation
comparison, PRECEDING precompare and BIGNULL before DESC, not Number coercion.
Generated sort copies retain sourceExpression identity for resolution while copy
owns integer-to-NULL adaptation. Compatible cache-required value/EXCLUDE routes
remain retained; other schedules are not certified. Exact allocation witnesses
are logical accounting evidence, not universal native minima. [Owner correction](research/card-s-i/window-owner-correction.md).

Explicit packed KeyInfo selects the private BLOBKEY arena; MakeRecord owns its
serialized snapshot, Insert/balance consumes it, and selected persistent WR
Case5 consumers deduplicate physical PK keys after residual tests. Legacy
iterator/IN/window consumers are not wholesale migrated. Private overflow copies retain the
native acquire/checkpoint/copy/unref sequence. A module-private WeakMap associates
borrowed views with synchronous, revocation-checked bulk copies; only owned cursor
scratch is a destination. No raw buffer is exported, no borrow spans a new await,
and public readonly views/subviews remain charged and revoked. This removes
per-byte Proxy dispatch, not page traversal, validation or work accounting.
[Copy owner evidence](research/card-s-i/private-blobkey-copy-capability.md). [Selected consuming
boundary](research/card-s-i/source-owner-comparison.md) and [acceptance matrix](research/card-s-i/acceptance-matrix.md).

`window.c:sqlite3WindowRewrite`, `sqlite3WindowCodeInit`,
`sqlite3WindowCodeStep`, `windowCacheFrame` and frame helpers own rewriting,
partition/order keys, input coroutine, buffer duplicates and endpoint scheduling.
`window-rewrite.ts` plus shared `vdbe.ts` lowering execute represented ordinary
aggregate and special builtin windows. Compatible windows share rewritten input;
incompatible layers retain their own ordering. Grouped, join, derived, ordinary/
recursive CTE and outer ORDER/LIMIT compositions are bounded admissions, not
blanket gates. Recursive grouped input rebuilds generated projection result
carriers by expression identity after lifting correlated terminals; ephemeral
recursive columns do not acquire physical schema provenance. [Pinned parity
and repair evidence](research/recursive-group-window/README.md).
Retained multi-source CTE/module input feeds the existing Window coroutine on
its shared compiler owner; direct transient column names use resolved producer
names, not qualified SQL spans. Standalone single-source JSON each/tree Window
input also uses the shared WHERE coroutine with source-identity registers and
independent rowid; arbitrary module/Window composition is not implied.
[CTE composition evidence](research/cte-json-window-composition.md) and
[direct-input scope and evidence](research/direct-json-window/README.md).
Cached frame/EXCLUDE scheduling is a source-shaped adaptation, not
proof that every frame must stream.

Private entries/sequence identity are shared across OpenDup cursors; positions are
independent. Endpoint seek remains a controlled **linear** async lookup, unlike
pinned Btree seek. `private-state.ts:seekRowid` receives PrivateStateControl,
checks before/after and charges/checkpoints each visited record, rechecks liveness
after suspension, then publishes position only on success; VM awaits it. This
restores budget/cancel/deadline/admission guarantees without native complexity
parity. The former synchronous uncontrolled findIndex acceptance is superseded.
Reset/cancel/failure releases state; missing nth endpoints and empty partitions
retain NULL behavior. [Endpoint repair evidence](record:///status.md?card=card-t-d&v=456)
contains primitive and actual public large-partition controls. Direct concurrent
mutation during an async private operation is not an approved contract.

## VM host delivery

VM-owned `VdbeHostAdmission` separates real host task admission from deterministic
per-unit work/cancel/deadline checks. First/reset admission is immediate (clock0
is valid); later admissions use4ms admission-start spacing, including pending task
time. Regressed/nonfinite clocks admit conservatively. This reduces task/Promise
overhead, not a native algorithm substitution or hard latency/fairness guarantee.
`ExecutionTaskScheduler` still delivers an actual task per call, periodic timers
and port cleanup unchanged. The selected-OR cancellation test holds an actual
production task suspension for a controlled timer-delivered abort; it does not
assert timer-before-port ordering or first-step timer fairness.
Private comparison/merge await only genuine pending
checkpoints; comparisons, stable choices, charges and publication order remain.
[Source comparison, tradeoffs and bounded evidence](research/card-t-d-vm-admission-disposition.md).
Deterministic [private continuation regression](../test/select/vdbe-private-continuation.test.mjs)
observes the production VM control through sorter insertion across alternating
pending/void checkpoints, with exact work probes and saved-error/reset cleanup;
a separate mixed comparison/merge probe checks stable publication and accounting.
These bounded injections do not establish host latency or native allocation parity.

## Functions, text and JSON

`func.c`, `printf.c`, `date.c`, `json.c`, `utf.c`, `vdbemem.c` and comparison
routines map to `functions.ts`, `ordinary-scalars.ts`, `pattern.ts`, `printf.ts`,
`date-time.ts`, `math.ts`, `json.ts`, `utf.ts`, `mem.ts`, `comparison.ts`.
Registry arity/flags and VM Function dispatch own execution; no host callback or
native fallback. The private date environment samples lazily per VDBE step entry,
not per reset or async continuation. Shared current-time production sets UTC
provenance and requires positive iJD. Constant/slow-changing calls with constant
arguments retain results through `Once`; this is distinct from clock stability.
See [controlled native/public admission evidence](research/card-q-a-a-provider-admission.md)
and `test/conformance/run-date-time-provider-ts.mjs`. Virtual-generated bindings
now retain self-reference context through PureFunc/P5 to FunctionContext and
reached date eligibility checks (including localtime/utc before provenance bypass).
The private adapter maps clock acquisition failure to invalid current time and
rejects unsafe local years without swallowing VM errors. Failed acquisition is
not cached: later date calls in the same entry retry, as native zero iCurrentTime
does. Clearly nondeterministic registrations are rejected during generated schema
resolution, including unreachable branches; conditional date calls remain legal
until reached. `strftimeFunc` coerces the format and returns on NULL before
`isDate`, so an unreached date dependency cannot acquire providers or raise
conditional nondeterminism; SQL argument expressions still execute normally.
Date admission uses private-copy `Mem.valueText` (including BLOB carrier encoding
and SQLite numeric spelling), except INTEGER/REAL date arguments enter raw-number
state directly. Date/format parsers own C-NUL termination. Pinned `parseModifier`
receives the byte extent but overwrites it before consumption; its own string
scans terminate at NUL. `setRawDateNumber` and unixepoch/auto validate native ranges
before integer conversion, retaining unresolved raw seconds for NULL rejection.
The shared `isDate` owner completes modifiers, JD/range admission and single-argument
calendar normalization. `timediffFunc` completes operand one before admitting
operand two, without suppressing VM argument-expression evaluation or reached
second-operand purity/provider errors.
[Argument admission evidence](research/card-q-a-b-date-admission.md) records typed
encoding/carrier and range diagnostics separately from selected corpus credit.
The constant-expression walker retains CASE/BETWEEN/IN/vector
children while excluding columns/registers/subqueries and volatile calls, matching
expr.c ownership rather than SQL spelling. Bounded three-encoding generated
metadata/nested/STORED controls and real-task cache tests pass; these are not
schema-wide or exhaustive constant-expression equivalence claims.
See [repair evidence and remaining delivery work](research/card-q-a-b-provider-repair.md).
Preserve source numeric coercions, overflow, ASCII-only built-in
case folding, embedded-NUL rules, collation and database-encoding conversion.
JS Date/RegExp/JSON.parse/stringify are not substitutes for translated semantics.


Enabled math uses `Mem.valueNumericTypeCopy` (`vdbe.c:numericType`), not NUMERIC
affinity. INTEGER rounding inputs remain INTEGER; callback doubles produce REAL
and NaN becomes NULL. Binary log converts its second operand with value-double
only after base/domain gates. ECMAScript Math replaces host libm in the browser;
finite transcendental last bits remain host-dependent, not cross-libm guarantees.
The accepted corpus is 23 cases/69 typed observations in three encodings;
30 registration rows/29 names remain enabled. Date selected credit remains
29 assertions (18 upstream +11 controls), public40/120; admission117/234 and
provider/generated controls earn zero added corpus credit.
[Combined delivery provenance and affected validation](research/card-q-a-b-combined-r3.md).

Represented ordinary, formatter, pattern, date/time and enabled math functions
execute; read-only changes/last-insert counters remain zero. JSON scalar,
aggregate/window and bounded eponymous each/tree sources are present. JSON TEXT
uses private subtype 74; SQLite JSONB is subtype-0 BLOB, not PostgreSQL JSONB.
`json_type` and `json_array_length` share document-first admission and reached
private SQL-to-TEXT path coercion with extraction; NULL paths cannot mask a
malformed document. Missing paths return NULL; non-array length is zero.
The same private coercion primitive handles edit paths and numeric inputs to
validity/error-position inspection without mutating caller Mem storage classes.
Only paths use C-string termination. Quoted path labels are raw spans with escape flags, not strict JSON string values. Shared read/edit/table-root lookup compares original label payloads using jsonLabelCompare raw/escaped branches; mutation retains producer label tags and defers TEXT rendering until output. [Source comparison and finite evidence](research/card-r-b-quoted-path.md). [Source comparison, bounded caller audit and
typed evidence](research/card-r-b-scalar-admission.md).
Ordinary extraction and arrows share `jsonExtractFunc` in TypeScript: document
admission precedes sequential private Mem path-to-TEXT conversion, lookup and
result/error handling. A reached NULL path returns NULL without examining later
paths; it does not mask an earlier document or path error. Single-path containers
retain JSON subtype only for ordinary TEXT extraction; JSON_BLOB produces BLOB
directly for single-path containers. Multipath JSON_BLOB follows upstream's
JSON text accumulation and reparse before binary output; missing values become
JSON null. Numeric nodes retain the producer's INT/INT5/FLOAT/FLOAT5 header and
raw payload. Scalar return and json_type consume that header, not a spelling
heuristic; text rendering and binary encoding remain separate consumers.
[Numeric source comparison and finite typed evidence](research/card-r-b-numeric.md).
[Extraction evidence and boundaries](research/card-r-b-extract.md).
Arrows translate `jsonExtractFunc` JSON_ABPATH: parse the document first,
convert a private path Mem to TEXT while retaining its original storage class,
preserve full dollar-prefixed paths, then produce INTEGER indices (negative
from-end), alphanumeric labels, bracket abbreviations or quoted labels. Lookup
errors name the original path. Only private semantic path errors qualify for
that diagnostic rewrite; arbitrary control failures retain identity. Recursive
table-root parent discovery follows jsonEachPathLength candidate/payload
identity, skipping only semantic lookup errors. Array-insertion contextual errors
use a distinct private sentinel. Lazy sentinel-class initialization avoids the
demonstrated public index/VM/JSON module cycle without changing public error
ownership. [Finite source/caller evidence](research/card-r-b-lazy-jsonb-delivery/root-parent-errors/evidence.md).
`->` returns JSON-subtyped TEXT; `->>` returns SQL
values with no container subtype. VDBE dispatch checks result size like extraction.
[Source comparison and finite typed oracle evidence](research/card-r-b-arrow.md).
JSON sources expose eight visible fields; hidden json/root are explicit-only and
retain empty declared types. Resolved direct columns publish virtual-column
metadata; aliases override, computed names retain exact expression spans. JSON
row extraction preserves INTEGER/REAL and storage classes through grouping.

The bounded two-source physical-left/JSON-right INNER/LEFT consumer uses ordinary
resolved USING/NATURAL ownership: hidden fields are not NATURAL keys, unqualified
shared names and stars retain left ownership, and generated equalities keep left
affinity/collation at the ON barrier. Resolved SrcItem identities survive explicit
reductions, stars, ORDER and child SELECT linking; lazy JSON columns register demand
at each binding location. Result descriptors retain source metadata. RIGHT/FULL
and reverse correlation remain temporary gaps on this route.
[Source comparison and bounded regression evidence](research/json-mixed-using/README.md).
The bounded physical-left/JSON-right CROSS/INNER/LEFT producer rebinds arguments
per outer row. Mixed predicates resolve against the complete physical/virtual
visible and hidden source scope before scheduling, preserving ambiguity errors.
INNER/CROSS AND terms whose resolved source identities are outer-only run before
opening the inner cursor; terms requiring inner fields remain residual and run
once at their owning phase. This bounded two-source prerequisite lowering applies
to JSON and metadata sources alike, independently of ORDER/DISTINCT/LIMIT.
LEFT deliberately retains ON at the inner match phase, records matches before
WHERE, and clears every visible
and hidden JSON field for an unmatched row. Rows feed existing AggInfo input
registers/group sorter, including FILTER and aggregate projections, not a
parallel evaluator. Mixed projection ORDER/DISTINCT/LIMIT lowers candidates through
ordinary KeyInfo/sorter/destination consumers: DISTINCT precedes sorting and
OFFSET/LIMIT gates delivered rows. Unprojected keys and result aliases/ordinals
are represented; shared bounded-memory sorter limits remain, not native
spill/top-N resource equivalence. [Ordered evidence](research/card-r-d-ordered-consumer.md)
and [prerequisite/error-order evidence](research/card-r-d-readiness.md), with
[full-scope resolution evidence](research/card-r-d-resolution.md).
RIGHT/FULL/NATURAL/USING/reverse correlation remain temporary
unsupported in this route. Cursor offsets use encoded container header widths
and retained label encodings; binary input preserves original bounds. COLLATE
keeps direct-column naming but has null declared type and origins, separating
select.c naming from columnType production. [Scoped integration evidence](research/card-r-e-mixed-json-verify.md)
bounds typed public/oracle comparisons and lifecycle schedules; it is not
exhaustive JSON or virtual-table-planning parity.

`json_pretty` has accepted bounded delivery `f1eb053` (arities 1/2, default/custom indentation, subtype-0 TEXT, cooperative work/output/private-state controls). The incorporated baseline already retains the exact accepted pretty/scanner source from `f1eb053`; this change adds only the reviewed mixed cursor/identity/metadata corrections, with no pretty implementation changes. Host extensions and
external virtual-table modules remain SPEC exclusions, not an excuse to exclude
built-in JSON.

## Grouped internal JSON identity metadata

Schema-owned built-in JSON virtual sources retain `main`/module provenance even
without a btree root. Mixed aggregate saved-phase direct rowid outputs use the
original resolved source: INTEGER and canonical rowid origin for JSON, or the
physical table's IPK alias when present. Output aliases change names only;
computed expressions and unlinked ephemeral producers retain unknown origins.
LEFT NULL extension changes storage classes, not these prepare-time descriptors.
No public module registration or generic origin inference is introduced.
[Source comparison and scoped metadata evidence](research/card-r-d-grouped-rowid-metadata.md).

## Remaining debt and bounded handoff

This guide consolidates accepted bounded contracts, not universal compatibility.
Unrepresented grammar/compositions, full semantic analyzer relationships, broader
optimizer/index proofs and native intermediate scheduling equivalence remain
visible roadmap work. Historical predictions are verified at the next consuming
slice. No new implementation, compatibility credit, whole-project completion,
operator/configuration changes or all-project cleanup gate is authorized here.

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


### Bounded metadata module declarations and callers

All seven families enroll genuine module declarations from `METADATA_MODULE_COLUMNS` before name/aggregate resolution, with registry-derived hidden fields (none for database_list). MetadataFilter/Next consumes the shared direct-PRAGMA catalog traversal, appending only declared hidden fields. Connection-owned resident database descriptors are refreshed before SELECT compilation; temp activation is reflected on subsequent scans, never shared between connections. Mixed metadata uses one canonical visible projection for stars, ORDER ordinals/aliases, result metadata and output width; sorting remains real shared sorter storage. This restores existing bounded producers/callers, not a replacement algorithm or general virtual-table planner claim. [Repair evidence](research/card-m-f-k-production-integration.md#metadata-family-restoration).

`pragma_index_list`, `pragma_index_info`, `pragma_index_xinfo` and `pragma_foreign_key_list` share direct-PRAGMA catalog traversal and existing statement-owned metadata Filter/Next/Column state with table_info/xinfo. Hidden arg/schema retain empty declared type versus NULL visible type, normal runtime binding/reset and physical-left correlated schema joins with explicit projections. Qualified metadata identity remains temporarily unsupported; JSON/physical rowid ownership is separate. Mixed metadata stars expand visible fields in source order, excluding hidden arg/schema. Sole-source `pragma_database_list` has zero hidden slots (Result0), max arity zero, and consumes resident main/explicit-empty-temp descriptors; filenames remain empty text by the immutable-memory API boundary. Joins involving database_list remain temporarily unsupported. This is not generic vtab admission. Native evidence and precise boundaries: [index/FK TVF evidence](research/card-e-n-pragma-red/TVF-INDEX-FK.md).


### Standard declared-type metadata

Standard declared types use exact case-insensitive sqlite3StdType matching after dequote; custom spelling is retained, no-type/expression metadata is null. build.c eCType/HASTYPE and util.c sqlite3ColumnType own this distinction, not blanket uppercasing. [Native boundary evidence](research/card-k-c-declared-type/README.md).

## Generated REAL opcode ownership

Generated REAL output uses OP_Affinity/OP_TypeCheck post-applyAffinity integer conversion: exact IntReal within the inclusive signed six-byte range, double outside. Shared comparison Mem.applyAffinity remains unchanged; generated IfNullRow/BUSY/register precedence is retained.

[Isolated candidate evidence and remaining boundaries](research/card-t-generated-real/README.md). Candidate pending independent review; not MAIN incorporation.

### Positional stat1 range ownership

Represented skipscan uses the shared WHERE candidate/positional-prefix consumers,
not a precomputed distinct-prefix evaluator. Linked NOTNULL virtual bounds retain
their parent dependencies and suppress ordinary SQL NULL guards; zero-key starts
use Rewind/Last and already-positioned skipped prefixes avoid redundant seeks.
Current source/control mappings and bounded caller exclusions are in
[Linked NOTNULL range owner](SQLITE_SOURCE_MAP.md#linked-notnull-range-owner) and
[the public contract](api.md). [Owner evidence](research/card-s-g/IMPLEMENTATION.md)
preserves historical disabled-caller checkpoints separately from current paths;
[bounded integration evidence](research/card-w-current-integration-outcome.md)
does not imply general optimizer or STAT4 sample parity.


## Direct JSON Window input

Single-source JSON each/tree Window inputs now consume the original shared WHERE
coroutine with source-identity register locations and independent rowid, rather
than B-tree Column/Rowid. Existing window rewrite/frame owners remain unchanged.
This is bounded progressive admission, not arbitrary module/window support.
Pinned metadata/typed rows and reset comparisons:60 variants/180 native runs;
no new upstream assertion credit or denominator change. Direct controls include
admission and suspended cancellation/deadline recovery. See
[finite evidence](research/direct-json-window/README.md).

### JSON parser and validator depth ownership

TEXT nesting counts object/array productions only; scalar leaves do not consume
a level. The pinned limit accepts1000 containers and rejects1001. JSONB render
starts at depth0, while json_valid strict flag8 starts at depth1 as in
`jsonValidFunc`;1000 arrays around null render but fail strict validation.
This is not a universal eager-validation policy. Minimal header threshold,
encoding, lifecycle and native comparison evidence: [boundary correction](research/card-r-a-json-boundary-green.md).


JSON paths are consumed one reached step at a time by `pathStep`, shared by
read lookup and edit traversal. `jsonLookupStep`'s ordering is retained: dot labels
are parsed before object shape checks, bracket shape checks precede index parsing,
and NOTFOUND returns without consuming the remaining suffix. Missing-container
construction receives the unparsed tail. Within a bracket step, bounded decimal
accumulation follows `jsonLookupStep`: a from-end distance exceeding the current
array length returns NOTFOUND before closing-delimiter validation; ordinary
numeric indices and in-range/zero from-end distances validate `]` first. Thus
unreachable suffixes do not error; reached syntax errors still do. Extraction,
type/length, arrows and TEXT/JSONB edits share these transitions; regressions:
`json-path-reachability.test.mjs` and `json-from-end-delimiter-order.test.mjs`.
[Native boundary evidence](research/card-r-b-path-reachability.md) and
[[card:card-r-b]] status record the finite verification boundary.
JSON edits translate `jsonLookupStep`/`jsonCreateEditSubstructure` missing-label
and array-end creation in the shared private copy-on-write node owner: choose an
empty object/array from the remaining path, recurse, and publish only on success.
Absent out-of-range descendants leave no empty shells; existing scalar shapes
are not promoted. Private nodes replace native byte-buffer splicing, with copied
ancestor arrays rather than in-place size-delta adjustment; this is a representation
tradeoff, not browser necessity or an alternative evaluator. Focused regression:
`json-missing-edit-substructure.test.mjs`; scoped evidence: [[card:card-r-b]] status.
Merge patch uses a private editable JSONB buffer, translating `jsonMergePatch`'s
per-member first-match scan, single NULL deletion, recursive delta save/restore,
append and header-size adjustment. `jsonBlobOverwrite` preserves extent by widening
replacement size headers when native can absorb a small shrink. Raw labels and
untouched payloads remain byte slices, not decoded/re-encoded objects. TEXT input
uses the shared parser/encoder; admitted JSONB is checked incrementally along the
merge path. Target parsing precedes SQL-NULL patch handling; recursive calls use
the native depth guard. Both TEXT/JSONB functions share this owner. Labels compare
as byte spans (raw memcmp or incremental native escape/UTF-8 reading); TEXT output
translates `jsonTranslateBlobToText` into owned Mem UTF-8 bytes, not JS strings.
Byte consumers such as hex preserve invalid UTF-8 before the public JS-string
adapter's lossy decoding boundary.
[Merge-patch evidence and limits](research/card-r-b-mergepatch.md) records finite
native comparisons and remaining malformed/resource validation boundaries.
`json_valid` follows `json.c:jsonValidFunc`: int64-coerce and validate flags
1..15 before document NULL/type dispatch; NULL flags coerce to zero and error.
The focused public flags-order regression also checks TEXT/REAL/BLOB flag
coercion, NULL result metadata, and reset/reuse (`json-valid-flags-order.test.mjs`).

### Shared JSONB validation and error production

`jsonbValidityCheck` owns byte grammar and absolute 1-based error offsets;
`json_valid` deep flag8 and `json_error_position` consume the same return at
depth1. Superficial flag4 trusts `jsonArgIsJsonb` admission, including its small
ambiguous-BLOB deep check; other BLOB documents retain TEXT/JSON5 fallback.
Validation does not decode/render a tree: raw TEXT bytes, nonminimal headers,
INT/INT5/FLOAT/FLOAT5 grammar, escaped payloads, label/value alternation,
truncation and depth offsets follow pinned `json.c`. The unescape length/status
projection includes resumable recursive line bypass, non-validating nibble conversion and
12-byte surrogate-pair consumption; outer Unicode grammar still checks four hex
digits independently. Limited UTF-8 reads consume at most four bytes, not an
unbounded continuation run. [Finite branch evidence](research/card-r-a-jsonb-unicode-green.md); [nested bypass control evidence](research/card-r-a-json-text5-progress.md). Decode/render remains a
separate demand path, not a validity or error-offset oracle. TEXT error offsets
still convert the existing parser's character production; BLOB offsets are bytes.
[Finite native/public comparison, control branches and limits](research/card-r-a-jsonb-validation-green.md).

### Numeric JSON production

Parser.numeric translates jsonTranslateTextToBlob sign/zero/hex/dot/exponent
control and error production. Raw spelling reaches shared numeric consumers;
jsonErrorPosition converts produced character indices, not token guesses.
Trailing-junk errors retain initialized offset0 as jsonConvertTextToBlob does.
[Finite native/public evidence and timing qualification](research/card-r-a-numeric-green.md).

### JSON table Filter admission/root ownership

`JsonTableRewind` passes root Mem without coercion. `openJsonTableCursor` follows `jsonEachFilter`: admit/parse document first (NULL is empty), then privately convert root with the existing SQL-text helper, stop at C NUL and validate/lookup. BLOB conversion preserves source encoding; caller registers remain unchanged. Hidden root is the converted lookup string; hidden json retains its owning input. Demand/metadata/traversal contracts are unchanged. [Source comparison and finite evidence](research/json-table-root/README.md).

Full-row ordinary table lowering resolves expanded ELists before equal-width checks, owns contiguous result registers, per-column metadata/collations and full-row DISTINCT/set destinations. Retained arm links identify merge producers; duplicate keys remain separate from ORDER permutation. [Width repair evidence and boundaries](research/multi-output-compound-repair.md).
