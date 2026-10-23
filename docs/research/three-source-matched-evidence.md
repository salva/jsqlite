# Three physical-source matched RIGHT/FULL candidate

This is revision-bound author evidence for the extension delivered in
27e27899f83367e523dffd3fcb2c0636b25cb4f5 over
c00afbdbf3065dfbbe28346d331fd87b91844321, not independent acceptance or a
replacement public contract. Current completion state: [card status](record:///status.md?card=card-s-c-d-e).

## Source/caller comparison and boundary

`where.c:whereLoopAddAll` mPrior/mPrereq/bFirstPastRJ/hasRightCrossJoin
transitions map to where-plan.ts joinBarrier/firstPastRight/hasRightCross.
The resolver's original `leftOfRightJoin` and join owner ordinals remain semantic
identities; source ordinals are not renumbered after path construction. Admission
is at most three physical rowid tables, one RIGHT/FULL barrier, no USING/NATURAL.
Repeated barriers, WR and modules retain fallback, not selected-access credit.

`whereexpr.c:exprAnalyze` ON ownership and `where.c:termCanDriveIndex` remain
responsible for legal driving constraints. This candidate retains the prior
conservative owned-ON-only, no-residual-omission boundary. It does not yet translate
all native downstream WHERE access. The previously suspected AddAll term-dependency
augmentation at where.c:4994–5004 is guarded by `fg.fromExists`, NOT LTORJ; the
current resolver has no fromExists source carrier. It is not a missing LTORJ
branch in this bounded physical-table path. Full bounded caller availability follows from the flags, not only finite checks:
for one RIGHT at original ordinal1, ordinal0 is LTORJ, setting hasRightCross;
RIGHT1 adds bit0 and firstPastRight forces ordinal2 (if present) to depend on
bits0–1. For RIGHT at ordinal2, ordinal1 is LTORJ and depends on bit0;
RIGHT2 depends on bits0–1. FULL also sets LEFT/RIGHT and follows those branches.
Thus every possible permutation in the admitted two/three-source layouts is
source order. Prereq masks from expressions can only add dependencies; the path
solver cannot select a forward-reference loop before its dependencies. Absent a
legal path, no selected handoff occurs. This is a bounded admission tradeoff, not
a browser necessity or algorithm exception.

VDBE selectedBySource consumes immutable loops by original ordinal. Outer/right
execution retains original source order; it does not consume a permuted solver
order. Existing rightStates are per-level. Selected physical index-tail rowid is
read before Found/IdxInsert and WHERE; the unmatched drain starts a fresh primary
scan. No parallel matcher or VDBE production change was needed in this candidate.
The original-ordinal caller therefore consumes the same ordering permitted by
this bounded solver. Each RHS level owns its ephemeral match cursor, key registers,
return register and continuation labels. Found/IdxInsert precedes WHERE; LEFT
NullRow covers table and index; reverse normal-loop closure precedes the forward
fresh-primary unmatched drain. These identities are not shared with the downstream
source. Reset/finalize owns the existing program cursor/register cleanup. Wider
layouts are not justified by this ordering argument and remain fallback.

## Retained native-first evidence

`three-source-red-capture.py` generates `three-source-native.json`: fixture hashes,
five metadata fields, typed rows twice/reset, EQP, pinned SourceID and library hash.
The corpus now has 60 cases: RIGHT/FULL forced/unforced/NOT INDEXED, CROSS-only control,
LEFT before/after RIGHT, RIGHT at original ordinal2, ON versus WHERE filters and
no ON matches, expression/partial eligibility, correlated RHS and wrong-alias
negative control, across UTF8/16le/16be. `partial-unproven` keeps its predicate
only in WHERE: both native and TS scan the matched RHS (native may use p_live
only for its separate unmatched drain). This earns no matched-access credit.
The post-WHERE empty output is distinct from `physical-empty`, whose pinned-native
fixture copy adds an actually empty physical LHS table. Its hash and bytes are
retained in the receipt; five unmatched RHS rows appear twice/reset, with zero
index seeks because no matched-pass probes execute despite the selected plan.
Public `three-source-right.test.mjs` checks
metadata/rows/hash/reset and real seek work, including zero seeks for NOT INDEXED.
It is integer/NULL evidence, not exhaustive mixed-type/correlation coverage.

`right-matched-safety-capture.py --three-source` generates
`three-source-safety-native.json` with 48 twice/reset cases (36 corrupt required,
LIMIT0 and NOT INDEXED controls plus12 intact capacity controls). It uses the same
pinned library as the row capture. `right-matched-safety.test.mjs` now runs the
original two-source corpus unchanged and this new layout: selected malformed-read
error identity, next-step cancel/deadline/work failure, exact one-rowid capacity,
private-byte refund and reset/finalize/reuse. These are representative composition
controls; API work/private-budget thresholds are not native threshold equality.

`right-residual.test.mjs` observes/injects both downstream table root4 and covering
index root7 first positioning. The old scan-only hook missed newly selected
covering execution. Count1 and saved-error/cleanup assertions are retained.

## Expression identity correction

The new qualified-alias expression case reproduced no selected seek even though
native searched e_expr. indexedBinding and admitIndexConstraint compared lexical
qualified query leaves against unqualified schema leaves. expr.c sqlite3ExprCompare
recurses over semantic columns and accepts the designated query cursor in place
of schema cursor -1 (including iColumn equality). The planner now resolves each
query column leaf to the designated source before using its schema name in the
existing structural identity, and carries that identity into immutable WhereTerm
for admission. A different alias is never normalized into the indexed source;
wrong-alias control requires zero seeks. This is a correction to expression
binding/admission, not a SQL-text special case or relaxation of ON ownership.
Full expressions remain structurally compared; no algebraic equivalence is added.
The caller retains source-order execution rather than arbitrary solver permutation. The bounded
ordering argument above is independent of the finite prefix assertions. Named
negative planner controls additionally retain fallback for repeated RIGHT, four
physical sources, USING and WITHOUT ROWID; these are not SQL rejection claims.

## Current disposition and retained revision limits

The original STAT4 owner corrected the obsolete c00afb RIGHT+CROSS fallback
witness to repeated RIGHT in343e without dropping truth/reset/publication assertions.
Independent [[card:card-s]] [review18](record:///review.md?card=card-s&v=18)
accepts the finite source/caller extension on343e; it supersedes the G76/22-of23
open-gate disposition, not the historical failed execution. Prior revision detail
is retained in [G76](record:///status.md?card=card-s-c-d-g&v=76).

ROOT execution and exact artifact reconciliation are maintained in [[card:card-w]]
[status](record:///status.md?card=card-w). The W test-only downstream observer repair
on71015097 observes root4.first and root7.first/seek and retains explicit NOT INDEXED
scan controls. Pinned wherecode.c `codeAllEqualityTerms` NULL guards precede equality
seeks; therefore physical seek counts need not equal downstream scan starts.
Typed rows/metadata, reset and first-error/cleanup assertions remain required.
Neither local approval nor ROOT regression evidence implies repeated/wider/WR/module/
USING selected-layout parity, exhaustive compositions, or release authorization.
