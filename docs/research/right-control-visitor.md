# RIGHT-interior address visitation

Candidate on integration-beta5 base `5fde32e20c278f8f84da1451dc53253f39d0dfb7`.
This removes unused construction, not a SQL compatibility or performance repair.
Independent corrective-delta review and root combined acceptance remain required.

## Source and ownership

Pinned SQLite3.53.4 source manifest identifies checkin
`bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`,
archive SHA256 `d18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b`.
Existing oracle source directory's manifest.uuid matches. Read
`vdbeaux.c:sqlite3VdbeNoJumpsOutsideSubrtn`995–1060 and
`wherecode.c:codeRIGHTJOIN`2864: verification inspects jumps, permits internal
continuations, exempt calls/intentional termination and owning Return chains;
it does not relocate programs. C debug code accumulates diagnostics/mutates Halt;
this change retains TS's existing fail-first internal error rather than changing
that contract. TS has no represented Noop/Explain in this return-chain helper.

Production census found exactly definition and one discarded-result caller of
`relocateControlTargets`. The replacement `visitControlTargets` returns void,
retains explicit address-bearing Op variants and order, and constructs no clone.
The existing callback return values are ignored (including false), not stop
signals. Exceptions interrupt at the original target and propagate unchanged.
Ordinary zero is visited; coroutine p2 and MustBeInt zero are sentinel skips;
InitCoroutine p3 remains an address. Optional emptyJump, three CompareJump targets
and numeric dynamic jump fallback retain their branches. Caller exemptions,
producer/compound-limit stops, return ownership, resolver binding and deferred
builder.finish validation are unchanged. No algorithm substitution or public API
change is introduced; no new generic visitor framework or exported hook.

## Test-first and bounded verification

Evidence directory: `work:///cards/card-t-c/right-verifier/`.
Accepted RED census and baseline194 are separately retained in
`work:///cards/card-t-c/right-verifier-red/` and [[card:card-t-c]] status410.

New `right-control-target-visitor.test.mjs` executes the actual private function
body using Node's TS stripper (no duplicated evaluator/export for tests). Before
repair: family/order/return-value/throw/immutability controls pass against old
helper, explicit read-only replacement assertion fails (`tests-first.log`). After:
all3 tests pass, including owning-return chain and deferred first-error control.
Frozen input/embedded expression/source identities remain intact; all explicit
families, optional/sentinel and numeric fallback branches are exercised.

`/work/jsqlite2/node_modules/.bin/tsc --noEmit` PASS. `timeout 80s node
--experimental-strip-types --test` over visitor, select-right-continuation,
right-nested, repeated-right-full and right-matched-safety suites: **203/203 PASS**,
zero fail/skip/cancel (`after.log`, proc-2975116efa22). Public suites reuse their
pinned-native typed row/metadata fixtures and reset/error/resource controls,
including encodings where represented; native was NOT recaptured. No exhaustive
fault/interruption/browser claim. Structural comparison (`structural.json`)
proves identical explicit case order and every source byte outside helper,
except sole caller rename, unchanged. Thus ON-WHERE binding/director defaults,
producer stops and validation schedule are untouched rather than rewritten.

## Contextual analyzers and limitations

Reused a's installed ESLint9.39.1/typescript-eslint8.48.1/TS5.9.3/jscpd4.0.5
and research config (no reinstall/autofix). License/engine provenance and
unsupported ESLint warning remain as in
[baseline](card-t-a-beta6-maintainability.md). Config requires its original
SAIVAGE_CARD_WORK_ROOT for module resolution; first invocation from t-c failed
module loading (exit2), corrected by command-local environment pointing to a.
Before input is `git archive HEAD src` in disposable baseline directory, not
modified production. FULL ESLint JSON reports retained in before/after directories;
both corrected runs exit0. `analyzer-context.json`: complexity51→51 for address
helper,455→455 for compileInnerTableSelect; total310→310 diagnostics.
Named no-change decision: preserve source-shaped variant dispatch and producer
branches; removal of accidental clone allocation is not a metric reduction goal.

Initial unrestricted-format jscpd attempt was cancelled while running; corrected
baseline typescript run with baseline flags min-lines10/min-tokens80,
max-lines1000000/max-size20mb timed out at80s (exit124); the after attempt
also timed out at20s (exit124). These remain failed/incomplete attempts, not passes.
The original-methodology follow-up is now complete: see [[card:card-t-a]]
[status25](record:///status.md?card=card-t-a&v=25) and its retained
[summary](work:///cards/card-t-a/right-verifier-analyzers/summary.json),
[authenticated inputs](work:///cards/card-t-a/right-verifier-analyzers/inputs.json),
[before report](work:///cards/card-t-a/right-verifier-analyzers/before/jscpd-report.json)
and [after report](work:///cards/card-t-a/right-verifier-analyzers/after/jscpd-report.json).
Both runs exited0 with54 eligible sources, empty duplicate arrays and0→0 clones:
no metric gain is claimed. Original flags/thresholds are unchanged; three short
inputs remain outside main min-lines10 coverage, with their unchanged hashes and
original supplementary evidence retained in a25. Selected license inspection is
not transitive legal certification. Before293.678s and after376.256s each stayed
below600s, but their sum669.934s does not establish aggregate600s batch compliance
or retroactively authorize overruns. Previously corrupt vdbe endpoint remains
untrusted. Source comparison, not tool output, proves the fix.
No quota, source exclusion, formatting or splitting was used to lower metrics.

Candidate stays uncommitted pending independent original nonauthor review.
Parent root combined full inventory/native/types/package/browser gates remain
outside this finite repair. Prior destination consolidation/review19 and e's
shared INDEX_INFO ownership remain intact.
