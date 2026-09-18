# CTE source model, scope, and compilation foundation

Status: architecture proposal for [[card:card-n-a]]; parser model and atomic runtime gate implemented, execution deliberately unimplemented.

## Scope and evidence

This proposal is the handoff for [[card:card-n]]. It covers generated-parser ownership of `WITH`, lexical CTE lookup contracts, parse-lifetime use state, and the later lowering routes for ordinary and recursive CTEs. It does **not** claim public CTE execution.

The authority is the manifest-pinned SQLite 3.53.4 source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`. The consulted tranche is:

- `parse.y:609-621,1955-1973`: `WITH`/`WITH RECURSIVE`, ordered `wqlist`, aliases, and `M10d_Any/Yes/No`.
- `sqliteInt.h:3597-3620,4462-4514`: `Select.pWith`, `Cte`, `With`, and shared parse-lifetime `CteUse`.
- `select.c:5610-5880,6000-6030,6388,7275-7276,7797-8020`: lookup, push/pop, expansion, recursive marking and diagnostics, coroutine/materialization choices, and reuse.
- `resolve.c` linked `NameContext.pNext` traversal: expression-name correlation remains separate from relation-name CTE search.
- `vdbe.c` `OP_InitCoroutine`, `OP_Yield`, `OP_EndCoroutine`, `OP_OpenEphemeral`, `OP_Rewind`, and `OP_RowData`: future producer, materialization, and recursive queue controls.

The mutable 2026-09-14 fidelity audit was checked against current code. Its original structural-SELECT concern is partly superseded: current SELECTs and nested subqueries are generated-reduction semantic graphs, and this change adds generated `wqitem`/`wqlist` actions rather than token reparsing. Its sustained rules—owning primitives, source-shaped control, exact oracle evidence, and honest credit—remain applicable.

## Current delivered boundary

`src/internal/parse.ts` now attaches an immutable `WithClause` directly to the owning `SelectNode`. It preserves:

- the `RECURSIVE` marker independently of whether recursion is found;
- declaration order;
- each exact CTE name, optional ordered alias list, nested generated `SelectNode`, and materialization mode (`any`, `materialized`, `not-materialized`);
- SQLite ASCII case-insensitive duplicate-name rejection with `duplicate WITH table name: <name>`.

These values are produced only by generated Lemon reductions (`wqas`, `wqitem`, `wqlist`, and `select ::= WITH ...`). There is no auxiliary SQL parser. The nested SELECT owns its own `WithClause`, so nested shadowing is representable without flattening scope.

After loading the immutable schema graph, `Connection.prepare()` runs the canonical cycle-safe `selectGraphContainsWith()` admission walk. It visits the root, expression-owned scalar/`EXISTS`/`IN` SELECT reductions, retained and flattening-adjacent derived owners, every compound arm, CTE bodies, and persisted-view SELECTs reached by FROM lookup. Discovery rejects with temporary unsupported and exact message `common table expressions are not implemented` before any compiler is called. Thus no `Program`, statement registration, cursor/coroutine/queue, or private-state reservation exists; the connection remains reusable. This gate is admission only and does not implement scope or execution. The oracle artifact therefore reports TypeScript attempted/credited as 0/0.

## Proposed scope and lifetime contracts

### Relation scope

Add a transient `WithScope` frame, source-shaped after `With`:

```ts
type WithScope = {
  readonly ctes: readonly CteNode[];
  readonly outer: WithScope | null;
  readonly owner: SelectNode;
};
```

Expansion pushes `select.with` before resolving that SELECT's FROM terms and pops it after walking the SELECT, matching `sqlite3WithPush()` and `sqlite3SelectPopWith()`. Lookup scans the innermost frame first, preserving declaration order and shadowing, then follows `outer`. An unqualified FROM name consults this chain before schema tables. A schema-qualified source bypasses CTE lookup. Nested SELECTs without their own matching CTE fall back to the outer frame; a nested matching name shadows it. View expansion starts with the view's schema-definition scope and must not accidentally capture a caller CTE.

This relation scope is deliberately not folded into `NameContext`. `NameContext` remains the transient linked expression/column lookup owner with `pNext`, ambiguity-at-level, and correlation depth. After a FROM term resolves to a CTE producer, its transient columns and source identity enter the ordinary `NameContext` frame.

### Ownership and use state

The authored `CteNode` graph is immutable statement syntax. Expansion creates one mutable `CteUse` object per visible declaration, shared by all resolved FROM uses even if SELECT trees are cloned or rewritten:

```ts
type CteUse = {
  nUse: number;
  materialization: CteMaterialization;
  addressM8d: number | null;
  returnRegister: number | null;
  cursorId: number | null;
  rowEstimate: number | null;
};
```

Resolved source items retain `{cte, use}` identity and an `isCte` fact. `nUse` increments during expansion, not execution. The state lives only through prepare/lowering and is not public API or schema state. Program-private runtime state owns copied `Mem` values and is released by existing statement reset/finalize/error paths.

### Diagnostics and recursion

Duplicate declaration errors are available as soon as the generated `WithClause` is built. Remaining checks belong to source expansion/resolution, not parser token heuristics:

1. Mark a CTE as resolving before walking its body; re-entry selects the upstream circular-reference diagnostic.
2. Resolve compound terms to identify the anchor and recursive terms and mark recursive SELECT flags source-shaped after `SF_Recursive`.
3. Enforce one recursive reference, reject recursive references in forbidden subqueries/multiple locations, and preserve exact upstream error text/prepare phase.
4. Infer result width and reject explicit alias-count mismatch before lowering.
5. Keep unsupported but parsed shapes intact until the atomic compiler gate can issue a truthful temporary-unsupported failure.

The `WITH RECURSIVE` keyword is a scope marker, not proof that an item is recursive; ordinary CTEs under it follow ordinary routes.

## Compilation routes and invariants

After scope/diagnostic tests pass, lower only represented routes:

- **Inlining/flattening:** only where current `flattenSubquery` guards and CTE materialization rules permit it.
- **Coroutine:** ordinary one-use, non-`MATERIALIZED` producers use the translated `InitCoroutine/Yield/EndCoroutine` route when all `fromClauseTermCanBeCoroutine` predicates are known true.
- **Materialization/reuse:** `MATERIALIZED`, repeated use unless `NOT MATERIALIZED`, or conservative unknown routes use one statement-owned ephemeral fill plus independent duplicate cursors. Publish fill address, return register, cursor, and row estimate through shared `CteUse` only after construction succeeds.
- **Recursive:** compile anchor output into queue/distinct-queue ephemeral state, repeatedly dequeue a current row and run recursive terms, preserving upstream UNION ALL versus UNION duplicate behavior, ORDER/LIMIT queue controls, typed records, collations, and shared work/private-byte budgets.

Invariants:

1. Lookup and all prepare diagnostics complete before a runnable `Program` is returned.
2. A CTE body never executes through a nested public statement or recursive JavaScript evaluator.
3. INTEGER/REAL, NULL, TEXT encoding, BLOB, metadata, and error phase flow through existing `Mem`, `KeyInfo`, and VDBE paths.
4. All CTE cursors, queues, coroutine PCs, and retained cells share one statement's cancellation, deadline, work, and `PrivateStateByteBudget`; cleanup preserves first-error precedence.
5. Materialization hints are planner constraints, not syntax-only decorations.
6. Unknown route facts choose rejection now and conservative materialization later—never optimistic execution.

## TypeScript/browser adaptations

Immutable ordinary objects replace C allocation/destructor ownership; explicit frame links and statement lifetime replace pointer stacks. Nullable numeric fields replace upstream negative sentinel integers so cursor/register/address domains cannot be confused. These are representation adaptations only: ordered lookup, shared-use identity, push/pop extent, route predicates, diagnostics, and VDBE-visible behavior stay upstream-shaped.

A future recursive queue may use the existing bounded ephemeral/KeyInfo abstraction rather than a native b-tree page implementation because the browser runtime has no writable SQLite temp database. That substitution is not approved merely by this proposal: implementation must compare upstream queue ordering/deduplication and preserve value classes/collations under source-derived tests, including configured-small failure and cleanup evidence.

## Alternatives rejected and complexity avoided

- No ad hoc WITH/token parser: generated reductions already own the grammar and nested SELECT semantics.
- No recursive JS evaluator or nested public `prepare()` calls: these would split budgets, lifecycle, typing, and error ownership.
- No blanket eager materialization: it contradicts materialization hints, one-use coroutine behavior, and recursive control.
- No CTE names in the schema map and no mutation of immutable `CteNode`: CTE scope is lexical and statement-local.
- No premature opcode or queue implementation in this architecture milestone. The atomic gate is smaller and safer until lookup, diagnostics, and tests exist.

## Oracle and validation contract

`stage3-cte-architecture.spec.json` is machine-readable and contains 17 logical cases: 14 credited assertions from pinned `with1.test`/`with2.test`, plus three explicitly no-credit companions for the marker and both hints. The archive contains no `test/with.test`; no such credit is claimed. Each case is captured against the pinned library in UTF-8, UTF-16le, and UTF-16be (51 native executions), with prepare/step phase, typed values, and five metadata fields. Setup is a minimal extraction from preceding Tcl setup and must not be described as an exact contiguous file port.

The next implementation must first add focused scope/source tests, then promote only complete public API cases. Until then native evidence remains 14 upstream-credit + 3 companions and TypeScript 0/0.

## Integration and operational effects

No public type, deployment, configuration, network, or persistent database format changes result. Parser graph size grows by bounded authored CTE structure. Runtime behavior changes only from root-only accidental fall-through risk to a schema-aware, graph-complete temporary prepare rejection. Future execution reuses the current resolver, VDBE, and private-state owners rather than adding another engine.
