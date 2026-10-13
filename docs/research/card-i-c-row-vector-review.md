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
