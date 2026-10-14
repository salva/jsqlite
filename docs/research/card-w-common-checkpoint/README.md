# Common-functional checkpoint — [[card:card-w]]

## Identity and reproducibility

This is next-work evidence, not release, compatibility percentage, exhaustive
corpus acceptance or a forecast. Engine input is the committed archive
`56169753bcd7c5dd8158b19e8bb5df1277b1b94e`, not dirty peer runtime/docs.
Archive inventory4619 tracked inputs is hashed in
`work:///cards/card-w/common-checkpoint/committed-inputs.json`.
Existing approved900 dependencies are reused, not clean-install proof.
Native sourceID is independently checked against that archive's manifest:
SQLite3.53.4, bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc.
The pin-checked shared library's actual SHA is in native.json. No native runtime
is shipped. Fixtures create native tables/trigger effects before read-only open;
public execution never writes. Native queries step twice with reset and public
queries likewise; all statements finalized, databases closed. Explicit typed
INTEGER/REAL bit patterns/TEXT UTF8/BLOB/NULL representations and all five
metadata fields are compared; native UTF8/UTF16le/UTF16be snapshots hash-recorded.

To reproduce with fresh disposable roots (no network prerequisites):

```sh
# S is an extraction of the committed tree with retained development deps.
# L is a library built by tools/oracle/build.py from the manifest-pinned source.
export COMMON_CHECKPOINT_SOURCE="$S"
export COMMON_CHECKPOINT_OUTPUT="$SAIVAGE_CARD_WORK_ROOT/common-repro-fresh"
timeout 30s python3 docs/research/card-w-common-checkpoint/capture.py "$L" &&
timeout 60s node --experimental-strip-types docs/research/card-w-common-checkpoint/public-probe.mjs
```

45 execution cases =15 SQL shapes ×3 encodings, not45 distinct syntax features:
24 matches (rows/storage/fullmetadata, two reset executions),18 truthful temporary
unsupported and3 misleading SQLite diagnostics, no admitted wrong rows observed.
New durable capture/probe scripts repeated independently using fresh snapshots:
public results byte-equivalent as JSON values. A successful observer process is
not all SQL passing: classifications remain in public.json, exact expected rows
and metadata in native.json. Probe resource evidence is external60s completion
and successful SELECT1 after each prepare rejection; privateAccounting counters
are retained, not byte-refund/security/performance proof. No abort/tiny-budget
matrix added; existing harness/runtime safety tests remain separate evidence.

## Finite common-composition leads for ROOT routing

Each SQL is verbatim in both JSON files. All native prepares succeed and repeated
native steps finish101. Treat these as common functional composition gaps, not
optimization-only or rare-breadth priorities:

* Derived ORDER/LIMIT aggregate: `SELECT sum(x) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 2)`.
  Native INTEGER5; public SQLite code1 `no such table: (subquery)` in all encodings.
  This is a misleading diagnostic for retained syntax, not an admitted wrong row.
  Route parser/derived binding + SELECT compiler owner (`src/internal/sql.ts`,
  `select-compiler.ts`, `vdbe.ts:compileTableSelectProducer`) to resolve child
  destination/cardinality/outer aggregate. Pinned `select.c:flattenSubquery`
  restrictions must preserve child ORDER/LIMIT rather than flatten illegally.
* Filtered table UNION with ORDER: `SELECT x FROM t WHERE x>1 UNION SELECT x FROM u WHERE x<4 ORDER BY x`.
  Native INTEGER2,3; public truthful unsupported. `vdbe.ts:compileSimpleTableCompound`
  arm restriction at4906 owns gap. Ordinary unfiltered UNION, INTERSECT and EXCEPT
  with ORDER match, including fullmetadata. Compare pinned `select.c:multiSelect`
  arm destinations/filter production, not union SQL string special cases.
* Recursive consumer join with and without aggregate: native sum6 or rows1,2,3;
  public truthful unsupported (`vdbe.ts` recursive aggregate owner2607 and
  ordinary recursive consumer guard). Pinned `generateWithRecursiveQuery`
  queue/destination consumer ownership is the source route; no missing machinery
  substituted here.
* JSON join ORDER and PRAGMA join ORDER/correlation: exact three ordered queries
  in corpus truthfully unsupported at shared `compileTableSelectProducer` mixed
  source guard6031. Unordered retained json_each(t.js) join and constant
  pragma_table_info('t') join match typed rows/fullmetadata. Correlation/order
  owner must extend shared cursor input/ordinary destination route, not evaluator
  bypass. Compare pinned `json.c` cursor/filter and `pragma.c:pragmaVtabFilter`
  (clear previous cursor, bind hidden args, ordinary statement stepping) with TS
  shared mixed-source path. Correlation-only (without ORDER) not tested here;
  do not infer it is unsupported from combined case.
* Generated STORED STRICT scan (`SELECT x,y,typeof(y) FROM g ORDER BY x`) and
  preexisting trigger-result audit scan match. These establish read-only generated
  values/typing and trigger-bearing schema readability, NOT trigger execution or
  arbitrary virtual/generated/STRICT compositions in public runtime.

No engine fixes or expectations rewritten here. ROOT chooses source-owner repair
order. Safety/performance is separately required: no evidence here of leaks,
interrupt failure or engine infinite loop; external completion is not security
proof. No new optimization or rare-breadth admission claim.

## Current metadata contract authority and browser

Committed API525+ documents bounded seven metadata families; committed guide
also reflects them. Dirty working `docs/api.md:10` still says table-valued PRAGMA
consumers deferred/unimplemented. Flagged contradiction, no wholesale peer-doc
rewrite. Do not certify dirty API as current committed authority.

Fresh seven committed metadata test files (tvf-five, five-admission, r1, on,
bindings, boundaries, db) are outside original348:7files completed0,98cases98pass,
0skip/fail. Manifest
`work:///cards/card-w/common-checkpoint/focused/integration-run/manifest.json`
SHAaeca791ef42c5ea9d553c7957fa6341fedd78a0a0295c87d4525ef3e392a6cd6.

Read-only binary check found `/home/salva/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`,
version148.0.7778.96, SHAadc1c21ceed5c2a67184766376fe816ac03e556cc0ca3f782e8212235fe05c6f.
Current archived deps cannot resolve `playwright` (MODULE_NOT_FOUND); that failure
is retained, not erased by sequential `chrome --version`0. No browser suite,
upgrade/configuration, installed artifact rebuild or new publication claimed.

## Historical evidence and full current inventory

Original348 inventory is reused as requested, not reconstructed historical42.
Exact committed run's individual exits/fixture logs/coverage totals are in card
status and its manifest. Two old untracked companion tests are absent from HEAD
(make-record-small-budget-cleanup, window-conversion-budget-cleanup); do not
restore them silently or call their missing current components green. Prior348
archive-overlay pass remains historical exact-input evidence only, not this new
runtime green. Five dormant skips and killed/unreconstructed42 remain no-credit
limitations. Initial capture retry hit existing fixture `table t already exists`;
that failed invocation is retained; corrected fresh-root capture preceded public
run with `&&`. Earlier metadata key mismatch was observer schema normalization,
not engine regression; corrected to public field names before final comparisons.

### Fresh full current run (not green)

proc-7434f21bf9e7 ran the exact348 inventory under current committed source,
30s/file, serial, external750s. Aggregate1:337 completed0,11fail1,0timeout,
8fixture producers completed0, input_drift[]. Node totals5967tests5950pass12fail
5existing skips; missing files have no executed case credit. Manifest
`work:///cards/card-w/common-checkpoint/full348/integration-run/manifest.json`
SHAd6b1cbc1ef2d013b40de0a8f53fb3e3d6ac590bb8610f198cd49f78e0857e643.

Failed components (no removals/skips/expectation weakening):

* Two absent untracked budget companions named above (file launch fail1).
* multisource-inner-order: current metadata INT versus retained expected int.
* or-residual-contract, select-compiler-entry, skipscan-docs, stat4-docs: retained
  structural/current-document assertions. Prior w fixes were overlay, not commits
  in this engine tree; don't invent a new engine regression explanation.
* right-nested: three in-left cases retain temporary-reject expectations; prepare
  succeeds. Prior native-backed reconciliation is overlay provenance, not this
  committed test. Route bounded test reconciliation to ROOT, no changes here.
* record-insert-overlap-review: cap error assertion fails under this committed
  older observer. Concrete trace/log retained; not evidence of a newly introduced
  leak or patchable engine defect without primitive comparison.
* skipscan-prefix-code and skipscan-seekscan-state: ENOENT primitive-companions
  native.json. Fixture producers succeeded in purpose root but these consumers
  still read source-relative paths; reproducible harness/consumer integration gap,
  not SQL wrong-row proof. Route fixture-env consumer repair to ROOT/harness owner.

Fresh current archive typecheck0; harness5/5pass0 in8.536s. Fresh metadata7-file
98case lane is separate additional inventory (not inflated348 total). Public45
matrix observers complete0 but contain21 rejected queries, not a green engine
suite. No beta/release/artifact readiness conclusion.

### Focused fixture-consumer repair (subsequent node)

The two skipscan ENOENT failures are repaired in the working test consumers:
`skipscan-prefix-code.test.mjs` and `skipscan-seekscan-state.test.mjs` now use the
existing `test/skipscan-root.mjs` helper, exactly as prefix-seek already does.
The runner sets SKIPSCAN_NATIVE_ROOT to the producer's purpose root; previously
these two consumers ignored it. Legacy standalone root behavior is preserved;
explicit absent roots still fail, with no fallback to unrelated fixture evidence.
New `test/skipscan-root.test.mjs` checks URL construction, legacy identity and
explicit missing-root non-fallback. No engine/source algorithm or expected rows
changed. Prior348 aggregate1 remains historical current-input evidence, not green.

Fresh committed d1bef6c1 archive plus only these two consumer overlays:
external120s runner proc-39aec33a6f88 exit0, six dependency-ordered native producers0,
three files39/39cases0skips/fail and input_drift[]. Includes both repaired files
and unchanged prefix-seek primitive lane. Manifest
`work:///cards/card-w/repair-fixture-consumers/run/integration-run/manifest.json`
SHAa33340f8c644764a12ac344e3402c697ff8c9bbb0a53eb508c2789e73cea3598.
Fresh helper regression proc-edf596bcdae9 1/1pass under10s. These are focused
fixture orchestration fixes only; remaining nine failed348 components and the
common-composition engine gaps are not waived. Scoped working patch awaits review;
no shared index normalization or additional commit in this repair node.

### Authorized scoped delivery verification

ROOT authorized this four-path delivery after review. The delivered helper test
also retains the already committed helper's actual ENOENT assertion (rather than
only URL nonfallback), using an absent purpose-root child and checking legacy
identity. Fresh candidate-tree verification proc-e914c402b84d:6native producers0,
4files40/40cases0skip/fail, no input drift. Fresh typecheck proc-552c4770640f0;
harness proc-46e7f7953815 five tests pass in8.477s. Candidate and final tree/log
hashes and actual commit identity are in current card status, not speculative
commit IDs here. Prior raw348337/11fail is still nonpass evidence. Two fixture
consumer failures resolved; remaining **nine components**, not nine failing cases,
are explicitly unwaived and not collectively rerun. No runtime/SQL/semantic
expectations, new breadth, browser or release changes. Shared-index deletions of
this README and helper remain preserved; temporary-index delivery uses actual
four scoped working files instead of that unrelated deletion carrier.
