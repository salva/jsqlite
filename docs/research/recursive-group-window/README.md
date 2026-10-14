# Recursive grouped Window generated projection

Pinned source: SQLite 3.53.4, source ID and independently loaded library digest in
[`native.json`](native.json). Capture command:

```sh
python3 docs/research/recursive-group-window/capture.py \
 .saivage/work/cards/card-w/postalpha-original225/oracle-build/build/libsqlite3-oracle.so \
 > docs/research/recursive-group-window/native.json
node --experimental-strip-types --test test/conformance/recursive-group-window-projection.test.mjs
```

`sql.json` holds the original seven failing recursive grouped/correlated cases and
exact original FILTER table sibling. Capture creates t1(a INTEGER) with 1,3,5,7
independently through native sqlite3_exec. All ten (eight originals plus two NULL controls) prepare=0, final step=101;
full name/type/database/table/origin and typed rows retained. Fractional LIMIT
occurs behind false/NULL predicate branches and does not execute in that case.

At MAIN b417ac4a2dd4d054c7c694fd9326328b9250d00f original tests crashed because
recursive grouped window lowering changed generated projection without updating
resolved result carriers. `window.c:selectWindowRewriteExprCb` changes subquery
slots and parent column identities together; TS now uses
`resolvedProducerProjection` to rebuild generated result ownership while retaining
column bindings and phase cursor/register mapping.

The expanded native-first metadata test found a second divergence: recursive
synthetic sources wrongly advertised main/q/a provenance. `select.c:columnTypeImpl`
requires physical table/subquery provenance. The descriptor primitive now returns
no physical origin for nonphysical sources without a linked producer, while
retaining affinity/collation and honoring linked subquery producers first.

Permanent test compares all ten native cases, three encodings, three executions
(two resets), typed values and full column metadata. Private-entry failure,
pre-aborted cancellation, zero deadline and work budget failure test retained
error/reset/restart and cleanup in all encodings. A larger same-shape recursive drain also tests host timer delivery before first
output, timer-triggered mid-step cancellation/reset/restart and nonzero execution
deadline in all encodings. This proves these focused controls, not universal
scheduler fairness.

Revision-bound command/results and shared-index delivery limitations:
[[card:card-o-b-g]] status.md. No browser/alpha/release claim.
