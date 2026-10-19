# Scalar path encoding assertions — c1010a repair

## Source contract and diagnosis

Pinned SQLite 3.53.4 source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
`json.c:jsonExtractFunc`4078–4099 parses the document before requesting each
`sqlite3_value_text` path, then measures its C string before path dispatch.
`vdbeapi.c:sqlite3_value_text` requests UTF8; `vdbemem.c:valueToText`1522+
marks BLOB as string while retaining producer encoding, converts if needed and
NUL-terminates. This agrees with assembled `jsonSqlText` private copy/cast/release
and Mem cast's producer-encoding preservation. There is no runtime algorithm
substitution or SQL-specific workaround in this repair.

The predecessor arrow and extraction captures opened only default UTF8 memory
databases. Their tests reused that receipt for UTF16 databases. On assembled
4912-file manifest `c1010a650d9f73c138e7911ac530281b83ce8f836e690a533295cddae2668ad6`,
`SELECT '[11,22]' -> x'31'` and `SELECT json_extract('{}',x'24')` correctly
report `bad JSON path: ''` in UTF16 databases, not the UTF8 NULL/TEXT results.
Independent pinned native replay confirmed this before assertion changes
([red evidence](record:///status.md?card=card-r-b&v=149), proc-744897ca6907).
Do not interpret prior UTF8 receipts as encoding-independent contracts.

## Repair and finite evidence

`card-r-b-capture-path-encodings.py` retains all predecessor SQL inventories and
creates actual UTF8/UTF16LE/UTF16BE databases (encoding PRAGMA before CREATE TABLE).
It asserts source identity and prepare/step success/error status, captures column
names, typed values, exact BLOB hex and SQLite error codes/messages. Receipt
`card-r-b-path-encodings-native.json` has 122 arrow +194 extraction cases per
encoding (948 total). Ten extraction controls add nonASCII and raw LF quoted
labels, unknown escape, TEXT-cast BLOB path, malformed document/NULL/error
priority, integer path, reached malformed path and multipath ordering.
Capture command: `python3 docs/research/card-r-b-capture-path-encodings.py
/work/jsqlite2/.saivage/work/cards/card-r-e/oracle-build/build/libsqlite3-oracle.so
docs/research/card-r-b-path-encodings-native.json`; proc-1e221ac80e68 exit0.
Library SHA is retained in the receipt. Earlier receipts remain provenance.

Tests select by database encoding, not candidate result. Shared assertion owner
`json-path-case-assertions.mjs` checks columnCount and all five public metadata
fields, typed value (REAL compared numerically, BLOB exact hex), first/reset
execution and SQLite kind/code/extendedCode/message. Step/reset/finalize
mismatches are accumulated with SQL/phase rather than finalize hiding the original
error or aborting the inventory. Successful step requires ROW then DONE.

Author replay on disposable exact c1010a source plus only repaired test/receipt
files: proc-97a599a66014 exit0, 6/6 suites, 1896 first/reset executions, no skips.
[Output](work:///cards/card-r-b/processes/proc-97a599a66014/stdout.log).
The red diagnostic remains at
[replay.log](work:///cards/card-r-b/callback-path-red/replay.log); original SQL
witnesses remain in the expanded receipt. No runtime/Mem/VM change, bound-BLOB
ownership, or size-limit recovery change is claimed here.

## Adjacent verification gap on the assembled input

`proc-86571b4a68b1`: typecheck passes, parser 2/2 passes, repaired arrow/extraction
6/6 passes, but existing quoted-path suite fails 3/3 (overall exit1). This is not
a green broader run. [Full output](work:///cards/card-r-b/processes/proc-86571b4a68b1/stdout.log).
Examples include unknown-escape mutation expecting SQLite malformed JSON but
receiving an error without kind, and inserted escaped label spelling `a\\u0062`
rendering as decoded `ab`. This input is not e33704e's accepted quoted-path
runtime; no runtime was changed by this test-only repair. Quoted-path assembled
integration requires separate owner investigation rather than undoing the
encoding-indexed oracle or claiming earlier green certifies this assembly.

This is finite author evidence, not independent/full-standard acceptance,
resource-zero proof, arbitrary-byte TEXT fidelity, or universal lifecycle proof.
Native TEXT decoding uses UTF8 host strings; malformed raw-byte TEXT comparison
is outside this receipt. The test runner would fail on an unhandled rejection;
passing runs establish no such rejection for these cases, not globally.
