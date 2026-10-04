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

## Review v9 revision — exact IntReal and enforced provenance

Accepted immutable review `record:///review.md?card=card-s-b-a-a-b-a-a&v=9` correctly identified two bounded defects in this repair. Earlier wording that the combined REAL/IntReal branch fully expressed IntegerAffinity and that imported load enforced the source pin was too strong.

R1 reproduced all three source counterexamples before edits: IntReal9007199254740993 became9007199254740992, and both signed64 endpoints remained REAL. Pinned vdbemem.c802 separates MEM_IntReal (exact integer-slot flag conversion) from MEM_Real (double roundtrip/endpoints). Mem now preserves that separate exact IntReal branch without Number conversion. Source-derived primitive tests check above2^53 and both endpoints across encodings, copy isolation, REAL fractional/endpoints and integral2^53. No production setIntReal caller or new public IntReal failure is claimed.

R2 generator now requires explicit `--library`, compares version and sourceid to manifest BEFORE fixture open, and emits checked oracle identity in `seek-rowid-numeric/1`. Public consumer checks schema/version/sourceid before TS assertions. Regenerated36 queries using verified3.53.4 source bf7c7f…59bcc; exact second recapture matches. Negative system3.45.1 library attempt is rejected before fixtures/output. Prior unverified capture is superseded as provenance evidence, not retroactively credited.

Commands:

```sh
python3 test/conformance/capture-seek-rowid-numeric.py --library .saivage/work/cards/card-c-b/oracle-build/build/libsqlite3-oracle.so
python3 test/conformance/capture-seek-rowid-numeric.py --library .saivage/work/cards/card-c-b/oracle-build/build/libsqlite3-oracle.so --output "$SAIVAGE_CARD_WORK_ROOT/seekrowid-review-revision/recapture.json"
cmp test/conformance/cases/seek-rowid-numeric-native.json "$SAIVAGE_CARD_WORK_ROOT/seekrowid-review-revision/recapture.json"
node --experimental-strip-types --test test/conformance/seek-rowid-numeric.test.mjs test/conformance/row-width-isolated-joined.test.mjs test/value/mem-core.test.mjs test/value/comparison.test.mjs test/value/private-state.test.mjs test/conformance/selected-index-controls.test.mjs test/conformance/run-advanced-index-ts.test.mjs test/storage/btree-reader.test.mjs
npm run typecheck
npm run test:package-boundary
python3 test/conformance/mem-manifest.test.py
python3 test/conformance/index-planner-manifest.test.py
git diff --check
```

Fresh regression **517/517**, no skips/cancels; manifests5/5+4/4, typecheck/package/diff pass. Initial new primitive test used nonexistent setReal and gave11/12, then corrected to established setDouble and reran12/12 before full517 lane. Separate pre-repair counterexamples failed3/3 as intended. Negative pin command intentionally exits nonzero; its supervising assertion verifies rejection/no output. Logs in purpose child `seekrowid-review-revision/`.

Changes remain limited to shared exact branch, its tests, capture/consumer provenance and this nearby living rationale. Mixed width/peer dirty changes are preserved. ONEROW disposition is bounded and does not approve general multi-source ordering. No parent e aggregate rerun, joined-WR repair or broader failure waiver. Ready for independent re-review of R1/R2, not project acceptance.

## Fresh ordinary LEFT continuation correction

Evidence refresh preserved 4fa06e2 but strict ordinary69 exposed six maxWorkUnits failures (two LEFT cases × three encodings); finalize rethrew the same limit. Source comparison: where.c sqlite3WhereEnd resolves each level's actual loop movement separately from LEFT iLeftJoin/NullRow/addrFirst re-entry and RIGHT Return. Our nextAt denotes the synthetic-null guard, not necessarily the movement opcode. For a LEFT exact rowid singleton, final patching wrote that guard's target instead of the following Goto; the Goto retained target0 and restarted initialization indefinitely. Added distinct advanceAt, captured AFTER LEFT guard/RIGHT Return, patched only singleton movement. Null-pass guard, match sentinel, cursor nulling and ON-before-WHERE order remain intact; RIGHT/FULL behavior unchanged.

First repaired strict run terminated correctly but failed3 sorter minima: peer ordering logic prematurely promoted an outer ordered non-singleton as global order before considering later loops. Narrowed the existing ONEROW-prefix proof so only the FINAL ordered producer can consume ORDER with all preceding loops exact rowid singletons. Pinned where.c wherePathSatisfiesOrderBy (5273 onward) excludes ONEROW loops from order-distinct disruption, but requires complete path examination; arbitrary later fanout is not proven. Ordinary LEFT retains sorter; reverse joined singleton-prefix test still consumes order. This is a bounded source-backed correction/attribution of current peer ordering block, not general multi-source acceptance. No widths/costs/cache/schema edits staged.

Permanent ordinary public harness now requires work root, rejects every unexpected prepare error, and counts only completed row/private-bound comparisons toward69 credit; disposable stricter reproducer retained under acceptance-refresh. This preserves the six-failure reproducer rather than masking it with larger budgets or altered rows.

Final corrected runtime: ordinary69/69 exact rows/private bounds; broad171/171 (ordinary, LEFT, RIGHT/FULL, selected-IN/controls, advanced/storage/shared/numeric); R1/R2/lifecycle/isolated-joined/endpoints388/388 (117+63 prepared comparisons zero failures). Full commands and verification attribution in current card status. Intermediate six limits and subsequent three sorter-min failures retained. No parent e aggregate rerun, WR repair or historical failure waiver.

## Renewed delivery R1/R2 (review v11)

Guide/map/mutable audit now have explicit revision-labeled supersession, not
historical deletion. Fresh existing five-fix semantic execution on5713c0f mixed
runtime: window lead tests5/5 (actual digest-bound Chinook present); aggregate
composition6/6 and Chinook3/4; CTE admission31/31, execution9/9, opcodes1/1,
Chinook3/3; BETWEEN controls/lowering2/2 plus exact-span audit56/56 matches
(zero credit companion corpus); JSON naming/composition17/17. Counts overlap
and are not additive compatibility credit. Fresh ordinary69/69 retained.

**R2 residual:** C5 aggregate Chinook test fails ONLY at its preserved metadata
assertion: expected `NVARCHAR ( 120 )`, actual `NVARCHAR(120)`. Repeat reproduces.
Pinned independent public-C metadata for the **identical SQL** returns
`NVARCHAR(120)`; captured native row remains AC/DC,2. Existing test stops before
row assertions, so C5 is NOT TS row credit. No SQL, rows, expectation or runtime
changed. Review explicitly requires preserving expectations: this observed
stale metadata mismatch needs bounded disposition before that test can be
reported green. No production defect is established by it. Other aggregate
scalar/derived/inner-join EXISTS semantic branches passed unchanged. Existing
B1–B5 historical53/3 mismatch is not erased; current audit is56/56.

Pinned native window scope, aggregate rows, CTE architecture and exact audit
recaptures acquired; CTE/audit cmp exact. All command/artifact and per-suite
mapping details reside in current card status. e/root/WR qualifications retained.

### Follow-up: exact C5 metadata expectation reconciled

The materially informed next attempt changes only the stale declaredType
expectation to pin-observed `NVARCHAR(120)`; SQL, native rows, column names,
origins, reset rows and runtime remain unchanged. This reconciles the expectation
to the exact catalog span rather than suppressing the metadata assertion. The
prior9/10 and repeat0/1 failures remain in evidence. Fresh full aggregate
composition + Chinook suite now **10/10** (6/6+4/4); C5 reaches both AC/DC,2
runs and disjoint correlated destinations yielding AC/DC,4. No new production
repair/refactor or public contract change. Other four named-fix semantic lanes
recorded above apply unchanged; complete command inventory is in card status.
