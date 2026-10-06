# OR prelowering revision-bound detail (attempts 1–149)

Archived during current-guidance consolidation; not current contract authority.
Evidence/commands/failed hypotheses: [[card:card-s-f-b]] status. These assertions
reflect the partial implementation checkpoint b97a7ef, not exhaustive native fidelity.

## Former guide detail

Selected rowid multi-index OR has a **partial prelowering implementation**, not
runtime compatibility credit. `where-plan.ts` owns tagged OR/AND clauses and
recursive shared-budget cost production via the pinned three-slot cost set;
immutable `multi-or` loops expose the parent `orInfo`, prerequisites and estimates,
with null capability, setup0/sort0 and no captured branch physical choices.
Lowering must plan each arm against that owner; VM/RowSet work is not implemented
here. The [OR source proposal/evidence](research/card-s-f-or.md) and
[[card:card-s-f-b]] status details remaining combines/OR-IN proof, exact analysis
and cost branches. OR equality now produces a virtual clause-owned IN child through
ordinary analysis, with cursor/column and RHS affinity proof, retained join origin
and original OR residual. The TERM_OK-equivalent pass visits stored copied and
virtual entries, continuing after column/affinity failure; tests cover second-cursor
retry, stored RHS order and ordinary IN admission in all encodings. XN_EXPR now
uses the shared resolved operand proof instead of rejecting expression fields;
different fields/collation nodes reject. Exhaustive comparison and collation/ownership
ordering remain unproved; physical selection uses only
the existing IN contract. Constraint lookup walks clause then outer clauses while
residual inventories and recursive OR discovery remain local; sibling OR arms
are not outer constraints. Internal `orArmClause` dispatches stored entries:
AND info supplies its clause; direct entries match the source cursor and own a
one-term temporary clause with the enclosing clause as outer. Copied orientations
are separate stored entries, not bundled children or globally skipped virtuals.
Column equivalence flags retain affinity/collseq and parent outer-ON proof for
commuted terms. Internal `scanWhereTerms` supplies the 11-slot column-equivalence
visitation seam (local/outer restart, reverse EQ/IS cycle exclusion); production
cost-only pOrSet index construction consumes transitive column matches, retaining
original term/RHS prerequisites and physical seek field separately. Transitive
cost matches retain original mayDrive rejection; changing the target cannot
revive unsafe semantic terms. LEFT index targets additionally require an outer
ON carrier owned by that cursor; rowid and persistent-index exploration share
this target gate. Original and copied terms retain joinOwner
independently of borrowed clause ordinals. RIGHT/LTORJ compatibility remains
unestablished. Admitted list-IN seek multiplicity counts immediate exprlist entries
(pinned where.c3361), not descendant commas; SELECT-IN costing is not established
by this repair (evidence: [[card:card-s-f-b]] status attempt130). Cost-only
equality and range exploration suspend field scanning across proposals; persistent
index cost mode resumes after successful insertion even at counter zero until
an attempted insertion returns DONE. Equality prefixes
publish before exploring the next index field; empty deeper fields do not publish
the prefix again. Cost-mode rowid exploration visits stored terms, inserts lower-only
before upper recursion, and does not let a later equality suppress earlier ranges;
ordinary rowid inventory remains unchanged. Rowid cost lookup suspends semantic
admission across proposals, resumes after OK even at counter zero, and closes
active iterations when an attempted insertion returns DONE; terminal equality
costs may survive exact budget when later indexes are suppressed; otherwise
AddBtree continues into eligible persistent indexes whose attempted insertion
can return DONE even with no constraints. Covering construction is reached-only. Upper
restarts apply LT/LE opMask before safety reads; enclosing scan then resumes
stored lower/equality terms (evidence: [[card:card-s-f-b]] status attempt138).
Self-dependent rowid RHS prerequisites are rejected before join safety admission.
Cost rowid lookup uses the shared equivalence scanner targeting sPk column -1;
original RHS/term prerequisites survive other-cursor and nonrowid equivalents.
As upstream's rowid scan has no zCollName, no index affinity/collseq filter is
added. Ordinary published rowid transitive seeks remain unimplemented.
Shared scanner RHS inspection is short-circuited by equivalence/slot capacity for
expansion and EQ/IS for reverse-cycle exclusion, as in upstream. Parenthesis
carriers are stripped before the raw opcode test without stripping COLLATE.
Expansion skips resolved builtin likely/unlikely/likelihood first arguments as
upstream EP_Unlikely does, never arbitrary functions. Resolved expression affinity/
collation now follows these builtins first arguments (SQLITE_AFF_DEFER), with
numeric/NOCASE producer positives and mismatch/arbitrary-function negatives.
Both metadata visitors follow resolved alias copies on reached argument paths;
this is resolver-owned copy provenance, not scanner operand rewriting.
Comparison explicit-collation production follows those copies and expression
argument carriers with left-before-right precedence; SELECT internals are excluded
(alias/likely/precedence controls). Implicit comparison collation visits resolved
left then right expressions, not only bound columns (likely/CAST/UPLUS and
ordinary-function negative controls). General resolver/flag fidelity remains partial.
RHS comparison affinity also visits resolved operand metadata, not a binding
proxy (CAST/deferred builtin/alias positives; UPLUS/ordinary-function none);
full resolver and admission coverage remains partial.
IS-to-ISNULL term production tests the raw RHS NULL opcode (transparent
parentheses only), not descendant NULL tokens; CAST/function/arithmetic/COLLATE
carriers retain IS, as parse.y sqlite3PExprIs requires.
IS NOT DISTINCT FROM feeds the same IS/ISNULL analysis and equivalence/OR
indexable production as IS (parse.y1436–1447); DISTINCT/ISNOT stays residual.
Resolved IS TRUE/FALSE is TK_TRUTH (resolve.c1429–1442), not indexable IS;
transparent likelihood/COLLATE wrappers follow the same proof. INTEGER, CAST
and bound-column/alias operands remain IS. Selected truth terms stay residual.
Name resolution checks result aliases before builtin truth/DQS fallback;
actual columns still precede aliases (resolve.c lookupName).
Function-free empty IN RHS produces TRUEFALSE before IS resolves to TRUTH;
EP_HasFunc carriers remain AND/OR and retain IS admission. Shared production
proof excludes unproved SELECT flags (parse.y1490–1514).
Empty-IN production now feeds clause split/term insertion as well as operand
comparison: function-free constants have no WO_IN; HasFunc retains ordered
constant-before-lhs AND/OR ownership. Singleton scalar constant IN now
feeds shared EQ/UPLUS production into term insertion (optional NOT wrapper);
column/function RHS and multi-item IN remain on the existing IN contract.
The bounded constant proof is not exhaustive exprIsConst translation.
DISTINCT FROM grammar aliases share IS/ISNOT opcode production across
clause insertion, singleton constant walking and operand comparison
(parse.y1435–1447); nonconstant children still prevent constant proof.
IS/ISNOT with root NULL shares unary ISNULL/NOTNULL production with
clause insertion and comparator (parse.y1415–1426), deleting the RHS.
CAST/COLLATE/function NULL carriers retain binary IS. Literal-left null
test folding shares opcode/sign-strip production with insertion and comparator
(parse.y1388–1411): INTEGER/STRING/FLOAT/BLOB produce ExprInt32; NULL, CAST,
function and column opcodes are not evaluated. Nested null tests consume
already-produced child null-test opcodes before outer inspection; this is
parser production, not constant-value evaluation. Shared AND production now
feeds clause splitting and comparator: immediate produced IsFalse folds only
without HasFunc; raw integer zero does not acquire IsFalse (expr.c1145–1166).
Singleton-IN constant proof and emitted UPLUS RHS consume that same produced
null/AND child, including descendants inside arithmetic/container expressions
(parse.y1514–1520), rather than proving one tree and retaining a discarded raw
arm. AND produces as a unit to preserve transient IsFalse; SELECT scopes are
not traversed by this bounded production. Unfolded null tests retain the
produced left tree, including original unary-sign positioning, rather than
restore discarded descendants when outer opcode inspection cannot fold.
The common analysis normalization caller also traverses comparison/arithmetic
descendants through these same units; retained raw-zero/HasFunc arms remain
unchanged except that parse-time COLLATE carries no descendant HasFunc:
AddCollateToken attaches pLeft without EP_Propagate, unlike AttachSubtrees.
The shared flag proof stops there; conservative SELECT detection remains
independent. SELECT flags and complete recursive parser production remain
bounded; this does not establish lowering binding/cache acceptance.
Necessary-combine/OR-IN operand comparison follows full resolved alias copies
before opcode/child proof (CAST/function/IS positives; COLLATE/column mismatch
negatives); exhaustive ExprCompare field/flag fidelity remains partial.
Equivalence production uses expression affinity/collation proof independently of
column shape; only the scanner's expansion requires a column RHS (CAST controls).
Raw scanner RHS inspection follows resolved alias copies before opcode testing,
retaining copied COLLATE/function wrappers rather than testing the identifier.
Equivalence analysis likewise follows operand alias copies for affinity/collation
and copied COLLATE flags, including function argument carriers; SELECT internals
are not flattened into that flag proof. Recursive alias/flag proof remains partial.
Scanner expansion follows alias copies at every skip step, including likely
arguments; a copied arbitrary function remains opaque (supplied-equivalence tests).
AND clause splitting inspects SkipCollateAndLikely after transparent parentheses,
recursing into matching AND children while retaining nonsplit original carriers;
this also owns AND-arm collection for OR. Clause insertion normalizes the term
expression with SkipCollateAndLikely; OR splitting applies the same inspected
opcode/child recursion. Original SELECT/WHERE AST remains untouched, while term
pExpr maps to the skipped expression as upstream does (likely OR/arm controls).
Cost builders
skip the ordinary eager lookup reference inventory entirely: scan exhaustion
returns before accessing outer clauses; reached field/rowid scanners own lookup.
Fake sPk proposals are gated by rowid storage for ordinary and cost builders;
WITHOUT ROWID uses real primary storage even for borrowed rowid-shaped terms.
Transitive ISNULL admission bypasses both comparison affinity
and collseq annotations, like ordinary ISNULL admission. Shared field exploration
excludes range operators for unordered indexes while retaining equality admission
in cost-only and ordinary paths. Declared NOT NULL fields exclude ISNULL index
proposals, not IS equality; indexed expression fields remain nullable. Lower-only
proposals precede a restarted upper-only scan; upper-only proposals publish
without further field recursion. Published
ordinary capabilities and lowering do not consume these matches; transitive IN,
rowid and expression-index admission remain gaps. Copied terms own
outer-ON flags independently of parent ordinals, including borrowed temporary
clauses. Scanner expansion and reverse-cycle proof keep distinct RHS handling:
COLLATE is skipped for expansion, but is not a raw column for cycle exclusion.
Expression-index comparison remains incomplete. Production closure/budget tests are linked in that status. Necessary two-arm bounds preserve
retained operand order when converting normalized right-indexed operators back
into synthesized expressions; combine admission uses analyzed single-operator
eligibility, not merely the retained SQL operator of an AND child. Integer operand
proof uses pinned parser EP_IntValue (GetInt32) versus retained token identity,
not runtime int64 numeric equivalence. COLLATE operands compare dequoted names
case-insensitively while retaining their child expression; quoted spelling is
also decoded by explicit-collation admission. Function-name proof uses dequoted,
case-insensitive TK_FUNCTION names and produced DISTINCT flags (ALL equals omission)
without dropping argument order. Infix LIKE/GLOB operand proof follows the produced
function's pattern/lhs/optional escape list and optional NOT parent; EP_InfixFunc
is not an ExprCompare identity discriminator. Necessary-bound operand proof compares EQ/NE
operator aliases by produced SQLite opcode, including inside function arguments;
DISTINCT FROM operands map to pinned IS/ISNOT semantic productions; nullable
IS NULL/ISNULL and IS NOT NULL/NOTNULL/NOT NULL operands compare produced unary
opcodes and resolved children. Null-test operand proof follows parser folding
for INTEGER/FLOAT/STRING/BLOB after stripping unary signs, not general constant
evaluation. Unary sign operand proof replaces an existing UPLUS root with the
outer sign as pinned parse.y does; UMINUS child chains are not algebraically folded.
CAST typetokens retain the production's exact raw byte span, including inter-token
spaces/comments and signed size parameters, then dequote and compare case-sensitively.
Dequote stops at the first unescaped closing delimiter, including when a quoted
first type name has trailing type/size text (pinned util.c sqlite3Dequote).
Synthetic reductions without a span prove only empty/single-token types.
Original OR
truth residuals remain. Necessary-bound boolean operand proof retains the
case-sensitive token of resolved unquoted TRUE/FALSE (pinned ExprCompare), not
identifier case folding; resolved column owners are compared before that proof.
BETWEEN operand proof compares the pinned optional NOT parent and ordered bound
list, without Boolean reassociation or bound reversal. Multi-item scalar IN
operand proof likewise compares its optional NOT parent. Singleton literal/arithmetic/
variable RHS IN proof follows EQ with a preserved UPLUS RHS and optional NOT;
scalar admission unwraps parentheses before the vector exclusion; RHS constant
walking separately traverses every ordered VECTOR list element;
mode-one variable continuation does not waive retained token/bind-position proof;
function STAR and omitted argument list both produce a null list and use ordinary
zero-argument arity validation; operand proof compares that list identity, not STAR syntax.
CAST (including empty typetoken), Boolean, comparison/null-test, BETWEEN, CASE, nested nonempty scalar IN and COLLATE constant
admission walk children (including CASE's optional operand and ordered WHEN/THEN/ELSE
list, and ordered bounds/list elements) without evaluation,
reassociation or type/collation identity loss; IS DISTINCT FROM aliases use their
produced IS/ISNOT opcode in constant walking. SELECT-backed IN is excluded from
constant equivalence proof, not rejected as SQL;
unquoted boolean IDs follow the parser-time constant walk's prune branch while
quoted IDs remain unproved. Function-free
empty IN proof follows lower-case TRUE/FALSE production and retains function-bearing
lhs (including infix LIKE/GLOB carriers) as ordered AND/OR production; the same
recursive function-presence proof prevents false-child AND deletion; nested constant walking observes this replacement
rather than a discarded function-free lhs. Immediate false empty-IN children of
AND follow sqlite3ExprAnd's integer-zero production only without functions;
literal null-test production inspects produced child opcodes (including nested
null tests) and shares its ExprInt32 false flag with this caller; TRUEFALSE is
not INTEGER for this opcode test;
returned ExprInt32 zero retains IsFalse for enclosing AND. Raw integer tokens and
unfolded ancestor Boolean expressions do not carry that produced false flag.
General constant walker and SELECT-carried flags
and RHS equivalence remain unproved here.
WR union, forced-index OR and unsafe
nullable joins are not selected; admitted fallback semantics remain. RIGHT/FULL
retains current fallback. Active public selected tests remain red, including
shared-builder opcode checks. Planner-approved direction is not implementation or
runtime acceptance; no public API or native runtime dependency is introduced.
**Cost-mode completion boundary:** persistent-index exploration continues after
an insertion decrements the budget to zero, since it still returned `SQLITE_OK`.
The next attempted insertion returns `SQLITE_DONE`, clears the cost set, and
closes suspended iterators; terminal exact-budget upper costs can survive if
there is no next insertion. This can read a next/deeper RHS before DONE; earlier
no-later-RHS cost tests incorrectly treated counter zero as an error return and
are superseded by pinned branch controls. Ordinary inventory still stops on count zero.
Cost-mode parent accumulation now retains a completed last arm at zero and
attempts publication, whose insertion owns DONE cleanup; it does not discard
that sum preemptively. Cost index generation now feeds insertion completion
back to each suspended frame: restore enclosing rc after child completion,
ignore the child rc where pinned C does, and stop scans on their own DONE.
Recursion permitted after parent insertion is still evaluated on DONE. Natural
frame completion replaces global IteratorClose for cost exhaustion; ordinary
IteratorClose and error unwinding remain. This repairs the multi-field control,
not every recursive C branch (evidence: status attempts142–144). Same-field
range controls distinguish ignored child DONE/enclosing next lower from own
lower DONE with permitted upper recursion; a preceding standalone upper stops
on its own DONE, so stored term order matters. Cost-mode per-call
`completion.done` distinguishes returned DONE from OK even for empty costs at
zero budget; copied arm builders use distinct carriers and share only budget.
Arm DONE stops later parent discovery, following whereLoopAddOr's rc gate
(evidence: status145). sPk lower-cost frames also preserve own rc across
ignored upper child DONE and execute permitted upper recursion after own DONE,
matching the shared AddBtreeIndex path (status146–147). Ignored child DONE
can leave empty costs and returned OK after enclosing scan ends; thrown recursive
safety errors still unwind even after own insertion DONE. Completion is only a
normal-return status, not an error channel. A successful zero-arm cost failure
abandons only that parent and continues later OR discovery; actual arm DONE
stops it (status148). Plan-only immutable handoff assertions are separate from
still-red lowering opcode/selected execution assertions. Nested cost publication
uses the same per-call DONE carrier; exact-budget tests must account for outer
constraint lookup in copied AND builders, not merely count visible OR arms
(status149). Cost-mode initial
scan, rowid and index continuation distinguish OK-at-zero
from attempted DONE; initial budget-zero scan returns before semantic admission
(evidence: [[card:card-s-f-b]] status attempts134–141).
Potential ORDER usefulness follows `indexMightHelpWithOrderBy` (where.c3664ff):
a same-cursor rowid/IPK term preserves every ordered persistent index's identity
before dominance, even when complete physical ORDER satisfaction is zero.
The all-encoding before/after stat-choice and production analysis tests cover
this distinction; an `unordered` statistic still prevents ORDER usefulness.
Indexed row-size metadata is now produced and consumed in the in-progress
[[card:card-s-e-b]] repair below; OR-set lowering, automatic-index execution,
STAT4 and star heuristics remain residuals, not full optimizer coverage.
The approved SECOND immutable row-width/stat1 owner proposal and pinned
native-first acceptance are in [card-s-e-row-width](research/card-s-e-row-width.md).
Runtime acceptance remains red; proposal approval is not compatibility credit.
[Repair decisions/evidence](research/card-s-d-a-ordered-where.md). Alias/ordinal ORDER resolution occurs before immutable plan handoff.

## Former source map detail

Partial prelowering OR map: `whereexpr.c:exprAnalyzeOrTerm` → tagged immutable
OR/AND clauses in `where-plan.ts` (combines and OR-IN proof remain partial;
virtual IN production now uses ordinary analysis with cursor/column, affinity and
join-origin proof; stored TERM_OK pass, second-cursor retry and IN admission in all
encodings covered; XN_EXPR uses shared resolved operand proof (different fields
and collation nodes reject); exhaustive comparison/collation/ownership
are unproved; clause/outer constraint lookup preserves local residual and OR
exploration ownership (composite prefix/prerequisite tests); `orArmClause`
maps AND-owned clauses or cursor-matching one-term tempWC, including stored
commuted orientations (dispatch tests); column EQ/IS equivalence producer
retains affinity/collseq/parent-ON proof; `scanWhereTerms` maps 11-slot column
visitation/restarts/reverse cycles and term-owned copied outer-ON flags across
borrowed temp clauses and distinct raw RHS reverse-cycle versus COLLATE-skipping
expansion; actual pOrSet index construction consumes EQ/IS/range column matches
with original RHS and physical field separate; original semantic mayDrive
rejection remains effective on transitive matches (three-encoding internal
producer-contract test). LEFT index targets require outer-ON and stable
joinOwner cursor, including copied/borrowed terms; rowid exploration shares the
LEFT gate (ordinary/pOrSet, three encodings); cost-mode rowid inserts stored
lower-only before upper recursion without later equality suppression (budget tests);
rowid semantic lookup suspends across proposals, resumes on OK-at-zero and
clears on attempted DONE; terminal equality and pending range budgets differ
([[card:card-s-f-b]] status138–139). Successful terminal sPk continues into
eligible real index insertion at zero (NOT INDEXED retains isolated terminal
cost); covering work remains reached-only; upper restart
filters LT/LE before safety, then enclosing scan resumes stored masked terms;
rowid self RHS prerequisite exclusion
precedes join safety (injected producer-contract test); cost rowid sPk -1 scanner
uses equivalence retaining original terms/prereqs, no zCollName comparison filter
(three-encoding other-rowid/nonrowid equivalent tests; ordinary seeks unchanged);
shared scanner RHS reads obey equivalence/capacity and EQ/IS short-circuits
(masked non-equivalent term regression); raw reverse tests strip parentheses,
not COLLATE (three-encoding parenthesized COLLATE regression); expansion skips
builtin likely carriers (expr.c218–231/resolve.c1171; supplied-equivalence scanner
controls, producer proof incomplete); termIsEquivalence uses expression affinity/
collation without requiring column RHS (CAST controls), scanner owns column test;
raw RHS follows resolveAlias copies preserving COLLATE/function opcode (encoding controls);
termIsEquivalence follows operand aliases for affinity/collation and copied COLLATE
flags through expression/argument carriers, not SELECT internals (alias controls);
expr.c sqlite3ExprAffinity/CollSeq DEFER follows likely builtin first argument
in resolvedExpressionAffinity/Collation, following reached resolved alias copies
(numeric/NOCASE/mismatch/function and copied-argument controls);
expr.c BinaryCompareCollSeq424 explicit precedence maps to effectiveCollation
copy/argument visitation, SELECT excluded (alias/likely/left-precedence controls);
implicit left/right CollSeq visits resolved expressions, not bound-column proxy
(likely/CAST/UPLUS, right fallback and ordinary-function negative controls);
RHS comparison affinity also visits resolved operand metadata, not a binding
proxy (CAST/deferred builtin/alias positives; UPLUS/ordinary-function none);
full resolver and admission coverage remains partial.
IS-to-ISNULL term production tests the raw RHS NULL opcode (transparent
parentheses only), not descendant NULL tokens; CAST/function/arithmetic/COLLATE
carriers retain IS, as parse.y sqlite3PExprIs requires.
IS NOT DISTINCT FROM feeds the same IS/ISNULL analysis and equivalence/OR
indexable production as IS (parse.y1436–1447); DISTINCT/ISNOT stays residual.
Resolved IS TRUE/FALSE is TK_TRUTH (resolve.c1429–1442), not indexable IS;
transparent likelihood/COLLATE wrappers follow the same proof. INTEGER, CAST
and bound-column/alias operands remain IS. Selected truth terms stay residual.
Name resolution checks result aliases before builtin truth/DQS fallback;
actual columns still precede aliases (resolve.c lookupName).
Function-free empty IN RHS produces TRUEFALSE before IS resolves to TRUTH;
EP_HasFunc carriers remain AND/OR and retain IS admission. Shared production
proof excludes unproved SELECT flags (parse.y1490–1514).
Empty-IN production now feeds clause split/term insertion as well as operand
comparison: function-free constants have no WO_IN; HasFunc retains ordered
constant-before-lhs AND/OR ownership. Singleton scalar constant IN now
feeds shared EQ/UPLUS production into term insertion (optional NOT wrapper);
column/function RHS and multi-item IN remain on the existing IN contract.
The bounded constant proof is not exhaustive exprIsConst translation.
DISTINCT FROM grammar aliases share IS/ISNOT opcode production across
clause insertion, singleton constant walking and operand comparison
(parse.y1435–1447); nonconstant children still prevent constant proof.
IS/ISNOT with root NULL shares unary ISNULL/NOTNULL production with
clause insertion and comparator (parse.y1415–1426), deleting the RHS.
CAST/COLLATE/function NULL carriers retain binary IS. Literal-left null
test folding shares opcode/sign-strip production with insertion and comparator
(parse.y1388–1411): INTEGER/STRING/FLOAT/BLOB produce ExprInt32; NULL, CAST,
function and column opcodes are not evaluated. Nested null tests consume
already-produced child null-test opcodes before outer inspection; this is
parser production, not constant-value evaluation. Shared AND production now
feeds clause splitting and comparator: immediate produced IsFalse folds only
without HasFunc; raw integer zero does not acquire IsFalse (expr.c1145–1166).
Singleton-IN constant proof and emitted UPLUS RHS consume that same produced
null/AND child, including descendants inside arithmetic/container expressions
(parse.y1514–1520), rather than proving one tree and retaining a discarded raw
arm. AND produces as a unit to preserve transient IsFalse; SELECT scopes are
not traversed by this bounded production. Unfolded null tests retain the
produced left tree, including original unary-sign positioning, rather than
restore discarded descendants when outer opcode inspection cannot fold.
The common analysis normalization caller also traverses comparison/arithmetic
descendants through these same units; retained raw-zero/HasFunc arms remain
unchanged except that parse-time COLLATE carries no descendant HasFunc:
AddCollateToken attaches pLeft without EP_Propagate, unlike AttachSubtrees.
The shared flag proof stops there; conservative SELECT detection remains
independent. SELECT flags and complete recursive parser production remain
bounded; this does not establish lowering binding/cache acceptance.
Necessary-combine/OR-IN operand comparison follows full resolved alias copies
before opcode/child proof (CAST/function/IS positives; COLLATE/column mismatch
negatives); exhaustive ExprCompare field/flag fidelity remains partial.
SkipCollateAndLikely follows alias copies at each argument step, arbitrary functions
stay opaque (supplied-equivalence interleaved alias tests);
WhereSplit1599–1610 inspects skipped AND opcode/recurses children, retains nonsplit
carriers (parenthesis/likely/COLLATE controls, OR AND-arm ownership);
whereClauseInsert85 normalizes term expression via shared skip; OR split inspects
skipped opcode/recurses, SELECT AST untouched (likely OR/ordinary arm controls);
cost builders skip ordinary eager outer
reference inventory (scan budget1 outer getter regression); sPk proposals require
rowid storage (borrowed-term WITHOUT ROWID ordinary/cost regression);
RIGHT/LTORJ remains a gap;
equality recursion suspends scans
until insertion continues. Persistent-index cost mode now continues at counter
zero while the previous insertion returned OK, and clears/closes on attempted
insertion DONE (where.c2839–2844,3284,3580–3613); terminal upper and pending pair
controls differ. Prior no-next/deeper-RHS assertions were counter/rc conflations
([[card:card-s-f-b]] status134–140). Initial cost scan continues on OK-at-zero,
but attempted initial DONE returns before scanner admission. Parent completed-last-arm sum survives count zero until publication attempts
DONE and clears caller set (indexless rowid budgets5/6, status141). Explicit
recursive rc propagation now uses frame-local insertion feedback and enclosing
rc restoration after ignored child return3585–3597; forced i_ab prefix→child
DONE controls test enclosing continuation versus own DONE (status142–143).
Full recursive and parent completion remain unproved. Same-field lower/upper
controls preserve stored order and own-vs-child DONE (status144). AddOr rc gate
4837/4880 uses per-call cost completion carrier, not empty set/count, to stop
later parent discovery on arm DONE (status145). sPk lower/upper uses own rc
restoration after ignored recursive child3585ff too (status146); standalone
upper still terminates on its own DONE. Empty-cost returned OK after ignored
child and own-DONE recursive safety unwind controls: status147. OK zero-arm
continues later parents vs DONE stops (4886ff, status148); encoding planning
handoffs separately tested from outstanding lowering opcodes in or-rowid-red.
Equality prefixes insert
before deeper-field scanning without duplicate empty-field publication;
transitive ISNULL bypasses affinity/collseq reads (three-encoding poisoned-annotation
test); shared field exploration applies bUnordered range-mask exclusion with
equality retained (ordinary/forced and pOrSet all encodings); indexColumnNotNull
excludes ISNULL on declared NOT NULL fields, not IS equality (all encodings);
lower-only insertion
precedes restarted upper scanning and upper-only insertion terminates recursion. Ordinary
published capabilities, transitive IN/rowid and expression-index scanning remain
untranslated;
see [[card:card-s-f-b]] status);
`whereInt.h` OR costs and `where.c:whereOrInsert/Move/whereLoopAddOr` →
`where-or-cost.ts` exact slots/products and recursive cost-only Btree builders in
`where-plan.ts`. Tests: `where-or-cost.test.mjs`, `where-plan-analysis.test.mjs`;
shared-budget parent loops expose `orInfo`, null capability, setup0/sort0, run+1.
Lowering must choose physical arms, not consume captured cost candidates.
`wherecode.c` Case5/`sqlite3WhereEnd` and RowSet runtime remain outstanding.
[Independent native evidence and remaining obligations](research/card-s-f-or.md);
implementation/test failures and precise boundary: [[card:card-s-f-b]] status.
No runtime OR selection credit; ordinary index paths are not superseded.

## Former audit detail

## Current partial OR prelowering boundary

[[card:card-s-f-b]] implements tagged immutable OR/AND clauses and shared-budget
recursive cost-only parent loops in `where-plan.ts`/`where-or-cost.ts`. Cost slots
retain pinned insertion order and products; parent loops retain null capability,
setup0/sort0 and no physical branch choices. Focused plan tests are not runtime
acceptance. List-IN seek costing now counts immediate expression-list entries
(pinned where.c3361–3363), not commas inside arguments; nested-function/all-encoding
controls repair that producer only, not SELECT-IN/native exact-cost acceptance
(evidence: card-s-f-b status attempt130). Necessary compatible two-arm virtual bounds and OR-IN production are
partially represented. Virtual IN children now retain ordinary affinity/join-origin
analysis and the OR residual; stored TERM_OK pass, second-cursor retry and ordinary
IN admission now have focused evidence, not exhaustive collation/ownership proof;
XN_EXPR now shares resolved operand identity with combines; different expression
fields/collation nodes reject. Constraint scans now traverse pOuter without
transferring residual/OR exploration ownership; direct arms now use cursor-matched
single-term tempWC and stored commuted entries separately. Column equivalence
producer flags now retain affinity/collseq/parent-ON proof; isolated 11-slot
column scanner seam exists with term-owned copied outer-ON flags across borrowed
temporary clauses and distinct raw RHS cycle versus COLLATE-skipping expansion,
with actual pOrSet index construction now consuming transitive column EQ/IS/range
matches without rewritten terms, preserving original mayDrive rejection;
LEFT rowid/persistent-index target admission requires outer-ON/stable owning cursor even for
copied/borrowed terms; cost-mode rowid stored exploration inserts lower-only
before upper recursion and retains earlier ranges before later equality;
rowid semantic lookup suspends across proposals with reached-only covering work;
upper restart masks precede semantic safety reads; rowid self RHS prerequisites
reject before join safety (injected contract test); cost rowid scanner expands
equivalents with original RHS/prereqs and no zCollName comparison filter;
ordinary transitive rowid seeks remain unimplemented. Shared scanner RHS reads
now obey equivalence/slot-capacity and EQ/IS short-circuits (masked-term test).
Raw reverse tests remove parentheses while retaining COLLATE opcode. Expansion
skips builtin likely carriers; producer affinity/collation now follows their
SQLITE_AFF_DEFER first argument, with numeric/NOCASE and mismatch/function controls.
Affinity/collation visitors follow reached argument alias copies (copied-argument
controls); general recursive flag fidelity remains partial. Comparison explicit
collation now follows alias copies/argument carriers with left precedence, not
SELECT internals (alias/likely/precedence controls). Implicit comparison collations
visit resolved left/right operands rather than column-binding proxy, with likely/
CAST/UPLUS/right-fallback/function controls; general resolver fidelity partial.
RHS comparison affinity also visits resolved operand metadata, not a binding
proxy (CAST/deferred builtin/alias positives; UPLUS/ordinary-function none);
full resolver and admission coverage remains partial.
IS-to-ISNULL term production tests the raw RHS NULL opcode (transparent
parentheses only), not descendant NULL tokens; CAST/function/arithmetic/COLLATE
carriers retain IS, as parse.y sqlite3PExprIs requires.
IS NOT DISTINCT FROM feeds the same IS/ISNULL analysis and equivalence/OR
indexable production as IS (parse.y1436–1447); DISTINCT/ISNOT stays residual.
Resolved IS TRUE/FALSE is TK_TRUTH (resolve.c1429–1442), not indexable IS;
transparent likelihood/COLLATE wrappers follow the same proof. INTEGER, CAST
and bound-column/alias operands remain IS. Selected truth terms stay residual.
Name resolution checks result aliases before builtin truth/DQS fallback;
actual columns still precede aliases (resolve.c lookupName).
Function-free empty IN RHS produces TRUEFALSE before IS resolves to TRUTH;
EP_HasFunc carriers remain AND/OR and retain IS admission. Shared production
proof excludes unproved SELECT flags (parse.y1490–1514).
Empty-IN production now feeds clause split/term insertion as well as operand
comparison: function-free constants have no WO_IN; HasFunc retains ordered
constant-before-lhs AND/OR ownership. Singleton scalar constant IN now
feeds shared EQ/UPLUS production into term insertion (optional NOT wrapper);
column/function RHS and multi-item IN remain on the existing IN contract.
The bounded constant proof is not exhaustive exprIsConst translation.
DISTINCT FROM grammar aliases share IS/ISNOT opcode production across
clause insertion, singleton constant walking and operand comparison
(parse.y1435–1447); nonconstant children still prevent constant proof.
IS/ISNOT with root NULL shares unary ISNULL/NOTNULL production with
clause insertion and comparator (parse.y1415–1426), deleting the RHS.
CAST/COLLATE/function NULL carriers retain binary IS. Literal-left null
test folding shares opcode/sign-strip production with insertion and comparator
(parse.y1388–1411): INTEGER/STRING/FLOAT/BLOB produce ExprInt32; NULL, CAST,
function and column opcodes are not evaluated. Nested null tests consume
already-produced child null-test opcodes before outer inspection; this is
parser production, not constant-value evaluation. Shared AND production now
feeds clause splitting and comparator: immediate produced IsFalse folds only
without HasFunc; raw integer zero does not acquire IsFalse (expr.c1145–1166).
Singleton-IN constant proof and emitted UPLUS RHS consume that same produced
null/AND child, including descendants inside arithmetic/container expressions
(parse.y1514–1520), rather than proving one tree and retaining a discarded raw
arm. AND produces as a unit to preserve transient IsFalse; SELECT scopes are
not traversed by this bounded production. Unfolded null tests retain the
produced left tree, including original unary-sign positioning, rather than
restore discarded descendants when outer opcode inspection cannot fold.
The common analysis normalization caller also traverses comparison/arithmetic
descendants through these same units; retained raw-zero/HasFunc arms remain
unchanged except that parse-time COLLATE carries no descendant HasFunc:
AddCollateToken attaches pLeft without EP_Propagate, unlike AttachSubtrees.
The shared flag proof stops there; conservative SELECT detection remains
independent. SELECT flags and complete recursive parser production remain
bounded; this does not establish lowering binding/cache acceptance.
Necessary-combine/OR-IN operand comparison follows full resolved alias copies
before opcode/child proof (CAST/function/IS positives; COLLATE/column mismatch
negatives); exhaustive ExprCompare field/flag fidelity remains partial. Equivalence production now owns expression
affinity/collation proof without requiring column operands (CAST controls);
scanner still separately requires a column for expansion. Raw RHS follows alias
copies preserving COLLATE/function opcodes, with three-encoding controls.
Equivalence production follows operand alias copies and COLLATE flags through
expression/argument carriers, not SELECT internals; recursive alias/flag proof remains partial.
Scanner expansion follows interleaved alias copies at each likely-argument skip
step, without unwrapping arbitrary functions (supplied-equivalence controls).
AND splitting now follows WhereSplit skipped-opcode recursion, retaining nonsplit
carriers; parenthesized/likely/COLLATE and OR AND-arm controls pass. Clause
insertion now normalizes term pExpr via SkipCollateAndLikely and OR split uses
skipped opcode/children (likely OR and ordinary arm controls), SELECT AST untouched.
Cost builders no longer inventory outer references before scan budget exhaustion;
ordinary lookup inventory remains unchanged. Fake sPk proposals now require
rowid storage in ordinary/cost builders (borrowed-term WR contract regression).
RIGHT/LTORJ compatibility remains unestablished. Persistent-index cost mode now
continues after OK at counter zero until attempted insertion DONE clears/closes;
terminal exact-budget and pending-range controls distinguish completion states.
Four prior cost-only no-next/deeper-RHS/retained-set assertions conflated the
counter with rc and are superseded by pinned3284/3580ff controls, not a platform
substitution ([[card:card-s-f-b]] status134–138). Rowid cost mode now likewise
continues after OK-at-zero, retaining terminal equality but DONE-clearing pending
ranges; successful sPk continues into eligible persistent index attempted
insertion even at zero (NOT INDEXED isolates terminal retention, status139).
Upper restart mask does not suppress the subsequent enclosing scan.
Ordinary stopping remains to compare separately. Cost frames now receive
insertion rc, restore enclosing rc after ignored child completion3585ff and stop
on own DONE (status143 repairs status142 discriminant). This is partial source
translation, not full recursive/parent completion proof. Status145 adds per-call
cost completion and repairs later parent discovery after arm DONE; successful
empty costs at zero remain OK, separate from attempted DONE. Status146 repairs sPk ignored
upper-child DONE and own-lower recursion, previously still flattened despite
real-index frame repair; standalone enclosing upper owns its eventual DONE.
Status148 isolates green immutable plan handoffs from still-red lowering opcode
assertions without removing either; successful zero-arm OK versus DONE discovery
controls are evidence, not another product repair.
Cost parent no longer drops completed-last-arm sums at zero: publication attempts
DONE and clears the caller cost set (status141, indexless budgets5/6). Cost-mode initial
scan now also continues on OK-at-zero and returns on attempted DONE (status140);
next reached proposal construction is bounded, not an eager exploration inventory.
Equality/range scans suspend across budgeted
proposals, including equality-prefix insertion before deeper-field scanning and
lower-only insertion before restarted upper scan; transitive ISNULL bypasses
comparison-only affinity/collseq reads. Shared ordinary/cost field exploration
excludes unordered-index range admission while retaining equality, and excludes
ISNULL on declared NOT NULL fields without excluding IS equality. Ordinary published admission/lowering,
transitive IN/rowid and expression-index scanning remain gaps. Full equivalence scanning is not
established. Full expression-comparison/copy semantics remain gaps. Stored-order zero-mask
stopping now prevents later AND-info construction; see [[card:card-s-f-b]] status evidence;
public selected work/opcode tests remain red. See the current WHERE guide/source
map and the card status for revision-bound failures and commands. This supersedes
preimplementation predictions only for the partial graph/cost slice.

