# Packed expression membership — native-first evidence

Bounded [[card:card-m-f-k]] evidence, not all-conformance or integration acceptance.

Pinned SQLite source ID (checked by capture before prepare):
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
Capture uses independently built metadata-enabled native library and immutable
pairs fixtures; no TypeScript-produced expected rows.

## Reproduction

From project root, with the pinned shared library:

```
python3 test/conformance/row-vector/capture-packed-membership.py <library> > test/conformance/row-vector/packed-membership-native.json
node --experimental-strip-types --test test/conformance/row-vector/packed-membership.test.mjs
```

Actual native capture proc-d83bab853089 preceded public comparison
proc-d71bc14b7310 (3/3). Capture JSON SHA256:
`111cfbc80f6ae3041d32f413ef954ba1944ce0d081ad093aa58325d774d78904`;
query JSON SHA256:
`2cd5d49f8bb4214520e2267c3393e9a55cd9a56a6e9b55c354cb6ac39d0d1d5e`.

Nine queries × UTF8/UTF16LE/UTF16BE × two reset executions compare storage type
and integer/IEEE754/text UTF8/blob bytes/NULL, plus all five metadata fields.
Cases include per-row correlated IN/NOT IN with growing empty/nonempty/NULL RHS,
scalar and vector; empty RHS NULL LHS; NUMERIC coercion and NOCASE; literal BLOB
and unknown miss; INTEGER/REAL equality; nested scalar plus IN plus EXISTS.
Public execution uses HTTP Fetch via public adapter; closes statements/database
and server. No native error or broader encoding corpus claim: these are successful
admitted queries. The matrix records INTEGER membership results and TEXT scalar
values, not every possible REAL/BLOB result projection.

Final proc-ba6f841d99bc chained typecheck, 356/356 focused routes/foundation/
Chinook/vector/composition/private cursor/record tests, existing public123/123
mismatch0 zero credit, and diff hygiene. No new matrix discrepancy or runtime edit.

## Source interpretation and boundaries

Pinned expr.c CodeIN steps3/6 require exact probe, then NULL fallback. Scalar
fallback reads first sorted record only; vectors need fieldwise row traversal.
Enforced packed-only InSet uncovered missed manual producers and obsolete
EphemeralSort consumers; their fixes and failed attempts are retained in
[card status](record:///status.md?card=card-m-f-k). SelectDest Set owns packed
MakeRecord→IdxInsert and its dead record lifetime; private BLOBKEY traversal owns
interior as well as leaf index records and callback payload snapshots.

Exact admission/cancellation/error schedule, restore/fault traversal controls,
MakeRecord conversion/decode-scratch accounting and reviewed scoped integration
remain open. Conservative snapshot allowance is not exact native allocation
accounting. This matrix does not prove zero remaining lowering gaps.

## Follow-up bounded decode and lifecycle controls

InSet fallback now reads exactly KeyInfo width with RawRecordReader and checks
end-of-record inside the snapshot callback. This removes an uncharged intermediate
all-field array before width validation, preserving borrowed TEXT/BLOB payload
until compare and releasing Mems before cursor movement. RawRecordReader serial
validation remains the owning record primitive; this is not a new record decoder.

Public controls now check pre-aborted signal and zero deadline first-error identity
on repeated step/finalize, subsequent packed statement admission, and deferred
close with a suspended correlated row across all encodings. Initial test cleanup
called closeDeferred twice, threw connection-is-closed and left server alive;
proc-c5a85e7e4bcb killed after diagnostic output. Corrected test's already-closed
database reference, not runtime closed-state handling. Final && proc-a655855f08e2
passed typecheck359/359 focused tests, public123/123 mismatch0 zero credit and
hygiene. These pre-control tests do not establish cancellation during insertion.

Pinned vdbe.c MakeRecord3469–3712 comparison: live P4 affinity precedes serial
sizing; header fixed point precedes length check/output allocation; output cannot
overlap inputs. Current shared TS applies live affinity/encoding, sizes, checkpoint/
admission then packs, but creates a separate packed result rather than reusing
native output allocation. At that revision transient UTF conversion allocation was unadmitted; the repair
below supersedes that finding. Simultaneous old/new packed charge is the real
immutable replacement peak, not native output-buffer reuse. Selected
record tests cover widths/header/encoding, not all these error boundaries. No
admission parity conclusion is warranted yet.

## Shared MakeRecord conversion admission repair

MakeRecord now validates output/input non-overlap and affinity span first, checks
control, then reserves conservative `64 + 4*source bytes + numeric128` conversion
allowance before live affinity/encoding mutation. It retains allowance through
record sizing/checkpoint/output reserve/packing and refunds in finally on every
exit. The result replacement still admits old/new packed overlap because JS
packing produces a new immutable byte array rather than writing native zMalloc.
This is a bounded allocation tradeoff, not browser necessity or native accounting
parity. Existing record header/encoding/IntReal mutation behavior is preserved.

New VM record test pins UTF16LE/BE conversion+packing admission boundary147 reject
versus148 pass for `abc`, and primary error identity through finalize. Focused
proc-11ffe44b9643 typecheck35/35 actual private owner seek/insert/reuse interruption,
peak boundary and VM lifecycle/error cleanup tests passed (complete tail read).
Final && proc-c18514b4547f typecheck392/392 expanded focused tests, public123/123
mismatch0 zero credit and hygiene pass. No new failed test this attempt.
Exact native allocation counts and all in-flight public cancellation/restore/fault
branches remain unclaimed; unrelated allocator/accounting work is not converted
by this owner fix.

## Traversal transition and in-flight public controls

Pinned btree.c First5688/Next6330 comparison directs scan controls: First resets
saved position; Next restores REQUIRESEEK, returns positive SKIPNEXT current row,
advances negative SKIPNEXT, and rejects FAULT before work. Added tests for exact
saved-key successor, positive/negative neighbor, empty restored cursor, First
saved-position abandonment and terminal primary identity before any checkpoint.
Initial combined fault fixture wrongly attempted foreign-lease mutation
(proc-0add3bb9da60 45/46); a second clear fixture failed before mutation while
saving positioned cursor (proc-9df65ef53c38). These are legitimate admission
branches, not runtime defects. Split save/First and terminal clear fault fixtures;
proc-be054c08786e47/47 passed. No runtime change required in this attempt.

Public Fetch test now aborts a bound20KB vector IN packed record after step starts,
requiring scheduled yield and cancellation observation; verifies finalize primary
identity and packed recovery admission across all encodings. This controls packed
record preparation, not arbitrary cancellation at every Btree mutation point.
Final chained proc-8e366c2d5bfa (waited terminal) typecheck715/715 expanded private
BLOBKEY and VM plus expression routes/matrix/Chinook tests; existing public123/123
mismatch0 zero credit; hygiene pass. Selected owner mutation interruption tests are
included, but global error-schedule/native allocation parity remains unclaimed.

## Scoped integration

Delivery commits070cc695 and7a8185ac commit accumulated packed expression source,
control/native-public tests and current guide/map ownership sections. Initial
`commit --only` rejected untracked test paths(proc-68643ae1af9f) without commit;
explicit scoped add then commit succeeded(proc-9072ccaa5dfc). Index entry comparison
showed only the13 selected delivery paths changed. Documentation used a separate
purpose-named index to commit only expression hunks; equivalent hunks applied to
real index preserve unrelated staged deletions/edits. Unrelated PRAGMA guide/map
changes and broader mutable audit edits remain untouched, not implicitly approved.

Final after integration proc-cbc3084cf31c waited terminal: chained hygiene,
typecheck715/715 focused expanded suites andpublic123/123 mismatch0 zero credit.
Selected runtime/test paths have no HEAD-to-work delta. Existing correlated Once,
linked bindings, scalar metadata/composition foundation evidence remains applicable:
no such producers changed after validation. No remaining reproduced lowering gap
in this admitted slice is known. Deferred/excluded forms, broader conformance/docs
breadth and unrelated staged peer work are not closure claims. Conservative scratch
and immutable packed peak are bounded documented tradeoffs, not missing lowering
machinery or native byte-for-byte resource parity.
