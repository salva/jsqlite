# CF04 bounded physical recursive setup

Input: accepted G20 `e35961afa5432ace021a493f37a9d5590ab03d87`, tree
`0123c8a652be8065bbdbce598f7fc1269f676ded`. Candidate worktree
`/work/jsqlite2/cf04-candidate` is detached from this exact input; the red
worktree and scripts remain unchanged. External original finding:
`/home/salva/review-inputs/jsqlite-select-composition-fidelity-20261027/FINDINGS.md`, CF04.

## Source and implementation

Pinned SQLite3.53.4, source ID
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
`reference/sqlite/sqlite-src-3530400/src/select.c`2788–2793 calls
`sqlite3Select(pSetup,&destQueue)` before queue iteration; selectInnerLoop1307ff
and1464ff own [Dist]Fifo/[Dist]Queue delivery, all-history suppression and
stable priority sequence. TS previously rejected every setup FROM and manually
compiled seed WHERE/results. This was missing machinery, not a platform adaptation.

`SelectDest.queue` now carries the existing cursor/history and optional priority
register/index mapping. `emitSelectDestination` checks history, inserts admitted
rows into history, copies priority fields and emits existing FifoInsert or
PriorityInsert. Runtime queue objects retain their sequence and accounting.
`compileRecursiveCteSelect` uses that same destination for setup and step. Setup
uses the existing resolved table producer or scalar producer in the enclosing
builder with shared parameters, registers and cursors; no completed Program is
relocated. The parallel manual seed expression loop is removed. Callers forward
schema/database through direct, multiple, retained joined, aggregate, compound
and window producer edges. The published Program retains the physical database.
Priority/history collation derives from the existing linked leftmost setup
expression resolver instead of a physical-column spelling approximation.

Recursive STEP validation and its bounded Current expression lowering are
unchanged. Body/consumer LIMIT gates retain their existing positions. No new
resolver/evaluator, native runtime or SQL-text special case. General compound
setup, arbitrary cross-feature composition and native planner/work-count parity
are not established; producers retain their own honest unsupported boundaries.
Existing retained-consumer materialization timing tradeoff is unchanged.

## Tests and trials

Tests first: `recursive-cte-setup.test.mjs` failed3/3 with setup unsupported
(proc-e59746a45949; command sequence subsequently exited0 due to inspection,
not because tests passed). First wiring emitted physical OpenRead without a
published database: proc-b6a34eeca5c0 failed3/3; corrected the Program owner.
Typecheck then identified missing multiple-producer database carrier
(proc-4b17f36f41f2), corrected with caller forwarding. Priority trial used the
wrong payload property and failed with missing Mem during shift
(proc-ff96c9d2584f); compared actual opcode/runtime payloadStart contract and
fixed destination production rather than masking the runtime failure.
Subsequent focused3/3 and typecheck passed (proc-585c12348690).

Committed companion covers all encodings: physical multirow and empty setup,
UNION/ALL all-history, stable priority order, body LIMIT/OFFSET, explicit NOCASE
duplicates, complete metadata/INTEGER values, two reset runs, rebind with empty
and nonempty seeds, cancellation/timeout/work failure and reuse/finalize, setup
qualifier error even under LIMIT0 and preserved CF02 consumer qualifier error.

Original reviewer probe is preserved under `cf04-red/`. Green copies under
`work:///cards/card-n-c/cf04-green/` change only candidate root:

```sh
NODE_DISABLE_COMPILE_CACHE=1 timeout 100 node --experimental-strip-types "$SAIVAGE_CARD_WORK_ROOT/cf04-green/probe.mjs" R0,R1
 timeout 100 python3 "$SAIVAGE_CARD_WORK_ROOT/cf04-green/native.py" R0,R1
```

Capture proc-98e26c011842: native/public R0/R1 agree in three encodings, typed
rows/full five metadata fields/two runs. Expanded eleven-query matrix scripts
`matrix.mjs`/`matrix-native.py` add empty seeds, distinct, priority, body bounds,
aggregate and joined consumers, two prepare diagnostics, and NOCASE all-history.
Capture proc-8c634d55770c; explicit field comparison proc-31787406a36c confirms
**33/33 native/public records** match (`enc,id,metadata,runs,phase,error,code`).
These are bounded companion comparisons, not upstream credit. Oracle library
`/work/jsqlite2/.saivage/work/cards/card-e-h/oracle-build/build/libsqlite3-oracle.so`,
SHA256 `b8ba542c98b52a3b7a8644f44d1dc0f9eb69488165c482f574753537b9543dea`;
driver verifies source ID and manifest. Fixtures CURRENT generation
`g-fee22cf861600cad6529c65e4a6561aeedca2a0405e64643575b7752aa9d2fd0`;
encoding fixture hashes retained in captures.

Final focused combined command (proc-b664f98fd32f):

```sh
timeout 80 node --experimental-strip-types --test --test-concurrency=1 test/conformance/recursive-cte-{setup,resolution,aggregate,compound,join,left,repeated,right-full}.test.mjs test/conformance/select-recursive-builder.test.mjs &&
timeout 100 node /work/jsqlite2/node_modules/typescript/bin/tsc --noEmit &&
git diff --check
```

**36/36**, typecheck and scoped diff pass. Public runtime companions are not
native lifecycle comparisons; no full suite, GUI browser or release claim.
No dependencies installed; G8 dependency-loss restriction remains unresolved.
Candidate review and separately authorized root G/W/V integration remain open.
See [[card:card-n-c]] status for final commit/patch identities and acceptance.
