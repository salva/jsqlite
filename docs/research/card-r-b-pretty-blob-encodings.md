# Pretty / BLOB-document encoding correction

## Source comparison and diagnosis

Pinned SQLite 3.53.4 source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
`json.c:jsonParseFuncArg` first admits JSONB, then falls through to
`sqlite3_value_text`/bytes for a non-JSONB BLOB. `jsonPrettyFunc` delegates
admission to this owner before indent conversion, traversal and return/free.
`jsonValidFunc` uses that fallback only under text flags. Private Mem copy/cast/
release retains source encoding. JSONB bytes are not transcoded.

The first corrected receipts disproved the fixture-only hypothesis: proc-86f81ad1418d
passed pretty in all encodings and UTF8 BLOB-document, but failed both UTF16
BLOB-document runs. `parseJsonMem` still decoded non-JSONB BLOB directly with
UTF8 `blobText`, while the already-corrected `jsonValid` used `jsonSqlText`.
The repair changes the shared document admission primitive to that private SQL
conversion, retaining JSONB-first validation/decode, parser charge and error
translation. Removed the now-unused `blobText`; no VM/Mem/publication or pretty
algorithm change, no SQL-specific bypass. This corrects scalar and module callers
through their actual shared admission path.

## Independent capture

[capture script](card-r-b-capture-pretty-blob.py),
[verbatim SQL inventory](card-r-b-pretty-blob-inventory.json),
[receipt](card-r-b-pretty-blob-native.json).
Original14 pretty cases plus malformed control and all11 original BLOB-document
statements are retained.29 independent expression controls prevent early
whole-statement errors from hiding later flags/binary/admission assertions.
Actual UTF8/UTF16LE/BE databases assert PRAGMA encoding after schema creation.
Each of165 statements is executed first/reset with five metadata fields,
row/DONE/error/class/value and reset/finalize result assertions (330 native and
330 public runs). No original case had bindings. Original pretty cases file,
timers/density/negative controls and single-pass implementation remain unchanged.

Capture proc-a258a03b06e4 initially covered78 statements; final expanded capture
proc-0e7ee821d3c6 exit0 covers165. Library SHA
`b74284142511a672e841ef5c370cab35f2d873912082319831759459bba05347`,
reviewer's existing `review37-verify/oracle-profile/build/libsqlite3-oracle.so`.
Source ID and actual compile options asserted (ENABLE_COLUMN_METADATA and
ENABLE_MATH_FUNCTIONS); options retained in receipt. Existing profile identifies
3.53.4 and encoding/metadata/math/JSON probes. This is fresh execution of that
library, not a fresh build or full native prerequisite recertification.
No candidate output or blanket encoded-hex normalization is an oracle input.

## Verification and attribution

Owned `pretty-blob-encoding/source` authenticates all4928 input files against
reviewer manifest `fede857b979f6cf792d4a3be4b64d92ea1c99f347356e571edb56ec20525f421`
(proc-e6d9ddbbb5db exit0). `proc-f3d3575a2f19`: repaired original inventory
7/7 passes. Expanded inventory proc-e5e82c2ceef5: typecheck plus pretty,
BLOB-document, scalar-admission, raw-label, quoted-path **16/16**, exit0.
Final reset-assertion hardening proc-e8a2ff401664: parser2/2 and focused7/7,
exit0. Broader proc-acdf55d6fe85:20/22 pass, two UTF16 numeric-header failures;
its chained parser command did not run. Witness native capture in
`work:///cards/card-r-b/pretty-blob-encoding/numeric-native.json` confirms
`json_extract(x'33312e30','

Adjacent delivery manifest/patch attributes runtime, tests, capture and receipts
over this4928 input. Guide/map changes are separate current workspace rationale,
not whole mutable-document adoption. Shared workspace json.ts differs from4928;
the same admission change is applied there, but execution/export uses authenticated
4928. No commit/default-index/MAIN adoption. Other six receipt families, independent
union acceptance, full configured/native8, immutable20k, standard/package and
resource/lifecycle obligations remain open; these finite tests are author evidence.
)` and `json(x'33316530')` error `malformed JSON`
in both UTF16 databases, versus UTF8 REAL31/TEXT31e0. Numeric suite still reuses
UTF8 expectations; complete numeric recapture remains outstanding, not normalized
here or claimed resolved by these two samples. This is an explicit broader-check
qualification, not a failure of the assigned two-family reproducer.

Adjacent delivery manifest/patch attributes runtime, tests, capture and receipts
over this4928 input. Guide/map changes are separate current workspace rationale,
not whole mutable-document adoption. Shared workspace json.ts differs from4928;
the same admission change is applied there, but execution/export uses authenticated
4928. No commit/default-index/MAIN adoption. Other six receipt families, independent
union acceptance, full configured/native8, immutable20k, standard/package and
resource/lifecycle obligations remain open; these finite tests are author evidence.
