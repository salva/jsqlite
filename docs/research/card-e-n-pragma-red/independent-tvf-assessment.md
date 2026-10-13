# Independent n48 TVF assessment

[[card:card-e-l]] assessing [[card:card-e-n]] candidate; no source fixes/staging.
Exact scoped MAIN assembly remains absent. Integrated worktree results are not
shipment/exact-export certification.

## Diagnosed owning defect — repaired candidate, delivery still pending

Pinned sourceID3.53.4 independently asserted, embedded UTF8 image expanded with
native INSERT1/2 in disposable tvf-assess/nonempty.db. Image SHA256
2ca2625f469958bdf48115c0c7e7c05b8dc0a2773702422f76e090381376bbc4.

`SELECT s.name,p.name FROM sqlite_schema s JOIN pragma_table_info(s.name) p ON s.name='t'`

Native returns `(t,id),(t,a),(t,p)`; public candidate errors code1
`view cycle is circularly defined`. Existing fixture includes unselected circular
view. Correct owning prerequisite schedule must apply ready outer-only INNER
ON terms before MetadataFilter, not only WHERE terms. Current vdbe.ts6050ff splits
WHERE alone; ON compiled after Filter6069ff. Pinned wherecode.c ready-term loop
already invoked by candidate rationale applies join predicates as well. Keep
residual terms inside consumer exactly once, don't move LEFT ON outside its
null-extension/match ownership. This is observable result/error order, not
optimizer debt. No SQL-text special case requested. Coordinate shared r/t
source/WHERE prerequisite route through root.

Reproduction proc-773c18f1fa78 independently native→public, partial output read.
Original disposable harness leaked statement on error and close raised BUSY;
that was harness error, not product defect. Correct finally-owned repro
proc-7268f4f8b010 still errors code1 but successfully finalizes/closes. No fix.

## Actual tests and remaining finite evidence gaps

Fresh public54/boundaries12/type PASS proc-8ba986ce37e8. Four actual files
json-table-functions/json-mixed-integration/generated-consumer-binding/
generated-consumer-diagnostics297/297 zero skips proc-a26d566df51c, tail read.
Earlier guessed filenames failed proc-74eeec0e2824; corrected run not falsely
attributed to first command. Native sourceID/digests54 cases checked
proc-4d4285a70e0b; runtime-error entries were not replayed in that script (selected
successful/prepare-error rows only), public54 already compares saved errors.

Current54 fixture physical table **empty**: ordinary physical join claim
vacuous, catalog correlated WHERE meaningful. Independent nonempty LEFT missing
source emits both NULL-extended rows correctly. Bound parameter probe binds
`t` successfully; this is disposable, not durable parameter/origin evidence.
Projection names/decltypes checked by public54, not complete origin metadata.
Repeated constraints return expected empty rows in finite probes. `rowid` native
1/2/3 currently temporary unsupported: missing virtual cursor identity boundary,
not a demonstrated wrong admitted result; define explicitly or translate owning
counter/Rowid path. Native pragmaVtabFilter resets cursor rowid/args, Next advances,
Column hidden values; generator shared-source adaptation may legitimately avoid
nested public statements/admission but must preserve these observables, not
present missing native machinery as browser necessity.

Origin/parameter/rebind/hidden constraint combinations and nonempty correlated
join controls need meaningful durable evidence, including the ON ordering red.
Resource12 establishes saved-error reset/repeat/finalize/recovery finite controls,
not prepare recursion/width/retained-byte/cancellation universality.

## Scoped delivery boundary

Only two TVFs info/xinfo candidate, no all7TVF/fullcorpus gate. Other forms remain
explicit temporary exclusions; permanent mutations unchanged. API remains
candidate-deferred until assembly. Read current guide/audit, TVF.md and pinned
pragmaVtabConnect/BestIndex/Filter/Next/Column, actual MetadataFilter/Next and
shared JSON route. Lazy statement-owned generator no nested public evaluator;
NULL-extension payload currently correct in nonempty probe. Preserve delivered
JSON identity/origin versus known live peer reversals during base-derived scoped
assembly. Producer pragma extraction, MetadataFilter/Next + halt cleanup,
private-source sourceColumns/metadata origin, physical dependency/residual owner
hunks are intertwined with peer JSON/vectorIN/gencolSTRICT work; whole-file
staging unsafe. Owner must provide scoped hashed assembly/prerequisite union.
Live tracked diff/index unchanged proc-4d4285a70e0b; snapshots tvf-assess/*.patch.
No package/exact-export waiver and no later-node work begun.

## Authorized focused repair

The subsequent repair node authorizes fixing this diagnosed path. vdbe.ts now
uses one ready-term splitter for INNER metadata WHERE **and ON**, retaining
inner-dependent residual ON for matching. LEFT and JSON routes remain at their
existing emission points. No new supported source shapes. `tvf-on-native.json`
captured five pinned nonempty UTF8 typed controls (proc-8cf38ae16124);
`tvf-on.test.mjs` verifies exact sourceID/image digest, typed rows twice/reset,
finally-owned finalize/close: outer-only ON, mixed outer/inner ON, ON+WHERE,
missing LEFT and ON false LEFT completion. Capture performed after repair using
independent pinned oracle; initial ON red was captured before repair.

proc-a8e97bdd9003 former red→green, public54/type pass. Fail-fast
proc-0713734a66a7 ON5+boundaries12+composition297 =314 zero skips, type PASS,
partial tail inspected. No claim of additional encodings in ON5 or resolution
of earlier origin/parameter/rowid/delivery gaps. No staging/commit. Scoped delta
is readyTerms/residualOn hunk in vdbe plus the two test/evidence files and this
assessment/status. Root must assemble with r/t prerequisite owner and preserve
peer JSON/vectorIN/gencolSTRICT changes; exact MAIN still required for acceptance.

## Added finite origin/binding coverage — real failure

capture-tvf-bindings.py generates pinned-only nonempty UTF8/UTF16le/UTF16be
images, reopens read-only, checks manifest sourceID and captures full metadata
and39 binding runs across12 prepared statements. No Python SQLite authority.
Capture proc-b4e5833144ec; embedded tvf-binding-native.json includes digests.
tvf-bindings.test.mjs compares all metadata fields and typed public rows with
reset replay, rebind t→u→NULL→t, main/temp schema, explicit hidden EQ,
nonempty catalog INNER ON correlation and physical LEFT completion.

Focused proc-c158f7597f93 failed12/12 on hidden arg/schema declaredType.
Moved metadata comparison after row loops to avoid masking binding coverage:
proc-8e655835fd35 still12/12 fails, **all39 binding runs twice passed rows**
before metadata assertions. Native hidden arg/schema decltype is empty string,
public null. Visible name remains null; origin/database/table match in these
controls. This is a concrete descriptor fidelity error, not artificial red.
Pinned pragmaVtabConnect emits `arg HIDDEN,schema HIDDEN`; vtab.c650–678 strips
HIDDEN token from allocated type leaving empty string. Earlier owner public54
receipt claiming NULL hidden decltypes was not trustworthy for this distinction.
Do not normalize empty→NULL or loosen assertions. Correct metadata descriptor
owner in subsequent authorized repair; preserve JSON hidden descriptor behavior.
Typecheck PASS proc-148f8f0e9ac9; source unchanged in coverage node.
Rowid scope/exact MAIN assembly remain separate unresolved delivery boundaries.

## Authorized hidden descriptor repair

Shared metadataColumnDeclaredType in pragma.ts encodes the native allocated
hidden empty-type versus absent visible type distinction. Both standalone and
physical-left metadata result descriptor producers in vdbe.ts consume it; JSON
and expression descriptors unchanged. Corrected original capture-tvf.py's bytes
truthiness check to `is not None`, then freshly recaptured native54 receipt;
this fixes a real fixture bug that collapsed b'' to NULL, not oracle adjustment.
Fresh proc-0dac0dfe9387: bindings12/39 runs twice now pass full metadata and rows,
native54 recapture/public54/type pass. proc-5b9c5d7f207b: ON5+boundaries12+
composition297=314 zero skips, peer index unchanged; partial tail read. Existing
12 red evidence retained above, no normalization/waiver. No staging or exact
MAIN acceptance; root must incorporate helper/import/two descriptor hunks and
capture/receipt alongside earlier readyTerms delta without whole-file peer loss.
