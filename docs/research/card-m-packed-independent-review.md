# Independent practical joined IN / packed migration review

Review [[card:card-m-f-k]] statusv129; HEAD `ef62b9c5ab6b745a5270a779b3aba928c169b944`, source `070cc69562df98c4546fc30c1f89f46d4bd2c261`, guide/map `7a8185ac83769f5f68b3e6b47748ee6cd762914b`. **Not accepted: independently reproduced valid correlated LEFT JOIN ON prepare failure in all encodings.** Packed migration passing tests are not sufficient for requested practical joined scope.

## R1 — valid outer-correlated ON membership loses NameContext

```sql
SELECT p.id,r.id FROM pairs p LEFT JOIN pairs r
ON p.a=r.a AND r.b IN (SELECT q.b FROM pairs q WHERE q.a=p.a)
ORDER BY p.id,r.id
```

Pinned SQLite3.53.4 prepares, executes twice and resets/finalizes successfully in UTF8/16LE/16BE. Full metadata is `id / INTEGER / main / pairs / id` for both columns. Typed rows: `(1,1),(1,4),(2,2),(3,NULL),(4,1),(4,4)`.

Actual public singular HTTP Fetch: prepare raises sqlite code1 `no such column: p.a`, before any statement execution in all three encodings. Stack: `compoundArmColumns` vdbe.ts5111 → `compileDerivedProducer`5656 → `compileTableSelectProducer`6142 → public prepare. The retained-producer metadata resolver calls `expandAndResolveSelect(arm,schema)` without the outer lexical context. This valid correlated ON SELECT is being treated as an independently resolved producer. Compare pinned resolve.c linked lookup/outer-ON ownership and expr.c CodeSubselect/CodeIN with actual caller handoff, not only final InSet. Correct semantic production, parent resolution/readiness and metadata caller together; no SQL-text workaround or partial execution. If a represented lowering is unavailable it must honestly reject temporary unsupported rather than false SQLite missing-column error. Practical requested LEFT readiness cannot be declared closed by testing only empty RHS on LHS `p.a`.

Evidence: `work:///cards/card-m-f-d/processes/proc-36ea060f0e07/stdout.log` (all-encoding failure), `proc-bb262fee0c39` identifies SQL, and `proc-6375373b2a97` completes every allocated extended case while retaining failing exit1. Exact owner/source trace inspection `proc-11537fcd36dd`, `proc-599e989c18bc`.

## Independent native-first matrix

Review-only scripts/input/captures live beneath `$SAIVAGE_CARD_WORK_ROOT/packed-review`, not product runtime. Extended19 SQL ×3 encodings ×2 reset runs independently captured **before** public execution using explicit `.saivage/work/cards/card-m-f-k/oracle-build/build/libsqlite3-oracle.so`; sourceid asserted from manifest/spec, never host Python SQLite. Library SHA256 `d826fb901fbc38951f86ea5827778efd06f527e13c8f7a8c7216cc8411553e26`. Fixture Chinook SHA256 `7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`.

Queries include exact delivered five joined cases, actual right-side NULL-extended scalar and vector LHS, INNER-correlated RHS, declared/explicit collation, aggregate SUM/count/group filters and correlated joined/vector filters, LEFT aggregate filters and HAVING membership. Full five-field metadata and typed INTEGER/REAL/TEXT/BLOB/NULL row comparison. Initial13 SQL matrix passed3/3 (proc-241b69de9708). Expanded19: **18 SQL pass all encodings, R1 fails all encodings**; continued collector exit1 ensures later aggregate joined cases are not silently waived. Capture JSON SHA256 `dfff20e1a3eab604fb45c67b3bcd5f630ed54178537097db7315165ec2f7ec72`; query JSON `fe4272b277d62ff4e171972bf5c7b5e5bb9b69e9ac1a1bd17b8b9e1884957d37`. These extended successful native captures do not exercise native prepare/runtime error matrices.

Committed packed9-query capture recaptured byte-identical (`111cfbc80f6ae3041d32f413ef954ba1944ce0d081ad093aa58325d774d78904`). Fresh relevant suites **715/715**, zero failed/cancelled/skipped, with verified CHINOOK_DB: routes/foundation/Chinook/composition, row-vector*, private-blobkey*, private-key-vm*, record*. Public tests cover full metadata/types/reset, pre-control primary identity, in-flight20KB packed cancellation, deferred close/recovery; owner tests cover saved position/SKIPNEXT/FAULT and conversion admission147/148. Typecheck/package/diff hygiene passed. Commands/result `work:///cards/card-m-f-d/processes/proc-3bbcc9b59f86/stdout.log` (tail read at68000). This fresh715 does not override R1.

## Source/control and allocation assessment

Read current guide/map/mutable audit/research and actual commit/source; compared pinned expr.c FindInIndex/CodeSubselect/CodeIN, select.c SRT_Set, vdbe.c MakeRecord and linked resolution control. Actual InSet requires private packed KeyInfo cursor and throws invariant error if absent; no surviving borrowed-array membership fallback. MakeRecord→awaited packed IdxInsert consumes/deletes/refunds Set record in finally; auxiliary DISTINCT/set cursors intentionally have separate consumers. RHS is packed; LHS owned copies admitted before awaited work. Empty RHS before NULL LHS, exact non-NULL seek then scalar first-record NULL discriminator versus vector definite-mismatch traversal match relevant CodeIN branches. Bounded RawRecordReader decode is inside payload callback, Mem released before cursor movement, all scratch finally refunded. Source/test shapes and715 cover this ownership, not just names.

Shared MakeRecord applies live affinity/encoding before serial sizing, retains conservative conversion allowance `64+4*source bytes+numeric128`, charges immutable old/new packed output overlap until publication and refunds scratch on every exit. These are explicit real TS allocation tradeoffs, not native allocator parity/browser inevitability. Work and private limits remain observable; selected owner error/cancel tests do not prove every public insertion/mutation cancellation schedule. FindInIndex's persistent/rowid/NOOP optimizations are not certified by packed ephemeral seek success; no all-storage/work parity claim. No new AST/host-row evaluator, recursive public statement or native/WASM dependency was introduced by reviewed source commit.

## Remaining verification/contract gaps

Extended native typed prepare/runtime errors (arity, missing name/collation, invalid LIMIT and first-error ordering under conversion/insertion failure) are not covered by successful nine-query capture or new19. Do not silently waive them for requested closure. Current guide explicitly retains full error/resource schedule gaps; mutable audit top still says integration/control gaps remain whereas statusv129 claims scoped integration closure. This requires concise owning-doc reconciliation after R1/required error evidence, not appending another competing current claim. API/accounting remain broader peer-edited surfaces, not blanket approved.

Claimed owner public123 was not independently established here: existing `joined-in-red/public.mjs` first failed ENOENT because it keys queries from current card root; copied script with explicit owner query path then printed **15** probes (five SQL ×3), not123 and does not assert native equality. Those five are independently fully compared in review matrix. Earlier123 log remains owner provenance, not renewed independent acceptance. No all-corpus prerequisite imposed.

## Integration preservation

All three exact commits pass show-check. Actual source/test HEAD-to-work inspection shows delivery files unchanged; extensive peer staged/deleted docs/tests remain (including guide/API/audit/STAT/bitwise work). No staging/reset/commit/discard performed. Index before/after fresh suite SHA256 equal `201ecdf2dfe86e72e90609ab6f170eae0874b58279f7b6f09ed96f429edb9941`; no clean-tree assertion. Scoped commit inspection confirms13 source/evidence paths plus separately2 guide/map paths, not peer3171 approval.

Disposition: **failing_test**, practical joined membership closure blocked by R1 and required error coverage outstanding. Packed-only migration has substantial fresh bounded passing evidence; it is not retracted nor inflated to full requested closure.

## R1 repair — SrcItem production ownership

Repair node, HEAD ef62b9c5. The initial metadata-handoff hypothesis was incomplete:
`parse.ts:sourceList` recursively searched this SrcItem for any SELECT except an
earlier stl_prefix. This included ON's expression SELECT and attached it as a
synthetic derived SrcItem, replacing physical `r`. The subsequent independent
metadata resolver correctly rejected the *wrongly manufactured* derived producer.
Pinned `parse.y` lines 762–778 give physical nm/dbnm sources no pSelect and install
pSelect only from the immediate `LP select RP` child. Replacing this recursive
search with `direct(node,"select ::=")` corrects semantic production before name
resolution and lowering; no new NameContext, runtime bypass, or SQL-text special
case. Existing linked join resolution, right-cursor ON readiness, unmatched LEFT
NULL row, correlated rebuild, packed KeyInfo and shared VM then execute unchanged.

Permanent parser guard covers scalar/vector IN, EXISTS, scalar equality in ON,
function-argument SELECT and retained earlier derived SrcItem ownership. Expanded
committed packed fixture is 15 SQL (original9 + LEFT scalar/vector IN, EXISTS,
scalar equality, empty RHS, INNER correlated ON) ×3 encodings, two executions,
full metadata and typed rows. Capture uses explicit verified library
`.saivage/work/cards/card-m-f-k/oracle-build/build/libsqlite3-oracle.so`, SHA256
d826fb901fbc38951f86ea5827778efd06f527e13c8f7a8c7216cc8411553e26;
ctypes source identity assertion remains pinned3.53.4. Capture command:
`python3 test/conformance/row-vector/capture-packed-membership.py "$PWD/.saivage/work/cards/card-m-f-k/oracle-build/build/libsqlite3-oracle.so" > test/conformance/row-vector/packed-membership-native.json`.
Query SHA256277baecf403a2e3503e9d6b156d9ee69b00e2b56ec59ba9b70fadb779490242d;
native SHA2560f94827b47889f917bbe8088cf873ff9a7883eade1854616125914337249d25e.

Commands/results:
- Review-only continued19-query native-first collector now exits0, every case
  admitted/matched across all encodings (`proc-363b6c9ebd1c`); not nonasserting probes.
- Permanent packed native/public/control/admission suite9/9 (`proc-0dbeee8f5904`).
- Parser production suite passed (`proc-255222a30bc5`).
- Fail-fast broad parser/routes/foundation/Chinook/composition/row-vector/private
  blobkey/key-VM/record suite788/788, no skip/todo/cancel; typecheck, package boundary,
  diff hygiene and exact prior-index comparison passed (`proc-21fe09364fe0`, totals
  at stdout offset73600). CHINOOK_DB explicitly supplied from owner fixture.
- Added ON lifecycle controls for cancellation/deadline saved-error/reset repeat,
  recovery, suspend/reset and deferred close. First test incorrectly required
  reset to throw *after repeating step*: step invokes reset first on saved error,
  clearing it before rethrow. Native/public repeat-error distinctions are not a
  reason to change product behavior. Initial9/12 failed (`proc-8203d568c495`);
  removed invalid order hypothesis, then separated reset/finalize behavior.
  Final suite12/12 (`proc-2f6b33afc765`). One intermediate text edit accidentally
  removed recovery declaration; source inspected and corrected before execution.

No API scope or accounting denominator changed: this is production-owner repair,
not broader joined closure certification. Mutable audit/guide/map now describe
this concrete resolution while leaving extended native error schedules, general
storage/work parity and other integration verification unclaimed. No new product
runtime evaluator/native dependency. Existing peer edits in parse/docs/tests are
preserved; index unchanged. No clean-tree or scoped-commit claim, and later verify
still owns acceptance. Historical715 suite preceded this repair; fresh788 includes
parser regressions and all then-current packed tests; final lifecycle12 ran after
that broad run, not an invented791-run total.

## Verify after R1 repair — bounded green, accounting failure

Fresh verify HEAD ef62b9c5, unchanged repair index (exact comparison passed).
No product edits in this node. Pinned `parse.y:seltablist` immediate SELECT
production and repaired parser inspected again; guard excludes ON/function
arguments and keeps previous derived owner. Full metadata/typed rows/two runs
are asserted by permanent public Fetch tests, not merely prepare admission.

- `proc-9492ec89c4c5`: explicit verified pinned library manifest46/19/15,
  subquery recapture byte-identical, current aggregate-window manifest and public
  runner pass. Current aggregate denominator is **44 declared,43 executable,
  25 source-credit,1 source-only** (supersedes historical34 acceptance inventory;
  do not call it34/34). Then required `python3 test/conformance/accounting.test.py`
  fails1/3: KeyError summary, so fail-fast stops before broad suite.
- `proc-26d2419a50c1`: independent direct reproduction `node test/conformance/run-ts.mjs`
  exits1 at capi3c.test:capi3c-1.1: expected sqlite at prepare. Current peer-edited
  stage2-ts case asks `SELECT name FROM sqlite_master`, prepares successfully,
  but its stale expected disposition is unimplemented-temporary. Runner aborts
  before final summary; accounting test further still expects an entirely
  unimplemented lane. This is a real accounting/contract coherence failure,
  not a product SQL failure or R1 regression. Reconcile current case expectations,
  public error translation and accounting denominator together with owning peer;
  do not weaken summary check or reinstate rejection of admitted SQL.
- `proc-5d773770f4ae`: separately rerun full affected parser/routes/foundation/
  explicit Chinook/composition/row-vector/private blobkey/key VM/record suite
  **791/791**, no skip/todo/cancel; typecheck/package/diff hygiene pass. Includes
  final ON lifecycle controls (unlike repair788). Totals confirmed from complete
  tail, not inferred from process success.
- `proc-7725cedf8dbf`: first-select public lane8/8.
- `proc-7856180416ee`: final pinned packed recapture byte-identical, library and
  fixture capture hashes unchanged, independent repeat public/control/lifecycle
  **12/12**. Fifteen SQL×3 encodings×2 runs, not12 SQL.
- `proc-5f14e4dbe6f8`: index identical to repair final; HEAD show-check passed;
  extensive peer edits still present, no clean-tree claim or commit made.

Repair bounded behavior is stable and covered. Required accounting check is
NONPASS; extended native error schedule matrices and storage/work parity remain
unverified as already documented. No whole-goal approval and no silent reuse of
historical1539/1543 or owner123 as current acceptance. Mutable guide/map/audit's
R1 resolution remains accurate; no API scope change authorized or needed.

## V1 repair — historical baseline versus current diagnostic accounting

The runner already had a diagnostic-no-credit current lane, but hardcoded four
obsolete errors for valid sqlite_master SELECTs. Removed independent hardcoded
expectation ownership: current `diagnosticExpected` in stage2-ts cases owns
completed/error sequences; `expected` explicitly remains revision-bound historical
Stage2 baseline for native provenance/legacy accounting validators. No SQL/runtime
change. Two missing-name cases still require exact sqlite1/extended1/message;
closed-connection case requires exact misuse with null codes. Valid tail SQL
prepares/finalizes, no new row assertion or compatibility credit inferred.
Current lane47 allocated =38 upstream-classified +9 companion,44 completed +3
expected observed errors;47 diagnostic matches, **zero compatibility credit**.

Runner now collects mismatches, exits nonzero and emits full final denominator;
negative injected expectation test ensures failure is not silently credited or
missing summary. Per-case cleanup retains closed-connection sequencing. Initial
cleanup attempt called closeDeferred on already closed handles and failed both
accounting tests; narrowed only known closed misuse cleanup branch, not general
error suppression. Initial removing just capi3c1.1 exposed1.4; source inspection
identified all four valid schema SELECT sequences, corrected shared expectation
owner rather than SQL-specific product rejection. Legacy expectation provenance
retained, not repurposed as current support authority.

V1 commands/results: partial single-expectation attempt failed capi3c1.4
(`proc-5d46c0e0a5bb`), shared four-valid-schema correction produced47 results
(`proc-e7e7315d5ac7`). First cleanup fixture hypothesis failed accounting2/4
(`proc-c822c980750c`; subsequent command success did not erase Python failure).
Closed-handle cleanup repair then fail-fast accounting **4/4**, legacy validator,
current runner47/47 matches/zero credit, packed public/control/lifecycle12/12,
typecheck/package/diff passed (`proc-0fa697759074`). Generator check subsequently
found new field ownership absent from generator; updated semantic generator and
check now exact (`proc-2b5f25d73aef`), without regenerating/discarding peer operation
edits. Current/historical expectations coexist with explicit provenance authority,
not competing current claims; CONFORMANCE replaces stale current-unimplemented
wording and points to current diagnostics. Extended error parity and whole-goal
acceptance remain outside this fixture repair's evidence.

## Verify after V1 accounting repair

Fresh fail-fast `proc-fe0251086518`: deterministic generator check, accounting4/4
(including deliberately mismatched expectation producing nonzero/full summary),
legacy identity validator,47/47 current diagnostic matches with zero credit;
packed public/control/lifecycle12/12, explicit pinned subquery46/19/15 manifest,
current aggregate-window43/43 executable plus1 source-only/25 source-credit,
typecheck/package boundary/diff and unchanged-index comparison all pass. Full
output tail inspected after terminal success. Source inspection confirms exact
error kind/code/extendedCode/message comparisons and failures not credited;
valid schema prepare/tail completion is not result-value oracle evidence.

V1's concrete failure is resolved, no new product edits. Historical baseline
and current diagnostic authority are explicitly distinct; deterministic generator
agrees with case data without discarding peer operations. Broad791 verification
is repeated separately (see status for terminal process). Current peer workspace
is not clean and no scoped commit has landed in this review; index unchanged.

Whole-goal acceptance is still **coverage_gap**, not another invented failing SQL:
extended native/public prepare/runtime error matrices for joined packed membership
(arity, names/collations, ordinary LIMIT errors and first-error ordering across
conversion/insertion cleanup) remain absent from successful15-query captures.
All-encoding typed rows/reset and12 lifecycle/control tests do not supply those
comparisons or full storage/work parity. Existing narrower private tests are
meaningful but not all public producer schedules. Restore/seek fault probes and
packed ephemeral lookup likewise do not certify persistent/rowid/NOOP branches.
The original whole-acceptance brief cannot be approved from diagnostic47 success
or broad791 alone. Required next evidence: native-first matrices with explicit
pinned library, phase/code/extendedCode/message, saved error/reset/finalize and
subsequent recovery; bounded resource/cleanup schedules on actual public joined
producers; scope-matched docs/accounting/commit inspection after delivery. No
product scope exclusions or operator routing changes authorized here.

## Native-first joined error coverage (add-coverage)

Added `row-vector/packed-errors-queries.json`, `capture-packed-errors.py`,
`packed-errors-native.json` and `packed-errors.test.mjs`: six SQL × three encodings
=18 individually reported public Fetch comparisons. Pinned ctypes library is
explicit, source ID asserted; artifact includes library/query/fixture SHA256.
No host SQLite or EQP is evidence. Capture independently obtains prepare versus
step phase, primary/extended/message, zero rows before step error, two step/reset
runs, finalize after cleared reset, and same-connection SELECT1 recovery. Public
fixture requires corresponding saved-reset error and typed recovery. Rows/NULL
success matrix is not inflated by error cases.

`proc-423036326e8f` captures pinned evidence. `proc-5d44477f7a4d` public comparison
**6 pass/12 fail out of18**, zero skip: arity and qualified missing name match in
all encodings. Two concrete failures exposed, not artificially forced:
- Unknown RHS collation: native prepare primary1/extended257 with `no such
  collation sequence: absent_collation`; TS same primary/message but extended1.
  Pinned callback.c:sqlite3GetCollSeq sets SQLITE_ERROR_MISSING_COLLSEQ after
  sqlite3ErrorMsg (229–231); resolve.ts result throws NameResolutionError without
  retaining this distinction. Owning error production/translation needs repair.
- Scalar IN RHS ordinary LIMIT text/NULL and invalid OFFSET in joined ON: native
  prepares then step20/extended20 `datatype mismatch`, zero emitted rows, reset20,
  repeat execution likewise, finalize0 after reset. TS rejects prepare with
  temporary unsupported `this scalar subquery shape is not implemented`.
  vdbe.ts:compileJoinSubquery excludes scalar IN with hasLimit from wide owner then
  fallback rejects any IN. Source select.c computeLimitRegisters emits MustBeInt,
  zero check then OFFSET; vdbe.c MustBeInt applies numeric affinity, emits
  SQLITE_MISMATCH if P2 zero and noninteger. This is production/admission ownership
  gap, not platform necessity. Repair owning lowering/callers, not these SQL strings.

Fail-fast `proc-994c9b6c6dcd`: byte-identical explicit pinned recapture, diff hygiene,
typecheck/package pass. These do not erase focused18 failure. No runtime or scope
edits and no new claim of full error/resource closure. Tests intentionally retain
native expectations. Post-error public lifecycle/recovery assertions for12 failed
cases are not reached; once repair lands they become meaningful independent checks.
Conversion/insertion first-error ordering and bounded resource schedules still need
additional coverage; these18 cases fill a concrete prepare/runtime-error slice,
not that entire matrix. Prior legacy accounting and791 evidence unchanged, not
rerun or promoted by this node. Peer/index untouched; no scoped commit.

## Joined error repair

Corrected semantic owners, not query text: NameResolutionError now carries
extendedCode (default1); all SELECT compiler boundaries propagate it, and all
three missing-collation productions use257 per callback.c sqlite3GetCollSeq.
Joined scalar IN no longer excludes hasLimit from compileWideSubquery, which
already has shared SRT_Set producer/computeLimitRegisters/Once/correlation/private
ownership. No new evaluator or recursive public Statement. Invalid ordinary
LIMIT/OFFSET now reaches native MustBeInt runtime ordering. Positive native controls
added for LIMIT0 skipping invalid OFFSET and numeric-text LIMIT1 OFFSET1; capture
expanded15→17 SQL across encodings, metadata/typed rows/two executions retained.

First attempt used TS constructor parameter property, rejected by strip-only test
loader (`proc-84a2a8ab4bc3`); changed to explicit field assignment per project
convention, no algorithm change. Focused18/18 passed `proc-c3a33733ac67`; fuller
validation recorded below/status. General first-error conversion/insertion schedules
still unclaimed. Source branch comparison: select.c emits MustBeInt then IfNot before
OFFSET, OP_MustBeInt numeric affinity then mismatch; existing shared producer was
correct, caller admission had bypassed it. Collation semantic production previously
lost Parse.rc before compiler, now preserved without message-based dispatch.

Validation: focused error/public/lifecycle30/30 and static gates passed
`proc-61886003c1d8` (before remaining collation producers normalized). Initial broad
`proc-b6ca8c3de882`806/809 failed existing review33 LIMIT(subquery) across encodings:
wide owner did not forward linked clause callback to ordinary IN LIMIT. The same
caller admission relaxation also affected physical expression IN, so keeping only
joined constants would be incomplete. Fixed compileWideSubquery to prepare all IN
LIMIT in its owner with compileClause callback, then forward sharedLimit to child
producer. This restores linked nested LIMIT ownership without recursive Statement.
Final broad `proc-8b57ae951412` **809/809**, zero skip/cancel/todo, typecheck/package/
diff passed; terminal totals inspected `proc-533082307c2c`. The initial broad failure
is retained, not erased by later commands. `proc-d4e89240795b`: both explicit pinned
captures byte-identical, accounting4/4, generator check, exact index comparison pass.
No native artifact weakened, no product scope change; peers unchanged in index.
No clean-tree/scoped commit claim. Guide/map/audit current bounded assertions
updated with source ownership and evidence, API unchanged.

## Verify joined-error repair: numeric-affinity divergence remains

Fresh fail-fast `proc-d7b8d53316f2` recaptures both pinned artifacts byte-identically;
focused packed errors/rows/lifecycle plus review33 **102/102**, accounting4/4,
generator, subquery46/19/15, aggregate-window43/43 executable, typecheck/package/
diff/index and HEAD show-check pass. Totals/tail inspected `proc-c326d20b4795`.
Immediately preceding repair809 broad evidence applies to unchanged product/test
inputs, but cannot establish numeric-affinity branches not represented in fixtures.

Branch-by-branch comparison found OP_MustBeInt TS still implements integer regex
for text, whereas pinned vdbe.c applies NUMERIC affinity before MEM_Int check.
Fresh native-first public probe `proc-4c514f4a26e7` used explicit pinned library,
asserted source ID, identical utf8 fixture/SQL/public Fetch: joined scalar IN RHS
LIMIT text `'1.0'`, `' 1 '`, `'1e0'` native prepare0/first step100 (row); TS prepare
succeeds then sqlite20/extended20 datatype mismatch for all three. This is a real
verified defect, not absence of resource coverage. Existing positive LIMIT `'1'`
control exercises regex-compatible integer only and does not certify NUMERIC
coercion. Fix shared MustBeInt owning Mem numeric-affinity operation (int64 range,
losslessness, whitespace/exponent/fraction/non-numeric/NULL transitions), rather
than special-casing these SQL/text values. Add pinned typed-row/error controls for
LIMIT and OFFSET all encodings; preserve zero-before-OFFSET and saved cleanup.
No runtime edits this verify. Full conversion/insertion schedules still remain
gaps, but concrete numeric-affinity failure now selects repair_needed.

## MustBeInt numeric-affinity repair

Pinned vdbe.c2105 applies NUMERIC to the owning register then checks MEM_Int;
applyAffinity397 delegates text to applyNumericAffinity354 and REAL to
vdbemem.c802 IntegerAffinity (roundtrip no-op, excludes int64 endpoints).
Compared existing mem.ts489 applyAffinity and numericFromBytes443 with those
branches. Those existing shared primitives already implement the relevant state
conversion. Removed independent MustBeInt text-regex/BigInt/REAL parsing and use
shared Mem.applyAffinity followed by INTEGER flag check, datatype mismatch20 on
failure, setInt64 on success (MemSetTypeFlag). Current Op type has no P2 nonzero
MustBeInt destinations; retained P2zero abort behavior, no invented jump path.

Expanded explicit pinned artifacts: success17→31 SQL; errors6→15 SQL. Added
joined scalar IN correlated LIMIT and OFFSET decimal/exponent/whitespace text,
negative limit/offset, REAL integral and fractional, exact INTEGER text int64
endpoints versus rejected REAL endpoints, nonnumeric trailing junk/BLOB/overflow.
Native source ID asserted by both collectors; typed metadata/rows/two executions
and error-phase/code/reset/finalize/recovery expectations unchanged. No product
scope change or platform exception, no message/SQL special case or child evaluator.
Initial focused expanded117/117 `proc-2f60128d023a` passed (before eight additional
REAL/endpoint controls). Full final validation below/status.

Final `proc-e6ee6bda92a4`: explicit pinned recapture, parser/routes/foundation/
explicit CHINOOK_DB/composition/all row-vector/all value tests **894/894**, zero
skip/cancel/todo, typecheck/package/diff pass (totals inspected proc-80763a311583).
`proc-a6f92b855bfe`: both recaptures byte-identical, accounting4/4, generator,
manifest46/19/15, aggregate43/43 executable+1 source-only/25 source-credit,
unchanged index/diff pass. No earlier failed invocation in this repair. Test
inventory counts are138 singular native comparisons (31 success+15 errors across
three encodings), plus lifecycle/internal/other tests in894; not147 cases in the
initial focused suite (which was117). Private collision/admission tests run as
regressions, not full public conversion/insertion scheduling proof. API unchanged;
CTE/window scope and missing general resource matrices remain unchanged. No
staging/commit or clean-tree claim; unrelated peers retained.

## Verify numeric-affinity repair

Fresh `proc-0df165284483` verifies library SHA d826fb… and both native recaptures
byte-identically; focused packed/public/error/lifecycle/review33 **129/129**,
accounting4/4/generator, manifest46/19/15, aggregate43/43 executable+1 source-only,
typecheck/package/diff/index and HEAD show-check pass. Tail inspected
`proc-37301134ede2`. Source/Mem/test inspection `proc-5c72e6be9f0a`,
`proc-6b3e0ded8452`, `proc-d3d378c651b4` confirms shared numeric conversion,
losslessness/int64 REAL exclusion and typed metadata/reset/error recovery scope.
Immediate repair894 broad evidence is reused for unchanged source/tests; no
product/test change in this verify. Research-only accounting correction: final
31+15 SQL×3 = **138**, not147 singular comparisons. Positive93 are executed in
three per-encoding tests, not93 independently reported tests; errors45 individually
reported. Both execute individual Statements via public Fetch, never host SQLite.

Concrete MustBeInt findings closed for represented branches. No new defect found.
Still **coverage_gap**: public conversion/packing/insertion first-error schedules
at before/during/after immutable ownership publication and actual private-budget
pressure/cleanup with correlated rebuild/Once remain incompletely demonstrated.
Private injected tests/selected public controls are meaningful but do not cover
that complete public matrix. General storage/work and remaining native cursor
FindInIndex modes also unclaimed. No whole-goal acceptance or clean scoped
commit; dirty peers and unchanged index preserved. Current guide limitations
remain accurate, API/gates not changed.

## Public packed resource admission coverage

Added `row-vector/packed-public-resource.test.mjs`: 3 encodings×Once/correlated
rebuild×byte/entry admission =12 actual singular Fetch tests. Bind large payload
under immutable64KiB aggregate private-byte limit, or four distinct RHS entries
under maxEntries1. Assert exact limit diagnostic, zero rows before uncorrelated
fill/conversion-pressure failure versus at least one earlier correlated row before
later entry rebuild fails; saved-error identity from reset; same Statement rebind
small payload/one entry then two full typed executions and reset; finalize and
same connection recovery. Expected recovery rows checked independently against
explicit pinned library/source ID for both SQL shapes and all encodings
`proc-1082a4f7f93b`. No host runtime, synthetic opcode program or patched primitive.

Initial4KiB allowance was below actual empty/small private arena needs: initial
`proc-43de355a66e3`6/12 failed in expected recovery, not a runtime defect.
64KiB admits small production while rejecting large immutable/conversion peak;
`proc-12f30a6dc834`12/12 passed, then strengthened exact messages and final
`proc-d8dc83a3377e`12/12 passes, zero skip/cancel/todo. Companion packed rows/errors
plus new12 `proc-1082a4f7f93b` passes and typecheck/diff passes; totals below/status.
Tests bound observed resource admission/refund/restart, not precise internal allocation
numbers or mutation phase attribution. No guarantee added that public conversion
failure happens at a particular checkpoint. During-await cancellation/cleanup
collision and old/new peak boundary schedules remain distinct coverage gaps.
No product/document contract changes, no staged/committed/discarded peer paths.

## Verify public resource tests

Fresh fail-fast `proc-0cfdcd33e96f`: parser/routes/foundation/explicit CHINOOK_DB/
composition/all row-vector/all value **906/906**, zero fail/skip/cancel/todo,
typecheck/package/diff pass. Full output tail/source inspection
`proc-5b40cd9cb9b3`. New12 pass in actual broad suite with unchanged limits and
assertions; prior strict12 reused only as repeatability evidence. Fresh
`proc-a37f0a7df746`: byte-identical explicit pinned success/error recaptures,
accounting4/generator/manifest46/19/15/aggregate43 executable+1 source-only,
unchanged index and HEAD show-check pass. No product/test changes during verify.

Coverage accepted as public resource-pressure and restart tests. `conversion-budget`
is a scenario name, not proof of the precise failing opcode/allocation: observed
byte-limit message alone cannot locate conversion vs subsequent packing/arena
allocation. Same-owner recovery is useful but not an exact zero-reservation
measurement. Current evidence still lacks actual public during-await control /
cleanup-error collision and fine-grained before/during/after publication / old-new
peak schedule proof. This verification remains **coverage_gap** for whole brief,
not a runtime failure. No contract or scope edits; retained existing provenance,
unsupported gates and dirty peers. Index unchanged does not establish clean
scoped delivery.

## Public in-flight rebuild coverage exposes large packed insertion gap

Added6 actual Fetch schedules in packed-public-resource.test.mjs (3 encodings×
Once fill/correlated rebuild). Non-aborted signal, start step then timer abort;
correlated case first produces one public row with a large200KB bound RHS value,
then interrupts next rebuild. Requires saved reset identity and same-owner small
rebind recovery. No primitive interception or synthetic VM. Final18-test run
`proc-fecbffec0709`: **15 passed,3 failed**. Once in-flight cancellation3 pass;
correlated3 fail on the *initial uncontrolled step*, before timer scheduling:
`Error: large private input requires synchronous snapshot checkpoint`,
private-blobkey-pages.ts1526. This is a real public execution failure, not an
expectation calibration or cancellation timing flake. Read complete failed tail
at `work:///cards/card-m-f-d/processes/proc-fecbffec0709/stdout.log` byte2150;
UTF8 has identical error to both UTF16 cases.

Owning path comparison (`proc-7685d152dbd3`, `proc-e93fa380fdc4`,
`proc-e856624da071`): pinned vdbe.c OP_IdxInsert consumes packed MakeRecord via
sqlite3BtreeInsert; TS IdxInsert passes #privateControl to PrivateKeyVmCursor.insert
and #writeIndex. #writeIndex requires synchronous snapshotCheckpoint for packed
payload>4096 before snapshotting caller bytes. #privateControl currently supplies
only asynchronous checkpoint, so ordinary large admitted public record throws
raw invariant Error. The invariant protects borrowed-byte immutability; removing
it would be wrong. Repair must supply the owning synchronous bounded snapshot
work/control callback and preserve charge-before-copy, cancellation/work order,
then retain awaited insert and consumeRecord cleanup/refund. This add-coverage
node makes no product repair. No platform reason excludes large200KB values
under default byte/result/key limits. Exact surrounding numeric/private scope
unchanged. Other publication peak/collision schedules still unproven.

## Large packed snapshot control repair

Read accepted status92/current guide/map/audit and pinned OP_IdxInsert
(vdbe.c5741), owning public IdxInsert→PrivateKeyVmCursor→#writeIndex. Native
consumes immutable Mem record without JS await; TS must snapshot borrowed bytes
before async insertion, and reserve scratch before copying. The existing >4096
snapshot invariant correctly prevented unsafe copies, but public #privateControl
failed to implement its synchronous callback. Added snapshotCheckpoint to that
shared owner: validate nonnegative safe work count, check cancellation/deadline/
maxWorkUnits before every charged unit and after, increment the same execution
work, no await. Existing asynchronous checkpoint unchanged; snapshots are bounded
by chunked producer calls and accepted private/key limits, then insertion yields
normally. Tradeoff: copy cannot cooperatively yield until immutable bytes exist,
not a native allocation/latency equivalence or substituted Btree algorithm.
No weakening of invariant/limit, no SQL example bypass; all private callers gain
correct shared callback. MakeRecord/IdxInsert publication/refund ordering unchanged.

Focused `proc-c788f50eef73` **18/18**, formerly failing initial correlated large
row in all encodings now reaches actual timer interruption then saved-reset/rebind
recovery. Fail-fast `proc-6bb16c8c337c` parser/routes/foundation/explicit Chinook/
composition/all row-vector/all values **912/912**, zero fail/skip/cancel/todo,
typecheck/package/diff pass; tail inspected `proc-0f94f5ed91ed`. Guide/map updated
current adaptation/caller contract, public API unchanged. Prior failing15/18
retained above; no failed repair invocation. No whole-goal/peak-schedule or
clean scoped commit claim. Dirty peers preserved, no staging/discard.

## Verify synchronous snapshot caller repair

Fresh fail-fast `proc-7c1225209fb8`: packed public resource/error/metadata suites
**75/75**, byte-identical explicit pinned recaptures, accounting4/generator,
manifest46/19/15, aggregate43 executable+1 source-only/25 credit, typecheck/package/
diff/index/HEAD checks pass. Partial stdout totals inspected `proc-bcdba478eb45`.
Immediate repair912 broad evidence reused only for unchanged product/test inputs;
no edits except this research/status during verify. Owning comparison
`proc-2be42f8549ab`/`proc-bcdba478eb45` confirms charge-before-copy, no await during
borrowed snapshot, ordinary async insertion afterwards and error cleanup order;
pinned OP_IdxInsert does not have JS borrowed-byte lifetime concerns. Current
representation rationale states real tradeoff instead of platform necessity for
an alternate Btree algorithm. Concrete >4096 invariant defect closed for tested
paths. All-encoding large correlated first row and subsequent timer interrupt /
saved reset/rebind pass twice (repair18 and fresh75 containing18).

Still coverage_gap, not whole-goal approval: actual public timeout/insertion vs
cleanup collision and exact publication/immutable old-new peak phase schedules
not covered by these timer-abort tests; refund inferred from successful re-admission
rather than measured zero. No new defect, no weakening requirements. Dirty
workspace and unchanged index/HEAD are not clean scoped delivery.

## Public deadline / actual close collision / measured refund coverage

Added6 all-encoding Once/rebuild tests to packed-public-resource.test.mjs. SQL
and execution remain public Fetch/prepare/step. Test-only read-only reserve
observer captures actual budget objects and high-water; close decorator calls
real PrivateKeyVmCursor.close BEFORE raising secondary diagnostic. After actual
20KB packed first row, deterministic timeout0 on resume must outrank that
secondary, release every observed budget to zero, retain reset identity and avoid
double-close. Remove diagnostic decorator and rebind/reexecute same statement;
successful halt also has measured zero. Prototypes restored in finally; serial
file-local tests, no product instrumentation or mocked SQL/insertion.

Initial proc-f1cf8fb80673 21/24: timeout1 expired during uncorrelated arena open,
not after cursor publication, so close-collision assertion wasn't reached. Revised
schedule to first-row suspension then timeout0 (explicitly NOT during-await
expiry). proc-0ab0b733a24b22/24:200KB uncorrelated UTF16 fill exceeded default work
limit before first row. Kept existing200KB in-flight tests; new cleanup-only
schedule uses20KB, enough for real packed overflow but fits default work budget.
Final proc-779a7d7ae0a9 **24/24**, zero skip/cancel/todo; proc-b66c74cfe52b typecheck/
diff pass. No runtime defect inferred from scheduling/fixture calibration.

Read current guide/map/audit and pinned OP_IdxInsert plus private budget/cursor
close owners (proc-771e1f7f3f49/proc-3e9b6afa53d8). Test proves resumed deadline
versus actual cleanup collision and measured terminal refund, not the missing
actual during-await deadline versus insertion/publication peak schedule. This is
bounded added coverage, not whole-goal acceptance or native allocator parity.

## Verify public cleanup/refund coverage

Fresh fail-fast proc-ab7312ab8366: all affected parser/routes/foundation/explicit
CHINOOK_DB/composition/row-vector/value **918/918**, zero fail/skip/cancel/todo,
typecheck/package/diff pass. Partial output tail read proc-e75857c66056.
proc-1fc896946f6a accounting4/generator/explicit pinned manifest46/19/15,
aggregate43 executable+1 source-only/25 credit, exact prior index and HEAD check
pass. Unchanged native row/error artifacts and product since previous verify
proc-7c1225209fb8 allow reuse of its byte-identical pinned captures for those
queries only. No new oracle claim for platform deadline/cleanup diagnostics.

Review proc-e7a76a4809af/proc-e75857c66056: fault decorator performs real close
before diagnostic; #halt catches diagnostics per owner, clears owners, retains
primary control error, refunds real budget. New tests are serial, decorators
restored finally and absent from product. Nonzero admitted budget then measured
zero is stronger than mere rebind recovery. First-row publication followed by
explicit timeout0 is stable, not a during-await timer-expiry claim. Six tests
passed in focused24 and broad918; calibration failures retained, not runtime
repairs. No product/source/API or current-contract edits required.

Meaningful remaining gap: during-await public deadline versus insertion failure
and precise immutable old/new peak/publication boundary observations. Test-only
post-close diagnostic does not emulate close failing before refund. Other native
storage/cursor-mode parity remains unproved. Whole-goal approval still withheld;
workspace dirty, index/HEAD unchanged does not constitute clean scoped commit.

## Live public deadline across task awaits coverage

Added6 actual public Fetch tests (all encodings×Once/correlated rebuild), using
20KB bound packed inputs and positive timeout20ms. Observer delegates original
ExecutionTaskScheduler.yield without delay/error/task selection, counts actual
awaited production turns; budget observer delegates original reserve. Unlike
prior timeout0, execution crosses real task awaits before live deadline error.
Correlated schedule first establishes actual row then times next rebuild. All
observed budgets zero on failure, saved reset identity, same-owner small rebind
full rerun and final zero. Observers restored finally, serial file-local tests;
no opcode interception, private insertion replacement, host evaluator or product
hook. This is execution-level task expiry, not precise failing-opcode/phase
identification and not a simultaneous resource-failure race.

Read guide/map/current audit, pinned OP_IdxInsert, actual snapshot/writeIndex and
scheduler owners (`proc-613e7de7972b`, `proc-b6c33c7adbc1`). No runtime changes.
`proc-f6506bb42dd5` full focused **30/30**, zero fail/skip/cancel/todo; partial
output final tail consumed in `proc-4be48e9cf490`, which independently repeats new
**6/6** and typecheck/diff pass. No calibration failure this addition. Timer
assertions require nonzero production awaits and admitted state, not exact turn
counts or elapsed upper bound; these are bounded Node schedules, not browser
fairness/general deadline timing parity. Broader final suite remains verify's
work. Precise immutable publication/old-new peak and concurrent resource/error
ordering coverage remain separate gaps, not inferred from this passing timeout.

## Verify live public deadline coverage

Fresh fail-fast proc-99d5ea50223b parser/routes/foundation/explicit CHINOOK_DB/
composition/all row-vector/all value **924/924**, zero failure/skip/cancel/todo;
typecheck/package/diff pass. Partial stdout inspected at final counts and six
live-deadline reports via proc-1dc0f8780f0c. proc-c4c9555be0cf accounting4/generator,
explicit pinned manifest46/19/15, aggregate43 executable+1 source-only/25 credit,
exact prior index/HEAD check pass. Previous proc-7c1225209fb8 byte-identical pinned
membership/error recaptures reused only for unchanged SQL/artifacts/runtime;
new platform deadline tests make no native wall-clock comparison claim.

Read current guide/map/audit, test observers, real scheduler/#privateControl/
#halt and pinned OP_IdxInsert (proc-b24731356c76). Delegating scheduler observer
counts production yield calls; calls are awaited by the actual private control
loop. Positive20ms deadline and admitted private state, followed by error and
measured zero/reset/rebind, meaningfully exercise live control. No artificial
delay/insertion failure or product seam. Counts alone do not locate the expiry
instruction or prove it occurred inside await rather than at subsequent check.
Focused30, independent6 and broad924 pass unchanged new six schedules; no exact
turn count/elapsed upper bound asserted. This supports bounded Node stability,
not arbitrary load/browser fairness guarantees. Existing resumed-timeout close
collision and200KB timer-abort cases retained, not replaced.

Remaining meaningful coverage: paired resource/control first-error ordering and
precise immutable old/new peak admission/publication boundaries; cleanup fault
before actual refund differs from injected post-close diagnostic. Native wider
storage/work/cursor-mode parity remains unproved. Whole-goal approval withheld;
workspace dirty (3397 status entries), index/HEAD unchanged is not scoped clean
delivery. No product/contract changes or new verified failure this node.

## Paired public control / entry admission ordering coverage

Added6 encoding×Once/rebuild public Fetch tests to packed-public-resource.
Same prepared owner/20KB packed RHS/maxPrivateEntries1: pre-existing abort wins
before production scheduler awaits; reset retains it. With live non-aborted
signal, real entry admission fails after task awaits (correlated after first
row; Once before any row). Abort only AFTER that failure, then reset must retain
original entry-limit error. All observed actual budgets0; same-owner one-entry/
small payload full recovery and final0. Observer delegates actual scheduler and
reserve; no SQL/insertion/control fault injection or synthesized VM. This pairs
both deterministic boundary orders, NOT a simultaneous timeout/resource race.

Read current guide/map/audit/pinned OP_IdxInsert and owning scratch/save/moveto/
insert/error-finally (`proc-ce014acec8f7`, `proc-af88a8ceeb0e`). No new technical
choice/runtime edit. proc-6379f25ee544 new6/6 pass, proc-e8796fcdf4a1 full36/36,
typecheck/diff pass; complete totals tail read below. No failed check this node.
Meaning: admission/control first-error at real entry/terminal boundaries plus
shared cleanup/reset consistency. Exact immutable old/new peak/publication and
pre-refund cleanup failures remain distinct; no whole-goal approval claimed.

## Verify paired control/admission boundaries

Fresh fail-fast proc-4402bd73a884 affected parser/routes/foundation/explicit
CHINOOK_DB/composition/all row-vector/all value **930/930**, zero fail/skip/cancel/
todo; typecheck/package/diff pass. Partial output totals/new six reports read
proc-28584975a6b9. proc-07dbd2e4ee01 accounting4/generator/explicit pinned manifest
46/19/15/aggregate43 executable+1 source-only/25 credit/index/HEAD pass. Prior
proc-7c1225209fb8 byte-identical pinned recaptures reused only for unchanged SQL/
runtime/native artifacts, not platform diagnostic oracle comparisons.

Owning path/current guide/map/audit/pinned OP_IdxInsert re-read
proc-2bcf470a33fb. New six test both deterministic boundary orders, observer
restoration and real admission/refund. Pending entry abort genuinely precedes
execution; later abort occurs AFTER admission exception, so it tests saved rc,
not concurrent failures. Correlated first-row distinction and production task
participation retained. New6/focused36/broad930 passes establish scoped repeatability
without timing-race assertions. No product edit/new verified defect.

Accept bounded coverage, still coverage_gap: exact immutable old/new peak and
publication boundary admission/rollback coverage remain missing; during-flight
paired control/resource readiness not exercised by pre-entry/post-error pairing.
Pre-refund cleanup fault is not covered by post-close diagnostic. No additional
scope requirement introduced, no whole-goal approval. Dirty peers preserved;
unchanged HEAD/index does not constitute clean scoped delivery.

## Exact public aggregate reservation peak boundary

Added6 public Fetch encoding×Once/rebuild tests. Delegating reserve AND replace
observers measure complete successful aggregate budget peak, not just final
state. Replay same SQL/bindings/encoding with maxPrivateBytes exactly peak must
produce identical baseline rows and identical measured peak; peak-minus1 must
fail REAL aggregate byte admission with exact limit diagnostic and reset identity.
All observed budgets0; smaller same-owner rebind/one-entry recovery fits failed
limit. Observer never injects allocations/failures or alters insertion/scheduler.
Actual public limit setting, not a synthetic private budget. No product edits.

Read current guide/map/audit/pinned OP_IdxInsert, #writeIndex reserve-before-copy
and VDBE MakeRecord/IdxInsert consumers (`proc-de18f626d39c`, `proc-8ab27aa2a716`).
New proc-89f6654e8cfc6/6; full proc-63ef137a4001 **42/42**, zero fail/skip/cancel/todo,
typecheck/diff pass; partial final counts read proc-ac5b9fc73ad7. No failed checks.
This meaningfully covers exact TOTAL peak admission/terminal refund with actual
SQL all encodings and both fill paths. It does not identify which old/new
ownership publication caused maximum, compare rows to fresh oracle, or cover
pre-refund cleanup fault/live concurrent control; those remain separate evidence
boundaries. Final acceptance remains verify.

## Verify aggregate peak boundary coverage

Fresh fail-fast proc-967131912a54 affected parser/routes/foundation/explicit
CHINOOK_DB/composition/all row-vector/all value **936/936**, zero fail/skip/cancel/
todo; typecheck/package/diff pass. Partial final counts/six peak reports read
proc-9ee073f19936. proc-8b1df34e04e8 accounting4/generator/explicit pinned manifest
46/19/15/aggregate43 executable+1 source-only/25 credit/exact prior index/HEAD pass.
Prior byte-identical captures proc-7c1225209fb8 reused only for unchanged native
SQL/artifacts/runtime, not the new parameterized budget baseline self-comparison.

Current owner/test/guide/map/audit/pinned OP_IdxInsert read proc-d50c99d0da6a.
Reserve and replace observers delegate successful production calls; observing
both avoids missing replacement peak. All captured budget instances end zero,
limit=peak succeeds and reproduces peak/rows, limit=peak-1 genuinely fails
admission; reset identity/recovery retained. New6/focused42/broad936 repetition
supports deterministic total-budget boundary for these encodings/paths. No
runtime edit or verified defect. Tests compare limit behavior against same
program baseline, not independent native SQL correctness.

Still absent exact owner-phase evidence of simultaneous immutable old/new
publication/rollback, and during-flight paired resource/control readiness;
post-close diagnostic is not a pre-refund fault. Aggregate-peak tests reduce but
do not eliminate those previously identified gaps. Whole-goal done withheld;
3397 dirty entries and unchanged HEAD/index are not clean scoped delivery.

## REPLACE unpublished snapshot/control admission boundary

Added2 owning-primitive tests to private-blobkey-admission. Actual arena budget
held to leave67/68 bytes; packed physical input4 requires68 scratch BEFORE
snapshot control per replaceCell. At67 admission wins without control probe;
at68 pending synchronous control wins before first await. Both failures retain
old cell1 and refund scratch. After held budget release same arena retries:
caller mutation at post-copy synchronous checkpoint and awaited checkpoints
cannot change published owned cell2. Scratch returns to pre-operation baseline,
last close0. These use actual budget reservation, explicit primitive control
fixture (not public signal), no runtime hook/product change.

Guide/map/audit/pinned OP_IdxInsert and owning MakeRecord/replaceCell read
proc-4a407c9b8f07/proc-89c22fa01e67/proc-c1dfc908acf2. Initial proc-bfca2793fada0/2
was TEST inspection lease admission with held budget (not runtime defect):
release fixture hold BEFORE acquiring to inspect unchanged bytes; derived page
can stay charged so compare successful refund to retry baseline. proc-2c73d32141fd
then passed. Final holding flag made finally cleanup explicit; final
proc-650b1ad6bbad full51/51 and typecheck/diff pass (counts read proc-6051769abc5f).
This precisely tests pre-copy unpublished boundary, primary admission/control
ordering and caller snapshot. It is not public end-to-end, complete structural
old/new peak publication rollback, or spontaneous pre-refund close fault evidence.
Final acceptance belongs verify; no artificial product failure.

## Verify unpublished REPLACE boundary

Fresh fail-fast proc-11484ea76e9b affected parser/routes/foundation/explicit
CHINOOK_DB/composition/all row-vector/all value **938/938**, zero fail/skip/cancel/
todo; typecheck/package/diff pass. Partial totals/new primitive reports read
proc-0ad0f4d4cff7. proc-5dbfaf185b73 accounting4/generator/explicit pinned manifest
46/19/15/aggregate43 executable+1 source-only/25 credit/exact index/HEAD pass.
Unchanged SQL/runtime artifacts support prior proc-7c1225209fb8 byte-identical
native capture reuse; primitive injected cancellation is not native oracle evidence.

Re-read actual replaceCell publication/catch/finally and current test/guide/map/
audit/pinned OP_IdxInsert proc-1595581adb8d/proc-700c996f734e. Real reserve precedes
snapshot checkpoint/copy; neither pending failure publishes. Retry exercises
copy before both mutation opportunities and actual eventual replacement; finally
refund/gate recovery asserted. Corrected lease-inspection fixture failure is
retained above, not inferred runtime defect. Full51+fresh938 support stability
for deterministic primitive boundary. No relevant runtime change/new failure.

Accept these2 for physical REPLACE pre-copy admission/control/snapshot boundary,
not public IdxInsert rebuild entire publication or structural old/new capacity.
During-flight paired public control/resource readiness and cleanup-before-refund
still lack meaningful schedules; clean scoped delivery absent. Whole-goal done
remains withheld, not an authorization change or rejection of accepted bounded
adaptations. Current guide/map/API need no new assertion for test-only evidence.

## Inner cleanup diagnostic before final owner refund

Added6 public encoding×Once/rebuild tests in packed-public-resource. Arm fault
only AFTER actual20KB packed first row; resume timeout0 must stay primary.
Decorator delegates actual PrivatePageLease.release then throws while cursor/
arena owner still has measured nonzero charges. Owning close must continue
remaining lease/cursor/arena refunds to measured0, reset original identity,
small rebind full rerun0. Observers restored finally, no execution/control/
insertion alteration. Unlike prior owner-close decorator, fault now occurs
INSIDE owner cleanup before owner final refund. It is nevertheless after REAL
individual lease revocation/refund, not a failing release that leaves a lease
outstanding, and not spontaneous native allocation failure.

Read current guide/map/audit/pinned OP_IdxInsert plus cursor close's per-lease
try/catch and arena final disposal (`proc-3c9b95401d2c`, `proc-ea2fa89f9cdd`,
`proc-514c26aa8121`). No new technical choice/runtime edit. New6/6
proc-126adc469273; full48/48 proc-6a181bc29b78/typecheck/diff pass, partial counts
read proc-c21d49d51460. No failed check or calibration this node. This fills
meaningful pre-owner-refund diagnostic ordering/continuation coverage without
claiming safe disposal if actual lease release itself never revokes ownership.
No broad acceptance or independent native timeout comparison; verify owns final.

## Verify inner cleanup continuation coverage

Fresh fail-fast proc-086966ca2a09 affected parser/routes/foundation/explicit
CHINOOK_DB/composition/all row-vector/all value **944/944**, zero fail/skip/cancel/
todo; typecheck/package/diff pass. Partial totals/six inner cleanup reports read
proc-a3567ef8778f. proc-d1d16bbf1828 accounting4/generator/explicit pinned manifest
46/19/15/aggregate43 executable+1 source-only/25 credit/exact index/HEAD pass.
Prior proc-7c1225209fb8 pinned byte-identical SQL captures apply only to unchanged
SQL/native artifacts/runtime, not injected diagnostics or deadline oracle parity.

Re-read test/owner/guide/map/audit/pinned OP_IdxInsert proc-5bc19d6f9d99:
PrivateBlobkeyCursor.close catches each inner release diagnostic and continues
scratch/arena refund; VDBE preserves primary and clears owners. New decorator
runs real lease release then throws BEFORE remaining owner refunds, with
measured live charges. Six-focused/full48/fresh944 validate primary identity,
remaining cleanup/reset/rebind/refund for both fills/all encodings. No failures
this addition/verify; historical fixture failures remain recorded. No product
edit, exceptional algorithm change, or independent native diagnostic comparison.

Accept meaningful pre-final-owner-refund cleanup continuation coverage. It is
not failed lease revocation leaving a foreign lease outstanding; no artificial
failure of an otherwise required invariant is demanded as completion. Whole-goal
coverage_gap remains for full structural IdxInsert old/new publication/rollback
schedules and public live paired control/resource readiness. Dirty3398/unchanged
HEAD/index still not clean scoped delivery. API and CTE/recursive/window gates
unchanged. No expanded scope or retraction of accepted bounded adaptations.

## Public live task cancellation versus eventual entry admission

Added6 encoding×Once/rebuild Fetch scenarios. Delegating scheduler awaits REAL
production task, then delivers public AbortController only when actual budget
has live charges. Initial signal not aborted. Live control must win and refund0;
reset retains it. Disable delivery, replay SAME owner/program/bindings/entry1
limit: actual entry admission now fails and reset retains that diagnostic; small
one-entry rebind succeeds/refunds0. All observers restored finally.

This is explicit test-controlled signal delivery after an actual awaited task,
not merely pre-entry or post-error abort, not a native signal oracle. It does
not identify the failing opcode, force simultaneous ready errors, or prove
cancel occurs during a particular insertion rather than another private task.
No synthetic limit/insertion/control callbacks or runtime edit. Current guide/
map/audit/pinned OP_IdxInsert and scheduler/private control read proc-2441bfb5002b.
New6/6 proc-273e5fddc957; full54/54 proc-27c86b502485/typecheck/diff pass, totals
read proc-7b8500787525. No failed checks/calibration this addition. Addresses
live public control versus eventual real admission paired program meaningfully;
structural old/new publication/rollback remains distinct. Verify owns acceptance.

## Verify live task control / eventual admission pair

Fresh fail-fast proc-f17c6fa3bf74 explicit CHINOOK_DB affected parser/routes/
foundation/composition/all row-vector/all value **950/950** zero fail/skip/cancel/
todo, typecheck/package/diff pass. Partial totals/new6 read proc-89477e2ce292.
proc-96d4361b78c4 accounting4/generator/explicit pinned manifest46/19/15/
aggregate43 executable+1 source-only/25 credit/exact index/HEAD pass. Reuse prior
proc-7c1225209fb8 byte-identical pinned SQL captures only unchanged artifacts and
runtime; no native public signal timing evidence is asserted.

Actual scheduler/test/guide/map/audit/pinned OP_IdxInsert re-read
proc-4b548962ca3d; VDBE private-control charge/check after awaited scheduler
confirmed in final source read. Initially nonaborted signal delivered after
actual task with live measured charges, then unchanged program no-delivery
reaches real entry-limit. New6/full54/fresh950 show repeatable cancellation/
admission/reset/refund/rebind behavior. This accepts meaningful live public
control plus eventual admission pairing, not simultaneous resource/control
readiness at specific IdxInsert phase or native/browser scheduling equivalence.
No failed check/new runtime change; historical calibration failures retained.

Whole-goal gap remains structural IdxInsert immutable old/new publication/
rollback schedules and clean scoped delivery (3398 dirty/unchanged index/HEAD).
The remaining structural criterion needs owning-phase schedules: observe old
cursor contents before mutation, fault/checkpoint around new-page publication,
assert old state on unpublished exit or shared FAULT on published failure,
then no accounting/cursor leaks. Do not force artificial failed release merely
to claim coverage. Current API/guide/map/gates unchanged; no technical exception
or owner scope change from test-only additions. Scoped live coverage accepted,
whole-goal done withheld.

## Packed writer unpublished/published peer ownership boundaries

Added2 tests private-blobkey-insert: actual old6000-byte RTRIM overflow key
and positioned peer; injected pending synchronous snapshot control before copy
must preserve exact budget baseline, peer VALID and byte-identical old payload.
Retry unequal-extent equal-key replacement succeeds; mutating caller after
return cannot change short published payload observed through peer.

Structural NEW fill starts with old positioned peer; actual page-full staged
publication occurs before balance576-byte path reserve (source ordering), then
budget subclass throws specific admission diagnostic at that owning boundary.
Writer and saved peer must both FAULT with same primary; first/payload/new insert
all reject same identity without stale contents, root refs0, final disposal0.
Adds semantic state/consumer assertions beyond existing fault sweep/disposal.
Not rollback after publication: native private adaptation terminally faults.
Explicit injected primitive budget/control schedules, not public allocation
limit/native malloc parity; no product implementation change or forced failure.

Read #writeIndex/insertLocal/physical replacement and pinned vdbe.c IdxInsert /
btree.c Insert9395ff plus current guide/map/audit proc-acbfe064fb34 through
proc-0e3fba6338ce. New2/2 proc-8d5017c94cac; full insert+admission104/104,
typecheck/diff proc-f24ec45c1d5c, partial totals read proc-14206e9b88c5.
No failed check/calibration this node. Existing structural sweeps retained;
these schedules bound unpublished preservation versus published shared fault,
not exhaustive all balancing subphases. Final affected suite belongs verify.

## Verify packed writer ownership schedules

Fresh fail-fast proc-6622d0ee45fb explicit CHINOOK_DB affected parser/routes/
foundation/composition/all row-vector/all value952/952 zero fail/skip/cancel/todo;
typecheck/package/diff pass. Partial totals/new2 read proc-fb499e75cc47.
proc-b4de2d88a66f accounting4/generator/explicit pinned manifest46/19/15/aggregate
43 executable+1 source-only/25 credit/exact index/HEAD pass. Prior pinned
byte-identical SQL captures proc-7c1225209fb8 reused only unchanged SQL/artifacts/
runtime, not injected primitive diagnostics as native oracle behavior.

Re-read tests/owning writeIndex branches/pinned OP_IdxInsert and btree Insert /
current guide/map/audit proc-5b790a2418a8. Snapshot pending failure precedes
savePeers/moveto/publication and exact old peer payload/baseline remains; retry
proves new owned value. Structural576 reserve source branch explicitly follows
published overflow staging; failed reserve trips shared arena/writer/saved peer,
all tested access paths preserve original diagnostic, final refs/budget0.
New2/full104/fresh952 establish scoped deterministic ownership coverage.
No check failure/runtime change; research predicted count correction retained.

Together with existing allocation/checkpoint sweeps and physical snapshot
threshold tests these address the previously absent representative unpublished
preservation and published shared-FAULT semantic schedules. Not exhaustive all
balancing phases/native allocator parity; do not redefine acceptance to require
an infinite fault matrix. Public live pairing and inner cleanup coverage remain
accepted with stated bounds. No additional concrete absent test is diagnosed in
this round. Whole-goal approval still withheld: clean scoped integrated delivery
is absent (3399 dirty entries, unchanged index/HEAD); broader native storage/
cursor-mode fidelity questions from prior review are not resolved by green tests.
Planner must settle coherent scoped delivery/remaining fidelity evidence, rather
than manufacture tests or destructive cleanup. Current API/gates unchanged.
