# beta6 aggregate-subquery destination consolidation

## Source and bounded decision

Input integration-beta5 HEAD `942e6135ab5c212cf02d46d51171cfb94ce807ab`;
SQLite 3.53.4 source ID is asserted against reference/sqlite/manifest.json by
[capture-beta6-destination.py](../../tools/oracle/capture-beta6-destination.py).
[Selected investigation](card-t-a-beta6-maintainability.md) identifies the
previous identical 15-line bodies at vdbe.ts3953–3967/3972–3986.

Pinned expr.c sqlite3CodeSubselect3841–3988 initializes destination and Once,
then invokes sqlite3Select without choosing the child's grouping algorithm.
select.c sqlite3Select's grouped branch8468ff and ungrouped branch8872ff own
that distinction. TS retains the same ownership: one inline destination body
calls compileAggregateSelect with the same shared builder, parameters and linked
transient plan. This is not an exceptional algorithm substitution.

The old guards' exact union is
`aggregateShapeSupported(nested) && nested.from.items.length>=1 && (nested.hasGroupBy || selectHasAggregate(nested))`.
Both inspection helpers are read-only; changing their short-circuit inspection
order allocates/emits nothing. GROUP BY without an aggregate is intentionally
included. The preceding custom materialized-aggregate path remains byte-identical
and higher-priority. The surviving body is byte-identical: destination/cursor
allocation and initialization, Once, linked resolution, child generation, Once
patch, then IN lhs evaluation/comparison. No catch/fallback was introduced:
selected errors remain terminal. Encoding/KeyInfo/collation/affinity and cleanup
remain existing owners. No behavior or performance improvement claimed.

## Finite native-first evidence

New [queries](beta6-destination-queries.json) and
[native capture](beta6-destination-native.json) reuse the three existing encoded
scalar-filter fixture images (hash-checked). Pinned native capture precedes
production edits; captures typed INTEGER/NULL cells and all five metadata fields,
changed bindings7/NULL/2/7, two reset cycles per binding, DONE/finalize/close.
FROM-backed GROUP BY without aggregate is directly covered, alongside grouped
aggregate WHERE/HAVING/order/offset, ungrouped empty/nonempty aggregates,
scalar/EXISTS/IN/NOT IN NULL and retained derived specialization, malformed names.
New public test also checks cancellation and private-entry-limit sticky error,
reset and finalize on these FROM-backed destinations. No new REAL/BLOB claim;
unchanged wider destination controls remain finite evidence, not global parity.

Commands (cwd integration-beta5; D=$SAIVAGE_CARD_WORK_ROOT/beta6-destination):

- `python3 tools/oracle/capture-beta6-destination.py /work/jsqlite2/.saivage/work/cards/card-e-h/oracle-build/build/libsqlite3-oracle.so "$D/native-work" > docs/research/beta6-destination-native.json`: exit0, source ID/library SHA recorded in capture.
- Before repair: `timeout 80s node --experimental-strip-types --test test/conformance/beta6-aggregate-subquery-destination.test.mjs`:3/3.
- After repair: `/work/jsqlite2/node_modules/.bin/tsc --noEmit`:pass; same test plus grouped-scalar-destination, select-aggregate-destination, select-correlated-scalar-destination, select-destination-atomic:26/26 zero fail/skip/cancel.
- Structural check: original bodies equal; new source contains exactly one fewer identical body; guard truth table16 combinations agrees; all preceding source bytes unchanged. `git diff --check`:pass.

Exact artifacts at work:///cards/card-t-c/beta6-destination/: before.log,
after.log, type-corrected.log, structural.log; original RED evidence at
work:///cards/card-t-c/beta6-destination-red/ownership.json and focused.log.
Initial type command incorrectly assumed checkout-local `.bin/tsc`; exit127,
no tests executed in that attempt (type.log). Corrected explicit existing root
tool path passed. A large apply_patch invocation was rejected without changes;
exact selected edits then succeeded. No behavioral repair hypothesis failed.

Author evidence only. Independent nonauthor delta review is outstanding; no
commit/index synchronization performed pending that approval. Root combined
package/browser/W/V and full migration acceptance are not supplied here.
