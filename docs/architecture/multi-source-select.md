# Multi-source SELECT architecture and tests-first handoff

Status: proposal for the runtime-consumer card [[card:card-k]]. This document is a
source-pinned implementation contract, not a claim that joins execute today.

## Scope and entry gate

The tranche translates SQLite 3.53.4 multi-source ordinary SELECT production from
`sqliteInt.h` (`Expr`, `Select`, `SrcList`, `NameContext`), `parse.y` source/join
reductions, `build.c:sqlite3SrcListShiftJoinType`, `select.c` (`selectExpander`,
`sqlite3ProcessJoin`),
`resolve.c` (`lookupName`, `resolveSelectStep`), `where.c`, `whereexpr.c`,
`wherecode.c`, and `vdbe.c` cursor/control/`NullRow`. It admits comma, CROSS,
INNER, LEFT, RIGHT, and FULL joins over ordinary rowid tables, including ON,
USING, NATURAL, wildcard expansion, WHERE, and composition with the already
admitted projection, DISTINCT, ORDER BY, LIMIT/OFFSET, and compound destinations.
It does not admit subqueries, CTEs, views, aggregates/windows, table-valued
functions, indexes, or mutation merely because their source fields are retained.
Those forms remain complete query-graph nodes and fail atomically at prepare.

The consumer must first make every valid case in
`test/conformance/cases/stage3-multisource-select.spec.json` an attempted public
operation and compare it with its checked-in pinned capture. Invalid cases must
fail at prepare without opening/scanning a source. Companion resource tests are
required but do not become SQLite-oracle credit.

## Production-owned immutable query graph

`parse.ts`, not the compiler, owns construction. Replace the current lossy source
shape with immutable ordered structures built directly by the generated Lemon
reductions (`stl_prefix`, `seltablist`, `joinop`, `on_using`):

```ts
type JoinFlags = Readonly<{
  inner: boolean; cross: boolean; natural: boolean;
  left: boolean; right: boolean; outer: boolean;
  error: boolean;
}>;
interface SourceItem {
  readonly databaseName: string | null;
  readonly tableName: string;
  readonly alias: string | null;
  readonly indexedBy: string | null;       // retained; unsupported when non-null
  readonly on: ExprNode | null;
  readonly using: readonly string[] | null;
  readonly joinFromLeft: JoinFlags;         // SQLite jointype belongs to RHS item
  readonly leftOfRightJoin: boolean;        // immutable JT_LTORJ control marker
  readonly cursorId: number | null;         // assigned once during expansion
  readonly table: TableNode | null;         // bound connection-owned identity
}
interface SourceList { readonly items: readonly SourceItem[]; }
```

Exactly one of `on`/`using` may be present; NATURAL with either is a prepare error.
Repeated USING names and undefined USING columns retain every ordered token with location/name data. Pinned 3.53.4 accepts `USING(x,x)` (it produces repeated equality terms rather than a duplicate-name diagnostic), while an undefined name raises the captured missing-column diagnostic; semantic production must preserve this distinction. Do not normalize a join into an evaluator AST, name-keyed
map, or Cartesian row array. `SelectNode` retains this list, result expressions,
WHERE, ORDER/GROUP/HAVING/window fields, compound links and flags even where a
later gate rejects them.

Expansion creates a new immutable resolved graph. In source order it resolves the
schema table, allocates a monotonically increasing nonnegative cursor from the
statement `ParseContext`, and binds the table identity. Cursor IDs, not aliases or
array positions, are the identity used by resolved column expressions, opcodes,
WHERE loop masks, metadata, and `NullRow`. Re-expansion must not allocate again.
Statement reset preserves the Program's cursor identities; finalize releases
runtime cursors, not the immutable descriptors.

## Expansion, names, and result descriptors

Port `selectExpander` before general expression resolution. Bare `*` expands
visible columns source-left-to-right and schema-column order. `q.*` resolves the
source alias first (an alias hides the base table qualifier), then an unaliased
qualified table, and expands only that source. Unknown qualifiers and use of `*`
outside a result list are prepare errors. Duplicate output names and duplicate
expressions remain separate ordered entries.

USING/NATURAL implements the pinned visibility rule: a right-hand column named by
the effective USING list is hidden from bare `*`, but remains available through
`rightQualifier.column` and `rightQualifier.*`. NATURAL computes the ordered
intersection from left visible output names and the right table, then follows the
same rule. Unqualified lookup searches every eligible source in the current
`NameContext`; zero matches is `no such column`, more than one is `ambiguous column
name`. A qualifier narrows by alias/table and optional database. Search then walks
outer `NameContext` frames; a matching local frame prevents outer fallback.

Use transient linked `NameContext` frames referencing the resolved `SourceList`
and applicable result list. Port the source's `NC_UEList` contract rather than
inventing SQL-standard-only alias rules: `resolveSelectStep` installs the result
list on the local context before HAVING and WHERE resolution, and tagged ON terms
that `sqlite3ProcessJoin` moved into the WHERE tree pass through that same lookup.
`lookupName` searches real source columns first; only if none match may it
substitute a matching result alias, with the source's non-aggregate/aggregate,
row-value, and ambiguity diagnostics. Thus a real column shadows an equal alias,
WHERE may use an otherwise unmatched alias, and duplicate matching aliases follow
the pinned lookup diagnostics/selection captured by the gate. ORDER/GROUP/HAVING
retain their distinct source callers and precedence. Alias substitution does not
weaken join scope: after resolution, port `sqlite3SelectCheckOnClauses` to reject
an outer-join ON term whose prerequisite cursor mask includes any source to the
owning RHS item's right. ON otherwise sees the sources on its left through its RHS.
Every resolved column becomes `{cursorId, columnIndex, tableIdentity}`; rowid
aliases follow `lookupName` and table rules rather than string substitutions.

Each expanded result term carries immutable `ResultColumnDescriptor`: SQLite
name, declared type or null, database/table/origin or null, affinity and resolved
collation. A direct resolved column preserves its declaration, origin, affinity,
and default column collation through aliases and qualified references. An
expression uses SQLite result-name rules and has no origin metadata unless the
pinned expression metadata path supplies it.

USING/NATURAL is not an unconditional “left column owns the output” rule. NATURAL
first synthesizes an ordered USING list; thereafter the following matrix applies
to each effective USING name (and is required for both explicit result references
and the unqualified terms emitted by bare-star expansion):

| Join family | Unqualified lookup and bare `*` value | Bare `*` descriptor, affinity, collation | Qualified `q.col` / `q.*` |
|---|---|---|---|
| INNER / LEFT | left-most matching source column | that direct left column's declared type/origin, affinity, and default collation | always the named source's direct value and direct metadata |
| RIGHT | right-most matching source column (the RHS item carrying `JT_RIGHT`) | that direct right column's declared type/origin, affinity, and default collation | always the named source's direct value and direct metadata |
| FULL (`JT_LEFT|JT_RIGHT`) | a resolver-owned `coalesce(leftMatch..., rightMatch)` in source order | expression metadata (null declared type/database/table/origin), deferred affinity resolved from the first/left argument, and expression collation (BINARY absent explicit `COLLATE`) | always the named source's direct value and direct metadata |

This follows `resolve.c:lookupName`: a later USING match is skipped for INNER/LEFT,
replaces the prior match for RIGHT, or extends `pFJMatch` and becomes `TK_FUNCTION`
`coalesce` for FULL. It also follows `select.c:selectExpander`: RHS USING columns
are omitted from bare `*`, but an earlier `JT_LTORJ` column whose name occurs in a
later USING is emitted as an unqualified identifier so lookup performs the
RIGHT/FULL choice. Thus `right-using-coalesce-star` has `main.c.k` origin and RHS
values, while `full-using-coalesced` has coalesced values and all-null origin/type
metadata. Qualified stars never coalesce or hide their source-specific columns.
The generated USING equality is a separate `sqlite3ProcessJoin` expression: its
comparison affinity/collation follows the source expression (`pE1`, including the
multi-left coalesce branch with deferred affinity) and RHS column under normal
comparison rules; it must not inherit output-descriptor metadata. General
collation precedence remains explicit COLLATE, resolved column, then BINARY;
affinity is applied at comparison callers, not by mutating stored `Mem`.

## Join processing and predicate ownership

Translate `sqlite3ProcessJoin` into immutable semantic production before loop
planning. NATURAL/USING synthesize equality expressions between resolved cursor
columns. ON expressions and synthesized equalities retain source flags equivalent
to `EP_OuterON`/`EP_InnerON` plus the owning RHS cursor. They are not appended as
indistinguishable WHERE terms.

The initial planner may select only the source-order nested-loop plan, but its
control and predicates must remain source-shaped:

1. emit `OpenRead` for each resolved cursor without reading all rows;
2. enter one rewind/next loop per source, with a bounded tuple of cursor positions;
3. evaluate ordinary WHERE terms at the earliest legal prerequisite mask;
4. evaluate INNER/CROSS ON terms when their cursor mask is available;
5. for LEFT ownership, set a match register only after the ON term succeeds, emit
   joined rows, then after RHS exhaustion execute `NullRow(rhsCursor)` and the
   unmatched continuation if no match occurred;
6. evaluate post-join WHERE against real or NULL-row cursor values, so moving it
   into ON cannot incorrectly retain an outer row.

`NullRow` is cursor state, not a fabricated record: all column reads from that
cursor return NULL while its real b-tree position remains unavailable. Rewind,
Next, reset, error cleanup, and a new execution clear null-row state. Nested outer
joins may have multiple simultaneous null-row cursors. Result expressions,
filters, sorter keys, DISTINCT records, and compound destinations all read through
the same cursor-column primitive.

No blanket Cartesian materialization is allowed. A browser-safe source-order
nested loop is an ordinary planner limitation, not an algorithm substitution: it
matches a legal `sqlite3WhereBegin` loop shape and the `wherecode.c` loop/match
register protocol while postponing index and reorder choices. Document the
resulting performance limitation; do not change row order into a guarantee beyond
pinned observable unordered output in the manifest.

## RIGHT and FULL tranche

Preserve SQL source order. Port `build.c:sqlite3SrcListShiftJoinType`: parser join
flags shift onto the RHS source item, and every item left of the right-most RIGHT
join receives immutable `leftOfRightJoin` (`JT_LTORJ`). Retain RIGHT and the
LEFT|RIGHT combination for FULL; do not reverse sources or swap bits. Expansion,
USING/NATURAL synthesis, name lookup, loop prerequisite masks, and planning all
consume this same graph. In particular, the `JT_LTORJ` branch of
`sqlite3ProcessJoin` selects/coalesces the effective USING value across a
multi-table left operand rather than assuming its leftmost or nearest table.

Port the `WhereRightJoin` protocol. The normal SQL-order pass records matched RHS
row identities in a typed ephemeral cursor owned by the RHS loop. Its interior
joined-row body is emitted once as a subroutine/continuation so normal matches and
the unmatched-right pass share all downstream joins, WHERE filtering, projection,
and destinations. At loop end `sqlite3WhereRightJoinLoop`-shaped control nulls all
applicable cursors to the left of the RIGHT barrier, opens/scans the original RHS
under `WHERE_RIGHT_JOIN`, skips row identities present in the match state, and
invokes that interior continuation for each unmatched RHS row. Planner/loop order
must respect `JT_LTORJ` and RIGHT barriers; the initial source-order planner does
not make them reorderable. FULL combines the existing LEFT match-register/NullRow
continuation for unmatched left rows with this unmatched-RHS pass. Match keys/state
use existing typed ephemeral/private primitives and the singular budget, never a
JS `Set`.

The first runtime card may tranche admission as (1) comma/CROSS/INNER/LEFT and
(2) RIGHT/FULL, but every RIGHT/FULL form remains an atomic prepare gate until
retained-order flags, multi-source USING/coalescing, wildcard value choice,
barriers, matched-key ownership, nulling, interior continuation, downstream joins,
and exhaustive cleanup pass. This is a direct translation, not an exceptional
algorithm substitution, and product scope is unchanged.

## Existing lowering and compound integration

A resolved single SELECT is a producer with the same output-register/descriptor
contract already consumed by ResultRow, sorter, DISTINCT ephemeral index, and
compound arm destinations. Extend that shared producer; do not add a join-only
result evaluator. ORDER/DISTINCT/LIMIT are applied after join row production with
the existing immutable `KeyInfo` and VDBE counters. LIMIT must not alter join
matching. A compound may admit a multi-source arm only after every arm passes its
own expansion/resolution gate and widths/compound ORDER resolve; then the arm feeds
the existing compound destination. Existing scalar/VALUES/direct-column arms keep
their current lowering. Unsupported arm shapes reject the whole compound before
any producer executes.

All simultaneously live sorters, DISTINCT/set ephemerals, and join match helpers
share the statement's one `PrivateStateByteBudget`. Match state is constant-size
register/cursor state where possible; FULL-join matched-row tracking, if needed by
the pinned loop shape, uses the existing typed ephemeral cursor and shared budget,
not a JS `Set`. Nested loop advances, predicate terms, comparisons, NullRow
transitions, sorter/set operations, and copied logical bytes charge deterministic
work. Cancellation/deadline checks bracket every potentially unbounded advance or
growth. Suspension preserves PCs, cursor positions, match registers, null-row
flags, shared reservations, and the first error. Reset/finalize exhaustively close
all cursors and release the singular budget before later connection admission.

## Invariants and error/lifecycle contract

* Parse/expand/resolve are complete before Program publication; no rows or private
  reservations exist on a prepare error.
* Source, result, and USING orders are immutable and observable.
* Every resolved column references exactly one allocated cursor and schema column.
* ON and WHERE remain distinct through loop coding; only ON controls outer-match
  status and only WHERE can discard the generated unmatched row afterward.
* One statement execution owns one aggregate private-byte budget and at most one
  active public step; no per-loop multiplication of configured ceilings.
* INTEGER remains signed int64/BigInt, REAL retains binary64 (including `-0` where
  observable), NULL differs from empty TEXT/BLOB, and database encoding conversion
  uses the existing SQLite-derived path.
* `reset()` retains bindings and reproduces execution from initial cursor/control
  state; rebinding after reset affects every loop/predicate occurrence. Failure,
  cancellation, deadline, reset, and finalize preserve first-error precedence.

## Tests-first machine gate

The manifest/capture pair is:

* `test/conformance/cases/stage3-multisource-select.spec.json`
* `test/conformance/cases/stage3-multisource-select.json`
* `test/conformance/capture-multisource-select.py`

Every case carries content-addressed provenance: exact translations hash a bounded pinned test assertion and require the case SQL within it; synthesized discriminators hash a bounded source span, identify owner/control and branch-marker tokens that the validator requires inside that exact hashed excerpt, and state the adaptation. The validator rejects the three previously misclassified local cases as translation claims. The pinned C API capture verifies source identity before setup and records ordered
columns (including duplicates and origin metadata), typed NULL/INTEGER/REAL/TEXT/
BLOB cells, exact prepare errors, reset/rebinding executions, and UTF-8/UTF-16le/
UTF-16be databases. Cases cover aliases and qualification (including WHERE/ON alias substitution,
real-column precedence, duplicate aliases, and outer-ON right-reference checks),
ambiguity/no-such column, `*`/`q.*`, ON/USING/NATURAL visibility and errors, all
six join spellings, unmatched/empty outer inputs, affinity/collation,
ORDER/DISTINCT/LIMIT, and a compound arm. Retained-order RIGHT/FULL discriminators
include three/four sources on both sides of the barrier, chained USING/NATURAL,
coalesced unqualified values, bare/qualified wildcards, ambiguous multi-table-left
USING, ON-versus-WHERE unmatched-right rows, simultaneous FULL unmatched sides,
and downstream LEFT/INNER joins. Runtime companions must additionally force browser yield, cancel,
deadline, exact work exhaustion, each private-state ceiling (including overlapping
sorter/FULL state), and cleanup/re-execution over adversarial nested loops. Include
a many-by-many case under a low private-byte limit to prove streaming rather than
Cartesian materialization.

Credit is case-by-case public typed equality, never inferred from a passing count.
Unordered SQL in the gate either has a pinned asserted sequence selected from an
upstream test or adds ORDER BY. Native setup uses the pinned library, not host
Python SQLite. Capture files are development evidence and must not enter runtime.

## Alternatives rejected and operational effects

A JS hash join, row-object evaluator, all-rows Cartesian array, and alias-keyed
source map are smaller locally but lose SQLite cursor identity, outer-join
predicate placement, collation/affinity comparison, suspension, and VDBE
composition. They are rejected. A full cost planner/index tranche is unnecessary
for semantic admission: source-order loops preserve the upstream control shape
without claiming planner parity. The only current adaptation is immutable TS
nodes plus async-resumable typed cursor state in place of C allocation/gotos; the
observable comparison, loop, NullRow, destination, and cleanup behavior remains
source-derived and is protected by the pinned/public tests above.

## Audit reconciliation

The 2026-09-14 audit's Finding 1 parser-ownership defect is corrected in current
compound work, and Findings 10/11's original “compounds unsupported” statement is
superseded by its 2026-09-16 revisions (22/22 bounded compound gate and one shared
`PrivateStateByteBudget`). This proposal consumes those current owners. The audit
does not report joins as implemented: multi-source forms remain a current atomic
compiler gate. Existing relational accounting (3/18 attempted/passed, 2 credited)
is separate and is not evidence for this join contract.

## Reproducible proposal evidence (revision after component review)

Run from repository root with card work root supplied:

```sh
sh tools/oracle/build.sh
python3 test/conformance/capture-multisource-select.py \
  --library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" \
  --spec test/conformance/cases/stage3-multisource-select.spec.json \
  --output "$SAIVAGE_CARD_WORK_ROOT/multisource-recapture.json"
cmp test/conformance/cases/stage3-multisource-select.json \
  "$SAIVAGE_CARD_WORK_ROOT/multisource-recapture.json"
npm run test:conformance:multisource:manifest
npm run typecheck
npm run test:parser
git diff --check
git status --short
```

The revision capture contains 47 declared/identity-verified native cases and zero
TS attempts/credit. The committed status record identifies the exact commit and
actual command outcomes; these establish reproducibility and cleanliness, not
runtime semantic support.
