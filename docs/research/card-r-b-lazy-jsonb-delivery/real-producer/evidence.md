# F6 shared SQL REAL JSON production — scoped author delivery

## Ownership and source comparison

Incremental author correction over reviewer exact4965 manifest
`aa1b02d7603b10c4d340cac807b0f93efb78b5b7d87ebcb3033bd653d5bb173e`
plus the three separately authenticated aggregate additions listed in identity.json.
No MAIN/default index/peer adoption. Working source:
`work:///cards/card-r-b/json-real-producer/source`.
Only existing runtime file changed: `src/internal/json.ts`.

Pinned 3.53.4 json.c:jsonAppendSqlValue FLOAT calls `%!0.17g`.
`printf.c:etGENERIC` calls `sqlite3FpDecode(17,20)` once, chooses exponential
for exponent<-4 or>=17, trims trailing fractional zeros but retains `.0`,
and emits signed exponent with at least two digits. Zero flag turns infinity
into the decoded 9/iDP1000 representation; ! retains `.0`. Signed zero loses
its sign in FpDecode. Existing `mem.ts:sqliteQuoteReal` already implements this
same format for func.c quote using sqliteNumberText/sqliteFpDecode, including
nonfinite `9.0e+999`. JSON now consumes that primitive rather than JS String.
No toPrecision, new host evaluator or exceptional algorithm substitution.

Compared util.c:sqlite3FpDecode and mem.ts initialization, IEEE decomposition,
Fp2Convert10 call, precision17 roundtrip shortening, rounding carry and zero
trim; printf layout/precision/exponent branches were inspected directly.
Existing BigInt decimal/IEEE rounding representation is retained, not replaced.
No changes to general printf SQL behavior or Mem classification.

Constructors/quote and all four vdbe.ts aggregate callbacks consume the shared
producer. New evidence exposed an important *different* caller contract:
json.c:jsonFunctionArgToBlob (mutation) uses sqlite3_value_text and canonicalizes
Inf to 9e999, not jsonAppendSqlValue's9.0e+999. `jsonEditValue` now owns this
conversion for all edit callers, preserving the FLOAT binary tag and copying
Mem for text conversion/release. INTEGER, parsed JSON raw spelling, subtype,
BLOB admission, NULL and existing path/error order remain separate owners.
Mem.setDouble(NaN) normalizes SQL input to NULL before either producer.

## Tests first, attempts and results

Source-derived native cases, not verbatim upstream test SQL. Development ctypes
capture pins source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`
and retained library SHA `b74284142511a672e841ef5c370cab35f2d873912082319831759459bba05347`.
Fresh execution is not fresh compilation/profile certification. Archive identity
remains d18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b.

- Authenticated/copy only4968 declared files into author workspace:
  [assembly](work:///cards/card-r-b/processes/proc-0d308c8cef96/stdout.log).
- Before repair `python3 docs/research/card-r-b-capture-json-real.py <pinned library> docs/research/card-r-b-json-real-native.json && node --experimental-strip-types --test test/conformance/json-real-producer.test.mjs`: native63 statements twice, public0/3, first1e-7 failures all3enc. [red](work:///cards/card-r-b/processes/proc-394b3c5b0913/stdout.log).
- Initial dedicated printf helper hypothesis typechecked but public0/3 on infinity mutations: source caller distinction above, not a formatting-only failure. [output](work:///cards/card-r-b/processes/proc-c979d731e376/stdout.log). Removed redundant helper entirely in favor of existing faithful sqliteQuoteReal, and corrected mutation producer.
- Final runtime `npm run typecheck && node --experimental-strip-types --test test/conformance/json-real-producer.test.mjs test/conformance/json-aggregate-integration-native.test.mjs`: typecheck PASS,4/4. [output](work:///cards/card-r-b/processes/proc-fa2058f1a35a/stdout.log).
- Native aggregate extension capture24 statements/48 executions, then aggregate-real/paths/group-numeric/numeric*/construct*/edit*/pretty-position shell patterns:17/17. Unmatched construct/edit patterns did not add tests; no coverage claim from names alone. [output](work:///cards/card-r-b/processes/proc-192323f30ea9/stdout.log).
- Final expanded focused test including NaN admission and raw numeric preservation:4/4. [output](work:///cards/card-r-b/processes/proc-fb26f64abe36/stdout.log).
- Broader affected controls initially51/52 with1 missing CHINOOK_DB environment, not runtime parity. [output](work:///cards/card-r-b/processes/proc-63f520bdab8d/stdout.log). Reran affected Chinook/REAL/schema controls with CHINOOK_DB/JSQLITE_CHINOOK pointing to authentic examples/browser/chinook.sqlite:37/37 then typecheck PASS. [output](work:///cards/card-r-b/processes/proc-7e50dd528f8c/stdout.log). Includes logical REAL metadata/reset, grouped IN, aggregate subqueries and CHECK/FK schema read; not write enforcement or fresh native whole-product capture.

- Final combined focused comparator/aggregate-label/numeric/pretty regression command: **28/28**,exit0, final json.ts and patch hashes reconfirmed. [Complete output](work:///cards/card-r-b/processes/proc-2ce72fc3b3c6/stdout.log).

Public63-case comparator uses persisted3enc fixtures, all five metadata fields,
TEXT/BLOB exact values/types, repeat/DONE/reset/finalize/retained-result checks.
21 SQL values cover exponent thresholds,17digit rounding, integral REAL,
negative zero, subnormal/min normal/max finite and infinities/NULL/int64.
12 expressions exercise quote/array/object/JSONB/edit and all4aggregates plus
JSONB composition. Added raw parsed numeric and NaN admission controls.
The separate aggregate-real comparator is an explicitly author-derived extension
of reviewer's unchanged integration comparator: changes REAL2.5 to1e-7/1e20,
keeps grouped/sliding/snapshot/error/rebind/finalize checks. Public UTF8 only;
receipt3enc native is not public3enc aggregate-window acceptance.
Original reviewer files remain byte-identical, preserving attribution; this
new author evidence is not independent review approval.

## Application and limitations

Authenticate identity.json, apply runtime.patch to exact base json.ts4d2009…,
then copy the two exported tests to test/conformance and four capture/receipt
files to docs/research. Result json.ts7a9d04…; identity.json pins full hashes.
[Export authentication](work:///cards/card-r-b/processes/proc-209f9dde70ba/stdout.log)
confirms only json.ts changed among4968 base files. Guide/source-map edits in
root are concise contract additions; do not wholesale adopt mutable peer docs.

Focused F6 passes; no full combined gate/package/20k rerun or independent
whole55/source/caller/adaptation reconciliation claimed. Baseline410/native8/
20k/package evidence remains revision-bound. Current aggregate retained-node
versus JsonString tradeoff remains separate open adjudication. F1–F5 and
withdrawn depth1000 finding unchanged. No integration commit/publication,
new resource quota/heap census/browser gate, or retained-resource release.
