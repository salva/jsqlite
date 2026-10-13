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
