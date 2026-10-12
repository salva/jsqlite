# Functional schema admission checkpoint

Current reproduction uses manifest-pinned 3.53.4, not the historical operator
3.46.1 lead. `capture.py` creates digest-bound fixtures and asserts exact native
source ID; `public.test.mjs` compares typed ordinary rows through public prepare.
Run capture with the prescribed pinned library and card-work fixture directory.

## Owning repair under review

`parse.y:1736–1840` produces trigger declaration and ordered step reductions.
`parse.ts` retains name, target, timing/event, UPDATE OF, WHEN and step trees;
`schema.ts` links table/view identities and publishes ordered immutable triggers
through the existing connection owner. Single-source expression binding retains generated Lemon identifier terminals rather than splitting identifier text on dots, matching `resolve.c` TK_ID/TK_DOT component ownership. Quoted dots, escaped quotes and qualified dotted aliases are covered through pinned all-encoding STORED/VIRTUAL direct/star/arithmetic/predicate/order/reset controls in `capture-identifiers.py` and `identifiers.test.mjs`; see [[card:card-e-l]] repair evidence. `trigger.c:sqlite3BeginTrigger` validates
object kind/timing; `sqlite3FinishTrigger` links steps, fixes database references
and inserts into the trigger hash during initialization. No writes or trigger
execution are enabled. Original SQL and root zero remain catalog facts.

The parser primitive now follows `tokenize.c:sqlite3RunParser`/`parse.y cmdx`
completion: internal trigger semicolons are grammar terminals. Lemon stops only
at cmdx completion with SEMI lookahead. Re-parsing every semicolon prefix was
rejected as avoidable repeated work; single-pass work/depth budgets remain.

Trigger row/metadata/reset/close checks now include view targets, same-name
trigger/table namespaces, overflow SQL, main-qualified read fixation and
init-busy variables becoming NULL. Exact native corruption controls cover
syntax, timing, nested cross-database reads, qualified writes, NOT INDEXED,
qualified declarations (including main) and orphan main targets, all encodings.
`build.c:sqlite3TwoPartName` rejects any qualified declaration during init;
`attach.c:fixExprCb` converts variables to NULL rather than rejecting them.
Original trees are retained separately from frozen initialized trees.
A logical retained-tree envelope participates in existing atomic publication;
this is not a measured heap budget. Persistent TEMP trigger rows still reject
explicitly as temporary unsupported rather than pretending to initialize temp.

Current checkpoint remains **incomplete**: generated TriggerStep fields now own SELECT/WHERE/SET/target/FROM and ordered
Upsert target/predicate/SET/WHERE chains. Native multi-error controls verify
step SELECT-before-WHERE-before-SET, step-before-WHEN, SELECT source-before-
projection, rightmost compound-before-prior, and upsert ordering. Parser tree
collection/freezing is iterative; 4,000-step triggers no longer overflow host
recursion and low-work limits still reject. Nested SELECT fixation now distinguishes the source-name/ON callback from
later projection and FROM-subquery descent. Ordered source lists, CTEs, UPDATE
FROM and inline-window ORDER-before-PARTITION have exact native competing-error
controls. These still use a retained grammar-tree projection with a source-only
prepass, not the complete translated Select/Expr walker. Avoid claiming full
walker fidelity or work parity; initialized named-source/DML-target flags now retain main schema identity,
fixedSchema/fromDDL and explicit-qualification notCte/hadSchema; original trees
remain untouched. Expression initialization retains fromDDL including NULL
replacement. Per-initialization weak caches share callback results with later
descent rather than redoing ON/CTE expressions. Full semantic Select/CTE
attachment and filter/window linkage plus adversarial expression depth remain
open; cached grammar carriers are not full resolver/compiler semantics.

Current single-source generated reads pass **102/102** focused controls.
STORED uses shared table-to-storage mapping, excluding VIRTUAL fields; VIRTUAL
retains generated Lemon expression identity and uses shared opcode lowering,
self-table binding with cycle cleanup, IfNullRow and affinity. Direct/star
result paths converge on that owner. Earlier red results below are historical,
not current admission. STRICT TypeCheck, alternate producers and wider
cycle/affinity/collation/null-row/index combinations require pinned native
controls before extending admission. Root compiler/expression coordination is
needed for shared resolved-source binding into join/aggregate/index producers,
not a parallel evaluator or a broad optimizer gate.

## Readiness categories (not beta certification)

- **Common functional:** bounded trigger ordinary reads and single-source generated controls pass (102/102).
- **Required safety/performance:** existing storage/record controls pass; remaining
  trigger semantic-walker ordering/depth controls are required before acceptance.
- **Deferred optimizer:** no cost, sample selectivity or native-plan parity claim.
- **Rare breadth:** unconsumed declarations remain temporary backlog, not scope
  exclusions. Full SPEC unchanged; no deadline or full-corpus gate is inferred.

Exact commands, earlier failures and outputs are retained in
`record:///status.md?card=card-e-h`; fixture outputs/build/test logs live under
card work `schema-functional` and `trigger-repair`. Package-boundary currently
fails on workspace runtime dependencies, unrelated to these scoped source edits;
no cleanup of operator/peer inputs was attempted.


Follow-up evidence: `proc-4bf6d2fe737a` parser 33/33, typecheck and 66/66
trigger public/native controls (45 exact CORRUPT, 21 ordinary admission).
Earlier field dispatch incorrectly assumed SELECT began the production rather
than scanpt; pinned parse.y comparison fixed this (`proc-e64bd42c40bb`,
`proc-214b73c75e3c`). Adversarial 4,000-step parsing exposed host stack overflow
(`proc-007bff2cca0e`); iterative owning tree utilities passed 4,000/8,000 steps
(`proc-6e952d2b9472`). Current logs remain in card status/work artifacts.


Nested follow-up: initial new controls failed 12/84 (four competing-error
branches, all encodings; `proc-805ac104a9b0`). Source callback/subquery phase
separation and source-prefix ownership repaired all 84 (`proc-4e86f9c6185f`).
A trial named-window admission was invalid natively and capture correctly
refused it (`proc-116403b1bc42`); recategorized as CORRUPT, not waived.
Inline-window ordering then failed 3/93 (`proc-5c646b78dd48`); pinned
walkWindowList ORDER-before-PARTITION fixed the owning branch. Final
`proc-813c7da8f00f`: focus 93/93, parser 33/33, schema/storage/record 372/372,
typecheck/accounting/diff pass; full reproducer 93/99 with six generated
failures, package dependency boundary exit1. Final redirected logs are card
work `trigger-repair/nested-final-*.log`, summarized in card status.


Flags/atomic follow-up: `proc-66fca2f97bb4` typecheck and focus 93/93;
`proc-bcf46d336663` 93/93 with abort-before-publication and successful retry,
frozen source flags, original qualifier/variable retention, and close controls.
Final `proc-352af29eecc0`: typecheck, parser 33/33, storage/schema/record 372/372;
public 93/99 (six generated failures), package exit1, accounting/diff exit0.
Partial stdout tail was read explicitly. Logs card work
`trigger-repair/flags-final-{parser,full,reproducer,accounting}.log`.
No native recapture this iteration: unchanged digest/source-verified native
fixtures from nested follow-up were reused; public checks rerun for changed TS.


Wide-list follow-up reproduced parser host overflow at 4,000/8,000 SELECT
terms (`proc-956107b2e2d1`, stack diagnosis `proc-27002dc1c111`); generated
SELECT-list and expression-list collection now use ordered explicit stacks.
Parser regression checks 8,000 terms and low-work rejection. Exact-native
1,900-term trigger fixtures exposed another owning recursive retained-byte
counter (3/96 failed, `proc-c5400c6c6706`); iterative counting/validation and
postorder generic initialization repaired 96/96 (`proc-8a90b45496e5`).
Native capture now includes 30 ordinary cases and unchanged 72 corruption
controls, all encodings/sourceid/digests asserted. Explicit stacks translate
list traversal without changing ordered semantic short-circuit callbacks;
this does not establish all recursive semantic owners are depth-safe.
Final `proc-679d24112097`: typecheck pass, parser 34/34,
schema/storage/record 372/372, public 96/102 with six generated failures,
package exit1, accounting/diff exit0. Logs card work
`trigger-repair/wide-final-{parser,full,reproducer,accounting}.log`.


Generated STORED follow-up: pinned expr.c GetColumnOfTable reads STORED as
physical Column, not generated expression execution; build.c
sqlite3TableColumnToStorage excludes VIRTUAL columns and assigns virtual cache
tail slots. Added shared source-derived mapping and routed rowid scalar
binding/table reads through it. Narrowed single-source guard to VIRTUAL rather
than rejecting already-stored values. Public unchanged capture passes 99/102,
three VIRTUAL failures remain (`proc-7fd1d55e2467`); typecheck pass. Mapping
regression checks native documented N,S,V interleaving and -1/cache-tail.
Final `proc-3b445a7d70c3`: parser 34/34, schema/storage/record 373/373,
package exit1, accounting/diff exit0. Logs card work
`trigger-repair/stored-final-{parser,full,accounting}.log` and
`generated-stored-repair.log`. No new native capture: unchanged exact-source
STORED/VIRTUAL expected rows/digests reused. Virtual shared expression lowering
(including IfNullRow, strict/affinity and cycle cleanup) remains implementation
work, not an unsupported product exclusion.


VIRTUAL follow-up: generated DEFAULT/AS expression production previously
retained tokens but dropped reduction identity. `parse.ts` now preserves the
actual generated expr reduction. `vdbe.ts` single-source self-table binding
retains BUSY cycle detection with finally reset and uses the shared expression
compiler for VIRTUAL columns, emitting IfNullRow, Copy and affinity (not CAST).
Direct/star projection fast paths route through this owner too. Existing physical
records/connection ownership reused. This slice does not claim STRICT TypeCheck,
aggregate/index/join or full generated-column admission.
First attempt produced NULL via projection payload bypass (99/102); next exposed
missing reduction (99/102). Owning production and caller repairs yielded 102/102
in proc-a3ee3de36ee0. Additional star/predicate/arithmetic/order caller assertions
passed proc-0d0c4881f997; initial test iterations misused prepare's wrapper and
cleanup methods and were corrected, not product failures. Typecheck/parser34/full373
passed proc-a3ee3de36ee0; package exit1/accounting/diff exit0 proc-9637c4380e86.
Original native expectations/digests unchanged, no fresh native capture; additional
caller expectations are derived regression assertions, not new oracle claims.
Logs in card work trigger-repair/virtual-*.log. Remaining strict and alternate
producer semantics are progressive backlog, not scope exclusions.


### Combined Window field-order repair

`parse.y:filter_over` combines OVER and FILTER into one Window. Trigger
fixation now owns this carrier before generic postorder traversal, visiting
ORDER/PARTITION, FILTER, then frame fields and rebuilding unchanged grammar
order using shared initialization caches. Function arguments still precede the
Window. This replaces FILTER-first grammar descent, not an SQL-text special case.
`capture-walker-order.py`/`walker-order.test.mjs` compare exact pinned read-only
initialization errors in all encodings and repeat failed construction (no partial
publication). Fresh native capture and 18/18 controls pass (`proc-e74e38c1df3c`).
Initial three-case red was 0/3 with FILTER error instead of ORDER error.

An attempted frame-start/end subquery error control was invalid as an oracle
prediction: native returned OK, not the expected startdb CORRUPT
(`proc-1049c6e72f63`). It was removed from the error inventory, not counted as
passing evidence; frame normalization/retention needs separate source-backed
closure. Remaining full Select/CTE/window/UPDATE-FROM semantic/depth work is not
claimed complete by this bounded fix.

Final: parser34, schema/storage/record373, public102 and native-order18 pass,
typecheck/accounting/diff exit0; package peer self-dependency assertion exit1
(`proc-e8fb3ad47309`). Logs card work `trigger-walker-red/{native-expanded,
expanded-final,parser,full,public,accounting}.log`. Original green generated
reads unchanged; no independent evaluator or alternate-producer guard lifted.


### Window bound semantic normalization

`window.c:sqlite3WindowOffsetExpr` replaces nonconstant frame offsets with NULL
before attach fixation. `schema.ts:constantWindowOffset` traverses generated
expression reductions with an explicit stack using the unresolved IsConstant
branches; semantic-owned frame_bound replaces only its initialized expression.
The synthetic NULL reduction, child array, terminal and token value are frozen;
walker controls assert failed mutation and no identity sharing with parsed originals
(see [[card:card-e-l]] immutable-terminal repair evidence).
Parsed original SQL/reductions remain available and syntactically invalid bounds
still reject. This is not suppression of parser errors or SQL-text matching.

Fresh manifest-pinned controls now include both nonconstant bounds, functions,
variables, arithmetic constants, 80-level mixed expression/subquery bounds and
malformed bound syntax. Native capture39 and public/repeated construction39 pass
(`proc-c5d4394468c6`, metadata assertions `proc-b7c02fd1afa7`). Original Window18
are retained. Syntax errors remain CORRUPT11; valid semantic omissions initialize
without walking discarded cross-database sources. Initialized bound freezing and
original retained qualification are separately asserted. A first metadata test
incorrectly searched whole initialized steps (which also preserve original step
carriers); it failed12 cases and was corrected to inspect frame-bound children,
not relaxed to waive retained subqueries (`proc-8e163d38704f`). Initial synthetic
NULL token omitted byte offsets, causing typecheck failure; repaired token shape.

Parser34, full373 and public102 pass (`proc-ec9bf62f7901`), typecheck/diff pass;
package still fails peer dependency assertion, accounting retains38+9 inventory.
Logs card work `trigger-walker-red/frame-*.log`. Full recursive Select/CTE and
UPDATE-FROM ownership/depth and Window semantic normalization beyond these
unresolved constant carriers remain unclosed; no complete trigger execution,
function resolution or wide native depth guarantee is asserted.
