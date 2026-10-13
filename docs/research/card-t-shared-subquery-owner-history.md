# Revision-bound shared-subquery repair history

Superseded dispositions below are historical evidence, not current contracts.
Current authority: [owner decision](card-t-shared-subquery-owner-decision.md).

# Shared subquery owner decision — partial repair, remaining linked owner work

[[card:card-t-c]] source-owner handoff to [[card:card-i]]. This is **not approval of
the complete three-file candidate**. HEAD remains
`ca4fd96c2ab4675d6a2ebd231b80770eef79899c`; no commit/staging/ref change.

## Actual disposition

INCLUDE the atomic destination correction in `src/internal/select-program.ts`:
validate positive safe-integer count and Mem/Set width, count equality and complete
valid affinity vector **before any opcode**. Accept all existing MemAffinity values,
including flexnum. Invalid internal construction raises JSQLiteError internal;
SQL consumer mismatch still belongs to the public resolver's sqlite code1 owner.
Removed superseded late RangeError guards. Preserves contiguous Mem copies and
Set field affinities/insertion, Exists BOOLEAN destination, Once/correlation and
first-row/NULL initialization in unchanged callers.

BEFORE: Set width2/count1/affinity[text] emitted Affinity then RangeError.
AFTER: no op emitted, typed internal error. Six boundary tests preserved and pass;
three existing subquery consumer tests pass. This is only9 focused tests, not the
public123 corpus, nor star/provenance/offset acceptance.

Pinned comparison: select.c selectInnerLoop SRT_Set requires affinity count equal
nResultCol before record production; SRT_Mem copies contiguous fields. expr.c
exprVectorRegister/codeVectorCompare consume original semantic field expressions
and prior SELECT result registers; sqlite3CodeSubselect owns NULL Mem versus
INTEGER0 Exists and Once/first-row control. Atomic validation cannot establish
resolved field provenance or child consumer width on its own.

## Explicit remaining work (not accepted)

Resolver reductionWidth/result.length still conflates syntactic star width,
scalar1/vectorN and EXISTS no-projection-width contexts. compileWideSubquery still
uses unbound reductions for field semantics/OFFSET and plan-less fallback permits
insufficient correlation evidence. No global expected-width relaxation or register
provenance inference approved. Next useful correction is a linked context-specific
child carrier with expanded result fields and original resolved expressions,
consumed by actual comparison/IN dispatch and OFFSET binding; native-first public
star/provenance/offset discriminators must precede that implementation. This work
remains unsatisfied; bounded destination correction does not waive it. Full guide,
API/audit/source-map affected claim reconciliation remains pending that evidence.
Original i integrator retains final assembly. Peer STRICT/STAT4/bitwise/schema/docs
and3081 staged inversions remain untouched. No architecture/release approval.

## Materially informed second attempt: LIMIT/OFFSET semantic owner

Pinned resolve.c1909–1917 explicitly resolves LIMIT/OFFSET in an empty
NameContext: a correlated column is **illegal**, not something to bind to the
outer cursor. Added that pre-source validation to expandAndResolveSelect instead
of adding a guessed OFFSET binding. Independently source-ID-asserted native-first
prepare checks give code1, no statement and exact messages `no such column: p.a`
for both child LIMIT and OFFSET, and `no such column: missing` for unbound OFFSET.
Public regression fails across all three encodings before repair; runner remained
alive after failed cases and was killed (not a clean exit1). After repair guarded
typecheck and nine focused tests pass, including two prepares per new error per
encoding plus the prior consumer/reset/NULL/Once tests. No whole corpus credit.

Evidence `work:///cards/card-t-c/shared-subquery-offset/`: native.log (proc-79f4b5b7f31b
exit0), public-red.log (proc-676c5498f8f5 killed after three observed failures),
type.log/green.log (proc-d793cf6261be exit0). Threepath-after.patch SHA256
`db89fabe0657782ae9e221e4270bab6c97f50cd9001ed4b404a9acad7e544a5c` includes
prior peer candidate, NOT wholepath integration permission. Index cmp0 and HEAD
unchanged (proc-7fba736be726). Guide replaces false general expanded-star claim;
source map adds actual owner/tests. Scalar/vector/EXISTS carrier/provenance work
remains red; this resolves the OFFSET *name* policy, not nested clause-plan
lifetimes or generic LIMIT expression subqueries.

## Third attempt: EXISTS expanded projection

Native-first independently pinned3 encodings × unqualified/qualified/empty star
EXISTS all return INTEGER1/0. Public BEFORE correction3/3 fail (clean exit1).
Resolver now carries `expectedWidth:null` specifically for TK_EXISTS presence;
fully expands/resolves projection but imposes no syntactic projection width.
All other consumer constraints retained; this is not global relaxation. Pinned
expr.c sqlite3CodeSubselect allocates one register for EXISTS versus EList.nExpr
for SELECT; select.c SRT_Exists emits INTEGER1 independent of nResultCol.

`work:///cards/card-t-c/shared-subquery-exists/`: native.log proc-c5165c11fbb9
exit0, red.log proc-5579c6954e80 exit1, type.log/green.log proc-3f88229e6daa
exit0 type0/focused9/9 (existing test names, expanded assertion matrix). Reset,
replay, typed rows and result name checked for every added star case. Fresh index
cmp0/HEAD unchanged and diff-check pass; threepath.patch SHA256
54fba8f9a895499dc0ed68074115369aef4bf2156036e491b2a37cc4fd64cb42.
This establishes EXISTS context only, not scalar1/vectorN expanded provenance.

## Fourth attempt: linked original SELECT field carrier (partial)

ResolvedExpressionCarrier now retains the linked nested ResolvedSelect by semantic
SelectNode identity. Binder carries it on scalar/IN subquery nodes; expression
vector width and SELECT-vector comparison register fields use expanded linked
results and existing resolvedExpressionAffinity/Collation owners, not reparsed
unbound column trees. compileWideSubquery prefers the expression's linked plan.
The source expr.c exprVectorRegister/codeVectorCompare consumes regSelect+i while
retaining original field expression semantics; this is the bounded TS carrier.
Unlinked fallback remains for existing source-free callers, explicitly not general
provenance acceptance. Resolver consumer-context and IN field derivation/dispatch
are still incomplete: **not approved full replacement**.

Native-first pinned control compares table-column SELECT vectors against CAST text
and IN; both INTEGER1. These controls already passed BEFORE this attempt and
therefore are preservation tests, not reproduced red provenance evidence.
Three-encoding public names/types/reset/replay checks remain green. Trial typecheck
failed duplicate imported owner names; removed duplicate added import. Final
guarded type0/focused9/9/diffcheck/indexcmp0: proc-b4e3ee99e925 exit0. Evidence
`work:///cards/card-t-c/shared-subquery-provenance/` native.log/red.log (actually
pre-repair PASS)/type.log (failure)/type-final2.log/final2.log/threepath.patch
SHA256a922e0cbe21dad80c11822b7ab097dc8c65b41f32fdacd1c599856450d8c22ca.
No claimed star/collation discriminator red, lifetime or broad corpus acceptance.
Next concrete attempt must complete resolver width consumers and IN original-field
production and test a discriminating star/collation case through actual callers.

## Fifth attempt: expanded-star consuming path

Native corrected three-column pairs star comparison/IN FIRST: INTEGER1/1
(source ID asserted). Initial oracle hypothesis mistakenly compared star3 to
explicit2; native prepare correctly code1 expected3; shell without set-e masked
Python assertion with final cat exit0, NOT credited. Corrected guarded capture
proc-1be7a2d4965d exit0. Public new permanent controls BEFORE repair
proc-3b7c0b0bda0f exit1: 0/3, all encodings fail.

resolveAgainstSources now records nested expanded widths during operand descent;
IN compares RHS against resolved LHS width, not star token count. Nested SELECT
resolution does not impose a scalar width before its consuming comparison is
known. compileScalarSelect uses linked binder even without an outer binding so
original SELECT plans actually reach no-FROM operand generation. Wide producer
uses resolved result descriptors/owners for IN field semantics; no undefined star
reduction parse, and collation names normalized at runtime boundary. Relevant
upstream expr.c sqlite3ExprVectorSize509, exprVectorRegister659 (original field
plus regSelect+i), resolve.c TK_SELECT/TK_IN1392 were read. Scalar1 resolver
context still incomplete; this does NOT globally authorize vector scalar results.

Distinct observed trials: type0 then TypeError undefined star reduction (trial.log);
incorrect resolvedResultColumn signature/exact optional construction type2 fail;
corrected descriptor signature then invalid KeyInfo uppercase collation (trial3);
normalized boundary collation. Final proc-0b56e48772d9 exit0 type0/focused9/9;
proc-6547a3462451 exit0 row-vector10/10/diffcheck/indexcmp. No broad metadata,
resource, correlation-composition or release credit. Evidence under
`work:///cards/card-t-c/shared-subquery-star/`: native-corrected.log, red.log,
type2.log, trial.log/trial3.log/trial4.log, row-vector.log, threepath.patch
SHA2566c36fbe2f67c38dea6d9b10f5233f06ad53eae040e79e7982c3681a02b564724.
Remaining useful next attempt: enforce scalar1 at resolver consumer contexts and
extend joined/aggregate linked dispatch, source-based collation discriminators and
resource/lifetime proof. Integrator retains assembly; this is still partial.

## Sixth attempt: expanded field affinity discriminator

Pinned native-first star versus zero-prefixed TEXT primary key equality yields
INTEGER1 (proc-9ba1ba93ea50 sourceid asserted); public red2.log clean exit1
0/3 gives INTEGER0. Earlier CAST controls already passed (red.log), preservation
only. expr.c659–687 returns both original pEList field and regSelect+i;
codeVectorCompare737–754 consumes these, so losing star semantic affinity is a
translation divergence. SELECT comparison fields now obtain original expanded
column affinity/collation, case-normalized; rowid/IPK represented columnIndex=-1
retains INTEGER affinity like existing resultAffinity resolve.ts739. The first
column-descriptor-only attempt still failed because -1 has no ColumnNode;
final fixes owning semantic field production for comparison and IN together.

Guarded proc-66f04d0b58b3 exit0: type0, row-vector+atomic16/16, diffcheck/indexcmp0.
Evidence `work:///cards/card-t-c/shared-subquery-affinity/` native.log,
native-discriminator.log, red.log (PASS),red2.log (FAIL),final.log (failed first
repair),type2.log,final2.log,threepath.patch
SHA256ac65b8c286182a99ddd2b7bd4dd7bb04666c7e21a60454107bbdbcbd12d31a10.
Added permanent three-encoding public name/type/reset/replay controls. No broader
scalar-context/resource/lifetime approval; remaining consumer-context and dispatch
work from fifth attempt remains. No staging/ref/index changes.

## Exact evidence

`work:///cards/card-t-c/shared-subquery-owner-red/` snapshots HEAD/ref/index/staged
and dirty status and before threepath patch65fbeda577d7dd5a720f1ee2d26ca6deb3bc3e54dfaacb931ae99b3b96e563e0.
`work:///cards/card-t-c/shared-subquery-owner-repair/`:
- builder-head-to-work.patch SHA2569dca0f46762c0b3af7338e54cb6a82ec95cdfeb4af2ef1bf56698ad792789f5d
  (contains prior m builder additions; do not blindly stage whole shared path).
- threepath-after.patch SHA256ba6c43b2e9fa7c4d8c197a14a269d268f7ae13d770d53df1503f41a93dde70b2.
- index-after.bin exactly compares original index-before.bin; HEAD unchanged.

Commands: `node_modules/.bin/tsc --noEmit`; `node --experimental-strip-types --test
test/conformance/select-destination-atomic.test.mjs
test/conformance/row-vector/subquery-consumers.test.mjs`. Guarded proc-8c45bb797717
exit0: type0,9/9 no skip/cancel/fail. RED atomic test exit1 and observed partial-op
probe retained, not erased. Detailed records in current card status. This partial
handoff is **still red for complete requested linked-width/provenance slice**.

## Seventh attempt: scalar consuming error owner

Pinned expr.c sqlite3VectorErrorMsg3505–3523 distinguishes SELECT vectors
(`sub-select returns N columns - expected 1`) from ordinary vector misuse.
Native-first proc-712c5e98a740 confirmed star3 naked/function/arithmetic prepare
code1/no statement. Public before repair proc-32198f1dd133 timeout124: leaked
successful statement led to close BUSY5; not credited a clean failure.
Owning compileExpressionTree scalar consumer now checks linked expanded width
before calling/publishing child producer and emits native diagnostic. Arithmetic
operators use scalar vector-error ownership; actual comparison width mismatch
still emits row value misused. First trial type0 but10/16 due stale lifecycle
expectation and arithmetic comparison routing; updated expectation and corrected
operator semantic owner. Final guarded proc-15e34dc6821e exit0 type0/16 of16,
diffcheck/indexcmp0. Evidence work:///cards/card-t-c/shared-subquery-scalar/:
native.log,red.log(timeout),final.log(fail),type2.log,final2.log,threepath.patch
SHA256b731c7330d6a426200196ff009a95c788f50d267b57634ee335d44753c2a3e53.
No resolver-complete scalar1 claim; other specialized caller dispatch/lifetimes
remain. No staging/ref/index changes; integrator retains assembly.

## Eighth attempt: joined linked dispatch and star production

Native-first pinned proc-efb89001b831 joined EXISTS star and SELECT star vector
comparison INTEGER1/1. Permanent three-encoding public RED proc-4a7a03d91ba0
exit1 unsupported temporary. Shared joined/physical emitter dispatch now considers
linked expanded width, not result token count. Initial dispatch-only trial type0
failed internal missing expression tree: owner expressionBinding had incorrectly
preempted resolved star column production. Result loop now uses linked expression
binding only when a reduction exists, otherwise existing synthetic resolved column
carrier path (columnAccess/cursorFor) owns star production. No reparsing or guessed
cursor, new evaluator or blanket drop of binding. select.c selectInnerLoop1170–1197
allocates by expanded EList count; expr.c exprVectorRegister659 retains column
semantics. Final proc-3f87cbe0d50b guarded exit0 type0/16 of16;
proc-4f80d2a00b8c guarded diffcheck/indexcmp0. Evidence
work:///cards/card-t-c/shared-subquery-joined/:native.log,red.log,final.log
(dispatch-only failed),type2.log,final2.log,threepath.patch
SHA2561cca815a05fcaa80cb4dd0011ccdf33914f6bbc57c4073c776fc2ebd68a6a383.
Physical emitter condition updated coherently, but aggregate/physical broader
compositions not independently demonstrated. Missing-plan/correlation/lifetime,
resolver-complete admission, full metadata/resources and assembled corpus remain.
No staging/ref/index change; integrator assembly authority unchanged.

## Ninth attempt: correlated aggregate EXISTS projection independence

Native-first proc-25dfd6e21e22 correlated joined star EXISTS [1,0,0,0] and
IN [1,1,NULL,1]; public before already3/3 PASS (red.log despite name), evidence
of preservation not repair. Native-first proc-14e19fa16a96 aggregate sum correlated
star EXISTS INTEGER1; public red2.log proc-83fbae2576c1 clean exit1 unsupported
all encodings. Aggregate EXISTS admission wrongly required a projection reduction.
Removed that requirement at compileAggregateSubquery; other shape admission and
linked WHERE/outer AggInfo-phase binding unchanged. select.c1202–1209 deliberately
does not code result expressions for EXISTS;1412–1416 emits INTEGER1 and LIMIT
termination. Thus star/no-reduction is not an unsupported projection shape for
this branch; actual result resolution still occurs upstream in resolver. No new
evaluator or rewrite of existing specialized equality semijoin branch; that branch
is not the demonstrated AND correlation repair and remains separately reviewable.

Guarded proc-01949293fffc type0/16 of16; stdout partial read its returned artifact
for final totals. Guarded proc-80bd47ec64a6 diffcheck/indexcmp0. Commands tsc
--noEmit; timeout12 node --experimental-strip-types --test row-vector/*.test.mjs
plus select-destination-atomic.test.mjs; scoped diffcheck and index compare.
Evidence work:///cards/card-t-c/shared-subquery-correlated-join/: native.log,
native-aggregate.log,red.log(PASS),red2.log(FAIL),type.log,final.log,threepath.patch
SHA2567199ee4bbde1a22ecefaeec3156200bc5c96cb3f5399a8bbe3d75ff9add0da85.
Joined two replay passes include empty transition, INTEGER/NULL distinctions.
No global lifetime/budget/full metadata or aggregate algorithm fidelity approval.
No staging/ref/index change; original unresolved task boundaries remain.

## Tenth attempt: wide table compound silent partial compilation

Native-first proc-93b57e6a78d3 wide aggregate comparison/EXISTS INTEGER1/1,
wide table UNION ALL first-row comparison INTEGER1. Public aggregate controls
already pass; compound returns INTEGER0 clean exit1 proc-89c247edc12d and
proc-69958efd61ce with SQL-named assertion. Branch comparison: compileWideSubquery
sends source-bearing child to compileInnerTableSelect regardless of compound
arms; pinned select.c multiSelect composes arms, not a terminal-arm table loop.
Existing compileSimpleTableCompound restricts one result field/no WHERE and is
not an implementation of this missing wide branch. Added early typed temporary
rejection before destination/op publication, preventing silent terminal-arm
execution. This is an honest containment repair, NOT native row parity or completed
compound composition. Permanent repeated public prepare/finalize/close guard,
plus aggregate preservation controls across three encodings.

Guarded proc-7440bdc2da1c exit0 type0/16 of16/diffcheck/indexcmp0; commands tsc
--noEmit; timeout12 node --experimental-strip-types --test row-vector/*.test.mjs
plus select-destination-atomic.test.mjs; scoped diffcheck/index compare.
work:///cards/card-t-c/shared-subquery-wide-aggregate/:native.log,red.log,red2.log,
type.log,final.log,threepath.patch
SHA25680a1bd73bad2aa131dec0f6c2b971416d27bc348b2a4b46eb10e2e2ddb3bb10e.
Concrete next implementation: linked per-arm UNION ALL composition sharing
Mem destination and LIMIT/OFFSET, with stop after first qualifying arm, preserving
correlation binding and prepublication admission. Wider set operators remain
separate source branches. No staging/ref/index change or compound support claim.

## Eleventh attempt: bounded linked UNION ALL arm composition

Replaced tenth containment for source-bearing unordered nonaggregate UNION ALL
Mem/EXISTS with linked per-arm producers. Each arm uses its own resolved source
cursor mapping and outer binding; shared destination and scalar count/OFFSET pass
across arms, IfNot count skips later arms after first qualifying row. Matches
select.c multiSelect TK_ALL3020–3058 left sqlite3Select then shared destination/
iLimit/iOffset and right-arm skip. No manual PC copying or reparsing resolution.
Admission occurs before publication: all arms linked, source-bearing, equal
expanded width, nonaggregate/nondistinct/nongrouped; ORDER BY, set operators,
wide IN and mixed source-free arms remain typed temporary. This bounded branch
is not a new algorithm substitution or general compound support.

Tenth native RED is reused with unchanged SQL/source fixture; restored positive
native parity test instead of temporary expectation. Native-first additional
proc-8129136b1336 empty-left/right continuation INTEGER1, OFFSET across arms
INTEGER1, both-empty EXISTS INTEGER0. Three encodings/two replays public controls.
Guarded proc-f9b39afc0cf2 type0/16 of16; proc-ff366d45388d final expanded16 of16,
diffcheck/indexcmp0. Commands tsc --noEmit; timeout12 node --experimental-strip-types
--test row-vector/*.test.mjs + atomic test; scoped diffcheck/index compare.
work:///cards/card-t-c/shared-subquery-union-all/:type.log,final.log,native.log,
final2.log,threepath.patch SHA25686ccdbeffb69c16c8cffb087b95b40c5ee54a2f2b2fca59eb9573b6999818fa0.
No staging/ref/index changes or full candidate acceptance. Correlated compound
lifetimes/metadata/resources and other admitted specialized callers remain owed.

## Twelfth attempt: UNION ALL Set producer budget

Native-first proc-1a86085da24b captured IN RHS UNION ALL LIMIT1 OFFSET1 INTEGER1,
LIMIT1 INTEGER0; public proc-70f92350c339 clean unsupported exit1 all encodings.
Reuse linked arm composition for Set after removing Set exclusion. Unlike Mem/
EXISTS, Set obtains actual child LIMIT via computeLimitRegisters, shared across
arms; unlimited Set has no budget or arm-stop. Left SELECT consumer remains
outside RHS Once. Source comparison select.c3020–3042 passes destination,
iLimit/iOffset to next arm and guards it when count exhausted. No scalar LIMIT1
normalization for Set; semantic destination distinction preserved.

Native-first proc-55465912bafb correlated second-arm RHS/left SELECT [1,1,NULL,1];
public three encodings/two replays passes. Guarded proc-e2c8fe61e9cf type0/16 of16/
diffcheck/indexcmp0; final expanded proc-1ebe953fafad16 of16/diffcheck/indexcmp0.
Commands tsc --noEmit; timeout12 node --experimental-strip-types --test
row-vector/*.test.mjs + select-destination-atomic.test.mjs; scoped diffcheck and
index compare. work:///cards/card-t-c/shared-subquery-union-set/:native.log,
native-correlated.log,red.log,type.log,final.log,final2.log,threepath.patch
SHA256b08012ac2145ace684b5f9658d98b5e79724d63d0629c057a1460bca6dfa9161.
No staging/ref/index changes. Source-specialized constraints still gate ordered,
set operators, mixed source-free/grouped/aggregate arms; broader collation,
metadata/error/resources and assembly verification remain owed.

## Thirteenth attempt: original SELECT field EP_Collate provenance

Native-first proc-c60749fb8fbb no-FROM explicit BINARY/NOCASE controls and
proc-17e59aa616c5 table NOCASE controls already pass public (proc-fddf0f75593b,
proc-c6baef1bee07); red.log/red2.log are preservation PASS, not reproduced gaps.
Discriminator proc-3362c0b918bc pinned b column NOCASE vs right upper(b) COLLATE
BINARY yields INTEGER0 for comparison and IN. Public proc-1abf62e66502 clean
exit1 INTEGER1 across encodings. Original-field register production retained
collation name but lost explicit ownership. expr.c659–684 selects original
pEList fields; sqlite3BinaryCompareCollSeq424–442 prioritizes EP_Collate on left,
then right, before derived column collation.

Comparison field and Set semantic field now retain explicit COLLATE using
existing collate carrier wrapping the shared register, derived from original
resolved reduction with existing explicitCollation owner. No SQL reparse or
second evaluator, no changed register allocation/KeyInfo/Mem. This fixes both
consumers together rather than a BINARY example override.

Guarded proc-008e38889de9 type0/16 of16/diffcheck/indexcmp0. Commands tsc --noEmit;
timeout12 node --experimental-strip-types --test row-vector/*.test.mjs + atomic
test; scoped diffcheck/index compare. work:///cards/card-t-c/shared-subquery-collation/:
native.log,native2.log,native3.log,red.log,red2.log,red3.log,type.log,final.log,
threepath.patch SHA256137a8ef1c63270fed79b82dee64d3e125e42af531cc8933228b860b797697346.
No staging/ref/index changes. Aliased/deferred explicit propagation and broader
resource/lifetime/full metadata/oracle corpus remain separate unproved branches.

## Fourteenth attempt: scalar SELECT affinity semantic owner

Native-first proc-aac9de5af7a0 scalar b/upper(b) comparison INTEGER0 preservation
(no automatic scalar SELECT collation propagation); numeric scalar a compared to
'01' INTEGER1. Public RED proc-99a55414156c numeric INTEGER0 all encodings exit1.
expressionAffinity omitted scalar SELECT, unlike pinned expr.c48–65 TK_SELECT
recursing to original first EList expression. Now linked scalar SELECT obtains
first resolved expression affinity (expanded column/IPK fallback); unlinked
source-free reduction uses existing expression representation. EXISTS remains
unaffine. This changes comparison semantic owner, not child execution or register
allocation, and is not scalar collation propagation (which native rejects here).

Guarded proc-deddc3198a20 type0/16 of16/diffcheck/indexcmp0. Commands tsc --noEmit;
timeout12 node --experimental-strip-types --test row-vector/*.test.mjs + atomic
test; scoped diffcheck/index compare. work:///cards/card-t-c/shared-subquery-scalar-field/:
native.log,red.log,type.log,final.log,threepath.patch
SHA2563075e384a6e3b0cbcfa8f461c0d8e93f5aadeb68f77820b1c4a489495ecb428e.
No staging/ref/index changes. Broader scalar CAST/compound/alias affinity and
consumer resolution admission/lifetime/resource/metadata remain unproved.

## Fifteenth attempt: linked scalar table child inside vector producer

Native proc-765e3b2ca054 disproved leftmost compound-affinity hypothesis: terminal
TK_SELECT EList TEXT gives0, numeric gives1. No resolver carrier switch made;
permanent preservation controls match. Native proc-ee255963ea39 expanded-derived
nested scalar numeric gives1; public proc-db2f2ac43d87 unsupported exit1. Narrowed
native proc-478c0f59300a ordinary nested scalar table child also gives1; public
proc-911fcc608f1d unsupported exit1. compileScalarSelect's nested consumer only
sent width>1 to linked table producer; width1 fell into constant-only fallback.
Route linked source-bearing scalar child to existing shared destination producer,
using its resolved plan and builder. This is expr.c sqlite3CodeSubselect Mem1
calling sqlite3Select, not a separate evaluator or numeric example patch.

Ordinary nested scalar vector regression now passes all encodings/two replays;
expanded-derived shape not revalidated or claimed. No C-to-TS full correlated
binding acceptance. Guarded proc-64ecbc8d5cf9 type0/16 of16/diffcheck/indexcmp0.
Commands tsc --noEmit; timeout12 node --experimental-strip-types --test
row-vector/*.test.mjs + atomic test; scoped diffcheck/index compare.
work:///cards/card-t-c/shared-subquery-compound-affinity/:native.log,native2.log,
native3.log,red.log,red2.log,type.log,final.log,threepath.patch
SHA2563accc17cebf689d6a5cd2dbe4c9fa47461ea6c424df608154f7d0e0b9a9a27c4.
No staging/ref/index change. Derived/correlated binding/lifetimes/resources,
consumer admission and full corpus/contracts/maps still owed.

## Sixteenth attempt: nested scalar enclosing binding

Native-first proc-b060b01221a2 nested correlated scalar inside vector SELECT
compared to outer p.a gives [INTEGER1,INTEGER1,NULL,INTEGER1]. Public
proc-4b1a82ade754 clean exit1 TypeError reading undefined location all encodings.
Caller compileScalarSelect forwarded undefined binding to shared table child;
resolver had retained outer identity but emitter lost its physical location.
Compare resolve.c1967–1980 local sNC.pNext=pOuterNC and expr.c3950–3962 shared
sqlite3Select destination invocation: enclosing context must survive the child.
Now capture enclosing expressionBinding before nested consumer's local owner
shadow, forward to both linked width1 and wide dispatch. Child still remaps its
own local source cursor before delegating outer references. No cursor guesses,
SQL special case, global fallback or evaluator.

First trial proc-2da990e729ae exit2 type errors: nested local owner shadows outer
parameter, so direct owner reference hit TDZ. Corrected capture before closure.
Guarded proc-83d44570e39d type0/16 of16/diffcheck/indexcmp0. Permanent3 encodings/
two replays preserves NULL transition, correlated recomputation and lifecycle.
Commands tsc --noEmit; timeout12 node --experimental-strip-types --test
row-vector/*.test.mjs + atomic test; scoped diffcheck/index compare.
work:///cards/card-t-c/shared-subquery-nested-binding/:native.log,red.log,type.log,
type2.log,final.log,threepath.patch
SHA256e780469cead7cce6257d4e1abdd175aeeeade3762f4012e7e3ff0caac2f142d4.
No staging/ref/index changes. Derived sources, missing-plan paths, full scalar1
resolution admission and broader metadata/resource/corpus evidence remain owed.

## Seventeenth attempt: compound arm width resolution

Previously captured expanded-derived scalar now PASS proc-513aeea537e0; native
correlated expanded-derived proc-b4590a194279 [1,1,NULL,1] also PASS public
proc-1850bd4d3301. These are preservation evidence, not new defects/repairs.
Source-first resolve.c2095–2102 checks adjacent expanded EList widths regardless
of consumer. EXISTS correctly ignores projection width but not invalid compound
arm widths. Native proc-f7772ce7b8a5 prepare code1/no statement exact UNION ALL
width error. First native proc-f7c70ff246d6 failed capture (errmsg ctypes restype
missing), rerun fixed harness. Public RED proc-c6d36431f9d9 exit1 mismatched error
(temporary producer rejection). Nested resolver now compares linked expanded
arm counts before publication and raises source select.c3076–3083 diagnostic,
including operator/VALUES routing. No consumer EXISTS relaxation or opcode work.
Scalar consumer diagnostic precedence and VALUES/mixed operator branches still
need broader independent tests; not claiming full compound error parity.

Guarded proc-0d31d3dd4a72 type0/16 of16/diffcheck/indexcmp0; permanent repeated
prepare/exact code/message error checks all3 encodings. Commands tsc --noEmit;
timeout12 node --experimental-strip-types --test row-vector/*.test.mjs + atomic;
scoped diffcheck/indexcmp. work:///cards/card-t-c/shared-subquery-derived/:
native.log,native-width.log(failed capture),native-width2.log,red.log(PASS),
red2.log(PASS),red-width.log(FAIL),type.log,final.log,threepath.patch
SHA2560e14995bd99a1daa386865165c422a2bc3307cee134883b4fd25f360cbff7942.
No staging/ref/index change. Missing-plan, scalar admission/error ordering,
full lifetime/resources/metadata/broad corpus/contracts/map reconciliation owed.

## Eighteenth attempt: producer validation before consumer arity

Native-first proc-b91a8877bc5e mismatched compound scalar/IN1 both prepare code1
no statement compound UNION ALL diagnostic; valid-width2 scalar consumer gives
sub-select returns2 expected1. Public proc-5ca70e00a81a clean exit1 consumer
width error before compound structural error. Source resolve.c2095–2102 resolves
compound ELists/validates adjacent counts before expr.c consumer arity/codegen.
Move nested expectedWidth admission after linked compound resolution/validation,
before nested publication. No error-catching substitution or SQL-text dispatch.
Permanent repeated prepare exact messages/code1 all3 encodings includes scalar,
IN and valid compound scalar rejection; focused tests pass.

Guarded proc-24f34c595a62 type0/16 of16/diffcheck/indexcmp0. Commands tsc --noEmit;
timeout12 node --experimental-strip-types --test row-vector/*.test.mjs + atomic;
scoped diffcheck/indexcmp. work:///cards/card-t-c/shared-subquery-width-order/:
native.log,red.log,type.log,final.log,threepath.patch
SHA256af72cf3f4563b63115e05beddf73406d2b11ea32d3f49ccf28e6a6e453a04b30.
No staging/ref/index changes. Multiple invalid-arm/name error ordering, VALUES,
missing-plan/scalar admission, resource/metadata/broad corpus and handoff remain.

## Nineteenth attempt: packed VALUES EList width validation

Native-first proc-143b26d34bee VALUES(1),(1,2) EXISTS/IN prepare code1 no statement
all VALUES same terms; SELECT1 UNION ALL VALUES(1,2) same VALUES error, reverse
order UNION ALL arm error. Public proc-a0eb7e8bb34f exit1 temporary unsupported
for packed unequal VALUES rows. width validation from parse.y/insert.c sqlite3MultiValues (constant coroutine
route checks pRow width directly; nonconstant route falls back to linked
SF_Values SELECTs) is retained by parse.ts valuesRows. Nested resolver had checked only arm.result, losing packed adjacent row widths.
Now validates packed rows against their arm result before nested admission and
publication; existing expanded compound checks preserve mixed-arm diagnostics.
No new emitter, SQL specialcase or consumer width relaxation. Multi-invalid-name
vs packed width ordering remains unproved; top-level nonnested VALUES owner and
complete later-row expression resolution are not claimed by this bounded repair.

Guarded proc-2767f191af89 type0/16 of16/diffcheck/indexcmp0; permanent repeated
prepare/exact code/message3 encodings. Commands tsc --noEmit; timeout12 node
--experimental-strip-types --test row-vector/*.test.mjs + atomic; scoped
resolve diffcheck/indexcmp. work:///cards/card-t-c/shared-subquery-values-width/:
native.log,red.log,type.log,final.log,threepath.patch
SHA256610e7f227ecedda181cf3e33f3d439dfda8adce9836b23ad50ce296f42dd3f50.
No staging/ref/index changes. Remaining later VALUES-row name/expression linkage,
missing-plan/scalar admission/resources/metadata/broad corpus/handoff owed.
Source comment corrected after reading insert.c679–786 dual coroutine/fallback
branches; code unchanged, prior type/tests apply. Final comment-inclusive patch
SHA25625d0841766f5e531bf29e1fe2951127d7997198e118d940c87236e885e317a2e
replaces preceding pre-comment artifact hash.

## Twentieth attempt: later VALUES row resolution

Native-first proc-c5f3df261770 later missing column VALUES(1),(missing) in
EXISTS/scalar/IN prepare code1/no statement exact no such column. Public RED
proc-13c83787342f timeout124 (not clean failure). Hardened expected-rejection
closure finalizes any unexpected statement; proc-22aa609d0469 still timeout124.
Thus unexpected statement cleanup alone did not resolve the RED hang; its exact
runtime cause remains undiagnosed. Source insert.c679–705 nonconstant row uses
linked SF_Values SELECT and resolve.c1967–1982 resolves each EList against outer
NameContext; TS packed rows were only width checked, later expressions omitted.
Resolve every later packed row with linked parent context and retain column/nested
identities and correlation in child carrier before consumer admission/publication.
No EXISTS evaluation of unused projection added. Native errors now public exact
code/message repeated prepare3 encodings; full gate passes.

Guarded proc-e7596d18a41f type0/16 of16/diffcheck/indexcmp0. Commands tsc --noEmit;
timeout12 node --experimental-strip-types --test row-vector/*.test.mjs + atomic;
scoped diffcheck/indexcmp. work:///cards/card-t-c/shared-subquery-values-names/:
native.log,red.log(timeout),red2.log(timeout),type.log,final.log,threepath.patch.
Later-row correlated execution/alias/AggInfo/window binding and compound row
producer propagation remain unproved. No staging/ref/index change or broad
candidate acceptance; missing-plan/resource/metadata/corpus/contracts owed.

## Twenty-first attempt: scalar packed VALUES correlation

Native initial proc-f0c5709d293f failed SQL prepare assertion: VALUES LIMIT syntax
invalid, not oracle parity. Corrected proc-b7ed651e10a4 native nested scalar
SELECT IN VALUES(0),(p.a) inside vector comparison and direct table IN both
[INTEGER1,INTEGER1,NULL,INTEGER1]. Public RED proc-17c7bd52d2b0 nested returned0.
Scalar source-free compound/VALUES subquery branch unconditionally Once'd RHS
and emitted unbound later row trees. expr.c sqlite3CodeSubselect correlation
suppresses Once; insert.c nonconstant rows resolve outer identities. Branch now
uses linked correlated flag and original row reductions through shared binding.
Preserves LHS outside Once and existing scalar-leaf admission.

Trial proc-2dfe28dfdb27 type2: reduction needed kind narrowing. Trial
proc-3fb07a40be5e type0/test13of16: binder rejected literal because scalar-leaf
admission false. Corrected true. proc-276fbb62bf1d type0/test13of16: nested repair
passed, separate direct table IN still typed temporary unsupported. Removed direct
case from passing corpus, retained its native/public logs as unresolved independent
producer boundary, not parity. Final proc-f6fce7390491 test16of16/diffcheck/indexcmp0;
reuse unchanged type3.log. Commands timeout12 node --experimental-strip-types
--test row-vector/*.test.mjs + atomic; tsc --noEmit; scoped diffcheck/indexcmp.
work:///cards/card-t-c/shared-subquery-values-correlation/ native.log(failed),
native2.log,red.log,type.log(failed),type2.log,type3.log,final.log(failed),
final2.log(failed),final3.log,threepath.patch SHA256
b3a3ab785818704da490ca63931a2b27ef69d92ad53c401aedfd048f1d0c4100.
No staging/ref/index administration. Single-evaluation instrumentation remains owed.
Next direct table-expression IN source-free VALUES producer linkage; wider scope
and API/map/audit/resources/corpus handoff remain red.

## Twenty-second attempt: direct table IN VALUES owner handoff

Reuse unchanged native proc-b7ed651e10a4 direct p.a IN VALUES(0),(p.a)
[INTEGER1,INTEGER1,NULL,INTEGER1] and public temporary RED final2.log from prior
attempt. Table expression caller rejected all VALUES before shared producer.
Route VALUES through existing linked shared destination producer; packed row
recursive compileScalarSelect now preserves owner linkedPlan/expressionBinding
rather than dropping parent physical context. Source expr.c sqlite3CodeSubselect
hands shared Parse/destination to sqlite3Select, insert.c VALUES row production
retains original context. Trial proc-34cb383c7504 type0/tests13of16 exposed shared
Set scalar LHS fields=[] -> inconsistent KeyInfo counts. Corrected semantic owner:
scalar IN has one original field (not zero); vector/SELECT fields unchanged.
No KeyInfo relaxation/register guesses/parallel evaluator.

Guarded proc-d4f228c46177 type0/tests16of16/diffcheck/indexcmp0. Commands tsc
--noEmit; timeout12 node --experimental-strip-types --test row-vector/*.test.mjs
+ atomic; scoped vdbe diffcheck/indexcmp. work:///cards/card-t-c/shared-subquery-direct-values/
type.log,final.log(failed),type2.log,final2.log,threepath.patch SHA256
6436bb8b3c6647e5e2a26b99a8330f19424b631aeb08a7653016c2a351220b96.
Public regression checks rows/types/metadata/replay across3 encodings. Limit/order,
aggregate/window VALUES and single evaluation remain unproved. No staging/index/
ref changes. Next scalar Set affinity/NULL/empty source-based discriminator;
missing-plan/lifetime/resource/corpus/contracts/handoff remain red.

## Twenty-third attempt: scalar Set affinity consumption
Native proc-c665df631798 p.a IN VALUES('01'),NULL ->[1,NULL,NULL,1];
'01' IN VALUES(0),p.a ->[1,0,NULL,1]; empty SELECT NULL WHERE0 ->four0.
Public red proc-7922f15ac07f exit1; diagnostic rerun proc-439d6af136ed log
identifies second query0 vs1 (command sequential grep exit0 not test success).
Read expr.c3463 exprINAffinity: original RHS terminal EList plus LHS affinity.
Changed packed VALUES semantic fields to terminal row (nonconstant fallback linked
SELECT terminal owner). Trial proc-8da23e63bb21 type0/test13of16 still0. Debug
proc-26900ca8fbe8 confirms numeric affinity correctly produced; shared InSet scalar
runtime ignored affinities[0], unlike vector branch and upstream apply-affinity.
Now scalar InSet consumes first affinity vector field before fallback scalar affinity.
Removed temporary debug output. proc-6e1295b2d501 type0/test13of16: affinity cases
passed, independently empty source-free WHERE IN still typed temporary. Removed
empty case from passing corpus, retained native and failed logs; no empty parity.
Final proc-c200a4d8d96a 16of16/diffcheck/indexcmp0; unchanged type2.log reused.
Commands tsc --noEmit; timeout12 node --experimental-strip-types --test
row-vector/*.test.mjs + atomic; scoped diffcheck/indexcmp. Artifacts
work:///cards/card-t-c/shared-subquery-scalar-set/{native,red,red2,type,final,
debug,type2,final2,final3}.log and threepath.patch SHA256
2cbe6f030da61b051e54443533772ba84bcc5bd0632280580c24075e81f9add2.
No staging/ref/index changes. Next source-free WHERE IN shared producer admission;
constant coroutine VALUES affinity nuances, wider metadata/lifetime/corpus/handoff
remain unproved. Native NULL distinctions and public replay3 encodings retained.

## Twenty-fourth attempt: source-free WHERE IN shared destination
Reuse unchanged native empty IN proc-c665df631798 four INTEGER0 and public typed
 temporary rejection proc-6e1295b2d501 final2.log. Table expression caller required
source before Set production despite existing shared no-FROM WHERE producer.
Now routes noncompound/nonaggregate/nonwindow/unordered plain source-free IN
through linked compileWideSubquery/compileScalarSelect Set. Existing producer
owns WHERE false/NULL skip and destination, no parallel evaluator. Compared
select.c8292 sqlite3WhereBegin and where.c6944 no-FROM branch plus TS predicate
before body and skip patched after destination. Preserve exclusions for machinery
not translated; no general ordered/aggregate admission.

Guarded proc-ecce5fa6f1b0 type0/16of16/diffcheck/indexcmp0. Additional native-first
proc-215eca471530 correlated WHERE p.id1 IN ->[1,0,0,0], empty NOT IN ->four1
including NULL LHS. proc-2be35d98a25e expanded16of16/diffcheck/indexcmp0;
reuse unchanged type.log. Public repeated lifecycle3 encodings. Commands tsc
--noEmit; timeout12 node --experimental-strip-types --test row-vector/*.test.mjs
+ atomic; scoped vdbe diffcheck/indexcmp. work:///cards/card-t-c/shared-subquery-empty-set/
type.log,final.log,native.log,final2.log,threepath.patch SHA256
b5eed77b22e7bd2373ded9bd83da2c95edea436995d2726fcb741e5f6738548a.
No staging/ref/index changes. Missing-plan/correlation fallback, LIMIT/OFFSET
linkage/single evaluation/resources/full corpus/API-map-audit/handoff still red.
Next source-first nested LIMIT/OFFSET expression child linkage discriminator.

## Twenty-fifth attempt: nested clause linkage (still failing)
Native proc-89e51af33bad constant SELECT LIMIT and OFFSET cases pass; public
proc-af2fb736cd61 also passes unchanged. Native proc-99cbefdac22f table-backed
LIMIT SELECT id WHERE id1 ->[1,1,NULL,1]. Public proc-65ce89149f88 rejects at
computeLimitRegisters without subquery emitter. Added optional emitter through
count/scalar normalization/OFFSET and scalar producer caller. Trial proc-162fb61f40a0
type0/13of16 rejected schema-less scalar caller. Linked fallback uses existing
child plan without reparsing. Direct owner callback trial proc-100d2a4bac8a type0/
13of16 emitted but returned0; debug linked child sources1/uses2; callback removed.
Fallback proc-1b7dead651bb type2 (shadowed owner TDZ), corrected to captured enclosing
binding. proc-960bb472d571 type0/13of16 now returns0 not1. No passing claim;
source-backed regression remains failing. Removed unused optional owner callback
contract afterwards (not retyped yet). Debug removed. Evidence
work:///cards/card-t-c/shared-subquery-clause-link/{native,native2,red,red2,type,
final,type2,final2,debug,type3,type4,final4}.log. Commands tsc --noEmit and timeout12
node --experimental-strip-types --test row-vector/*.test.mjs + atomic.
Diffcheck/indexcmp pass. No staging/ref changes. Next inspect register/cursor
lifetimes when nested LIMIT producer executes before deferred scalar result body:
child plan is present but shared physical owner/control state now produces zero.
Empty clause NameContext policy remains; full LIMIT/OFFSET caller linkage not proved.

## Twenty-sixth attempt: SELECT counters must not mutate cached subquery Mem
Reused unchanged native table-backed LIMIT proc-99cbefdac22f and public0 failure
proc-960bb472d571. Opcode tracing proc-fd37c0f868d4/debug.log showed Once result
register4 reused as LIMIT counter, DecrJumpZero mutated it to0; next correlated
outer iteration skipped Once and reused0. Cursor/data positioning correct;
register ownership, not missing resolution, caused the failure. Compared pinned
select.c2535–2566: iLimit and iOffset allocated independently, ExprCode writes
into those targets. TS now copies expression results into fresh SELECT-owned
count/offset registers before integer admission/zero branch/OffsetLimit. Shared
Mem/Once behavior unchanged; expression cache no longer decremented. Debug removed.
proc-0d113889cd55 type0/16of16/diffcheck/indexcmp0. Added native-first OFFSET
proc-67c93dd295b7 four INTEGER0 (table scalar id1); public repeated encodings passes.
Final proc-ad8204f60bb6 type0/16of16/diffcheck/indexcmp0. Commands tsc --noEmit;
timeout12 node --experimental-strip-types --test row-vector/*.test.mjs + atomic;
scoped vdbe diffcheck/indexcmp. work:///cards/card-t-c/shared-subquery-clause-lifetime/
debug.log,type.log,final.log,native.log,type2.log,final2.log,threepath.patch SHA256
57a338f6618f7e93008edbe923531ed23b91198b87377dac5597f881e5c95f97.
No staging/ref/index changes. Earlier type/trial failures retained in attempt25.
Other producer caller emitter handoffs, shared scalar OFFSET preparation, resources,
single evaluation instrumentation, full corpus/API-map-audit/handoff remain owed.
Next compare shared Mem OFFSET cached-register ownership and emitter linkage.

## Twenty-seventh attempt: plain Mem clause producer handoff
Native proc-66b34c9cbab0 correlated table scalar with nested table OFFSET id1
->four NULL; nested table LIMIT id1 ->[1,2,NULL,1]. Public proc-975d530755fb
rejected in duplicate compileJoinSubquery OFFSET path (absent emitter). Compared
expr.c3933–3964 scalar X<>0 LIMIT rewrite and shared sqlite3Select destination;
select.c independent offset counter remains same as attempt26. Plain nonaggregate,
nonwindow, nondistinct, unordered, noncompound/nonVALUES scalar joined consumer now
uses existing shared Mem producer instead of duplicate local path. Shared producer
forwards clause child compilation using original linked plan; offset copied into
fresh mutable register before MustBeInt. Ordered/aggregate specialized paths kept
unchanged to avoid regressing supported shapes. Not full duplicate-path deletion.
proc-3202a121a457 type0/16of16/diffcheck/indexcmp0; narrowed dispatch explicitly
retains ordered/distinct/compound/VALUES paths; proc-5d971242ba26 type0/16of16/
diffcheck/indexcmp0. Commands tsc --noEmit; timeout12 node --experimental-strip-types
--test row-vector/*.test.mjs + atomic; scoped vdbe diffcheck/indexcmp. Artifacts
work:///cards/card-t-c/shared-subquery-mem-clause/native.log,red.log,type.log,
final.log,type2.log,final2.log,threepath.patch SHA256
 a077baa2f5897a2d577937b7402a1d214ddfba73f1b04f46dd71a14b2ca8e646.
No staging/ref/index changes. Next native-first EXISTS nested clause/skip check;
ordered/AggInfo producer handoffs, single evaluation instrumentation, lifetimes,
full corpus/API-map-audit/handoff remain unresolved.

## Twenty-eighth attempt: no-FROM SRT_Exists result independence
Native proc-b8abe07079cf EXISTS star correlated nested OFFSET/LIMIT/zero LIMIT
four0/four1/four0; public proc-e7a8cb2c374b already passes (controls only).
Native proc-2dc630167c70 EXISTS(abs(INT64_MIN),p.a) nested LIMIT table id1 four1;
public proc-1552101d6df6 integer overflow. Compared select.c1202 excludes EList
code for SRT_Exists;1412 INTEGER1 presence, versus compileScalarSelect emitting
result functions before destination. Owner fix skips EList emission and result
register copies for EXISTS while resolution/admission, predicate, clause evaluation,
OFFSET and destination remain unchanged. Shared Mem unaffected. Result count retained
for destination invariant; no evaluation of dummy metadata register. proc-d1ef435cda09
type0/16of16/integrity; removed unnecessary result copies then proc-67b983d61b85
type0/16of16/diffcheck/indexcmp0. Commands tsc --noEmit; timeout12 node
--experimental-strip-types --test row-vector/*.test.mjs + atomic; scoped vdbe
 diffcheck/indexcmp. Artifacts work:///cards/card-t-c/shared-subquery-exists-clause/
native.log,control.log,native2.log,red.log,type.log,final.log,type2.log,final2.log,
threepath.patch SHA256c89cb57d6479120578f1bf713982293e8743b0634a504c0d6f9964343b9c1ca3.
No staging/ref/index changes. Next packed VALUES EXISTS projection independence;
ordered/AggInfo handoffs/instrumentation/corpus/API-map-audit/handoff still owed.

## Twenty-ninth attempt: preserve destination ownership through scalar UNION ALL
Native proc-b5bf9b700f79 packed VALUES unused overflow four1, source-free UNION ALL
unused overflow four1, nested LIMIT/OFFSET overflow projection four0. Combined public
proc-1efdaeeb0d7c integer overflow. VALUES recursion already forwards owner; UNION
ALL row recursion dropped destination and expressionBinding/linkedPlan by constructing
only builder/parameters/emitRow. Compared select.c multiSelect TK_ALL same destination
and selectInnerLoop SRT_Exists projection exclusion. Forward existing owner before
row-specific builder/emitRow override: downstream primitive sees EXISTS and skips
unused EList; linked binding retained. Not a SQL specialcase or new evaluator.
Final proc-7d28a134fb73 type0/16of16/diffcheck/indexcmp0, rows/types/metadata/replay
three encodings; packed VALUES and combined LIMIT/OFFSET are passing preservation
controls, not new fixes. Commands tsc --noEmit; timeout12 node
--experimental-strip-types --test row-vector/*.test.mjs + atomic; scoped vdbe
diffcheck/indexcmp. Artifacts work:///cards/card-t-c/shared-subquery-values-presence/
native.log,red.log,type.log,final.log,threepath.patch. No staging/ref/index changes.
Bounded reproducer green; full migration/integration/corpus and remaining specialized
ordered/AggInfo/resources/instrumentation/API-map-audit/handoff not certified.
