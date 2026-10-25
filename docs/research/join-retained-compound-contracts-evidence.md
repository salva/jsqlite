# Linked joined/retained compound controls — bounded author evidence

## W172 current scheduling adjudication

On HEAD143 plus the uncommitted W172 repair delta, the old correlated-start16
assertion is stale after ready-frontier restriction placement. Pinned
`wherecode.c:2615–2688` tests ready t.x=a.x before opening u;
`select.c:1412–1415` SRT_Exists relies on LIMIT to stop after presence;
`select.c:3020–3045` shares that LIMIT across UNION ALL arms and skips the
second arm when exhausted. Actual starts are outer1 + first empty correlation
both arms4 + matching correlations first arm2 each =9. A per-row regression
requires cumulative5/7/9 and repeats after reset, rather than only changing a
golden total. Existing uncorrelated Once4 and vector-IN9 controls are retained.
A throwing second arm is skipped for matching correlations but raises saved
integer-overflow/reset error for the empty correlation; the same new SQL is
captured independently through pinned native prepare/step/reset in all encodings.

Fresh capture `proc-da5ba9e6e17b` precedes the public11/11 run, then typecheck
and diff check; receipt includes14 SQL ×3 encodings, two executions each.
It reuses the authenticated W approved-2b35 library (sourceID remains the pin),
not a new native build. Raw receipt:
`work:///cards/card-s-c-d-e/w172-compound/native.json`; retained current receipt
is `join-retained-compound-contracts-native.json`. Exact final combined results
and remaining validation/delivery obligations: [[card:card-s-c-d-e]] status.
These finite controls do not claim full scheduler/access/resource equivalence.

## Current finite resource observer contract (beta5)

The old128-byte assertion below is revision-bound sorter-only evidence, not the
current aggregate execution budget. On05f3, automatic-index construction owns
packed pages and keys before the joined merge; the Once/Rewind/MakeRecord/
IdxInsert/Next producer (`vdbe.ts` automaticLevels) follows pinned
`where.c:constructAutomaticIndex`1180–1222. It retains all three source keys,
not only the two eventual joined output keys. `PrivateBlobkeyPages.#newEntry`
therefore correctly rejects entries2. OpenAutoindex shares the OpenEphemeral
arena admission/cleanup owner. No accounting policy or runtime fix is warranted.

The current tests observe demand at actual reserve/observeDemand boundaries:
all encodings require entries3 and independently test entry demand minus1,
key-byte demand minus1 and aggregate-byte demand minus1 versus exact success,
with two executions/reset and saved first error. Original1/15/127/128 negatives
remain; two sorter records still reserve128 logical bytes in total, and the
injected first sorter growth reserves32 then rolls back. Those are not aggregate
highwaters. Actual page/record/scratch/Mem ownership remains charged until its
owner releases it, with cumulative charged/refunded equality at cleanup.

Derived VALUES with maxPrivateBytes1 fails live text-register admission before
sorter admission: pinned `vdbemem.c:sqlite3VdbeMemSetStr` validates length and
allocates transient backing before copy/publication. TS Mem.#ownBytes admits
before build and refunds a failed unpublished producer. The all-encoding tests
keep that negative and separately measure actual sorter-insert overlap, requiring
sorter-specific rejection one byte below and exact-boundary success/reset.
Cancellation/deadline/finalize and connection reuse remain explicit checks.
This is observer correction, not native heap-size equivalence or quota inflation.
Detailed commands/results and attempted hypotheses: [[card:card-m-f-k]] status;
original reproduction record:///status.md?card=card-m-f-k&v=245 and narrowed
entry-limit diagnosis record:///status.md?card=card-m-f-k&v=246.

## Historical implementation evidence (revision-bound)

Input runtime: `ef3dc8e7aa297463b0588968c751ff6f7d964427`, in the existing exact archive extraction, plus the single owned pre-emission dispatcher hunk copied from the workspace and new tests/receipt. No other workspace runtime substitution. Successor commit is not delivered yet.

## Source comparison and current diagnosis

Pinned SQLite 3.53.4 `expr.c:sqlite3CodeSubselect` initializes Mem/Exists destinations, uses conditional Once for uncorrelated children, reruns correlated children, and sets the scalar/Exists LIMIT. `select.c:selectInnerLoop` skips EList value production for SRT_Exists and emits presence, while Mem produces values. `multiSelect` TK_ALL shares destination/LIMIT between left and right producers. The installed `compileWideSubquery` validates widths, retains linked plans, and admits table-backed UNION ALL without ORDER for these linked destinations; ordered or set table subqueries remain explicitly rejected. The new tests verify vector-IN/Exists, scalar/IN width errors, correlated versus Once scan starts and reset, not general subquery expansion.

The added retained barrier discriminator exposes a real dispatcher gap: unordered ALL reaches `select-compiler.ts`'s `compileCteUnionAll` before the joined full-row compiler. Its `else if(arm.from.derived)` calls `compileDerivedProducer`; that narrower producer declines retained-child-plus-JOIN and throws `retained derived arm is not represented`. The same bounded producer is already installed in `compileSimpleTableCompound` via `compileResolvedTableProducer`. Pinned `multiSelect` TK_ALL dispatches each SELECT with the shared destination; it does not make the existence of a retained FROM item select an unrelated narrow producer. This is an implementation gap inside the accepted ordinary rowid JOIN + single-table ORDER/LIMIT boundary, not a justified exclusion.

Implemented correction: `compileCteUnionAll` now dispatches bounded width2/3 retained JOIN table arms to the existing `compileSimpleTableCompound` resolved full-row owner before emitting an arm. Its existing complete eligibility/resolution gates and shared builder/destination remain authoritative. Linked/scalar-prepared/shared-limit/expression-binding owners keep their specialized path; no re-resolving correlated caller is introduced. No new evaluator or merge algorithm is added. proc-190e73032207: final controls9/9. proc-4002761c988a: typecheck followed by five-file focused suite **81/81**, fail-fast chain exit0; output `work:///cards/card-j-d-b-a-c/processes/proc-4002761c988a/stdout.log`, totals tail read. This is candidate delta evidence, not exact successor-commit acceptance.

Correction scope: give the unordered ALL semantic owner a bounded resolved projected-row route to the existing retained installer, preserving its enclosing builder/parameters, shared LIMIT/OFFSET and raw versus projected consumer distinction. Validate full width/retained eligibility before publication; retain specialized aggregate/window/CTE paths and reject genuinely unenrolled shapes atomically. Do not merely add ORDER to SQL, bypass the failing test, suppress the exception or substitute workspace runtime.

## New primary evidence

- `join-retained-compound-contracts-capture.py`: fresh pinned read-only native comparison, sourceID checked against manifest and exact existing fixture hashes. Library SHA256 `dacef3c55e931e821d1af0dc97c253e28794de3d6c10bb05862c6601b6f9730b`. Receipt `join-retained-compound-contracts-native.json` has **11 SQL ×3 encodings**, each successful prepare twice reset or exact native prepare/step error. proc-59c710187619: retained barrier prepares successfully and returns no rows twice in all encodings. Existing native129 receipt is unchanged.
- proc-d82cf0530dd3: initial three controls passed. proc-7e3975ae8d12: five controls passed after adding invocation counts and actual-sorter injected rollback. These precede adding the retained barrier and do not imply the final file passes.
- proc-34375f972fdc: combined original four focused files plus new controls **80/81**, one retained barrier prepare rejection. Output `work:///cards/card-j-d-b-a-c/processes/proc-34375f972fdc/stdout.log`, failing tail read. This input used the initial native30 receipt before retained barrier addition.
- proc-501098bdac93: final native33 receipt included; new file **5/9 passed,4 failed**, all four failures are the same retained barrier prepare rejection (three pinned encoding loops plus direct regression). Output `work:///cards/card-j-d-b-a-c/processes/proc-501098bdac93/stdout.log`, tail read. The subsequent candidate passing checks above resolve this failure on changed inputs.

Exact joined merge bounds: two sorters × two records × (16-byte full duplicate key +16-byte two-INTEGER payload) = **128 shared bytes**; entries2/key16/bytes128 passes twice, entries1/key15/bytes127 separately fail with first-error identity, reset and recovery. Test instrumentation on actual installed sorters observes peak128 and zero owned bytes after reset. Injecting a throw after the first actual growth observes peak32 and zero after rollback/VM cleanup. These are private-budget controls, not public result-row caps. Scan-start counters for the fixed fixture are4 uncorrelated Exists,9 vector-IN,16 correlated Exists, each reset run; they are TS execution-path evidence, not native opcode-count equivalence.

## Additional completed candidate validation

proc-444bc55b6684 exit0 (fail-fast) passed lifecycle/contracts/private-key **14/14**, compound **22/22** declared/attempted/credited, first SELECT **8/8**, bounded expressions, ORDER **10/10**, parser/generated **35/35**, and package boundary. Relational accounting remains **18 declared,3 attempted/passed,15 unattempted,2 upstream credits**, not18 passes. Full output `work:///cards/card-j-d-b-a-c/processes/proc-444bc55b6684/stdout.log` read completely.

The retained installed merge now explicitly tests live private budgets at first row, repeated reset refunds, complete rows, and deferred-close/finalize refund. Two earlier9/10 runs were fixture-cleanup mistakes: a second close on the already closed connection reports `misuse: connection is closed`, not `closed`; corrected the fixture, not runtime.

proc-14ea4c19e984 stopped before tests because bare `tsc` was not on PATH. Retried with the explicit project compiler: proc-7391d3f4fd71 exit0, typecheck, expression40 and cross-encoding checks, then DISTINCT/resource/relational lifecycle/host admission/private continuation/BLOB encoding **34/34**. Output `work:///cards/card-j-d-b-a-c/processes/proc-7391d3f4fd71/stdout.log`, totals tail read. These are candidate checks; exact successor replay is recorded separately in card status after delivery.

No global compatibility credit or independent approval is claimed. Same independent MAIN review remains required after scoped delivery and exact-commit replay. Original native129 and exact ef3dc8e7 archive72/typecheck remain valid only for their unchanged inputs.
