# Ordered filtered table merge repair — revision-bound evidence

For [[card:card-j-d-b-a-c]], consuming the bounded ordered-filtered design.
Current HEAD fb4974a; this evidence concerns changed working-copy vdbe and
compound-filtered-parameters regression, not a committed MAIN acceptance.
Real index SHA 8e6ba52cac5a07960972458179f59149bd9a63d1ec5e8ba96307605fdc822181
remains preserved. No unrelated source bytes discarded or staged.

## Owning source comparison

Pinned select.c multiSelectByMerge initial Yield A targets addrEofA_noB;
EXCEPT/INTERSECT bind that directly to labelEnd. UNION/ALL must position B
before draining it. Ordinary table scan previously eagerly populated both arms
in a global set; filter correctness alone did not prevent unused B errors.
Now existing resolved scan (WHERE before expression/DISTINCT) emits rows into
per-arm sorter coroutines in the enclosing builder. The shared merge has
operator-specific initial EOF, existing less/equal/greater/EOF continuations,
separate duplicate/merge KeyInfo and previous-row-before-OFFSET ownership.
Non-ALL merge keys append missing result ordinals. Generated graph remains
unmodified; coroutine destination tail and sorter callback are distinct callers.
Unordered table sets are unchanged. Explicit COLLATE wrapper keeps preceding
metadata ownership and composes merge then outer sorting.

## Attempts and verification

- v233/proc-058dbcb55808 native-FIRST manifest-sourceID assertion and read-only
  current compound-metadata: empty A EXCEPT/INTERSECT DONE twice/reset;
  UNION/ALL error1. Original public returned overflow for all eight steps,
  assertion four failures. Adequate unchanged probe retained in card-work merge-red.
- proc-630d2bc7d1c3: first same-VM route+initial EOF correction typecheck and
  exact probe pass. proc-789ffb590814 focused62/public22 pass before new test.
- proc-669b633fe02d fresh native-FIRST expanded three-encoding acquisition then
  public probe **exit1**: 66 row/metadata matches, three mixed COLLATE UNION/ALL
  row differences, 12 expected errors. Hypothesis that callback alone sufficed
  was false: unordered ALL tail invokes coroutine destination, not sorter callback.
  Corrected destination ownership at arm caller; no expected results changed.
- proc-f7ba62e06616 public rerun against that independently obtained native:
  69 matches (typed rows/five-field metadata, twice/reset),12 expected errors,
  exit0. No new conformance credit.
- proc-8048c46900ae: typecheck; preserved exact probe; six focused fixtures
  63/63; public gate22 declared/attempted/passed/credited; diff check pass.
  New regression covers initial-empty A, nonempty A runtime error, LIMIT0 plus
  invalid OFFSET producer bypass and reset; previous lifecycle/params remain.
- Added missing ordinal completion at shared owner following source comparison;
  proc-b46ddcc39dbb collation+filtered9/9, typecheck/hygiene pass afterward.

Commands use `node --experimental-strip-types`, existing six fixtures
compound-{filtered-parameters,values-unsupported,collation,union-all},
derived-values-registers, relational-private-lifecycle; public gate via
`npm run test:conformance:compound:ts`. Expanded capture/probe commands use
COMMON_CHECKPOINT_SOURCE=current project and COMMON_CHECKPOINT_OUTPUT=purpose-named
card-work/native-expanded, pinned existing libsqlite3-oracle.so validated by capture.py.
Complete partial process streams are retained under returned work URLs.

## Open scoped work (not blocked)

ALL producer capacity propagation, source balanced splitting and deterministic
comparison-term work accounting need completion and focused discriminators;
shared ORDER semantic resolution needs consolidation with the earlier table
resolution (currently validation is duplicated). Minimal HEAD-relative integration
must preserve peer index/worktree effects, not import dependency5824904 or sweep
120/3279 paths. No actual MAIN commit or required full affected bootstrap rerun
is claimed. Root/full-w remains root-owned. Useful next attempt is complete these
shared merge owners and inventory before scoped MAIN delivery. Passing this
reproducer is not complete acceptance of original R1/R2 requirements.

## Continuation: balanced splits, capacities and shared comparison work

2026-10-14 working-copy evidence, not MAIN acceptance. HEAD and real index
were inspected first (proc-b3c4a75fcc07); fb4974a and index
8e6ba52cac5a07960972458179f59149bd9a63d1ec5e8ba96307605fdc822181 unchanged.
Pinned select.c3539–3575 splits only maximal identical UNION/ALL suffixes:
for runs <=3 take final arm, otherwise ceil(run/2) on right; mixed prefix stays
left-associated. TS uses first/count ranges, never mutating retained links.
ALL copies root LIMIT+OFFSET capacity separately into A/B, recursively; leaf
SorterInsert uses topN, coroutine delivery decrements its independent counter.
Set producers have no caps. Negative capacity remains unlimited. Root count and
OFFSET retain existing ownership. OP_Compare2490ff lexicographic early-exit,
permutation, NULL/DESC remain unchanged; each visited term in CompareJump and
CompareGroup now charges/checks/yields through the shared private work owner.
This is deterministic browser resource accounting, not native opcode-count parity.

proc-7dc4dd071def: typecheck, focused compound tests and public22 pass.
proc-4448f437da19: typecheck and filtered/collation9 pass after term accounting.
Native FIRST proc-2befb48b3329 used the existing sourceID-validated oracle:
COMMON_CHECKPOINT_SOURCE=$PWD, COMMON_CHECKPOINT_OUTPUT=$SAIVAGE_CARD_WORK_ROOT/merge-next/native-expanded;
python3 docs/research/card-j-d-b-a-c-filtered/capture.py
$PWD/.saivage/work/cards/card-e-h/oracle-build/build/libsqlite3-oracle.so,
then public-probe.mjs. Added 26 queries (4–7 arms, UNION/ALL, DESC/offset,
negative limits, mixed operators), 147 typed-row/five-field metadata matches,
12 expected errors, three encodings twice/reset. Capture/public succeeded;
trailing diagnostic grep finding no differences made overall command exit1,
not a successful whole batch. Retained expanded.log/native.json in merge-next.

proc-7f45355135cf: typecheck, preserved merge-red probe, six focused fixtures
64/64, public22 declared/attempted/passed/credited, diff check pass.
proc-a89c495c9113: compound-union-all25/25 including additional source/opcode
ownership test; asserts seven capped leaf insertions only for ALL, six merge
comparisons and one public Halt. No expected values changed.
proc-af3420206608: parser35, firstSELECT8, expressions40 pass; nonexistent
relational npm script stopped remainder (exit1). proc-195f040d6b4d correct
relational runner3/18 (15 unattempted,2 credits), ORDER10 pass; nonexistent
encoding/resource filenames stopped remainder (exit1). proc-cf9027ce045a
correct DISTINCT6 plus storage31, encoding3, six bounded expression checks,
package-boundary pass; exact completed output retained by tool. These diagnostic
path mistakes are not product failures and not all-green batches.

Changed vdbe, compound-union-all tests, capture.py and current guide/map/audit;
API admission unchanged. No MAIN commit or index rewrite. Remaining useful
attempt: consolidate shared/table ORDER resolver ownership, reconcile minimum
HEAD-relative prerequisites without peer metadata/STAT4 diagnostics sweep,
then scoped MAIN commit and exact committed-source bounded verification.

## Minimal MAIN integration attempt (2026-10-14)

Shared `resolveCompoundMergeOrder` consolidates the table and scalar merge
callers against resolve.c1650ff: per-arm alias, then expression, then next arm.
The previous scalar path searched aliases in *all* arms before expressions,
allowing a later alias to steal a left result match. The new two-column ALL
regression matches native rows twice/reset, including COLLATE decoration.
Native-FIRST proc-011a05ea8618 also tried a multi-column UNION discriminator;
that is honestly unsupported, so the harness exited1 (a trailing tail masked
the shell status). That query is excluded from the final *admitted* matrix,
not promoted or implemented. Final fresh capture proc-146f9ffc9f26 and public
minimal-source probe match153 rows/metadata +12 expected errors in three
encodings twice/reset; the subsequent nonexistent parser runner failed that
whole batch. No additional credits.

Minimum source union is HEAD plus owned vdbe hunks: lexical variable carrier,
parameter positions and expression consumer; compound metadata import; shared
ALL parameter seeding; table resolved producer/merge, shared ORDER/splitting/
capacity/scheduling and comparison accounting. HEAD already exports
resolvedExpressionMetadata and retains all builder/private/lifecycle machinery.
Metadata-TVF/JSON, schema, pragma and select-compiler changes are not prerequisites
and are excluded from this delivery, without reverting their actual worktree.

Initial minimum-hunk archive proc-9801faf39dda: typecheck passed, focused65/66,
parameter test failed datatype mismatch. Hypothesis that selected parameter
carrier/seed hunks suffice was false: expression consumer on a shared hunk was
omitted. proc-2068c340f349/eb9b6a704304 extraction scripts failed literal matching
and left the same failed archive (not new technical hypotheses). Corrected
consumer extraction; proc-ca924a2c4beb exit0: typecheck, focused66/66, public22
(declared/attempted/passed/credited), package boundary and runtime package pass.
Package is isolated browser-global VM, not GUI. Earlier mistaken git-apply
outside-repo invocation did not modify extracted source; explicit patch applied
successfully before these tests. No real index mutation.

Affected minimum-union proc-83d4ed6a1afb exit0: npm test:parser35,
test:conformance:ts firstSELECT8, expressions40, direct relational3/18 with15
unattempted and2 prior credits, ORDER10, cross-encoding3 and six bounded checks.
No root/full-w run or broad compatibility claim. Outputs and extracted source
are under card-work merge-integration. Remaining MAIN hash/tree and committed
archive proof follow only when actually created; portable proof is not MAIN.

Broad storage-glob proc-479efc8d1506 failed missing external skipscan native
fixtures, not merge behavior. This failed batch is not accepted storage proof;
core affected storage must be selected explicitly, with exact denominators.
