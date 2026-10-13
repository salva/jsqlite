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
