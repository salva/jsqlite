# Independent STRICT boundary coverage

Companion to [original delivery](README.md), not a replacement for its chronology.

`capture-boundaries.py` checks manifest SQLite 3.53.4 source ID before independent
native acquisition. Images remain in the card-purpose `strict-boundaries` work
area; `boundaries-native.json` retains digest/encoding/DDL error and typed oracle
receipts. Native acquisition precedes running the new assertions, not the
original implementation. No Python sqlite module is an oracle.

`boundaries.test.mjs` checks all six accepted-type affinities, explicit NOT NULL,
inline INTEGER PK DESC vs table-level DESC, composite/STRICT WITHOUT ROWID PK,
typed ANY TEXT/BLOB/int64/NULL VIRTUAL+STORED rows and reset/binding reuse,
REAL generated rows, generated NOCASE indexed-column query, and competing PK
and STRICT errors in all three encodings. Index query success is observable
behavior, not proof of index plan choice or generic expression-index parity.

Current exact MAIN e49c42cacfaf9004c866ccd08aea294b8cb1e720 and independently
archived committed source both yield **15/24 pass, 9 failures** (no skips).
Three REAL tests: `r` and STORED `sr` are REAL7, VIRTUAL `vr` is INTEGER7 rather
than pinned REAL7. Six schema tests: unknown datatype wins in TS, whereas pinned
PK missing-column and generated-PK rejection occur first. Other metadata,
typed ANY/reset/indexed-column cases and unknown-type-vs-aggregate-generated
error precedence pass. First failed combined REAL row prevents that test's
later rows/reset; separate ANY-only query covers all four values/reset.

Source comparison: build.c makeColumnPartOfPrimaryKey rejects generated PK
before sqlite3EndTable STRICT; missing PK name resolution likewise precedes
that pass. TS validates STRICT before declaredPrimaryKey lookup and lacks
this early generated-PK control in the affected path. expr.c
sqlite3ExprCodeGeneratedColumn emits TypeCheck for STRICT VIRTUAL values during
**reads**, rather than generic Affinity alone. This is distinct from write
constraint enforcement, which remains outside scope. Catalog affinity metadata
alone does not establish this STRICT generated-read behavior. No fixes made.

Actual commands/results and preservation checks are in
[[card:card-e-l]] status; main/export logs in card work `strict-final/evidence`.
Prior original delivery green suites do not erase these new source-bound failures.
NC_GenCol/lazy-schema/generic expression-index validity remains progressive;
these failures are finite ordinary-read/control-order obligations, not a whole
corpus requirement. No presumed peer prerequisite without reproducing its route.

## Owning repair checkpoint

Working-tree repair adds single-column read TypeCheck to shared lowering and
both generated binders; PK declaration validation now precedes STRICT types.
Fresh boundary24 + original STRICT12 pass36/36, functional183 + schema/storage373
pass556/556; typecheck/diff pass. Earlier failures above remain revision-bound
evidence for e49c42, not current behavior. Repair is uncommitted; no exact
new-delivery identity is claimed. Details and initial incomplete-binder attempt
in card-e-l status.
