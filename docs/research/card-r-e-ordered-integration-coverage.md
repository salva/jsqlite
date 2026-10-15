# Ordered mixed JSON integration coverage

For [[card:card-r-e]], against isolated candidate `edfd35a3113954c7ce2ec9fdcfbbd1faceb78ee1` (parent `3aae6a9a2fea4755802641a844152508b60c446c`). No runtime changes or MAIN incorporation.

`card-r-e-ordered-integration-capture.py` obtains independent read-only pinned SQLite 3.53.4 expectations, asserting full source identity. `json-ordered-integration.test.mjs` uses public Fetch/prepare/step, ordered five-field metadata and typed INTEGER/REAL/NULL/TEXT/BLOB rows, reset/re-execution, saved error identity and finalize/close. The new 96 cases cross three database encodings, four JSON modules, and eight compositions: per-physical-row dynamic document; JSONB input with OFFSET/LIMIT; CASE-produced root path; duplicate quoted aliases and ordinal ordering; NULL LEFT extension; malformed text; malformed BLOB; DISTINCT projection with unprojected sort key/OFFSET. These use the existing encoding fixtures without database writes. They do not constitute the exact t.x/t.js checkpoint or exhaustive resource scheduling coverage.

## Focused result

Fresh capture and test on exact candidate archive, existing linked dependencies:

```
python3 docs/research/card-r-e-ordered-integration-capture.py > docs/research/card-r-e-ordered-integration-native.json
node --experimental-strip-types --test test/conformance/json-ordered-integration.test.mjs
```

`work:///cards/card-r-e/processes/proc-50eb901b4fee/stdout.log`: exit1, 90 pass / 6 fail of96. All six failures are `json_tree`/`jsonb_tree` with CASE-selected `$.a` root, across all three encodings. Native orders integer-key children before the TEXT-key selected root; TypeScript incorrectly sorts the root first because it gives that root a NULL key. Native TEXT versus JSONB BLOB distinctions are retained. A second independent capture compared byte-identically (proc-c3db6d28c264). The failures are real observable ordering discrepancies, not artificial assertions or tie-order expectations.

Source comparison: pinned `json.c:jsonEachColumn`, `JEACH_KEY` checks `nParent==0`, then `nRoot`, `jsonEachPathLength` and the final path segment, returning an integer index or text label for a non-root selected path. Candidate `json.ts:rows()` always calls recursive `walk(..., nil(), rootPath,rootPath,0)`, discarding selected-root key ownership. This is a producer primitive gap exposed by ORDER consumption, not grounds for special-casing SQL or host sorting. Repair belongs at selected-root key/path production and its callers; no repair is attempted in this add-coverage node.

## Limits

This is tests-first evidence, not suite acceptance or an integration commit. Ordered private-budget/work/cancel/deadline/rebind schedules, exact original checkpoint and the broader original225/prerequisite/intersection gate remain outstanding. Previous353 passing cases are not relabeled as resource coverage. Peer source/index and MAIN are preserved. No new compatibility breadth, native runtime or host registration is claimed.

## Narrow repair

Selected-root production now follows jsonEachPathLength and JEACH_KEY together:
retain ancestor value positions during the existing locate traversal; scan path
separators backward and compare prefix payload position to selected label/value
position; derive raw label/index and parent path at that boundary. Quoted dots
are therefore not mistaken for parent separators. Recursive first-row key and
path change together; whole-document NULL key, descendant keys, row identities,
missing paths and cursor release remain unchanged. A WeakMap retains only ancestor
positions on the already-retained parse image, not an independent evaluator.
Added24 native/public cases expose key/path/fullkey/value for quoted dotted labels
and negative-distance indices. This is source translation, no sorter substitution.

Final attributable candidate-base-plus-repair test run proc-f831166a7678 passes
all focused cases and typecheck/package boundary. Earlier proc-0d5f938505b4 also
passed but accidentally used dirty peer scanner changes; it is NOT clean candidate
evidence. Reconstructed json.ts from exact edfd35a plus ONLY root repair before
final run. Shared peer scanner edits remain intact, excluded from candidate.
Native120 recapture byte-identical SHA256
c1f1fafeecb1a5d2cd66bf33a184d9d9229707f65eb2b15a32009273aa3320f6.
Broader outstanding gates above remain outstanding. Final acceptance belongs to
verify, not this repair.

## Ordered lifecycle coverage follow-up

`json-ordered-resources.test.mjs` adds60 cases (all4 modules/all3 encodings):
producer work exhaustion64, private cap512, pre-abort, expired deadline; and
suspended sorted-drain reset/rebind, abort, timeout, work exhaustion and finalize.
The same statement rebinds to an empty document after reset, and independent
statement admission succeeds after failure/finalize. Test-only private-budget
prototype observation asserts actual reservations and zero retained bytes on
failed execution/reset/finalize; no runtime hook was added. Sorted DISTINCT,
LEFT NULL completion, OFFSET and LIMIT execute together, not unordered controls.
This is not exhaustive accounting or mid-parser asynchronous abort certification.

The native/public companion now has123 cases. Three new cases replay exactly
`SELECT t.x,j.value FROM t JOIN json_each(t.js) j ORDER BY t.x,j.key`.
Read-only fixture bytes copied from r-d ordered-consumer-repair/capture, not
regenerated by runtime, preserve original source data and all3 encodings:
UTF-8 b204738929478585e65b6efa68506644d852252a9180447fadeb2ffccbd80160;
UTF-16le 53ff881f91a31c52f78b83a26da358748458a9c94ccbb75563afadd81a34de2c;
UTF-16be 7d60f087dd5871f73f2e1a6854a1059c3d2b76f898e5105f3a59c251913a7b44.
Public typed rows/full metadata/reset are compared to FRESH pinned C capture,
not merely the old peer artifact. Native123 SHA256
8eabc638b9ffa63bdd7722f93b5ea4520f54e1c150c666a68f8f94fd307a18b9.

On exact d0712eca source plus these coverage files, final set-&& gate
`node --experimental-strip-types --test test/conformance/json-ordered-resources.test.mjs test/conformance/json-ordered-integration.test.mjs && python3 docs/research/card-r-e-ordered-integration-capture.py > ../native123-repeat.json && cmp docs/research/card-r-e-ordered-integration-native.json ../native123-repeat.json && npm run typecheck && npm run test:package-boundary`
passes183/183, zero failures, native repeat identical and standards pass
(proc-4c68491f42da). Earlier60 then183 intermediate runs also passed;
counts are not additive. No implementation edits this follow-up. Complete broad
original225/intersection acceptance remains verify work; selected resource cases
are not exhaustive scheduler or native spilling equivalence.
