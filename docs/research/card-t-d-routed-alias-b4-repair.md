# [[card:card-t-d]] routed alias / B4 repair

Base HEAD d9d6759c44aa5366ea5f32d0b64f4d13badb11a5; shared dirty work preserved,
including root bitwise evaluator clauses and harness/compound changes. No staging,
reset, commits, product-scope/API change, watchdog increase or assertion removal.

## Diagnosis and repair

See TRANSLATION routed section for owning source/consumer map. Before edits,
sourceid-checked independent native captures gave alias INTEGER2/1 and B4
INTEGER1984/DONE101; reused unchanged captures at
work:///cards/card-t-d/routed-alias-b4-red/native.json. Source pin is3.53.4,
2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc.

Alias binding itself was not the defect: WHERE syntactic subtree masks excluded
resolved result-expression sources. Corrected columnUse and prereq at semantic
owner, preserving source-before-alias precedence and ordinary planner contracts.
Existing public oracle test now8/8. Added owning analysis regression for direct
and computed alias dependencies. First new precedence control incorrectly used
ambiguous bare a in a self join; rightly failed resolution. Replaced TEST with
single-source precedence control; no production workaround.

B4 blocked-phase hypothesis discriminated with test-only observation import in
card-local routed-repair/observe.mjs. proc-73593958dff6 exit124 showed calls
progressing, joinSet412 then correlationSet2240, over700k charged comparisons
within8s. No deadlock diagnosis. Existing linear found was costing scans per probe.
Pinned Found/IndexMoveto ordered search comparison motivated sorted membership,
not budget removal or fake yielding. Compiler sorts its once-only key sets;
primitive sorted flag shared across OpenDup and invalidated by append. Sort uses
existing controlled merge algorithm and only publishes completed state; found
uses KeyInfo midpoint comparisons and never changes #at. Unsorted linear branch
retained. Primitive adds descending/null/search/mutation/control assertions.

## Commands and outcomes

Evidence work:///cards/card-t-d/routed-repair/ (type.log, focused.log, cross.log,
cross-retry.log, r1-native.log, r2-native.log, owning.patch). Exact initial failures
and no-input-drift checks remain routed-red-resume/{alias.log,b4.log}.

- proc-b18674e15468: original `timeout --kill-after=3s 30s node
  --experimental-strip-types --test test/conformance/multisource-inner-oracle.test.mjs`
  exit0,8/8 after WHERE edit.
- proc-5a4cc0603f3d: both Chinook environment paths set to absolute
  examples/browser/chinook.sqlite; original `timeout --kill-after=3s 8s node
  --experimental-strip-types --test --test-name-pattern='B4 aggregate consumer'
  test/conformance/expression-subquery-chinook.test.mjs` exit0,1/1,3.1s;
  subsequent npx tsc --noEmit exit0 (not used to erase earlier status).
- proc-9f3f5c4b7bfc owning tests24/25, ambiguous new test control as above.
- proc-95c9d29e744a guarded typecheck then node tests: canonical-c1-c6-checkpoint,
  expression-subquery-chinook, multisource-inner-oracle, where-plan-analysis,
  private-membership-search, private-endpoint-seek-control,
  window-endpoint-seek-control-public, relational-private-lifecycle,
  aggregate-group-lifecycle =79/79, fail/cancel/skip0. diff check0.
- proc-5d25b4a5f61f expanded cross run exit124: compound-union-all pending
  watchdog; WHERE public tests failed missing card-local r1/r2 captures.
  This is NOT a passing expanded suite. Separately routed compound gap remains.
- proc-4b352c67b83c generated fresh sourceid-checked r1/r2 captures with existing
  capture-where-{operand-admission,order-consumption}.py using card-w pinned
  oracle-build/build/libsqlite3-oracle.so, output dirs card-local r1-native and
  r2-native. Then guarded30s tests where-operand-admission-public,
  where-order-consumption-public, where-plan-foundation, where-plan-ordered-red,
  compound-collation =17/17,exit0. These captures are post-edit, not native-first
  evidence for routed aliases/B4 (those native captures preceded edits).

## Changed-input hashes (before documentation edits)

- where-plan.ts4c2cca2c8ecb1c21069f7c45f13d25885cea0684c86fe92d1c59508598d47ea5
- private-state.tse3673eabf02b9510cf0c6bac90caa110020b5572435facaa1d177ea7129f3acc
- vdbe.ts68510cc91399318e1fd1d323031da1c890b86ea16b56dc371b5787e8290e7731
- where-plan-analysis.test.mjscadcb0dbbce6f204db3b8837c57232a0e4565d0b47e7971bc82636b787afa015
- private-membership-search.test.mjs83960be91138c150c56d214a8ae8c5433d7bffea0d48253b0c7225c3fd3192cd

No full dirty suite/export certification. Grouped RIGHT and general planner,
correlated SELECT, native page/storage/work/error timing gaps remain. Membership
optimization covers sorted complete-key sets, not prefix-search/nTab parity.
Original failures preserved; no compatibility percentage inferred.

## Exact CURRENT bounded attribution/export (2026-10-05 follow-up)

Freeze base is exact HEAD `d9d6759c44aa5366ea5f32d0b64f4d13badb11a5`.
Artifacts: `work:///cards/card-t-d/routed-export/` contains before.json,
after.json, drift.json, manifest.json, owning.patch, build.py, export/ and each
component's log/exit. No real staging/reset/commit or peer edit occurred.
1173 exported baseline+authored files is an inventory, not compatibility quota.

Attribution is **relative to HEAD**, not the older ee5252 export. Private-state
hunks137/161/175 are sorted-state/search/append/sort; WHERE hunks378/400 are alias
binding/dependencies. VDBE hunks6222/6239 only insert the two sort schedules.
Root bitwise import hunk9 and evaluator hunk6671 explicitly excluded. No CURRENT
j/INTERSECT overlap appears in this diff: retainFoundIn is HEAD baseline, not newly
allocated to this repair. Owning analysis appended hunk179; new membership test
and repair report are authored whole files; guide/source map/audit appended
routed sections are included. All other dirty/untracked overlays excluded,
including package/HTTP teardown/harness, ordered-index fixture patch and caches.
No new index or compound behavior is credited. Hunk allocation/path list and
all baseline/export SHA256s are manifest.json, not an inferred file-count claim.

Patch SHA256 `6bbecde3cf0d293021ac374db9921b74f17a403e6d291c954f21e3d0b1021157`;
manifest SHA256 `9c36b4a947f1aa0a925db31e2368a3d3e623bd482b57a3f04afe82609988eb27`.
Export private-state/WHERE/analysis/membership hashes equal current hashes above;
export VDBE `41b9a97a647022036edaf81758c7b8a4928f0d158645fa50e404412c3c4487af`
differs from current68510... **only** by excluded root bitwise additions.
Source dependencies resolve/select-compiler/Mem/KeyInfo/Btree/control/lifecycle
come from exact HEAD, with no external runtime engine. Native provenance remains
alias/B4 before routed edits; r1/r2 fresh source-ID-checked captures post-edit.

Build trial proc-641dc4fdf29a uncovered an important artifact issue: `git apply`
in the nested ignored export returned0 without applying paths. Manifest comparison
caught unequal hashes; do not treat that attempt as repaired export evidence.
Explicit `patch -p1 --directory=export` proc-e7ca7fc9da05 applied every allocated
hunk; refreshed full manifest then verified intended hash equality/exclusion.
Workspace source was never changed by this attempt.

Separate components proc-2b5e80e65548 on that exact export:
- absolute workspace TypeScript binary `node .../typescript/bin/tsc --noEmit`:0.
- original alias file `timeout --kill-after=3s 30s node
  --experimental-strip-types --test test/conformance/multisource-inner-oracle.test.mjs`:
  0,8/8.
- original B4 with absolute existing Chinook fixture env and unchanged8s command:
  0,1/1,3.18s (reset/admission retained).
- same listed nine-file79 matrix:0,79/79 (C1–C6/Chinook/owning/F1/lifecycle).
- same five-file relevant17 with inherited SAIVAGE_CARD_WORK_ROOT pointing to
  r1/r2 native captures: **124,15pass/1fail/1cancelled**. Driver deliberately1.
  Exact HEAD ordered-red fixture lacks szTabRow/nRowLogEst/hasStat1; first ordered
  test throws `Cannot convert undefined to a BigInt` at where-plan.ts219.
  Compound-collation pending-resolution watchdog cancels. These are NOT repaired
  engine failures proven by this evidence and NOT seventeen passing export checks.

Precise excluded seams for root decision (no guessed peer allocation):
`test/conformance/where-plan-ordered-red.test.mjs` dirty hunk5 adds
`szTabRow:16, nRowLogEst:200, hasStat1:false` to synthetic table consumed by
btreeLoops219. `compound-collation.test.mjs` dirty hunks1/16 import/use peer
closeTestServer instead of server.close; helper is untracked peer harness.
Those changes explain why dirty17/17 cannot be reused as exact no-harness export17.
Root authorization/attribution of these test-only dependencies is required before
claiming all17 on the requested boundary. They were NOT swept into export.

Isolated unchanged first three files (public operands/order/foundation) on same
export proc-d8df194a8867:0,5/5; does not waive remaining12 or replace17 criterion.
proc-e1b8e0073374 compared entire tracked/index/status and exported manifest:
workspace_changed[]/export_changed[], no index drift. Owning diff check0.
Prior compound-union-all/INTERSECT watchdog stays unwaived, not rerun broad suite.

Mutation correctness and adaptations remain as described above: equality-preserving
replace/remove/retain do not disturb sorted ordering; failed append conservatively
invalidates search optimization; clear may conservatively retain false. Direct
concurrent primitive mutation is not certified; public suspended connection
exclusivity remains the execution contract. No native page/error/work-count parity.
This delivers exact bounded attribution and passing repaired-owner79/alias/B4,
with the requested17 completion blocked at explicit excluded test/harness seams.

### Root-authorized JOINT disposable export resolves test-only boundary

Root material decision explicitly allocated ordered-red hunk5, compound-collation
hunks1/16 and reviewed w helper; not inferred peer approval. Fresh HEAD/dirty/index
inventory before building: `work:///cards/card-t-d/routed-joint-export/before.json`.
No j edits active or included. Exact prior owner export was hash-verified before
copy, then only these authorized test bytes patched. No expectations, watchdogs,
production semantics or real index altered. Existing failed trial/export preserved.

Contract verified: TableNode schema.ts44–48 requires szTabRow/nRowLogEst/hasStat1;
schema construction supplies these (default row estimate200, no stat1). btreeLoops
where-plan.ts219 directly BigInt-converts nRowLogEst; rowid path228 also consumes
it. Synthetic fixture values fulfill that existing contract, not a new cost path.
Helper exact9-line source has no imports/dependencies: server.close then
closeAllConnections after statement/connection cleanup, as reviewed w diagnosis
lines34–41 explains. Only compound-collation imports it in this joint overlay;
no sweep of other HTTP-harness users. HTTP teardown is not SQL interrupt control.

Artifacts under `work:///cards/card-t-d/routed-joint-export/`: export/ (1174 files),
manifest.json, owning.patch, peer-test.patch, before/after/drift.json, per-check
logs and exit files. Build script retained at routed-export/joint.py.
Joint manifest SHA256 `47f962fa1d595ecbdc24b300e47103426e30ef8f9f65e68660acc29f1072b2b4`;
owner patch unchanged6bbec...; peer patch
`2ef1e50b7384ade451201f60078ddd0bf5028e621803926d4b5bf4fe3345be73`.
Authorized test SHA256s:
- ordered-red: `8f878a182f057726827c98eeded1b335b472956e5cdfb3260923716e071f341d`.
- compound-collation: `aa2d5f26b6a72a328dda72d4111373ed30b02ccafcec0b67beabf133853c6f23`.
- helper: `e8bed2e76655893696814b3345a36e0b0cbb2f860d2a0d6a84645249db35c32f`.
All owner source/test hashes unchanged from bounded export; full exact hashes
are manifest export_files. In particular VDBE41b9... still excludes root bitwise;
no dirty package, index, cache or j production additions.

Fresh proc-168917a2fa04 individually captured exits, aggregate guarded0:
TypeScript0; original alias30s0/8pass; original B4 unchanged8s0/1pass3.16s;
existing nine-file79 matrix0/79pass22.15s; requested five-file17 matrix0/17pass3.79s.
Exact commands are preceding follow-up commands, replacing only export cwd with
routed-joint-export/export; absolute existing Chinook env, inherited card work
root r1/r2 captures retained. All fail/cancel/skip/todo0. Partial inline stream
read completely through returned process stdout URL. proc-77081d87b8dc drift
workspace_changed[]/export_changed[]; index identical; diff check0 BEFORE this
report append. Fresh joint17 resolves the preceding no-harness17 failure without
rewriting its history. Source/native provenance unchanged; no recapture assertion.

This closes bounded requested owner/joint export evidence only. w full222/1/2
remains historical NONPASS (not freshly rerun); compound-union-all/INTERSECT timeout
unwaived, no full suite/native work/page/error parity or compatibility percentage.
No source/peer edits, real staging/commit/reset, new refactor or feature cycle.
