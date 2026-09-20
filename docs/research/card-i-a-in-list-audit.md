# Value-list IN audit correction

Date: 2026-09-19

Owner: [[card:card-i-a]]

Scope: tests-first research only; no runtime repair.

## Supported conclusion

The bounded conclusion is **supported**: the external lead reproduces as a
currently unimplemented value-list `IN` boundary, not as evidence of a general
`OR` defect. This conclusion supports a source-shaped implementation handoff and
regression plan only. It does not establish value-list `IN` compatibility, repair
the runtime, or promote any conformance credit.

## Evidence

Commit baseline includes REAL read/accessor repairs `ad433c2`, `f49f71f`, and `b74093a`, plus the existing subquery-IN nested-cursor foundation `f48a4c2`. The finite lane declares 21 SQL cases and executes each against UTF-8, UTF-16le, and UTF-16be databases (63 executions). `capture-audit-in-list.py` asserts exact pinned SQLite 3.53.4 source ID before creating fixtures and typed captures. Fixture hashes are committed. The public runner executes every case twice across reset, applies parameters where declared, preserves INTEGER/REAL/TEXT/BLOB/NULL distinctions, and awards zero credit.

Pinned inspection covered `src/expr.c` `sqlite3FindInIndex` (line 3230) and `sqlite3ExprCodeIN` (line 4029), including NOOP versus ephemeral RHS selection, affinity, `rRhsHasNull`, LHS NULL, `OP_Found`, fallback scans, and false/NULL destinations; and `src/vdbe.c` `OP_If`/`IfNot`/`IsNull`/`NotNull` and `OP_Found`/`NotFound` branches. This is a separate value-list lowering/caller boundary. The `f48a4c2` subquery-IN ephemeral set and nested cursor relocation foundation remains supported and must not be replaced.

## Reproduced lead and supported boundary

The exact lead schema is captured: `orders(id INTEGER PRIMARY KEY,user_id INTEGER,amount REAL,note TEXT COLLATE NOCASE)`. Pinned native returns ids 10/11 for `WHERE id IN(10,11)` and ids 10/11/13 for `id IN(10,11) OR id=13`. Current public TS rejects both at prepare with temporary unsupported `SELECT expression is not implemented`, consistently across three encodings and reset attempts. Thus the lead reproduces as a missing value-list IN boundary, not a wrong-result implementation.

All value-list IN/NOT IN cases are currently rejected before execution: empty list, singleton/multiple/duplicate/NULL RHS, NULL lhs, mixed classes, affinity/collation, expression/parameter inputs, projection/WHERE, work-bound case, and REAL regression. The currently supported nearby boundary is scalar comparisons and OR lowering, plus separately existing subquery IN. Ordinary scalar `id=10 OR id=11` and independent `a=1 OR b=2` exactly match native across all encodings and reset (six matches total). The OR-defect hypothesis is therefore disproved for those isolated current paths; this does not establish every OR/control-flow branch.

## Native semantic discriminators

Pinned capture records empty IN as false and empty NOT IN as true even for NULL lhs; RHS NULL yields NULL on a miss; duplicates do not alter membership; INTEGER/REAL/TEXT and column affinity/collation outcomes remain typed. Native `1 IN(1,abs(INT64_MIN))` returns 1 without evaluating the later erroring RHS. Conversely projection `1=1 OR abs(INT64_MIN)` raises overflow: SQLite does not promise general projection OR short-circuit. The WHERE analog returns all rows natively; current TS raises overflow there, exposing a separate boolean-caller issue but not explaining the lead's prepare-time rejection.

## Dependencies and regression plan

Implement value-list IN by extending generated AST/resolution and source-shaped `sqlite3ExprCodeIN` lowering through existing VM/Mem/ephemeral cursor primitives. Do not replace subquery IN or add host/evaluator shortcuts. Preserve distinct empty/false/NULL truth destinations, comparison affinity/CollSeq, lazy RHS behavior, parameter binding/reset, lifecycle cleanup, deterministic private state and work charging.

REAL repairs require explicit regression preservation: `lead-in-two`, `parameter-where`, and `real-regression` capture `amount` as REAL with `typeof(amount)='real'`; the aggregate case pins REAL `sum(amount)` and `typeof(sum(amount))='real'`. The TS runner's `columnType` plus typed accessor path must match these once value-list admission exists. Current rejection means no claim is made yet about these consumers behind IN.

## Limitations and recommendations

This lane is no-credit and does not implement IN. The work-bound case currently stops at prepare and therefore cannot validate translated operation accounting. Reset is attempted only for successfully prepared statements. Exact cleanup/private-state bounds need implementation-side tests after lowering exists. The WHERE short-circuit discrepancy requires its boolean owner, while projection OR behavior must retain native eager error semantics. Rerun all 63 cases after value-list admission and promote only exact typed outcomes. Keep existing `subquery-view-foundation.test.mjs` selected IN/nested-cursor tests as independent regressions.

### Evidence limitations

- Only the six scalar-`OR` control executions run successfully through public TS.
  The other 57 encoding executions are mismatch/unimplemented observations,
  predominantly prepare-time rejection, rather than semantic TS executions.
- The `OR` conclusion is limited to `a=1 OR b=2` and `id=10 OR id=11` over the
  stated fixtures and reset. It is not a general control-flow claim. The separate
  WHERE error-non-evaluation mismatch remains open.
- Parameters and reset are represented in the lane, but rejected `IN` statements
  cannot establish binding, rerun, cleanup, first-error, cancellation, deadline,
  private-state release, or execution-work behavior.
- The runner compares typed rows. It is not the project's stronger exact ordered
  metadata/error phase/code/message gate.
- Three database encodings are pinned, but integer-heavy lead queries do not by
  themselves stress encoded text. The text/NOCASE inputs remain future execution
  checks because TS currently rejects them.
- REAL `columnType`, accessor, `typeof`, and `sum` expectations are pinned as
  regressions, but they do not yet execute behind public value-list `IN`.
- The focused preservation rerun covers selected UTF-8 subquery-IN cases. It is
  evidence for retaining that foundation, not exhaustive subquery compatibility.

### Recommended handoff

1. Add value-list `IN` to generated semantic nodes and resolver/compiler lowering
   by translating the relevant `sqlite3ExprCodeIN` branches over existing
   Mem/ephemeral/branch primitives. Do not add a substitute evaluator.
2. Preserve `f48a4c2` subquery-IN cursor relocation and ephemeral-set behavior;
   retain its tests independently from the new value-list lane.
3. Rerun all 63 executions after admission. Add exact metadata/error validation
   and reachable operation-limit, abort/deadline, cleanup, and private-state tests.
4. Keep the six scalar-`OR` controls and the WHERE error-non-evaluation
   discriminator so value-list work does not mask the separate boolean issue.
5. Preserve REAL column/accessor/`typeof`/`sum` assertions and grant credit only
   when exact public typed outcomes execute and match.
