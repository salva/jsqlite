# Arrow path producer correction — [[card:card-r-b]]

Pinned SQLite 3.53.4 source ID:
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
Independent original finding: [exact7382 review](card-r-e-arrow-review.md).

## Source comparison and correction

`jsonExtractFunc` (json.c 4070–4195) parses the document before path conversion.
JSON_ABPATH preserves full paths; INTEGER storage class produces array indexing
with `#` for negatives, whereas digit TEXT is a label. `jsonAllAlphanum` accepts
ASCII alphanumeric/underscore including empty input; bracket abbreviations pass
through and other labels gain quotes. Lookup error status is reported against
the original path. JSON_SQL suppresses container subtype, unlike JSON_JSON.

`jsonArrow` now translates those branches on the real Function execution path.
It copies the path Mem before UTF-8 conversion, preserves original storage class,
uses C-string NUL termination, and releases the copy. Shared reached-step lookup
is unchanged; its path exception is translated back to the original argument at
the producer/caller boundary. SQL results explicitly clear container subtype.
VDBE arrow dispatch now applies the same output-size check as extraction. No new
evaluator, SQL pattern matching, host String coercion or algorithm substitution.
Private nodes/BigInt and existing Mem conversion remain representation adaptations.

## Tests and evidence

Before production edits, `card-r-b-capture-arrow.py` independently captured
122 typed/error cases through the pinned development C API, saved in
`card-r-b-arrow-native.json`. `json-arrow-path.test.mjs` compares public values,
INTEGER/REAL/TEXT/NULL classes and exact SQLite code/extendedCode/message in all
three encodings, with two executions/reset and finalization. Covers both operators,
TEXT/JSONB documents, signed int64 bounds, zero/negative indices, REAL versus TEXT
numeric labels, dotted/quoted/empty/full/bracket paths, malformed reached controls,
NULL/error order and nested subtype-consuming constructors. No expectations come
from TS. Initial red: proc-cfaa361bcbb4, 0/3, internal byte invariant failure.

Initial implementation lost the `$` prefix on bracket paths during edit transport
(proc-7e02e7aaf863); explicit concatenation corrected it. The next run exposed
original-versus-expanded path error ownership (proc-36a7f8c2cbef), corrected at the
arrow boundary. Expanded matrix then exposed the pre-existing shared scalar
container subtype leaking through `->>` (proc-17e1f57fc5ec): native returns
`["[1]"]` from json_array while TS returned `[[1]]`. JSON_SQL subtype suppression
corrected that source-owned branch. These failed runs remain evidence, not passes.

Typecheck + arrow/scalar/path/three merge suites completed exit0
(proc-982d04f74d08); this run preceded the VDBE result-size guard edit. Current
post-guard focused/type and REAL/sum/subquery/constraint/Chinook results are recorded
in the card status. Durable process output URLs there retain exact totals.

Finite author evidence only: not whole scalar compatibility, exhaustive malformed
bytes, limit/cancellation accounting or independent union approval. Existing
strict node decoding and lossy public invalid-UTF8 string boundary are unchanged.
Export manifest records exact basis and scoped hashes; no default-index/MAIN or
peer staging. Earlier raw-label archive replay qualification remains open.
