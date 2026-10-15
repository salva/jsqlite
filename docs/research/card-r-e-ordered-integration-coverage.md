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
