# Conditional MakeRecord conversion admission — [[card:card-m-f-k]]

Addresses the exact [w handoff](card-w-conversion-admission-handoff.md), not
window accounting policy or membership breadth. Base28a23bcc; current source
observer before repair fails783 versus359. Unmodified dist observer passes but
is stale-source evidence, not acceptance. No cap, packed charge, assertion,
window Delete/Next, harness or accounting changes.

Pinned vdbe.c3469ff checks disjoint inputs/output, applies affinity (REAL
IntReal preservation), then serial type/header/payload sizing. TS keeps that
order. Mem owns prediction because its flags/bytes own the allocation branch:

| Input/branch | Transient logical allowance |
|---|---|
| NULL/BLOB, numeric without TEXT affinity | zero |
| TEXT same encoding, absent/BLOB/TEXT affinity | zero |
| numeric without TEXT bytes, TEXT affinity |128 canonical spelling/UTF translation |
| TEXT without numeric flags, numeric affinity |64+4×encoded bytes scanner scratch, even nonnumeric text |
| TEXT differing encoding |64+4×encoded bytes translation |

Prediction is nonmutating; MakeRecord sums relevant branches before conversion,
retains conditional allowance through packed admission and refunds in existing
finally. Conservative scanner/translation allowance is a TS logical bound, not
native heap or exact host allocation. Retaining it through packing deliberately
preserves conversion/packed old-new peak; no blanket128 per numeric input or64
baseline survives. Numeric scans that leave text unchanged still allocate. Mem
changeEncoding no-op and numeric-to-numeric affinity do not.

New owner tests cover all encodings/no-op INTEGER/TEXT/NULL/BLOB,81 witness,
numeric TEXT rejection before mutation/saved reset identity/smaller rebind,
stringify, UTF swap/UTF8 conversion, preabort recovery and alias guard. Existing
record-pack/private lifecycle/resource/packed native metadata/error tests retain
actual conversion admission, output overlap, cleanup, generated/vector/Set and
control schedules; no new SQL breadth or native logical-byte oracle claim.

Initial new fixture accidentally opened packed arena under100-byte cap, obscuring
MakeRecord; corrected fixture isolates MakeRecord, leaving real Set covered by
existing tests. Initial constructor lacked callbacks then alias fixture lacked
limits: corrected test setup, not runtime weakening. Repeated focused17 pass,
then expanded23. Initial broad797/796pass/1fail is w's intentional companion
expecting the *old regression* rejection under359; actual query now succeeds.
That w-owned test is left unchanged for coordination, not silently credited.
Source observer now asserts359 and Delete/Next/reset traces successfully.

Root/w: approve these exact Mem prediction + MakeRecord summation hunks and
owner test before coherent exact225/full current/browser48 reruns; do not reuse
old green or stale dist. w owns its failure-companion reconciliation, not this
card. No Chromium rerun claimed here. Existing companion mismatch and broader
coordination remain explicit obligations, not a reason to restore false charge.

## Delivery and current verification

MAIN45bbacf0 delivers only21-line Mem predictor, MakeRecord comment/summation,
new owner test and this matrix; JSON metadata dirty hunks excluded. Separate
index from HEAD preserves real index byte-for-byte (cmp proc-80458444bbbb),
including STAT4/STRICT/bitwise/docs/window/accounting peers. Real-index inverse
deltas remain intentionally preserved rather than reset. Mem work→HEAD empty;
vdbe remaining dirty hunks only JSON peers. No w harness/test edits.

Postcommit proc-12a903a418ca && chain waited exit0: typecheck,802/802 all value +
packed success/error/public-resource + window lookahead/rewrite, no fail/cancel/
skip/todo, current source window observer peak359/reset/Delete/Next, diff hygiene.
Totals explicitly read returned stdout79700. It includes new23 tests and actual
conversion-admission record-pack control. Native fixture metadata/error tests
remain distinct from logical-byte assertions. Earlier proc-a0945c033864802/801
failure was alias test finalization rethrowing saved error; test now checks reset
identity before finalize, runtime unchanged. proc-fd1c27e5ecc2797/796 companion
mismatch remains w-owned, not erased by selected passing chain.

No full current/exact225/Chromium48 approval or fresh execution claimed. This
handoff provides coherent exact source hunks and successful owner reproducer;
root/w must coordinate larger reruns and reconcile their regression-only failure
companion without converting the approved359 success assertion to rejection.

## Parent R1 guide consolidation

Parent immutable [reviewv28](record:///review.md?card=card-m&v=28) accepts the
mechanism while requesting only current-guide coherence; independent bounded
[statusv161](record:///status.md?card=card-m-f-d&v=161) remains qualified by its
unchanged-input reuse and separately counted archived23 controls. Replaced the
worktree guide's stale owning-engine-review paragraph with delivered45bbacf0 /
evidencec51719d4, bounded approval, historical w failure provenance and pending
root/w225/full-current/Chromium48/obsolete-companion reconciliation. Parent prior
bounded acceptance retained; no runtime rerun or whole-lane closure inferred.

HEAD guide lacked the stale peer paragraph (it existed only in worktree), so
initial exact HEAD/work common-text assembly assertion failed before any edit
(proc-d2a53e6cde1d). Corrected separate-index delivery inserts the consolidated
current paragraph at HEAD's identical preceding packed-overlap anchor and replaces
only stale worktree text. Unrelated guide PRAGMA/JSON/window differences and peer
staged inversions remain untouched; no reintroduction of the stale paragraph.
Source map current Mem prediction mapping and audit packed-owner statements
inspected for consistency, no changes needed. Historical w handoff unmodified.

proc-8376446299c4 executable-input1331-path manifest before/after identical,
SHA256 `8b75fc43ab81b3992b92842a1f6e8f667e911e93c8f2ceefdbccf57cb1e62a03`;
real index byte-identical. Manifest includes tracked/untracked current src/test/
reference plus package/lock/tsconfig and absent deleted entries. Include only
current guide admission paragraph and this research appendix; exclude all runtime,
tests, reference, peer docs/source map/audit and historical evidence. Detailed
include/exclude, manifests, actual status/index snapshots and exact HEAD guide
assembly in card `guide-rone` work. No implementation change: prior bounded
verification remains revision-bound; correcting prose requires no runtime rerun.
