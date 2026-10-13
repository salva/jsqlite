# Independent bounded PRAGMA assessment

Assesses [[card:card-e-n]] status v15 current uncommitted delivery; no fixes or
staging. This is not exact MAIN acceptance. Original STRICT3376615 acceptance
is preserved and unrelated root/peer guide/index edits were not modified.

## Results

Fresh existing native/public db117/table39/index-FK90 controls pass, parser+
catalog+STRICT123 tests pass/type/package-boundary pass (proc-9d193bb5b12b).
Original reproducer zero rejected successes/build/distributable PASS45modules92
files (proc-c25d10521075; partial tails read). VM browser, not GUI. Fresh pinned
library source ID checked against manifest, recorded228 rows replay match
(excludes database_list/errors/mutation); fresh memory filename/temp-residency
matches documented empty-file adaptation. Registry exact78 including conditional
names. Capture scripts assert source ID before acquisition, and v15 reports
native-first development; independent replay is after code, not proof of an
independently witnessed pre-code chronology. Public scripts don't validate image
digests; receipt paths point to mutable external card-n fixtures.

## Must fix within admitted branches

Independent fresh pinned14 queries ×3 encodings and public typed/reset comparison
(proc-20b711875723) exposes **12 mismatches**:

1. `PRAGMA table_info(+1)` and `PRAGMA table_info=+1` select table `+` in TS,
   not table `1`. `table_info(+1.0)` likewise selects `+`, while native returns
   empty unless `1.0` exists. Fixture contains both `1(x INT DEFAULT (+7))`
   and `+(wrong TEXT)` to avoid falsely passing empty rows. parse.y plus_num
   returns number token, whereas productionAction takes first leaf `+`.
   Correct semantic token ownership for plus_num in both argument forms;
   don't special-case these names or strip SQL text globally.
2. `index_xinfo(ia)` for `a COLLATE NOCASE DESC` returns `nocase`, native
   `NOCASE`. pragma.c uses Index.azColl[i], not registered CollSeq name.
   Current comment asserting registered name is false. main.c registers uppercase
   NOCASE/RTRIM but explicit SQL spellings are also significant in Index.azColl.
   Physical layout folded lookup keys cannot recover metadata spelling. Preserve
   catalog/index producer azColl identity through consumer. Add NOCASE/nocase/
   mixed-case and RTRIM/inherited collations source-bound controls; don't simply
   uppercase all names. Existing lowercase fixture doesn't detect this branch.

All other independent probes pass: table/default/PK/index origin order, negative
argument, quoted numeric, unknown no-op, unknown-schema precedence, parameter
syntax error, main/temp and residency, reset. These are finite bounded bugs,
not whole-corpus prerequisites. No guessed rows or parallel evaluator added.

## Coverage corrections / assembly

Original existing controls cover typed metadata and ordinary lifecycle in all
encodings, but no durable focused limits/error cleanup/duplicate-index metadata
controls were found. Disposable corrected `options.limits` probes hit expected
maxRows/maxResultBytes/maxWorkUnits errors; first probe passed wrong option shape
and is not evidence of ignored limits. maxWorkUnits1 also prevents SELECT7
recovery; harness later finalized an error statement outside catch, causing an
unhandled error (proc-2a20f7306ca4). No product cleanup defect inferred from that
harness mistake. Require durable appropriate-budget controls rather than claim
limits breadth from normal VM routing. Separate table-valued pragmas/views/known
untranslated rejection remains honest and must not become blanket PRAGMA rejection.

Scoped MAIN assembly still needed: new pragma.ts/pragma-names.ts plus index.ts
imports/state/prepare routing and parse.ts PragmaNode/production semantic **and**
standard-type/default-span producer hunks on which metadata depends, together
with focused fixtures/tests/owned PRAGMA docs. Avoid whole-file staging mixed
parser/schema/generated/guide/private changes. Root guide authority/preamble
ownership is separate; only bounded PRAGMA contract paragraph belongs to this
slice. Current receipt registry NeedSchema applies six metadata names, not
unknown/database_list; explicit temp setup precedes registry. Main persisted,
empty temp/no attachments and memory filename tradeoff are bounded legitimate
representations. Common literal VDBE emission is upstream pragma.c algorithm,
not independent result evaluator. Existing mutating/known unsupported branches
remain excluded, `=` metadata identifiers are not writes.

Independent disposable scripts/images/native receipt live in card work
`pragma-assess/{native-probe.py,independent-native.json,compare.mjs,limits.mjs}`;
no product fixes or new tests staged. Live peer diff/index exact snapshots unchanged
through assessment. Owner [[card:card-e-n]] should repair the two semantic owners,
add durable finite controls/provenance, and supply scoped revision for export.
