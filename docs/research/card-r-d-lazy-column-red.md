# Referenced JSON columns before runtime demand — red evidence

Input is exact committed `ee29e05c57556af9b670820f193b04b5af1681a9`, archived to `$SAIVAGE_CARD_WORK_ROOT/lazy-column-red/source` with linked dependencies. Dirty shared engine is not executed or modified. Prior static-demand delivery remains valid for unreferenced columns; this check addresses referenced columns behind runtime control branches.

Commands:

```
node --experimental-strip-types docs/research/card-r-d-lazy-column-probe.mjs > "$SAIVAGE_CARD_WORK_ROOT/lazy-column-red/public.jsonl"
python3 docs/research/card-r-d-lazy-column-native.py > "$SAIVAGE_CARD_WORK_ROOT/lazy-column-red/native.jsonl"
```

Public production run proc-22299844b869 exited0; native capture/summary proc-e4bf127eb314 exited0. Native sqlite3_sourceid returned `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`, matching the pinned identity. Native library reused from card oracle-build; fresh queries and EXPLAIN obtained here. Native executes in-memory (no fixture data required), not three separately encoded databases: encoding repetitions are SQL repetitions, **not native all-encoding certification**.

120 public cases: four modules × TEXT/actual jsonb(document) BLOB input × three public fixture encodings × five branches. All completed without errors and matched native row counts. Typed public output classes and native storage-class rows are captured; this summary does not claim a complete value/metadata/subtype comparator.

Document `[0,...,15]` is39 UTF-8 bytes. For UTF-8 json_each TEXT input:

| branch | rows | exact-document owning copies | copied source bytes |
|---|---:|---:|---:|
| SELECT json ... WHERE key<0 |0|17|663|
| CASE WHEN key<0 THEN json ELSE 'ok' END |16|17|663|
| coalesce('ok',json) |16|17|663|
| EXISTS(SELECT json ... WHERE key>=0) |1|2|78|
| explicit SELECT json |16|33|1287|

Rejected-row each with actual JSONB input:0 rows,16 BLOB copy calls/640 BLOB source bytes plus39 TEXT setup bytes. Tree rejected case:0 rows,18 exact-text copies702 bytes or17 BLOB copies680 bytes plus39 setup. Both binary module variants show the same counts for corresponding traversal. BLOB counters count **all** BLOB copies during stepping, not a proven document-identity predicate; these simple hidden-only projections and owning path support attribution but not a general BLOB census. Prototype wrapper always calls original copyFrom, restores it, and does not change control flow. Counts are copy operations/source payload, not allocations, heap/peak/private-accounting totals; observational conversions can allocate too.

Pinned EXPLAIN independently discriminates control demand, not just result rows:
- rejected: key VColumn at6, Ge at7 jumps10 over hidden json VColumn at8 on every row;
- CASE: Ge at7 jumps10 over hidden VColumn at8 for nonnegative keys;
- COALESCE: NotNull at7 jumps9 over hidden VColumn at8;
- EXISTS: no hidden-column8 VColumn anywhere (only key column0), stops at first matching row;
- explicit: hidden-column8 VColumn at6 on every row.

Pinned json.c jsonEachFilter resets/positions parse traversal, jsonEachNext advances it; jsonEachColumn owns requested value conversion and JEACH_JSON SQLITE_TRANSIENT copy. vdbe.c OP_VColumn first checks nullRow, then initializes destination context/subtype permission and calls xColumn, followed by its error handling. Current TS JsonTableRewind passes static columns into openJsonTableCursor; its row() converts every statically demanded field before returning the row; Rewind/Next then copy that row into registers before predicate/CASE/COALESCE/EXISTS execution. Static source demand cannot represent the demonstrated runtime branches. Missing column-demand execution machinery is a source-fidelity/resource gap, not established browser necessity.

No repair or runtime mutation was performed. Predicate/error-precedence discriminators, visible conversion allocation/subtype census, explicit-hidden lifetime/reset/LEFT/null-row/private-budget/cancel/deadline tests and full typed public/native comparisons remain for the correction stage; these copy witnesses do not prove an observed error-order difference or quantify allocation severity. This finite discriminator suffices to reproduce a resource-production gap without inventing a semantic row mismatch. Current guide's static-demand limitation is truthful but not evidence that the gap is an approved algorithm exception. No product-scope change or approval is claimed.
