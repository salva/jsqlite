# JSON table column demand repair

Input: `d4bfd8fc93385a58c0b49af296133aeabf379579` (pinned SQLite source identity in `reference/sqlite/manifest.json`). Scope is undemanded per-row hidden input copying, not the separate original20k scheduler/admission decision.

## Owning comparison and design

Pinned `src/json.c:jsonEachColumn` JEACH_JSON returns the parse's original text or BLOB with SQLITE_TRANSIENT only when called; ROOT returns the retained root prefix with SQLITE_STATIC. `select.c:selectInnerLoop` produces referenced expressions; `window.c` rewrites referenced expressions into its producer. The old TS cursor constructed ten values, and Rewind/Next copied all ten into owned Mem registers even for `SELECT value` or visible star.

The compiler now carries column demand into JsonTableRewind/openJsonTableCursor. Legacy binders record resolved indices (including arguments depending on prior sources); linked producers use resolved source identities, recursively including nested/compound contexts. A fixed ten-slot row remains to preserve existing positional register and AggInfo layouts. Undemanded slots are NULL, with no document/root/value conversion; sourceRow snapshots similarly leave unused module slots NULL. Explicit hidden json still travels through owning Mem.copyFrom, preserving TEXT/BLOB and lifetime across yields, reset and LEFT null-extension. Cleanup/reservation and cursor advancement are unchanged. Direct internal cursor callers without a demand contract still receive full rows.

This is static per-source demand, not an implementation of callback-level xColumn laziness: a referenced column can still be produced on rows whose later predicate rejects it. Traversal still owns paths/keys and materializes the parse image; NULL slots still allocate Mem objects. The repair removes whole-document copies for undemanded hidden columns, not all allocations, all memory overhead, native coroutine/spill parity or full JSON compatibility. No browser requirement to eagerly copy hidden data is asserted.

## Evidence

Detailed commands/failures/current obligations: [[card:card-r-d]] status. Disposable source and logs: `work:///cards/card-r-d/hidden-copy-repair/`.

- New hidden-demand matrix initially0/3 on baseline. All four modules/three encodings cover visible/root/star/explicit hidden document, descriptor stability, typed hidden TEXT, reset/repeat. Tree root value legitimately copies the whole document once as visible value; witness permits that, rather than changing the runtime.
- Production Mem.copyFrom original probe unchanged except source import: N8/N64 visible/root/star copies drop9/65 to1/1 (17/183 source bytes). Explicit json remains17/129 (289/23,607 bytes). This counts actual owning copy calls and source payload, **not total allocations, resident or peak heap**.
- Consumer matrix baseline fails first mixed visible projection65 copies. Linked-only attempt still65: actual public route used the specialized mixed binder. After mixed binder propagation, aggregate31 copies were input setup once per physical row, not per JSON row; bound is31 for this fixture. Tests include mixed projection, grouped/ungrouped aggregate, explicit json/max(json), retained derived Window visible and hidden projections, two module sources, hidden WHERE/ORDER use. Direct mixed Window syntax already reaches an unrelated execution-only scalar-lowering error; matrix uses established retained Window composition, without claiming that direct gap fixed.
- Exact archive actual sequential typecheck + expanded focused suites1519/1519, zero fail/skip/cancel (`proc-49b891cfa7eb`), covering existing mixed readiness/resolution/ordered/rowid, table functions, LEFT, CTE Window controls and public parent tests. Earlier linked-only/mixed intermediate failures remain in logs, not erased by this success.

No fresh pinned native result capture, original20k rerun, complete TEXT/JSONB allocation/depth/resource census, package/Chinook/CHECK/FK/full-product gate or independent acceptance is claimed by these focused checks. Existing selected tests include source-derived typed/native expectations; they are not a new native compatibility claim. Original review21/t51 primary profile remains unverified here. Parent/independent integration must assess those boundaries separately.
