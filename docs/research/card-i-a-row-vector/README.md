# Current row-value/vector tests-first baseline

Owner: [[card:card-i-a]]. Date: 2026-10-13. Evidence-only; no runtime repair.

## Revision and identity

HEAD at capture is `3376615bca981c8d4fc5a2fb9da9b3dde60a4039`, the accepted
STRICT schema milestone. **Public observations are shared dirty-worktree evidence,
not behavior attributable solely to that commit.** Peer staged and unstaged edits
include parser/resolver/VDBE/admission/index/API/schema work and research/docs.
`test/conformance/row-vector/provenance.json` records affected paths and current
content SHA-256; no peer edits are staged, committed, reverted, or repaired here.
The historical `fc2d3.46.1` diagnostic was not used as current proof.

Native build/capture asserts SQLite **3.53.4** source ID
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
Source manifest is unchanged. Product remains browser-safe read-only TS; native
SQLite is development-only oracle infrastructure. Existing guide gates are not
used as evidence of current runtime behavior.

## Pinned tests FIRST and finite corpus

`test/conformance/row-vector/spec.json` pins SQL before capture; `native.json`
records typed INTEGER decimal, REAL bits, TEXT UTF-8 bytes, BLOB bytes, NULL,
ordered names, errors, and reset codes. Fixtures cover UTF-8/UTF-16le/UTF-16be.
Exact selected upstream assertions:

- `rowvalue.test:1.1/1.3/1.7.eq/ne/is/isnot` (12 assertions): equal vectors,
  undecidable NULL equality, and later unequal fields defeating earlier NULL.
- `rowvalue.test:2.1.lt/gt/le/ge` (4): lexicographic comparisons.
- `rowvalue.test:5.1`–`5.6` (6), with exact t1 setup: row-value IN/NOT IN
  membership, NULL undecidability and definite mismatch despite NULL.

Other cases are labeled no-credit companions, not upstream assertion credit:
literal row RHS, VALUES RHS, empty subquery, duplicate rows, mixed INTEGER/REAL/
TEXT/BLOB, explicit and column collations, per-field affinity, erroring later field,
width mismatches, row projection misuse, joins, correlated IN, multi-column scalar
subquery, projection/WHERE, parameter inputs, and scalar IN/CASE/BETWEEN and metadata
controls. **41 cases × 3 encodings = 123 attempts; 6 typed/name/reset matches,
117 mismatch/unimplemented; all zero credit.** Matches are the two scalar controls
in each encoding. Every selected vector use fails public admission; some
multi-column child forms fail earlier as `sub-select returns 2 columns - expected 1`.

Pinned 3.53.4 accepts `(1,2) IN ((1,2),(3,4))`; do not gate it based on older
row-RHS restrictions. Native lazy-error companion `(0,abs(INT64_MIN)) < (1,0)`
returns 1 without evaluating field 2; the equal-leading-field neighbor errors.
Native unequal width and naked row projection report `row value misused`;
IN child width reports `sub-select returns 1 columns - expected 2`.

## Actual source owners and current caller gap

Routine names verified in pinned source (not invented `vectorCompare`):

- `parse.y:1333` `expr ::= LP nexprlist COMMA expr RP` constructs `TK_VECTOR`
  with ordered `ExprList`; `parse.y:1518–1543` transforms vector literal IN RHS
  into a VALUES-style Select. Retain generated reductions and original spans.
- `expr.c:463` **codeCompare** obtains per-field `sqlite3BinaryCompareCollSeq`
  and `binaryCompareP5` affinity/NULL flags. `expr.c:698` **codeVectorCompare**
  checks widths, codes subselects once, obtains field registers and semantic
  expressions via `exprVectorRegister`, invokes codeCompare, releases temporary
  registers, uses `OP_ElseEq` for lexicographic continuation, and preserves NULL
  via the source result/branch protocol. Do not compare JS arrays.
- `expr.c:3230` **sqlite3FindInIndex** and `expr.c:4029`
  **sqlite3ExprCodeIN** own RHS materialization, per-field affinity/map,
  Found/NotFound, false/NULL destinations and fallback scans. A vector containing
  NULL is not globally unknown: a differing non-NULL field can establish false.
- `resolve.c` resolves child names and expression collations through NameContext;
  vector size/control checks also live in expr.c, not a single resolver routine.
- `vdbe.c` comparison opcodes and `OP_ElseEq` consume comparison state; IN Found/
  NotFound consume KeyInfo field affinities/collations. Mem owns scalar storage;
  vector ownership is expression-list plus contiguous register ranges, not a new
  public storage class.

Current TS preserves the reduction carrier (`parse.ts` ExprNode.reduction) but
`vdbe.ts` Expression and `expressionFromReduction` have no vector variant or
handler for the generated vector production. `resolve.ts:resolveNested` globally
requires one output column; `vdbe.ts` scalar-subquery callers likewise assume one
result. Existing resolver vector-first helpers do not provide a vector execution
path. The observed errors confirm two separate prerequisites: generated vector
semantic/lowering admission, and context-sensitive child width/destination
ownership. Relaxing every scalar subquery width check would be incorrect.

## Bounded implementable slice and handoff

1. First functional slice: generated vectors of width >=2 in all eight comparison
   operators and literal/VALUES IN, with projection/WHERE/join callers. Retain
   ordered fields and per-field semantic affinity/CollSeq, width checks, original
   result spans, NULL rules and source-shaped opcode control. Use existing Mem
   registers and comparison primitives; a source-shaped scan is acceptable.
2. Extend shared subquery expression carrier with expected width and contiguous
   result registers, selecting scalar width 1 versus vector width N from its
   consumer. Preserve one evaluation of multi-column scalar children, empty-child
   NULL fill, first-row destination, correlation identity, and temporary/private
   cursor lifetime. This is a genuine shared prerequisite for subquery comparison
   and correlated IN, routable by root to [[card:card-m]]/[[card:card-t]] owners;
   do not add a parallel query evaluator in this slice.
3. Translate RHS row materialization/scan and NULL fallback using existing
   ephemeral/KeyInfo machinery. Scalar IN/CASE/BETWEEN must continue using their
   existing paths. Optional vector index search/reordering optimization is backlog,
   not a reason for rejecting source-legal vectors or declaring safe scans wrong.
4. Release temporary field registers after source comparison sites, retain child
   result registers across field consumption, and clear/reset private RHS state at
   the same lifecycle boundaries as existing subquery primitives. First-error
   ordering and cancellation/deadline/work checks stay shared VM responsibilities.

## Full residuals and limits

No runtime implemented; no release claim. Vector comparisons/IN, joins,
correlation, multi-column destinations, and parameter-vector execution are still
unimplemented in this lane. The runner records/reset-reruns only admitted scalar
controls; vector cleanup, reset, binding retention, first-error identity, resource
limits, abort/deadline and reprepare remain unverified. Native reset codes are
captured, not a native rerun. Exact error phase/code/message comparison and full
origin metadata are not acceptance-enforced by the reused public audit runner.
Evaluation-count callback tests and exact multi-column child single-evaluation
proof remain required; the erroring-field discriminator proves laziness only.
Further residuals: vector BETWEEN/CASE, wider/vector-of-subquery arrangements,
additional collations, nested/outer joins, correlated limits/order/empty cases,
width-error precedence, binding storage classes beyond INTEGER, repeated rebinding,
index/STAT4 plans and vector index optimization. Do not disturb staged peer STAT4,
doc, bitwise, schema, research, or index work.

## Reproduction

```sh
sh tools/oracle/build.sh
python3 test/conformance/row-vector/capture.py \
  "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" \
  > "$SAIVAGE_CARD_WORK_ROOT/row-vector-recapture.json"
cmp test/conformance/row-vector/native.json "$SAIVAGE_CARD_WORK_ROOT/row-vector-recapture.json"
python3 test/conformance/row-vector/manifest.test.py
node --experimental-strip-types test/conformance/row-vector/public.mjs
```

Native builds/caches stay under the card work root. The runner reports gaps with
exit 0; that is successful evidence collection, not conformance success.
