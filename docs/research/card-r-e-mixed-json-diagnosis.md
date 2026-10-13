# Mixed physical/JSON integration diagnosis — [[card:card-r-e]]

Current base HEAD is `10634c80e6bdf622cd21c68459000e2f482c3e3d`, not an isolated delivery. Extensive inherited index/worktree edits remain untouched. The uncommitted [[card:card-r-d]] mixed repair is present. No commit or parent approval is claimed.

## Oracle and reproduction

`sh tools/oracle/build.sh` independently rebuilt 3.53.4 with ENABLE_COLUMN_METADATA and ENABLE_MATH_FUNCTIONS in the card work root; [build output](work:///cards/card-r-e/processes/proc-c9a8e875ffa0/stdout.log). [Capture script](card-r-e-mixed-json-capture.py) asserts version and full source ID, opens fixtures read-only, preserves INTEGER/REAL/TEXT/BLOB/NULL and five metadata fields, and emits [native capture](card-r-e-mixed-json-native.json). It is development-only, not runtime native integration. JSON capture is sourced directly from current pinned C, not a translated expected-value generator.

`python3 docs/research/card-r-e-mixed-json-capture.py > docs/research/card-r-e-mixed-json-native.json` captured 132 cases: four each/tree variants × eleven combinations × three database encodings. Combinations cover Unicode/duplicate labels/REAL, text and binary containers, NULL/empty LEFT input, dynamic roots, NOCASE, scalar/vector IN, immediate nested SELECT argument/ON, grouped aggregate FILTER/projection, empty aggregate and malformed input.

## Observed red gate

`node --experimental-strip-types --test test/conformance/json-mixed-integration.test.mjs` (before adding separate control test) completed **108 pass / 24 fail / 132 tests**, exit 1. [Full public comparison output](work:///cards/card-r-e/processes/proc-5f4c97db7d3e/stdout.log).

Two reproducible families, across all four variants and three encodings:
- Text object Unicode label `é` exposes wrong JSON cursor IDs: actual `1,8,12`, pinned `2,9,13`. `json.c:jsonEachColumn(JEACH_ID)` uses binary byte offsets. TS `openJsonTableCursor` reconstructs text positions with `encodeJsonb`; its default type-7 UTF-8 label encoding misses the pinned text parser's escaped label bytes. This is shared JSON representation/traversal ownership, not LEFT-match or packed IN execution. Do not adjust expected IDs or special-case this label.
- `j.value COLLATE NOCASE AS v` metadata: native origins/database/table are null; TS reports main/json_each/value (analogously other variants). Pinned `select.c:columnType` only obtains origins for the owning expression's admitted column/select cases; TS `jsonResultMetadata` unwraps COLLATE. Name generation and type/origin generation need separate ownership; this contradicts earlier broad COLLATE-metadata claims. Rows of this case have not been compared because metadata fails first.

These need notification/coordination with [[card:card-r-d]] through parent before overlapping implementation edits. No implementation or shared current-guide changes were made by this diagnosis. The red tests retain independently obtained expectations and are not compatibility claims.

## Passing evidence

- Separate added mixed control schedule: `node --experimental-strip-types --test --test-name-pattern='control errors' test/conformance/json-mixed-integration.test.mjs`: **1/1 pass**, work/private/pre-aborted cancel, saved first-error identity through step/reset, reset releasing failure, non-private re-step, finalize and subsequent prepare/step. This is three specific schedules, not exhaustive cancellation/private-state accounting.
- `npm run typecheck && npm run test:package-boundary`: pass; [output](work:///cards/card-r-e/processes/proc-3e0d097a8e29/stdout.log).
- Existing repair/parent composition/outer aggregate/subquery/multisource/IN/reset/parser/schema gate **276/276 pass**, exit 0; [output](work:///cards/card-r-e/processes/proc-6c02fb550b97/stdout.log). Command listed in current status. Parser/catalog coverage includes CHECK/FK; no new Chinook/REAL/sum runner executed here.
- `git diff --check`: pass. No staging, reset or commit. Captures/tests/evidence are newly owned untracked files only.

## Remaining integration bounds

Retained native capture is not exhaustive upstream corpus parity. Metadata and IDs prevent adequate passing coverage now. Cursor resource checks do not cover every mid-iteration cancellation, error, private-state cleanup or dependency-rebind schedule. RIGHT/FULL/NATURAL/USING/reverse joins remain outside this repair. An isolated reviewed delivery milestone, current-contract correction and adjacent REAL/sum/Chinook validation remain future work, not accomplished diagnosis.
