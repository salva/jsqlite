# Independent row-vector review — partial, integration withheld

Current review base `d0bf503d`; consumes card-i-b status v48. Pinned source is
SQLite3.53.4. Read `expr.c:codeCompare/codeVectorCompare/exprVectorRegister`,
`sqlite3ExprCodeIN`, generated-vector lowering and shared wide destinations.
Literal fields use one scalar register per evaluation; ordering uses ElseEq;
comparison affinity/collation uses shared owners. Child producer initializes
NULL fields, limits scalar destination to first row, omits Once for correlated
plans and uses shared set/KeyInfo/private cursor state. Scalar width defaults1.
These selected paths are source-shaped, not a release compatibility claim.

## Harness hardening

Previously public.mjs reported mismatches but returned success, and error rows
never compared output names. Runner now exits nonzero on mismatch and compares
step-error names; native capture retains those names. Fresh source-ID-checked
capture matches every old semantic observation exactly after removing the new
names. Two public runs byte-match:123/123, zero credit. Added actual yielded
cancel/deadline, saved error/finalize and connection reuse, first-row/empty NULL
and reprepare checks across3 encodings. Structure test checks4 function results,
shared comparison operands, ElseEq, no catch-all Expression.

## Commands and actual outcomes

- `proc-e2f797cefd61`: `sh tools/oracle/build.sh`, exit0, verifies pin, builds
  oracle only in supplied work root. Initial missing-library capture failed in
  `proc-b62ccf54bcfa`; subsequent build resolves unavailable library.
- `proc-b3a742f839d9`: isolated native capture, old-observation equality assertion,
  duplicate public123/123/cmp, manifest41x3/22 assertions/zero credit, typecheck
  all pass. Artifacts under supplied `vector-review` work child.
- `proc-36723cb8c1cc`: lifecycle/subquery12/12 pass.
- `proc-bf888a145508`: structure1, expressions40, companions12, bounded6 pass;
  broad combined47/48 because CHINOOK_DB missing, not runtime failure.
- `proc-b3be700107b8`: without unavailable Chinook fixture, affected vector/
  subquery/parser/numeric54/54 pass; package boundary command exits0.

## Concrete integration overlap / unresolved acceptance

Workspace index holds3081 staged paths including inversions/deletions of parser,
resolver, VDBE, select-program and large docs/tests/schema peers. HEAD-to-working
source delta is vector expected-width repair (resolve13/3, select-program4/3,
VDBE144/11), but index-to-working is much larger. Committing all or staging these
whole paths would destroy staged peer intent. Root must coordinate m/t ownership
of shared expected-width child producers before reviewed integration. No claim
of exclusive ownership, no index reset, no staged peer discard. Harness-only
review does not establish a committed runtime milestone.

Still required: scoped runtime integration commit, exact committed-source archive
validation, Chinook fixture run, fuller correlated/vector single-evaluation and
register-lifetime proof, exact extended codes/full metadata (only names captured),
private byte-memory failure identity, overlap admission while held at yield,
vector index optimization (optional backlog, not semantic requirement), broader
compound/aggregate vector compositions. Native units are not TS units; no new
canonical credit, release/full-SQLite claim or STAT4/STRICT/bitwise/index acceptance.

## Independent authorized candidate diagnosis (2026-10-13)

Root authorization removed the former overlap gate, not verification obligations.
Constructed an isolated HEAD (`ca4fd96c`) candidate under supplied
`vector-integration/candidate`, never from the index. Runtime matches authorized
HEAD-relative patch SHA256 `d1b18d1cf95ae305a519e6bab9472a73b7557add6edca1e10aa59593fd994c5c`.
No runtime integrated: fresh affected regressions prevent acceptance.

Fresh source-ID-checked row-vector capture now includes full prepared metadata and
extended error codes. Public runner compares both (including step-error metadata).
Chinook harness now uses committed digest-bound `chinookFixture()` instead of
requiring an external environment variable. Added all-three-encoding private-byte
limit/saved-error/reset/finalize/reuse and held-yield sibling admission/cancellation
controls. These are harness additions, not runtime or upstream credits.

Commands and actual outcomes:
- `proc-c48705d4fd58` prior owner run failed because CHINOOK_DB was absent; log
  inspected, not interpreted as runtime defect. Replacement fixture helper resolves
  this setup failure. `proc-c877d1beeb1e` candidate assembly failed on missing HEAD
  section anchor; corrected to append only new bounded sections in disposable copy.
- `proc-5cfb1bd44cff`: isolated `capture.py` verified exact pin; public123/123 with
  full metadata/extended codes; owner tests102/102. `proc-ac99b3b89f8b`: lifecycle9/9.
- `proc-1a63be9b1d42`: isolated candidate owner105/105, public123/123, typecheck,
  package boundary pass. `proc-1cbc084d52fc`: duplicate public123 byte-identical;
  expressions40, companions12, bounded6, cross-encoding3, cleanup5, opcodes6,
  expression accounting40/40, row manifest41x3/22 exact assertions all zero credit;
  package-distributable build and isolated browser-global VM pass; independent
  expression native recapture `cmp` exact.
- `proc-099b52b258d3`: generated binding/diagnostics/scalar-BUSY144/144 pass;
  affected parser/value/select/subquery/vector run **855/859**, exit1. Four reds:
  all3-encoding existing `caller native derived reset rebind clear` reports corrupt
  `page number outside database`, plus resolver width test loses expected rejection.
- `proc-bd3cd3236e89`: repeat focused parser/resolver and subquery-view **210/214**,
  same four reds. Independent unchanged HEAD `proc-ecd0ebe9fc75` **214/214**.
  Thus these are candidate-induced regressions, not pre-existing broad debt.
- `proc-d6a08db9e06a`: stage2 public runner exit1 at capi3c-1.1 expecting prepare
  error for SELECT name FROM sqlite_master. Unchanged HEAD `proc-97fa488dd0ec`
  fails identically: separate historical stale expectation/admission diagnosis,
  not a vector regression and not waived. Native stage2 runner exit0 in
  `proc-60d29efa854d` does not resolve public discrepancy.

Direct owning-path comparison: compileWideSubquery chooses linked source-bearing
children then unconditionally routes nonaggregate children to compileInnerTableSelect;
that is not a correct derived/coroutine producer dispatch (synthetic rootPage can
reach real btree), unlike retained shared subquery caller routing. Fix that owning
producer/caller boundary, not the SQL text or btree corruption check. Resolver now
passes null expected width except IN; old scalar expected1 rejection is absent.
Do not simply restore unconditional scalar1: vector comparison consumes N and EXISTS
allows unused EList. Carry consumer width context to resolver as pinned expr.c
vector-field/subselect/select destination ownership requires. This needs a bounded
repair and fresh native/public regressions; no parallel evaluator substitution.

Native metadata123 is finite, not exhaustive composition proof. Current owner doc
acceptance claims must be revised after regressions are repaired; no whole dirty doc
or runtime path committed here. Optional index optimization, general specialized
ordered/aggregate/window/derived/CTE composition, deterministic PureFunc/folding,
full REPLACE fallback, broader affinity/COLLATE, internal JS-string transcoding,
real resource-owning cleanup, and remaining date/math/JSON scalar breadth remain
ordinary backlog. No owner scope change or additional compatibility credit.

## Repair-node evidence (2026-10-13)

The four candidate regressions are repaired in the scoped working candidate,
not yet integrated into a reviewed exact-HEAD runtime commit. Peer index unchanged.
Source manifest unchanged. Existing derived public reset/rebind/clear tests are
regressions across all three encodings; a resolver regression additionally checks
scalar/grouped comparison/IN-left/EXISTS widths through parentheses.

Direct comparison: resolve.c comparison vector-size branch and expr.c
sqlite3ExprVectorSize/codeVectorCompare distinguish scalar consumers from vector
comparison and IN lhs; EXISTS does not consume the EList. select.c SRT_Mem/Set
consumes linked field count. Resolver now preserves these consumer contexts.
More importantly, generated expression SELECT and its resolved source were not
the same source after retained derived expansion: traced wide dispatch had
`select.from.items=['t2']` but linked `sources=[['d',0]]` and
`resolved.source.from.derived=true`. Reading page0 as an ordinary real table
caused the corruption error. Binding/dispatch pairs the resolved source with its
linked columns, retains derived producer dispatch, and drops the superseded plan
when that producer substitutes its source recursively. No btree error weakening
or SQL-text exception. Optional schema is forwarded to the wide no-FROM owner.

Attempts and results (all disposable candidate under card work root):
- repair1: expected scalar width restored but IN lhs incorrectly inherited1;
  derived exclusions alone insufficient. 296/302, exit1.
- repair2 (`proc-d87cc87c92ca`): IN lhs vector context fixes vector tests;
  299/302, remaining three derived corruption errors. Public/type did not run.
- repair3 (`proc-66d9cd908680`): binding alone insufficient, 299/302.
- repair4 (`proc-7921b54a87b4`): dispatch normalizes source, but recursively
  reapplies obsolete resolved source; three stack-overflow failures, 299/302.
- repair5 (`proc-eff4f07ececf`): clear obsolete linked plan during substitution;
  302/302 and public123/123; typecheck failed exact-optional and mutable-union
  narrowing. Later preliminary type commands also failed; wrapper final head
  command success did not waive those failures.
- `proc-095d24a17a5f` fail-fast: corrected types/immutable local discriminants,
  typecheck passed; affected row-vector/select/parser/value and existing owners
  859/859; generated binding/diagnostics/BUSY144/144.
- `proc-1e7a53b5e8a7` fail-fast: added grouped resolver regression;
  `node --experimental-strip-types --test test/parser/resolver.test.mjs
  test/conformance/subquery-view-foundation.test.mjs test/conformance/row-vector/*.test.mjs`
  303/303; public.mjs123/123 zero credit; npm run typecheck passed.

Logs: card work `vector-integration/repair{1,2,3,4,5}.log`,
`repair-affected.log`, `repair-generated.log`, `repair-final.log`,
`repair-final-public.log`. The unchanged SQL/native manifest remains the earlier
independent oracle evidence; no new native recapture is claimed in this node.
Full package/native/accounting/exact committed archive acceptance remains before
runtime integration. Broader existing stage2 admission expectation disagreement
remains unadjudicated. This node proves focused repair, not release acceptance.

## Verify-node result: acceptance withheld (2026-10-13)

Fresh fail-fast `proc-717b07384738` on the unchanged repaired disposable runtime:
exact pinned row-vector capture.py recapture and cmp native.json passed; expression
capture-expression-functions.py and cmp stage3-expression-functions.json passed.
Two public.mjs outputs byte-identical123/123, zero credit. All npm expression
manifest/ts/companions/bounded/cross-encoding/cleanup-gap/opcodes/boundaries gates
passed (40 selected,12 companions,6 bounded,3 encoding,5 cleanup,6 opcode checks).
Row manifest41x3/22 assertions passed. Package boundary and typecheck passed;
package-distributable build/isolated browser-global VM passed (unpacked2453240).
Synthetic cleanup runner's numeric credit does not establish a resource-owning
built-in proof. Browser-global VM is not a GUI browser. Prior focused303/303,
affected859/859 and generated144/144 applies to identical runtime files; broad
verification below is additional coverage and overrides any inference of acceptance.

`proc-6f76b2bc1753` ran
`node --experimental-strip-types --test test/parser/*.test.mjs test/value/*.test.mjs
 test/select/*.test.mjs test/conformance/*.test.mjs test/conformance/row-vector/*.test.mjs`:
**5266 tests,5230 pass,31 fail,5 skipped**, exit1. Broad logs are
`$SAIVAGE_CARD_WORK_ROOT/vector-verification/broad.log`. Some failures involve
missing external fixture/setup or unsupported peer breadth and are not adjudicated
as candidate regressions. A same-test-tree ca4fd96c runtime control
`proc-382575738364` yields5157 pass104 fail5 skipped, exit1; the new tests are not
expected all to pass against old runtime. Comparing only totals is invalid.

A concrete retained public regression is independently confirmed:
`node --experimental-strip-types --test --test-name-pattern='public scalar, correlated aggregate'
 test/conformance/select-scalar-child.test.mjs` fails candidate with corrupt
`page number outside database`, but unchanged ca4fd96c control passes1/1
(`proc-d1af0dd4a400`, separately recorded exit codes). Disposable trace
`proc-21fa1c1020c4` isolates the failing entry:

```
SELECT (SELECT q.vb FROM v1 AS q WHERE q.vb>2 ORDER BY q.vb DESC LIMIT 1) AS high,
 EXISTS(SELECT q.vc FROM v1 AS q WHERE q.vb>9) AS absent,
 6 IN (SELECT q.vb FROM v1 AS q WHERE q.vb>2) AS member
```

This existing view/scalar consumer worked before the candidate and now scans a
transient source as a physical table. It is a preservation regression, not an
invitation to widen view/order scope. Repair its semantic producer/source pairing
and dispatch; do not weaken page checks or add a query-text exception. The trace
modification was only in disposable tests and was restored from project afterward.
Other candidate-only broad reds include linked fractional LIMIT0.5 prepare-versus-
step errors, ordered scalar owner and nested-view metadata; all remain evidence,
not waived by narrow greens. Full adjudication remains in the broad logs.

No integration commit made with known red. Source pin unchanged, peer staging
preserved. Node outcome repair_needed. Exact committed/archive proof and clean
coherent scoped runtime integration remain required after these regressions are
resolved. Stage2 historical expectation disagreement also remains outstanding.

## Retained view/scalar dispatch repair (2026-10-13)

Pinned select.c6002–6075 selectExpander distinguishes subquery/view transient
Table metadata from ordinary real tables; sqlite3ViewGetColumnNames installs
view columns without granting that Table a physical root. The previous fast
wide dispatch tested only source count/derived flag. It incorrectly bypassed
retained flattenImmutableView and specialized scalar producer branches.
Fast dispatch now requires physical positive-root sources and its actual simple
unordered, nonaggregate/noncompound/no-nested-subquery shape. Other scalar
children retain existing producer routes; no new view/order/aggregate breadth,
no source pin change, no btree error suppression. Wide field destinations remain
unchanged. The owning dispatch boundary, not SQL text, is corrected.

Attempts:
- proc-216343fbdc86 physical-root guard alone:327/329, view corruption resolved
  but later existing nested child failed unsupported in wide inner-table emitter.
- proc-ab261f5d3a20 exclude nested/order:327/329, later existing compound child
  reached unsupported wide compound producer.
- proc-3f810d3da6e7 full simple-producer shape:328/329. Actual public preservation
  and nested-view cases pass; remaining test was a structural regex requiring
  obsolete `select:flattened` syntax without `resolved:undefined`.
- Updated that exact structural assertion to require cleared obsolete plan;
  it still asserts derived ORDER transfer, not a weakened runtime outcome.
- proc-063be9ed5818 focused329/329, typecheck pass, public123/123 zero credit.
  Its final broad command failed (not masked):5266 total5233 pass28 fail5 skipped,
  versus prior5230 pass31 fail. Concrete public/view regression and structural
  stale assertion removed. Residual broad failures still outstanding.
- proc-42848ec3ee49 fail-fast affected suite expanded to include
  select-scalar-child:886/886; generated binding/diagnostics/BUSY144/144;
  expressions40/40, companions12, bounded6, cross-encoding3, opcodes6;
  package boundary passed. Exact command set is the prior affected859 command
  plus test/conformance/select-scalar-child.test.mjs and added resolver regression.

Logs: card work vector-verification/view-repair{1,2,3}.log, view-final.log,
view-public.jsonl, view-broad.log, view-affected.log, view-generated.log and
view-expression-*.log. Tests executed in the authorized isolated candidate with
current resolve/vdbe and updated scoped tests. Existing public preservation
matrix supplies reset/type/name coverage; subquery-view and vector lifecycle
suites provide all3 encoding/error identity/yield/reuse controls. These finite
checks do not certify specialized scalar composition globally. No integration
commit yet; full remaining red adjudication and exact committed archive evidence
remain before milestone acceptance. Native artifacts were not changed by this
repair; earlier recapture proves their identity, not a fresh TS build acceptance.

## Verification after retained-dispatch repair: concrete remaining LIMIT regression

Reused focused329/329, affected886/886/generated144/144 and expression gates only
because unchanged relevant source hashes apply; current and disposable vdbe.ts
both SHA2568fec2123d1733b379c25e00cdac41ed3206ecf74c432bf11095835de62b97b9e.
This coverage omits the additional select-linked-scalar-preparation-owner matrix.
Broad28 reds therefore preclude completion; no additional broad rerun needed to
repeat unchanged findings before resolving a specific remaining verification question.

`proc-78c8c7dfc5a5` separately ran candidate and ca4fd96c control:
`node --experimental-strip-types --test --test-name-pattern='linked scalar supported preservation: SELECT a,\(SELECT 42'
 test/conformance/select-linked-scalar-preparation-owner.test.mjs`.
The pattern selects5 controls: candidate4 pass1 fail, exit1; control5/5, exit0.
Failure: `SELECT a,(SELECT 42 WHERE 1 LIMIT 0.5) FROM t1` throws datatype mismatch20
instead of returning four rows. This is a supported scalar preservation regression,
not an unsupported new CTE/window test. Independent pinned C API reproduction
`proc-76e6d2f5f96f` checks exact sourceid, prepare0, rows
`[[1,42],[3,42],[5,42],[7,42]]`, terminal101 and finalize0.

Pinned expr.c3930–3957 sqlite3CodeSubselect explicitly replaces existing limit X
with `X<>0` using numeric affinity before SELECT admission, installs1 if absent,
and resets iLimit. Current compileWideSubquery prebuilds scalar LIMIT registers
whereas retained computeScalarLimitRegisters follows scalar conversion. Owning
repair must compare these branches (including NULL, zero, real, negative, OFFSET,
reset/first-error phase) and their consumers, not convert only literal0.5 or
remove MustBeInt. The scalar Boolean limit producer, not integer admission or
public test expectations, owns the missing rewrite.

Logs vector-verification/limit-candidate.log and limit-control.log.
Ordered scalar structural assertion and other28 broad reds remain unadjudicated;
no runtime integration or acceptance commit with known failure. Source pin and
peer staging unchanged. Verify outcome repair_needed.

## Scalar LIMIT handoff repair

Branch comparison found normalization was already emitted by compileWideSubquery.
The zero-source compileScalarSelect consumer ignored its caller's prepared LIMIT
and recompiled original X with ordinary MustBeInt. Fixed shared owner contract
(sharedLimit/scalarPrepared) and passed prepared registers to that consumer, as
inner-table destinations already do. Separately the retained no-FROM subquery
branch now requests scalar normalization and linked subquery compilation when
calling computeLimitRegisters. IN remains ordinary row-count admission; destination
initialization, early-zero guard, OFFSET, first-error ordering remain shared.

First hypothesis proc-278416f401b9 (retained no-FROM call alone) failed154/157 with
same three fractional-limit reds; typecheck did not run due fail-fast. Owning
consumer handoff repair proc-ab616f59abe9 passed157/157 preservation matrix,
typecheck and focused329/329. Added parameterized zero-source scalar/EXISTS
regression for real positive/negative, zero, numeric text, NULL error identity
through reset, rebind reuse, and IN real-limit rejection. proc-ab7707024184
passes158/158, public123/123 zero credit, bounded6, encoding3 and expression40.
The new control is UTF8; unchanged cross-encoding/vector lifecycle controls pass
but are not exhaustive internal UTF or specialized composition proof.
Broad proc-2e6c66f5ab8b exit1 remains recorded; log
vector-verification/limit-broad.log, not waived by focused green. No runtime
integration commit and no global milestone acceptance. Changed guide/map describe
single normalized scalar handoff; source pin/peer staging remain untouched.

## Verify: nested correlated scalar preservation still fails

No changed source inputs since repair. Reused158/158 scalar preservation,
329/329 focused/typecheck/public123 and expression gates only for their finite
coverage; unchanged broad5267/5237 pass25 fail5 skipped still blocks acceptance.
Verification question was whether remaining specialized integration reds are
pre-existing breadth or retained consumer regressions, not whether totals improved.

`proc-8e61697527c4` separately executes
`node --experimental-strip-types --test test/conformance/select-window-cross-layer-integration.test.mjs`
on repaired candidate and unchanged ca4fd96c control with identical test tree:
**candidate63/68 exit1, control68/68 exit0**. Five existing aggregate/window
integration consumers of nested scalar `(SELECT (SELECT q.a))` return NULL
instead of correlated integers3/7 (variants FILTER, nested WHERE/LIMIT0.5,
window argument and multiple windows). This is candidate-induced preservation
failure; no request for new window/CTE breadth. Logs
vector-verification/window-candidate.log and window-control.log.

Pinned resolve.c1389–1418 tracks NameContext.nRef across walking child SELECT,
sets EP_VarSelect and SF_Correlated; expr.c3873–3902 emits Once only for
uncorrelated subselect. Current compileWideSubquery builds childBinding using
outer binding.location and initializes destination/Once from linked correlation;
its zero-source child calls compileScalarSelect with linkedPlan and childBinding.
Repair must trace nested reference producer and binding/consumer handoff through
actual parent register substitution, correlated cache flags and Once/reset, not
patch NULL output or add SQL-text/window special cases. Current observations do
not yet distinguish which handoff loses q.a; do not present hypothesis as fact.

The ordered scalar structural assertion rejects any occurrence of hasOrderBy,
including dispatch guards; it is not by itself proof of runtime ORDER rejection.
Other broad reds remain unadjudicated. No runtime integration commit, source pin
and peer staging unchanged. Verify result repair_needed on concrete control.

## Nested correlated zero-source handoff repair

Read pinned resolve.c1389–1418 nRef/EP_VarSelect and expr.c3880–3900 Once
eligibility. Disposable trace proc-62309220d6e4 showed linked parent and nested
child both correlated=true and enclosing window-source q.a bound to register6;
only outer WIDE_TRACE appeared, no innermost linked binding. The simple fast
path required nonempty FROM, so linked zero-source child fell into retained
legacy no-FROM lowering, dropping its nested plan and outer register binding.
This was not erroneous resolver correlation or Once eligibility. Removed that
nonempty restriction while retaining physical-root checks for every actual
source and specialized shape guards. Empty source lists are admitted vacuously;
linked nested children now use shared scalar/childBinding lowering. No window
SQL special cases or new specialized producer breadth. Trace only touched
disposable candidate and was replaced by clean current source before tests.

proc-de5083164d23 focused window-integration/vector/select-scalar-child182/182,
including all previously failing5 and existing reset/lexical tests; typecheck pass.
proc-55533dd2bfd7 scalar preservation/new LIMIT controls158/158, public123/123
zero credit, expressions40/40, bounded6 and encoding3 passed. Final broad command
still exit1; nested-broad.log records remaining reds, not waived. Existing
window integration corpus is the regression coverage, not a new compatibility
credit. Guide/map now identify linked empty-source binding ownership. No runtime
integration commit; source identity and peer staging unchanged.

## Verify after nested binding repair — incomplete acceptance

No runtime changes. Workspace and candidate vdbe SHA256 both
807945e0c3142e3c60d98c95f3551b8d6ed9461f510eee6bc3a34f8e003b94c6.
Reuse immediately preceding focused182, preservation158/type/public123 and
expression40/bounded6/encoding3 only for unchanged finite paths. Remaining broad
17 reds include four CHINOOK_DB/setup files, branch-applicability/skipscan peer
checks and ordered scalar text assertion; dispositions remain incomplete.
`proc-0c926dd592d3` separately runs the unordered INNER LIMIT control in candidate
and ca4fd96c: both0/1 exit1 with maxWorkUnits, so not a new scalar regression;
this does not waive supported join budget failure or authorize repair here.
Same command's npm run test:package passed distributable/unpacked/browser-global
VM checks (not GUI browser).

`proc-7d3d96c25c5c`: fresh pinned row-vector native capture/cmp and duplicate
public123 byte-cmp passed, package-boundary passed (no runtime native/tool/fixture
imports/dynamic code generation). Final generated test path was incorrect and
failed 'Could not find'; not a test pass. `proc-54a298d9ee57` expression native
script failed missing evidence directory before running capture; subsequent gates
not run. After creating purpose-named work directory, `proc-d580ad3447e2` passed
fresh expression native exact cmp, manifest40/40 accounting with12 zero-credit
companions, parser generator/tokenizer34/34, build. No source changes or fabricated
native async/work-budget proof. Source pin unchanged.

No conclusive new in-scope failure independently established this node, but
meaningful full acceptance absent: remaining broad dispositions, missing reviewed
coherent runtime commit/exact committed archive, and historical stage2 admission
expectation discrepancy remain. Outcome coverage_gap rather than claiming done
from selected greens. Root must coordinate scoped integration and peer/setup
ownership; do not discard staged peers or widen joins/skipscan/window breadth.

## Added public ordered scalar handoff coverage

Verification left ordered scalar runtime coverage uncertain: existing structural
assertion bans routing guard text and is not a runtime ORDER proof. Added three
public API tests (UTF8/UTF16LE/UTF16BE) to
select-linked-scalar-preparation-owner.test.mjs. Each reuses one prepared SELECT
across real positive/negative LIMIT, zero, numeric-text LIMIT, ordinary OFFSET
and beyond-end OFFSET; asserts exact ordered INTEGER/NULL payloads on all four
outer rows, reset/rebind, NULL datatype-mismatch saved identity on reset and
successful reuse. No runtime edit, no assertion weakened, no breadth credit.

Pinned expr.c sqlite3CodeSubselect LIMIT numeric X<>0 and existing ordered Mem
first-row consumption motivate the cases; independent C API script asserts
exact source ID and runs six controls per encoding on identical fixture files,
retaining storage classes, terminal/finalize codes. proc-eae6768143c7 passes native
18 controls and expanded affected162/162. proc-10a8fcf79bb1 focused3/3 passes.
Commands: node --experimental-strip-types --test --test-name-pattern='ordered
scalar LIMIT handoff public reset/rebind' test/conformance/select-linked-scalar-preparation-owner.test.mjs;
expanded pattern adds linked scalar supported preservation, zero-source scalar
LIMIT and ordered scalar NULL LIMIT. Native command python3
$SAIVAGE_CARD_WORK_ROOT/ordered-coverage/oracle.py; script/output retained in
ordered-coverage/{oracle.py,native.json}; logs vector-verification/ordered-{coverage,affected}.log.

This bounds runtime ORDER/LIMIT handoff rather than certifying every specialized
sort-tail route or invalid OFFSET/error phase. Existing structural red and other
broad dispositions/integration-commit gaps remain outstanding. No full broad
rerun or milestone acceptance claimed. Source pin/peer staging untouched.

## Verify ordered coverage and structural disposition

proc-5b5537c91a4f full owning suite167 tests166 pass1 structural fail; repeat
new3 encoding tests pass and independent native18 recapture byte-identical.
Full suite red was overbroad source regex, not runtime ORDER rejection: shared
scalar emitter's fast unordered guard routes ordered children to its fallback
compileInnerTableSelect with destination and sharedLimit:preparedLimit. Physical
caller's separate value-list IN admission also contains hasOrderBy and was
misidentified as scalar bypass. Pinned select.c1838–1855 SRT_Mem leaves termination
to scalar LIMIT; traced current fallback into that shared destination owner.

Replaced blanket text prohibition with assertions against direct ORDER rejection,
required fallback shared SELECT destination/preparedLimit and physical scalar
sharedPhysicalScalar dispatch. Public three-encoding sorted winners plus parameter
LIMIT/error/reset controls remain independent behavioral gate, not a weakened
runtime expectation. First correction only handled emitter: proc-49497713ef49
still failed physical regex (later parent command prevented); recorded honestly.
Completed correction proc-27dcddbad241 owning167/167 and parent/window/vector182/182
pass. Runtime unchanged; tests/evidence edits only. Full broad rerun
proc-b70779c10ea0 recorded separately. No coherent runtime integration commit or
exact committed archive acceptance; remaining peer/setup/join-budget and historical
stage2 discrepancies not waived by structural correction.

## OFFSET admission/zero-LIMIT coverage

Previous ordered controls did not assert invalid OFFSET error ordering. Added
three-encoding public tests to owning select-linked-scalar-preparation-owner:
LIMIT0 skips NULL/fractional OFFSET admission, nonzero fractional scalar LIMIT
still rejects those OFFSETs at step with datatype mismatch20 and saved reset
identity, then negative OFFSET rebind recovers all four INTEGER7 winners.
Pinned select.c2517–2566 computeLimitRegisters emits zero jump before OFFSET
MustBeInt; expr.c scalar X<>0 does not normalize OFFSET. No runtime edits or
expectation relaxation. proc-927472c6b0b4 independent pinned C API15 controls
(five per encoding) passes with INTEGER/NULL and terminal/finalize distinctions;
script/native retained ordered-coverage/{offset-oracle.py,offset-native.json}.
proc-b11b2b436cc9 focused3/3 and full owning170/170 pass. Commands:
python3 $SAIVAGE_CARD_WORK_ROOT/ordered-coverage/offset-oracle.py;
node --experimental-strip-types --test --test-name-pattern='ordered scalar OFFSET
admission and zero-limit ordering' test/conformance/select-linked-scalar-preparation-owner.test.mjs;
then same --test without pattern. Logs vector-verification/offset-{coverage,affected}.log.

Coverage is selected ordered scalar admission and reset/rebind, not general
join/skipscan/window breadth, hard async interruption or all invalid OFFSET
productions. Remaining16 broad dispositions and scoped integration/committed
archive/stage2 gaps from prior verification unchanged; no broad rerun claimed.

## OFFSET verification and residual broad disposition

proc-fbb837e919a6 affected owning/window/vector/scalar352/352 pass; independent
native15 recapture exact cmp. Repeated full broad with CHINOOK_DB set to retained
SHA2567651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15
fixture:5288 total5271 pass12 fail5 skipped, exit1. Thus four previous setup reds
resolved by supplied input, not runtime changes or waivers. Command from candidate:
CHINOOK_DB=$SAIVAGE_CARD_WORK_ROOT/chinook-fixture/Chinook_Sqlite.sqlite node
--experimental-strip-types --test test/parser/*.test.mjs test/value/*.test.mjs
test/select/*.test.mjs test/conformance/*.test.mjs test/conformance/row-vector/*.test.mjs.
Log vector-verification/setup-broad.log, affected offset-verify.log.

Residual identical-test candidate/control comparison proc-7d11eeea58d1 / proc-94af8c6961d7:
38 tests26 pass12 fail versus27 pass11 fail. Eleven shared failures are unordered
INNER budget and skipscan/where peer execution or structure fixtures. One candidate
only red is historical review-v6 prepare-unsupported assertion for `(a,b) IN
((1,2),(2,2))` with forced t_abcd ORDER id. proc-f2b7ae89c52a public probe prepares
and returns exact expected INTEGER2,3 (branch-disposition/public.mjs); test matrix
itself contains those pinned rows. This is displaced unsupported admission after
vector implementation, not evidence of wrong returned values. Do not delete
historical provenance or claim planner credit: owning matrix/peer disposition still
needs coordinated update and source/native branch acceptance beyond this node.

proc-059968bc638b typecheck/build pass but nonexistent package-boundary.mjs failed;
corrected proc-27f99e7c0354 Python boundary pass plus expressions40/40, bounded6,
cross-encoding3 pass. proc-5553979102b0 scoped diff pass/runtime candidate identity
unchanged. No milestone completion: no reviewed integration commit/exact committed
archive; historical stage2 discrepancy and peer gates remain. New OFFSET tests are
meaningful and stable, not an invitation to add more arbitrary coverage instead
of resolving delivery/ownership gates.

## Displaced tuple-IN admission runtime coverage

Added test/conformance/tuple-in-displaced-admission.test.mjs to turn the previous
standalone public probe into durable assertion: digest/source-bound historical
prepare-unsupported SQL must prepare and produce exact typed INTEGER2,3, name id,
DONE repeated, reset replay, finalize and sibling reuse. It preserves original
review-v6 matrix/provenance and awards no index-strategy/planner credit. This is
coverage of admitted execution rather than forcing a failure against correct code.
proc-c88535e09d99 new1 plus owning170 =171/171 pass. Command from disposable candidate:
node --experimental-strip-types --test test/conformance/tuple-in-displaced-admission.test.mjs
test/conformance/select-linked-scalar-preparation-owner.test.mjs; log
vector-verification/displaced-admission.log. Independent fresh exact-pinned C API
proc-e86a2ca6abb8 confirms matrix rows/storage classes/DONE101/finalize0;
branch-disposition/{native.py,native.json} retained, command python3
$SAIVAGE_CARD_WORK_ROOT/branch-disposition/native.py. Pinned expr.c4029ff
sqlite3ExprCodeIN owns vector width/register and comparison admission; selected
index optimization is distinct from this result guarantee. Current guide's
linked vector/scalar width boundaries retained, no runtime or public scope change.
No historical matrix modification without coordinated peer disposition; its red
remains expected in the current broad test inventory pending that reconciliation.
The other eleven common residual failures and integration/committed archive/stage2
gates remain unwaived. New coverage is UTF8 fixture only (existing encoding gates
not claimed as this query's proof). Scoped diff pass; exploratory grep of nonexistent
expression.ts failed, not a validation result or evidence of runtime defect.

## Displaced admission verification

proc-3debc189d2bc affected353/353 pass and fresh native recapture exact cmp.
The new test is stable and meaningful for its UTF8 typed-result/admission/reset
boundary; it does not establish selected-index production or all encodings.
proc-3d7feeb8283e runtime/select-program candidate cmp and scoped diff pass;
exploratory nonexistent expression-program.ts grep failed (not acceptance).
Reuse preceding type/build/package/expression40/bounded6/encoding3 only for
unchanged inputs, not overall release.

Fresh broad proc-8130b52edbe7 using same digest-bound CHINOOK_DB:5289 total5271
pass13 fail5 skipped exit1. In addition to prior12 failures, JSON peer test
escape-dense backslash jsonb-label cancellation failed (undefined vs cancelled).
proc-8ae388082b98 focused JSON repeat fails; proc-a8511c5741db unchanged control
also fails. Thus no scalar integration-only regression established; peer JSON
cancellation remains real unwaived verification failure, not dismissed as green
or timing. Logs vector-verification/{displaced-verify,displaced-broad,
json-pretty-repeat,json-pretty-control}.log; native branch-disposition/verify-native.json.
Commands: affected --test tuple-in-displaced-admission + owning/window/row-vector/
select-scalar-child, independent native.py recapture/cmp; broad same parser/value/
select/conformance glob command as prior node; focused candidate/control --test
test/conformance/json-pretty-corrections.test.mjs.

No additional missing meaningful coverage identified in this bounded tranche.
Milestone acceptance requires resolving/reconciling existing peer failures and
historical unsupported matrix, plus coordinated runtime integration commit and
exact committed archive/stage2 checks. Repeated add-coverage cannot substitute
for those gates. Runtime/source identity and peer staging unchanged this node.

## Authorized scoped integration

Planner authorizes HEAD-relative runtime/test/docs dependency delivery without
requiring peer broad reds to pass. Preserve broad5289/5271pass/13fail/5skip and
all control evidence above; these are unwaived external regression inventory.
Reconciled historical review-v6 tuple-IN assertion: retain original matrix/history,
execute typed expected rows for its prepare-unsupported dimension without index
strategy credit. proc-0e43e1ba3dfa matrix passes; stage2 runner still exits1 on
capi3c-1.1 stale expected sqlite error at prepare. proc-3d251a403103 candidate and
unchanged control empty fixture both prepare SELECT name FROM sqlite_master,
metadata name/TEXT/main/sqlite_master/name then DONE. proc-88c6757b73d2 independent
pinned C API prepare0/DONE101/finalize0. Classify stale stage2 harness expectation,
not vector regression or actual schema failure for this query; route broader stage2
expectation refresh to root, no general schema compatibility inference.
Scoped tree derived from reviewed candidate, not peer index; ordinary worktree
and index peer edits preserved. Exact commit/archive results recorded below.
