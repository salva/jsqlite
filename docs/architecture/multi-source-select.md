# Multi-source SELECT architecture and tests-first handoff

Status: proposal for the runtime-consumer card [[card:card-k]]. This document is a
source-pinned implementation contract, not a claim that joins execute today.

## Scope and entry gate

The tranche translates SQLite 3.53.4 multi-source ordinary SELECT production from
`sqliteInt.h` (`Expr`, `Select`, `SrcList`, `NameContext`), `parse.y` source/join
reductions, `select.c` (`selectExpander`, `sqlite3ProcessJoin`, RIGHT JOIN rewrite),
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
  readonly cursorId: number | null;         // assigned once during expansion
  readonly table: TableNode | null;         // bound connection-owned identity
}
interface SourceList { readonly items: readonly SourceItem[]; }
```

Exactly one of `on`/`using` may be present; NATURAL with either is a prepare error.
Repeated USING names and undefined USING columns retain enough location/name data
for SQLite diagnostics. Do not normalize a join into an evaluator AST, name-keyed
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
and applicable result list. Result aliases participate only at source-defined
callers (ORDER/GROUP/HAVING), never as a general WHERE/ON column shortcut. ON can
see the sources on its left through its own RHS but not later sources. Every
resolved column becomes `{cursorId, columnIndex, tableIdentity}`; rowid aliases
follow `lookupName` and table rules rather than string substitutions.

Each expanded result term carries immutable `ResultColumnDescriptor`: SQLite
name, declared type or null, database/table/origin or null, affinity and resolved
collation. A direct resolved column preserves its declaration, origin, affinity,
and default column collation through aliases and qualified references. An
expression uses SQLite result-name rules and has no origin metadata unless the
pinned expression metadata path supplies it. For USING/NATURAL `*`, the retained
left visible column owns descriptor/value selection; RIGHT/FULL processing may
coalesce values as described below without inventing right-side origin metadata.
Collation precedence remains explicit COLLATE, resolved column, then BINARY;
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

Do not create a separate right-join evaluator. Port the `selectExpander` rewrite:
for a RIGHT join, reverse the source-list prefix through the RHS, swap LEFT/RIGHT
bits as upstream does, set the translated `JT_LTORJ` marker on intervening items,
and remap wildcard/USING output through the rewritten graph. Then lower the
resulting LEFT-shaped control. FULL is LEFT plus RIGHT: retain the first pass and
match tracking, then emit the source-shaped second pass for unmatched original
right rows using the same cursor/null-row machinery and upstream
`WHERE_RIGHT_JOIN`/`JT_LTORJ` barriers. The first runtime card may tranche this as
(1) comma/CROSS/INNER/LEFT and (2) RIGHT/FULL, but the public gate must reject all
RIGHT/FULL atomically until rewrite, star/USING value choice, unmatched-row order,
and cleanup cases pass. Product scope is unchanged.

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

The pinned C API capture verifies source identity before setup and records ordered
columns (including duplicates and origin metadata), typed NULL/INTEGER/REAL/TEXT/
BLOB cells, exact prepare errors, reset/rebinding executions, and UTF-8/UTF-16le/
UTF-16be databases. Cases cover aliases and qualification, ambiguity/no-such
column, `*`/`q.*`, ON/USING/NATURAL visibility and errors, all six join spellings,
unmatched/empty outer inputs, affinity/collation, ORDER/DISTINCT/LIMIT, and a
compound arm. Runtime companions must additionally force browser yield, cancel,
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
