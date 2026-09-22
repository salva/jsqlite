# Chinook B1/B5 tests-first audit

Date: 2026-09-22

Owner: [[card:card-i-a]]

Scope: finite source-pinned verification only; no runtime repair.

## Supported conclusion

The bounded conclusion is **supported**. B1 is a current generated-BETWEEN
admission/lowering boundary: pinned native behavior is captured, while public TS
rejects the selected statements before execution. B5 is a narrower exact-source-
span naming issue for selected unaliased computed expressions, not evidence of a
general naming, JSON, or float-formatting defect. This conclusion authorizes an
implementation handoff and regression plan only; it does not establish
compatibility or promote conformance credit.

## Provenance and method

Evidence runs on the settled tree containing `18e3a34` and `5e1df97`. The oracle loader asserts SQLite 3.53.4 source ID `2026-07-24 19:02:57 bf7c7f...59bcc`. Chinook is independently fetched from the URL in `test/fixtures/public/chinook.json` and checked against SHA-256 `7651ba...61f15`. The corpus has 22 cases and 56 fixture/encoding executions plus exact native-only upstream assertions `e_expr-13.1.2` and `.4`. Captures preserve ordered names, typed rows, errors, and reset codes. Public executions compare exact names and typed rows, repeat after reset, and award zero credit.

Pinned inspection covered generated `expr ::= expr between_op expr AND expr`, `src/expr.c` `sqlite3ExprCodeTarget`/`sqlite3ExprIfTrue`/`sqlite3ExprIfFalse` comparison and BETWEEN branches, and `src/select.c:sqlite3GenerateColumnNames`. For result names SQLite prioritizes AS; direct resolved columns use their column name (subject to name pragmas); otherwise `sqlite3DbSpanDup` preserves expression `zSpan`. This is source-span behavior, not pretty-printing or token joining.

## B1: BETWEEN

Native Chinook returns INTEGER 115 for `Total BETWEEN 5 AND 10` and INTEGER 297 for NOT BETWEEN. Current public TS rejects both at prepare as temporarily unsupported `SELECT expression is not implemented`. All synthetic BETWEEN cases are likewise rejected, so B1 is reproduced as an admission/lowering boundary, not a wrong result.

The native corpus pins projection and WHERE, NULL lhs/bounds, equal/reversed bounds, INTEGER/REAL/TEXT comparisons, NUMERIC/REAL affinity, explicit NOCASE placement, parameters, and error/control behavior. Upstream `e_expr-13.1.2` and `.4` plus the source-ID-checked C probe record one invocation of `x()` rather than two. Error probes distinguish a required lhs/upper comparison from a lower-bound failure that can avoid evaluating the upper error. These are implementation targets; the product has no host function registration API and the native-only call-count assertions receive no TS credit.

## B5: result names and spans

Native preserves the exact original UTF-8 expression spelling:

- spaced: `e1 . FirstName || ' manages ' || e2 . FirstName`;
- unspaced: `e1.FirstName||' manages '||e2.FirstName`;
- comments: `first /* left */ || '-' || last`;
- punctuation/Unicode: `'雪:' || first || '!'`.

AS produces `manager_line`. Duplicate unaliased expressions retain duplicate ordered names. Direct `names.first` and `names . last` produce `first`, `last`, not their qualified source spans. This distinction also applies to direct `je.value`: native name `value`; JSON table-function ownership is separate and no JSON support inference is made.

Current TS exactly matches the spaced Chinook expression, alias, Unicode/punctuation, duplicate names, and qualified direct-column names. It fails the unspaced neighbor by returning the prior spaced spelling and fails comment preservation by replacing comment bytes with spaces (`first            || ...`). Thus B5 is reproduced narrowly as loss/reuse of exact source expression spans. Values match in these cases; this is metadata, not float formatting.

## Accounting, uncertainty, and handoff

Current public accounting is 11 exact executions and 45 mismatch/unimplemented, all zero credit. Most mismatches are B1 prepare rejection. B5 mismatches are exact ordered-name differences. This does not establish full naming compatibility: pragma variants, nested/compound naming, quoted identifiers, schema rewrites, or JSON table functions are outside this lane. Three synthetic database encodings exercise values, but SQL input remains UTF-8 JS strings and names are expected UTF-8 API strings.

Implement B1 through generated BETWEEN semantic structure and source-shaped comparison/control lowering, evaluating lhs once and preserving affinity/CollSeq/NULL/error order. Do not rewrite to independently evaluated lhs comparisons. For B5 retain exact byte spans from original SQL through reductions and use them for unaliased computed-expression names; never pretty-print or join normalized tokens. Keep alias priority and direct-column naming separate. Rerun all 56 executions and the native-only probe; add reachable work/cancel/cleanup tests after admission. Promote credit only from exact public typed rows, ordered names, errors, and reset behavior.

## Assessment limitations and uncertainty

- Every selected public B1 statement stops at prepare. The lane therefore does
  not establish TS comparison results, parameter behavior, row filtering,
  reset/rerun, cleanup, first-error ordering, work limits, cancellation, or
  deadlines for BETWEEN.
- The lhs-once assertions use a development-only native function and establish
  pinned SQLite behavior only. They do not imply a public host-registration API.
- The B1 affinity, collation, NULL, and error/control cases are finite. Vector
  BETWEEN and planner/index effects are not covered.
- Three database encodings are exercised, but SQL enters public TS as UTF-8
  JavaScript strings; alternate SQL-source encodings are not tested.
- B5 compares selected ordered names and typed rows, not complete origin metadata
  or all exact error fields. Naming pragmas, quoted-identifier and parenthesis
  edges, nested/compound naming, generated rewrites, and schema changes remain
  outside the lane.
- The sequence exposes unspaced-name reuse, but evidence does not yet localize the
  cause to parser span retention, compiled-program/cache reuse, or later metadata
  construction. The owning path must be inspected before repair.
- Comment replacement establishes loss of those original comment bytes, not that
  every comment syntax or placement fails.
- Chinook is fetched and hash-checked rather than committed, so reproduction needs
  the public URL or another byte-identical file.
- All observations remain zero credit. Eleven passing neighbors narrow the defect
  but do not constitute evidence promotion.

## Recommended handoff

1. Implement BETWEEN through generated semantic structure and the pinned
   expression target/true/false control owners. Preserve one lhs evaluation,
   affinity, CollSeq, NULL truth, lazy comparison control, and error ordering.
2. Diagnose B5's owning path, then preserve exact original UTF-8 byte spans through
   reductions for unaliased computed names. Retain AS priority and direct resolved-
   column naming. Do not pretty-print or join normalized tokens.
3. Keep `je.value`-style direct-column naming separate from expression spans and
   JSON table-function support. Do not alter float formatting for this issue.
4. Rerun all 56 public executions and the native once probe after repairs. Add
   reachable lifecycle, work/cancel, complete metadata, and exact-error checks.
5. Promote only exact public typed rows, ordered names, errors, and reset behavior.
