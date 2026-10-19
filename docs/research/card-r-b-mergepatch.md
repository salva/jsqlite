# Merge-patch editable JSONB repair

Author evidence; not independent union acceptance. Pinned SQLite 3.53.4 source ID:
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.

## Current owner and source comparison

Read `json.c:jsonMergePatch/jsonPatchFunc` completely, plus `jsonBlobEdit`,
`jsonBlobOverwrite`, `jsonAfterEditSizeAdjust`, `jsonBlobChangePayloadSize`,
`jsonbPayloadSize`, `jsonReturnParse`, and label comparison. The former decoded
ordered-entry merge could model first-match deletion but could not preserve native
byte relationships. It is removed, not wrapped by another evaluator.

`JsonPatchBlob` owns private bytes and frame delta. `mergePatchBlob` translates
nonobject replacement, coercion to an empty object, per-member target restart,
first-match NULL deletion, recursive delta save/reset/restore, unmatched append,
and final header adjustment. Overwrite widens a replacement header when native
can absorb a small shrink without moving subsequent bytes. Raw labels and
untouched values are copied directly. Target parsing precedes patch NULL handling;
admitted JSONB is traversed incrementally, not eagerly decoded before merging.
TEXT output now translates `jsonTranslateBlobToText` directly into private UTF-8
bytes (`jsonBlobText`), retaining raw TEXT/TEXTJ payloads and native TEXT5/TEXTRAW
escaping. `Mem.setText` already owns byte TEXT and `hex` consumes `textBytes`, so
no Mem rewrite or cross-owner prerequisite is needed. `column()` still decodes to
a JS string and cannot expose arbitrary invalid UTF-8 losslessly; byte consumers
must operate before that adapter boundary. Native allocation/cache ownership
becomes private JS buffers; FunctionContext work/check calls remain in the
production VDBE path. This is a representation adaptation, not an exceptional
merge algorithm.

Reached labels use native raw/raw length+memcmp or incremental escaped comparison,
including `sqlite3Utf8ReadLimited` (no replacement/validation), escape unrolling,
NUL stopping and first-mismatch stopping. Invalid UTF-8 is not a blanket malformed
exemption: reached truncated structures and renderer escape errors still reject.
The 23-case raw-label native capture below closes the reproduced branches, not
the exhaustive malformed/escape/depth/resource corpus.

## Evidence applicability

Original duplicate-deletion red and initial finite-green provenance is retained
in [[card:card-r-b]] accepted status v73. That **546-comparison** matrix excluded
four native nonminimal-array-header cases. Those exclusions are removed: all four
are active both in the expanded suite and the dedicated byte/order reproducer.
The former delivery patch/manifest remain immutable-by-convention prior evidence,
not current repair delivery.

`python3 docs/research/card-r-b-capture-mergepatch.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"`
recaptured **211** typed C-API results using the already source-verified library
(`proc-75f3295e2519`). The 25 additional expressions cover target-before-NULL,
escaped target-label preservation and unmatched patch-label copying, scalar-to-
object conversion, nonminimal input headers, reached malformed label/value
boundaries, bypassed malformed subtrees on replacement, and 999/1000-level
recursion. The 211 rows include native `JSON nested too deep` and malformed errors,
TEXT, SQL NULL, INTEGER length and exact hex; no `knownGap` rows remain.

Public Fetch tests compare all **633 comparisons across three encodings**, each
successful row twice after reset, exact columnType/value and SQLite error
code/extendedCode/message, with finalize cleanup; original four deletion cases and
nine byte/error-order controls per encoding remain. This is not resource-zero or
exhaustive deadline/cancellation proof.

First implementation check passed tsc but Node strip-only mode rejected a parameter
property (`proc-f32c346af858`); ordinary fields corrected it. The now-correct target
error exposed reset/finalize rethrowing statement error in the dedicated red
harness (`proc-c9ff7e97bb24`, `proc-2c68f37a29a5`); the test now tolerates only the
already expected SQLite error during cleanup, not arbitrary exceptions. Dedicated
reproducer passed 3/3 (`proc-0508e65f0c72`). Expanded capture initially failed raw
label TEXT output (`proc-75f3295e2519`); owning shared `renderJson` ignored stored
spellings. Correcting that consumer passed 3/3 expanded suites (`proc-7ba32825affe`).

`npm run typecheck && node --experimental-strip-types --test` on mergepatch byte,
duplicate, from-end, reachability, missing-substructure, flags, scalar-full and
foundation-boundaries suites, then scoped `git diff --check`, passed **112/112**
(`work:///cards/card-r-b/processes/proc-746f1e8bd22a/stdout.log`). This is not the
full standard or independent union gate. Earlier Chinook/module-load failure and
stopped full gates retain their qualifications in card status; later passing
selected checks do not erase them.

## Raw-label repair evidence

`card-r-b-capture-raw-label.py` verifies the pinned source ID and records 23 C-API
hex/type/error results in `card-r-b-raw-label-native.json`. Command with the same
oracle-library argument passes (`proc-54963641221e`); public raw-label suites pass
3/3 across UTF-8/UTF-16LE/UTF-16BE, 69 comparisons. Includes raw matching/different
labels, NULL deletion/replacement, empty binary/TEXT patch, TEXT/TEXTJ/TEXT5/TEXTRAW,
escaped/raw comparisons, NUL stopping versus raw memcmp, quote/backslash/control
rendering and typed malformed controls. Initial guessed nonobject-patch expectation
was corrected from native capture before implementation (native copies it, not an
error). The first partial repair (raw memcmp plus byte renderer) passed the original
seven but failed escaped-vs-raw FF in all encodings; complete incremental escaped
comparison removed the strict decoder from the merge owner. Primary failed output:
`work:///cards/card-r-b/processes/proc-3a977d465799/stdout.log` (6 pass/3 fail).
After that correction, typecheck plus merge/raw/foundation/scalar suites passed
13/13 (`proc-9b8937ab1555`); the expanded 23-case capture/reproducer then passed.
No reset/resource-zero certification is inferred from these finite tests.

## Delivery and remaining acceptance

Prior delivery is a separately attributed patch against exact
`8306148f515d66b61d7d2beaa81fe2669628efba` **plus** the prior deletion delivery
`card-r-b-mergepatch-delivery/owned.patch` (SHA-256
`685c5a829c2542df9c9a28182c809322bc471a2f448776a3990b20f438e6dace`).
See `card-r-b-mergepatch-byte-delivery/manifest.json` for exact file hashes and
`owned.patch` for scope. It preserves peer parser/depth/Window/cursor work and
requires no MAIN/default-index writes. Independent integration/full standard,
remaining exhaustive invalid-label/renderer fidelity, output/malformed and
work/deadline/lifecycle accounting remain open; this focused repair does not
approve the whole brief.
