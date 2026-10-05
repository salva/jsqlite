# Runtime progress — [[card:card-k-h-b]]

## Continue / updated (not independent acceptance)
Consuming runtime is implemented and current reproducers pass; final source review
and reviewed explicit-path commits remain open. No unrelated staging/commits.
The child [[card:card-k-h-a]] supplied native-FIRST evidence, not runtime credit.
This note supplements its decision package; it does not clone its research.

## Owning schedule
`compileInnerTableSelect` allocates independent exact match cursor, key register,
NULL return register and body bounds per RIGHT level (WhereRightJoin/WhereLevel,
whereInt.h45–145; WhereBegin7394ff). Ordinary scans preserve selected table/index,
rowid and IN advancement. ON succeeds before Rowid/Found/IdxInsert and BeginSubrtn;
WHERE and downstream joins follow, so filtered matches remain recorded
(wherecode.c2740ff). Reverse closures emit each level's Return, retaining LEFT
flag and synthetic-null continuation; forward drains NULL prior table/index
cursors, invalidate selected RHS index, scan physical RHS and Gosub the same body.
An earlier drain can therefore record later matches before the later drain
(where.c WhereEnd7500ff; wherecode.c RightJoinLoop2820–end). Bloom negative
acceleration is omitted; membership still uses exact Mem/KeyInfo Found and
IdxInsert, backed by the existing sorted private store and shared byte budget.
No independent evaluator or scan-restarting output cache was added.

Resolved builder validation occurs after label resolution before frozen program
publication (including shared owners). It checks owning Return chains, interior
targets, deliberate producer stops, and coroutine boundaries. Upstream
NoJumpsOutsideSubrtn (vdbeaux.c995–1068) is debug verification, not rewriting.
Remaining review must check this complete TS stop/unwind schedule against pinned
WhereEnd and VDBE Return branches, particularly shared destination exits. Passing
builder tests is not full source-fidelity approval.

Original window input retains rewrite/lifted payload/framing but now consumes the
resolved SELECT/WHERE coroutine producer. Grouped RIGHT input similarly captures
that producer into the shared aggregate destination. Parser identity flattening
retains explicit expression ELists; ordinary derived expansion substitutes the
transient EList before SrcList splice (select.c substExpr3797ff/flatten4310ff).
Expanded-star transient metadata uses source descriptor affinity/type when no
Lemon Expr reduction exists (select.c2340–2416). Mixed USING RIGHT deletes prior
FULL merged graph exactly as resolve.c449–464; FULL/LEFT retain it.
WITHOUT ROWID RIGHT/FULL match keys remain typed temporary unsupported.

## New native discriminator provenance
Nine FULL-RIGHT, RIGHT-FULL, FULL-LEFT USING cases across three encodings were
captured independently with the pinned shared library before their TS consumers.
Initial public result6/9 exposed FULL-RIGHT metadata ownership, then resolver
repair9/9. Frozen corpus SHA256
`3eff93ea3700f866dfd319ffc4148de5e227a06a88ea435cb3513b642ee0c89b`.
Capture artifact: work:///cards/card-k-h-b/merged-using-native/capture.json.
`python3 test/conformance/verify-repeated-merged-using.py` freshly validates9/9
against immutable fixture hashes, pinned source identity, all five metadata
fields and typed ordered rows twice across native reset. No native evaluator
is a runtime dependency. Existing63 supplemental and12 adapted upstream captures
are inherited evidence; zero exact unadapted upstream ports is still disclosed.
All source/corpus/fixture hashes are in `hashes.json` beside this note.

## Latest commands and evidence
* `python3 tools/test/integration.py --jobs 2`: proc-2fae08c30f92 exit0,
  **232/232 components**, three prerequisites exit0, input_drift=[], unchanged
  30s watchdog. Manifest SHA256
  `dff51b4a05945ab6e73d74563ff7a22cfbaa015d15155447b5791351498a4615` at
  work:///cards/card-k-h-b/integration-run/manifest.json. This component count is
  not a count of SQL assertions. Repeated base component2.279s; encoding-split
  upstream components16.604/16.908/17.959s. Concurrent independent connections
  and existing server teardown fixed scheduling, no SQL/assertions removed.
* Prior proc-03cf3af00fdf exit1,230/232 with six drift paths (resolver, guide,
  map and three tests); preserve its failures, not latest-tree credit. Copied
  manifest work:///cards/card-k-h-b/integration-prior-drift/manifest.json.
* `REPEATED_RIGHT_FULL_ACCEPTANCE=1 node --experimental-strip-types --test
  --test-name-pattern='native acceptance .*/(full-full|window)$|mixed USING'
  test/conformance/repeated-right-full.test.mjs`: proc-afe42b6767a5 exit0,6/6;
  the loose mixed pattern matched no additional cases. Exact
  `--test-name-pattern='mixed merged USING'` proc-95ced5dac5d4 gives9/9,
  followed by `npm run typecheck` exit0. No inflated15-case claim.
* Latest full four repeated files before this turn: proc-b8a35c0740cd111/111
  (includes three grouping tests), then fresh integration above. Earlier
  teardown-only and concurrent12 scheduling attempts remained above30s and
  were not sufficient. Split encoding wrappers preserve all12 upstream assertions.
* `npm run build` proc-33290f2e60ba exit0. Browser launch then failed missing
  playwright module; next attempt wrong1223 installation failed. Reused existing
  read-only1223 browser with explicit JSQLITE_PLAYWRIGHT and
  PLAYWRIGHT_BROWSERS_PATH. Without JSQLITE_CHINOOK all39/39 and current37/37
  pass, not historical38+2 credit. Fixture-enabled latest result is recorded
  separately in status after completion.
* `git diff --check` exit0. HEAD70d5d81/tree69a1f784, cached diff empty.
 493 original dirty hashes490 unchanged; intentional differences are vdbe.ts,
 repeated-right-full.test.mjs and run-advanced-index-ts.test.mjs. Original root
 bitwise/index/research work otherwise preserved. No remote/config/deployment.

## Remaining concrete review
Complete branch-by-branch control review of own Return/producer-stop/unwind,
register/table/index NullRow, selected index/IN/rowid positions, physicalColumnIndex
versus aggregate payload, and affected parser/lowerResult callers. Preserve
atomic unsupported boundaries where routes decline; tests are not universal
aggregate/window/correlation scope expansion. Synchronize final guide/map/API/
audit claims and review explicit-path commit content before staging. Parent
[[card:card-k-h]] independently reuses [[card:card-k-f]]; internal checks are not
final acceptance. The converging next step is this bounded review/delivery, not
new oracle research or a global evaluator replacement.

### Settled latest browser evidence
With JSQLITE_CHINOOK=examples/browser/chinook.sqlite,
JSQLITE_PLAYWRIGHT=/opt/saivage-jsqlite2/node_modules/playwright/index.mjs,
PLAYWRIGHT_BROWSERS_PATH pointing read-only to the existing card-v-b1223 install,
JSQLITE_BROWSER_LANE=all, `timeout 180s node test/browser/run.mjs`:
proc-6b71d2d2ac56 exit0 **40/40 (current38 + original gap2)** on latest built
runtime, Chromium148.0.7778.96/Playwright1.60.0. Report SHA256
4a7d6aa617224df7d35a117743e015dc9843192c7e3cac38ddfad556b53f5713 at
work:///cards/card-k-h-b/browser-e2e/report.json. Prior no-Chinook39/37 counts
are retained separately and not substituted for this lane.


### card-k-h-b continuation checkpoint (working tree, review pending)
Native-FIRST continuation corpus adds21 discriminators (seven x three encodings):
LIMIT0, unmatched-drain OFFSET, scalar/EXISTS stops, compound LIMIT, downstream
LEFT selected-index IN, and RHS selected-index unmatched drain. Public consumers
compare ordered typed duplicate rows and all five metadata fields, repeat after
reset/clearBindings, and reuse the connection. Independent pinned recapture
compares byte-identically; no expected values were revised to fit TypeScript.

The settled-target verifier now shares `reachesOwningReturn`: consecutive Return
opcodes must reach the owning register, with invalid/unsettled targets rejected.
Pinned vdbeaux.c995–1068 is debug verification, not runtime jump rewriting; TS
has no Noop/Explain opcodes. Producer-stop identities and coroutine/Gosub
boundaries remain distinct. Source reread confirms wherecode.c2740–end records
ON matches before interior/downstream WHERE, where.c WhereEnd closes reverse
and drains forward, and selected RHS indexes must be invalidated before drain.
Original window input uses physical cursor bindings across Yield; retained
register producers are not claimed covered by this input-edge change.

Fresh helper-tree evidence: focused122/122 plus typecheck; original gap6/6;
integration232/232 components, all three prerequisites exit0, input_drift=[];
build and Chromium current38+gap2=40/40. Exact commands/artifacts/hashes are in
`docs/research/card-k-h-b-runtime/{progress.md,hashes.json}`. These are internal
checks, not parent independent acceptance or complete owning-path fidelity
approval. Explicit-path/hunk commit review remains pending; inherited bitwise
changes in vdbe.ts/run-advanced-index must not be staged as this card's work.

Commands (latest snapshot):
* `python3 test/conformance/capture-repeated-continuation.py --library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" --output "$SAIVAGE_CARD_WORK_ROOT/continuation-native/reverify.json" && cmp test/conformance/cases/repeated-continuation.json "$SAIVAGE_CARD_WORK_ROOT/continuation-native/reverify.json"`: proc-cb600187dd52 exit0, native21/21/byte-identical. Initial native capture proc-9b041a7dc639 preceded public consumers.
* `node --experimental-strip-types --test test/conformance/select-program-resolved-validation.test.mjs test/conformance/select-right-continuation.test.mjs test/conformance/repeated-right-full.test.mjs`: proc-87be5a473cb7 tests122/122 (2559ms); subsequent npm run typecheck and git diff --check exit0.
* Original six-case acceptance command proc-fbf7ce60dd18 tests6/6. Preceding manifest-inspection Python failed KeyError executed (report has results, not executed); this is preserved and corrected by proc-bdf27ee403b9, not masked by final test exit0.
* `python3 tools/test/integration.py --jobs 2`: proc-5d266097d63d exit0,232/232, input_drift=[], unchanged30s watchdog and three prerequisites exit0. Manifest work:///cards/card-k-h-b/integration-run/manifest.json SHA25608dd6046e539ef12e932834516359e005c3da768642c81515bfaa8acc49d0de5. Prior manifests remain prior snapshot evidence.
* `npm run build && JSQLITE_PLAYWRIGHT=/opt/saivage-jsqlite2/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/work/jsqlite2/.saivage/work/cards/card-v-b/browser-capability/browsers JSQLITE_CHINOOK=examples/browser/chinook.sqlite JSQLITE_BROWSER_LANE=all timeout 180s node test/browser/run.mjs`: proc-792ed2dc9c73 exit0; report40 pass results, Chromium148.0.7778.96/Playwright1.60.0. Report work:///cards/card-k-h-b/browser-e2e/report.json SHA256e6ae73f540bdc3b95ee2697e597a5f17ba340fc0d10200a2a8401c7a06c7d5cd.

Latest source review is bounded evidence, not finished fidelity acceptance.
Compared right-state allocations, body/Return chain targets and forward drains
with WhereRightJoin/WhereLevel and complete wherecode2740–end; inspected
WhereEnd IN closure/LEFT null/index/coroutine branches and vdbeaux verifier.
TS NullRow clears records,rowid/deferred rowid/table and index positions before
subsequent Column/Rowid reads. Rowid RIGHT reads remain table-owned; WR uses
physicalColumnIndex and WR match keys remain typed unsupported. Ordinary
derived flattener requires one parent SrcItem, so upstream restriction3a
(LEFT RHS joined subquery) is not admitted here; upstream restriction27a
(iFrom>0 left-of-RIGHT) is outside that flattener. Child explicit EList and
star substitution/caller review still require final checking, as do shared
aggregate capture and lowerResult generated-coalesce caller identity.

No staging/commits. Preservation baseline493,490 unchanged; intentional
vdbe.ts/repeated-right-full/run-advanced-index differences only. Concrete next
useful step is finish these bounded caller/producer reviews and explicit-hunk
commit review against settled green evidence, not broaden admitted routes or
rewrite oracle values. Parent [[card:card-k-h]] reuses [[card:card-k-f]] separately.


### card-k-h-b continuation caller checkpoint — 2026-10-05 (post-v24)
Bounded caller review found an admitted ordinary-derived projection metadata
error: native-FIRST `derived-filter-admitted` returned column names k/v while
TS returned qualified j.k/j.v in all three encodings (0/3 public contracts).
`flattenOrdinaryDerived` now preserves the resolved transient column name before
producer substitution, as select.c sqlite3GenerateColumnNames/substExpr do;
explicit AS names remain authoritative. Aggregate lowerResult now distinguishes
only the generated FULL USING coalesce column leaf from parsed function calls,
instead of skipping recursion for arbitrary calls with carrier children.

Continuation corpus now has 33 native captures (11 x3), independently recaptured
byte-identically. Public checks are 30 admitted typed-row/all-five-metadata/reset
contracts plus three honest temporary-unsupported checks: ordered physical-derived
filter remains an existing declined route, not native-success TS credit. The
new un-ordered filter is admitted and passes. Do not infer universal derived ORDER
or aggregate/correlation admission. This extends, not replaces, the 21-case history.
Focused five-file run passes165/165; original FULL/FULL/window gap6/6 and typecheck
pass. Complete delivery review/explicit own-hunk commits remain pending; internal
checks are not independent parent acceptance. Exact evidence is in
`docs/research/card-k-h-b-runtime/progress.md` and hashes.json.

Latest commands and outcomes (post-v24, not reuse of old integration):
* proc-c8457319567f continuation pattern33/33; typecheck clean. Tail inspected.
* proc-8f4c1625adf3 node --experimental-strip-types --test
  select-program-resolved-validation, select-right-continuation,
  repeated-right-full, select-derived-table-compound-owner,
  select-outer-join-aggregate-input:165/165,3186ms.
* proc-814822ea8266 native recapture initially failed loading the oracle shared
  library while the concurrently started integration prerequisite rebuilt it.
  No runtime/oracle mismatch inferred; chained repro/typecheck did not run.
* proc-82dbaf8e1091 recapture with pinned libsqlite3-oracle.so to
  $SAIVAGE_CARD_WORK_ROOT/continuation-native/latest-reverify.json && cmp:
  native33/33, byte-identical. Preservation493 original dirty hashes:
  490 unchanged; intentional vdbe/repeated-right-full/run-advanced-index only.
* proc-e1840521ec83 original acceptance six-case pattern6/6;
  npm run typecheck and git diff --check clean.
* proc-593da8259bdf npm run build && explicit Playwright/Chromium/Chinook all-lane
  browser command (same command recorded above): exit0,40 pass results verified
  from browser-e2e/report.json, Chromium148.0.7778.96, Playwright1.60.0.
No staging/commits or operator input changes. Historical failed checks remain
historical failures; ordered-derived boundary is disclosed, not a waived row test.

Fresh integration proc-7e50f0f08f82 exit1:232/232 component exits0, all three prerequisites exit0, four documentation input drift paths (audit/guide/API/map) edited during run. This is NOT clean integrated acceptance. Durable manifest work:///cards/card-k-h-b/integration-post-v24-drift/manifest.json; hash in hashes.json. Next run must use settled documentation and no concurrent edits. No SQL failures observed, no failed run relabeled green.


### card-k-h-b settled delivery checkpoint — 2026-10-05
Post-v27 rerun deliberately froze project inputs throughout integration:
`python3 tools/test/integration.py --jobs 2` proc-f63b10d733c3 exit0,
232/232 components, three prerequisites exit0, input_drift=[], unchanged30s
watchdog. Manifest work:///cards/card-k-h-b/integration-run/manifest.json,
SHA256668a4d4bd49c4290619ff4de73bcdb06253cdf522917d34a6d879f21e171e67e.
Previous drift run remains exit1; this new run resolves that verification question.
Continuation corpus33 native captures (11 x3), public30 admitted success contracts
plus3 declined ordered-physical-derived checks. Those3 are not native-success TS
credit. Direct transient names survive substitution; explicit AS takes priority.
Original repeated FULL/FULL/window6/6, focused165/165 and browser40 passes remain
applicable: runtime/test inputs have not changed since those checks. No universal
aggregate/correlation/derived ORDER or WR composite-key admission is claimed.
Source/control review and exact hashes/commands are in the focused research.
Internal execution evidence is not parent independent fidelity acceptance.


## Reopened review R1/R2/R3 correction (2026-10-05)
Immutable parent review v3 read completely. No SQL runtime defect or allocator
change introduced. Commit68768c1435d09da4e9b6447edb79206205e961d4/tree
79fc0d6c5f95a0708595e13ea41fb8e7ea48fa21 owns8 explicit paths only.
R3 core guide/map/architecture now distinguishes singleton history from repeated
execution pending independent acceptance; API/conformance retain actual typed
WR/ordered-derived/declined-neighbor boundaries.

R2 reuses independently native-FIRST aggregate discriminator (no new SQL):
verify-repeated-budget-native.py --library pinned oracle independently recaptured
3/3 typed rows/all5 metadata, proc-6345f00821ca. Existing continuation recapture
33/33 cmp identical proc-4cfe96c3b66f. Native verifier initial extra rebind=[]
introduced a mismatched capture envelope; removing that extra option produced
exact equality, not revised oracle expectations. Test instrumentation initially
used wrong metadata nesting (two0/3 runs), then observed mutable snapshot bytes
(0/3), then first overlap had equal single keys (0/3). Snapshotting reservations
and selecting the actual later distinct-population overlap repaired observation,
not runtime/limits. All failures retained in process outputs.

Bounded prototype hooks identify two distinct EphemeralIndexCursor instances and
SorterCursor, associate successful reserve with exact common execution budget,
and snapshot nonempty distinct keys/byte contributions. No concurrent statements
under hooks; finally restores all prototypes. Existing Found/IdxInsert path's
one-key int64 stores identify barrier b/c match owners (no DISTINCT/IN in query).
Observed later overlap: first match keys[1],8 bytes; second[1,2],16 bytes,
combined24 plus sorter reservation on same budget. Peak225 UTF8/224 UTF16LE/BE;
peak-1 yields sticky error, exact peak succeeds. Success/reset/error budget
usedBytes0, connection SELECT1 reuse, public typed duplicate rows/all5 metadata.
Logical byte ownership, not native allocator/page parity. Hooks also zero store
live observation on close; snapshots retain historical evidence.

R1 closure.json binds delivery commit/tree,829 exact production/conformance/
corpus/fixture inputs, node executable/version and TypeScript package hashes,
manifest native identity. Inherited overlay explicitly attributed without peer
staging or authorship transfer. reproducible git archive + overlay artifact
work:///cards/card-k-h-b/reopened-dependency-overlay.tar SHA256
037315deb574a689d256118b42fc856d3ebb977ec871fe746a2ffdf383f23c41.
Exporter tools/test/card-k-h-b-export.py constructs equivalent workspace closure;
node_modules symlink supplies declared hashed TypeScript prerequisite only.
Exact-export public six-file run proc-b92396267d58 passed152/152,17696ms,
then npm run typecheck exit0. proc-a5f183b84fb5 verified all829 tested export hashes.
Earlier two precommit export runs also152/152; only latest settled export credit.
Original493 dirty inventory/current hashes and exact original-tree/current index
entries in preservation.json:490 unchanged, three intentional files, cached
binary delta original/current both empty SHA256e3b0c442...b855. Own commits change
index vs original tree; no peer staged hunks. Legacy hashes head/tree relabeled
historical, new delivery identity explicit. Peer dirty bitwise/index/research intact.

Old integration232/232 and browser40 remain unchanged-production evidence, not
new reopened runs; new assertion/doc/export-tool inputs mean no whole-export
broad acceptance claim. Native libraries/build tools are development prerequisites,
not public runtime. Independent full caller/control review remains pending.
