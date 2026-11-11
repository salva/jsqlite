# CF06 positioned aggregate input correction

Bounded delta against G17 `65287625a295e4c4702d0b878d165b4ada21364d`, tree
`5258aadd9302d7ef303fe390d55e5b2207aa31d0`. No root publication.

Before: resolved JSON declarations were overwritten by schema.findTable in
AggInfo enrollment outside a two-source physical-first adapter. J3 reversed
JSON/physical and J2 third-source grouped/window raised false missing-table
errors. Independent pinned 3.53.4 source-ID-checked native returns count 8 and
four groups `(1,2,1),(3,2,2),(5,2,3),(7,2,4)` respectively across all encodings,
including metadata and reset. Accepted red evidence is in card status v41.

After: the existing shared WHERE input adapter allocates payload width from all
resolved source declarations, retaining one row identity slot each. It receives
actual positioned source rows through compileInnerTableSelect sourceRow and
consumeRow, not host materialization. Retained first-source ephemeral producer
behavior is preserved. AggInfo source identity always comes from aggregatePlan.
There is no new module framework/evaluator, planner, or readiness substitute.

Source comparison: select.c sqlite3Select enters sqlite3WhereBegin before group
sorter capture/updateAccumulator. Window rewriting produces an inner grouped
SELECT using the same path. wherecode.c's coroutine/virtual loop branches own
positioning, break/continue and Filter/Next. TS shared WHERE likewise emits
JsonTableRewind/Next/Close, ready terms, and ON/outer completion before delivering
the positioned row. The adapter only copies payload/identity into AggInfo slots;
existing grouping/finalization/HAVING and destination phases are unchanged.
sourceRow's module columns-use test keeps unrequested hidden arguments NULL;
JSON row identity remains distinct from payload id/key. Existing SELECT AST
and resolved expressions are retained, not reconstructed from SQL text.

Focused regression adds reversed and third-source implicit/group/window cases,
full metadata/typed rows, two reset cycles, rebound JSON parameters including
empty input, JSON rowid versus value, and prepare-name versus step-malformed
error ordering for utf8/utf16le/utf16be. Commands from candidate:

- `npx tsc --noEmit -p tsconfig.json`
- `node --experimental-strip-types --test test/conformance/aggregate-module-position.test.mjs` — 3/3
- Focus plus json-mixed-rowid-integration and json-aggregate — 171/171.
- Focus plus json-child-readiness, json-table-functions, aggregate-group-lifecycle,
  direct-json-window-controls (and supplied absent json-mixed-aggregate-native
  pattern, which added no tests) — 105/105. Includes established first-error,
  incremental LIMIT, budget/control/cancel, group cleanup and encoding controls.

Evidence: card process outputs proc-455b962c8f95, proc-4800d0f0ea98,
proc-d1d30b86051c, proc-3094953666b6. Public packet J0-J3 also reran all encodings
and reset with no errors. No exhaustive new-shape-specific generated-affinity,
private refund/cancel or error-order oracle matrix claimed. Existing companion
coverage is not independent acceptance of every new composition. General
retained-source placement/metadata-module admission is unchanged, not universal
module/aggregate compatibility. Integration/review remains parent-owned.
