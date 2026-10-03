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
solver uses the upstream bounded path-choice shape; it is not full optimizer
coverage. Alias/ordinal ORDER resolution occurs before immutable plan handoff.

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
