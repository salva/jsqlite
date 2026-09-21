# Translation fidelity audit — 2026-09-14

This is a mutable project audit and correction input, not a completed remediation
report or an instruction to discard the engine. Keep `docs/SPEC.md` scope and the
translation-first default in `AGENTS.md` and `docs/TRANSLATION.md`. The sole source
authority is pinned SQLite 3.53.4 from `reference/sqlite/manifest.json`, Fossil
check-in `bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
Upstream paths below are relative to that source root. The original JSQLite engine
is not evidence.

The reviewed baseline is commit
`5fab47af402cbd7310987a16347995b157fafb43`. Baseline line references and predicted
results below preserve the audit evidence at that revision; they are not promises
of current line numbers. Current static labels were assigned against committed
HEAD `5009c68eeef4898bcf927af1db3c77ea54d400d7` plus the then-present autonomous
dirty edits to `docs/SQLITE_SOURCE_MAP.md`, `docs/api.md`, `src/internal/vdbe.ts`,
and relational/private-state tests. The audit author ran **no tests or SQL
examples**. Every predicted result requires reproduction through the public engine
and independently pinned oracle. No complete correctness or compatibility claim
follows from this audit, existing test claims, source citations, opcode names, or
table dimensions.

Preserve genuine foundations: pinned Lemon tables/generator, record varints and
serial types, overflow payload layout, lazy forward B-tree scan, arithmetic
overflow/remainder translations, Mem machinery, and real VM PC/register/
`ResultRow`/reset/finalize behavior. CASE has genuine lowering even where a
conversion is wrong. Reviewed runtime imports were local; no native/Node SQLite
runtime fallback was found. Explicitly unsupported unimplemented features remain
legitimate boundaries when they are rejected truthfully.

## Priority A — structural and algorithm ownership

### 1. SELECT production identity and semantic structure

**Revision 2026-09-15 ([[card:card-e-b]] current repair): reproduced and corrected
for the bounded parser/compiler contract.**

The generated reduction action now attaches the statement at `cmd ::= select`
and follows the top-level `select`/`selectnowith`/`oneselect` production chain,
rather than selecting the last recursively discovered `oneselect`. The outer
projection for `SELECT 7,(SELECT 8)` is consequently retained as `7` plus the
subquery expression. Compound and subquery reductions are also retained as
structural flags, and the public compiler rejects both forms as temporary
unsupported before lowering; `SELECT 1 UNION ALL SELECT 2` can no longer execute
only one arm. Focused generated-parser tests cover the retained structures, and a
public typed-API adversarial test covers both unsupported gates. Independent
manifest-pinned SQLite 3.53.4 observations return `(7,8)` for the scalar-subquery
case and rows `1`, `2` for the compound case. This correction does not claim that
subquery or compound execution has been implemented.

**Superseded baseline label:**

Baseline `src/internal/parse.ts:36-42` recursively finds every `oneselect`
reduction and selects `.at(-1)`. Predicted consequence: `SELECT 7,(SELECT 8)` may
select the inner query instead of preserving the outer query. `SelectNode` has no
compound links/operator, so accepted `SELECT 1 UNION ALL SELECT 2` may compile only
the final `2`. Compare `src/parse.y:539-567,608-664`, including compound handling
around 621-625. Generated Lemon tables are valuable, but a generic reduction
callback does not translate the C semantic bodies. Preserve production ownership
and query structure; reject unsupported subqueries/compounds rather than executing
a wrong partial query.

### 2. Schema graph semantics versus declaration-only extraction

**Revision 2026-09-15 ([[card:card-e-h]] current repair): reproduced and corrected at the schema owner.**

**Revision 2026-09-21 ([[card:card-e-h]] current queued extension verification):** the rich generated CHECK/FK graph is now exercised through the TS loader and pinned native oracle in UTF-8, UTF-16le, and UTF-16be. The public URL was reacquired development-side and matched the prior exact 1,007,616-byte digest; comments and living docs now preserve the floating-URL provenance while binding acceptance to size/hash. The Fetch-backed public Album row/FK path, malformed/legacy UTF vectors, parser generation, typecheck, package boundary, and deterministic 38+9 accounting pass. This remains read-schema representation without write enforcement or additional conformance credit.

**Revision 2026-09-21 ([[card:card-e-h]] public-fixture repair):** the temporary CHECK/REFERENCES gate was superseded after exact public Chinook bytes (1,007,616 bytes, SHA-256 `7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`) reproduced an Album rejection. Generated reductions now retain ordered CHECK expression/source and FK local/referenced columns, target links, actions, and deferral metadata; this does not implement writes. Pinned 3.53.4 read-only native capture verifies source ID, schema and representative rows.

**Earlier revision:** Current reproduction showed the predicted WITHOUT ROWID column as `notNull:false`, and generated CHECK/REFERENCES reductions were silently omitted. The loader now applies `build.c:2332-2407` implicit NOT NULL to declared WITHOUT ROWID primary-key columns and rejects recognized CHECK/REFERENCES/table FOREIGN KEY declarations as temporary unsupported before atomic publication. Focused persisted-catalog tests cover all three branches; graph construction remains progressive rather than claiming enforcement semantics.

**Superseded baseline label:**

Baseline `src/internal/schema.ts:200-213` derives `Column.notNull` only from the
literal declaration. It omits implicit PRIMARY KEY NOT NULL for
`CREATE TABLE t(a TEXT PRIMARY KEY) WITHOUT ROWID`; compare
`src/build.c:2354-2506`. `src/internal/parse.ts:23-34` extracts selected
constraints, while CHECK/REFERENCES semantics are neither constructed nor
explicitly unsupported despite the source-map claim. Correct the read-relevant
graph or state truthful unsupported boundaries. This does not require write-side
enforcement in the read-only engine.

### 3. B-tree seek algorithm replacement

**Revision 2026-09-15 ([[card:card-d-e]], integrated descendant of card-owned `97916d472406df267b00e33b07a86639a581e0dd`): corrected including sparse table LE ancestor fallback.**

Review v12 found that the first page-local repair could return an invalid table
cursor for LE in a gap between adjacent child ranges. The translated seek now
retains its selected-page ancestry and, when the selected subtree has no local
predecessor, descends only the preceding subtree's right edge to its maximum,
matching the applicable `sqlite3BtreeTableMoveto` cursor-stack behavior without
full materialization. A deterministic source-format, three-level sparse table
with exact bigint rowids 10 and 20 covers exact and inexact GE/LE at the boundary,
below/above bounds, fallback depth and corruption. The earlier immutable-fixture
off-path and cycle controls remain.

**Superseded repaired label (working tree over HEAD `303a8746b35df03f233c78a46fa668507bdb794d`): corrected except sparse table LE fallback.**

The baseline prediction was reproduced on the current implementation, not merely
carried forward. `BtreeDatabase.tableCursor()` and `indexCursor()` still call
`readTable()`/`readIndex()` in their constructors, recursively visiting the whole
tree before `TableCursor.seek()`/`IndexCursor.seek()` binary-searches the resulting
array. A focused disposable mutation changed the rightmost off-path child page
(page 141) of the 512-byte multilevel table fixture to type `0xff`. Seeking the
minimum rowid through the current TS `tableCursor(2)` failed during cursor
construction with `BtreeFormatError: unexpected b-tree page type`, before seek
could run (`work:///cards/card-d-e/processes/proc-8e3a81d062d3/stdout.log`). The
same immutable image, opened through the card-built pinned SQLite 3.53.4 library
(source ID `bf7c7f...59bcc`), returned rowid `-9223372036854775808` for both an
exact rowid predicate and the first ordered row; the unrelated rightmost page was
not fault-touched (`work:///cards/card-d-e/processes/proc-01847f777fb9/stdout.log`).

Pinned `sqlite3BtreeTableMoveto` (`src/btree.c:5805-6034`) compares table integer
keys on the current page and follows only the selected child; pinned
`sqlite3BtreeIndexMoveto` (`src/btree.c:6036-6183`) similarly page-searches packed
index keys and descends, retaining a cursor page stack. The TS substitution also
charges `maxBtreeDepth` against every branch visited at cursor creation rather than
the sought path and allocates descriptors proportional to the complete tree.
Existing movement/seek tests previously proved returned ordering only; they did
not protect fault-touch or seek work/allocation behavior. The working-tree repair
now performs page-local table/index descent and the added regression passes for
both off-path isolation and selected-path corruption. Existing complete
first/last/next/previous movement remains available through deferred full traversal
only when that movement is requested; cursor construction and seek no longer do
O(tree entries) descriptor work. Focused storage/record, deterministic accounting,
typecheck, package-boundary, and diff checks pass in
`work:///cards/card-d-e/processes/proc-c22fb69a467e/stdout.log`.

The retained regression now covers table/index minimum exact GE off-path fault
isolation, non-leftmost table and index descents with an unrelated malformed
subtree, selected-path table/index corruption, table/index selected-path cycle
limits, index selected-path depth limits,
index exact/inexact LE predecessor placement, explicit below-minimum/above-maximum
invalid placement, and a comparison-count guard showing seek work remains
path-local rather than proportional to all 2003 fixture entries. Pre-existing table seek coverage
exercises exact/inexact GE and LE; pre-existing index seek coverage exercises exact
and inexact GE. Preserve the existing lazy forward `tableScanCursor`,
record/overflow translation, shared owner/close invalidation, and borrow-generation
behavior.

### 6. Expression comparison and boolean lowering/caller contracts

**Revision 2026-09-14 ([[card:card-i-c]], integrated shared tree): all 4/4 audit callers fixed.**

Fresh pinned/public typed execution now matches `audit-6-case-prefix-truth` as well as mixed NULL, explicit-collation precedence, and affinity neighbors. CASE uses the shared `vdbe.c:numericType`-shaped conversion through `sqlite3VdbeBooleanValue` semantics; no CASE-specific parser/evaluator exception was added. The genuine CASE/ShortCircuit/Goto lowering remains intact.

**Superseded revision 2026-09-14 ([[card:card-i-c]], prior shared tree): 3/4 audit callers fixed; one shared numeric-conversion dependency remained.**

Fresh pinned/public typed execution at current shared HEAD reports exact matches for `audit-6-null-is-mixed`, `audit-6-right-explicit-nocase` (including the left-explicit-BINARY neighbor), and `audit-6-column-affinity`. `audit-6-case-prefix-truth` remains mismatched solely at the card-f/card-e numeric-conversion dependency: native treats TEXT `'12x'` as true while current `truth()` does not perform SQLite's numeric-prefix conversion; `'x12'` remains the false neighbor. The genuine CASE/ShortCircuit/Goto lowering is retained. Compare `src/vdbe.c` comparison NULL branch and affinity handling plus `sqlite3VdbeBooleanValue`; do not patch CASE around the shared conversion primitive.

**Superseded reproduced label ([[card:card-i-a]] research lane): partial; mixed-NULL,
right-explicit collation, and conversion-dependent CASE failures reproduced;
focused column-affinity hypothesis disproved for the selected current path.**

Pinned-oracle/public-TS captures show mixed `IS`/`IS NOT` returns `0,1,0,1`
natively versus `1,0,1,0` in TS; right explicit NOCASE returns 1 natively versus
0 in TS, while the left-explicit-BINARY neighbor returns 0 in both. `CASE WHEN
'12x'` is true natively and false in TS; `'x12'` is false in both. Conversely,
the selected INTEGER-affinity comparisons `b='1'`, `b='01'`, and `WHERE b=1` now
match exactly, as does adjacent TEXT-affinity `a=1`; the blanket lost-affinity
prediction is disproved for this path, not globally. Exact typed evidence is in
`test/conformance/cases/audit-expression-callers.json`. CASE truth depends on the
card-f numeric conversion owner and does not invalidate genuine CASE lowering.

Baseline `src/internal/vdbe.ts:109-131,149-169,308-315,387` emitted generic Binary
operations into a miniature evaluator. Predicted baseline discrepancies:

- `NULL IS 'ab'` is true and `IS NOT` false because the comparison remains zero
  after skipping NULL;
- `'a'='A' COLLATE NOCASE` is false because only left BINARY wins;
- resolved columns lose affinity, so source affinity is not applied; and
- `CASE WHEN '12x' ...` selects false through non-forced numeric affinity in
  `truth()` rather than SQLite prefix conversion.

Compare NULL branches `src/vdbe.c:2315-2331`, `src/expr.c:5181`, affinity at
`src/vdbe.c:2346-2384`, and `sqlite3VdbeBooleanValue`. Existing `e_expr` cases
8.1.1/.5/.9/.13 cover NULL/NULL, not adjacent mixed-NULL cases. Current work carries
affinity into Binary and has genuine CASE/register lowering, but this was not run
or accepted against source precedence, boolean callers, and typed public results.
Verify the partial correction and repair the owning comparison/boolean semantics.

### 7. Scalar Function opcode with independent JavaScript implementations

**Revision 2026-09-14 ([[card:card-i-c]], integrated shared tree): all 8/8 scalar audit cases fixed.**

`abs` now dispatches by original storage class as pinned `func.c:absFunc` does and uses the shared numeric-type conversion only for TEXT/BLOB, producing REAL 2/12 for the prefix cases. This joins the already-matching substr, length, and encoding-sensitive octet cases. Function opcode, FunctionContext cleanup, and bounded scan/output controls remain intact.

**Superseded revision 2026-09-14 ([[card:card-i-c]], prior shared tree): 7/8 audit cases fixed; TEXT `abs` remained a shared numeric-conversion dependency.**

Fresh typed public execution matches pinned 3.53.4 for `substr` zero, negative start/negative length, and BLOB class; `length(1.0)`; and `octet_length(1.0)` at UTF-8/UTF-16LE/UTF-16BE byte multipliers. `audit-7-abs-text-prefix` is the one remaining scalar mismatch: native returns REAL 2/12 for `'-2'`/`'12x'`, while current shared numeric conversion yields INTEGER 2 and REAL 0. Coordinate this with card-f's distinct `numericType` and card-e's Mem conversion activation rather than duplicating conversion in `abs`. Function opcode, FunctionContext cleanup, and bounded scan/output controls remain intact.

**Superseded reproduced label ([[card:card-i-a]] research lane): predicted high-risk
branches reproduced; no implementation repair.**

Pinned typed captures reproduce all listed substr outcomes (`ab`, `f`, `bc`, BLOB
`62`), TEXT abs distinctions (REAL 2 and REAL 12), `length(1.0)=3`, and
`octet_length(1.0)=3/6/6` for UTF-8/UTF-16le/UTF-16be. Current TS produces the
predicted wrong values or BLOB exception. Abs partly depends on card-f's shared
`numericType`/Mem owner; this card supplies caller tests without duplicating it.
See `docs/research/card-i-a-audit-expression-callers.md`.

Baseline `src/internal/vdbe.ts:304-305` has real Function dispatch but simplified
independent scalar algorithms. Against `src/func.c:356-444`, predictions are:
`substr('abcdef',0,3)` returns `abc` instead of `ab`; `substr('abcdef',-1,1)` returns
empty instead of `f`; `substr('abcdef',4,-2)` returns empty instead of `bc`; and
`substr(x'616263',2,1)` throws through TEXT access instead of returning BLOB `62`.
Existing positive `func2.0` coverage misses these branches.

Also predicted: `abs('-2')` pre-applies affinity and returns INTEGER 2 rather than
REAL 2; `abs('12x')` returns 0 rather than 12; `length(1.0)` uses `String(1)` and
returns 1 rather than the length 3 of `1.0`; numeric `octet_length` omits the
encoding multiplier from `src/func.c:167-170`. Translate the relevant owning
function branches and Mem conversion callers rather than preserving independent
algorithms without an exceptional rationale and source-based evidence.

### 10. ORDER BY shortcut replaced; restricted resolver verified

**Revision 2026-09-14 (`85cb87a` through current [[card:card-j-b-b]] repair): fixed for admitted direct-column terms, including complete multi-term keys; expression, explicit COLLATE/NULLS, and LIMIT coercion are now admitted.**

Every admitted ORDER term now resolves with result alias and positive ordinal precedence before table-column fallback. Each term reaches immutable multi-field `KeyInfo` with declared collation, ASC/DESC, and NULL-order flags; `SorterInsert` carries the complete key range and typed `SorterCursor` compares all terms through shared `compareMem`. Public tests include the pinned `ORDER BY y ASC,x ASC LIMIT 12` sequence. The historical transition is explicit: `3104d7a` exposed acceptance while only one-term `KeyInfo` was preserved (the prerequisite card observed a missing expected exception), `af6ee17` temporarily rejected multi-term input to prevent silent secondary-key loss, and `37fd90b` retained the pinned expected rows until this repair. Relational accounting is now 2/18 after promotion of exact-setup `up-select4-10.3` alongside `up-limit-1.2.1`; `up-distinct-3.0` passes publicly but remains no-credit because its fixture omits upstream `UNIQUE(a,b)` while automatic-index schema loading is unsupported. Combined DISTINCT/ORDER lowering patches `Found` only after complete variable-length ORDER key production and `SorterInsert`; pinned/public non-result multi-term ORDER evidence protects this control edge.

ORDER expressions and explicit COLLATE/NULLS syntax are lowered through generated expression nodes and per-term KeyInfo flags. Compounds remain unsupported under the owner/root gates. Their future pinned mapping is `multiSelectByMerge` and coroutine merge control near 3314-3399, not the nonexistent `multiSelectOrderBy` name.

**Superseded baseline/active label:**

Baseline `src/internal/vdbe.ts:296,372-377` used the final SQL token as the ordering
column and eagerly JavaScript-sorted decoded records with BINARY in `OpenRead`.
That bypassed term resolution, per-term collation/direction/NULL rules, and bounded
sorter execution. Autonomous work has removed that exact shortcut and introduced
sorter/ephemeral opcodes, restricted table ORDER BY/DISTINCT/LIMIT, column-affinity
propagation, additional accounting/lifecycle edits, and relational/private-state
tests. The nonrelational path rejects ORDER BY while the table path attempts
restricted support. This is active partial work, not an established fix; preserve
it and review current term resolution, source-based KeyInfo/sorter/control flow,
callers, typed public results, and honest unsupported boundaries. Old 40-case
evidence cannot be carried over after these changes.

For future compound-order mapping, the pinned source has `multiSelectByMerge` near
`src/select.c:3399` and coroutine merge near 3314, not the obsolete
`multiSelectOrderBy` name. Correct the mapping when relevant without inventing full
compound support for a documentation fix.

## Priority B — localized ports and shared primitives

### 4. Tokenization and actual Lemon fallback

**Revision 2026-09-15 ([[card:card-e-b]] current repair): reproduced and corrected
for the identified tokenizer and fallback branches.**

`src/internal/tokenize.ts` now follows the pinned `sqlite3GetToken` branches for
hexadecimal integers, identifier suffixes that make a numeric token illegal,
the UTF-8 BOM before generic non-ASCII identifier handling, and the operator
cross-product (`><` is two tokens). The generated parser artifact now carries
`yyFallback`, and `src/internal/lemon-runtime.ts` applies it only after the current
parser state has no action for the original lookahead, matching the control in
`tool/lempar.c`. There is no REPLACE-spelling patch in the parser. Contextual
WINDOW/OVER/FILTER token adaptation is also covered through the pinned tokenizer
decision branches. Deterministic generator/parser tests exercise `0x10`, illegal
`0x10z`, BOM, valid neighboring operators, rejected `><`, REPLACE-as-function,
and keyword-context neighbors. These corrections do not imply that every grammar
semantic action or WINDOW query consumer is implemented.

**Superseded baseline label:**

Baseline `src/internal/tokenize.ts:35-45` misses hexadecimal numeric `0x10` and
illegal-suffix handling; BOM recognition follows generic byte-`>=128` identifier
handling and is unreachable; and the operator cross-product accepts `><`. Compare
`src/tokenize.c:433-497,575-581`. `src/internal/parse.ts:69` special-cases REPLACE
followed by `(` as ID instead of parser-state-dependent fallback. The generated
runtime uses defaults but not actual `yyFallback`; compare `src/parse.y:272-277`
and `tool/lempar.c:549-607`. `docs/TRANSLATION.md:657-678` therefore overstates
fallback/wildcard generation. Preserve the genuine generator/tables and implement
the source mechanisms at their owner, not through SQL spelling patches.

### 5. UTF-8 lead-byte conversion

**Revision 2026-09-15 ([[card:card-e-h]] current repair): reproduced and corrected.**

The current decoder produced U+1000 for `FF 80 80`, confirming the prediction. `src/internal/utf.ts` now ports all `sqlite3Utf8Trans1` groups, including zero for 0xfe/0xff. Focused neighbors protect malformed, replacement, and accepted legacy behavior; a manifest/source-ID-verified pinned-library capture confirms `FF 80 80 -> U+FFFD` and `FD 80 80 -> U+1000`.

**Superseded baseline label:**

Baseline `src/internal/utf.ts:20-26` masks the lead byte rather than fully
translating `sqlite3Utf8Trans1`. For bytes `FF 80 80`, 0xFF starts at 1 instead of
0, predicting U+1000 rather than replacement U+FFFD. Compare
`src/utf.c:52-60,164-174`. This is a localized fidelity defect, not evidence for
replacing the architecture.

### 8. Distinct numeric coercion owners conflated

**Revision 2026-09-14 ([[card:card-i-c]], integrated shared tree): fixed and reproduced 14/14, still zero-credit pending promotion.**

The shared Mem layer now keeps `vdbe.c:numericType/computeNumericType` distinct from NUMERIC affinity and from `vdbemem.c:sqlite3VdbeIntValue`: arithmetic/boolean/function callers accept numeric prefixes while preserving decimal/exponent REAL classification, whereas CAST INTEGER consumes only the signed decimal prefix. The public typed audit now matches CASE prefix truth, TEXT-prefix `abs`, and numericType/CAST neighbors exactly; oversized literal REAL behavior remains matched. This is one shared value system, not caller-specific conversion duplication.

**Superseded revision 2026-09-14 ([[card:card-i-c]], prior shared tree): oversized literal caller fixed; three dependent audit cases remained exactly CASE prefix truth, TEXT-prefix `abs`, and numericType/CAST neighbors.**

Current typed execution matches pinned REAL storage and IEEE-754 signs for both `9223372036854775808` and `-9223372036854775809`. The remaining `audit-8-numeric-neighbor` differences are native REAL/REAL and INTEGER-prefix 1/123 versus current INTEGER/INTEGER and 100/12300000. Together with `audit-6-case-prefix-truth` and `audit-7-abs-text-prefix`, these are the exact three 14-case mismatches and share card-f/card-e conversion ownership. Integration should first land the Mem/numeric conversion owner, then rerun these three callers; no local CASE or Function special case is warranted.

**Superseded reproduced label (caller evidence from [[card:card-i-a]]; owner remains
card-f, activation-gated by card-e): predictions reproduced; not repaired here.**

The pinned oracle promotes both oversized signed decimal literals to REAL while TS
rejects at prepare. It returns REAL for `typeof('1.0'+0)`/`'1e2'+0` and
INTEGER-prefix 1/123 for CAST neighbors; TS returns INTEGER/INTEGER and
100/12300000. Exact IDs are `audit-8-oversized-literal` and
`audit-8-numeric-neighbor`; CASE-prefix and TEXT-abs are dependent callers. No
shared conversion or literal owner was changed here.

Baseline `src/internal/vdbe-primitives.ts:15-22` uses a private CAST NUMERIC copy
for `numericType`, conflating `src/vdbe.c:467-510` with
`src/vdbemem.c:893-915`. Predicted `typeof('1.0'+0)` is integer rather than real.
INTEGER cast in `src/internal/mem.ts:490-497` floating-parses exponents:
`'1e2'` predicts 100 instead of integer-prefix 1, and `'123e+5'` predicts 12300000
instead of 123. Oversized decimal integer literal compilation rejects values at or
above 2^63 except unary minimum, while `src/expr.c:4330-4360` promotes via
`codeReal`. Preserve genuine arithmetic overflow/remainder translation; fix each
semantic owner and its callers rather than creating one universal conversion.

### 9. NOCASE embedded-NUL comparison

**Current revision: corrected and publicly exercised.**

Baseline `src/internal/comparison.ts:103-109` continued after embedded NUL. Pinned
`src/main.c:nocaseCollatingFunc` calls `sqlite3StrNICmp` for the bounded shorter
length; `src/util.c:sqlite3_strnicmp` stops at NUL, after which the collation uses
full byte-length tie-breaking. Shared `nocaseCompare` now preserves this exact
rule without truncating the stored `Mem`/JS string. Direct comparison tests cover
equal-length `a\0b`/`a\0c` equality and unequal-length ordering; the public ORDER
contract makes that equality observable through a distinct secondary key and also
executes declared NOCASE, explicit BINARY, and RTRIM expectations. Finding 9 is
closed at the current revision; the historical baseline prediction is retained
above only as provenance.

## Priority C — documentation and evidence precision

### 11. Coverage/mapping claims and oracle provenance

**Revision 2026-09-14 (`85cb87a` plus [[card:card-j-a-c]] correction): relational claims/mapping reconciled; unversioned fixture provenance caution remains.**

Relational machine accounting now records 3 attempted/passed assertions of 18 and 2 credited exact-setup upstream assertions (`up-limit-1.2.1`, `up-select4-10.3`); passing `up-distinct-3.0` remains no-credit because the fixture omits its upstream UNIQUE autoindex; two additional public queries are explicitly uncredited smoke outside that denominator. `docs/api.md`, `docs/TRANSLATION.md`, and `docs/SQLITE_SOURCE_MAP.md` now agree. The obsolete/nonexistent `multiSelectOrderBy` mapping was replaced by pinned `select.c:multiSelectByMerge` and coroutine merge control, while compounds remain unsupported. This does not erase the separate provenance limitation below: fixtures built by unversioned host Python SQLite are setup artifacts, not pinned-oracle proof.

**Superseded baseline label: partial.**

At baseline, `docs/api.md:3` said functions were unsupported despite an
implementation; `docs/TRANSLATION.md:1168` described the old Expression opcode and
materialized sort while 1174 described newer lowering; and
`docs/SQLITE_SOURCE_MAP.md:601` called function collation backlog immediately
before an implemented row. Some mapped method names do not exist in the pinned
definitions. Current dirty API/source-map edits improve relational accounting but
do not reconcile all stale claims, including the obsolete compound-order routine
name. Preserve those autonomous edits and reconcile documents with actual behavior
as their semantic fixes land.

**Revision 2026-09-15 ([[card:card-e-h]] schema provenance): corrected for current schema/UTF claims.**

The schema tests still use host Python SQLite only to create disposable setup images and no longer treat that generator as pinned proof. `test/oracle/schema-identifier-case.test.py` loads the manifest-pinned library, checks exact `sqlite3_sourceid()`, and independently captures catalog identity in all database encodings plus the UTF lead-byte result. Existing generated storage fixtures retain their catalog/manifest source identity checks.

**Superseded caution:**

The schema/catalog fixture builder uses unversioned host Python SQLite for some
fixtures. That is useful setup, not proof from the pinned 3.53.4 oracle. Evidence
claiming the pin must verify source/version identity. Regeneration equality,
dimensions, citations, opcode names, and selected tests establish limited facts,
not semantic equivalence.

## Sustained correction rule

Verify current status first and reuse existing cards. Coordinate corrections
through immediate parent Planners, who may reopen, notify, and separately activate
their own direct children. Do not reset progress, recreate every completed card,
or ask the operator to edit engine code or card history. Prioritize structural
query ownership and shared semantic owners before dependent features where actual
dependencies justify it; localized fixes may proceed with their owning slices.

Default to translating implementing upstream routines, structures, algorithms,
and branches. Idiomatic TypeScript objects, BigInt, async execution, and browser
representation changes are ordinary adaptations. An exceptional algorithm
substitution needs a concrete TypeScript/browser/read-only rationale, comparison
with upstream, preserved observable behavior, and source-based tests in the guide,
source map, or a code note. Planner and Reviewer decide ordinary technical
exceptions. Only product-scope, observable-guarantee, or exclusion changes require
owner decision.

For each correction, inspect high-risk branches and neighboring upstream
assertions. Compare independently obtained pinned-oracle results through public
APIs, preserving INTEGER versus REAL, NULL, encodings, BLOB bytes/errors, and
caller behavior. Use focused tests first and broader conformance when a shared
owner warrants it; there is no fixed quota. Maintain baseline prediction, current
reproduction or disproof, owning correction, and exact validation evidence beside
each finding. Receipt of this audit, a notification, or a runtime upgrade is not
evidence that any finding is resolved.


### 11. LIMIT control/top-N correction (current working revision)

The prior synthetic `ComputeLimit` and host `ResultRow` counters are removed. Admitted scalar/table programs emit register-based `MustBeInt`, `OffsetLimit`, zero-test, `IfPos`, `IfNotZero`, and `DecrJumpZero` control mapped to SQLite 3.53.4 `select.c:computeLimitRegisters`, `codeOffset`, and `pushOntoSorter`, with implementations mapped to `vdbe.c`. Ordered positive LIMIT retains at most LIMIT+OFFSET typed sorter candidates; negative LIMIT remains unbounded. Program-shape and public lifecycle/resource tests protect the correction. Relational accounting remains exactly 2/18; no new upstream case is credited.

### Findings 10/11 current reconciliation (revision 2026-09-16)

The earlier Finding 10 statement that compounds remained unsupported is retained
above as historical provenance, not current fact. The admitted bounded surface now
includes scalar and structured-VALUES compounds plus direct-column/no-WHERE table
arms, including set-prefix to trailing `UNION ALL` handoff, typed duplicate
semantics, compound collation, global ORDER and LIMIT/OFFSET. Wider table
expressions, joins, per-arm WHERE, subqueries/CTEs and the other documented forms
remain explicit prepare-time gaps. For admitted finite producers the TypeScript
VM uses typed bounded sorter/ephemeral materialization instead of pinned
`select.c:multiSelectByMerge` coroutine subprograms because it has no native
resumable subprogram stack. Shared `Mem`/`KeyInfo` comparison, representative
choice, collation, ordering, multiplicity, global limits, async suspension,
cancellation and cleanup are preserved and source-based public tests cover them;
no `Array.sort`, JS `Set`, AST execution, disk spill, or main-file write is used.

Finding 11's prior 3/18 relational snapshot remains the separate relational gate
provenance, but its claim that compounds are unsupported is superseded. The exact
compound gate is 22 declared / 22 attempted / 22 passed / 22 credited, with its
12-case native boundary companion receiving no additional credit. The relational
working-state accounting remains 18 declared, 3 attempted/passed, 2 credited, 15
unattempted, and zero companion credit; no number is promoted by the resource fix.

The current resource correction makes documented `maxPrivateBytes` genuinely
aggregate across all simultaneously live private cursors in one statement
execution. One VDBE-owned budget covers insertion, atomic replacement, deletion,
intersection, clear, rollback and close, so compound primary/auxiliary/sorter state
cannot multiply the advertised cap. Public and primitive regressions cover an
overlapping-cursor failure, first-error retention, complete cleanup, rerun, and
later admission. Disk spill remains a browser adaptation omission rather than a
permanent SQL-scope reduction. The unversioned-fixture provenance caution above
also remains in force.

### Findings 10/11 current completion update (revision 2026-09-16, integration HEAD `7660b18`)

This revision supersedes only the old findings' current-state predictions; their
text remains above as provenance. The admitted compound surface is bounded:
scalar arms, structured multirow `VALUES`, and the established direct-column,
single-source table-arm subset with no per-arm `WHERE`. It includes all four set
operators, set-prefix-to-trailing-`UNION ALL`, typed duplicate representatives,
compound ORDER, and global LIMIT/OFFSET. It does **not** admit table expressions,
per-arm `WHERE`, joins/multiple sources, subqueries, aggregates, windows, CTEs,
views, or general coroutine-merge execution; those forms remain atomic typed
prepare-time exclusions.

For admitted finite scalar/VALUES producers, the comparison point is pinned SQLite
3.53.4 `select.c:multiSelectByMerge` and its resumable VDBE coroutine subprograms.
The TypeScript/browser VM has finite generated producers but no native resumable
subprogram stack, so it exceptionally materializes through the shared typed,
bounded sorter/ephemeral implementation. This is not a host `Array.sort`, JS
`Set`, second parser, catch-all evaluator, or disk/main-database path. Shared
`Mem`/`KeyInfo` comparison preserves storage classes, NULL and INTEGER/REAL
equality, left-to-right collation and representatives, ordering and multiplicity;
shared destinations preserve global LIMIT/OFFSET and asynchronous row suspension.
Work, deadline, cancellation, entry/key/byte/result bounds, first-error cleanup,
reset, and finalize remain enforced. Parser ownership, opcode/destination,
collation/representative, set-to-ALL, ORDER/LIMIT, cancellation, lifecycle, and
resource tests are the source-based evidence for those preserved observables.

Compound conformance is exactly **22 declared / 22 attempted / 22 passed / 22
credited** through the singular public prepared-statement API. The separate
12-case pinned-native boundary capture and its focused public companions retain
provenance but receive no additional credit and do not alter that denominator.
The earlier relational working-state snapshot—18 declared, 3 attempted/passed,
2 credited, 15 unattempted—is explicitly historical and separate; it is neither
current compound accounting nor evidence for compound behavior.

The resource blocker identified after the prior reconciliation is now closed by
an execution-owned private-byte budget shared by every simultaneously live sorter
and ephemeral cursor. Admissions, replacement rollback, deletion, intersection,
clear, close, error unwind, reset, and finalize reserve/release against that one
budget, preventing multiple compound cursors from multiplying `maxPrivateBytes`.
The affected aggregate-limit/public/parser/accounting gate passed **73/73** and the
broad regression gate passed **183/183** at integration HEAD `7660b18`; these
counts support the aggregate-resource correction but do not expand SQL scope or
compound credit. The original source-identity and unversioned-fixture cautions
remain in force.

### 2026-09-16 revision — multi-source semantic foundation ([[card:card-k-b]])

Current work supersedes the architecture baseline's “TS credit zero” only for the
semantic foundation: generated reductions now own ordered SrcList; resolver tests
cover ordinary lookup/star/NATURAL/USING/FULL identity, declared-column/rowid and
INTEGER PRIMARY KEY branches, result-alias substitution, and ON outer-owner scope;
public single-source prepare/step consumes expansion for alias star, WHERE result
aliases, and rowid. Subsequent bounded `resolveSelectStep` work now prepares
GROUP/HAVING/ORDER/LIMIT, aggregate placement, built-in function/FILTER ownership,
and built-in window owners through generated reductions, but adds no evaluator
credit for those forms. Multi-source preparation now exposes SQLite name/ON-scope
errors before its execution gate. It does **not** supersede the join-execution
finding: multi-source public
SQL remains atomically temporary unsupported and the 47-case gate has not been
claimed or compared against TypeScript.

### 2026-09-17 revision — generated-reduction compound identity correction

The earlier foundation's compound-ORDER behavior had accumulated a copied-token
`normalizedTokens` canonicalizer. That implementation was not an acceptable
translation even where tests matched SQLite. It is removed: compound expression
identity now walks generated Lemon reductions directly, and a static regression
rejects restoration of token-array splicing/reconstruction. The source-identity
verified 47-case pinned capture recaptures exactly, and focused public checks cover
duplicate result names plus NULL, empty TEXT, int64, and REAL across UTF-8,
UTF-16le, and UTF-16be fixtures. Existing parser 27/27, compound 22/22,
expressions 40/40, and first-SELECT 8/8 gates remain exact. This correction adds
no join credit and does not pull in downstream joins, GROUP/HAVING,
frame/window/aggregate execution, or general/user-defined functions.


### 2026-09-17 revision — comma/CROSS/INNER execution ([[card:card-k-c]])

This revision supersedes only the preceding semantic-foundation statement that all
multi-source public SQL is gated. Ordinary rowid-table comma, CROSS, and INNER
joins now execute as cursor-indexed source-order nested loops with source-owned ON
and USING/NATURAL predicates, innermost WHERE, shared expression/destination
lowering, and no eager Cartesian row materialization. The joined compound-arm gap
is closed through the existing global sorter destination. Cursor maps, private
state, reset/finalize, suspension, and first-error cleanup remain statement-owned.

Denominators are intentionally not conflated: the immutable native oracle is still
**47 declared/47 captured** (including unsupported outer joins); the admitted
pinned/public matrix is **8/8** and the focused INNER runtime suite is **27/27**.
LEFT/RIGHT/FULL unmatched control is still temporary unsupported, so this is not a
47/47 TypeScript-runtime or general join-compatibility claim. The existing
expressions **40/40**, first-SELECT **8/8**, and compound **22/22** labels are
unchanged.

### 2026-09-17 revision — LEFT JOIN / NullRow ([[card:card-k-d]])

The earlier revision's statement that LEFT execution remained gated is superseded.
LEFT now uses source-owned match registers and cursor-owned NullRow state; ON,
USING, and NATURAL determine matching before the marker, while WHERE remains after
NULL extension. The bounded public suite covers the four LEFT-bearing immutable
capture cases and focused all-encoding/value/metadata/composition/destination and
lifecycle branches. The immutable capture remains **47/47 native captured**; this
is not 47/47 TypeScript credit because RIGHT and FULL remain temporary unsupported.
The prior INNER denominators remain unchanged.

### Historical 2026-09-17 revision — bounded RIGHT/FULL execution ([[card:card-k-e]]; superseded below)

The prior blanket RIGHT/FULL rejection is superseded for terminal barriers. Current
public execution records RHS rowids in budgeted typed ephemeral state, performs the
pinned unmatched-RHS rescan with left `NullRow` cursors, and combines it with LEFT
fallback for FULL. Seven of thirteen RIGHT/FULL-bearing immutable capture cases are
credited, with lifecycle and forced-failure companions. This is deliberately not a
full completion label: six cases involving a downstream source after the barrier or
multi-left USING/NATURAL wildcard merged values remain atomic temporary unsupported.
The immutable native denominator remains 47/47 captured.

## Historical 2026-09-17 RIGHT/FULL manifest denominator (scope corrected below)

The prior 7/13 execution label is superseded. Current public tests promote all 13 successful RIGHT/FULL-bearing stage-3 cases and both adjacent pinned resolution-error cases (15/15 bounded denominator). The implementation now includes non-terminal shared continuation and RIGHT USING/NATURAL merged ownership. Evidence remains scoped: it does not close unrelated aggregate/subquery or storage-shape findings.

## Current revision 2026-09-17 — repeated RIGHT/FULL barrier correction

The prior 15/15 label is retained only as the single-barrier manifest denominator and is superseded as a claim about arbitrary chains. Immutable project review `record:///review.md?card=card-k&v=3` found that one matcher silently admitted later barriers. Production now atomically rejects >1 RIGHT/FULL barrier at prepare. Fidelity gap remains explicit: upstream owns per-`WhereLevel` `WhereRightJoin`; implementing that cardinality is the next tranche.

### Revision 2026-09-18: ordinary WITH claim

The earlier blanket prediction that CTEs are rejected is no longer current for
the bounded ordinary tranche. Current public TypeScript evidence is
`test/conformance/cte-execution.test.mjs` across three encodings; card-n-a native
oracle assertions retain native credit, while new focused cases are public or
companion evidence only. Shared declaration identity and one-fill/`OpenDup`
materialization are implemented. Follow-up public evidence now covers represented
derived and stored-view ownership (including caller-scope isolation), mixed CROSS
JOIN, grouped aggregation, and bounded UNION ALL. At that ordinary-WITH checkpoint, recursive ownership was recognized
before ordinary lowering and had a dedicated temporary diagnostic, but recursive
queue execution remained wholly unimplemented. The recursive revision immediately
below supersedes that implementation status. Expression-owned nested WITH retains
a separately asserted temporary residual; it is not evidence for the recursive
gate. Other unrepresented nesting/composition remains a gap. This revision does
not claim full SQLite WITH compatibility.

### Revision 2026-09-18 — recursive CTE baseline superseded

The earlier finding that recursive queue execution was wholly absent is no longer current. The bounded route now translates FIFO/all-history/priority Queue iteration, recursive LIMIT/OFFSET, exact represented validation, and VDBE lifecycle/control behavior. A focused follow-up additionally composes distinct recursive declarations through a bounded direct-projection cross join by redirecting each iterative producer into statement-private typed VDBE sorters; this is public companion evidence, not added upstream credit. See `TRANSLATION.md` and `SQLITE_SOURCE_MAP.md`. This is not full SQLite recursive-SELECT compatibility: unsupported underlying source/destination composition routes listed there continue to reject temporarily.

### Window rewrite current reconciliation (revision 2026-09-18, [[card:card-o-b-f]])

The earlier review statements that the generated graph had no evaluator remain correct for frame runtime, but are no longer complete for prepare. Current code represents a bounded pinned window resolver/rewrite handoff, including correlated/local scalar-subquery traversal, compatible layer grouping, sort-copy/prefix handling, selective aggregate-depth repair after generated-layer attachment, and pre-construction ORDER aggregate misuse validation. Both scalar and table-backed public prepare routes reject atomically before Program publication after those phases. This is not a claim that the complete mutable SELECT rewrite or VM setup is emitted: cursor/register and Gosub/Return fields remain descriptive ownership in the immutable handoff. `sqlite3WindowCodeInit`/`sqlite3WindowCodeStep`, `OpenEphemeral`/`OpenDup` and subroutine emission, callback execution, frame buffering and row production remain absent. Consequently immutable window accounting is unchanged (29 declared, zero TypeScript attempts/credits); source-based rewrite tests are implementation evidence, not conformance promotion.


### Window setup reconciliation (revision 2026-09-18, [[card:card-o-b-g]])

The prior revision's metadata-only VM-setup finding is resolved for the bounded pre-step phase. Current `compileWindowSelectLowering` emits internal `OpenEphemeral`/`OpenDup`, partition/one/accumulator initialization, reserved result registers, and select-loop `Gosub`/`Return` operations with compatible sharing and distinct nested ownership. The broader evaluator finding remains open: `sqlite3WindowCodeStep`, callbacks, frame buffering, and row publication are absent, and public prepare still rejects before Program/Statement publication. Accounting therefore remains exactly 29 declared and 0 TypeScript attempts/credits.

### Producer-loop finding reconciliation (revision 2026-09-18)

The disconnected-helper finding in `record:///review.md?card=card-o-b&v=3` is resolved at the pre-step boundary: the ordinary public compiler routes invoke internal lowering, and its Program has one source scan with per-row recursively ordered Gosubs and continuation-owned Returns. It is discarded before the unchanged unsupported error. This does not resolve frame evaluation. EXCLUDE and special built-in CodeInit application state are explicitly deferred with `sqlite3WindowCodeStep`; accounting stays 29 declared, 0 TypeScript attempts/credits.

### Recursive lowering reconciliation (revision 2026-09-18)

The flattening defect identified by `record:///review.md?card=card-o-b&v=9` is corrected: emitted operations now contain distinct child-consuming coroutine/sorter loops for incompatible groups, and only the innermost producer owns properly nested original source scans and moved clauses. Tests inspect the control graph, layer-local sort ownership, compatible sharing, incompatible nesting, and two-source rewind structure. This resolves compiler topology only; frame evaluation remains absent and accounting remains 29 declared, 0 TypeScript attempted/credited.

### Aggregate-window execution reconciliation (revision 2026-09-19, [[card:card-o-c-b]])

The earlier findings that frame evaluation and public publication were absent are
superseded for the allocated aggregate-only surface. Current VDBE lowering owns
partition/peer/frame control, typed ephemeral caches, coroutine suspension and
aggregate callback lifecycle; represented recursive queues feed that coroutine
without host recursion. Public evidence is 43/43 executable with 25/25 source
credit, plus a separate 1/1 no-credit private-controls validator. At that
aggregate-only checkpoint, ranking/value special built-ins and unrepresented
compositions were not promoted; the later special-window revision below supersedes
the former limitation. Neither denominator is a general SQLite compatibility claim.

### 2026-09-19 revision — direct REAL column extraction

Fresh source-ID-checked pinned 3.53.4 execution showed declared REAL columns
returning REAL 20.0/10.0 even when record storage uses an integer serial type;
public TypeScript returned INTEGER/bigint before this correction. The mismatch was
identical in UTF-8, UTF-16le and UTF-16be. `expr.c` emits `OP_RealAffinity` after
`OP_Column`, and `vdbe.c` realifies only `MEM_Int|MEM_IntReal`. The repaired direct
projection now follows that branch with a distinct VM operation. The fixture/test
matrix also verifies 35.5, NULL, signed int64 boundaries, unchanged NUMERIC and
INTEGER columns, declared/origin metadata, and statement/connection reuse. Raw
record serial decoding remains unchanged; upper() and ordered UNION are unrelated
open findings. Fresh review baseline evidence is retained in card status; the repair
is commit `ab674fd7b84ddeb5ff0b0b4dde9ffa19a9cfc1ff`.

## Revision 2026-09-19 — expression-subquery read-cursor ownership correction

The accepted expression-subquery implementation (`e9ef7b0`, followed by the
naming-only `cf41a84`) and its earlier 133/133 focused result did not establish
correct parent-VDBE cursor ownership. A public Fetch reproduction over `users` and
`orders` showed that both filtered and unfiltered table-backed `IN (SELECT ...)`
leaked `BtreeCursorStateError: cursor is not positioned`. The exact manifest-pinned
SQLite 3.53.4 source ID returned `Alice, Cara` and `Alice, Bob, Cara`, respectively.

Root cause was child-plan-local source numbering: `compileTableSelect()` opened the
outer table on cursor 0, then opened an independently resolved child source on its
own cursor 0 in the same VDBE. The child scan replaced and exhausted the positioned
outer cursor. SQLite's parent parse owns unique `SrcList.iCursor` values while
`expr.c:sqlite3CodeSubselect` lowers the SELECT into that parent VDBE. The correction
therefore relocates each child-owned read source to a VDBE-unique expression cursor,
uses that relocated cursor for child column/rowid binding and `Rewind`/`Next`, and
retains an already resolved enclosing expression's outer cursor. This is an
ownership correction, not an alternative to SQLite's IN NULL/affinity algorithm.

Public regression coverage is in
`test/conformance/subquery-view-foundation.test.mjs` and immutable UTF-8, UTF-16LE,
and UTF-16BE fixtures under `test/fixtures/expression-cursor/`. It covers the exact
filtered/unfiltered multirow queries, reset/rerun, empty RHS, and a NULL-bearing
`NOT IN` RHS. The focused regression passed 3/3. The complete subquery/view file
passed 174/174 after the correction. The combined subquery-view command reached
188/189: its sole failure is an unrelated concurrent window-admission expectation
in `from-subquery-routes.test.mjs`; all expression-subquery cases passed. Evidence:
`work:///cards/card-m-f-k/processes/proc-b16b1a50c562/stdout.log`,
`work:///cards/card-m-f-k/processes/proc-d8ac7fb46cb4/stdout.log`, and
`work:///cards/card-m-f-k/processes/proc-38cc53a6b0f1/stdout.log`.

### Revision 2026-09-19 — special built-in window execution

The earlier prediction that ranking/value special built-ins were outside runtime
execution is superseded for the bounded represented surface. All eleven pinned
built-ins now execute through the source-shaped aggregate/frame or direct
application-cursor branches. Current evidence is special-window 42/42 (41 public
executables plus accounting for 43 declarations/two source-only) and aggregate
window/rewrite 92/92. This changes those denominators only; it does not imply
whole-SQLite window or SELECT compatibility. Remaining limitations are
prepare-time rejection of unrepresented expressions/compositions and the stated
source-only controls. No generic host-array/full-partition recomputation exception
was adopted.

## Revision 2026-09-20 — ordinary scalar registry delivery

The earlier 12/38 and 14/36 ordinary-scalar predictions are superseded. The shared
registry now reports 47 dispatchable rows and three represented non-dispatchable
sibling rows: `printf`, `format`, and `round`. LIKE/GLOB are now dispatched through
the source-shaped bounded pattern matcher; the immutable five-observation public
pattern corpus and cross-encoding boundary gate pass. Public Fetch evidence
for the owned tranche is 26 cases/44 immutable observations and includes bound
parameters, no-FROM composition, exact expected errors, and both persisted-column
cases across physical UTF-8/UTF-16LE/UTF-16BE fixtures. Mixed-owner rows compare
owned projections only. This checkpoint did not claim date/time, math, JSON, format,
or round support; its statement excluding pattern support was contradicted by the
same paragraph's passing LIKE/GLOB evidence and is superseded by the current 50/50
ordinary-scalar boundary. A post-review correction translates `quote(REAL)` through the
shared `sqlite3FpDecode`/`%!0.17g` primitive instead of host number formatting,
with pinned-native and public exact-output vectors for typed integral REAL, signed
zero, round-trip/precision extremes, and infinities; quote TEXT/BLOB expansion now
preflights `maxResultBytes`. The historical 47/50 checkpoint and its formatting exclusions are superseded by the current 50/50 accounting above.

### Revision: owned scalar bounded execution (2026-09-20)

The review-v6 findings for late output checks and unchecked costly scalar loops are addressed in the implementation: owned growing branches preflight UTF-8/BLOB size before host materialization; nested `instr` comparisons and long Unicode/trim/unhex/concat/char loops charge/check at bounded intervals; random/zero BLOBs admit output and proportional work before allocation, with random generation checkpointed per browser-safe chunk. The source map and living guide record the retained upstream `instr` order and the concrete Web Crypto/deferred-zero adaptations. Public lifecycle/control tests preserve first-error and connection reuse behavior. Denominator remains 47/50 with no `printf`/`format`/`round` credit at this
historical checkpoint.

### Revision: ordinary scalar integration (2026-09-20, [[card:card-p-b-c]])

The preceding 47/50 checkpoint is superseded. Inspection of the immutable
registry, resolver, compiler `Function` lowering and VDBE callback dispatch shows
all 50 ordinary-scalar rows dispatchable after the translated
`printf`/`format`/`round` delivery. The formatter uses pinned `printf.c` and
`func.c` branches rather than host formatting. Focused public tests cover its
aliases/arities/diagnostics, values, parameters, composition, output bounds and
saved-error cleanup. The 12/38 fields in the immutable tests-first spec remain
historical allocation metadata only. Date/time, math, JSON, aggregate and window
surfaces are not included in this 50-row denominator.

### Revision: formatting fidelity and allocation admission (2026-09-20, [[card:card-p-b-b]])

The ordinary-scalar integration formatting claim is now backed by a corrective
source comparison rather than the initial partial implementation. Missing
`printf.c` branches for `%r`, comma grouping, terminal `%`, UTF-8 byte/character
width, negative dynamic precision, and floating special values are translated.
All dimension-driven materialization is checked before allocation and reports
the typed result-limit error with normal saved-error/finalize cleanup. Focused
public values were independently matched against the manifest-source-ID-pinned
oracle; hostile dimensions and later connection reuse are covered locally. This
correction changes no denominator or product scope.

#### Revision: conversion-specific formatter precision admission

The re-review finding in `record:///review.md?card=card-p-b&v=6` is corrected:
large precision is no longer rejected globally as output size. String and escape
conversions perform bounded source-shaped scans and preflight only actual output;
character and numeric conversions retain conversion-specific materialization
checks. Pinned-native/public short and empty values now succeed under a five-byte
ceiling, while true escaped, repeated-character, and floating excess preserve the
typed failure and statement lifecycle.

#### Revision: conversion-specific formatter width admission

The `%n` finding in `record:///review.md?card=card-p-b&v=10` is corrected. Width is
parsed safely but admitted only by emitting conversions; SQL `etSIZE` consumes a
dynamic width when present, consumes no conversion value, clears width, and emits
nothing. Pinned-native/public literal and dynamic `%n` discriminators run under a
five-byte ceiling while existing emitting-width failures and lifecycle controls
remain covered.


## Revision 2026-09-20 — declared REAL consumer coverage

The 2026-09-19 `ab674fd` repair was partial: it realified direct projections but
left expression-tree column reads as raw compact INTEGER records. Fresh source-ID-
checked SQLite 3.53.4 returned TEXT `real` plus REAL 20.0 for
`typeof(amount),amount`, and REAL 10.0 for each of `sum`, `total`, and `avg` on one
row. Before this revision the public Fetch path returned TEXT `integer`, direct
REAL 20, INTEGER/BigInt `sum`, and REAL `total`/`avg`; `amount+0` was also
INTEGER/BigInt. Pinned `expr.c:sqlite3ExprCodeTarget` emits `OP_RealAffinity` after
`OP_Column` in direct, aggregate direct/sorter, and general resolved-column
branches; `vdbe.c` keeps raw `OP_Column` record storage distinct and realifies only
`MEM_Int|MEM_IntReal`. The shared expression column-read lowering now emits the
operation before every downstream consumer. Public three-encoding tests cover
`typeof`, parameter-independent column arithmetic, supported single-row
`sum`/`total`/`avg`, stable API `columnType`, reset/lifecycle, and existing REAL,
NULL, int64 and neighboring NUMERIC/INTEGER cases. Raw record decoding and
aggregate result-type patching remain deliberately unchanged. The generalized repair
is commit `ad433c2a4ae92bf679ff6303e3ea421ce73f0234`; unsupported consumers remain
explicitly unsupported rather than being counted as verified.

## Revision evidence — value-list IN lead (2026-09-19, [[card:card-i-a]])

A 21-case, three-encoding pinned-oracle/public-TS lane reproduces the external lead
as a **missing value-list IN boundary**, not a demonstrated OR defect. On the exact
`orders(id INTEGER PRIMARY KEY,user_id INTEGER,amount REAL,note TEXT COLLATE
NOCASE)` schema, native returns 10/11 for `id IN(10,11)` and 10/11/13 when OR'ed
with `id=13`; current TS rejects both at prepare as temporarily unsupported.
Independent `a=1 OR b=2` and `id=10 OR id=11` match native across encodings and
reset, disproving the broad OR hypothesis for those paths only. Value-list
empty/NULL/duplicate/mixed-affinity/CollSeq/parameter/expression cases and REAL
consumer regressions remain zero-credit implementation targets. Pinned owners are
`src/expr.c` `sqlite3FindInIndex`/`sqlite3ExprCodeIN` and `src/vdbe.c` branch and
Found/NotFound operations. Preserve `f48a4c2` subquery-IN/nested-cursor foundations;
this evidence does not propose replacement. Exact provenance, outcomes,
dependencies, and limits are in `docs/research/card-i-a-in-list-audit.md` and
`test/conformance/cases/audit-in-list.json`.

### Revision 2026-09-20 — value-list `IN` and shared cursor/aggregate ownership

Current-tree review supersedes the earlier absence of a value-list execution claim.
Generated `parse.y` reductions now produce an `in-list` expression and shared VDBE
lowering models the ordered `expr.c:sqlite3ExprCodeIN` `IN_INDEX_NOOP` path with
comparison affinity/collation, NULL propagation and lazy later RHS terms after a
match. Inspection and package-boundary tests find no ad-hoc parser/evaluator,
JavaScript `Set`/`includes` membership, native/WASM runtime, dynamic code generation,
or host registration. The canonical public audit matches 63/63 observations over
three fixture encodings but remains zero-credit and does not cover subquery or
index-backed branches.

The audit exposed two shared-owner defects now repaired: decoded records retain the
rowid needed after scan exhaustion, and ordinary non-min/max aggregate projection
saves bare columns from the first qualifying input row instead of rereading a dead
cursor or selecting the last row. The runner now checks ordered names, reset rows,
expected step errors, first-error object identity and finalize failures. Literal
`0 AND`/nonzero `OR` retains source-shaped short-circuit lowering, while the audit's
nonliteral projection forms remain eager as observed from the pinned oracle.

## Revision 2026-09-20 — date/time finding update ([[card:card-q-a-b]])

The earlier date/time absence prediction is no longer current workspace fact.
Current implementation registers and executes the ten date/time forms through the
shared Function/PureFunc path, with bigint iJD calendar logic and statement-owned
clock caching. Public tests currently pass 87 stored typed native observations in
three encodings and dedicated deterministic seam, lifecycle, work, and output-limit
checks. This revision does not claim exhaustive `date.c` equivalence. The manifest's
18 selected upstream assertions now carry 18/18 TypeScript credit after exact public
execution in all three encodings; companion, boundary, and seam vectors remain
zero-credit evidence.

## Revision 2026-09-20 — independent date/time follow-up

Review v3 for [[card:card-q-a]] found residual pinned branches despite 18/18 selected
credit. The implementation now covers BLOB-to-text initial arguments, initial
`subsec`/`subsecond`, `toLocaltime` equivalent-year mapping and normalized provider
failures, and signed `%Y/%F/%G/%g`; public tests add three-encoding and deterministic
seam/cancellation evidence. The denominator remains exactly 18 selected assertions.

## Revision 2026-09-20 — local provider civil validation

Host localtime provider fields now require a valid month-specific civil day,
including leap-year validity, before conversion. This boundary validation is
separate from and does not tighten SQLite's permissive SQL input-date normalization.
Deterministic seams cover invalid non-leap February 29, April 31, and valid leap day.

## Revision 2026-09-20 — enabled math delivery

The tests-first math finding is superseded: all 30 enabled registration rows (29
names) now resolve and execute through shared VDBE Function dispatch. The owning
wrapper translation is `src/internal/math.ts`, mapped to `func.c:ceilingFunc`,
`logFunc`, `math1Func`, `math2Func`, and `piFunc`; it retains Mem numeric/storage
semantics and NaN-to-NULL. ECMAScript `Math` is the browser-safe libm adaptation.
The immutable public corpus passes 21/21 cases and 63/63 observations across
UTF-8, UTF-16LE and UTF-16BE. The added `log(B,X)` discriminator preserves the
pinned asymmetry between numeric-type conversion of `B` and value-double
numeric-prefix/BLOB conversion of `X`. Cross-host finite transcendental last-bit identity
remains a portability limit, not an advertised guarantee.

### Revision 2026-09-20 — ordinary math endpoint evidence ([[card:card-q-b-b]])

Current-tree review corrects the earlier ordinary-math evidence denominator. The
immutable public corpus now has 22 selected cases and 66 typed observations over
UTF-8, UTF-16LE, and UTF-16BE for the unchanged 30 registration rows / 29 names.
The added `signed-int64-extrema` case independently captures both signed 64-bit
endpoints through every INTEGER-preserving rounding alias and representative
REAL-producing unary/binary wrappers (`sqrt`, `sin`, `pow`, and `mod`). Its
validator requires exact INTEGER payloads, REAL/NULL storage classes, and pinned
IEEE-754 payloads in all three encodings, exposing the intentional
INTEGER-to-double precision loss rather than inferring it from smaller values.
The public TypeScript runner matches 66/66 observations. This revision strengthens
the claimed evidence; it does not widen the implementation scope or erase the
documented ECMAScript-Math/C-libm last-bit portability limit for finite
transcendentals.

## Revision 2026-09-21 — date/time 24:00 cache-state correction

The prior date/time revisions did not cover the pinned distinction between
simultaneously valid JD, YMD, and HMS state. The translation no longer uses a lone
hour-24 marker: timezone-free full-date input retains independent parsed YMD/HMS,
time-only input uses normalized iJD, and modifier/timezone branches clear caches
where pinned `computeJD`, `clearYMD_HMS_TZ`, `parseModifier`, and `isDate` do.
The declared bounded denominator is now 29/29: the existing 18 body-hashed upstream
assertions plus 11 exact `src/date.c` source-control assertions. Together with two
result-class and nine range companions this is 40 cases, independently captured as
120 typed native observations and compared through public Fetch execution in all
three encodings. This remains bounded evidence, not exhaustive `date.c` equivalence.

### Revision 2026-09-21 — JSON foundation

The earlier absence finding is superseded only for the bounded `json`, `jsonb`,
`json_valid`, `json_extract`, JSON aggregate, and runtime expression/root/WHERE/
JSONB table-function tranche. Source-derived representation, JSON5 canonicalization, JSONB bytes/validation,
subtype handoff and resource/lifecycle tests are now present. The recursive
producer translates depth-first traversal and JSONB-offset id/parent shaping, with
pinned scalar-root `json_tree.fullkey`, parameter/reset, hidden-input,
JSONB-container, ORDER/LIMIT/OFFSET, and JSON-to-JSON/physical-left correlation and grouped aggregate/HAVING public evidence. RIGHT/FULL mixed joins, reverse correlation, and advanced aggregate modifiers,
and the full virtual-table/path corpus remain gaps; this revision does not award
them credit.

### Revision 2026-09-21 — JSON scalar finding

The earlier JSON scalar absence is partially closed by [[card:card-r-b]]: the
normal parser/compiler/VDBE/public column path now owns inspection, constructors,
copy-on-write mutation, merge patch and arrows on the private ordered representation.
The audit must still treat exhaustive error-position offsets and full malformed
path/JSONB corpus parity as open evidence gaps, not inferred compatibility.

### Revision 2026-09-21 — JSON aggregate finding superseded ([[card:card-r-c]])

The baseline absence finding for JSON aggregates is no longer current. All four
3.53.4 registrations are implemented internally (not delegated to native/host
JSON), including text/JSONB output, subtype-sensitive arguments, duplicate/order
preservation, empty groups, grouped execution, represented inverse windows, byte
limits, and shared aggregate cleanup. Credit is supported by
`test/conformance/json-aggregate-paths.test.mjs` and the source map above. This
revision does not claim unsupported window shapes or unrelated JSON virtual-table
features.

### Revision 2026-09-21 — JSON table cursor fidelity correction ([[card:card-r-d]])

Current-tree review supersedes the JSON foundation revision's implication that
canonical offset shaping was sufficient for all JSONB inputs. The four internal
read-only table functions now retain original JSONB element bounds and object-label
offsets, so nonminimal headers preserve native `id`/`parent` values and binary
container `value` bytes. Rewind validates and retains one ordered parse image, but
row traversal is incremental: next constructs only the current row, allowing an
unsorted LIMIT to stop before unconsumed descendants. Input, parsed-node estimate,
current path, and traversal depth reserve against statement private state; cursor
cleanup occurs on exhaustion, replacement rewind, reset, finalize, and error.
Focused public evidence covers nested/rooted nonminimal JSONB, `jsonb_each` and
`jsonb_tree`, truncated input, LIMIT early stop, and saved private-limit error
cleanup. This does not claim generalized virtual-table planning, event-loop yield
inside one synchronous parse, or the unsupported compositions listed in the
living guide.

### Revision 2026-09-21 — scalar review corrections

Finding 1's placeholder error position and finding 4's missing JSONB/edit
registrations are corrected by [[card:card-r-b]]. Production `json_pretty` is
explicitly registered temporary unsupported at both pinned arities. Focused public
coverage now discriminates non-leading positions, duplicate/root/sequential edit,
array insertion, and JSONB BLOB result branches; exhaustive corpus parity remains
a test-evidence limitation rather than an implementation claim.

### Revision 2026-09-21 — mutation branch correction

Review v6 findings 1–4 are corrected in the shared mutation owner: NULL pair skip,
root-removal SQL NULL/stop, and mutation/removal `[#-N]` branches now follow the
pinned routines for TEXT and JSONB. Public tests distinguish storage metadata and
exact JSONB bytes. Remaining corpus breadth is not claimed as exhaustive parity.

### Revision 2026-09-21 — BLOB document compatibility

The review-v9 shared-foundation finding is corrected: `jsonArgIsJsonb` now
classifies recognized JSONB and non-JSONB document BLOBs follow
`jsonParseFuncArg` tag-20240123-a text parsing. Public tests keep ordinary BLOB
constructor/aggregate values rejected.
