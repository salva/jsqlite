# Original225 residual attribution experiment

Revision-bound diagnostic, not current compatibility authority. See [inventory](original225-inventory.json) and [current manifest](original225-current-manifest.json). Full current gate: 222 completed/3 failed, exit1, no timeouts/input drift; native prerequisites passed.

A disposable copy of current src/test/reference/examples plus package/tsconfig replaced **only** `src/internal/vdbe.ts` with accepted pre-consumer VM commit `375bd7e6caa6c166d04305f81a13d70d6ad2dc9f`. This is a mixed-input diagnostic, not an authenticated full accepted-tree baseline. The three failing files reran via Node strip-types: 93 tests/90 pass/3 fail, exit1. All three exact symptoms persist: LEFT sorterRows 0<1, window endpoint charge difference 0 vs600, window ephemeral byte ceiling. Thus the consuming VDBE overlay is not required to reproduce them; this does not prove which other owner caused them.

Command and artifacts: `$SAIVAGE_CARD_WORK_ROOT/wr225-baseline/baseline.log`, SHA256 `3160177363a68adc09c77d2f299c1efe7caf5d2d786b82aacef743a87d91770c`; substituted VDBE SHA256 `d6fb41df94b307f867b7b37a8c8a3a0d51f5e357e39d859c3e500ecdfe57b6eb`. Process `proc-3bc83b634db8`, terminal exit1, partial stdout remainder read. No work runtime/index changed. The original tests remain intact.

Parent [[card:card-s-i-c-b]] should route the window ephemeral accounting/seek witnesses to existing primitive/VM owner for comparison with accepted typed-page adaptation and route LEFT plan/counter expectation through its owning planner review. No duplicate primitive refactor or assertion weakening is justified here. Exact225 remains red; publication must retain these residuals. The next discriminating experiment is restoring matching accepted primitive dependencies in a disposable baseline, not changing WR lowering based on these failures.

## MakeRecord work-charge domination experiment

In the accepted-source disposable baseline only, replaced the single MakeRecord `checkpoint(charge)` with `checkpoint(0)` while retaining byte reservation, serialization and seek loop unchanged. Original endpoint control witness then **1/1 passes, exit0**, including its later host-yield/abort/deadline/reset assertions. Process `proc-f2693b8a4563`; diagnostic-work.log SHA256 `902447349e8aca3346a0c1d197e5a500593822fc67390022f9693d95873785b2`, experimental VDBE `3085fb995277caaa2105187db8de0207252bbbd2a63e584e27681fcdbe662a19`.

This experiment showed the witness stopped distinguishing lookup charging when earlier serialization work increased, but did **not** identify a production work-phase defect. The later bounded-search diagnosis below supersedes that interpretation: the witness's hard-coded upper bound was below both actual thresholds. Removing serialization charge is not a production repair. Existing owners should preserve MakeRecord accounting and repair the measurement's proven upper bound, retaining real seek interruption assertions. No original225 green credit follows from a disposable diagnostic.

## Pre-primitive source discrimination

Restored all corresponding `src/` blobs from main HEAD `1e2d0524047bef3205a8133b060c66f31c2f8ac0` in the disposable baseline, retaining unchanged current witnesses. The same three files now give **93/92/1 exit1**: both window witnesses pass, LEFT sorterRows0<1 persists. `pre-primitive.log` SHA256 `42d1a8b5b491c3e3257049c41acf9f688ec0639e3ee1fcbd10bd3ac2ba50adbb`, process `proc-ae0413d461be`, complete stdout. This narrows the two window failures to changes between pre-primitive source and accepted VM source under these current tests; it does not identify a single offending routine or authorize counter/limit assertion changes. LEFT is independently preexisting under these source baselines.

Current VDBE `MakeRecord` reserves packed-record temporary budget before rowid `Insert`; the 32-byte witness must be reconciled with that accepted VM ownership by its existing owner. Current `EphemeralSeekRowid` still calls `EphemeralIndexCursor.seekRowid`; no evidence justifies replacing its public counter assertions here. Parent should consume the discriminating experiment, not commission another WR lowering repair for these two witnesses.

## Dependency-matched source experiment

All 43 `src/` blobs from accepted VM commit `375bd7e6caa6c166d04305f81a13d70d6ad2dc9f` replaced their corresponding disposable-copy paths (current tests/fixtures retained deliberately). Exact blob SHA256 inventory `wr225-baseline/accepted-source-inputs.json`: `8c318b00362c98896e68ee3490ad7340bf8ae456082852ebec1f62d4bef799f8`. Reran the same three witnesses: **93/90/3, exit1**, with the same LEFT counter, endpoint counter and byte-ceiling failures. `accepted-source.log`: `c6be2dd8bc1028bab05b361b373faaadd1ca6803bfa0315a73d701730966be2a`, process `proc-d93b31f8a23b` complete stdout. This matches accepted source dependencies for the exercised existing paths; extra current files remain in the disposable directory, so it is not an isolated publication or full accepted-tree test claim.

The failures preexist this card's consuming source overlay under current witnesses. Repair attribution now belongs with existing owners: reconcile window rowid ephemeral representation/charging and LEFT plan-dependent counter expectation without weakening observable row assertions. No conclusion that counters are optional, no native byte-allocation parity requirement, and no waiver of original225 red. Parent routing is required; this leaf must not duplicate the primitive refactor.

## Bounded-search saturation diagnosis (supersedes work-phase interpretation)

Read the entire endpoint witness: `minimum()` binary-searches `[0,100000]`
without ever establishing that its upper bound succeeds. Therefore both failures
above that bound return100000 and produce a false zero differential. In a
purpose-scoped copy of current candidate f45c0128 source/tests, changed only that
witness bound to1000000 and printed thresholds; production charging remained
intact. Charged134171, uncharged133571, difference600; **1/1 exit0**, including
actual seek visits/yield/abort/deadline/reset. `proc-8d023987e129`, diagnostic.log
SHA256 `d25b5e1d0dd3d6a493de53a6003456ce5414d95f9cfbd8a6d02a064051d5b217`.

This is a converging owning-witness repair diagnosis, not a production accounting
removal or original225 waiver. Parent should route an explicitly verified
upper-bound (or adaptive bound) correction to the existing witness/VM owner;
unchanged original225 remains red. No runtime/default-index/peer edits. The byte
ceiling and LEFT counter residuals are unaffected by this experiment.

## Byte-ceiling boundary discrimination

A second disposable witness-only experiment retains accepted production and all
original row/work assertions, increases only maxBytes32→1024: selected cache
witness1/1 exit0 (`proc-79a909eca35e`, log
`54b21012bd868d51a23143d06c8b2563a9c840caf9c22687993eafc42b36a35b`).
Binary-search diagnostic with separately recorded per-budget exits/log hashes
finds minimum82, not a generic page allocation1024 requirement:
[boundary inventory](window-byte-threshold-diagnostic.json),
`proc-cf5f10de82f7`. Failures at63/79/81 remain genuine limit rejections,
passes82/83/86/94 and above retain original typed rows. Original witness restored
in disposable copy after experiment; work tests/runtime/index untouched.

This narrows owner review to the live packed-record/copy reservation overlap,
not blindly raising every ceiling to a page size. No approved contract change or
original225 repair is claimed. Owning VM owner should explain the82 peak and add
exact success/failure/refund assertions if adapting this pre-typed-owner witness;
retain maxEntries/maxKeyBytes/work assertions and public zero-byte tests. A [witness-only exact overlap proposal](window-byte-overlap-proposal.patch) has now been independently exercised in a disposable candidate copy:81 rejects with exact reset primary and zero refund;82 preserves original row/done and reaches peak82 then zero on finalize. Together with the adaptive endpoint proposal, full two-file92/92 exit0 (`proc-1d1d0c593363`, combined-proposals.log `483beb55ca0a2a38f224c4759c709bf1c85021a73ba541a7f2f105a846273c4d`). Proposals are unapplied pending existing-owner coordination; original225 remains red.

## Explained82 peak and refund order

Read owning MakeRecord/Insert dispatch, recordSize and shared byte budget. For
INTEGER7/TEXT'abc', serialized record is7 bytes (header3/payload4); temporary
charge7+64=71 remains live during Insert's logical INTEGER8+TEXT3=11 copy.
Delegating reserve/release trace in disposable witness at exact82 records:
`reserve 0 71; reserve 71 11; release 71 11; release 11 0`.
Selected1/1 exit0, `proc-8e8704428521`, byte-trace.log SHA256
`1cd382de9e59340521718587a860ef8836ab8a986d70f0c0f41d2e3fe889a9ab`.
Thus82 is a real composed peak, and done/finalize refunds to zero. The trace
forwards actual budget methods; it does not replace allocation or imply native
heap equivalence. Existing81 failure plus this82 success narrows the proposed
witness adaptation to exact overlap accounting, not arbitrary budget inflation.
Work tests/source/index remain unchanged; owner approval still required.

## LEFT counter discriminating control (not an approved assertion change)

Read manifest witness SQL: outer primary range ORDER BY t.id, inner rowid LEFT
lookup with ON note filter. Existing captured native EQP lists primary-range t
then rowid u LEFT-JOIN, with no temp-order node; this is retained captured evidence,
not a fresh independent native run. In the disposable diagnostic only, change
this one case's sorterRows min1/max2 to exact0 for all encoding variants. Full
runner **69/69 public attempts,1/1 test exit0**, all other private bounds/typed
native-backed rows unchanged (`proc-46d4a49c2458`, log
`3312afef8d8ee6df6dad930a5db9b2bfe89a1665d2c602351b7be306ecd7aa07`).
This isolates the original runner's failure to that sorter expectation; it does
not authorize changing it or establish current TS order-owner fidelity by itself.
Parent semantic owner should compare primary-order proof/lowering with source
and native before approving an exact0 contract or repairing order production.
Work manifests/source/tests remain intact. Original225 remains red.

## Fresh LEFT order opcode control

Independent pinned library EXPLAIN capture over all three original fixture files,
read-only opens/binding/finalize/close checked, confirms no SorterOpen/SorterInsert:
[native opcode capture](native-left-order-diagnostic.json), `proc-b1abbe4f409e`
exit0. Artifact records sqlite3_sourceid and per-fixture hashes; supplemental
opcode evidence, not new row-oracle/source-case count. Source comparison reads
where.c wherePathSatisfiesOrderBy's obSat initialization, equality matching,
WHERE_ONEROW/IPK branch and final obSat==obDone return. TS where-plan.ts730–750
retains an outer fully satisfied ordering across inner loops; vdbe.ts3537 gates
multiOrderConsumed on exact full count and excludes RIGHT/scalar owner. In this
case outer t primary-range supplies the only ORDER term; the inner rowid lookup
cannot reorder outer groups, even null-extension emits at that same outer key.
This supports exact0 sorter accounting for this witness, not broad joined-order
parity. Remaining partial-order branches are conservative and unreviewed here.
Parent owning semantic reviewer should approve coherent spec/capture contract
update; this leaf still does not mutate sibling manifests or claim225 green.

## Coherent residual proposal set / attempted full gate

[LEFT spec+capture proposal](left-order-expectation-proposal.patch) now changes
only sorterRows to exact0 in source spec and three captured expectation carriers;
no native rows/opcodes edited. Alongside both window witness proposals, disposable
full three residual files **93/93 exit0**, `proc-64644f907db8`, log
`afea81df96404b54ccf0af15a53361abd6328432fb05af7cd5bfb2584cf70ac3`.
All proposals remain unapplied for parent/owner integration.

A serial original225 diagnostic was then attempted but interrupted after14
recorded results because required fixture environment was omitted: CHINOOK_DB
required failure was explicit in aggregate-group test, plus candidate-lifecycle
and canonical checkpoint failures. [Partial input/exit/log hash inventory](residual-proposal225-interrupted.json)
retains these; killed `proc-78130711a334`, no225 credit. Next full gate must
recover prerequisite environment/fixture inputs from prior successful runner,
not treat residual93 passing as original225 acceptance. This is a harness setup
error, not a product or unavailable-access blocker.

## Recovered original environment / resolved disposable outcomes

Read canonical runner `tools/test/integration.py`: CHINOOK_DB and JSQLITE_CHINOOK
both `examples/browser/chinook.sqlite`. Copied original fixture and pin manifest
into disposable copy. Serial original225 completes **221pass/4fail/no timeout/no
test-input drift**, `proc-6477220524cf`; all three original residuals pass with
proposals. [Complete per-file inventory and separate retries](residual-proposal225-corrected.json)
SHA256 `77ed4d367a2c697f863e815e845587da5ddf31722ebb4485180c049cae41c08c`.
Four failures are omitted copy dependencies, not product failures: card-u-history
guide, two card-s-f-or native captures and parser tools/profile. Copying evidence
and tools gives three retries exit0; generator first retry still1 for omitted
profile, then2/2 exit0 after profile copied (`proc-a1aa26c70d3a`, final log
`b4d928d613de49a9b2ba450bce190e39a20b595a16d0ae5d8ef9e67e4f880650`).

Attempted recursive reference copy raised shutil.Error following a preexisting
self-link; later commands succeeding do not erase it. Generator needed only
specific pinned files/profile, which were present. No workspace symlink repair
or peer change was attempted. These are resolved per-file disposable outcomes,
not a single all225-success invocation or approval of unapplied proposals. A
complete packaged/reviewed candidate gate remains required for acceptance.

## Single complete disposable225 gate

After dependencies were recovered, full serial original inventory run completes
**225/225 exit0,0timeout, entire packaged ordinary-file input drift=[]**,
`proc-2e248e20ec3b`. [Exact complete report](residual-proposal225-complete.json)
retains environment, inventory hash, all packaged input hashes and every per-file
exit/log hash. This supersedes the incomplete harness acceptance result, without
deleting its failures above. Includes unapplied witness proposals, unchanged
consumer runtime; no work-tree test approval/publication, independent fidelity
review, browser re-signoff or whole-suite compatibility credit.

Authentication recheck: HEAD remains1e2d0524; runtime VDBE54fc006d and
planner8cdd7be1 remain unchanged. Current default-index digestcd521b3c differs
from historical1c1b73e8; provenance of peer staging change not inferred and index
not rewritten. Re-read live entrypoint and replaced obsolete accounting-phase
assertion; historical evidence remains linked. Next parent review/integration
can use this exact complete gate instead of repeating partial setup diagnostics.

## Isolated parent-review integration proposal

External temp index based exactly on f45 yields tree
`75a4bbe8a5a4c77306082a692946f6751bfee4b6`:
[authenticated delta manifest](residual-proposal-tree.json). Only endpoint,
window cache witness and LEFT source spec change. Initial four-delta assertion
failed (`proc-0d6f94cf841d`) because f45 capture already carries exact0; corrected
three-delta assertion succeeds, capture is byte-identical to tested disposable
input (`proc-a47626942c0c`). No code delta/default-index/commit/ref publication.
Current indexcd521b3c unchanged through this operation. This explicitly exposes
work-vs-candidate expectation difference rather than silently credit work inputs.
Parent review now has concrete integration payload; complete225 is still packaged
input evidence, not fresh isolated-archive/native/browser acceptance.

## Fresh isolated consumer gate

Exact tree75a4bbe8 git archive extracted under purpose-scoped work directory,
no source overlays; node_modules shared read-only dependency link. `npm run
typecheck` exit0, log `a5f713a9451427c94bafb807a648b42343d7fafc0f0d2136ed0e53dd7f9dafae`.
First affected command used a nonexistent conformance primitive-test path;
Node ignored it and reported310/310 exit0 (`proc-7f59255fa2cc`), not315 credit.
Corrected explicit `test/value/private-key-vm-interruption.test.mjs`, first5/5
then full **315/315 exit0** `proc-dbdfe0bef47c`, isolated-315.log
`c8b9de061d2f84cd405fa0e424487b7c3d9343ba9095c451777cd5cf8ac28e4c`.
This authenticates actual affected coverage on the proposed tree; it is not
native/browser or fresh archive225 credit. No ref/default-index publication.

## Fresh isolated native metadata/INNER and actual browser

Exact75a4bbe8 archive recaptures pinned metadata and INNER-primary JSON and
bytecompares both successfully (hashesf41f6d67/e3ee0068 unchanged); build exit0,
log3affa088ec918ba1440d5a01b52387affbe9480f9b88c4d0b91b95337264c22e.
First browser failed MODULE_NOT_FOUND Playwright; configured existing dev-only
module retry failed missing default-cache executable. Neither was product pass.
Explicit existing purpose-scoped browser cache plus module path succeeds actual
Chromium selected6/6 (not46/full lane), `proc-1cc627f07602`, final log
`e0ec1c2024cf87cdcf714bfe6ccad797761de7d3011ab871d7c95122b0d257b2`.
[Fresh report](browser-residual-isolated-report.json) SHA256
`c7234f5f333fddd2e31b0468b19390489475853b5a55907aaae52014aec5bb9b`
authenticates dist/fixtures/source and actual results. No package dependency or
operator routing change. Native recapture is supplemental metadata/INNER truth,
not the complete source-case/native harness gate; fresh archive225 and independent
review remain. Work runtime/index/main/peer files untouched.

## Fresh archive225 and expanded source capture

Exact75a4bbe8 archive original225 serial run: **224pass/1fail/no timeout/no
test-input drift**, `proc-92e4e4ab01a5`; [all exits/input/log hashes](residual-archive225.json).
Only failure generator omitted pinned src/parse.y from archive (reference source
is external prerequisite, archive only has upstream tests). Added only four
pinned generator source inputs (parse.y/lemon.c/lempar.c/mkkeywordhash.c), then
**2/2 exit0** `proc-36dc93a51800`, retry log
`c6e89ef7f3fa2087c8e0ca552b4d2b4dc22bff96cc5eb51f5a52014ff539ddf5`.
This is224+separate resolved prerequisite retry, not single archive225exit0.
Source-input hashes are in process result; no production overlay added.

Fresh expanded whereI capture sourceId/library authenticated, bytecmp0 with
candidate capture, `proc-246904e70567`/`proc-e8c5558dbd95`, JSON hash
`ada08c15cbc6d85434dc1d129faf1b73a29503cd8c99a2ab60920948924a57a3`.
Four additional execsql cases plus prior3.0 remain five source cases; encoding,
setup and EQP are not new cases. Selected public source tests included in315.

Bounded reproduced consumer gap and three corrected witness reproducers now
pass. Independent milestone review/publication remains separate and unapproved;
this executor result does not grant optimizer/full-suite compatibility. No need
to indefinitely repeat green reproducers solely awaiting later review.

## Refactor node: no additional runtime cleanup

Inspected isolated75a4bbe8 shared Case5 helpers and call sites. KeyInfo slicing,
identity/dedup branch emission, duplicate target patching and primary positioning
already have single owners used by both builders. Builder-local register/return
and residual/readiness ownership is intentionally retained; merging whole
builders or reorganizing accepted VM machinery would be unrelated risk, not
justified cleanup. Residual proposal delta is test/spec only. No new runtime or
test edits, no milestone/ref publication.

Required fresh focused command on isolated tree reruns same explicit nine files
(including actual test/value primitive path): **315/315 exit0**, process
`proc-44a8407eaa2f`, refactor-focused.log SHA256
`108222907895e8abe98bfd2306f7dcdb973c261fb984ca36923559169d946fd8`.
Earlier prerequisite/coverage/harness failures remain above; no full225 or browser
rerun claimed for this no-change structural assessment. Refactor-node completion
means accepted bounded behavior remains intact, not independent milestone approval.
