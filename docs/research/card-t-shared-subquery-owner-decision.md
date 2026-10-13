# Shared subquery owner — current bounded disposition

[[card:card-t-c]] handoff to [[card:card-i]]. The bounded linked scalar/vector,
EXISTS/IN/star/clause carrier correction is accepted. This is not full SELECT
migration, integration, release approval, or approval to assemble every dirty hunk.

## Accepted owner conditions and production branch map

- `resolve.ts:resolveAgainstSources/expandAndResolveSelect` distinguishes scalar1,
  vector consumerN and EXISTS unconstrained projection. Star expansion supplies
  semantic width; adjacent compound and packed VALUES widths are validated before
  consumer arity. Every represented packed row is resolved, including unused EXISTS
  projections. LIMIT/OFFSET and recursively reached SELECTs resolve with an empty enclosing
  NameContext (resolve.c1909–1917, before1977 attaches ordinary outer sources).
  Valid independent clause children retain linked plans/cursors, not correlation
  to the forbidden surrounding frame.
- `resolvedExpressionCarrier` retains original nested SelectNode→ResolvedSelect
  identity and expanded fields. `vdbe.ts` expression binding hands these plans to
  scalar/IN consumers; semantic affinity, explicit versus inherited collation,
  rowid/IPK and enclosing cursor ownership are not inferred from register numbers.
- `compileWideSubquery` owns linked Mem/Exists/Set production. Plain joined scalar
  callers and linked source-bearing scalar children use this producer, remapping
  child-local sources while preserving the enclosing binding. Mem initializes N
  NULL cells and takes the first qualifying row; Exists initializes INTEGER0 and
  yields INTEGER1 independent of projection; correlated children suppress Once.
  IN evaluates its left side outside RHS Once. `select-program.ts` validates
  positive safe count/width, equality and exact valid affinities before opcodes;
  internal invalid construction is typed internal, SQL arity is sqlite code1.
- `compileScalarSelect` shares the destination and expression owner through packed
  VALUES and source-free UNION ALL row recursion. False/NULL WHERE produces an
  empty Set. EXISTS skips EList evaluation/copy in both this source-free producer and
  `compileInnerTableSelect` (table/correlated/joined/UNION ALL callers), not name resolution, predicates
  or clauses (select.c:selectInnerLoop1202/1412). Scalar Set honors affinities[0].
- SELECT-owned mutable LIMIT/OFFSET registers copy evaluated child values rather
  than decrementing cached scalar registers (select.c:computeLimitRegisters2535–2566).
  `compileWideSubquery` composes unordered nonaggregate source-bearing UNION ALL
  arms with one destination and shared limit/offset (select.c:multiSelect TK_ALL).
  Mem/Exists stop at the first qualifying row; Set retains actual limits.

The neighboring table-expression IN caller forwards its nested-clause emitter
to `computeLimitRegisters` just as its scalar sibling does; counters remain
SELECT-owned copies. Mem/Set still evaluate projections and preserve overflow
errors; EXISTS still evaluates predicates/clauses and preserves their errors.

Pinned source: SQLite3.53.4, source ID in `reference/sqlite/manifest.json`.
`expr.c:sqlite3CodeSubselect3933–3964` owns scalar LIMIT normalization;
`sqlite3ExprAffinity`, `sqlite3BinaryCompareCollSeq`, vector comparison and IN
consume original expression fields, not a parallel evaluator. Shared Mem/Btree/
KeyInfo and async execution are preserved. Ordinary object/register adaptations
are not algorithm-substitution approval.

## Retained boundaries

Ordered/distinct/aggregate/window/compound scalar specializations remain where
not displaced; no wholesale deletion of specialized producers is authorized.
Wide table compound set operators, ordered/aggregate or mixed source-free arms
remain typed temporary before publication, not terminal-arm-only partial results.
Unlinked/re-resolved fallback dispatch, general derived/CTE producer migration,
ordered AggInfo composition, vector index optimization and full corpus breadth
are not certified by this bounded carrier acceptance. Scalar SELECT collation is
not generally propagated. No global vector-width relaxation or guessed binding
is approved. PRAGMA full_column_names was not tested; complete ordinary metadata
records were. This does not retract already supported specialized paths.

## Tests and evidence

Review [immutable parent33](record:///review.md?card=card-t&v=33) identified R1
(table EXISTS EList gate) and R2 (recursive clause context), initially source
findings, then independently reproduced native-first. Those owners are corrected,
not caught/drained or SQL-name blacklisted. `row-vector/review33-owners.test.mjs`
and `review33-cases.json` cover table/correlated/joined/UNION ALL presence,
empty/WHERE/LIMIT/OFFSET, repeated exact native name errors/no publication and
recovery, valid independent clause children, narrow fallback controls and retained
Mem/Set/predicate overflow. Source-specialized ordered/aggregate/window branches
are retained and not certified by this matrix.



`test/conformance/row-vector/subquery-consumers.test.mjs`: expanded star/scalar/
vector/EXISTS/IN, affinity/collation, nested correlation and NULL/reset transitions,
VALUES/UNION ALL, clauses, unused projection overflow and repeated exact-code errors.
`select-destination-atomic.test.mjs`: invalid destination boundaries before ops.
`row-vector/carrier-handoff.test.mjs`: full metadata, correlated NULL reset,
uncorrelated random() single evaluation, replay/finalize/immediate close in three
encodings. `row-width-real-metadata.test.mjs` and relational/correlated-IN lifecycle
checks add bounded metadata/resource controls, not blanket resource acceptance.

Prior authenticated receipt (superseded for blanket R1/R2 claims): `record:///status.md?card=card-t-c&v=1168` records typecheck,
43/43 focused and public123 123/123 zero-credit plus native metadata/one-evaluation
capture. The unrelated stage2 diagnostic runner failure remains recorded and is
not a new full gate. Current repair commands/results and refreshed hashes are in
the current card status and `work:///cards/card-t-c/review33-repair/`.
[Historical attempts](card-t-shared-subquery-owner-history.md)
preserve failures, prior predictions, commands and source comparisons; their
nine-test/unchanged-carrier/pending-star statements are superseded, not current.

## Assembly guidance

[Exact artifact manifest](card-t-shared-subquery-handoff-manifest.json) authenticates
HEAD, index, baseline65fbeda→revised overall and the reconstructed own delta with
file hashes and hunk ranges. Include the own-delta semantic owner/caller changes
and scoped tests/docs as a coherent bounded slice; preserve baseline peer Boolean,
Mem/KeyInfo, schema/STAT4/STRICT/bitwise and staged inversions. The delta is relative
to the captured dirty baseline, NOT a standalone HEAD patch. `select-program.ts`
has no new delta relative to that baseline: its atomic validation remains a
required baseline dependency. Whole-file/whole-overall-patch staging is excluded;
[[card:card-i]] must assemble overlaps against its target tree. No commit/staging/
reset/ref or index changes were made. Broader independent evaluator, comparison,
ordered/AggInfo and release assembly are outside this handoff.
