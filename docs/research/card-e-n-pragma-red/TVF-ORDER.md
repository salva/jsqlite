# Ordered mixed metadata consumers — [[card:card-e-n]]

## Source comparison and bounded representation

The 66d9d742 admission gate rejected ORDER for metadata even though the shared
mixed-source compiler already lowered the source-independent sorter and SELECT
destination. It did not indicate a missing metadata row algorithm.
`pragma.c:pragmaVtabCursorClear/Filter/Next/Column` owns clearing prior arguments,
argument text conversion, initial advance, next/end cleanup and hidden values.
Existing MetadataFilter/Next and shared catalog producers retain that ownership;
no JSON identity or nested public statement is introduced.

`wherecode.c` schedules ready INNER predicates before inner iteration, while LEFT
ON determines a match before WHERE and NULL completion. The existing binder's
resolved source dependency sets and separate completion implement those branches.
`resolve.c:resolveOrderGroupBy` resolves ORDER against result aliases/ordinals or
source columns; `select.c:selectInnerLoop/pushOntoSorter/generateSortTail` collects
keys plus payload before draining to the destination. The existing shared VM
path already does this after each metadata candidate, including unmatched LEFT
payloads; it reserves cursors before sorter allocation and evaluates keys while
physical and metadata row registers remain positioned. Removing the metadata ORDER barrier repaired the original admission gap,
not all result resolution: 41fb81de still resolved star ordinals before expansion.
The later [expand-before-resolve repair](TVF-STAR-ORDER.md) corrects that semantic
owner without replacing the evaluator.
DISTINCT/LIMIT admission is intentionally unchanged. Existing bounded sorter
representation/tradeoffs apply; no new algorithm substitution or generic-vtab
claim. Metadata rowid stays temporary unsupported.

## Revision-bound evidence

Base: 66d9d742 / tree6ea07ed0. Original exact common checkpoint independently
recaptured pinned3.53.4 before this attempt; six ordered metadata cases rejected.
First candidate changed only that gate: fresh common capture/public reports all
45 matches (all encodings, full metadata and typed rows twice after reset),
including both exact constant and physical correlated SQL and ordered JSON.

`capture-tvf-order.py` uses the same pin-checked independent ctypes oracle, keeps
hidden empty declared type distinct from NULL, and embeds SHA256-bound images.
Additional native18 cases were captured before consuming them in the durable
regression: INNER constant/correlated, unmatched LEFT, hidden arg/schema,
NOCASE/DESC multi-key order, duplicate output aliases, table_xinfo, three
encodings. `tvf-order.test.mjs` compares every typed cell and all metadata fields
through public prepare/step/reset/finalize/close twice. They pass18/18.
This original finite matrix does not establish full ORDER grammar or star/ordinal expansion (the latter required the later [expand-before-resolve repair](TVF-STAR-ORDER.md)),
all error precedence or exhaustive resources. Status record retains actual
commands, changed-input verification and delivery identity. Existing boundary,
ON/readiness, identity, binding and seven-family tests are retained unchanged.
