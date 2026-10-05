# Deferred pretty slice — [[card:card-r-f]]

Revision evidence at 5e2658c plus scoped repair; not universal JSON compatibility.
Source: manifest-pinned SQLite 3.53.4, json.c registration block, jsonPrettyFunc,
JsonPretty/jsonPrettyIndent/jsonTranslateBlobToPrettyText and scalar renderer.

Representation decision: retain existing ordered JsonNode document/JSONB parser,
adding private encoded TEXT/TEXTJ/TEXT5 metadata for strings/labels. This is
an ordinary representation adaptation: container traversal mirrors upstream
open/nonempty/newline/increment/depth/child/comma/close ordering, labels/scalars
use shared translated quoting/numeric primitives. No host JSON parser/formatter.
No subtype on pretty output; NULL document short-circuits before indent cast.
Shared Mem text cast owns numeric/BLOB indent conversion and NUL truncation.
Output append charges work/checks cancellation/deadline and byte limits before
publication. Statement-owned logical reservations now cover source/parsed/lexical/indent/output
retention, releasing in finally; parser/decoder/quoting generators permit pretty
suspension and scalar character charging. Chunked UTF8 output is size-checked before
allocation. See correction evidence below; this does not claim native OOM equivalence.
The shared strict JSONB decoder rejects malformed trees earlier than upstream's
explicitly permissive pretty renderer; valid nonminimal headers are supported.
This is inherited bounded behavior, not a platform necessity or new exception.

## Registration/admission census

All ordinary json.c scalar names are registered: json/jsonb(1), array/object and
JSONB variants (variadic), array_insert and JSONB (-1), array_length(1/2),
error_position(1), extract/JSONB(-1), insert/replace/set/remove and JSONB(-1),
patch/JSONB(2), pretty(1/2), quote(1), type(1/2), valid(1/2). Operators ->/->>
map to json_arrow/json_arrow_sql(2). Four group callbacks are aggregate/window
rows at 1 (array) / 2 (object). Table module rows remain each/tree/JSONB each/tree.
Pretty was the only explicit temporary scalar execution throw in this inventory;
now removed. json_parse is SQLITE_DEBUG-only upstream: resolver recognizes it,
but ordinary registry lacks it; ordinary-build admission should reject honestly.

Exact remaining admission differences: source extract argc<2 returns NULL while
registry requires >=2; edits source variadic callback admission differs from
registry minimum 3, remove minimum 1. Registry represents output subtype flags
but does not separately model input-subtype, cache, JSON_BLOB, JSON_AINS,
JSON_ISSET, JSON_JSON/JSON_SQL flags (callbacks encode behavior). Do not infer
full parity from row presence. jsonArrow abbreviated-path normalization currently
only recognizes unsigned digit strings; pinned JSON_ABPATH branch includes
negative integer and quoted-label handling. Proposed next sequence: ordinary
variadic arity/callback guard and debug-only admission, then operator Mem text
conversion/JSON_ABPATH normalization with native typed companions, then shared
numeric/JSON5 lexical corner fidelity. None implemented opportunistically here.

## Verification and credit

`json-pretty-cases.mjs` contains 14 no-credit native companions. `cases.json`,
`capture.py` and `native.jsonl` preserve source-ID-checked native typed values and
exact expression column names. Reproduce: build `sh tools/oracle/build.sh`, then
`python3 docs/research/card-r-f/capture.py`; exit 0. Public Fetch runs each case
in UTF8/UTF16LE/UTF16BE, metadata/type/value, done/reset/reexecute/finalize.
Cases distinguish empty/nested/duplicate/custom/default/NULL/NUL/numeric indent,
JSON5, BLOB text document, JSONB/nonminimal header, escaped lexical spelling,
subtype-0 and constructor composition. Malformed and depth/control cases check
saved first error, reset/reuse/finalize and result/work/timeout/pre-abort limits.
No additional upstream assertion credit or internal-only compatibility credit.

Tests-first run failed on temporary unsupported after fixing mistaken test API
columnName→columnMetadata.name. Initial repair then failed numeric indent Mem
textValue; corrected owning cast. Companion full scalar run exposed accidental
broad textual replacement in mergePatch; restored its original result owner.
A recursive lexical validation attempt was replaced with direct string scanner
validation (not recursive parse). All final reruns below use corrected inputs.

Final focused command: `node --experimental-strip-types --test` with
json-scalar-paths, json-scalar-full, json-blob-document, json-foundation,
json-aggregate-paths, json-table-functions, json-pretty `.test.mjs`: 32/32 pass.
Full log: work:///cards/card-r-f/processes/proc-e9f1e6088aed/stdout.log.
`npm run typecheck`: exit 0. Native 14 companions: exit 0.
Pre-correction obligations at the original pretty delivery (superseded for the
scoped R1/R2 controls below): full upstream pretty corpus,
malformed JSONB permissiveness, private-budget enforcement, mid-scalar abort,
depth-edge error-order/native limits, all JSON5 escape/number edge cases, larger
cross-feature composition. Passing companions does not close these widths.


## Review v18 R1/R2 correction evidence

Review requirements are scoped owning corrections, not approved exceptions. Preserve
[red status v14](record:///status.md?card=card-r-f&v=14) and prior repair evidence.
TEXT5 rendering follows jsonTranslateBlobToText: x→u00, v→u000b, 0→u0000,
escaped apostrophe unescaped, strict escapes retained, continuation removed; unknown
escapes and decimal neighbors after 0 reject at the shared scanner. Parser-produced
encoded metadata survives JSONB consumption/composition; strict strings remain
TEXT/TEXTJ, not a JSON.parse/stringify reformatter.

`capture-corrections.py` independently checks the manifest source ID and 72 native
scalar/label, single/double, TEXT/JSONB cases against `correction-cases.json`;
`correction-native.jsonl` retains typed successful values and native malformed errors.
Public Fetch tests compare exact expression names, TEXT values/type, subtype 0,
errors and all three database encodings. Original four red checks are preserved.
Cancellation test uses 8KiB indent (32 preflight units) expanded over three elements,
so the 256-unit suspension occurs within pretty, not just input preflight. Nonzero
private/output/work limits, injected Date.now deadline, saved-error identity,
reset/reuse/finalize cover cleanup. No upstream test assertion or universal JSON credit.

Logical budget model: reserve 128×source bytes + 256 before parse (conservative tree,
decoded/encoded strings, entries, Mem conversion and bookkeeping); 8×indent bytes
+128 before indent conversion; UTF8 chunk bytes +64 per append; joined result plus owned Mem copy bytes
before publication. These overestimate small trees and may reject earlier than an
actual-heap limit; they are deterministic logical bounds, not native allocations or
exact JS heap/work equivalence. Shared synchronous consumers drive the same generators;
pretty drives them asynchronously, yielding every 256 accumulated statement units.
Browser string/UTF8 decode and number conversion are indivisible runtime primitives,
preflight bounded/charged before invoking them. No platform necessity is claimed for
this conservative accounting. Strict malformed JSONB behavior remains inherited.

Observed repair hypotheses/failures: first four-case correction passed; expanded
native matrix exposed unknown JSON5 escape admission (q), corrected at scanner.
Label encoding initially forced TEXTJ even without backslashes, failing exact existing
JSONB foundation bytes; corrected TEXT versus TEXTJ producer classification.
Generator migration initially missed three no-charge path/error callers (typecheck
failed); corrected shared driver callbacks. These failures are evidence, not erased
by final tests. Detailed current command results are in the card status.


## Review v21 R2a — escaped scanner checkpoint correction

Review accepted R1 for the assigned branches but identified a remaining R2
alignment bypass. [Red status v23](record:///status.md?card=card-r-f&v=23)
retains the two failing public Fetch classification probes: repeated six-width
u0041 and two-width backslash escapes yielded zero control observations during
strict reclassification. Input preflight and later append checkpoints did not
interrupt that scanner.

`Parser.str` now charges consumed-position threshold crossings instead of exact
index alignment, for both initial decoding and `stringEncoding`'s strict scan.
The neighboring TEXT5 translator and whitespace/comment generator use the same
threshold rule where cursor jumps can skip an alignment. Numeric token and quote
loops advance one position at a time and retain their periodic checkpoints.
Comparison against pinned `jsonTranslateTextToBlob` parse_string and
`jsonTranslateBlobToText` TEXT5 confirms that escape/continuation branches consume
variable widths; this repair changes cooperative scheduling, not their encoded
classification or output semantics. Native C does not define our work-unit counts.

The preserved two classification probes and eight scalar/label/TEXT/JSONB tests
exercise nonzero work limits and mid-classification cancel/deadline, requiring
failure before the second decoded publication, then saved-error identity,
reset/rebind/reuse/finalize. Instrumented Array.join and Date.now hooks are restored
in finally; these are public control evidence, not new native parity credit.
Focused escape-dense run: 10/10 pass, exit 0 (proc-71e40c769304).
Final verification and commit are recorded in the current card status. Original
14 and correction 72 source-ID-pinned native companions remain applicable to
unchanged SQL values; no new native capture was run for scheduling-only changes.

Current remaining widths: full upstream pretty corpus, permissive malformed JSONB,
depth/error-order/native-limit edges, exhaustive JSON5 numbers/invalid encodings,
and broader composition. The admission/path census above remains follow-up work;
no universal JSON compatibility, heap-size or native work-count equivalence claim.
