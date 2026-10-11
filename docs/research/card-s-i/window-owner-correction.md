# Aggregate bounded-ROWS lifetime correction — working-tree evidence

Owner: [[card:card-o-c-b]]. This is an incomplete correction receipt, not root,
full-browser, original225 or alpha acceptance. See [independent source decision](window-overlap-decision.md).

## Current implemented boundary

For compatible ordinary `sum`, `total`, `avg`, `count`, `min`, `max`,
`group_concat` and `string_agg` windows with explicit ROWS PRECEDING/FOLLOWING
and no EXCLUDE, first input initializes without stepping; subsequent input
steps the pending end row, waits the following offset, returns current, inverses
the start row and
releases that row at the selected agg-inverse phase before its next advance.
Flush steps the final pending end before draining current and tests current EOF
before inverse, matching window.c:3088-3098. Partition reset clears initialization
and counters; suspended Yield resumes without replaying initialization.
Shared cache/value builtins and explicit EXCLUDE remain retained; this work does
not certify other previously fill/drain branches as source-complete.

Pinned owners: window.c sqlite3WindowCodeStep ROWS scheduling; windowCodeOp
Delete(SAVEPOSITION) before Next when op==eDelete; btree.c sqlite3BtreeDelete
preserved cursor/REQUIRESEEK/SKIPNEXT. TS array-position adaptation adjusts every
OpenDup handle at a deletion together, invalidates the removed current row until
Next/seek/rewind, and keeps positions before/after the removal stable. NewRowid
uses a monotonic committed insertion sequence, never shrinking live length.
Failed insertion publication does not consume a sequence or move handles. Clear
starts a fresh table and resets all handles. Generic remove/retain uses the same
shared removal owner. Direct concurrent mutation during awaited operations is
not an admitted contract. Sorting invalidates shared positions.

## Resource witness, not native allocation parity

Exact w2rows public SQL/native six typed INTEGER rows from the qualified artifact
match. Direct re-comparison of pinned CodeStep found that the prior two-input
first output/335 peak advanced end too early. Native first input initializes but
does not step; flush steps pending final end and breaks at current EOF before
inverse. Owning lowering now follows those branches. First result requires three
admitted rows for following1 (not full partition); four deletes for six rows with
preceding1/following1, not inverse after final current. Exact accounted peak359:
335,336,358 reject;359,360 succeed. Earlier335/336 passing receipts describe
superseded scheduling and are not current cap authority. Successful reset returns
six rows; failed reset preserves saved error identity; finalize refunds observed
budgets0. No sorter-consumption refund or packed-charge waiver. This is not native
allocator parity or a universal minimum.


## Commands and actual outcomes

Initial first-output test failed6-versus2 (proc-011ab5363ee8). First combined
regression selection was106/107 (proc-ef27095043c1); stale singleInsert32 success
witness remained red. It is not waived by the subsequent selected run. SingleInsert
81/82 supplemental controls pass but final approved carrier integration is pending.
A strengthened test initially double-closed its connection in finally; killed
proc-a00b0ea48314 retained failure evidence. Test ownership fixed and rerun passed.

Latest fail-fast command:

```sh
python3 test/conformance/window-delete-phase.test.py
node --experimental-strip-types --test \
 test/value/window-shared-delete.test.mjs test/value/private-state.test.mjs \
 test/conformance/window-bounded-lookahead.test.mjs \
 test/conformance/compound-private-key-position.test.mjs \
 test/conformance/run-aggregate-window-ts.mjs \
 test/conformance/aggregate-window-private-controls.test.mjs
npm run typecheck
git diff --check -- src/internal/private-state.ts src/internal/vdbe.ts
```

19/19 tests passed, public allocation43/43 executable and25/25 source-credit,
source-only ordinal44 separately, phase guard/typecheck/diff check passed.
Evidence: `work:///cards/card-o-c-b/processes/proc-b0e9ecd4e066/stdout.log`.
New checks include all three encoded typed fixtures (INTEGER, REAL, NULL, TEXT,
BLOB payloads), compatible sum/count, two partitions, empty input, failed tail
publication, shared positions/rowid seek and injected saved-position deletion error
with halt refund0 and saved reset error identity. Broader new typed checks use
explicit fixture expectations; only the exact six INTEGER browser query reuses
independently obtained pinned-native typed comparison.

Test SHA256:
- shared delete: `1b3c7a5e68dc736ff795af794c9de7355d4db24091f61f72a4525ea51a05d063`
- phase guard: `0dc63f577d409f1c0c182795f4e85ce99dc0150789164d446ee638525aaec587`
- public frontier/lookahead: `921be05e9e6d62fd22c42198d5bfe282fbf3d3534c93522e7f084a9c40a401ba`

## Subsequent expanded correction gates

The next attempt added parameter0/0,1/0,0/1,1/1 reset/rebind transitions and
abort/deadline at the real shared deletion checkpoint after outputs. Both errors
preserve saved reset identity and release observed reservations0. Compatible
first_value with sum and EXCLUDE CURRENT ROW controls preserve results and emit
no shared deletion. This tests retention, not all special-builtins.

The old singleInsert32 success expectation was corrected to82 in its owning
window-rewrite test with the precise packed71+logical11 rationale; supplemental
81 rejection/reset/cleanup remains in record-insert-overlap-review.test.mjs. The
old106/107 failure is retained above, not waived. Full expanded earlier selection
now114/114 passes (proc-8036d0ada468). No product cap or accounting charge changed.

Current-doc gate initially failed because living guide/API consolidation removed
dated headings (proc-9681aff1ec27). Updated its section locators and assertions to
current bounded admission, lifetime/cache branch and residual source gap, retaining
historical guard provenance in the test note and immutable e396178/card records.
Guide/API/source-map/current audit now link this bounded receipt and explicitly
do not certify other fill/drain phases. Final fail-fast docs/manifest/phase guards,
104/104 scoped tests, typecheck and full working-tree diff check passed:
`work:///cards/card-o-c-b/processes/proc-a14c8e646e44/stdout.log`.

Current changed hashes:
- lookahead/control test: `db422ac88f723823b1354f102fc954080452573564d6cbcff49d7c6e39ce867a`
- window-rewrite corrected carrier: `b92066812e31632b9b1f4a75b18047ad5bcbf0cfbfaa3f66f8efda65a7e40863`
- current doc guard: `f6a22d22aab1892ed8cd3e1509258448db20189b809560197ce7824938a0b614`

## Pending-end and flush correction (subsequent direct C comparison)

Pinned window.c:2980-3035 and3088-3098 was compared with the actual
`boundedLookahead` branch, not just six equal output rows. The previous correction
stepped each just-inserted end on first input and inversed after final flush
current. Native first-input initialization takes Goto past the step block;
subsequent input steps the pending previous end. Flush steps final pending end,
then RETURN_ROW's EOF jump skips final inverse. This exposed a real schedule
mismatch despite prior output/resource tests passing.

Added `regBoundedInitialized` with initial and partition reset, first-input guard,
flush pending-end step and current EOF guard before inverse. Focused first-output
admission now3; exact six rows produce4 deletes. Earlier335 peak is superseded
by359 under unchanged composed accounting;335/336/358 reject and359/360 succeed.
No native allocation parity and no resource-cap workaround. Cache/value/EXCLUDE
controls remain retained, and represented output/reset/encodings still pass.

New inverse fault test mutates retained sum context count just before inverse to
exercise the actual callback invariant error; it is test-only fault injection,
not a naturally occurring SQL error. It proves callback error precedes Delete,
saved reset error identity and observed cleanup0, not every aggregate error path.

Commands: `node --experimental-strip-types --test` over window-shared-delete,
private-state, window-bounded-lookahead, window-rewrite, run-aggregate-window-ts,
aggregate-window-private-controls, private-endpoint-seek-control,
record-insert-overlap-review and compound-private-key-position; doc/phase guards;
`npm run typecheck`; `git diff --check`. Final116/116 (all passing), public43/43,
25/25 source-credit with separate ordinal44, typecheck and diff pass.
Evidence: `work:///cards/card-o-c-b/processes/proc-e4024e9eb424/stdout.log`.
Focused7/7: proc-cc39f5709fd8. A receipt-update Python substring edit failed
(proc-ef4d6e2a9d30); no product check failure was masked, rerun corrected it.

Current hashes:
- lookahead: `596fa5984e7173604d340bf8fea68f21d7207274e73b03676d0719c47049de1c`
- entire working VM, including peer edits (not scoped commit):
  `c4352665ec47af923ccfd1616e3d95ef1707ec2df9aab91ce06e60b057e6b53e`

## Cumulative ROWS return-phase deletion correction

Re-read window.c:2029-2043 `windowCacheFrame`,2838-2869 eDelete selection and
windowCodeOp Delete(SAVEPOSITION)-before-Next. Cumulative ordinary aggregate
ROWS UNBOUNDED PRECEDING..CURRENT ROW with no EXCLUDE selects RETURN_ROW,
not AGGSTEP; first/nth/lead/lag or regStartRowid/EXCLUDE require retention.
Actual TS Gosub inserted/stepped each row then producer Yield returned it but
never deleted. New phase test reproduced zero deletes where second output
required one (proc-7ee74114b0c4 exit1).

Owning producer continuation now consumes return-row policy for that represented
slice: after caller consumes Yield output, advance independent current duplicate
to the returned row and Delete once, before SorterNext. Shared aggregate scan
and regNew output survive until caller return; shared monotonic rowid ensures
new input is not mistaken for old live-count identity. No seek lookup or SQL-text
branch added. Retention guard preserves compatible cache-required value and
EXCLUDE consumers. Other RETURN_ROW/AGGSTEP selections are not certified by
this bounded repair.

Added exact six cumulative sum/count typed rows, deletion count6 and timing
(n-1 deletes while caller sees row n), two-partition FILTER/shared-count reset,
compatible first_value cache and EXCLUDE retention0, and post-output deletion
fault with first-error identity/no replay/observed cleanup0. Reproduced red now
passes; new controls use fixture expectations, not fresh independent native
execution. Final119/119 expanded suite, public43/43 executable25/25 source-credit
plus separate ordinal44, docs/phase guards,typecheck and diff pass:
`work:///cards/card-o-c-b/processes/proc-481287f8754e/stdout.log`.
The suite command matches the previous expanded selection with modified VM/test
inputs. Strengthened phase topology and manifest/diff pass proc-8a786d5d6a9c.

Current hashes supersede prior VM/test hashes:
- whole peer-mixed working VM: `71696658c10cc2fbc3b01c4c32e1dbe7c38a3cb347c5b0a08c763bd5900dccd9`
- lookahead/lifecycle: `96256b29b78f10768338ecd25072e9f555d9b0710f2ede743e6abe00471d3fb9`

## Sliding-current inverse deletion correction

Direct re-read window.c:3015-3035 RETURN_ROW then AGGINVERSE and
windowCodeOp callback/Delete/Next confirmed the older sharedSliding branch
inversed before return but never deleted. Prior suspicion that this represented
branch advanced per aggregate was disproved: sharedSliding already owns one
advance. The owning gap was phase timing and missing deletion. Reproducer
proc-45f4a187feee failed missing retirements, while six typed outputs matched.

Moved ordinary no-EXCLUDE sliding ROWS preceding/current..current shared inverse
and deletion into producer continuation after Yield, before SorterNext. Threshold
must be start offset (not offset+1 used by pre-output inverse). First attempt
omitted registerAdjustment0; observed three-row sum/count rather than two-row
frame and two prior regressions failed (proc-c43040ea9db8); later typecheck did
not erase those failures. Corrected threshold explicit0; focused rewrite/new
suite/typecheck/diff passed proc-5436e77d416a. No callback recomputation, seek,
charge waiver or cache loss added. Old direct-step initialization remains a
source comparison gap; this result certifies only inverse/deletion placement.

Typed six-row shared sum/count fixture now deletes5 once per retired row.
Added parameter bounds1/0/2 reset/rebind in three encodings, REAL/NULL/TEXT/BLOB
payload checks and post-output deletion fault with first-error reset/refund0.
New anonymous parameter harness failed offset validation proc-120ec12550cf;
explicit ?1 control passes proc-87b08dbd77d3. Anonymous parameter behavior is not
resolved by this bounded lifetime correction and is retained as residual evidence.

Final expanded121/121 with docs/phase/manifest guards, public43/43 executable
25/25 source-credit and ordinal44 separately, typecheck/diff passed
`work:///cards/card-o-c-b/processes/proc-cdf1c316b5a7/stdout.log`.
Final added deletion-fault control focused13/13/typecheck/diff passed
proc-9f90ea96a049; no product input changed afterward. The fault control proves
failure after caller output and cleanup, not callback invocation by itself;
phase topology asserts inverse before Delete. Whole peer-mixed VM hash
`79d9d9f047a900176128825f08660bda16c613380e6b5a97077941710b733c39`.
Fresh native, other phase paths and reviewed isolated commit/integration pending.

## Sliding-current pending-end initialization and flush correction

Re-read living guide/audit and pinned window.c:2978-3035,3086-3102. The
first admitted row initializes cursors/counters and skips aggregate callback;
next input steps pending end before RETURN_ROW/inverse. Flush steps last
pending end then RETURN_ROW checks current EOF before inverse. Older TS
sliding-current stepped newly admitted input and returned immediately, and
inversed after final output. New topology/fixture reproducer fails1 admission
vs source2 (proc-df771248e4af).

Integrated ordinary no-EXCLUDE ROWS preceding/current..current with existing
pending-end CodeStep schedule, rather than adding another schedule: common
admission helper, countdowns (CURRENT0), partition flush/reset before next
Gosub insertion, step previous end, output current, inverse start, Delete,
and final end-step/current-EOF. Removed this slice's older direct callbacks,
size-threshold inverse continuation and redundant deferredInverse guard.
Compatible cache-required values and EXCLUDE keep retention schedules.

First attempt mistakenly tested nullable bound register against undefined,
emitting Copy from null for CURRENT and causing four undefined-Mem failures
(proc-c74313d65ad2). Source register absence is null in setup contract; fixed
owning initialization helper to emit Integer0 for null bounds. Next13/14 passed
(proc-2c8813751e6b), sole obsolete five-deletion expectation; replaced with4,
as explicit final-EOF test proves (not a budget waiver). Common helper/consolidated
phase guard plus rewrite/public regression passed proc-ec1b864dd44e.

New control proves first output after2 admissions, six typed sum/count rows,
four shared retirements; two-partition FILTER/count flush/reset reuse emits
six rows each pass with two retirements per pass, empty CURRENT input emits
none (proc-d6482d38bfcf). Prior parameter0/1/2 all-encoding typed/reset and
post-output deletion-failure cleanup controls pass on new schedule. These are
source-based fixtures/topology, not fresh independent native capture.

Final fail-fast docs/phase/manifest + expanded124/124, public43/43 executable
25/25 source-credit plus separate ordinal44, typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-59c015b6edf4/stdout.log`.
Bounded preceding/following peak359 unchanged. Whole peer-mixed VM hash
`162953a7528155f993c318a88d160e8cc0ff66e87e3a7d3792545d93f9c91ad1`;
test `417d22b32c458ca01f7e914a0bca6a56c75cdefd02b876d989bbd2bb28647f9e`.
Other RETURN_ROW/AGGSTEP frame paths, cumulative direct-step initialization,
anonymous parameter finding, isolated reviewed commit and root/full-browser
integration remain. This replaces the prior sliding-current direct-step gap,
not all window schedule gaps.

## Cumulative-current pending-end/RETURN_ROW correction

Re-read guide/audit and pinned window.c:2310-2362,2978-3035,3086-3104.
RETURN_ROW emits callback/Gosub, Delete when selected, then Next/EOF. Hence
cumulative unbounded/current deletes final output too and never inverses.
First row initializes without callback; later input steps pending previous end.
New first-output witness failed1 admission vs expected2 (proc-e4326dcc1691).

Extended common ordinary ROWS pending-end admission helper to unbounded start
and integrated cumulative-current with existing end-step/partition-flush and
return helper. RETURN_ROW deletes current after Yield before EOF; unbounded
start returns from inverse emission entirely. Removed superseded independent
current advance/deletion producer continuation and direct Gosub callback slice.
No rowid seek, recomputation, early refund, cap waiver or cache-required value/
EXCLUDE deletion. Saved post-output deletion fault/first-error/cleanup tests
continue passing. Qualified typed sum/count six-row fixture produces two
admissions before first output and six deletions including final output.

First expanded attempt106/108 passed (proc-54b08eabec2f): two internal tests
asserted superseded callback/partition ownership inside Gosub. They now assert
admission-only Gosub, producer pending-end callbacks with FILTER, producer
payload partition comparison/reset before insertion. Focused107/107 plus
phase/typecheck/diff passed proc-26b60dc4e35c. Additional cumulative REAL/
INTEGER/TEXT/BLOB/NULL across three encodings/reset and partition FILTER/shared
count controls pass. Final fail-fast docs/phase/manifest, expanded126/126,
public43/43 executable25/25 source-credit + separate ordinal44,
`npm run typecheck`, `git diff --check`:
`work:///cards/card-o-c-b/processes/proc-b3e7a99bab2f/stdout.log`.
Bounded preceding/following peak359 unchanged. No fresh native capture.
Whole peer-mixed VM `881a55a3382c3fde306c3faa75c36a1b2842c776001403b6d20db67ed992cd3a`;
lookahead `35b6d5961918faf06c271cd78cff95540884cf38c52f3f5763de05a67d447ab5`;
rewrite `5eb64cae61edd517409c4272bdeb83f0b965b905680cfdb0e5ab509f9ec1683a`.
Other frame families (including older current/following scheduling), anonymous
parameter finding, reviewed isolated carrier/commit and broad integration remain.
This supersedes cumulative direct-step gap from prior receipt, not other gaps.

## CURRENT..FOLLOWING pending-end correction

Re-read guide/audit and pinned window.c2978-3035,3086-3103. The same
non-FOLLOWING-start CodeStep branch owns CURRENT..FOLLOWING: initialize first
row without callback, step pending previous end, decrement end countdown,
RETURN_ROW then inverse (start countdown0). Flush steps last pending end and
skips final inverse at current EOF. Older TS directly stepped new input and
inversed before return, with no shared deletion. New first-output control
fails2 admissions vs pinned3 for following1 (proc-fe04dc1e0e1d).

Extended common ordinary pending-end ROWS admission to CURRENT..FOLLOWING,
reusing counters/end-step/return/inverse/delete/partition-flush. Disabled old
sharedFollowing direct callback and pre-return inverse slice for represented
ordinary no-EXCLUDE functions, and old partition/tail drains for that slice.
Cache-required value/EXCLUDE schedules remain retained. No new evaluator,
recomputation, budget waiver or sorter refund. New focused and rewrite/public
suite passes proc-2d0f1e82615a; parameter0/1/2 all encodings with typed payloads,
partition FILTER/shared count/reset and post-output saved deletion error pass
proc-e1c35fe739f0. First output3 admissions, six INTEGER sum/count outputs,
five shared retirements (final current EOF skips inverse).

Final fail-fast docs/phase/manifest, expanded128/128, public43/43 executable
25/25 source-credit and separate ordinal44, typecheck/diff pass:
`work:///cards/card-o-c-b/processes/proc-7479f7131bd7/stdout.log`.
Existing preceding/following peak359 unchanged. No fresh native capture.
Whole peer-mixed VM60108acb9afd470a2d1d455d421671fe4c4f437b71c66be76fc731b6292f65db;
lookaheadca85ae5305f40eee05262a72ab4e8846b2447c72e86ae695f643d3130289e78b.
Other ROWS PRECEDING-end/FOLLOWING-start and RANGE/GROUPS/cache schedules,
anonymous parameter finding, isolated reviewed carrier/commit and broad
integration remain; this supersedes current/following scheduling gap only.

## PRECEDING..PRECEDING pending-end correction

Re-read guide/audit and window.c2930-2978,2998-3037,3048-3056. PRECEDING end
conditionally steps pending end but unconditionally returns on subsequent input;
start countdown inverse follows return. Flush conditionally steps final pending
end and returns once without ROWS inverse. Reversed bounds produce empty frame
and reset cache per input at first-row branch. TS filled all six rows before
return vs source2 (new control proc-d62b7dd0c2b3).

Extended ordinary no-EXCLUDE ROWS common pending-end admission to
PRECEDING..PRECEDING. Added owning conditional-end-step helper used by main
and flush, independent return vs step countdown, single final return/no inverse,
and reversed bounds empty result/cache-position/counter reset branch. Existing
cached EXCLUDE/value schedule retained; old preceding drain bypassed for this
slice. No recomputation, substitution rationale or resource waiver.

Focused/rewrite/public passes proc-92ff75360a9f. New first output2 admissions,
six typed sum/count outputs, three shared deletes for2/1 frame; final flush
no inverse. Parameter2/1,0/0,reversed1/2,long5/4 across three encodings retains
INTEGER/REAL/TEXT/BLOB/NULL and reset; partition FILTER/shared count/reset
passes proc-7a9f1e24833b. Final fail-fast docs/phase/manifest, expanded130/130,
public43/43 executable25/25 source-credit and ordinal44 separately, typecheck/
diff pass `work:///cards/card-o-c-b/processes/proc-84b3ad0137a5/stdout.log`.
Existing preceding/following resource peak359 unchanged. No fresh native capture.
Whole peer-mixed VMc975107401e5cff9377e67943af2cf9e52f392a6fe9a61617cca0cfd762827b6;
lookahead500359cd75e87879631790a4f4e952a6504721058764e636e07a491ee4b75f71.
Other ROWS FOLLOWING-start/unbounded-end, RANGE/GROUPS/cache schedules,
anonymous parameter finding, reviewed isolated delivery and broad integration
remain. This supersedes PRECEDING..PRECEDING scheduling gap only.

## FOLLOWING..FOLLOWING independent countdown/dual-tail correction

Read guide/audit and pinned window.c2250-2282,2843-2868,2950-2978,
2982-3004,3055-3099. Corrected proposed next diagnosis: ROWS following
start returns then inverses with independent guards; inverse-before-return
belongs RANGE, not ROWS. First row initializes start=end-start and skips
callbacks. Flush adjusts remaining return countdown by start countdown,
zeros start, iterates return/inverse until either EOF, then emits remaining
empty-frame returns without inverse. Positive constant start selects RETURN_ROW
delete; zero/parameter starts retain. Source is not a generic partition mapper.

New control proc-313206dfdeab fails6 admissions vs pinned4 for1/2.
Integrated this ordinary aggregate/no-EXCLUDE slice into pending-end ROWS
admission with independent return/inverse (even when return countdown skips),
start adjustment, dual inverse/empty-return flush tails and reversed-bound
empty/reset branch. Old following fill/drains bypassed for this slice; cached
value/EXCLUDE retained. First expanded113/114(proc-674cf2269df7) still took
old path: helper end admission included following but start eligibility forgot
following. Corrected semantic admission owner; focused/typecheck pass
proc-083c558ce5e2. New first output4 admissions/six typed sum/count outputs/
six return deletions. Parameter1/2,0/0,reversed2/1,long4/5,0/2 across all
encodings preserves INTEGER/REAL/TEXT/BLOB/NULL/reset; partition FILTER/shared
count/reset passes proc-91c70663d1a9.

Phase guard failed proc-9e8f697565e4 because obsolete exact unbounded-return
text excluded new following-start exit; adjusted to assert both branches.
Final fail-fast docs/phase/manifest, expanded132/132, public43/43 executable
25/25 source-credit and ordinal44 separately, typecheck/diff pass:
`work:///cards/card-o-c-b/processes/proc-c069d3a9dbe3/stdout.log`.
Preceding/following peak359 unchanged. No fresh native capture/resource waiver.
Whole peer-mixed VM4fb868aaf320c3889a4e8dd3b90fb266d7305d5280d8cf78ae969b5940466594;
lookahead50607c61f48c6af0d99b3b2f2cff0084af91991d26027f4b10847ecab2cb13fb.
Remaining unbounded-end/unbounded-start preceding end, RANGE/GROUPS/cache
schedules, anonymous parameter finding, reviewed isolated delivery and broad
integration. This supersedes FOLLOWING..FOLLOWING gap only.

## UNBOUNDED PRECEDING..offset PRECEDING admission/AGGSTEP correction

Read guide/audit and window.c2843-2870,2998-3011,3048-3058. Unlike prior
expectation this composition was rejected before publication, not merely
filled/drained: new control proc-166749512c77 returned temporary unsupported.
Pinned source uses conditional pending-end step, per-subsequent-input return,
no inverse and final single return. Positive constant end selects AGGSTEP
Delete on end cursor before Next; parameters retain.

Extended ordinary no-EXCLUDE pending-end eligibility and output admission
together; conditional step deletes on end duplicate after shared callbacks,
before publication of output and before cursor next positioning. Reversed-bound
comparison applies only two offset bounds, not absent unbounded start register.
Focused/typecheck passes proc-67ca02d53269; expanded/rewrite/public passes
proc-17fbf9d8cfea. First output2 admissions/no delete, second output one step
retirement, six outputs/five shared end deletes including final flush. Three
encoding bound1/0/2/4 typed payload/reset and partition FILTER/count controls
pass. Step-delete error preserves saved error/reset without replay.

Control proc-a9dbbec54188 initially expected literal0 retention but observed
six return deletions. Inspection found pre-existing boundary literal-zero
normalization to CURRENT in semantic parser (grep proc-c62afaced57c); pinned
WindowAlloc retains offset expression and boundary (window.c1185-1238).
Adjusted control to record current behavior (proc-245f2a58cc8e), not certify
native lifetime. Parameter end1 retains and constant end1 deletes five as
source selects. Literal-zero normalization remains an explicit gap; it is not
an adaptation justification. Source primitive/caller comparison is next repair.

Final fail-fast docs/phase/manifest, expanded135/135, public43/43 executable
25/25 source-credit and ordinal44 separately, typecheck/diff pass:
`work:///cards/card-o-c-b/processes/proc-2daca27c1aea/stdout.log`.
Existing preceding/following peak359 unchanged; no fresh native capture.
Whole peer-mixed VM7054cc3c4c6e20faa98497f61a4906d0fa8ea66ad24a24d3675647c0961cbed6;
lookahead01b6de545d3194257d16c87b838e838c442c6e033ebb426ba29dd49adcdeb813.
Remaining zero-boundary semantic production, unbounded-end, RANGE/GROUPS/cache
schedules, anonymous parameters, isolated reviewed delivery and broad gates.

## Literal-zero semantic boundary production correction

Read guide/audit and pinned WindowAlloc window.c1185-1238: offset kind and
expression remain even zero, and invalid boundary-type order errors before
allocation. Existing parse.ts:windowFrame collapsed literal0/+0/-0/0_0 to
CURRENT, causing wrong deletion ownership and allowing invalid type order.
Restored zero-end retention control fails6 vs0 before repair (first portion
proc-1a98d7a76720); same sequential command then repaired semantic owner,
expanded suites/typecheck passed. Earlier failure is not erased by that exit0.

Removed zero collapse, preserved offset reduction/type, added source boundary
order rejection. Existing main/flush caller schedules now receive actual bound
register0 rather than CURRENT. New compile topology asserts offset kinds and
expressions for all three frame types/zero spellings. Public tests assert
zero-end/following retention/reset and atomic invalid-zero error. Three encoding
typed bound0 controls from prior suite still pass.

First expanded117/119(proc-e09ff3aa528a): old deletion-mode tests used illegal
single-bound FOLLOWING (implicit CURRENT end); replaced with legal BETWEEN
FOLLOWING bounds. New error assertion used parseSql although inline windows
are semantically produced at resolve; corrected to resolve and additionally
verified public prepare rejection. Expanded/typecheck proc-0b6916c732f6 passes;
public zero control proc-e4df3e875d7c passes.

Final fail-fast docs/phase/manifest, expanded137/137, public43/43 executable
25/25 source-credit and ordinal44 separately, typecheck/diff pass:
`work:///cards/card-o-c-b/processes/proc-372c08ab1e6e/stdout.log`.
No fresh native capture; preceding/following peak359 unchanged.
parse1db37f93fe428848890862eeb37a87666aaccb76072c137315ad7134d6dc511f;
VM unchanged7054cc3c4c6e20faa98497f61a4906d0fa8ea66ad24a24d3675647c0961cbed6;
lookahead59dc6f14f6095822e2e06580bc83d6a40401796f2f7a05be5ca05d69a9756259;
rewritec0eea8c46a5179ef79a5a722f1fed7a4d7b9c68a8c8a1e2921adc42f5d17ed46.
Remaining unbounded-end, RANGE/GROUPS/cache schedules, anonymous parameters,
reviewed isolated delivery and broad integration. Prior literal-zero gap is
superseded; this is not blanket frame-family lifetime certification.

## Ordinary unbounded-end pending-step/return-loop correction

Read guide/audit and window.c2950-3008,3008-3017,3086-3105. Source requires
partition cache for unbounded end, but not deferred broad callback fill: first
input initializes, subsequent inputs step pending end, flush steps final end,
then returns/current-EOF check/inverses start with countdown. Current EOF
skips final inverse. Reproducer proc-c27a36dc2bf9 fails second output deletes0
vs1; old drain inversed without shared deletion and stepped whole cache at flush.

Integrated ordinary no-EXCLUDE CURRENT/PRECEDING/UNBOUNDED starts into common
pending-end schedule, no admission-time returns for unbounded end. Flush final
step enters cache return-loop; shared post-output inverse/delete honors EOF.
Partition transition and parameter bounds use same owner. Pending-layer output
admission permits represented partitioned PRECEDING start (old predicate had
excluded it); cache-required value/EXCLUDE and FOLLOWING start remain unchanged.
No broad recomputation or browser algorithm substitution.

First expanded proc-aa5f5370a344 failed with undefined proposed flush-break
registry: owning return helper patches its own inverse EOF locally. Replaced
with loop-entry has-next/exit guard (no registry); proc-37ddafcd258f passes
expanded/public/typecheck. New typed3-encoding start0/1/2/4/reset and partition
FILTER/shared-count controls pass proc-c4a68fb237c0. Current witness six typed
sum/count outputs, five post-return deletes, no final inverse/delete. Saved
post-output delete failure preserves identity/error/reset; old fault controls
also pass.

Final fail-fast docs/phase/manifest, expanded140/140, public43/43 executable
25/25 source-credit and ordinal44 separately, typecheck/diff pass:
`work:///cards/card-o-c-b/processes/proc-ba7fa0bf36b0/stdout.log`.
Preceding/following peak359 unchanged; no fresh native execution.
Whole peer-mixed VM54914c22e252e305473b7d94775cefe46bfa29cc514be1b1b5c383899be2a9ee;
lookahead2f48c5039f3aef20acf7c7a8b98cf13d1a48cfbb02d1e8def1b051e41b7cf76f.
Remaining FOLLOWING..UNBOUNDED start-countdown flush adjustment, RANGE/GROUPS/
cache-required schedules, anonymous parameters and isolated reviewed/root gates.

## FOLLOWING..UNBOUNDED ordinary pending-end/cache correction

Read current guide/audit and window.c2250-2283,2950-3004,3055-3089. Source
regStart subtract adjustment applies only FOLLOWING end, not UNBOUNDED;
end-unbounded flush guards return with start countdown and inverses independently
(no inverse countdown), then returns empty frames after start EOF. Cache is
required, not a rationale to defer all step callbacks to broad flush fill.
Reproducer proc-9a9ebd4a038b second output no return delete vs1.

Extended ordinary no-EXCLUDE pending-end eligibility to FOLLOWING unbounded.
Start adjustment/reversed-bound checks restricted to two offset bounds. No
admission return or inverse; subsequent input steps pending end, flush steps
final end then guarded return/unguarded inverse and empty tail. Positive literal
start RETURN_ROW deletion includes final output; parameter/zero starts retain.
Obsolete fill/drain bypassed only for assigned ordinary slice. Cache-required
value/EXCLUDE remains unchanged. Focused/typecheck proc-c48ebc308f99 passes;
expanded/rewrite/public proc-56adfe4988bc passes. Typed3-encoding parameters
0/1/2/4/reset and partition FILTER/shared-count, literal9 empty tail, saved
post-return deletion error pass. Six typed outputs/six return retirements
including final confirmed. Phase guard proc-c7bf09e48016 failed obsolete exact
following inverse predicate; updated to require no unbounded-end admission
inverse. No cap/accounting change or evaluator substitution.

Final fail-fast docs/phase/manifest, expanded143/143, public43/43 executable
25/25 source-credit and ordinal44 separately, typecheck/diff pass:
`work:///cards/card-o-c-b/processes/proc-5511ef9fa712/stdout.log`.
Preceding/following peak359 unchanged; no fresh native capture.
Whole peer-mixed VMf1fdd341b888d90c41ce084dcb7895cb2c5f225df9582d33717fa89173f5af97;
lookaheadbf07ab8f3e7493b11659901de162fec2738bcc5da79313f7ed557d22bd552f02.
Remaining RANGE/GROUPS/cache-required schedules, anonymous parameters and
reviewed isolated/root gates. All ordinary ROWS schedules passing these bounded
controls does not certify full frame VM fidelity or browser integration.

## RANGE CURRENT..CURRENT single-term ordinary peer repair

Read guide/audit and window.c2980-3045,2290-2360. Source new-peer input guard
steps pending end peer then returns current peer then inverses start peer;
final current EOF exits before final inverse. Reproducer proc-414318ae3a5c
first output six admissions vs2 (old full-cache range drain).
Implemented input resolved KeyInfo peer guard and cardinality registers across
shared end-step/current-return/start-inverse cursor loops. Input admission
establishes peer boundary once; loop countdowns carry that boundary rather than
recompare the same immutable peer keys at each cursor Next. This is a register
representation of established peer boundaries, not a platform-required
algorithm substitution or host partition grouping. Admits only ordinary
no-EXCLUDE/single-term RANGE CURRENT..CURRENT. Final partition peer has no
inverse/delete; nonfinal inverse deletes before Next. Partition flush/reset
and callback admission corrected together; cache-required value/EXCLUDE old
path unchanged. Retained rows/Mem use existing statement budget/control owners.

Initial proc-cc5e355531d2 returned done (uninitialized peerCount NULL propagated
through addition); explicit PC0 zero init fixed owning state. Next
proc-5c241b38ea18 duplicated outputs: old admission Yield replayed last output
readiness after peer flush. Suppressed old yield for new owner;
proc-c42a9e1c6653 focused/typecheck passes. Proc-f8e15e7bf379 expanded/public
passes. New NOCASE DESC NULLS FIRST typed3-encoding/reset keys, partitions with
FILTER/shared-count/all peers and saved post-output inverse deletion fault pass.
Six singleton peer outputs/five deletes, first output two admissions.

Final fail-fast docs/phase/manifest, expanded146/146, public43/43 executable
25/25 source-credit and ordinal44 separately, typecheck/diff pass:
`work:///cards/card-o-c-b/processes/proc-eb4d85dd6048/stdout.log`.
Prior preceding/following peak359 unchanged; no fresh native.
Whole peer-mixed VM9c46654dae4fc61151d97389aa8fdf9c89f4f64054711bba3dd4cb209f128861;
lookahead66f0c8a2a871f93e257f95bc168371c4574a7a7e7899c35442d67f16f27123e7.
Other RANGE bounds/multi-term ORDER/GROUPS/cache-required schedules and reviewed
isolated/root integration remain uncertified. Next useful source comparison is
UNBOUNDED..CURRENT peer return deletion vs existing cumulative GROUPS/RANGE drain.

## Cumulative RANGE/GROUPS UNBOUNDED..CURRENT peer correction

Read guide/audit and window.c2980-3009,2248-2258,2340-2385. Source no inverse
for unbounded start, peer pending-end step then return/delete-before-Next,
including final. Reproducer proc-4978dc1e57f1 first output6 admissions vs2.
Extended ordinary peer owner to cumulative RANGE/GROUPS with represented ORDER
terms; carried all key fields through CompareGroup/copy, post-output return
Delete and no inverse. Partition/flush owner corrected together, sharing
compatible aggregates. No budget waiver/recomputation/substitution.

Initial proc-6000c321a32a exhausted cursor: legacy cumulative and RANGE
preceding-current predicates overlapped, draining twice after shared deletes.
Exclude duplicate RANGE partition/final drain for shared cumulative owner;
proc-c464674bfa80 expanded/public/typecheck pass. New six return retirements,
three-encoding cumulative RANGE/GROUPS NOCASE DESC NULLS FIRST/reset/partition
FILTER/count and multi-term ASC keys/saved post-output error pass.
Proc-c8940fd39faa multi-term named-window DESC expected descending but observed
ascending secondary term. Recorded separate producer-key gap; switched this
cardinality test to ASC to isolate all-term identity, not certify DESC or erase
failure. Source-based key extraction diagnosis/repair remains next useful work.
Proc-ac342a39b735 focused/typecheck passes. No fresh native.

Final fail-fast docs/phase/manifest, expanded149/149, public43/43 executable
25/25 source-credit and ordinal44 separately, typecheck/diff pass:
`work:///cards/card-o-c-b/processes/proc-0047c6a42c8f/stdout.log`.
Prior preceding/following peak359 unchanged.
Whole peer-mixed VMbb144bd01cb8cc91d799cb5b11894714ee6efda96f09d8fa4d874acf8ae69c1d;
lookahead3288a66c3b5cde07f171249de9e57dcc2012b87dab18b7c2d4d610cacff79f7d.
Other RANGE/GROUPS bounds/cache-required schedules and isolated/root gates remain.

## Named-window ORDER flags semantic-owner correction

Re-read current guide/audit and pinned parse.y927-940, expr.c2155-2183,
6668-6679, window.c1274-1300,1354-1387. parse.y appends an ExprList item
then sets its sort order; default ASC, explicit NULL order sets BIGNULL iff
opposed to direction. WindowChain duplicates entire ORDER ExprList;
WindowCompare calls ExprListCompare which compares normalized sortFlags.
TS definition/resolve retained only expr nodes; rewrite searched function-owner
reduction for sortlist. Named OVER has no sortlist, so directions silently
became ASC. Compatibility also ignored flags and could share incompatible scans.

Retained immutable orderTerms beside expression list in parsed definitions and
resolved windows. Inline/named/base inheritance follows same error/order owner;
rewrite consumes resolved terms rather than rescanning owner or SQL. Sharing
compares normalized DESC/BIGNULL; implicit ASC and explicit NULLS FIRST share,
as do DESC/default and DESC NULLS LAST. No algorithm substitution. Removed
superseded rewrite flag scanner and resolve expression-only sort helper.

Fresh failing named multi-term DESC regression proc-fe4feb92b7bd (secondary ASC)
then proc-acb1083fb190 focused/typecheck pass; rg unavailable in first command,
grep used for all pinned comparisons. Broader proc-acd671604a7f pass. Direct,
named OVER(w), chained definitions, per-term flags, incompatible split and
normalized-equivalent sharing topology pass proc-d5e928454bfb (before final
normalized-equivalence extra test). Existing three-encoding typed/key/control
regressions rerun unchanged, but fresh descending secondary public reproducer
uses w2rows only; no fresh independent native or allocator parity claimed.

Final fail-fast docs/phase/manifest, expanded152/152, public43/43 executable
25/25 source-credit and ordinal44 separately, typecheck/diff pass:
`work:///cards/card-o-c-b/processes/proc-5654eaca6049/stdout.log`.
Hashes in that receipt: parse461c77d2654c1ebdf48e0ef7695cf81f6cd9853d95b6976624f61b3bea2b3972;
resolve17ae4d4cab433493e1918f5b9f82791f1ac930fdcd1114832577fbcf7042be82;
rewrite86bf5041ff5d021944f91c574b56da906c9a8856d09c6eaea48b5faeddd9de2a;
lookahead dd035f5e2941ded3f024e2cf39adae0f8ff3a42524ec692b97556d5426800f4b;
rewrite test f18eceeb0b9415260b5b0fb7558a8b91372f358b20c5150ec62494fc6520592d.
No stage/commit/index replacement; other frame schedules/root gates remain.
Concrete next source comparison: ordinary GROUPS CURRENT..CURRENT peer guard
and inverse/delete vs cached orderedCurrentGroups drain, reuse established
input peer owner without admitting cache-required consumers.

## Ordinary GROUPS CURRENT..CURRENT peer correction

Read changed guide/audit and window.c2978-3007,2341-2395 plus existing
orderedCurrentGroups drain. Pinned regPeer gates second/subsequent input;
completed peer end-step/return/start-inverse loops delete at start inverse before
Next; final current EOF skips inverse. No offset countdown needed here.
Reproducer proc-6bd35f9b9768 first output6 admissions vs2 in full-cache drain.
Extended established input-peer owner to ordinary no-EXCLUDE GROUPS CURRENT
with represented ORDER terms, partitions included. Same resolved KeyInfo and
cardinality registers carrying established input peer boundary across shared
independent end/current/start cursor loops. Partition flush/reset and output
admission updated together. Cache-required value/EXCLUDE old path unchanged;
no recomputation/substitution or resource policy change.

Focused proc-51f2cb67ae61/typecheck pass. Additional proc-f9264d94be9c4/4
covers typed3-encoding NOCASE DESC NULLS FIRST/reset/partition FILTER/count,
post-output inverse-delete first-error/reset identity and multi-term secondary
DESC output/cache witness. Singleton first output2 admissions, six outputs/five
deletes; max simultaneous cached rows2 (pending peer plus boundary). This
counts retained cache rows, not JS heap/native allocator parity. Existing
budget/cancellation/deadline controls rerun, not new all-path native proof.

Final fail-fast docs/phase/manifest, expanded156/156, public43/43 executable
25/25 source-credit and ordinal44 separately, typecheck/diff pass:
`work:///cards/card-o-c-b/processes/proc-88b300c58a19/stdout.log`.
Whole peer-mixed VM818ffb67482c7416431162511b6ad7f8057e396e62c8cb5f09d0848d5ac6f4a9;
lookaheadfdf4f844668397e1f64d436c89bc6d5f6b802619240a3be3681f5d22288ea3fa.
Prior preceding/following peak359 unchanged, no fresh native/stage/commit.
Remaining offset RANGE/GROUPS/cache-required schedules, anonymous parameters,
reviewed isolated/root gates. Next concrete comparison: RANGE CURRENT..CURRENT
multi-term ORDER uses same no-offset peer CodeOp branches; compare admission
predicates and KeyInfo/frame offset restrictions before widening that owner.

## Multi-term no-offset RANGE CURRENT peer admission

Re-read guide/audit and window.c3007-3036,2360-2388. For CURRENT..CURRENT
regEnd/regStart offsets absent: RANGE CodeStep uses same completed peer
step/return/inverse order, CodeOp peer comparison reads nExpr fields. Single
ORDER restriction belongs to offset RANGE validation, not no-offset peer frame.
Fresh proc-0a92b9994657 failed prepare temporary unsupported multi-term RANGE
CURRENT frame. Removed single-key restriction only in ordinary pending-current
peer owner and tied compile/output admission to it; offset/value/EXCLUDE legacy
paths not widened. Resolved multi-term KeyInfo/counter/reset/delete owner reused,
not partition recomputation/substitution/resource waiver. proc-0dc4b2f9ce4d
focused/typecheck pass.

Fresh public regression secondary DESC singleton output/max2 cache, duplicate
multi-term peers (sum/count shared), partitioned keys/reset twice, offset RANGE
multi-term rejection before publication pass final. Existing typed3-encoding,
collation/NULL/fault/resource/EXCLUDE/value controls rerun; new multi-term SQL
uses w2rows only. No independent native comparison claimed.

Final fail-fast docs/phase/manifest/expanded157/157/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-cbeb7e4057cc/stdout.log`.
Whole peer-mixed VM34c8779ac2722b6c19d48949b60eedd02cb662a39b90bd83c206a0e70718521a;
lookaheadfdb00786df36770a8e05df33833626a53e8094181cf2fc488a1e8220453aa8e5.
Prior peak359 unchanged; no fresh native/stage/commit/root certification.
Next concrete comparison: ordinary GROUPS UNBOUNDED..offset PRECEDING peer
counter/regEnd guard vs current orderedCumulativePriorGroups full-cache drain.
Other offset schedules,cache-required schedules,anonymous parameter diagnosis,
isolated reviewed carrier/commit/root gates remain.

## GROUPS cumulative literal-one prior-peer schedule

Read changed guide/audit, pinned window.c2997-3009,2250-2285,2840-2874.
AGGSTEP regEnd has IfPos before peer loop, RETURN_ROW unconditional, inverse
UNBOUNDED no-op; positive literal non-RANGE PRECEDING selects AGGSTEP deletion.
Reproducer proc-a4088514ee29 first output6 admissions vs2. TS old drain snapshot
prior aggregate but pre-read full partition. New pendingPriorPeerLayer only ordinary
registered no-EXCLUDE GROUPS UNBOUNDED..literal1 PRECEDING: first peer skip end,
subsequent peer step previous peer then return current, no final last-peer step.
Independent prior/current cardinality registers use existing end/current cursors;
Delete at step before Next, pending peer retained. Literal1 countdown represented
as zero prior count for initial skip then prior count. This is specialized admitted
constant path, not general offset/parameter counter implementation or platform
necessity/substitution. Offset diagnostics remain evaluated at PC0. Same scan/context
and budget owners; no host group collection or broad recomputation.

proc-f4c766879f97 focused/typecheck pass. Simplified repeat to accept independent
count instead of swapping current registers. proc-b2b20b99a0cd2/3: partition
exhausted end cursor because prior count reset omitted; compared initialization/
partition reset and added zero prior count there. proc-79dba3750922 then3/3 and
typecheck pass. Singleton first output2 admissions/five step retirements; duplicate
peer first output4 admissions/three retirements; partition4 retirements. Each reset
rerun added and final pass. Fresh SQL w2rows only, not fresh3-encoding/native parity;
existing3-encoding/resource/fault controls rerun, no new schedule-specific fault.

Final fail-fast docs/phase/manifest/expanded160/160/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-dc7425f1d6b5/stdout.log`.
Whole peer-mixed VM69d666f5b3cff988d717bfab2afe091a544d0a8909e38dae851af19d656d379d;
lookahead7a3c0d70168b57bdcb923ba8f7ae09c6a7f215217f6f81856eeee247a7ddefc9.
A diagnostic substring inspection proc-ec16ea188790 failed (helper name absent),
not a test; subsequent grep located actual shared helper.
No stage/commit/native/root certification. Next concrete owner work: general
GROUPS UNBOUNDED..PRECEDING regEnd countdown controlling independent end-peer
iteration, rather than storing host peer groups; literal0/2 and bound parameters
will require additional admission/flush/source tests. Other schedules/root remain.

## General GROUPS cumulative PRECEDING countdown

Read changed guide/audit and pinned windowCodeOp2250-2285/2360-2388.
Fresh literal2 proc-2a20c705219a fails prepare temporary unsupported. Replaced
literal1 independent-count specialization with source regEnd IfPos countdown
initialized from validated bound, reset per partition. Independent end peer reads
all KeyInfo fields, steps until next peer; one VM-register lookahead retains
position after EphemeralAdvanceData representation's advance-before-read versus
C current-read/Next loop. Lookahead is bounded input-width Mem, not host peer
list. Ordinary registered/no-EXCLUDE admission broadened; value/EXCLUDE old
literal1 path unchanged. Positive literal step deletion retained; zero/parameter
selected retention unchanged. Final pending peers not over-stepped.

proc-1717d4d59bb6 typecheck/focused4/4 pass (literal1 singleton/duplicates/
partition/reset plus literal2). proc-30d1ef36fc31 parameter0,1,2,9 singleton and
duplicate peers/reset/rebind/typecheck pass. New SQL w2rows only; existing
3-encoding/resource/lifecycle controls rerun. No new schedule-specific fault,
independent native typed output or lookahead allocator parity proof; current
accounting limits remain, no waiver/cap change.

Final fail-fast docs/phase/manifest/expanded162/162/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-acfa59375b0c/stdout.log`.
Whole peer-mixed VM32520076c0b20898566aae56fb82396ce0b5c8040b439ef7eea57d18e0d1981a;
lookaheadbea0ace1f4a0b7d28563cc50cfe74750a79a179bd5f86a2391c8c816bde8eac8.
No stage/commit/native/root certification. Next useful check: new schedule
post-output step-delete saved error and zero/parameter retention counters across
three encodings, then remaining GROUPS offset frame owner comparisons. Other
RANGE/cache schedules,anonymous parameter and isolated/root gates remain.

## General prior-peer lifecycle/encoding follow-up

Changed guide/audit re-read. Compared pinned windowCodeOp2350-2388
Delete(selected op) before Next peer comparison; control2997-3036 step before
return for PRECEDING end. No product branch change needed in this follow-up:
new source-selected retention controls now distinguish positive literal1 (one
step delete) from literal0/2 and parameter1 (zero on typed fixture); literal2
has no eligible end peer. Typed fixtures UTF8/16LE/16BE NOCASE DESC NULLS FIRST,
NULL/sum REAL/BLOB payload and reset twice pass expected outputs. Registers
and partition logic unchanged since prior162 gate.

Post-first-output step-delete injected error: first NULL sum/count0 published,
next step throws same error before second output; exactly one delete attempt,
reset preserves identity and byte budget0 on error/finalize. Injection is at
method entry, not actual deadline checkpoint or partial deletion claim. Budgets
observed via reserve wrappers; accounted-byte cleanup, not heap/malloc parity.
proc-4d251657e2c8 focused2/2 and typecheck pass. This materially resolves prior
schedule-specific encoding/retention/saved-error uncertainty; no failing product
hypothesis or fresh native execution in this round.

Final fail-fast docs/phase/manifest/expanded164/164/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-c7a8aadaad44/stdout.log`.
Whole peer-mixed VM unchanged32520076c0b20898566aae56fb82396ce0b5c8040b439ef7eea57d18e0d1981a;
lookaheadb6c692cef8177b5b1b089819027893e528af33dff3a3ac3d8dd14b1d7f14b1f4.
No commit/stage/revert. Remaining frame owner next comparison: ordinary GROUPS
PRECEDING..CURRENT orderedAdjacentGroups drain vs CodeStep non-RANGE step,
return then inverse regStart peer countdown; lookahead admission/first output
should establish a source-ordered streaming reproducer. Cache-required/RANGE,
anonymous parameters and reviewed isolated/root gates still outstanding.

## GROUPS PRECEDING..CURRENT pending start-peer inverse

Read changed guide/audit and pinned CodeStep3007-3036 / CodeOp2250-2282.
Reproducer proc-6e1a181b712f first output6 admissions vs source2. Old adjacent
partition drain replaced only ordinary registered/no-EXCLUDE current-end slice:
pendingCurrentPeerLayer steps complete input peer/returns current then regStart
IfPos and independent start-peer inverse loop with KeyInfo/one VM-register
lookahead. Final current EOF skips inverse. Legacy adjacent partition/final
owner excluded for this slice; value/EXCLUDE/FOLLOWING unchanged. Same shared
aggregate context/cache/budget, no group list or recomputation. Representation
uses existing advance-before-read lookahead as in end-peer correction.

proc-819156a0f39e focused1/typecheck pass. Added duplicate/partition/reset;
proc-6780a6d79d3c2/3 partition cursor-not-positioned. Source reset comparison
found missing start countdown/lookahead reset in actual current partition owner;
fixed there, proc-659ff042b32d3/3/typecheck pass. Singleton2 admissions/four
inverse deletes; duplicate4 admissions/no inverse before final EOF; partition2
deletes. Reset reruns pass. New cases w2rows only, no fresh encoding/native or
schedule-specific fault certification. Existing encoding/resource/lifecycle gates
rerun, not aggregate-window/full-browser acceptance. Other bounds unchanged.

Final fail-fast docs/phase/manifest/expanded167/167/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-632f7637ebb8/stdout.log`.
Whole peer-mixed VMf510f3bd9f7b2128442f4c3fba1a6438c4771f0c2f1ade157e70c66b2c672318;
lookahead28e5cf38c77154aa82d1109e89cf712fba4950166a263d0cf7bb1030a1d0a68a.
No stage/commit/revert/native/root claim. Next useful control: regStart0/2/parameter
countdown with typed peers and saved inverse-delete error, then source following
end schedule (current return regEnd countdown separate start inverse).

## GROUPS start countdown lifecycle follow-up

Read changed guide/audit and pinned2250-2282/2338-2388/3026-3041: return before
inverse regStart IfPos, selected Delete before peer Next, final current EOF skips
inverse. New controls materially address last round unverified start0/2/parameter
and encoding/fault paths; no product behavioral change needed (fixed copied code
comment end->start). Typed UTF8/16LE/16BE NOCASE DESC NULLS FIRST plus NULL/REAL
sum/BLOB payload/reset twice start0/1/2/parameter1 expected output pass. start0
retires first peer once; other bounds skip inverse before final EOF. Parameter
0/1/2/9 singleton and duplicate/reset/rebind pass. Post-first-output start0
inverse-delete injected failure preserves first error/reset identity, one attempt,
no second output, budget0/error/finalize. Injection is method entry, not actual
deadline/partial-delete proof. proc-11a153369653 focused3/3/typecheck pass.

Final fail-fast docs/phase/manifest/expanded170/170/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-6fe1dd4d5625/stdout.log`.
Whole peer-mixed VMa4d7c5542c8889b9f4b7e453aaf18b0b67fc017482340af5736a2aa98e681d52;
lookahead552f57c4b390f85e324268e5db4df03c55f1bc2e7a9c205f2aea0deed1fe0be4.
No failure in new controls, native/stage/commit/root claim. Concrete next owner
comparison: GROUPS PRECEDING..FOLLOWING non-RANGE CodeStep return regEnd IfPos
then inverse regStart, orderedAdjacentGroups full-cache first output reproduction.
New lifecycle controls reduce evidence uncertainty without certifying remaining
RANGE/GROUPS/cache-required/anonymous parameter/root gates.

## GROUPS PRECEDING..FOLLOWING independent current peer owner

Read guide/audit and pinned2978-3001/3025-3034/3090-3098. Reproducer
proc-0857ce6e746f first output6 admissions vs source3 (process overall0 from
later sed does not erase failed test). Extended ordinary registered/no-EXCLUDE
pending peer path to PRECEDING..FOLLOWING; regEnd IfPos skips return AND inverse;
current peer iterates independently of input cardinality. One VM-register
lookahead retains current peer boundary, start peer remains independent. Flush
steps pending end once then returns/inverses current peers until current EOF;
last return EOF skips inverse. Countdown/lookahead/EOF reset per partition;
legacy adjacent owner excluded, EXCLUDE/value unchanged.

proc-c6c84d6dafdf typecheck failed unsupported If opcode (test not run), fixed
nondecrementing IfPos. proc-14a7dd5415e0 typecheck passed/test failed aggregate
accumulation and lost last output. Branch comparison exposed generated Goto
landing on EOF Integer rather than past it (array push address +2 vs+3), causing
false EOF and skipped inverse. Fixed generated branch; proc-465639340f1d
focused1/typecheck pass. Added duplicate/partition/reset, proc-c484dcac4f72
focused3/3/typecheck pass. Singleton3 admissions/four inverse retirements;
duplicate6 admissions/zero inverse before final EOF; partition2 retirements.
Fresh w2rows only/no fresh native/encoding/schedule-fault certification; existing
controls rerun. No host partition list/recomputation/cap waiver.

Final fail-fast docs/phase/manifest/expanded173/173/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-30ff23097b1b/stdout.log`.
Whole peer-mixed VM80136839da0e1b10c5108edc9606e7a69ab180bf4b0e30e10731877d2a0c892e;
lookaheadc7e02328343eb58de3ae8f5cdf9d90bf1fb6ccc098a75faa3552038eaec1cc8c.
No stage/commit/revert/native/root claim. Next meaningful control: FOLLOWING
regEnd0/2/parameter with variable peers and typed three-encoding/fault/reset,
then other GROUPS start/end schedules. Root/cache/RANGE/anonymous unresolved.

## GROUPS FOLLOWING countdown/flush lifecycle follow-up

Read changed guide/audit and pinned3025-3036/3090-3098. New tests address
regEnd0/2/parameter and independent current peer uncertainty from previous
repair, no behavioral change required. Typed UTF8/16LE/16BE NOCASE DESC NULLS
FIRST/NULL/REAL sum/BLOB/reset twice end0/1/2/parameter1 expected output and
one start-peer retirement pass. Parameter0/1/2/9 singleton/duplicate/reset/rebind
expected independent output peers pass. 0 PRECEDING..9 FOLLOWING flush-first
output then method-entry inverse-delete failure preserves first error/reset
identity, exactly one attempt/no second output, budget0/error/finalize. Not
actual deadline/partial deletion/heap or native parity proof. No new failures
or substitution. proc-5f31fcc30680 focused3/3/typecheck pass.

Final fail-fast docs/phase/manifest/expanded176/176/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-a319645d20e4/stdout.log`.
Whole peer-mixed VM remains80136839da0e1b10c5108edc9606e7a69ab180bf4b0e30e10731877d2a0c892e;
lookahead2516a641dbef669f47444dc892e2bbba6586ea7c1e01d90fc356c33e5e389ef5.
No native/stage/commit/root claim. Concrete next: GROUPS UNBOUNDED..FOLLOWING
CodeStep same regEnd skip/current-peer return with inverse no-op vs legacy full
cache; reproduce first-output admissions before connecting shared current owner.
Remaining RANGE/GROUPS/cache-required/anonymous parameters/root not certified.

## GROUPS UNBOUNDED..FOLLOWING shared current-return owner

Read changed guide/audit and pinned2250/3025-3036/3090-3098. Fresh
proc-1a74a4bbabe0 prepares temporary unsupported (not previously presumed full
cache). Widened ordinary registered/no-EXCLUDE pending current-peer admission
and flush, added source-selected return Delete before Next/final EOF; inverse
no-op. proc-7c9ae611978f still unsupported exposed separate executableOutput
admission; connected same pending-layer predicate, proc-c3275c05ecea1/typecheck
pass. Duplicate/partition controls proc-bcb37c4136822/3 fail: final old-partition
sum included next partition row. Owning pre-insert partition guard omitted
sourceFollowingPeer unbounded slice. Corrected there (not observed result site),
proc-65cfb5a65e333/3/typecheck pass, reset twice. Singleton3 admissions/6
return deletes; duplicate6 admissions/6 deletes; partition6 deletes. Same shared
contexts/cursors/budget; no host grouping/recomputation/cap waiver.

Final fail-fast docs/phase/manifest/expanded179/179/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-f18a78daa269/stdout.log`.
Whole peer-mixed VM8dd0c9c582e6897dca6e4754e364b865df76f6deaee9f699d4154369aab9cede;
lookaheadf408976b0647ede1a202438a3661fc7bb7a6474251e5484bc201c808fe26b2b5.
New tests w2rows only; no fresh native/schedule-specific encoding/fault certificate.
No stage/commit/root claim. Next bounded controls: end0/2/parameter with typed
peers and post-return Delete failure including final EOF, then GROUPS CURRENT
start FOLLOWING same regEnd control but inverse with no start countdown.
Remaining RANGE/GROUPS/cache-required/anonymous parameters/root not certified.

## GROUPS cumulative FOLLOWING lifecycle follow-up

Read guide/audit/pinned2250/3025-3036/3090-3098. Material new controls address
last round regEnd/encoding/return-Delete EOF uncertainty, no behavioral change
required. Typed UTF8/16LE/16BE NOCASE DESC NULLS FIRST/NULL/REAL sum/BLOB/reset
twice end0/1/2/parameter1 expected output and all3 return retirements including
final EOF pass. Parameter0/1/2/9 singleton/duplicate/reset/rebind pass. First
post-return method-entry Delete injection prevents second output; final post-return
injection after all6 outputs/five committed retirements fails DONE at sixth attempt.
Both preserve first error/reset identity and budget0/error/finalize. Not actual
deadline/partial-delete/native/heap parity proof. proc-947df0fd39d83/typecheck
pass, expanded final fault proc-90fc8465333a4/4/typecheck pass. No new failure.

Final fail-fast docs/phase/manifest/expanded183/183/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-3953b5991905/stdout.log`.
Whole peer-mixed VM remains8dd0c9c582e6897dca6e4754e364b865df76f6deaee9f699d4154369aab9cede;
lookahead5b3362d40e780d1e92989531ab7b645b5f748a0ec7ed9f138e027770fe8e792f.
No native/stage/commit/root claim. Next GROUPS CURRENT..FOLLOWING same regEnd
skip current return/inverse with no start countdown vs currently unrepresented
slice; reproduce admission and connect semantic owners only after source compare.
Remaining RANGE/GROUPS/cache-required/anonymous parameters/root not certified.

## GROUPS CURRENT..FOLLOWING zero start countdown owner

Read guide/audit/pinned2250-2282/3025-3036/3090-3098. Fresh
proc-95489566fc98 prepare temporarily unsupported. Widened ordinary registered
no-EXCLUDE current-peer admission; shared start-peer inverse/lookahead uses
Integer0 countdown instead of absent start-bound Copy. Same initialization and
partition reset corrected together. regEnd skips return and inverse; flush drains
independent current/start peers, final current EOF skips inverse. No host mapper,
recomputation or cap waiver. proc-ca2f611644e9 typecheck syntax failure caused by
replacement prefix, no test run; corrected prefix, proc-4919a3e7465a1/typecheck
pass. Singleton/duplicate/partition/reset controls proc-f097d2f646563/3/typecheck
pass. Singleton3 admissions/5 retirements; duplicate6 admissions/3 retirements;
partition4 retirements. New cases w2rows only; existing encoding/error tests rerun
without claiming schedule-specific native/encoding/fault certificate.

Final fail-fast docs/phase/manifest/expanded186/186/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-a2e2cbf9118f/stdout.log`.
Whole peer-mixed VM9e8b1cbcac443316aef94119e90d0cd5547d749e8e88279753648af1dd701ded;
lookaheadb2284acf08984868b6ea0328c70eedab6c94ebcfbfab3ea350b13edb88b21ed3.
No native/stage/commit/root claim. Next typed end0/2/parameter and flush inverse
failure controls; then GROUPS FOLLOWING..FOLLOWING source independent start
countdown regEnd-regStart vs unrepresented slice. Remaining RANGE/GROUPS/cache
required/anonymous parameters/root not certified.

## GROUPS CURRENT..FOLLOWING lifecycle follow-up

Read guide/audit/pinned2250-2282/3025-3036/3090-3098. New tests address
previous-round end0/2/parameter/encoding/flush inverse uncertainty, no behavioral
change required. Typed UTF8/16LE/16BE NOCASE DESC NULLS FIRST/NULL/REAL sum/BLOB/
reset twice end0/1/2/parameter1 expected output/one nonfinal start-peer inverse
retirement pass. Parameter0/1/2/9 singleton/duplicate/reset/rebind pass. CURRENT..
9 FOLLOWING flush-first output then method-entry inverse-delete injected failure
prevents second output, one attempt, first error/reset identity, budget0/error/
finalize. Not actual deadline/partial-delete/native or heap parity proof. No new
failures. proc-746b28b36a143/3/typecheck pass.

Final fail-fast docs/phase/manifest/expanded189/189/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-65b3edbbcaf5/stdout.log`.
Whole peer-mixed VM remains9e8b1cbcac443316aef94119e90d0cd5547d749e8e88279753648af1dd701ded;
lookaheadc1a9a5b219aba0fc57c2cadd93d712204fd320c8bee79d98ac09be5c15919779.
No native/stage/commit/root claim. Next GROUPS FOLLOWING..FOLLOWING source
regStart=end-start initialization, independent return-then-inverse and flush
regEnd adjustment, compare unrepresented slice with positive/zero/parameter
Delete selections before admission. Remaining RANGE/GROUPS/cache-required/
anonymous parameters/root not certified.

## GROUPS literal1 FOLLOWING..1 FOLLOWING independent countdowns

Read changed guide/audit and pinned2250/2843/2962/2983-3003/3069-3088.
proc-48facad68637 test unsupported (later sed exit0 not test success).
Connected pending-current admission/current-return/start-inverse owners; initial
start=end-start; input end IfPos skips only return, inverse countdown independent;
flush pending step/end-=start/start=0, return/inverse loop. Positive literal start
selects return Delete, not inverse deletion. proc-66177e9d8eb2 typecheck passed,
reproducer maxWorkUnits failed from no EOF termination; kill consumed already
failed process, not passing test. Added post-inverse output EOF break, focused
proc-0c927ce18dda1/typecheck pass. Singleton/duplicate/partition/reset
proc-c7a73708f43f3/3/typecheck pass. Singleton3 admissions, duplicates6; all6
return retirements. Admission intentionally only literal1 pair until reversed,
zero/parameter, independent offset and start-EOF tail branches translated/tests;
not browser necessity or substitute approval. One-pair evidence does not prove
full CodeStep FOLLOWING flush ordering, especially start EOF before current EOF.

Final fail-fast expanded192/192/public43/43 executable25/25 source-credit plus
ordinal44/typecheck/docs/phase/manifest/diff:
`work:///cards/card-o-c-b/processes/proc-5efde185d293/stdout.log`.
Whole peer-mixed VM8c3dfe0468e531c028e6ae08fa344bd61c83e136f8a4c8bc4dab13f888d5a9f0;
lookaheadac66bce8c39078db9c42cbfa0424ffdfbe4f4722206bae8a8bf60ebe63341877.
New cases w2rows only; no fresh native/encoding/schedule-fault/commit/root claim.
Next translate source flush start EOF break into independent empty-tail return
loop and reversed-frame first-row reset branch before general offset admission;
verify0/1/2/9 and parameter positive/zero retain policy. Other RANGE/cache/root
and reviewed isolated commit unresolved.

## GROUPS FOLLOWING start EOF return-only tail

Read current guide/audit and pinned2948-2965/3071-3088. Fresh proc-b52160472f64
literal1..2 prepare unsupported. Added start EOF register/partition reset;
independent start cursor first/next EOF selects return-only tail, no more inverse
advances; end countdown/flush adjustment retained. Widened admission to literal1
start/positive literal end only. No speculative broad start/reversed/parameter
admission or platform-exception claim. proc-7d6d6d969ada4/typecheck pass;
end2/end9 flush-first and partition/reset expansion proc-20c1bfab01886/typecheck
pass. No new failure after initial prepare. end2 four admissions/end9 six;
all6 return retirements. New cases w2rows only; no native/typed/fault certificate.

Final fail-fast docs/phase/manifest/expanded195/195/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-81765a316c2b/stdout.log`.
Whole peer-mixed VMe789d1bca13a13e83ce345fd3d7f1369d1df376def5c09f240ef8b92f55e11c8;
lookaheadf0fbb5756ce74c303bf8323417ac50f120070a668011642a9ce9fe8e9bf9b07b.
No fresh native/stage/commit/root claim. Next source first-input reversed frame
branch before general start offset admission; verify start2/end2, start2/end1
empty, parameter/zero retain vs positive return-delete. Remaining other GROUPS/
RANGE/cache-required/anonymous parameters/reviewed isolated commit/root unresolved.

## GROUPS positive FOLLOWING reversed-frame owner

Read changed guide/audit/pinned2948-2977. Fresh proc-c3f7c30ddac02/2 failed
prepare unsupported. Widened positive literal start/end admission and translated
pre-peer same-kind reversed branch: IfRegisterGt start>end returns this admitted
row with empty accumulators, shared eph clear/position reset before next producer
row, no peer step/inverse/retention. Equality continues independent countdown
path. Source uses AggValue(empty), not aggregate callbacks/partition mapper.
proc-37c5a94106a12/typecheck pass. Start2/end2 (four admissions), start9/end9
(flush first/six admissions/all empty), reversed2/1 (one admission/empty/no Delete),
partition/reset expansion proc-086f5489c12c5/typecheck pass. All nonreversed6
return retirements; reversed clear refunds. New controls w2rows only, no fresh
native/typed/fault certificate. Zero/parameter starts remain honestly unrepresented.

Final fail-fast docs/phase/manifest/expanded200/200/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-06564f79622d/stdout.log`.
Whole peer-mixed VM2c669ef3e3a056f4edb538e8ec8b7d94f423a449fad6b4f8e98b5cd856255016;
lookaheadecf381d262fad4cc72a8d18260830f9943f7cba5bc2d55bc32dbed9ef5a015a0.
No stage/commit/root claim. Next zero/parameter FOLLOWING starts source eDelete
retain instead of return deletion, reset/rebind0/1/2/9/reversed bounds and typed
controls; remaining RANGE/cache-required/anonymous/root/isolated commit unresolved.

## GROUPS FOLLOWING zero/parameter start retention

Read guide/audit/pinned2843-2854/2948-2970. Fresh proc-8966a7fee83d parameter
start/end prepare temporarily unsupported. Removed literal-only admission gate;
same validated bounds/current/start/countdown/reversed/flush owner executes,
existing source-selected eDelete retains zero/parameter starts instead of positive
literal return deletion. No new evaluator or budget policy. proc-9b70c792d769
parameter1/typecheck pass; start/end cartesian0/1/2/9 singleton/duplicate/reset/
rebind and zero start typed UTF8/16LE/16BE NOCASE DESC NULLS FIRST/NULL/REAL/BLOB/
end0/1/2/parameter1/reset twice, Delete0 controls proc-381800a903ab2/typecheck pass.
No further failure. Typed positive/parameter start payload and failure controls
remain narrower evidence; not full encoding/native certification.

Final fail-fast docs/phase/manifest/expanded202/202/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-ccb685ce7d99/stdout.log`.
Whole peer-mixed VM284865e197d4a446e28e496f4ab7ee8a26cefef212d1acd36d0e41e965321967;
lookahead05aab4bdc5e0e8c5fbc21031c5785d1ddde321038ed92d9a41516c14672f1d06.
No fresh native/stage/commit/root claim. Next typed positive/parameter starts and
post-return failure controls for return deletion/retained inverse lifecycle;
then source GROUPS PRECEDING..PRECEDING independent end countdown versus current
unrepresented scheduler. Remaining RANGE/cache/anonymous/root/isolation unresolved.

## GROUPS FOLLOWING typed/failure lifecycle follow-up

Read guide/audit/pinned2843-2854/2948-2970. Material controls address prior
positive/parameter start payload/failure uncertainty; no behavioral change needed.
Typed UTF8/16LE/16BE NOCASE DESC NULLS FIRST/NULL/REAL/BLOB positive1/2/parameter1
start/end9/reset twice expected outputs; positive all3 return retires, parameter0
retires. Flush first-output literal1..9 method-entry return Delete fault prevents
second output, one attempt/first error/reset identity/refund0/error/finalize.
Retained parameter1..9 post-second-output sum inverse-count mutation raises
`sum inverse without stepped value`/no Delete/first error/reset identity/refund0.
Not natural SQL/all-aggregate/deadline/partial-delete/heap/native parity proof.
No new failure. proc-a6d7a82a03482/typecheck and proc-9d8ae23f42c53/typecheck pass.

Final fail-fast docs/phase/manifest/expanded205/205/public43/43 executable25/25
source-credit plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-ebf3098b1fcc/stdout.log`.
Whole peer-mixed VM unchanged284865e197d4a446e28e496f4ab7ee8a26cefef212d1acd36d0e41e965321967;
lookahead5f9914532ab6e92e276d7f6437e0df9ba0c7243be8d1e0b29ae88930b10be565.
No native/stage/commit/root claim. Concrete next GROUPS PRECEDING..PRECEDING
regEnd skipped step but unconditional return/independent regStart inverse/source
first-input reversed guard vs unrepresented scheduler. Other RANGE/cache-required/
anonymous/root/reviewed isolated commit unresolved.

## GROUPS literal1 PRECEDING..1 PRECEDING independent end/start peers

Read guide/audit/pinned2996-3037/3050-3075. proc-6e5f65621232 unsupported.
Connected existing independent end-step countdown/current-return/start-inverse
owners for literal1 pair only; final pending end step/current return no inverse.
proc-09066ac53f7f typecheck passed/prepare still unsupported: separate public
executable output gate; connected same admission predicate. proc-7d537b575bf9
outputs correct but copied cumulative deletion assertion5 vs source inverse4;
corrected test, no byte/deletion-policy change. proc-8e46ed9ac7d32/3: duplicate
first admission expected2 copied singleton vs source new-peer4, corrected.
Final focused3/typecheck, docs/phase/manifest/expanded208/208/public43/43
executable25/25 source-credit plus ordinal44/diff:
`work:///cards/card-o-c-b/processes/proc-537dbeb2f41a/stdout.log`.
Singleton2 first admissions/4 inverse retires; duplicate4/0; partition2 retires;
reset repeated. New cases w2rows only, no fresh native/typed/fault certificate.
Admission literal1 pair only, not platform necessity/substitution.
Whole peer-mixed VMa7a222188e94a311ada4ab33c7e4af6c1b4130512e39d4307ec670bf2363d5df;
lookahead493701ef001b0e951ecd0d446a8e5d9f498657f87071edeb659f9398ec89ae29.
No stage/commit/root claim. Next general PRECEDING pair reversed branch end>start
at first input then independent countdowns with0/1/2/9/reset/rebind and final
no inverse. Other RANGE/cache/root/isolated commit unresolved.

## GROUPS general PRECEDING pair bounds/reversed owner

Read guide/audit/pinned2948-2978. Fresh parameter pair prepare unsupported
proc-ad46b421eca3. Removed literal1-only prior-peer gate and extended pre-peer
reversed-bound branch to end>start for PRECEDING, per C OP_Le; empty output/shared
eph clear before next admission. Equality/general validated countdowns use same
independent end-step/current-return/start-inverse owner, final no inverse.
Parameter cartesian start/end0/1/2/9 singleton/duplicate/reset/rebind focused1/
typecheck proc-d358ffd0ba17 pass. Existing literal1 singleton/duplicate/partition
and typed equal1/2/parameter1 UTF8/16LE/16BE NOCASE DESC NULLS FIRST/NULL/REAL/BLOB/
reset twice/no Delete controls focused5/typecheck proc-79b2bab3c434 pass.
No new failure. Typed unequal/reversed/failure/deadline boundaries not newly
certified, no broad lifecycle/native claim or substitution.

Final fail-fast docs/phase/manifest/210/210/public43/43 executable25/25 source-credit
plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-47a13729c5ac/stdout.log`.
Whole peer-mixed VM8f1ca2a33616eaf2bd6a0e5b8f6739ba5bdd1e164f81ed8e37d43513f7975c14;
lookahead054b0ed8ba67b2abcc15eefefa716dbc28e96fd26bed0c58a9abca0c6145546b.
No stage/commit/root claim. Next GROUPS UNBOUNDED end full-cache pending step
and flush independent start peer countdowns, unlike preceding final single
return; compare current implementation and source3080-3100 with topology tests.
Other RANGE/cache/exclusions/anonymous/root/isolated commit unresolved.

## GROUPS cached UNBOUNDED end admission/flush

Read guide/audit/pinned3080-3115 and CodeStep3010-3040. Fresh parameter PRECEDING
start/UNBOUNDED end prepare unsupported proc-894c43771c06. Added explicit source
unbounded-end predicate: same regPeer pending admission steps previous peer only,
no current return/inverse until partition flush; current independent peer loop
then drains outputs/start inverse with final current EOF break. UNBOUNDED/current/
preceding starts admitted, FOLLOWING start excluded (different source flush).
No partition mapper/recompute/policy waiver. Reused current peer output lookahead
and end-step registers, initialized zero output countdown for absent end bound.
Parameter0/1/2/9 singleton/duplicate/reset/rebind focused1/typecheck
proc-0a1d790d103e pass. Six admission first-output controls/preceding4,current5,
cumulative6 retirements focused4/typecheck proc-f4cfdd018e5b pass. Partition3
first admissions/2 retirements/reset pass. New tests w2rows only; no typed/fault/
fresh native/allocator parity certificate.

Final fail-fast docs/phase/manifest/215/215/public43/43 executable25/25 source-credit
plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-15fda6d2d9f8/stdout.log`.
Whole peer-mixed VMcb1b37a408b198fe21c06179802eb19354d427e4d7af4fdd122f0d60e13827ea;
lookahead97df239ef9f099a0d29dc665da71f2e0928d32ff851ac94b8d83934dd9e38cd0.
No stage/commit/root claim. Next cached GROUPS FOLLOWING..UNBOUNDED must not
subtract offsets at initialization/flush: full-partition end step then independent
start countdown and return-only tail per3080-3088; topology/error controls.
Other RANGE/cache/exclusions/anonymous/root/isolated commit unresolved.

## GROUPS FOLLOWING..UNBOUNDED cached start countdown/tail

Read guide/audit/pinned3060-3099. Fresh prepare unsupported proc-33783f3dd1a9.
Connected FOLLOWING cached admission to source pending-step owner; no absent-end
subtraction/reversed guard at init/flush. Flush return countdown copies regStart,
independent inverse unconditional (no inverse countdown), start EOF retains
return-only empty tail. Partition reset clears start EOF/copies return countdown.
Source selected literal return deletion vs parameter retention unchanged.
proc-3232fa8841ec typecheck null index after optional inverse countdown; guarded
skip patch, proc-65de56e6dcb1 focused1/typecheck pass. Parameter0/1/2/9 singleton/
duplicate/reset/rebind and literal1 partition3 first admissions/all6 return
retirements/reset focused2/typecheck pass. New cases w2rows only, not typed/native/
fault/deadline certification. No algorithm substitution/policy waiver.

Final fail-fast docs/phase/manifest/217/217/public43/43 executable25/25 source-credit
plus ordinal44/typecheck/diff:
`work:///cards/card-o-c-b/processes/proc-43a314fb532c/stdout.log`.
Whole peer-mixed VMe7c05303beb00252434227eede05c0376d9ad59e8c8e739672b9c34d3c49e6ef;
lookahead7ddd5a2783e870b279a6404d66255017447f159a81e0ed631dcb8bef127a04c9.
No stage/commit/root claim. Next typed cached GROUPS FOLLOWING controls and first/
final Delete/inverse failure controls with cleanup/reset identity; other RANGE/
cache/exclusions/anonymous/root/isolated commit unresolved.

## GROUPS cached FOLLOWING typed/error follow-up

Read guide/audit/pinned3060-3099. Added materially new cached typed positive1/2/
parameter1 start/endUNBOUNDED three encodings NOCASE DESC NULLS FIRST/NULL/REAL/
BLOB/reset twice/literal3 retires vs parameter0; first post-return Delete failure
and retained post-second-output inverse-count fault first error/reset/refund0.
proc-f23eb19ca51f3/typecheck pass. Final return Delete failure control initially
failed proc-af75ec8720f2: wrapper omitted Control argument on successful prior
Deletes, undefined checkpoint, not product error. Forwarded args; final fault
six outputs/five retirements then sixth attempt prevents DONE, first error/reset/
refund0/error/finalize. No product change required. Injected method/state faults
are not actual deadline/partial-delete/natural SQL/all-aggregate/native proof.

Final focused4/typecheck/docs/phase/manifest/221/221/public43/43 executable25/25
source-credit plus ordinal44/diff:
`work:///cards/card-o-c-b/processes/proc-108270b19952/stdout.log`.
Whole peer-mixed VM unchanged e7c05303beb00252434227eede05c0376d9ad59e8c8e739672b9c34d3c49e6ef;
lookahead4e2c3807b91b6085705532474c587019fdb9de36353933b99e1f9301382a6c7d.
No stage/commit/root claim. Concrete next RANGE offset PRECEDING/CURRENT..FOLLOWING
source range-test comparison/independent cursor scheduling vs current drain;
read windowCodeRangeTest/windowCodeOp and authenticate first-output admission
before modifying owner. GROUPS schedule tests do not establish RANGE fidelity.
Other cache/exclusions/anonymous/root/isolated commit unresolved.

## RANGE source comparison and newly reproduced scheduling/key gaps

Read guide/audit/window.c2101-2217/2244-2325/2980-3044. Fresh ordinary RANGE
1PRECEDING..1FOLLOWING topology proc-3a29eca5479a fails six admissions vs pinned
four: first initializes, second steps1,third steps2,current1+1>=end3 delays,
fourth steps3,current1+1<end4 inverse-test/return. No fresh native receipt.
Inspect runtime found independent comparison divergence: Number coerced int64
and both-numeric gate/inequality peer tests,missing BIGNULL. Replaced at owning
primitive with csr1 arithmetic only using existing arithmeticBinary/compareMem,
PRECEDING precompare/BIGNULL before DESC; emitters pass nullsLarge. Added three
internal source branch tests for >2^53 adjacent integers/mixed classes/collation/
NULL directions. Typecheck failed wrong KeyTerm bigNull proc-e4e41292c3dd, then
optional undefined proc-fd0fd79c45e2; corrected nullsLarge??false. Internal test
failed string passed to byte Mem API proc-5c633a63e23d; encoded bytes,3/3 pass
proc-48d74fb05a67. Public int64 ORDER d+constant fails prepare resolved correlated
column lost identity proc-8c19139f0f8f before runtime. Two reproducers retained
explicit TODOs; not waived/claimed repaired. No schedule substitution justified.

Final typecheck/docs/phase/manifest/public43/43 executable25/25 source-credit +
ordinal44 and regression command exit0 but 226 declared=224 pass+2 failing TODO,
not226/226: work:///cards/card-o-c-b/processes/proc-07c07c893fe1/stdout.log.
Commands same prior gate plus test/value/window-range-test.test.mjs. Hashes in
that log; whole VM5fe76d5060733fb9b015074a26c0ce62e45492974815c115583fe431e4c679b4;
primitivef9cb3412b5bcf3c192f4ff8233848b208aff97c8403caae79620dceacd471b73.
HEAD/index preserved,no stage/commit/native/root claim. Next concrete repair:
source pending RANGE end-step/strict current+end<end-cursor eligibility before
independent start-inverse/current peer return; avoid full drain per admission.
Key production resolved identity separately remains red. Other cache/exclusions/
anonymous/root/isolated commit unresolved.

## Generated scalar sort identity correction

Re-read changed guide/audit; pinned window.c selectWindowRewriteExprCb and
expr.c exprDup/sqlite3ExprListDup1831+ (upstream copied Expr retains resolved
fields). Diagnostic proc-06fa81806b6e confirms missing identity at original
ID production, not expression-parser operand mismatch. TS copySortExpression
creates new Lemon leaves while resolvedExpressionCarrier indexes original
nodes. Direct-column binding masked this for simple keys. Added explicit
WindowRewriteSortTerm.sourceExpression; sort copy/integer-to-NULL adaptation
remains unchanged, emitProducerBinding resolves the original carrier for
scalar partition/ORDER keys. No spelling rebinding,second evaluator or scope
change. Typecheck proc-762b1ee23448 failed optional Lemon terminal union;
kind guard fixed,focused reproducer1/typecheck proc-43dd59a5af2c pass.
Focused2/typecheck proc-3c4cab0031a4 includes three encoding scalar partition,
parentheses, DESC, int64 ORDER, shared sum/count, typed NULL/REAL/BLOB/reset.
Removed resolved-identity TODO after passing; RANGE6-vs4 TODO remains failing.

Final fail-fast docs/phase/manifest/public43/43 executable25/25 source-credit+
ordinal44/regressions/diff:227 declared=226 pass+1 failing TODO,not227/227,
work:///cards/card-o-c-b/processes/proc-adc857309c3c/stdout.log. Commands prior
round unchanged plus expanded tests. Whole peer-mixed VM SHA256
3dad6a6976d6c412d1db4b6e1d77296a7ee883609bfaed221621c0c60b72864e;
rewrite5c5f3905e81775e72056147d7f7e232a601d889af6b6eb3201ecf2b73f5e19aa;
lookaheade846e6ca2c773cfac3864bddc0fd8f93dca74736a060010e2c9dc2d96a9074f5.
HEAD/index unchanged1e2d052/12+26-,no stage/commit/native/root certification.
Next remains pending RANGE end-step/strict current+end<end cursor gate then
independent inverse/current-peer return; carrier/other schedules/root unresolved.

## Remaining integration boundary

No reviewed scoped commit yet; VM, docs and the index carry substantial unrelated
peer edits (778 staged paths observed), none discarded/staged by this attempt.
Still required: reviewed carrier approval
and isolated delivery among peer changes. Zero-bound transitions, deletion
cancel/deadline, selected cache-required controls and current contract reconciliation
now have the scoped evidence above. Fresh root/full-browser/s integration must use exact
changed inputs and remains unclaimed. Endpoint adaptive work is routed separately.

## RANGE pending attempt (rolled back, not an accepted implementation)

Re-read guide/audit and pinned window.c2980-3041/2244-2324/3084-3099.
Implemented experimental pending input-peer count, independent return/inverse
loops and before-next ephemeral peek. Typecheck passed but focused3 failed
proc-4e8d526f93b3:6 admissions and inverse-without-step. Counter initialized
NULL instead of INTEGER0 (IfNot does not treat NULL as zero here); initialized
at startup gave proc-955bd930c0d6:2 pass,topology3 instead of4. Replaced end
peek with stepped-current end data:proc-fa5c54bf7474 typecheck pass,focused0/3,
first sum6 instead of3 (overshot aggregate membership). These are distinct
positioning hypotheses,not equivalent passing receipts. Experimental primitive,
emitter and TODO removal rolled back exactly; VM/lookahead hashes equal previous
3dad6a.../e846e6...; peer index12/26 and HEAD1e2d052 unchanged. No new product
repair retained. Post-rollback typecheck/focused3/diff proc-52aad53915e0 exits0
with2 pass+1 failing TODO6vs4;not3/3. Prior227=226+1 receipt applies unchanged
product inputs,not fresh full run.

The attempted end key choices conflate two source relationships: windowCodeOp
steps current end row then Next positions end at its next row; return is selected
by current+end>=positioned-end, but accumulator must still represent the selected
frame. Reading stepped-current delays eligibility but includes an out-of-frame
row; peeking next fixes values but releases one admission early. Next useful
attempt: trace initialization (first-row rewind) and *every* end Next/peer
transition in emitted C EXPLAIN together with start/current positions,then split
end-position key from stepped membership according to windowCodeOp's peer loop.
Also follow exact source RETURN_ROW then AGGINVERSE ordering (attempt inverse
before return was not that branch). Do not adopt these failing peek schedules
as a browser substitution or weaken source4 expectation without authenticated
source/oracle evidence. No impossibility or missing-access claim.

## Positioned end / post-return inverse correction

Fresh pinned library authentication proc-65d1a1a4841d: sourceid matches manifest,
lib3d976cb9d9e6c6f343d4307c707bb52cdebf4c8ebe650397fb9da6fba3c689fe.
Native EXPLAIN exact shared sum/count RANGE1PRECEDING..1FOLLOWING retained at
work:///cards/card-o-c-b/processes/proc-65d1a1a4841d/stdout.log.
Instructions64-73 step end row then Next/peer update;74-80 current+end>=positioned
end skips return;81-89 return peer;90-108 inverse against *advanced current*;
109 repeats eligibility. Thus third admission steps pending2,positions end3,
1+1<3 returns row1 withsum3. Earlier source-derived4 prediction was wrong,
not a constraint waived for TS. Fresh native rows proc-279ff7f5fdb8 exactly
[1,3,2],[2,6,3],[3,9,3],[4,12,3],[5,15,3],[6,11,2]. This corrects prior
rolled-back evidence interpretations: peek membership was right,pre-return
inverse was wrong. Source first/current EOF skips final inverse.

VM now implements pending peer step/positioned end gate/current-peer output
before independent inverse; borrowed nextData adapts before-next TS cursor,
not extra retained cache. Shared row retains budget debit; Mem copies use
existing statement registers (no heap-parity claim). Add grouped-PC relocation
for peek. Parameter/collation/storage comparisons use existing source Mem owner.
Counter INTEGER0 init/reset,partition flush,shared AggValue regs/Yield PCs retained.
Only ordinary registered aggregate no-EXCLUDE start preceding/current/unbounded
end following uses new owner;not general RANGE/EXCLUDE/value/ranking certification.

Typecheck/focused3 proc-e3a17262c216 pass. First broad proc-9e8c19df6ab4 failed:
accidental global replacement changed existing GROUPS4 expectations to3; restored
only unaffected assertions,not product changes. Corrected broad proc-84807fc6203e
exit0 (tail inspected separately). Lifecycle test initially expected deletion on
second output;proc-fb2e98baf7d5 focused3/4 failed;source second frame still contains
row1. Corrected test waits until third step:first inverse Delete failure preserves
error identity through reset,no replay;proc-07fb6fa2d1d3 focused4/4+phase guard pass.
Final complete gate/hashes below. No staged peer changes discarded,no full browser
or heap/native allocation equivalence claim.

Final fail-fast gate proc-5f42c6f6bbf3:typecheck,Node10 listed suites228/228,
0TODO,public44declared43/43executable25/25source-credit plus ordinal44 separate1/1,
phase guard,diff all pass. Tail explicitly read. VM SHA256
fe57573e9ad107b2378d353e781423a3142704c4b78b959b9a633c03d1eb4080;
private-state4be62a4a0e7a8d11d9724005dc57f552927e0b4776b521f4bbf4ddf17d13c431;
lookahead42d95b6d19fe1cd6751f9edb7aae061d0c0540b12b4fcf97e6a6b2c39e93e210.
HEAD1e2d052/index peer VM12+26- unchanged. No commit: reviewed isolated carrier
still outstanding amidst overlapping prior uncommitted work; no index replacement.
Commands are retained in process receipt work:///cards/card-o-c-b/processes/proc-5f42c6f6bbf3/stdout.log.

## Original bounded-resource assignment: renewed red assessment

The focused refactor completion did not complete original integration. Fresh
proc-b77c9341850e reproduces composed peak359,358/336/335/200 rejection,
359/360 six-row success/reset; cleanup0 and first saved error reset controls
remain in exact test42d95b6d19fe1cd6751f9edb7aae061d0c0540b12b4fcf97e6a6b2c39e93e210.
Current browser/run.mjs still selects336 (line58),so its advertised success
witness conflicts with this proven peak. This is an actionable acceptance gap,
not budget arithmetic to weaken. Proposed exact success359 for unchanged SQL,
retain200 failure and immutable budget arithmetic; browser capture541686e...
SQL/typed rows matches authenticated receipt (proc-1cc40948af12). No browser
success claim or operator-owned input modification made during red assessment.

81/82 supplemental payload INTEGER7,TEXT'abc',utf8,2fields,
MakeRecord71+logical11=82,one entry,key ceiling32 tested5/5 together with
shared-cursor controls proc-b77c9341850e. Exact test
cd543b2cda8b8ff07e8f549a7a88959432aefb7d84a1f10a0d26e440dc0d10a5.
81 reject71+11 atomically,refund71/reset first error once;82 success refund
packed71 then logical11,finalize0. This test lacks successful-reset replay
and byte serialization hash assertions;these are specific remaining evidence
extensions before final approval,not a claim they already ran. Shared delete
1b3c7a5e68dc736ff795af794c9de7355d4db24091f61f72a4525ea51a05d063
covers duplicate positions,tail rowid monotonicity,failed publication and delete
checkpoint atomicity. Focused12/12 proc-7468adda778b covers typed/three-encoding/
partition/empty,reset/rebind,delete deadline/abort/first error and retained
EXCLUDE/value paths. This is not full natural all-aggregate failure coverage.

Isolation still required: staged peer VM12+/26-,private-state45+/16-;unstaged
VM602+/102-. No index replacement/stage/commit this node. A coherent correction
carrier must identify inherited peer foundations versus window-owned changes,
validate in an isolated purpose-named work-root tree,retain exact included
hashes and reviewed provenance,then integrate safely. Existing228 receipt
alone is not that integration receipt. Full225/browser45/46 remain unaccepted.
Ordinary bounded ROWS/shared cursor/packed overlap/browser witness/carrier are
in this bounded assignment;general remaining RANGE/EXCLUDE schedules and native
allocator/JS-heap parity are separate broader fidelity limits,not reasons to
close this assignment nor enlarge its bounded resource witness.

## Exact witness repair and partial scoped carrier

Green attempt proc-817b02682b03 changes only browser success336→359
(200 failure unchanged),adds packed hex03011307616263/SHA256
 d41c818785e3b7c14af6ee24cbfa1dd08d3dad09d4738948ed88e937635435a0
and successful82 reset/replay controls. Exact UTF8 INTEGER7/TEXT'abc'
81/82 payload approved for this bounded witness,not every record/native malloc.
Final test3d14b68efa44554d1a0690bcef3a31f2e9e232df8e356eebdad86a8caece39b7;
working peer-mixed runnerf5aea6f0f5def01ed37025c652c116b22840a7bd827c6fdc8c6a5bf575e4bfdd.
Proc-7062e7c1ac52 fail-fast typecheck and selected10 suites130/130,0TODO,
phase/docs/manifest/diff pass. This command mistakenly selected fewer suites
than old228 receipt;130 is the actual fresh denominator,not228.

Build passes. Browser initial proc-9fdd518c0907 fails missing playwright;
proc-25a373d939bd tooling installed in purpose work root but fails absent
browser executable. Installing chromium into purpose work-root cache resolves
both;proc-9cc1866d34f2 filtered window/private-live passes2/2 on Chromium
156.0.8078.4,Playwright1.64.0. Full current lane declares46,but only2 executed:
no full46/225 acceptance. Tail explicitly read;report
work:///cards/card-o-c-b/browser-e2e/report.json. Original budget arithmetic
and first-error behavior unchanged. Earlier failures retained,not hidden.

Alternate-index partial witness carrier5c1bec7b8e7dcef931a96173bbb25e6033a13652,
treeb6625dba7817168898d1867d2749db40ef2ac275,parent1e2d052,
ref refs/heads/card-o-c-b-window-witness includes exactly isolated HEAD
runner336→359 (SHA25630f9d308787a2f1c3ca127ba7bb6167ac873888ad3aa9dd592c04c1cec4121ef)
and new overlap test hash above. No ordinary index/HEAD replacement. Initial
alternate-index carrier accidentally included preexisting WR browser hunks;
that carrierc463303 is superseded,not review candidate. Corrected carrier
constructed from HEAD runner with sole literal change;peer runner hunks kept
in workspace. This is a partial witness carrier ONLY,not reviewed full owning
ROWS/RANGE/shared-cursor implementation delivery nor isolated integration
receipt. Existing code foundations still overlap peer index;full owner carrier
must identify and validate those prerequisites before root integration.

## Materially informed full-owner isolation attempt

Constructed HEAD archive in purpose work-root window-owner-isolation,then copied
only candidate owners/tests and isolated HEAD browser literal repair. Not a
wholesale workspace snapshot. First typecheck proc-4351d822fcb3 failed missing
private-key-vm/record-pack/private-blobkey-pages,range primitive and rewrite
identity. Adding explicit prerequisites exposed balance/staging/Mem snapshot
and named-order parse/resolve requirements;proc-c74f237910d4,cc135b09fd66,
dde165b566f9 failed these dependencies. One erroneous filename window.ts failed
cp(proc-fff506ee6943);correct owner window-rewrite.ts identified.
Final typecheck passes. Initial isolated test batch lacked native evidence
file;first test opened server before read failed ENOENT,and batch failed/hung.
Killed proc-816ec581f2af and single proc-3c318cc1e202;these are not passes.
Copied exact authenticated native artifact98ffc359... into isolated tree.
Proc-bd0a4e56da0c then passes peak1/1 plus isolated owners/tests121/121,0TODO.
Proc-dd98ab413829 isolated typecheck/build and Chromium window controls2/2
pass. Isolated runner declares40 versus mixed workspace46;only2 selected,
no full-lane/root225 acceptance. Browser report overwritten by isolated run;
its durable exact output is proc-dd98ab413829/stdout.log.

Proposal commit abb6cf5278b43a15e2e9dafc85f46bade9302859,
tree75f9f40592bdc9ae3e7e3e466a6e40339365e029,parent1e2d052;
ref refs/heads/card-o-c-b-window-owner-proposal. It includes18 exact files,
explicitly includes inherited peer private-key/BLOBKEY/Mem snapshot prerequisites,
not window ownership approval for those algorithms. Ordinary index/HEAD/work
untouched. Exact all-file hashes manifest in purpose work root
window-owner-isolation-paths.json (proc-c39f5e1d3042);all test hashes:
bounded42d95b6d19fe1cd6751f9edb7aae061d0c0540b12b4fcf97e6a6b2c39e93e210,
shared-delete1b3c7a5e68dc736ff795af794c9de7355d4db24091f61f72a4525ea51a05d063,
range75e68a793cdda08c61b2b05586eaca38c25e36685526497e35fce1e44bb5cca2,
overlap3d14b68efa44554d1a0690bcef3a31f2e9e232df8e356eebdad86a8caece39b7.
This supplies a reproducible coherent isolated proposal and bounded integration
receipt,not reviewed/integrated correction acceptance. Review must decide
whether inherited prerequisite code should be split into a prerequisite carrier
before owner correction integration;do not cherry-pick blind or claim review.
Current guide/doc changes remain workspace-only and need scoped documentation
carrier to accompany eventual accepted implementation. No operator routing edits.
