# SQLite-to-TypeScript translation guide

## Authority and current use

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
rowid proof. UTF-8, UTF-16le and UTF-16be remain required. Internal schema discovery
is not a public schema-introspection API or write-time constraint enforcement.

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

## WHERE, joins and physical indexes

`whereexpr.c`, `where.c`, `wherecode.c` produce terms, candidate loops, paths and
loop control; `where-plan.ts` and the ordinary SELECT caller consume them.
`WhereClause/WhereTerm`, `WhereLoop/WherePath/WhereLevel`, BigInt source masks and
LogEst estimates retain dependency and join-barrier ownership. The represented
solver uses ordered candidate insertion and unsorted bounded slots with separate
setup/run/output and total/unsorted costs (where.c2744–2939,5835ff), not generic
Pareto pruning. Source/sort identities are separate; budget is builder-owned.
Candidate exploration is suspended at each immutable proposal and inserted
immediately, rather than building an eager capability list. Exhaustion closes
recursive/index/rowid exploration; `planWhere` retains the per-source increment
and later-source continuation (where.c3284,3580ff,4966,5025ff). Private small-budget
production checks observe both leaf construction and later-index access stopping.
Potential ORDER usefulness follows `indexMightHelpWithOrderBy` (where.c3664ff):
a same-cursor rowid/IPK term preserves every ordered persistent index's identity
before dominance, even when complete physical ORDER satisfaction is zero.
The all-encoding before/after stat-choice and production analysis tests cover
this distinction; an `unordered` statistic still prevents ORDER usefulness.
Indexed row-size metadata is now produced and consumed in the in-progress
[[card:card-s-e-b]] repair below; OR-set lowering, automatic-index execution,
STAT4 and star heuristics remain residuals, not full optimizer coverage.
The approved SECOND immutable row-width/stat1 owner proposal and pinned
native-first acceptance are in [card-s-e-row-width](research/card-s-e-row-width.md).
Runtime acceptance remains red; proposal approval is not compatibility credit.
[Repair decisions/evidence](research/card-s-d-a-ordered-where.md). Alias/ordinal ORDER resolution occurs before immutable plan handoff.

Ordinary comma/CROSS/INNER/LEFT routes and one RIGHT/FULL barrier are admitted at
the documented gates. ON belongs to match testing; LEFT null extension precedes
WHERE. RIGHT/FULL has separate unmatched-row tracking/drain. More than one such
barrier remains temporary unsupported. USING/NATURAL projection and metadata must
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

## ORDER, DISTINCT, compounds and VALUES

`select.c:selectInnerLoop`, `pushOntoSorter`, `generateSortTail`,
`computeLimitRegisters`, `multiSelect`, `multiSelectByMerge` own these paths.
Typed sorter/ephemeral destinations compare complete keys and payloads; DISTINCT
uses NULL-equal/numeric-equal set semantics. ORDER uses result alias, ordinal,
structural expression and then admitted source expression precedence; complete
collation/direction/NULL flags reach the consumer. Equal complete ORDER keys have
no public deterministic-order guarantee.

LIMIT/OFFSET lowering uses VM registers, not host statement fields. A single
SELECT coerces both before a zero-limit bypass; compounds coerce LIMIT first and
zero bypasses OFFSET and producers. Negative LIMIT is unlimited and negative
OFFSET is zero. Ordered positive LIMIT bounds retention to LIMIT+OFFSET.

Structured VALUES compiles each retained row, validates every arm width, and
preserves arm-level set semantics. Compound collation searches result expressions
across arms using upstream ownership; no leftmost-default shortcut. Represented
scalar/set and table/CTE/aggregate compound branches use shared destinations,
including same-VM coroutine merge where implemented.

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

`select.c:updateAccumulator`, aggregate code generation, `resolve.c` aggregate
analysis and `func.c` callbacks own grouped/ungrouped state. Shared Mem operations
in `vdbe.ts` consume grouping keys, direct/sorter/saved column phases, aggregate
argument DISTINCT/FILTER/order, finalized leaves, HAVING and parent destinations.
Empty ungrouped aggregates differ from no groups; bare min/max column ownership,
INTEGER/REAL SUM/AVG/total distinctions and JSON subtype must survive publication.
No general AggInfo/analyzer completeness follows from bounded source/saved-phase
migration. Represented GROUP/ORDER/DISTINCT/LIMIT and join/derived/CTE compositions
are admitted only through their actual semantic branches.

`expr.c` scalar/EXISTS/IN lowering uses one VM, linked parent identity and phase,
conditional Once for uncorrelated producers and rebuild/reset for correlated
producers. Empty scalar is NULL, EXISTS is INTEGER boolean, and IN preserves
NULL/empty/negation semantics. The surviving finite borrowed-value IN adaptation
uses bounded arrays rather than upstream ephemeral Btree: quadratic duplicate
comparison is disclosed, charged/checkpointed and borrowed Mem released in finally.
It is not general IN/storage/work parity. See [[card:card-t]] finite disposition
and [API admission](api.md#current-sql-admission).

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
aggregates/windows in the recursive term. Broader retained producer composition
remains temporary unsupported, not permanently excluded.

## Windows and private storage

`window.c:sqlite3WindowRewrite`, `sqlite3WindowCodeInit`,
`sqlite3WindowCodeStep`, `windowCacheFrame` and frame helpers own rewriting,
partition/order keys, input coroutine, buffer duplicates and endpoint scheduling.
`window-rewrite.ts` plus shared `vdbe.ts` lowering execute represented ordinary
aggregate and special builtin windows. Compatible windows share rewritten input;
incompatible layers retain their own ordering. Grouped, join, derived, ordinary/
recursive CTE and outer ORDER/LIMIT compositions are bounded admissions, not
blanket gates. Cached frame/EXCLUDE scheduling is a source-shaped adaptation, not
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
`json_pretty` remains recognized but temporary unsupported. Host extensions and
external virtual-table modules remain SPEC exclusions, not an excuse to exclude
built-in JSON.

## Remaining debt and bounded handoff

This guide consolidates accepted bounded contracts, not universal compatibility.
Unrepresented grammar/compositions, full semantic analyzer relationships, broader
optimizer/index proofs and native intermediate scheduling equivalence remain
visible roadmap work. Historical predictions are verified at the next consuming
slice. No new implementation, compatibility credit, whole-project completion,
operator/configuration changes or all-project cleanup gate is authorized here.

### Retained derived hidden ORDER key (2026-10-03)

The single-source coroutine consumer now binds an admitted column ORDER key in
its complete producer EList, independently of visible projection. As in pinned
`resolve.c:resolveOrderGroupBy`, parent aliases/ordinals first map through parent
EList; qualified/unqualified source columns map through transient source names.
`select.c:flattenSubquery` restriction (11) retains both ORDER owners;
`fromClauseTermCanBeCoroutine` (1a), tag 0482 and SRT_Coroutine retain producer
LIMIT before consumer sorting. No replacement algorithm or materialization is
introduced. Existing one-key column consumer boundaries remain.

Foundation regressions exercise hidden/reordered/qualified/alias/ordinal keys,
two SorterOpen operations and coroutine controls. Reservation instrumentation
observes one execution budget crossing 150 bytes while child/parent sorters are
live; 300 succeeds, 150 fails on step, saved reset error and cleanup restore
admission. These are implementation logical bytes, not native allocation parity.

### Nullable selected equality RHS (bounded repair)
Pinned `wherecode.c:codeAllEqualityTerms` (976–980) sends nullable `=` RHS
straight to the level's `addrBrk`, before affinity/seek; `IS`/`IS NULL` keep
NULL searchable and IN skips NULL in its own iterator. Both ordinary and joined
selected-index lowering now distinguish equality-null exit from range-start
`addrNxt`: equality bypasses all remaining IN probes, while joined LEFT still
passes through its unmatched-row continuation. Conservatively emitting a guard
for a statically nonnullable equality adds a no-op, not a comparison change.
`candidate-lifecycle-public.test.mjs` uses frozen manifest-pinned native controls
captured before consuming test edits: six encoding/stat snapshots, persistent
alternatives, dependency/LEFT, typed values/metadata/reset/rebind/errors. Controls
were captured after product implementation, not retroactive native-FIRST.

Row-width proposal revision [[card:card-s-e-a]] (2026-10-04, not implementation):
analysisLoader assigns nonpartial globally matched index count to argv[0] named
table, not index.table; post-load defaults may floor table-only count to99.
GetInt32 unsigned hex remains admitted at sz boundary. Revised native-first
120 snapshots and237 production/public assertions are recorded in the decision
note; TS baseline9/237 passes is not fidelity credit. Planner assessment pending.

Row-width acceptance correction (proposal only): pinned wherePathSolver feeds
prior rUnsort, including each no-sort round's -2 bias, into the next extension.
The row-width note and real joined path-bias control distinguish total51/unsorted49
from erroneous52/50. No runtime change or compatibility credit.

### Immutable schema estimates — repair checkpoint, not acceptance (2026-10-04)
[[card:card-s-e-b]] uses schema-local mutable construction, default/load/post-load
and final freeze; numeric column/table/index LogEst estimates have one owner.
PhysicalIndex fields supply index width, not JS bytes or declared key count.
Pinned build.c AddColumn/AffinityType/estimateTableWidth/estimateIndexWidth and
analyze.c analysisLoader/decodeIntArray own estimates. Callback conversion uses
shared Mem/DB encoding and UTF-8 NUL termination; globally matched indexes and
named tables remain distinct owners. Ninth checkpoint retains converted UTF8
callback bytes rather than READ_UTF8 Unicode before hash lookup/token scanning:
overlong e083a9 must not alias valid c3a9 schema name. Mem performs encoding
conversion; byte-key maps use canonical schema UTF8 and ASCII-only fold. Native
exec callback hex and three-encoding typed/reset regression bound this evidence;
Thirteenth checkpoint direct pinned column_text byte oracle covers both UTF16
endians: final unpaired surrogate emits three UTF8 bytes under default build,
not replacement. Shared Mem now uses utf.c direct read/write conversion rather
than Unicode-string re-encoding for UTF16→UTF8; odd-byte and following-unit
branches tested (12 cases). Fourteenth checkpoint encoded stat1 caller fixtures now bound malformed
surrogate table names (ignored byte hash) and high surrogate plus following
space in unknown token: conversion consumes the space, so sz=8 stays within
ignored token and physical width remains default, while unordered is retained.
Two native callback-hex/EQP snapshots and public typed/reset checks pass;
full invalid stat1 matrix remains open. Fifth checkpoint removes an incorrect
WITHOUT ROWID restriction on analysisLoader's equal-name PrimaryKeyIndex
lookup (analyze.c1611/build.c1069). Persistent UNIQUE indexes retain distinct
origin so equal table/index name does not target them. Encoded BLOB/NUL callback
fixtures prove bounded rowid-text-PK versus UNIQUE ownership and public seeks;
complex autoindex numbering/constraint-merging is not certified. Tenth checkpoint
preserves ordered PRIMARY/UNIQUE grammar actions and build.c4330–4380 merge:
equal column/collation sequences retain first direction, promote PK origin and
do not consume another implicit ordinal. Native-first rowid UNIQUE-before-PK
plus duplicate DESC UNIQUE fixtures bind widths/physical access/typed reset;
Eleventh checkpoint shares ordered implicit definitions for rowid and WR:
WR primary uses its retained ordinal (not always1), and automatic UNIQUE rows
use ordinary secondary PhysicalIndex/PK suffix publication. Native-first WR
UNIQUE-before-PK plus duplicate UNIQUE fixture binds primary ordinal2, secondary
widths/PK mapping and noncovering typed reset all encodings. Conflict policies,
Twelfth checkpoint feeds the merged primary definition into WR compaction and
storageKey before publication, retaining the first equivalent UNIQUE direction
when later PK promotes origin (build.c4330–4380). Native-first all-encoding
UNIQUE(a DESC)→PK(a ASC) fixture binds covering seeks/reset and primary width;
supplemental native index_xinfo confirms DESC. Conflict policies/full census
remain open. Fifteenth checkpoint independently captures rowid equivalent
UNIQUE(a DESC)→PK(a ASC) promotion: native index_xinfo DESC, noncovering typed
rows/reset and physical width27 pass all encodings without runtime edits.
Constructor census locates persistent schema, derived resolve, VDBE view/CTE/
VALUES/derived table owners; defaults are explicit, but conflict onError grammar
is not retained by implicit definitions and REPLACE linkage remains unverified.
Sixteenth checkpoint retains implicit onError grammar/default identity, merges
explicit/default before PK promotion and translates build.c exit_create_index
first-REPLACE bubbling to list tail. Native-first three-encoding index_list
fixtures reproduce wrong [3,2,1] versus [3,1,2]; exact source linkage now passes
with typed noncovering reset. Conflict inheritance/error branch implementation
Seventeenth checkpoint independent default UNIQUEa→REPLACE PK promotion
with another REPLACEb exposes final-policy replay loss: native list1/2, old2/1.
Implicit producer now executes prepend/cleanup at every grammar action including
merge/promotion and publishes that source list position before stat load/freeze.
Three encoded native index_list/typed reset fixtures pass; explicit conflicting
Eighteenth checkpoint WR+APPDEF promoted REPLACE list fixture passes existing
publication all encodings. Independent conflicting explicit IGNORE/REPLACE
writable-schema snapshots expose public raw SchemaFormatError lacking native
CORRUPT11/name context. Owning merge adds prepare.c corruptSchema object context;
public prepare translates SchemaFormatError to sqlite11/cause, repeated prepare
fails without schema publication. Native message/code all encodings pass.
Nineteenth checkpoint removes post-estimate implicit-slot sorting: automatic
schema rows construct first, retained grammar linkage materializes before any
APPDEF row, then APPDEF insertions run source cleanup on actual list. This
matches init-busy/table-grammar ownership in build.c4485/exit_create_index;
physical identity and progressive estimates stay single-owner. Conflict suite
13/13 plus WR explicit coverage passes; broader constructor closure unclaimed.
Twentieth checkpoint isolates nine ordinary case families across all120 original
snapshots so early joined failures cannot hide REAL/WR/expression/NULL/reset/
rebind-clear/column-name assertions:1080/1080 pass on unchanged native expected
semantics. Nine private production plan/compile checks bind setup0, range output,
seek+width-ratio/table-lookup LogEst costs and actual tc roots covering versus
noncovering; no joined/full-origin-metadata or universal optimizer credit.
Twenty-first independent pinned-native fixtures (three encodings49,152 bytes)
close direct-column origin metadata and REAL-constrained noncover public gap:
all five ColumnMetadata fields, INTEGER/REAL storage classes, numeric values,
NULL clear, rebind and reset-retained pass3/3 without runtime changes. This is
bounded direct-column metadata, not aliases/expressions/join metadata closure.
Twenty-second constructor census exposes WR INTEGER PRIMARY KEY: AddPrimaryKey
initially creates rowid-alias identity, then convertToWithoutRowidTable2385–2411
creates persistent primary only after other grammar indexes. Implicit producer
now delays this action (inline DESC excluded, table PK DESC alias retained), so
native ordinal/root/stat ownership holds. Three-encoding native-first fixtures
reproduce unpublished index rowLogEst crash; repair19/19 focused/typecheck0.
No rowLogEst fallback added: correct physical primary identity feeds defaults.
Twenty-third independent WR controls bind inline DESC (immediate PK), table
DESC (delayed PK), UNIQUE(a)→delayed PK merge retaining first ASC direction.
Nine encoded snapshots184,320 bytes pass before further refactor; shared
AddPrimaryKey identity producer now supplies rowid alias publication and WR
delay, removing duplicate grammar identity inference. Focused15/15,typecheck0.
Constructor census still incomplete; these are native index-order/root/typed
reset checks, not all metadata/control branches.
Twenty-fourth census corrects SELECT transient placeholders: select.c2246
zero-allocates columns,2376 leaves szEst unused,2432 publishes szTabRow1.
Resolver nested compound and VDBE derived/CTE synthetic owners now use column0/
table1 instead of fabricated1/16, preserving nonphysical root0/no-index fence.
Source-derived nested resolver regression3/3; no planner fidelity credit for
unused transient column estimates.
Checkpoint25 reviewable ownership/control inventory is
`docs/research/card-s-e-estimate-census.md`: persistent/default/load/freeze,
transient owners, actual cost/lowering consumers and mixed-hunk review gates.
Fresh complementary candidate/stat/WR/order/resources94/94 on unchanged runtime;
original123 failures and constructor/error/resource/metadata gaps remain.
Checkpoint26 fresh missing matrix80 nodes74/6; selected/offpath corruption,
RHS limits and connection reuse pass, but two-slot joined IN crashes6/6 at
InListValue integer iteration register. Identical current tests on isolated
HEAD source6/6 pass: new checkout regression, not preexisting join attribution.
Advanced page-local/offpath/resource name-selected checks8/8. Next isolate
width/path selection versus lowering/register lifetime; no SELECT workaround.
Checkpoint27 trace: outer covering scan permits x.a NULL, first RHS exhausts
before second iterator initializes. LEFT synthetic body then re-enters IN
restart with uninitialized register. where.c7627 IfNotOpen prevents analogous
unopened cursor advance; register-set adaptation now fences synthetic null
continuation past physical/IN advances, reset per outer row. Selected45/45;
fresh affected144143/1 and width14101287/123 retain unrelated unresolved reds.
Checkpoint28 independent read-only native retained reset/clear/rebind captures
six existing encoded before/after fixtures184,320 bytes (no new DB bytes),
empty-second/NULL-first and matched bindings. Public6/6 (retained replay too);
isolated pre-guard source0/6 crash confirms regression coverage, not samples.
Checkpoint29 VDBE review isolation11 owned hunks27/12 versus2 peer bitwise
hunks2/2, both reverse-check; no staging/review approval. Fresh width1416
1293/123,affected/resource229228/1,typecheck0; original failures unwaived.
Checkpoint30 native declared controls20 columns ×3 encodings36,864 new
fixture bytes cover hex signed boundary/overlong zeros/invalid suffix/CHAR scan
versus immediate BLOB pointer and INT precedence; full direct metadata/rows/
reset3/3. Internal widths source-derived, not native internal estimates.
Checkpoint31 raw ff/c183 schema-SQL BLOB→TEXT controls36,864 bytes:
UTF8 accepts quoted malformed declared prefix,width5 source-derived; UTF16
CAST retains UTF8 bytes interpreted as UTF16, native/TS CORRUPT11 twice.
This is encoding-mismatch schema rejection, not malformed UTF16 type closure.
Checkpoint32 correctly encoded malformed UTF16 schema high-surrogate +X
consumption controls2 fixtures24,576 bytes: independently native UTF8 metadata
hex matches TS all5 direct fields,typed TEXT/reset,width5 source-derived.
Fresh declared suites8/8. Not complete malformed-byte/metadata coverage.
Checkpoint33 independent-review handoff docs/research/card-s-e-implementation-review.md
summarizes owning paths/adaptation/open dispositions. Fresh width14241301/123,
resource229228/1; no independent review/staging/acceptance claimed.
Checkpoint34 missing joined families isolated preserving original JS-number
bindings: current36011/349 vs HEAD0/360; INTEGER diagnostic current360/360
vs HEAD135/225. Current failures join120,path-bias120,rowid109; no waiver.
SeekRowid vdbe.c5495 copy+NUMERIC lossless conversion absent in TS6902,
root semantic owner remains separate. Diagnostic INTEGER variant not shipped.
Checkpoint35 independent pinned exact no-ORDER tie query9 controls all tb;
TS plan/chosen OpenIndex/public rows/reset9/9. where.c2744 insertion discards
equal candidate before5818 width tie. Original3 contradictory assertions
remain unchanged pending parent review; no reranking workaround.
Checkpoint36 independent native reverse-outer LEFT two-IN continuation
8 binding sets×6 snapshots: unmatched→matched→unmatched/reset6/6,zero skips.
184,320 existing bytes reused,no runtime changes/no universal join credit.
Checkpoint37 joined WR native3 nonempty controls retained; current/HEAD0/3
both reject at preexisting compileInnerTableSelect storage-shape fence3376,
so no joined physical-mapping execution credit. Do not remove fence without
coherent SELECT lowering. Ordinary WR repair unaffected; expectations red.
Checkpoint38 persistent publication identity/freeze120/120 over original
snapshots: cached graph stable, accessor is index owner,physical backlinks,
readonly maps and attempted estimate mutation. Source-derived invariant tests,
not oracle public compatibility/full cleanup or transient constructor proof.
Checkpoint39 failed stat1 load fresh errors/no graph publication6/6 and
existing public repeated-prepare corruption6/6. Defaults/post-load ordering
compared analyze.c1988; strict malformed-record rejection is existing policy,
not native corruption equivalence. STAT4 path not newly verified.
Checkpoint40 fresh width1928:1453/475 (original123+isolated349+WR3),zero
skips/cancels; affected129:128/1 reverse-sorter; standalone typecheck0.
Updated review handoff contains classified residuals,no waiver/acceptance.
Checkpoint41 exact joined reverse-order native SORT0 forced/SORT1 scan
all encodings; TS rows/reset/sorter parity6/6. where.c5273 ONEROW skips
singleton x ordering; original sorter>=3 assertion retained for review,
not product regression workaround or universal order proof.
Checkpoint43 where.c3037 residual output adjustment now runs after physical
costing/before insertion for actual loops,skips used/virtual/unavailable terms,
heuristic equality clamp. Source tests8/8,native cost branches3/3 after
correcting owned stale internal output expectations,native rows unchanged.
truthProb/HIGHTRUTH/LIKE/self-cull flags remain unrepresented,not full port.
Sixth checkpoint
translates build.c2417/isDupColumn WR primary-key compaction before physical
layout/default/stat1 publication: same column+collation retains first direction;
distinct collations remain distinct fields. Seventh checkpoint publishes build.c
sqlite3AddPrimaryKey identity once: inline INTEGER PRIMARY KEY DESC is not an
alias, but table PRIMARY KEY(id DESC) is. Width/autoindex/resolver/WHERE/VDBE
consume that identity, with explicit null on transient tables. Older private mocks
alone retain a compatibility fallback. Native-first three-encoding fixtures bind
both syntax paths and typed rows/reset. Native-first duplicate WR fixtures
bound width, stat vector and secondary-key ordinal/public lookup evidence.
Eighth checkpoint distinct-collation WR noncovering native fixtures exposed
expr.c4462 table-column mapping omitted after a valid secondary PK seek.
Ordinary lowering now maps table cursor columns through the physical primary
index while covering columns remain mapped through chosen secondary; includes
residual expressions and direct projection. Joined lowering remains uncertified.
Unknown stat1 tails are ignored, noskipscan
retained without skip-scan credit; nonempty STAT4 is still rejected. WHERE uses
explicit BigInt conversions and consumes immutable width/cost capabilities;
synthetic IPK width3 is not a persistent index. DDL type token spans preserve
immediate BLOB dimensions rather than inserting spaces. Fourth checkpoint
adds build.c1584/util.c299 complete type-span dequoting before metadata and
AffinityType; quoted CHAR/BLOB unsigned hex/overflow/doubled-quote fixtures
independently captured before the repair pass3/3 across encodings, including
complete direct-column origin metadata and typed row/reset checks. This closes
that bounded declared-type gap, not all metadata or invalid-byte coverage.

where.c5273 skips ordering disruption for WHERE_ONEROW; represented actual IPK
equality prefixes now retain unknown joined ordering until a later capability
can prove it. Statistical nOut0 alone is not uniqueness. where.c5961–5995 keeps
prior unsorted recurrence and biases unsorted (including unknown), not total.
Runtime240 remains117 pass/123 fail; early joins conceal additional ordinary
failures, so do not attribute all public gaps exclusively to joins. A separate
ordinary diagnostic is11/120; rowid JS-number bindings fail (shared Mem correctly
represents numbers as REAL). Pinned vdbe.c5495 OP_SeekRowid numerically coerces a
copy without changing the operand; current TS rejects non-INTEGER outright,
unchanged from HEAD. A diagnostic using BigInt instead passes120/120 rowid cases,
not a waiver or acceptance. Root semantic-owner disposition is needed.
Fresh pinned native chooses tb for three preserved auxiliary no-ORDER tie
assertions demanding ta; captured ORDER query still chooses ta. Expectations
remain unchanged pending parent disposition. Independent reverse-join native
sort count is0 (NOT INDEXED control1), contradicting the preserved peer sorter
expectation. Supplemental source-based cost/order tests pass; affected170 is
169 pass/1 fail, not acceptance or universal compatibility.
where.c3533/3552/4050/4239/4258–4278 now feed IS NULL estimates, range clamp
ordering, full-scan ORDER usefulness, and covered-prefix table-lookup reduction.
These branch repairs are unreviewed; truthProb, invalid-byte callback parity,
expanded declared hex/full metadata and complete WR mapping/census remain gaps.

Checkpoint44 expr.c2899 EP_IntValue syntax recursion replaces token-joined
residual literal check; parentheses/unary signs recurse,only positive signed32
INTEGER leaves qualify (not runtime hex64/folding). Source19/19. Fresh
width1951:1476/475 and affected/resources178:177/1,zero skips/cancels.

Checkpoint45 trace: TERM_HEURTRUTH only consumed by STAT4 HIGHTRUTH
where.c3519/7086 second-pass; nonempty STAT4 rejects before publication.
No missing admitted shared-state consumer; no mutable clause workaround.
SELFCULL consumer6606 Bloom generation unsupported,not width cost.
Fresh selected55/55,WR/residual complement43/43,stat/STAT4 boundary36/36;
44 changed-runtime width1951:1476/475 and resources178:177/1 reused.

Checkpoint46 current constructor census: transient result tables column0/table1/
rows200 (select.c2376/2432/2464) now consistently freeze completed metadata at
publication via schema freezeTransientTable; not persistent default/stat1 pass.
See refreshed estimate census and implementation handoff; independent review pending.

Checkpoint47 transient publication regression targets real withTransientTable:
3/3 current versus isolated freeze-call removal0/3; broad publication200/200,
typecheck0,width1956:1481/475,resources49/49,affected170:168/2 (sorter assertion,
missing r2-native artifact). No new runtime edits; independent review pending.

Checkpoint48 transient guard-before-freeze/repeated-identity controls pass;
publication/WR/STAT4/corruption159/159. Persistent PhysicalIndex-null fallback
width1 flagged as open source ownership branch (build.c2236 versus schema574);
unsupported access does not automatically justify fabricated width estimates.

Checkpoint49 real unknown-collation index reproduces fabricated width (3/3 red).
Pinned native ordinary q scan succeeds with A in all encodings; forced qi returns
SQLITE_ERROR/no query solution. Tried whole-schema rejection,then reverted:
that blocks legitimate table scan and is not a coherent source-faithful policy.
Need structural field ownership separate from executable built-in KeyInfo;
no width1 fallback or global rejection credit. Final tests retain expected
structural width LogEst(108) (CHAR100=26 plus rowid1),still0/3. No runtime change
retained this checkpoint; missing four Chinook tests remain unwaived.

Checkpoint50 replaces fabricated nullable-physical width with shared immutable
PhysicalIndexLayout owner; executable built-in KeyInfo uses same fields/PK
mapping only when collations available (build.c2236,5653–5700). Unknown collation
preserves structural width and ordinary table read,declines index access;
no competing statistics or host callback support. Review pending.

Checkpoint51 native WR unknown-CollSeq exact index_xinfo records agree with
shared layout fields: PK a custom DESC,b,c; same-collation suffix dedups a;
different-collation suffix repeats a custom DESC and maps PK [1,2]. Three
encodings frozen metadata/source widths pass3/3; independent native ordinary
WR read and forced secondary reads fail prepare1,TS rejects too (not exact
code/message parity). New36,864 fixture bytes; no WR executable access credit.
Fresh complement156:153/3 includes existing joined-WR storage fence failures,
not new owner regressions. Checkpoint50 width/affected evidence reused runtime
unchanged; independent review/root/parent/native-input gaps remain unwaived.

Checkpoint52 unknown-CollSeq caller now preserves native SQLite error1 rather
than temporary unsupported: forced unavailable index => no query solution;
unforced WR unavailable primary storage => no such collation sequence.
Owning btreeLoops uses retained layout names; existing capability gating/cost
ordering unchanged. build.c5653–5700/where.c6169 branches; six encoding controls
assert exact public kind/code/extendedCode/message/null classification across
repeated prepares,stable graph and immediate close. First harness syntax error
corrected;final6/6. Fresh affected173:170/3 existing joined-WR fence only.

Post-runtime row-width acceptance correction (not runtime repair): exact auxiliary
no-ORDER tie SQL selects tb after width-free whereLoopFindLesser dominance;
ORDER BY a retains sort identities and discriminates width in solver comparison.
Native controls captured after implementation, before revised acceptance execution;
not retroactive native-FIRST. See row-width decision note. Root public failures
and peer reverse-sorter assertion remain unwaived.


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

### Joined WITHOUT ROWID repair — 2026-10-04

Checkpoint37 above is historical red evidence, now superseded for the bounded
comma/CROSS/INNER/LEFT persistent producer by [[card:card-s-c-b-a]]. Joined
admission, OpenIndex, movement and expression payload remapping now consume the
existing immutable primary descriptor/KeyInfo; semantic declared column affinity
and metadata remain separate from physical ordinal. `expr.c:sqlite3ExprCodeGetColumnOfTable`
(4462) owns this remap. `build.c:convertToWithoutRowidTable` owns BLOBKEY/PK layout;
`wherecode.c` 2170–2186 owns covering omission versus secondary PK extraction.
Primary selected access never treats the primary record as a secondary rowid tail.
Uncovered secondary reads use the established DeferredIndexSeek at each loop
start before predicates/projection; movement returns to that positioning point.
Covering WR reads omit the primary lookup. Ordinary direct projection remains
unchanged (including its INTEGER/REAL behavior); expression emission now honors
its existing payloadIndex carrier rather than silently ignoring that field.
WR RIGHT/FULL match tracking is still atomically unsupported: its existing
Rowid/one-field match key is not a composite PK implementation.

Pinned read-only `capture-without-rowid-joined.py` records typed rows and
reset/rebind/finalize, plus all five metadata fields and actual EQP/cursor
controls for the original/forced duplicate-PK fixture queries (not every later
required-primary query). Native corruption/finalize controls were obtained
before runtime edits; native resource-budget controls were not. Work-limit
assertions below are TS contract evidence, not native budget equivalence. The
original three-encoding reproducer remains unchanged. Added public tests cover
secondary/primary root isolation, sticky corruption/finalize, LEFT miss/reset,
work limits, and required-primary lookup across rebind. Native EQP may use a
covering secondary even for WR NOT INDEXED; TS is not claiming identical plans.
Conservative joined needed-column accounting can require primary lookup where
native proves covering: correctness evidence is not a full optimizer claim.

Delivery follow-through: lookup capture now obtains EQP/program per exact
row-run binding (2.5/1/NULL/2.5). Post-runtime native progress-interrupt and
length-limit reset/recovery controls are explicitly labeled, not native-FIRST
or equivalent to TS work budgets. Source comparison confirms where.c4035's WR
index chain bypasses the rowid NOT INDEXED secondary suppression at4055; TS's
primary-only NOT INDEXED candidate policy is conservatively narrower, not exact
native plan parity. Owner-relative source payload, prerequisite hashes and
handoff are in `docs/research/joined-wr-delivery/README.md`; overlapping owner
reconciliation/integration remains outstanding.


### Joined column-location correction (2026-10-04)
The semantic location contract now distinguishes `physicalColumnIndex` (table
primary/secondary storage ordinal) from aggregate `payloadIndex`/iAgg bookkeeping.
Joined columnAccess produces the former; binding replaces any prior physical
location when rebinding, and expression emission consumes only that location.
Logical transient indices and aggregate registers retain their own owners.
Pinned expr.c:sqlite3ExprCodeGetColumnOfTable4462 maps table storage;
TK_AGG_COLUMN4995–5015 uses accumulator/sorter locations first, and select.c
AggInfo production owns those locations. vdbe.c OP_Column reads the already
chosen cursor record ordinal, not a universal semantic-to-physical conversion.
This repairs the source-only45/68 cross-layer regression without reverting real
WR collation-aware mapping. Exact corrected candidate tests: discriminator68/68,
broad910/910,joined/shared184/184. Historical24/30 credit, wider fences and
post-runtime/native-FIRST shortfall remain unchanged; no B4-cause claim.

### Current bounded width evidence closure — 2026-10-04

Actual integrated source is `644cbcd827a2fbdf3a14407210941e38ac945a01`
(tree `7669377f99ead8c9bed67c52695cfa549863fa2d`), not the historical
mixed ACK candidate. Joined owner correction uses dedicated `physicalColumnIndex`
for storage; `payloadIndex`/iAgg remains logical aggregate state. Old checkpoints
and their failures remain chronological evidence, not current acceptance claims.
Independent [[card:card-s-e-c]] / [[card:card-s-e-d]] support bounded original
width and tested lifecycle on exact source plus inventoried297 evidence paths.
The coherent generator→case JSON→fixture/test corpus is promoted by
[[card:card-s-e-b]]; scope, hashes, fresh export checks and reuse are in
[width evidence delivery](research/card-s-e-b-evidence-delivery.md). Fresh exact
export original240/240, closure2034/2034 and read-only pinned120 snapshot equality
are bounded evidence, not whole-product approval. B4 now returns INTEGER1984 with
reset/admission on reviewed source; sole causation is not proved and cancelled
baselines supply no causal credit. Native-FIRST chronology is unchanged.
STAT4 unsupported, noSkipScan retained/unconsumed, advanced24/30 and analyzeC0/24,
OR/skipscan/wider SELECT/metadata/resource fences remain unchanged.


### Current bounded infix caller repair — card-p-b-c (2026-10-04)

Pinned `parse.y:1363–1383` creates LIKE/GLOB function lists as RHS pattern,
LHS candidate, optional ESCAPE. Syntax reduction children remain LHS/RHS/ESCAPE.
`vdbe.ts:bindResolvedExpression` and joined `resolveTree` now use the same
infix child permutation in every applicable caller policy, not only windows;
infix NOT binds its synthesized unary child against the same infix carrier.
Explicit function-call children remain unchanged. No patternCompare algorithm,
function breadth, fixture, or expected-count change was needed.

Fresh source-ID-pinned C API on actual UTF-8/UTF-16LE/UTF-16BE users files
confirms Alice/Bob/Cara LIKE results 1/0/1 and filtered count 2. Public infix
aggregate/join/NOT/ESCAPE and explicit-call controls now agree. Executable evidence:
`ordinary-scalars-pattern-native.test.py` (36 INTEGER checks),
`run-ordinary-scalars-pattern-ts.mjs` (5 observations, 24 boundaries,
90 discriminators, 33 compositions, 9 lifecycle cases). Detailed chronology and
commands: `docs/research/card-p-b-c-pattern-count-diagnosis.md`.
The 50 active ordinary non-pattern registry rows / 0 absent count is unchanged;
this caller repair is not new aggregate/window or excluded-family support.
Original broad exit1 1539/1543 four reds are not universally dispositioned by
this focused repair. C4 and direct REAL/expression-subquery regressions remain
retained; no global cleanliness or universal acceptance claim.

### Expression safety-budget fixture repair (2026-10-04)

`run-expression-bounded-ts.mjs` pins the current `SELECT hex(?1)` inventory
for 1024 ASCII bytes: seven executed VM operations through ROW (three setup/body
Gotos, Variable, Function, Copy, ResultRow), four started 256-byte input chunks,
four hex traversal chunks, and eight output-copy chunks =23 units. The original
`f1a5b3b` inventory was four operations plus the same sixteen chunk units =20;
shared SELECT setup/body routing introduced by `48bf18c8` added three charged
jumps. The old 19/20 assertion was therefore stale, not evidence of removed
checkpoints. The repaired 22/23 boundary also checks saved error identity,
reset/rebind/reuse and the exact TEXT payload. No default, limit or runtime owner
is changed, and routing is not exempted from accounting.

Pinned `src/vdbe.c` increments `nVmStep` before opcode dispatch (including
`OP_Goto`, whose jump path also checks interruption); `src/func.c:hexFunc`
converts input bytes into two uppercase output digits per byte. Browser chunk
charges/yields are an adaptation, not native VM-step parity. A source-ID-checked
native prepare/bind/step probe independently verified TEXT/2048 bytes, exact
payload, progress interruption (9), reset (9), and subsequent successful reuse.
Native progress control is not an asynchronous JS cancellation proof. This
finite repair retains the API's implementation-defined safety-counter contract;
unit inventories may change with source-shaped lowering and must be justified,
not silently raised to make a failing test pass. The runner separately exercises
actual yielded cancellation, injected deadlines, output limits and all three
fixture encodings. Historical unrelated conformance reds are not cleared here.
