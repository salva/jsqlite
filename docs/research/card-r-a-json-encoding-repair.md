# JSON encoding corpus: repair evidence (partial)

The prior shared-UTF8 fixture assertions are not all-encoding evidence. The new
`card-r-a-json-encoding-capture.py` recaptures every existing case in six suites
through SQLite C API bindings, preserving BLOB bytes and binding SQL TEXT as UTF8
(as the public JS API does). Each connection sets database encoding before
preparing consumer SQL. Native JSON TEXT result byte ownership is consequently
observable through `hex`, without transcoding candidate output.

The self-contained native JSON retains original inputs, input file SHA256,
version/source ID, actual library SHA256 and all compile options. Native library
SHA256 is **9fad2b3ed7c105858c215cb713645f823cf54155aa10806e169d0f4d4a632a2a**,
not the parent e383 library. This is retained 3.53.4 oracle evidence, not a rebuild,
requested-build identity match, or requested4928 integration replay.

Capture command:

```
python3 docs/research/card-r-a-json-encoding-capture.py \
 "$SAIVAGE_CARD_WORK_ROOT/json-boundary-oracle/build/libsqlite3-oracle.so" \
 "$SAIVAGE_CARD_WORK_ROOT/json-density-red/test/conformance" \
 docs/research/card-r-a-json-encoding-native.json
```

602 string +183 text +3129 token +586 whitespace +819 Unicode +225 validation
=5544 original cases per encoding, 16632 encoding/case pairs. Validation,
available rendering and composition observations are captured twice around reset,
with typed values and column names. This does not yet capture full origin metadata,
all possible errors, original lifecycle/resource controls or unsupported render
branches. The six original suites now join these receipts by exact input-file
SHA256, row identity/order and validation SQL through `json-native-encoding.mjs`;
their original loops and independent lifecycle/resource controls remain in place.

New `test/conformance/json-encoding-corpus.test.mjs` compares public Fetch results
without candidate normalization and collects all mismatches instead of stopping at
the first witness. It was executed in attributed accepted148ae json-density-red
assembly, not current mutable HEAD. proc-532b0a4b9bd2 exits1: UTF8 passes;
UTF16LE/BE each have2129 failing observations (1324 render,486 composition,319
validation). Full failure inventories are adjacent `*-failures.json` files;
proc-b204a504107a summarizes. First original raw-tab witness remains input row0.

An earlier capture accidentally used Unicode validation flags for binary validation;
corrected to original flags1/2/4/8/12 before final capture/run. Intermediate capture
proc-943c94ed0316 is superseded. Both final and preceding corrected run expose
same counts; these are the retained red inventories, not current failures.

Pinned json.c jsonParseFuncArg checks recognized JSONB first, then obtains
sqlite3_value_text/bytes for BLOB fallback. jsonValidFunc uses that same owner for
flags1/2. func.c hexFunc consumes sqlite3_value_blob bytes. These are distinct
ownership points: source binding encoding, JSON UTF8 coercion, and TEXT-to-BLOB
publication cannot be corrected by changing shared expected UTF8 strings. First
validation mismatch is json-text row0 BLOB7b695c755a5a5a5a, error position3 versus
native1.

## Owning repair on attributed148ae

`vdbeapi.c:bindText` sets BLOB Mem encoding to ENC(db), and `vdbe.c:OP_Blob`
also sets connection encoding. Translate both producers through SetBytesOptions
and memFromPublic; binary bytes themselves are never transcoded. JSONB-first
recognition remains ahead of conversion. Other document BLOBs use existing
Mem.valueText (source encoding to UTF8), shared by parsing, flags1/2 and error
position. Removed the superseded fatal UTF8-only helper. `setResultStrOrError`
converts function TEXT results to pCtx->enc; the VM function return boundary now
applies that conversion before downstream consumers (including hex), without
changing BLOB results or subtype. This is shared representation ownership, not a
SQL-example workaround or alternative parser. Current guide/map in the isolated
delivery state this contract; mutable peer workspace files are not overwritten.

Attempt evidence: proc-731e4a59a7fe reduced each UTF16 mismatch count from2129
to469 but still failed: adding encoding at binding alone did not work because
setBlob discarded that option. Corrected owning setter, then proc-dd0c042f4098
passed3/3. Added OP_Blob source encoding as required by the same C producer path,
removed unused decoder, and final proc-b989a9bb6d9f exits0: complete six-corpus
public Fetch test3/3 (all16632 case/encoding pairs), plus npm run typecheck.
proc-188f6e120999 earlier passed37/37 (corpus, Mem core/numeric/comparison),
23581ms; it precedes the final OP_Blob addition. Commands run from attributed
148ae assembly `$SAIVAGE_CARD_WORK_ROOT/json-density-red`:
`node --experimental-strip-types --test test/conformance/json-encoding-corpus.test.mjs`
and `npm run typecheck`. Full output references are recorded in card status.

## Original configured suite reconciliation

The six original files retain every case, SQL statement, input binding, first/reset
validation and independent budget/error/recovery control. Only expected observations
are selected per encoding from the authenticated native capture. The helper checks
original input-file SHA256, full input equality, row count/order, exact validation
SQL, both captured steps and expected storage classes before returning values.
No candidate output is normalized or used to construct expectations. JSONB hex
remains byte-exact; TEXT hex remains connection-encoded. The text and whitespace
post-budget recovery checks reuse the corresponding captured error-position column
for the identical BLOB binding, preserving the work-limit/reset/reuse control.

First reconciliation attempt proc-84213f953dc7:16/18 pass, whitespace UTF16 wrappers
fail in helper initialization. Hypothesis that all original `render`-marked rows
still succeed under UTF16 was wrong: the native receipts contain150 malformed-JSON
render errors per UTF16 encoding (first BLOB5b0b305d). Preserve these cases as exact
native error assertions, including reset/retry; do not omit them or force rendering.
No missing native input or query required recapture. The extra hardcoded label,
malformed-BLOB, NULL/REAL recovery and admission controls retain their original
assertions except the two encoding-dependent recovery values noted above.

Final proc-5a5cc6400575 exit0 runs all six original suites plus the additive
corpus: **21/21 pass**, no skips/cancellations,48043.806443ms, followed by
`npm run typecheck` pass. Primary complete output:
`work:///cards/card-r-a/processes/proc-5a5cc6400575/stdout.log`.
Command from `$SAIVAGE_CARD_WORK_ROOT/json-density-red`:
```
node --experimental-strip-types --test test/conformance/json-string.test.mjs test/conformance/json-text.test.mjs test/conformance/json-token.test.mjs test/conformance/json-ws.test.mjs test/conformance/jsonb-unicode.test.mjs test/conformance/jsonb-validation.test.mjs test/conformance/json-encoding-corpus.test.mjs
npm run typecheck
```
This is author verification on the accepted a7d6 runtime assembly, not parent4939
or a full398 replay. Runtime/capture inputs unchanged. No public contract or source
algorithm changes; current guide/map encoding ownership remains applicable.

## Current equivalent per-encoding scheduling

The authenticated 4980-file combined input (inventory SHA256
`370d73f97db73510708d99cf5fe218f016a97dfac08c5d6b5ed18994b8925b1b`)
exceeded the unchanged 30s per-file watchdog: the former single encoding file
completed UTF8 and UTF16LE then was interrupted, 30.022s. A diagnostic 90s run
passed all three in 45.925s; that was not configured-gate acceptance.

The SQL executor/assertion/cleanup body is moved byte-for-byte to
`test/conformance/json-encoding-corpus.mjs`. The original `.test.mjs` entry now
owns the complete UTF8 partition; `-utf16le.test.mjs` and `-utf16be.test.mjs`
own the other complete partitions. Normal integration glob discovery selects
all three; no environment selector, quota, input reduction, runtime change or
watchdog increase. The shared file is not a discovered test. Configured inventory
therefore grows from 414 to 416 files, not by adding coverage but by scheduling
existing coverage in three independent processes. Connection/server cleanup and
per-encoding diagnostic output remain unchanged. The existing twelve-wrapper
depth/resource foundation and original six suites are untouched.

Each partition retains 5544 inputs, 7354 prepared queries and 14708 first/reset
observations: total 16632 input/encoding pairs, 22062 queries, 44124 observations.
UTF16LE and UTF16BE each retain 300 error steps. All SQL, bindings, input order,
metadata names, storage classes/bytes, exact errors, reset and finalize controls
remain in the unchanged body; no candidate-derived expected values or oracle
recapture. This corpus has no new resource assertion; existing controls elsewhere
are neither removed nor promoted into broader resource acceptance.

Author isolated verification on the exact combined runtime plus only these four
test-file changes: proc-a0831cf8b120 exit0, serial fresh processes with hard30s
limits, 3/3 pass, wall22.557/19.750/19.580s. A second run through the actual
`tools/test/integration.py:component/test_command` owners at30s, jobs1 is recorded
in `work:///cards/card-r-a/json-encoding-scheduling/focused-manifest.json`.
Independent combined full-gate verification remains required; this finite
scheduling correction makes no claim about arbitrary workload cost.

Existing red inventories retain revision-bound evidence. Exact4928/e383
provenance/profile, full origin metadata, independent review,
standard/native8/whole-card and resource acceptance remain open. No broad
compatibility or independent acceptance claim.
