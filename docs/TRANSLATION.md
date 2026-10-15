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

## Read-only metadata PRAGMA (bounded consumers)

`PRAGMA [main.]table_info` and `table_xinfo` accept omitted, parenthesized or `=` table-name arguments through pinned Lemon command semantics. Immutable catalog columns lower to ordinary VDBE literal loads/ResultRow, preserving logical declaration order, compact visible cid, generated hidden 2/3, PK ordinal and retained default span. Explicit temp is empty; absent databases error. Views derive names and types at prepare through the existing stored-view SELECT expansion/resolution owner, without executing rows. View columns do not inherit base PK, notnull, defaults or generated hidden flags; explicit names, duplicate-name disambiguation, nested/circular views and NONE versus BLOB affinity follow the same source graph. `index_list`, `index_info`, `index_xinfo` and `foreign_key_list` consume the same linked catalog graph: linked index order/origin/partial flags, logical column ordinals versus physical suffix fields, expression/rowid sentinels, key bits/collations/direction (Index.azColl spelling retained separately from folded KeyInfo lookup), and reverse-declaration FK order/actions. WITHOUT ROWID table names may denote their PK index.  `database_list` reports the resident immutable memory snapshot as main with empty filename (not the Fetch URL or native-oracle path); explicit temp PRAGMA preparation opens an empty temp metadata state, subsequently listed with empty filename. Unknown names absent from the pinned pragma registry prepare as zero-column no-ops, even with arguments; known untranslated names remain unsupported. No mutating or extension operation is enabled. This is bounded common metadata coverage, not arbitrary PRAGMA support. Source/verification and outstanding coverage: [card-e-n repair evidence](research/card-e-n-pragma-red/REPAIR.md) and [VIEW derivation](research/card-e-n-pragma-red/VIEW.md).

`SELECT` admits bounded `pragma_table_info`, `pragma_table_xinfo`, `pragma_index_list`, `pragma_index_info`, `pragma_index_xinfo`, `pragma_foreign_key_list` and sole-source `pragma_database_list` sources: sole-source projection/filter/order, positional or usable hidden `arg`/`schema` equality arguments, and physical-table/catalog-left INNER or LEFT correlation. A shared real Table/Column/view metadata producer feeds statement-owned Filter/Next cursors and ordinary expression, predicate and ResultRow owners, without nested public prepares. Ready outer INNER WHERE/ON terms run before correlated Filter; LEFT ON and NULL completion stay separate from WHERE. Visible types are absent; hidden argument columns retain native empty declared types. Runtime schema errors and reset/finalize follow the common VM lifecycle. Explicit temp is empty; attached schemas, metadata rowid, generated outer-column binding, grouped/distinct/limited joins, broader join shapes remain temporarily unsupported. Database_list has no hidden arguments, is sole-source only, and retains empty-text memory filenames; mixed metadata stars include visible fields only. Their canonical expanded result list precedes ORDER ordinal/alias resolution and also owns projection, output metadata and destination width. Ordered mixed metadata joins reuse the shared SELECT sorter/destination after Filter/Next and LEFT completion; the metadata cursor remains the row-state owner. See [ordered-join source comparison and finite evidence](research/card-e-n-pragma-red/TVF-ORDER.md). This is not generic virtual-table admission. See [TVF source and finite verification](research/card-e-n-pragma-red/TVF.md) and [independent assessment](research/card-e-n-pragma-red/independent-tvf-assessment.md).


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
normalizes declaration module specifiers via their AST. No bundler, runtime
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
branch, not a post-crash workaround.

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

ON hit/match recording precedes ready non-ON WHERE constraints and downstream
positioning, including null/unmatched continuations. Nested SELECT dependencies
retain enclosing-source readiness. Selected rowid OR uses source-owned arms and
private dedup; selected persistent WR OR uses typed physical PK dedup.
Parameter-sensitive represented STAT4 programs retain bindings through bounded
reprepare; vectors/function/subquery costing probes and general plan parity are
not established. [Retained reprepare evidence](research/card-h-b-reprepare/README.md).

`whereexpr.c`, `where.c`, `wherecode.c` produce terms, candidate loops, paths and
loop control; `where-plan.ts` and the ordinary SELECT caller consume them.
`WhereClause/WhereTerm`, `WhereLoop/WherePath/WhereLevel`, BigInt source masks and
LogEst estimates retain dependency and join-barrier ownership. The represented
solver uses the upstream bounded path-choice shape; it is not full optimizer
coverage. Alias/ordinal ORDER resolution occurs before immutable plan handoff.

Ordinary comma/CROSS/INNER/LEFT and represented repeated/mixed rowid RIGHT/FULL
barriers are admitted at the documented gates. ON belongs to match testing; LEFT null extension precedes
WHERE. RIGHT/FULL has separate unmatched-row tracking/drain. WITHOUT ROWID RIGHT/FULL match tracking remains temporary unsupported; arbitrary
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

Immutable schema loading retains represented sqlite_stat4 samples and selected
bounded costing consumers. Reprepare expiry uses the native low-slot/shared-high
mask shape and preserves bindings on failure/reset. Vectors/function/subquery
probes and general skipscan/range selectivity coverage remain gaps; finite sample
costing is not arbitrary native plan parity. [Consumer review](research/card-s-h/d-diagnosis/MAPPED_REVIEW.md)
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
including same-VM coroutine merge where implemented. Bounded single-source,
single-output ordinary table set arms resolve retained WHERE and projection
carriers on their shared scan cursor; false/NULL predicates skip delivery. Shared
parameters retain lexical generated-terminal identity before LIMIT/WHERE lowering.
Explicit ORDER COLLATE set-rewrite metadata follows native rightmost type/origin
with leftmost names, separately from compound key collation. Tests and current
working-copy boundaries: [filtered compound evidence](research/card-j-d-b-a-c-filtered/README.md).
Unordered table sets retain the bounded typed ephemeral route. Ordered ordinary
single-output table arms now feed per-arm sorter coroutines and the existing
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
multi-column IN destinations; scalar consumers remain width one. This is not
vector index-strategy completeness. See `expr.c:sqlite3ExprVectorSize`,
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
CodeIN probes exact non-NULL keys then traverses records for NULL fallback;scalar fallback checks only the first sorted row (expr.c step 6), vector fallback
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
bounds this copy-before-await adaptation, not native allocation/latency parity. Public VDBE private control also supplies synchronous
snapshot work/cancellation/deadline checks before copying borrowed packed inputs;
copying cannot yield until the immutable snapshot exists, then insertion resumes
normal asynchronous checkpoints. [Large-input repair evidence](research/card-m-packed-independent-review.md#large-packed-snapshot-control-repair)
bounds this copy-before-await adaptation, not native allocation/latency parity. NULL fallback decodes exactly KeyInfo width with
RawRecordReader inside the payload callback, rejecting extra/missing fields without
an unbounded intermediate decoded array. LHS admission conservatively covers owned copy
plus UTF encoding expansion and numeric text scratch. Packed Set record temporariesare dead after IdxInsert and refunded after awaited insertion, including errors;
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
REAL conversion; it does not independently parse integer text. Int64 REAL
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
aggregates/windows in the recursive term. A single recursive SrcItem joined to
physical tables uses a retained insertion-order ephemeral destination feeding the
shared WHERE loops and AggInfo (including GROUP/HAVING); producer queue order,
deduplication and LIMIT remain separate from consumer controls. This physical-only
specialization declines outside its admission before resolution or builder mutation,
so represented derived-input and multiple-recursive-declaration consumers retain
their semantic owners; selected compilation errors remain terminal. SQL outer joins,
repeated references to one recursive declaration and joined compound/window shapes
not represented by another owner remain bounded temporary gaps. Materializing this retained input charges all producer
rows before consumer output; it does not promise streaming latency or planner
parity. [Source comparison and evidence](research/recursive-join/README.md).

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

## Functions, text and JSON

`func.c`, `printf.c`, `date.c`, `json.c`, `utf.c`, `vdbemem.c` and comparison
routines map to `functions.ts`, `ordinary-scalars.ts`, `pattern.ts`, `printf.ts`,
`date-time.ts`, `math.ts`, `json.ts`, `utf.ts`, `mem.ts`, `comparison.ts`.
Registry arity/flags and VM Function dispatch own execution; no host callback or
native fallback. Preserve source numeric coercions, overflow, ASCII-only built-in
case folding, embedded-NUL rules, collation and database-encoding conversion.
JS Date/RegExp/JSON.parse/stringify are not substitutes for translated semantics.

Represented ordinary, formatter, pattern, date/time and enabled math functions
execute; read-only changes/last-insert counters remain zero. JSON scalar,
aggregate/window and bounded eponymous each/tree sources are present. JSON TEXT
uses private subtype 74; SQLite JSONB is subtype-0 BLOB, not PostgreSQL JSONB.
JSON sources expose eight visible fields; hidden json/root are explicit-only and
retain empty declared types. Resolved direct columns publish virtual-column
metadata; aliases override, computed names retain exact expression spans. JSON
row extraction preserves INTEGER/REAL and storage classes through grouping.

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


### Additional bounded index/FK table-valued PRAGMA consumers

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
