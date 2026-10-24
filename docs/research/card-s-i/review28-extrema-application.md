# Review28 bounded extrema owner correction (author evidence)

Base: `0b643fedb71da83c0175d0768dc0b52b298f3b9d`.
Pinned SQLite 3.53.4 source ID
`bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.

`window.c:sqlite3WindowCodeInit` creates the bounded-start min/max application
index with value descending only for min, ascending sequence for both.
`windowAggStep` skips NULL, increments sequence and inserts value+sequence;
inverse SeekGE on the value prefix deletes the earliest equal sequence.
`windowAggFinal` publishes NULL or Column0 at Last. Ordinary
`func.c:minmaxStep` instead keeps its best on equality. These owners must differ.

The corrective implementation now uses shared packed `PrivateKeyVmCursor`,
`PrivateBlobkeyPages`, KeyInfo, Mem and statement limits/budget. The VM aggregate
instruction envelope dispatches inverse-capable extrema to independent application
state, bypassing ordinary aggregate callbacks. Its accumulator owns cleanup;
Null/AggReset/reset/error/finalization close the arena's owning cursor. Sequence
is monotonic until state is cleared. Step packs `(value,sequence)` and charges the
record during insertion; inverse uses facade prefix SeekGE/Delete; publication
awaits Last and copies Column into owned Mem before the payload borrow expires.
The supplied packed Delete primitive replaces the previous ordered Mem-entry
application, not every ephemeral consumer. Ordinary minmax remains first-best.

Primitive delta was fast-forward integrated from f43e4ffb to independently
accepted 76add691/tree49da6000 (implementation80fceb43). It preserves the original
foundation because f43e4ffb is its ancestor and the checkout/index were clean.
Local primitive acceptance is not independent acceptance of this new caller.
No native heap/Pager rollback parity is claimed. Current revision/test details
and still-unperformed broader gates remain in [[card:card-o-c-b]] status.

`test/conformance/window-extrema-application.test.mjs` preserves review28 SQL and
checks min/max both numeric representation orders, eviction, replay, all three
encodings, NULL, NOCASE, ordinary best-on-tie, reset after yield, done-time refund
and injected application Delete failure. Original red test failed at x30 INTEGER
versus REAL (proc-87ced22f6b80); initial wrong import was an authoring failure
(proc-fb8fe9707cca), not compatibility evidence. Corrected focused test passes2/2
(proc-81abfb9b4873). Native shell on all three typed fixtures independently gives
INTEGER1 then REAL1 then REAL1 for both functions, 'A','a','a' under NOCASE,
and INTEGER1 for ordinary min/max (proc-c3fa7400467f).

Final verification and current remaining work are maintained in
[[card:card-o-c-b]] status; this is author evidence, not independent acceptance.
Concat now follows `func.c:groupConcatStep/Inverse/Value` with a UTF-8
Uint8Array StrAccum, nAccum, first separator length and optional variation lengths.
`printf.c:sqlite3StrAccumEnlarge` supplies exponential capacity growth; the TS
buffer keeps its allocation across inverse, removes bytes with copyWithin and
publishes a nondestructive slice. Buffer capacity plus length entries are charged;
allocation rounding is JS exact capacity rather than allocator usable-size.
Errors fail the statement immediately through existing first-error cleanup rather
than keeping a C accError until publication. The public maxResultBytes limit
counts content, not C's terminator; one terminator capacity byte is charged.
`window-concat-straccum.test.mjs` covers multibyte values, variable separators,
empty removal/reset and repeated nondestructive publication/replay. Original
per-row text/prefix storage and join-at-value path are removed. Application selection now comes from window lowering's AggStep.windowInverse metadata rather
than a global inverse-op/register scan. All-encoding EXCLUDE typed-tie tests found
NO OTHERS's full-scan result overwritten by the independent sliding branch;
that branch now excludes the full-scan owner. Pinned shell gives INTEGER1,
INTEGER1,REAL1 for that explicit NO OTHERS query; implicit exclusion instead
uses newest equal representation. These are author checks, not independent
acceptance. No beta5, full522, installed/browser, composition-union or whole-card
acceptance follows.
