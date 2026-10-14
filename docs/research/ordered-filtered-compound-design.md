# Ordered filtered table-compound merge handoff

Draft for [[card:card-j-d-b-a-a]], addressing parent system review
`record:///review.md?card=card-j-d-b-a&v=30` R2 and the prerequisite assessment
portion of R1. This is an implementation decision, not runtime repair, technical
exception approval, MAIN integration approval or conformance credit.

## Decision and boundary

Replace the **ordered ordinary filtered/projected table compound** eager
set-then-global-sort route with pinned `select.c:multiSelectByMerge` control on
one VM. Reuse the repaired generated arm resolver, WHERE/projection lowering,
lexical parameters and metadata from b3ff51b; adopt a636669's exclusion fixture.
Use per-arm sorters when the resolved scan cannot supply the merge order. Those
sorters are upstream producer ORDER machinery, not an exception permitting an
eager global set population. A coroutine can itself sort all its input before
its first yield; we do not promise streaming table scans where C sorts them.

No concrete TS/browser/read-only constraint requires the current global eager
set algorithm here. Missing machinery is not a rationale. Do not pursue an
exception or expand scope to arbitrary JOIN/GROUP/window/WR/generated producers.
Keep unordered ALL sequential, and keep the existing unordered set route outside
this correction. Retain their accepted bounded evidence and limitations. Finite
scalar/VALUES dispositions are separate and are not authority for this route.

## Inspected current owners and required changes

Current HEAD is fb4974a002aefe56dcf38bf4f35c10902a4fbb16. The workspace/index
are heavily shared (3279 staged paths); neither equals the portable tip. Current
`compileSimpleTableCompound` has repaired standalone arm resolution and
predicate-before-projection scan, but chooses set/aux-set/delete transitions
and one final sorter. `compileTableCompoundProducer` reaches that fallback after
ordered CTE and ALL candidates. Its optional owner already carries the enclosing
`SelectProgramBuilder`, `ParameterBuilder`, and `SelectDest`.

`emitScalarCompoundMerge` already emits same-VM A/B coroutine bodies, previous-row
suppression, CompareJump permutation, operator/EOF continuations and shared
destinations. It accepts an `emitArm` callback and optional prepared plans/limit.
It is a starting owner, **not a drop-in certified general merge**: inspect/fix
ORDER matching, missing output-ordinal completion for non-ALL, recursive prefix
order and producer caps before extending admission. It currently always splits
at the final arm; source balances only contiguous same-op UNION/ALL runs >3.

Implementation seams:
1. Extract the resolved table `scan` body from `compileSimpleTableCompound` into
   a destination-driven arm emitter using the same builder/parameter owner. Its
   contract takes a resolved arm plan, inherited merge ordering, optional
   producer LIMIT register and destination; it emits no Program, public Halt,
   connection admission or global OFFSET. WHERE false/NULL and local DISTINCT
   misses return to the same scan's Next; stable output owns copied Mem values.
   Preserve arm-local DISTINCT before delivery and projection error timing.
2. Generalize/name the existing merge owner by destination rather than scalar
   syntax. Validate every arm and ORDER term before publishing any program.
   Share the actual resolver/ORDER owner, not another approximate expression
   matcher. The one-output table boundary is not permission to fork semantics;
   retain width-generic merge keys and reject unsupported widths at admission.
3. Dispatch eligible ordered table compounds from `compileTableCompoundProducer`
   to that shared owner, with repaired plans and the single prepared LIMIT.
   Supply the table arm emitter through the existing callback seam (extend its
   contract for inherited order/cap explicitly). Do not recursively call the
   compound fallback or relocate a child Program. Remove the ordered eager
   population branch for this slice; leave unordered behavior undisturbed.
4. Keep `emitSelectDestination` for public, coroutine, sorter and ephemeral
   destinations. Producer sort tails yield to A/B stable row registers. Allocate
   every cursor/register/label with the enclosing builder, including nested
   merge prefixes, local DISTINCT cursors, sorter keys and return registers.

## Source control and invariants

Pinned authority is reference/sqlite/manifest.json, SQLite 3.53.4. Relevant
select.c owners are `selectInnerLoop` (1139ff), `generateOutputSubroutine`
(3106ff), `multiSelectByMerge` (3399ff), merge key construction (2600ff),
`computeLimitRegisters`, and compound-to-subquery conversion (5512ff).

Resolve compound ORDER against result ordinals/aliases/expressions across arms,
retaining explicit COLLATE. For non-ALL append missing output ordinals. Pass the
same normalized order to both producers. Build **separate** immutable KeyInfo:
merge terms include ORDER direction/NULL placement/collation and permutation;
duplicate terms cover all outputs, compound collation, no affinity or sort flags.
NULL equals NULL and INTEGER/REAL compare numerically without coercing emitted
storage class. Do not select duplicate representatives with JS Set or sorter
sequence numbers. regPrev comprises validity plus copied full output row and is
updated before OFFSET, including skipped unique rows.

| Comparison/EOF | UNION ALL | UNION | EXCEPT | INTERSECT |
|---|---|---|---|---|
| A<B | out A; next A | out A; next A | out A; next A | next A |
| A=B | out A; next A | next A | next A | out A; next A |
| A>B | out B; next B | out B; next B | next B | next B |
| EOF A | drain B | drain B | end | end |
| EOF B | drain A | drain A | drain A | end |

Initialization matters: yield A first. If initially empty, UNION/ALL advances B
before any out-B; EXCEPT/INTERSECT can end **without evaluating B**. Existing
shared merge's unconditional initial-empty A -> yield B branch must be split by
operator; do not propagate it as source fidelity. After initial B EOF, A is
already positioned. Next-A/Next-B EOF branches consume only positioned surviving
rows. EndCoroutine must return via its suspended caller Yield.P2; no stale row
output or coroutine restart. Reset restores PCs, validity and cursor positions.

Use existing InitCoroutine/Yield/EndCoroutine, Gosub/Return and typed
CompareJump/CompareGroup (fused Compare+Jump and equality) rather than inventing a
host generator. Fused ops must retain source term order/permutation, NULL/DESC
handling, no-affinity numeric comparison and branch labels. Current handlers
loop terms synchronously: verify/add deterministic term work/control accounting
at their owning VM handlers, without partial-row re-evaluation or changing all
other callers silently. Cross-check pinned vdbe.c OP_Compare/Jump and coroutine
PC conventions, including empty, first, next and repeated EOF paths.

Translate source splitting: final-arm split for <=3 and EXCEPT/INTERSECT; balanced
only maximal contiguous identical UNION/ALL runs when the matching optimization
is enabled. Never regroup mixed operators. A recursive prefix is a sorted
coroutine destination, not a materialized completed compound graph.

## LIMIT, parameters, metadata, lifetime and errors

Evaluate/coerce global LIMIT once; zero jumps before OFFSET or producer work.
Nonzero coerces OFFSET once; negative LIMIT unbounded, negative OFFSET zero.
Only ALL copies LIMIT+OFFSET capacity separately to **both** A and B producer
caps, while retaining global output counters. These are not partitions. Sets
must not truncate membership. In output: suppress duplicates, update regPrev,
consume OFFSET, emit destination, then decrement LIMIT. Producer ORDER top-N
must use the source-appropriate inherited cap, not maxRows. Check negative and
large capacity arithmetic at OffsetLimit, not host addition.

Retain lexical generated-terminal parameter identity seeded before any producer
or LIMIT emission (b3ff51b). One immutable Program parameter table serves all
coroutines, including nested prefixes. Bind/reset changes values, not identities.
Separate name/type/origin production from duplicate collation. Preserve leftmost
names and the repaired rightmost type/origin for explicit ORDER COLLATE
compound-to-subquery conversion; invoke that owner before merge dispatch rather
than reverting to a generic leftmost metadata rule. Per-arm resolved descriptors
and immutable KeyInfo survive suspension and valid deferred close.

Preparation errors (unsupported structure, widths, resolution, ORDER/collation)
are atomic: no prefix executes or statement escapes. Runtime predicate/projection,
LIMIT, input/sorter and cancellation errors follow emitted producer scheduling.
In particular empty A EXCEPT/INTERSECT must not expose an error from unused B;
UNION/ALL must position B. With nonempty A, its sorting/error work precedes B's
initial sorting/error work. Ordered producer retention can still fail before a
small public LIMIT produces a row, as in the source producer path.

Private entry/key/aggregate byte bounds stay separate from public output maxRows
and maxResultBytes; public rows charged only at ResultRow, not coroutine yields.
All cursor allocations use existing program.privateStateLimits/accounting.
Dispatch, compare terms, scan advances, copies and sorter moves share the work
owner; no budget reset per arm. Host yields retain VM PC, coroutine PCs/current
rows, regPrev, sort phase, limits and first error. Pending step holds serialized
connection admission, rejecting overlapping closeDeferred synchronously. After
settlement valid zombie close preserves schema/storage/program/KeyInfo until last
statement destruction. Halt/reset/finalize/error attempts every private cleanup
once; prior error wins over cleanup. No restart after suspension or cancellation.

## R1: minimal prerequisite union and MAIN route

Direct `git diff fb4974a 5824904 -- src` has only five source paths: index.ts,
pragma.ts, schema.ts, select-compiler.ts and vdbe.ts. The vdbe prerequisite hunks
are metadata-TVF, JSON provenance and MetadataFilter runtime changes, **not**
compound scan/merge/parameter owners; schema changes STAT4 sample decoding;
select-compiler changes resolver diagnostic propagation. These are peer deltas,
not structural prerequisites for b3ff51b's compound repair. Same-VM merge,
KeyInfo, builder/destinations, private bounds and lifecycle are already in HEAD.
The 120-path checkpoint is thus not the minimal source union for this repair.
Do not import its apparent reversions of unrelated HEAD behavior.

Minimal source candidate is HEAD + b3ff51b's owned vdbe hunks, with its focused
parameter regression and three research files, + a636669's one exclusion-test
file. Add the new shared merge/arm-owner correction and route tests. Preserve
peer edits in overlapping vdbe and guide files; hunk ownership reconciliation is
Planner work, not permission to replace whole files from either portable tree.
Tests also use existing fixture-server/public adapter/suspend/cleanup helpers
and compound-metadata fixture: record their exact integrated identities and
include any genuinely changed required input only with its owner. No evidence
here establishes that every test/config/doc path in paths.json is necessary.

Coherent MAIN route: Planner assigns overlapping owners; form an explicit
HEAD-relative scoped delta of the repair/overlay/merge correction plus reviewed
prerequisite hunks, not cherry-pick 5824904 or sweep the real index. Prove that
candidate from committed source with the focused acceptance inventory, then
integrate only the assigned union, preserving staged/unstaged peer bytes. Record
actual MAIN commit/tree and repeat required integrated acceptance. Alternate-index
portable proof may inform integration, never stand in for MAIN acceptance. Retain
DELIVERY failed/external-fixture runs and hygiene qualifications. No full corpus
quota or broad-green claim is added. Runtime integration is the consuming node's
work, not performed by this architecture draft.

## Source-based acceptance discriminators

Native captures must be independently obtained first using pinned sourceID and
public typed rows/metadata/errors, then test TS prepare/bind/step/reset/finalize.
Retain all five storage classes and three database encodings, not stringified
JSON-only equality. Required bounded matrix:
- Each operator: empty A/B/both; less/equal/greater; one side EOF first; repeated
  duplicates; mixed left-associated chains and >3 identical-arm runs.
- INTEGER1 versus REAL1 (UNION chooses B when equal; INTERSECT emits A), NULL
  duplicate suppression, TEXT/BLOB distinction, large exact integers versus REAL,
  NOCASE/RTRIM equivalence and explicit ORDER override separate from set equality.
- Multiple ORDER terms/permutation on shared width-generic paths, DESC and NULLS
  placement, ordinal/alias/structural matching and invalid ORDER preparation;
  table route still rejects widths beyond its represented admission.
- LIMIT0 + invalid OFFSET + throwing producer => DONE; nonzero invalid OFFSET
  => error before scan; positive/negative caps and OFFSET through duplicate runs;
  ALL producers each get equal capacity, no set membership cap.
- Empty filtered A EXCEPT/INTERSECT + runtime-error B => no B evaluation; UNION
  reaches B/error. Nonempty ordered A/B errors identify native first-error phase.
  Contrast old global eager route with coroutine scheduling via VM/source tests,
  not just final rows. Native opcode traces are supporting evidence, not TS credit.
- Lexically interleaved WHERE/projection/LIMIT parameters; reset/rebind; five-field
  metadata with/without ORDER COLLATE conversion, row/BLOB copy ownership.
- Public maxRows below producer/private row count but sufficient for output;
  independent private/work bounds, tiny chunk suspension during A sort/B sort/
  merge/output/EOF, cancellation/deadline and first-error cleanup. Reject overlap
  while pending, resume without restart, deferred close after settlement, reset
  and final destruction with exact-once private release.

## Validation and retained provenance

This draft performed source/diff/document inspection only, no runtime test runs
or implementation. Commands/output: current HEAD/index and guide inventory
`proc-fdedbd7faf17`, `proc-2628e8dec8cb`; source/current-owner comparison
`proc-fe3cf26471a7`, `proc-9c3a34038f3d`; prerequisite/hunk inventory
`proc-e428552423ed`, `proc-840278d976d3`, `proc-2cad865220c7` under
`work:///cards/card-j-d-b-a-a/processes/` (partial inline streams were read by
returned URL where used). DELIVERY and immutable parent review30 were directly
read. Portable a636669 evidence is retained as revision-bound reported evidence,
not rerun MAIN acceptance. Outstanding: implement and verify branch fixes,
prerequisite owner reconciliation, actual scoped MAIN integration and independent
component/system review. No conformance credit is earned by this design.
