# Value-list IN audit correction

Date: 2026-09-19

Owner: [[card:card-i-a]]

Scope: tests-first research only; no runtime repair.

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