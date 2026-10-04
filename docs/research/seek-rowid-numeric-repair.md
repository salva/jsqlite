# SeekRowid NUMERIC-copy repair — causality handoff

Executor [[card:card-s-b-a-a-b-a-a-a]], 2026-10-04. This report precedes any parent [[card:card-s-e]] aggregate rerun. Original aggregate **1962/1490/472** and [[card:card-s-e-c]] FAILED remain historical failures, not retroactive passes. Joined WR storage fence and broader four reds are separately owned; no width producer changes are made here.

## Owning correction

Pinned SQLite3.53.4 `vdbe.c:5495–5546 OP_SeekRowid` copies a noninteger input, applies NUMERIC affinity, rejects conversion lacking MEM_Int before cursor access, and retains the original input register. TS previously rejected every non-INTEGER initial storage class. `vdbe.ts` now copies to Mem and applies NUMERIC affinity before the existing seek/error/counter branches. No SQL-specific patch or BigInt binding workaround.

The new boundary tests exposed a second owning primitive divergence: `Mem.applyAffinity` used `sqlite3RealSameAsInt`'s narrow text-conversion rule for existing REAL values. Pinned `vdbemem.c:802 sqlite3VdbeIntegerAffinity` instead requires REAL→int→REAL equality and excludes the two signed64 endpoints. Corrected only that existing-numeric branch; text conversion retains its distinct rule. This admits integral REAL 2^53 to a physical seek, excludes fractional/out-of-range/endpoints, and preserves the original public REAL payload. No width/callback/bitwise/cache changes belong to this repair.

## Native and public evidence

`capture-seek-rowid-numeric.py` uses the manifest-pinned existing oracle via the established development-only capture helper and immutable row-width fixtures. 12 bindings × three encodings = **36 native typed boundary queries**, including integral JS-number REAL, fractional, large integral/lossy text, signed endpoints/out-of-range, numeric/nonnumeric text and NULL. Public test compares exact INTEGER/REAL/text rows, `typeof(?1)` and original payload; rebind/clear, retained reset, exhaustion and private tableSeeks are checked on both runs. First harness attempts failed due to incorrect prepare-envelope and capture tuple handling; these were test setup defects, not product evidence. Once corrected, counters exposed the REAL-affinity primitive divergence above; final **3/3** encoding tests pass. Oracle regenerated exactly after correction.

## Joined causality

Before repair, existing `row-width-isolated-joined.test.mjs` filtered to `utf8/before` gave **0/3**: rowid, ordinary CROSS join and forced ta path returned empty. After copy-affinity fix, same command gives **3/3**. Complete unchanged isolated joined suite plus numeric tests: **363/363** (360 original cases, three new encoding tests). Original public SQL and JS-number bindings retained; typed rows, columns, repeated bindings, reset-retained rows, clear and finalization execute.

Inspected actual `compileInnerTableSelect` selected-path consumer around vdbe.ts3458: selected loops come from `multiWhere.path`; INNER source order comes from loop ordinals, LEFT/RIGHT retain their null-row ownership. Index roots open from selected physical identities. At each positioned level bound RHS evaluation follows prerequisites; outer exact-rowid loop emits SeekRowid and singleton continuation; the later source consumes correlated equality RHS only after outer cursor positioning. Ordinary CROSS and forced ta both recover without changing producer/prereq/lowering control. Thus the demonstrated empty-row cause for these fixtures was SeekRowid; this does not certify arbitrary joins or WR storage.

## Peer reverse ORDER disposition

Current actual path solver already implements pinned `where.c:5273 WHERE_ONEROW` for exact IPK prefixes, retaining unknown order until a later capability supplies order. It does not use statistical nOut0 as uniqueness. This is current production peer work, not newly implemented here or a claim about historical conservative handoff. Native independently captured forced SORT0/control SORT1 is consistent with actual typed3,2,1 output. Scoped peer assertion correction now demands forced sorterRows0 and scan sorterRows3 (native SORT1 counts operations, TS counts inserted rows). No fabricated rows/sorting or planner edits. Focused test passes across three encodings/reset.

## Fresh commands/results and gaps

- `node --experimental-strip-types --test --test-name-pattern='utf8/before' test/conformance/row-width-isolated-joined.test.mjs`: 3/3 after repair, versus prior 0/3.
- `node --experimental-strip-types --test test/conformance/row-width-isolated-joined.test.mjs test/conformance/seek-rowid-numeric.test.mjs`:363/363.
- Focused joined reverse range and ONEROW reverse b tests:1/1 each (multiple encodings/runs per test).
- Fresh 13-suite lane: seek-rowid-numeric, row-width-isolated-public, where-operand-admission-public, selected-in-integration, selected-index-controls, run-advanced-index-ts, btree-reader, mem-core, comparison, private-state, open-http, private-endpoint-seek-control, window-endpoint-seek-control-public: **1254/1254**, no skips/cancels. Initial lane was1253/1254 solely missing r1-native capture; acquired fresh pinned captures then reran full lane, not waived.
- `capture-where-operand-admission.py --library .saivage/work/cards/card-c-b/oracle-build/build/libsqlite3-oracle.so --output-dir "$SAIVAGE_CARD_WORK_ROOT/r1-native"`:117 queries/234 native executions.
- R2 analogous `capture-where-order-consumption.py ... --output-dir "$SAIVAGE_CARD_WORK_ROOT/r2-native"`:63 queries/126 executions plus six errors.
- Public R1/R2:2/2 wrappers;117 and63 cases, zero failed execution/error comparisons.
- typecheck, package boundary, index planner manifest4/4, Mem manifest5/5, diff check pass.

Logs are in card work child `seekrowid-isolation/`: preexisting.diff, vdbe-before.ts, mem-before.ts, advanced-before.mjs, native.json, regressions.log (initial ENOENT failure), regressions-fresh.log (1254 passes). Mixed dirty workspace is preserved, index initially empty. Isolated staging must contain only repair hunks and new evidence; no global clean claim. Parent aggregate and joined WR acceptance have NOT been rerun or declared green. Integration owner must independently verify remaining full acceptance/lifecycle coverage; selected/error/cancel/resource/storage suites are bounded evidence, not universal compatibility.
