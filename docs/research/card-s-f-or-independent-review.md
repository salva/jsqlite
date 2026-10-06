# Compound SELECT and multirow VALUES independent review

Card: [[card:card-j-d-b-a-d]]

Pinned SQLite: 3.53.4 (`bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`)

## Verdict

**Pass for the bounded contract.** The affected implementation and fixtures now have scoped committed provenance in `e39d279`. Unrelated advanced-index and documentation work remains unstaged and is not included in that commit.

This is not a general SQLite-compatibility claim. It is limited to the accepted scalar, structured VALUES, and bounded table-producer compound contract and its documented exclusions.

## Architecture and source-fidelity findings

- Generated Lemon reductions retain immutable arm, row, operator, source, ORDER, LIMIT/OFFSET, and derived-producer ownership. Lowering consumes these semantic carriers directly.
- Inspection found no second SELECT parser, SQL/token reparsing, catch-all compound evaluator, JS `Array.sort`, or JS `Set` used as compound duplicate storage. Static and runtime checks reject unsupported producer shapes atomically rather than executing a valid prefix.
- Set transitions remain left-to-right. Typed ephemeral state owns duplicate equality and representatives; global output/order and LIMIT/OFFSET state is shared without conflating duplicate and ORDER keys.
- The affected control-flow repairs align the TypeScript path with the relevant pinned `parse.y`, `select.c` (`multiSelect`, `multiSelectValues`, `selectInnerLoop`, coroutine destinations), `resolve.c` compound ORDER ownership, and VDBE cursor/jump/cleanup behavior: stable coroutine output registers, complete embedded-target relocation, correct rowid bound direction/termination, residual predicate retention, prerequisite readiness, and reset/finalize cleanup.
- Finite typed materialization remains the documented browser/TypeScript substitution for SQLite coroutine merge machinery only within admitted bounded producers. It preserves typed records, collation/affinity, ordering, metadata, suspension, cancellation, limits and cleanup; broader forms remain temporary unsupported.

## Executed evidence

- Fresh pinned native compound recapture: **22/22** core and **12/12** boundaries exact.
- Public TypeScript compound gate: **22 declared / 22 attempted / 22 passed / 22 credited**.
- Generated parser: **29/29**.
- Compound unsupported/atomic rejection: **3/3**.
- First-SELECT: **8/8**.
- Expression functions: **40/40 credited**; no-credit companions **12/12**.
- Expression cross-encoding: **3/3** over UTF-8, UTF-16le and UTF-16be.
- Expression bounded/resource suite: all six named checks.
- Relational/order/distinct/private-state/lifecycle selection: **60/60**.
- Derived VALUES focused regressions: **9/9**.
- Full affected subquery/view target: **192/192**; frozen manifest validates 46 native captures, 19 native-tranche credits and 15/15 companion credits.
- TypeScript typecheck, Python package boundary and `git diff --check`: pass.

Primary current-tree run: `work:///cards/card-j-d-b-a-d/processes/proc-d273499c2194/stdout.log`. Additional focused evidence: `proc-1596d1393e94`, `proc-e543b5cbf230`, and `proc-d8daf3c010ac`.

## Adversarial findings and repairs

1. Embedded derived programs had incomplete control-target relocation. Typed jump targets, coroutine sentinels, private/sorter empty jumps and generic jump carriers are now relocated while register/cursor/root-page operands remain untouched.
2. Flattening could drop derived ownership and subquery-residual state. Immutable carriers now survive flattening and residual predicates are not omitted merely because one rowid constraint is omittable.
3. Rowid range scans had incorrect target, direction and cursor-continuation behavior. The owning scan primitives now terminate and advance consistently, including reset/rebind.
4. Multi-source rowid drives could consume an RHS before its prerequisite source was ready. Candidate use now respects ready masks.
5. Resource/first-error fixtures ordered an INTEGER PRIMARY KEY and therefore did not create the claimed inner sorter. Ordering by non-rowid `b` forces the intended private owner and injectable sorter error.
6. Required expression safety fixtures accidentally relied on unordered table output. Concurrent covering-index planning legally returned `key-000001` before `min`. The fixtures now use `NOT INDEXED` only where their deliberately arranged first/second rows define the encoding/output-limit cleanup scenario. This does not add an unordered-output guarantee or weaken the failure assertions.

An attempted `ORDER BY rowid` discriminator was rejected because it changed the bounded execution/destination path and caused the oversized row to fail on the first step. The failed probe is preserved at `proc-3f9b371a9720`; the reverted, intended route passes in `proc-d273499c2194`.

## Hygiene and scope

Scoped implementation and test changes are committed as `e39d279` (eight files, 109 insertions, 32 deletions). The commit excludes unrelated modified documentation, `where-plan.ts`, advanced-index tests, and untracked corruption fixtures. The remaining dirty worktree therefore does not obscure the review commit’s exact diff.
