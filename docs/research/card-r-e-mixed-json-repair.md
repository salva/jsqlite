# Mixed JSON repair — [[card:card-r-e]]

Base remains `10634c80e6bdf622cd21c68459000e2f482c3e3d`; inherited index/worktree and [[card:card-r-d]] mixed repair preserved. No isolated commit is claimed. This repairs two diagnosed failures, not product expansion.

## Source comparison and correction

The earlier Unicode-escaping hypothesis in [diagnosis](card-r-e-mixed-json-diagnosis.md) was incomplete: `{"é":1.5,"d":2,"d":3}` exceeds the one-byte JSONB payload threshold. `json.c:jsonBlobChangePayloadSize` selects the header width by actual payload; `jsonEachColumn(JEACH_ID)` uses offsets in that image. TS text cursor `contentStart` always added 1 despite `encodeJsonb` producing a two-byte container header. Corrected that owning primitive for locate, each and tree traversals. Child-label advances now use retained label type/payload width rather than encoding the decoded key, preserving escaped lexical label sizes. Existing binary bounds/header ownership remains untouched. No Unicode SQL special case or parallel evaluator.

Pinned `select.c:sqlite3GenerateColumnNames` and `columnType/generateColumnTypes` have separate ownership: name generation skips COLLATE; type/origin generation does not treat it as TK_COLUMN. TS `jsonResultMetadata` now preserves the generated direct-column name while returning null type/origins for COLLATE. Three old single-source test expectations incorrectly credited origins and were corrected to the independently captured upstream behavior. The independent oracle expectations were not changed.

No exceptional algorithm substitution. Existing node representation/bounded parse-image retention remains; no broader cancellation/JSONB lexical parity claim. Changed current guide/map/API/audit descriptions distinguish column names from origins. Shared mixed binder/aggregate implementation was not rewritten.

## Verification and attempted hypotheses

- First post-fix `json-table-functions.test.mjs`: 14/17, exit 1, solely stale COLLATE expectations; this failed check is not erased by later passing commands.
- Corrected fixture gate: table 17/17 plus typecheck/package boundary/diff pass.
- `node --experimental-strip-types --test test/conformance/json-mixed-integration.test.mjs test/conformance/json-physical-left-red.test.mjs test/conformance/json-table-functions.test.mjs test/select/real-column-affinity.test.mjs test/conformance/aggregate-sum-context.test.mjs test/conformance/selected-in-integration.test.mjs test/parser/tokenizer-parser.test.mjs test/schema/catalog-init.test.mjs`: **208/208**, exit 0. Includes the complete 133-case mixed typed/metadata/error/lifecycle matrix, REAL affinity/typeof/columnType, compensated sums, membership and parser/catalog CHECK/FK. [Output](work:///cards/card-r-e/processes/proc-663fc67f6010/stdout.log).
- Six JSON suites `node --experimental-strip-types --test test/conformance/{json-foundation,json-scalar-paths,json-scalar-full,json-table-functions,json-aggregate-paths,json-blob-document}.test.mjs && npm run typecheck && npm run test:package-boundary && git diff --check`: **28/28**, all checks pass. [Output](work:///cards/card-r-e/processes/proc-b73df61b5c0d/stdout.log).
- `node --experimental-strip-types test/conformance/run-audit-chinook-b1-b5-ts.mjs "$SAIVAGE_CARD_WORK_ROOT/chinook-fixture/Chinook_Sqlite.sqlite" && npm run typecheck && npm run test:package-boundary && git diff --check`: **56/56 match**, 0 mismatch, credit 0; standard checks pass. [Output](work:///cards/card-r-e/processes/proc-b0641ab7deb1/stdout.log).
- Earlier background full matrix, with slower server close before test-only `closeAllConnections` cleanup, also completed successfully. No HTTP cancellation timing guarantee follows from server cleanup.

Capture script/native source identity and provenance remain in [diagnosis](card-r-e-mixed-json-diagnosis.md). Public tests compare typed INTEGER/REAL/TEXT/BLOB/NULL, metadata and error codes/messages across three encodings; only selected work/private/pre-abort schedules are covered. No exhaustive corpus or rare mixed-combination claim. RIGHT/FULL/NATURAL/USING/reverse routes remain unexpanded.

## Delivery boundary

Ordinary source/doc corrections are narrow but overlap inherited dirty files (`json.ts` also has peer pretty edits, `vdbe.ts` mixed repair). Committing whole files or an isolated patch atop HEAD would respectively capture peers or omit required mixed dependencies. No shared index changes, reset or unsafe snapshot commit performed. Parent/Planner must arrange coherent reviewed staging with [[card:card-r-d]] and other owners. Focused repair success is not final card integration acceptance.
