# A4 grouped recursive setup destination — focused author evidence

Base: CF04 candidate `29240bf09cb50b70acf0f1bb6c235b8048d13940`, tree
`4283071ec50c4c14a62d851f7dd3d5ad8bd0b41c`, itself exact G20-based.
Original candidate and its patch are preserved, not amended. This delta lives in
`/work/jsqlite2/a4-candidate`; no root checkout/index or publication mutation.
Accepted red: `record:///status.md?card=card-n-c&v=77`.

## Source and diagnosis

Pinned SQLite 3.53.4 `select.c:generateWithRecursiveQuery`, lines2788–2793,
detaches setup and calls ordinary `sqlite3Select(pSetup,&destQueue)` before
Queue iteration. Both table and source-free producers must retain that destination
through delegated compilation. `compileScalarSelect`'s source-free GROUP branch
calls `compileAggregateSelect` with `owner.destination ?? output`; the recursive
setup caller supplied only `emitRow:enqueue`. HAVING0 concealed this omission;
HAVING1 emitted ResultRow directly and left Queue empty. No runtime queue defect
or need for a second grouped evaluator was found.

The repair forwards existing `queueDestination` alongside scalar `emitRow`, as
other ordinary producer callers already do. Scalar emission, ordinary aggregate
final output, history suppression and priority all reach the existing shared
destination. Initialization, first/next queue transitions, recursive STEP,
body/consumer LIMIT ownership, error order and private runtime remain unchanged.
No exceptional algorithm substitution or scope expansion is involved.

## Reproducer and phases

SQL: `WITH RECURSIVE c(n) AS (SELECT 1 GROUP BY 1 HAVING 1 UNION ALL SELECT n+1 FROM c WHERE n<2) SELECT n FROM c`.
Original candidate returns INTEGER1 only; native returns INTEGER1,2. External
packet A4's HAVING0 witness was against G20; candidate29240bf0 already correctly
returns empty for it. Red evidence: proc-a74945867e55 and proc-677d3290c6f8
under `work:///cards/card-n-c/processes/`.

`recursive-cte-setup.test.mjs` adds true/false-HAVING, DISTINCT, WHERE-empty and
seed-expression-overflow controls across UTF-8/16le/16be. Successful controls
check types, all five metadata fields and two reset runs; overflow must fail at
first step before output, and public finalize rethrows retained failure. That
finalize assertion is public lifecycle evidence, not native finalize equivalence.
Tests-first command failed3/3 with actual[1n] versus expected[1n,2n]
(proc-93439765a232); the one owning caller correction then passed.

## Commands and outcomes

From the new worktree:

```sh
timeout 80 node --experimental-strip-types --test --test-concurrency=1 test/conformance/recursive-cte-{setup,resolution,aggregate,compound,join,left,repeated,right-full}.test.mjs test/conformance/select-recursive-builder.test.mjs &&
timeout 100 node /work/jsqlite2/node_modules/typescript/bin/tsc --noEmit && git diff --check
```

36/36, typecheck/diff pass: `work:///cards/card-n-c/processes/proc-e7ab0d83608e/stdout.log`.
Same denominator as original36, now with additional assertions inside setup tests.

Disposable `a4-green/probe.mjs` differs from retained `a4-red/probe.mjs` only in
candidate path; native driver uses unchanged original fixture bytes and existing
pinned oracle. `a4-green/matrix.mjs` similarly retargets the original CF04 matrix.
Commands:

```sh
NODE_DISABLE_COMPILE_CACHE=1 timeout 100 node --experimental-strip-types "$SAIVAGE_CARD_WORK_ROOT/a4-green/probe.mjs"
timeout 100 python3 "$SAIVAGE_CARD_WORK_ROOT/a4-green/native.py"
NODE_DISABLE_COMPILE_CACHE=1 timeout 100 node --experimental-strip-types "$SAIVAGE_CARD_WORK_ROOT/a4-green/matrix.mjs"
timeout 100 python3 "$SAIVAGE_CARD_WORK_ROOT/a4-green/matrix-native.py"
```

Full A4 observations: proc-6618565fd712. Explicit keyed comparison of retained
JSONL outputs: proc-9133b949d22b, **15/15 A4 records and33/33 original matrix
records match**. Comparison includes all native record fields (typed rows/full
metadata/two runs, or phase/code/message), excluding separately reported public
finalize. True HAVING now returns1,2; false/empty return[]; DISTINCT returns1,2;
overflow fails at step code1 `integer overflow` in both before any output.
Original33 matrix preserves physical seeds, empty/multirow, history, priority,
body controls, aggregate/join consumers, qualifiers and NOCASE. CF02 resolution
suite is included in fresh36; its earlier exact-base evidence remains separate.

Oracle: SQLite3.53.4 source ID
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`;
existing test-only `card-e-h/oracle-build/build/libsqlite3-oracle.so`, SHA256
`b8ba542c98b52a3b7a8644f44d1dc0f9eb69488165c482f574753537b9543dea`.
Driver checks manifest identity. Fixture generation
`g-fee22cf861600cad6529c65e4a6561aeedca2a0405e64643575b7752aa9d2fd0`;
encoding hashes retained in proc-6618565fd712. No dependencies/network introduced.

This is author evidence, not independent adjudication, root enrollment, full
compatibility or package/browser acceptance. Upstream assertion credit unchanged.
General setup composition and recursive STEP gaps remain. G8 tooling/dependency
restrictions remain; no integration/publication or downstream node was begun.
