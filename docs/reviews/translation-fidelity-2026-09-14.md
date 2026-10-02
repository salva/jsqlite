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

**Revision 2026-09-23 ([[card:card-s-c-b-a]] retained-path movement repair): corrected for index movement as well as seek.**

`IndexCursor` now retains current page/cell and ancestor child positions. Its
first/last and next/previous operations translate the applicable
`btreeNext`/`btreePrevious` branches by descending one boundary, moving on-page,
descending from an interior entry, or ascending that retained path. The obsolete
whole-index `readIndex()` traversal has been removed. A source-derived mutation
seeks near the right edge with an unrelated malformed leftmost subtree and proves
that adjacent movement returns the next key without fault-touching the malformed
page. Complete bidirectional ordering, selected-path corruption, depth limits,
owner/borrow behavior, and focused WITHOUT ROWID public execution remain green.

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

### Revision 2026-09-22 — JSON table result metadata correction ([[card:card-r-d]])

The earlier table-function tranche left qualified direct projections named from
their SQL span (for example `je.value`) instead of the resolved virtual column
(`value`). The JSON-specific lowering routes now retain bound result trees through
metadata production and apply pinned `select.c:sqlite3GenerateColumnNames` rules:
alias first, otherwise the underlying direct-column name and source fields;
computed expressions keep exact source spans and null origins. Public UTF-8,
UTF-16LE and UTF-16BE tests cover all eight visible fields plus hidden `json`/`root`
declared-type distinctions across each/tree and text/JSONB variants, duplicate names,
COLLATE, aliases, comments/spacing, wildcard and correlated sources, mixed physical
source metadata, plus lifecycle.
This is a metadata correction only and does not widen the documented composition
surface or expose module registration.

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

### Window outer LIMIT/OFFSET and derived-scope integration (revision 2026-09-21, [[card:card-o-b-c]])

Lead 6/7 reproduction used the public Fetch API and the exact 1,007,616-byte Chinook capture (SHA-256 `7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`) against pinned SQLite 3.53.4, source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`. At base commit `8a0bb5d68c775094b46eeaae62a868edf77ea12b`, legal outer `WHERE rk<=?1 ORDER BY rk DESC LIMIT ?2` failed at prepare with `no such table: (subquery)` while the pinned oracle returned `The Young Lords` rank 3 then `Occupation / Precipice` rank 2 for binds `(3,2)`. The integrated repair commit is recorded below after verification.

The specialized non-flattenable window-derived compiler now retains parent predicate, typed ORDER sorter, and LIMIT/OFFSET destination ownership in one VDBE program (repair commit `4a93878a3f675d58aa33891271752901199f9868`). It uses `computeLimitRegisters`, `IfPos`, and `DecrJumpZero`; it does not slice host rows or add a host evaluator. Independent broad verification found an initial admission regression for an ordinary non-window derived query, so the route is explicitly gated by `selectHasWindow(derived.select)`. The existing negative subquery test proves that unsupported ordinary shape still rejects atomically.

Exact phase/diagnostic comparison through public APIs confirms both same-SELECT forms fail during prepare, before Statement publication, with pinned text `misuse of aliased window function rk`: one in `WHERE rk<=?1`, one in `GROUP BY Name HAVING rk<=?1`. The legal outer derived `rk` predicate prepares and steps. Permanent digest-bound tests cover that distinction, parent filter + ORDER + LIMIT, reset/rebind and cleanup. UTF-8, UTF-16LE, and UTF-16BE fixture tests now each combine legal outer filter + ORDER + negative LIMIT + OFFSET and rebind to LIMIT 0; separate permanent tests retain positive LIMIT/OFFSET and the 3,503-row negative-LIMIT tail.

Commands: source-ID-checked ctypes SQLite public-C comparison and TypeScript public-Fetch probes; `npm run typecheck`; `node --experimental-strip-types --test test/schema/catalog-init.test.mjs`; `npm run test:parser`; `npm run test:conformance:aggregate:ts`; `npm run test:conformance:subquery-view:ts`; `npm run test:conformance:window`; `npm run test:conformance:window:native`; `npm run test:package-boundary`; `git diff --check`. CTE execution also has unrelated pre-existing `complex compound table arms are not implemented` failures and is not claimed passing. This does not claim complete frame execution, exhaustive window compositions, or extra conformance credit.

### Window outer LIMIT/OFFSET handoff (revision 2026-09-21, [[card:card-o-b-g]])

The executable window path previously allocated SQLite-style LIMIT/OFFSET registers but applied them only while draining an outer ORDER sorter. Without outer ORDER BY, `ResultRow` bypassed both offset consumption and `DecrJumpZero`, so `LIMIT 5` emitted all 3,503 Chinook tracks. The VDBE output handoff now applies `IfPos` before `ResultRow`, `DecrJumpZero` after it, and patches LIMIT-zero/exhaustion directly to the coroutine drain, matching select.c's destination-loop ownership rather than slicing host results. The digest-bound 1,007,616-byte Chinook capture (`sha256 7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`) matches pinned SQLite 3.53.4 first rows: Through a Looking Glass rank 1 through Dave rank 5. Permanent public tests cover parameter reset/rebind, LIMIT 0, negative LIMIT, OFFSET, cleanup, and all three encodings. Outer ORDER remains on its existing sorter drain; legal derived rank filtering remains in the ordinary derived-source owner, while same-scope alias legality remains resolver-owned.

### Current lead 6/7 fidelity evidence (revision 2026-09-21, verification HEAD `a8f1583cce6288573725fab4c23375180c11f559`, [[card:card-o-b-h]])

This revision consolidates the two preceding findings without changing their
accepted implementation. The floating public Chinook URL was used only to acquire
the already-bound fixture: all public-Fetch acceptance used the identical
1,007,616 bytes and SHA-256
`7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`.
The independent native command loaded the manifest-pinned SQLite 3.53.4 library,
printed `sqlite3_libversion()` and exact `sqlite3_sourceid()`
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`,
and then ran the same bound queries through SQLite's public C API. Its retained
capture is `work:///cards/card-o-b-g/processes/proc-c1632ba5c7e9/stdout.log`.

Before repair, the no-outer-ORDER query `... row_number() ... LIMIT 5` returned
all **3,503** Track rows in TypeScript versus native's **5**. The source-shaped
outer destination handoff in implementation/test commit
`8a0bb5d68c775094b46eeaae62a868edf77ea12b` now yields native's first row
`Through a Looking Glass`, rank 1, and rows through `Dave`, rank 5. `LIMIT 0`,
negative LIMIT, OFFSET, parameter reset/rebind, finalize/cleanup, and physical
UTF-8, UTF-16LE, and UTF-16BE fixtures cover the neighboring branches. The direct
handoff is `IfPos` before `ResultRow` and `DecrJumpZero` after it, with zero and
exhaustion patched to coroutine drain; the existing ordered path keeps its sorter
destination. This follows the pinned `select.c` destination-loop ownership and is
not host row slicing.

The second defect had treated outer `rk` as though it were an illegal same-SELECT
alias. The correction preserves linked `NameContext` scope and derived output
column identity: same-SELECT `WHERE rk<=?1` and `GROUP BY Name HAVING rk<=?1`
still fail at prepare, before Statement publication, with exact native diagnostic
`misuse of aliased window function rk`, while the parent SELECT may legally filter,
order, and limit the derived `rk`. At the initial `8a0bb5d` checkpoint that legal
outer ORDER/LIMIT form still failed with `no such table: (subquery)`; commit
`4a93878a3f675d58aa33891271752901199f9868` corrected parent predicate, sorter,
and LIMIT/OFFSET destination ownership. The specialized route is gated by
`selectHasWindow(derived.select)`, so the adjacent unsupported ordinary-derived
shape remains an atomic rejection rather than accidental runtime expansion.

Recorded verification commands were the source-ID-checked native ctypes/public-C
probe and public-Fetch probe; `npm run typecheck`; the catalog/resolver gate
(19/19); `npm run test:conformance:subquery-view:ts` (192/192);
`npm run test:conformance:window`; `npm run test:conformance:window:native` with
pinned-library byte comparison; `npm run test:package-boundary`; and
`git diff --check`. The focused direct/derived gate also passed 4/4 and the
parser/window compiler/execution gate 59/59. The accepted implementation verification HEAD is the revision named above. The
unrelated CTE failures previously reported as `complex compound table arms are not
implemented` were not part of these passing commands and are not claimed fixed.

Accounting is truthfully unchanged: the immutable lead manifest has **29 declared,
0 TypeScript attempted, 0 credited, and 29 unattempted**. These permanent public
and source-based regressions verify the repaired integration branches but do not
promote those entries or claim arbitrary derived queries, exhaustive window
composition/frame equivalence, or full SQLite compatibility. The documented CTE
composition gaps and Finding 5's CHECK/FK read-schema result (without write
enforcement) also remain unchanged.

### Window accounting and admission reconciliation (revision 2026-09-22, [[card:card-o-b-h]])

Accepted review `record:///review.md?card=card-o-b&v=15` found that the preceding
lead 6/7 revision incorrectly presented one historical denominator as overall
current window accounting. The implementation facts, Chinook identity, native
capture, defects, repairs, commits, diagnostics, and focused coverage recorded
there remain current; only its final global-accounting implication is superseded.
The three non-interchangeable denominators are:

1. **Historical architecture manifest:** immutable `stage3-window` has 29
   parser/resolver/rewrite/allocation declarations and remains **0/29 TypeScript
   attempted by design**. It is architecture provenance, not current frame-runtime
   accounting.
2. **Aggregate-window execution:** the 44-declaration contract has 43 executable
   cases and one source-only private-controls declaration. Current public result is
   **43/43 executable**, including **25/25 source-credit**, plus the separate
   no-credit private-controls validator **1/1**.
3. **Special built-ins:** the 43-declaration contract has 41 executable cases and
   two source-only safety/atomic-rejection companions. Current result is **41/41
   executable plus 2/2 source-only**. The TS runner's reported **42/42 tests** is
   41 public declaration tests plus one accounting test over all 43 declarations;
   it is not a 42-case executable denominator.

Current prepare may publish only the represented aggregate-window and eleven
special-built-in shapes mapped in the living guide/source map. Their represented
join, grouping, subquery, CTE/recursive, compound, outer filter/ORDER and
LIMIT/OFFSET compositions execute through the VDBE frame/callback and result
handoff. Residual unrepresented frame, expression, and composition shapes reject
atomically during prepare; the source-only gates verify rejection and connection
reuse. This bounded surface is not exhaustive SQLite window compatibility.
Historical “CodeStep absent/all windows reject” passages are retained only as
explicitly superseded checkpoints.

The lead 6/7 evidence remains exact: digest-bound Chinook is 1,007,616 bytes with
SHA-256 `7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`;
pinned SQLite is 3.53.4/source ID
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`;
and the retained native public-C capture is
`work:///cards/card-o-b-g/processes/proc-c1632ba5c7e9/stdout.log`. Before
`8a0bb5d68c775094b46eeaae62a868edf77ea12b`, outer `LIMIT 5` incorrectly emitted
3,503 rows; native and repaired TS start with `Through a Looking Glass`, rank 1.
Commit `4a93878a3f675d58aa33891271752901199f9868` repaired derived `rk` parent scope,
ORDER and destination ownership while retaining exact same-SELECT WHERE/HAVING
`misuse of aliased window function rk` prepare diagnostics. Commit
`a8f1583cce6288573725fab4c23375180c11f559` integrated the evidence. Coverage
retains all encodings, LIMIT 0/negative/OFFSET, outer filter/ORDER, parameters,
reset/rebind/finalize, the specialized `selectHasWindow` gate, and the ordinary-
derived negative discriminator. Finding 5's CHECK/FK read-schema-only result and
the documented unrelated CTE `complex compound table arms are not implemented`
gaps remain unchanged.

Reconciliation verification used an identity-checked pinned library and fixture,
then ran `npm run typecheck`; `npm run test:parser`; historical window manifest and
native recapture; aggregate-window manifest plus public/private/rewrite/publication
suite (**96/96**, executable contract **43/43**, source-only **1/1**); special
manifest/native recapture/public runner (**42/42**, meaning 41 declarations plus
one accounting test) and source-only suite (**2/2**); aggregate regressions
(**5/5**, including the 34/34 public matrix); subquery/view regressions
(**192/192**, including the ordinary-derived negative discriminator); CTE
architecture; package boundary; docs check; and `git diff --check`. The focused
Chinook catalog/lead suite passed **13/13** against the exact fixture, including
same-scope diagnostics, outer filtering/ORDER, LIMIT 0/negative/OFFSET,
reset/rebind/finalize, and all-encoding companions. The applicable CTE execution
run was **36/39** at that checkpoint: only the same three
UTF-8/UTF-16LE/UTF-16BE ordinary-CTE
composition cases failed with the already documented `complex compound table arms
are not implemented`; they are reported as an unchanged boundary, not a passing
CTE gate. Full integrated output is
`work:///cards/card-o-b-h/processes/proc-2c2216ab6a7f/stdout.log`; focused Chinook
output is `work:///cards/card-o-b-h/processes/proc-64a095df49ba/stdout.log`.

### Durable lead 7 oracle gate (revision 2026-09-22, [[card:card-o-b-a]])

The lead 7 evidence is now project-owned rather than dependent on a work-root-only
probe. `test/conformance/window-derived-scope-native.py` checks the loaded public-C
library against `reference/sqlite/manifest.json`, checks the fetched Chinook bytes
against `test/fixtures/public/chinook.json`, and captures both prepare failures and
the legal outer result. Pinned 3.53.4 reports `misuse of aliased window function
rk` during prepare, with no statement published, for same-SELECT WHERE and HAVING;
the parent derived query prepares and returns ranks 5 through 1 under outer ORDER.
The existing public Fetch test now spells the exact requested `WHERE rk<=5` query;
neighboring permanent cases retain parameter reset/rebind, outer ORDER/LIMIT,
finalization, and UTF-8/UTF-16LE/UTF-16BE coverage without adding another fixture
acquisition or duplicating the CHECK/FK fixture owner. The implementation remains
commits `8a0bb5d` and `4a93878`; this revision adds a durable independent oracle
gate and sharpens the exact-query regression only. Finding 5 is unchanged.

### Operator lead 6/7 committed-evidence update (revision 2026-09-22, verification HEAD `b33c59fd2ed640bb0d6d594aebe35d906746b322`, [[card:card-o-b-h]])

This revision records the operator commits now present in the project and
supersedes only the earlier work-root-only description of the lead gates. The
public acquisition contract is `test/fixtures/public/chinook.json`: URL
`https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_Sqlite.sqlite`, exactly **1,007,616 bytes**, SHA-256
`7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`.
The URL is provenance and may float; byte count plus full digest are acceptance.
`node tools/fetch-chinook.mjs "$SAIVAGE_CARD_WORK_ROOT/chinook-fixture/Chinook_Sqlite.sqlite"`
performs Fetch and refuses an identity mismatch.

The oracle remains manifest-pinned SQLite **3.53.4**, source ID
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
The durable native lead-7 command is:

```sh
python3 test/conformance/window-derived-scope-native.py \
  --library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" \
  --database "$SAIVAGE_CARD_WORK_ROOT/chinook-fixture/Chinook_Sqlite.sqlite"
```

It verifies library/source ID and fixture identity before using SQLite's public C
API. The earlier lead-6 public-C capture command's retained output is
`work:///cards/card-o-b-g/processes/proc-c1632ba5c7e9/stdout.log`: version/source
ID, `Through a Looking Glass|1` through `Dave|5`, LIMIT-0 count 0, and OFFSET
neighbors ranks 2 and 3. Before repair the same no-outer-ORDER public query emitted
**3,503** TS rows versus native **5**; the correct first row is **Through a Looking
Glass**, rank **1**.

The runtime ownership repair began in
`8a0bb5d68c775094b46eeaae62a868edf77ea12b` and is now durably hardened by
`b6d98313c7c41f4f7cc49d48379e0fa1f6fe5e83`: one `emitOuterResult` lowering
owns both direct and sorter drains, emits `IfPos` before `ResultRow` and
`DecrJumpZero` after it, and routes LIMIT zero/exhaustion to the appropriate drain.
This is the pinned `select.c` destination handoff, not host slicing. The same
commit added the project-owned fixture contract/fetcher and sharpened the public
predicate-bearing lead case (`WHERE Bytes IS NOT NULL`). Permanent lead-6 cases
are `test/schema/catalog-init.test.mjs` tests **window outer LIMIT/OFFSET executes
in the VDBE output handoff** and **window LIMIT/OFFSET handoff is
encoding-independent**. Together they cover positive LIMIT/OFFSET, LIMIT 0,
negative LIMIT (including the 3,503-row tail), parameters, reset/rebind,
finalize/connection cleanup, and physical UTF-8/UTF-16LE/UTF-16BE fixtures.

The scope repair in `4a93878a3f675d58aa33891271752901199f9868`
preserves linked `NameContext` and derived output-column identity while compiling
parent predicate, typed ORDER sorter, and LIMIT/OFFSET in one VDBE program. It
corrects the prior false same-scope treatment and the intermediate `no such table:
(subquery)` failure. The specialized admission remains gated by
`selectHasWindow(derived.select)`; the neighboring ordinary-derived shape still
rejects atomically. Commit
`b33c59fd2ed640bb0d6d594aebe35d906746b322` made the exact public
`WHERE rk<=5` case and independent public-C oracle durable. Same-SELECT
`WHERE rk<=?1` and `GROUP BY Name HAVING rk<=?1` each still fail during prepare,
publish no statement, and retain the exact diagnostic
`misuse of aliased window function rk`; a parent SELECT may filter/order/limit
`rk`. Permanent lead-7 paths are
`test/conformance/window-derived-scope-native.py` and the
`test/schema/catalog-init.test.mjs` tests **exact derived window lead treats rk as
an outer source column**, **derived window filtering retains parent ORDER BY and
LIMIT ownership**, and **derived window output scope is encoding-independent**.
They retain outer filter/ORDER, parameter reset/rebind in neighboring coverage,
repeat-after-reset, finalize/cleanup, and all three encodings without duplicating
the fixture.

The implementation/test sequence is therefore
`8a0bb5d68c775094b46eeaae62a868edf77ea12b`,
`4a93878a3f675d58aa33891271752901199f9868`, integration evidence
`a8f1583cce6288573725fab4c23375180c11f559`, durable lead-6 gate/runtime hardening
`b6d98313c7c41f4f7cc49d48379e0fa1f6fe5e83`, and durable lead-7 oracle
`b33c59fd2ed640bb0d6d594aebe35d906746b322`. The current native-oracle plus public
13/13 rerun is retained at
`work:///cards/card-o-b-h/processes/proc-696d50e13ac1/stdout.log`; the full
post-reconciliation execution log remains
`work:///cards/card-o-b-h/processes/proc-2c2216ab6a7f/stdout.log`.

Accounting remains three separate denominators: historical architecture manifest
**0/29 TS by design**; aggregate windows **43/43 executable**, **25/25
source-credit**, plus source-only private-controls **1/1**; special built-ins
**41/41 executable plus 2/2 source-only** (the runner's 42/42 is 41 executable
case tests plus one denominator test). This evidence does not expand that bounded
surface. At that checkpoint the known CTE execution result was **36/39**, with only the three
encoding variants failing `complex compound table arms are not implemented`.
Finding 5 remains CHECK/FK **read-schema retention only**, without write
enforcement. Cross-checking `docs/TRANSLATION.md`, `docs/SQLITE_SOURCE_MAP.md`, and
`docs/api.md` found no contradictory current admission, ownership, or API claim;
no changes to those documents are required.

### Revision 2026-09-22 — approved window leads 6/7 at `09b1ae99da9a557377602324c35ef50d954bf257`

Current-HEAD revalidation confirms the two bounded repairs. Lead 6 keeps outer
LIMIT/OFFSET in the shared VDBE destination handoff: `IfPos` precedes
`ResultRow`, `DecrJumpZero` follows it, and zero/exhaustion returns to the
coroutine drain for direct and sorted output. There is no host-row slicing. Lead
7 keeps a derived window alias such as `rk` in the producer's output scope, so a
parent SELECT may filter, order, and limit it; the same alias in its defining
SELECT's WHERE or HAVING remains an atomic prepare-time failure with exact text
`misuse of aliased window function rk` and no published Statement.

Acceptance is bound to the 1,007,616-byte Chinook image with SHA-256
`7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`.
An independently built manifest-pinned SQLite 3.53.4 library reported source ID
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
Native public-C and public Fetch checks agree on no-outer-ORDER `LIMIT 5`: first
row `Through a Looking Glass`, rank 1, exactly five rows ending with `Dave`, rank
5. Focused public evidence also covers LIMIT 0, negative LIMIT, OFFSET, outer
filter/order, parameters, reset/rebind, cleanup, legal derived `rk`, and physical
UTF-8/UTF-16LE/UTF-16BE fixtures. The native scope oracle preserves both exact
same-SELECT diagnostics and the legal derived result.

This revision records evidence for only those approved leads. The unrelated CTE
result was 36/39 at that checkpoint, with the three encoding variants still rejected as
`complex compound table arms are not implemented`; no broader Stage 3, arbitrary
CTE, exhaustive window, or root-completion claim follows. Finding 5 is unchanged:
CHECK/FK support is **read-schema retention only**, without write enforcement.

### Revision 2026-09-22 — B2 zero-source derived aggregate audit

The digest-bound public Fetch reproduction on the 1,007,616-byte Chinook image
(SHA-256 `7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`)
prepared `SELECT count(*) FROM (SELECT 1 AS x)`. Before this repair, prepare
failed with `no such table: (subquery)`. A freshly built oracle asserted the
manifest SQLite 3.53.4 source ID and returned one `count(*)` column with INTEGER
row `1`.

Root cause was the aggregate compiler's bounded flatten route requiring one
producer FROM term. Pinned `select.c:flattenSubquery` restriction (7) explicitly
forbids flattening a zero-source producer; `sqlite3Select` therefore retains the
derived destination/control handoff (tags `select-0482`/`select-0488`) before the
parent `SRT_Accumulator`. `compileZeroSourceDerivedCount` now performs that
narrow destination composition in one VDBE program: each producer `ResultRow`
feeds parent `AggStep`, producer termination transfers to `AggFinal`, and no host
rows or recursive Statement are introduced. Shapes needing producer-column
registers remain at their existing atomic gate.

Permanent public-Fetch coverage is the B2 test in
`test/conformance/expression-subquery-chinook.test.mjs`; it checks exact row,
metadata, reset, finalize, and restored admission. This revision is delivered with
the integrated A1/B2/B4 expression-subquery change.

### Revision 2026-09-22 — A1 aggregate scalar destination composition

Exact public Fetch reproduction on the digest-bound Chinook image prepared
`SELECT (SELECT count(*) FROM Genre),(SELECT count(*) FROM MediaType)`. Before
correction the aggregate child reached ordinary scalar lowering and failed with
`internal execution-only expression reached scalar lowering`; incomplete operand
relocation also allowed child register/cursor destinations to alias. The fresh
manifest-built SQLite 3.53.4 oracle returns INTEGER row `[25,5]`.

Root cause was `compileScalarSelect` always selecting the table compiler and then
splicing a child Program without relocating every operand used by admitted
aggregate plans. Pinned `expr.c:sqlite3CodeSubselect` emits `SRT_Mem` into the same
Parse/VDBE with disjoint `nMem`/`nTab` ownership. `src/internal/vdbe.ts` now chooses
the aggregate compiler, relocates the audited register, aggregate-accumulator,
index-key and table-cursor operands, and replaces only the child row destination.
`expression-subquery-chinook.test.mjs` and
`expression-subquery-composition.test.mjs` prove two/three independent children,
correlated children, metadata, reset, destination isolation and all encodings.

### Revision 2026-09-22 — B4 aggregate consumer with joined correlated EXISTS

Exact public Fetch reproduction prepared `SELECT count(*) FROM Track t WHERE
EXISTS(SELECT 1 FROM InvoiceLine il JOIN Invoice i ON
i.InvoiceId=il.InvoiceId WHERE il.TrackId=t.TrackId)`. The initial aggregate gate
rejected it; the first direct nested-loop translation then exceeded the default
shared work limit. The fresh manifest-built SQLite 3.53.4 oracle returns INTEGER
`1984` on the identical SHA-256
`7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15` image.

Pinned `expr.c:sqlite3CodeSubselect` keeps correlated work in the parent VDBE and
suppresses `Once` for outer-dependent evaluation, while `where.c` probes the
inner equality join instead of enumerating its Cartesian product. The correction
materializes only outer-independent join/correlation keys under `Once` and places
the Track probe after its target for per-row rerun. The generic admitted path and
atomic typed gates are unchanged. Public Chinook plus three-encoding small-fixture
tests cover duplicates/empty outer matches, multiple outer rows, metadata, reset,
default and failing work budgets, first-error cleanup and restored admission.
A post-integration review found that initially admitting `IS` to the ephemeral
IN-style key probe lost NULL-safe equality. The optimized branch is now restricted
to `=`/`==`; `IS` uses the generic correlated loop. An exact all-encoding public
regression verifies that an outer NULL matches the joined inner NULL, as pinned
SQLite does.

### Revision 2026-09-22 — B3 ordinary CTE grouped-producer lead

External B3 lead on the Chinook digest
`7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`
reproduced a prepare-time `no such table: top` leak for a grouped, ordered,
limited CTE consumed by a join. Lexical lowering correctly retained one shared
`CteUse` and attached the producer as source 0; the mixed-derived compiler lacked
that producer/consumer shape and incorrectly continued into schema lookup of the
retained lexical name.

Production now has a bounded source-0/two-source route: the existing aggregate
compiler writes typed producer rows into a VDBE sorter, then the same program
opens the ordinary table, evaluates the represented join and result expressions,
and applies the supported outer ordering. Unhandled represented owners reject
atomically before schema expansion. Public Fetch regression covers exact
`Title`,`n` metadata and typed rows (`Greatest Hits`/57, `Minha Historia`/34,
`Unplugged`/30), connection reuse, and UTF-8/UTF-16LE/UTF-16BE. Those public
TypeScript results are execution credit. The independent Python oracle used
SQLite 3.45.1, so it is comparison evidence only and not pinned-native 3.53.4
credit.

### Revision 2026-09-22 — A2 CTE scope/composition and recursive aggregate admission ([[card:card-n-a2]])

Current implementation evidence supersedes the earlier implication that every grouped/aggregate recursive consumer is rejected. Ordinary WITH scope supports the represented statement-local nesting/shadowing, aliases, multiple/reused declarations, joins/subqueries/views, and bounded grouped producer composition. The recursive aggregate addition is narrower: `compileRecursiveAggregateSelect` admits exactly one outer **ungrouped** `sum(direct recursive-output column)` over one recursive CTE and feeds the iterative queue producer into VDBE `AggStep`/`AggFinal`. It does not evaluate recursion or aggregation in host JavaScript.

Evidence is deliberately partitioned. Implementation/public evidence is `test/conformance/recursive-cte-aggregate.test.mjs`: three public Fetch observations (UTF-8, UTF-16LE, UTF-16BE), each with prepare success, metadata `sum(x)`, one INTEGER 55, then DONE. The current integrated CTE/affected-compound lane passed 75/75, but that aggregate test count is regression evidence rather than upstream credit. Existing recursive native evidence remains 5 selected upstream assertions plus 2 no-credit companions across three encodings (21 native executions); A2 adds no pinned-native assertion and does not alter that denominator. The whole-project 48-suite/163-test result is likewise regression evidence, not public CTE or native credit.

Residual temporary gaps include outer GROUP BY/HAVING over recursive output, aggregate functions/modifiers/expressions beyond direct `sum(column)`, multiple or reused recursive aggregate owners, recursive joins/subqueries/views outside represented routes, expression projection in the multi-owner path, and broader compounds. These are untranslated source/destination compositions and must reject atomically; they are not product exclusions or evidence of approximate recursion.

### Final 2026-09-22 revision — same-denominator CTE execution reconciliation ([[card:card-n]])

This revision supersedes every current-looking statement above that the CTE
execution result “remains 36/39”. The denominator is unchanged: it is the same 39
public observations formerly run by `cte-admission.test.mjs` and
`cte-execution.test.mjs`, not a value inferred from a 10-test focused wrapper, the
mixed 63-test affected lane, or the earlier 75-test integration lane. The three
former failures were exactly these test IDs:

- `public utf8 composes ordinary CTEs with supported relational routes`;
- `public utf16le composes ordinary CTEs with supported relational routes`;
- `public utf16be composes ordinary CTEs with supported relational routes`.

In each encoding the first SQL shape in that test was
`WITH q(x) AS (SELECT a FROM t1) SELECT t2.x,q.x FROM t2 CROSS JOIN q ORDER BY 1,2`:
a relation-owned ordinary CTE table producer composed with a base-table cross join
and two-term output ordering. It failed during prepare as `complex compound table
arms are not implemented`, before the two later SQL shapes in the same observation
could execute. This identity is preserved by the retained historical log and the
source at its then-current line 65; it is not reconstructed from wrapper totals.

Commit `52740e0d72646955e52c3801849ca9462d26b28a` repaired the producer/consumer
integration (including the ordinary CTE first-arm composition route) and added its
focused B3/A2 coverage. Commit `61b1c96feaa18d66cbff3512d1461a84abe2b4d7`
then preserved ordinary-WITH lexical planning and route identity on the current
integration head. A fresh current-source rerun of the exact historical 39
observations passes **39/39**, with zero failures, skips, or cancellations. The
current expanded wrappers separately pass focused **10/10** and affected-lane
**63/63**; neither wrapper establishes or changes the 39 denominator.

Evidence classes remain separate. Recursive public execution contributes **12/12**
observations within the historical 39; the narrow A2 aggregate consumer contributes
**3** separate public encoding observations. The recursive oracle remains **5
upstream-credit assertions + 2 no-credit companions / 21 pinned-native encoding
executions**. The same-denominator 39 public observations, wrapper test totals,
internal opcode/lifecycle checks, A2 observations, companions, and pinned-native
executions are not added to or substituted for one another.

## Revision evidence — Chinook B1/B5 (2026-09-22, [[card:card-i-a]])

A source-ID-checked 22-case/56-execution lane reproduces B1 as an unimplemented
generated-BETWEEN admission/lowering boundary: pinned Chinook returns counts 115
and 297, while public TS rejects BETWEEN/NOT BETWEEN at prepare. Native assertions
`e_expr-13.1.2` and `.4` pin one lhs evaluation. B5 is narrower: public TS matches
the spaced expression name but incorrectly reuses it for the unspaced statement,
and replaces comment bytes with spaces instead of preserving exact expression
span. Alias, punctuation/Unicode, duplicate expression names, and qualified direct
columns pass selected neighbors. Direct `je.value` is therefore expected to be
`value`, not the source expression span; JSON table-function support is separate.
Do not infer a formatter defect or general naming failure. Preserve original UTF-8
SQL byte spans for unaliased computed names; preserve alias priority and direct
resolved-column naming. Exact evidence, limitations, and source mappings are in
`docs/research/card-i-a-chinook-b1-b5.md` and
`test/conformance/cases/audit-chinook-b1-b5.json`. All evidence remains zero credit.

### Revision 2026-09-22 — B1/B5 implemented and independently hardened

The prior B1 prepare-rejection and B5 source-span-loss findings are superseded.
Current generated reductions retain structured BETWEEN operands and exact original
UTF-8 expression slices. VDBE lowering follows `expr.c:exprCodeBetween` with one lhs
register, native lower/upper order, shared affinity/CollSeq, NULL/NOT semantics and
distinct projection/predicate control. Exact span naming preserves aliases and does
not regress resolved direct qualified columns. Inspection finds no token parser,
range evaluator, native/WASM/eval runtime or host registration.

The corrected public classifier counts exact expected step errors and lazy values,
requires error phase/code/message, first-error object identity, reset/finalize
behavior, and repeats every prepare. It now reports 56/56 semantic matches, zero
credit, across hash-pinned Chinook and three synthetic encodings. A TS structural
check proves one Function destination register feeds both comparisons; the separate
native-only development function probe remains oracle evidence only. SQL arrives as
a JavaScript string and is adapted to UTF-8 source bytes, so alternate SQL input
encodings remain unproved.

### 2026-09-22 W1/W2 WHERE foundation revision

The prior current-system finding that no shared WHERE representation or physical
index identity existed is now partly superseded. `where-plan.ts` implements the
immutable term/admission/loop/path foundation and `schema.ts` owns one physical
rowid-index/KeyInfo descriptor per admitted index. Focused identity and gate tests
pass. Runtime remains scan-only: persistent-index seek/deferred-seek lowering and
its counters are still absent, so the 69-attempt executable boundary remains zero
credit and this revision is not a public compatibility claim.

The W1/W2 revision is corrected to include production resolved-expression term
analysis, INTEGER PRIMARY KEY rowid candidates, strict forced/NOT INDEXED gates,
and translated bigint LogEst N-best/dominance solving. The initial
one-state-per-ready-mask implementation is superseded rather than justified as an
exception. Focused source-based tests verify these facts; runtime seek lowering
and the 69 public credits remain absent.

The accepted parent review's five W1/W2 findings are corrected: every generated
loop carries applicable LEFT source-order prerequisites; admitted solver widths
are pinned 1/5/12 with adversarial dominance/truncation evidence; all three
encodings are connected through production analysis/admission/candidate/path
identity tests; equality-fixed ORDER fields and explicit rowid-tail coverage are
represented; and participating WITHOUT ROWID statements reject atomically before
publication. RIGHT/FULL fallback and zero public execution credit remain
unchanged. The 18-choice star-query extension and W3 lowering remain outside this
admitted tranche.

Renewed review findings are corrected: LEFT-ON preserved-side equality/range
terms (rowid and explicit index) cannot drive; both-column comparisons publish
identity-linked virtual commuted children with independent prerequisites and
outer safety; and three-source LEFT followed by INNER/CROSS retains the nullable
RHS in later source barriers. Production analysis/candidate/path tests contrast
ON versus WHERE, both operand spellings, safe RHS admission, and nullable-side
references. These remain planner-contract facts with zero public execution
credit.

## Revision 2026-09-23 — W1/W2 selected-path execution evidence

The earlier audit statement that W1/W2 was planning-only is superseded for the
admitted rowid and persistent rowid-index tranche. Production now consumes the
selected immutable path/capability/admission/physical-index/KeyInfo identities
and executes equality, range, direction, covering, and deferred-table paths.
The three-encoding public matrix credits 69/69 row/error and private physical
work assertions. RIGHT/FULL fallback and unsupported atomic gates remain as
previously scoped. This does not claim general `wherePathSatisfiesOrder`,
WITHOUT ROWID, expression/partial indexes, writes, or runtime auto-indexes.

### Revision 2026-09-23 ([[card:card-s-c-b-b]] advanced-index acceptance scope)

The historical advanced-index statement below that public TS attempted/credited was 0/0 is preserved as its baseline snapshot, but is no longer current. Public row execution now passes all 30 captured case/encoding pairs. Conformance credit is intentionally narrower: 18 represented pairs covering WITHOUT ROWID primary exact/prefix, auxiliary-PK secondary covering, index-backed IN, and ordinary composite-range neighbors. Partial/expression selected access remains zero-credit sibling scope.

The repair also closes the projection-only covering hazard: residual WHERE and ORDER reads participate in capability coverage, and all-encoding ordinary/partial residual discriminators require table values when an index lacks the residual column. Represented non-covering WITHOUT ROWID secondary access performs the source-shaped complete-PK BLOBKEY lookup. Unsupported physical descriptors remain rejected/not selected rather than producing approximate rows.

### Revision 2026-09-23 ([[card:card-s-c-c-c]] partial deferred-seek review)

A still-earlier resolved-binding defect is now concrete: pinned SQLite seeks `e_expr` for single-source `e AS x` terms `lower(x.a)` and `x.b+1`, while TypeScript rejects at prepare with `no such column: x.a` in every encoding. The stack points to `compileTableSelect`'s late legacy `resolveExpression`, before `where-plan` comparison. Repair the owning single-source qualified-alias resolution path so exact `ColumnNode`/source identity reaches analysis; do not normalize away qualification inside expression matching.

Numeric literal identity has an all-encoding discriminator: pinned SQLite treats indexed `b+1` and query `b+01` as the same expression and seeks both fields. TypeScript seeks only `lower(a)`, then visits two candidates, reads the table, applies residuals, and sorts. Correct rows conceal that token spelling leaks into identity below the operator; compare resolved literal value/class as `sqlite3ExprCompare` does.

Query-side OR adds a branch-direction discriminator: pinned SQLite admits forced `p_live` for `a=1 AND (c>0 OR c<0)` because `exprImpliesNotNull` requires both query-expression arms to imply the partial predicate `c IS NOT NULL`; TypeScript rejects in every encoding. This is distinct from `sqlite3ExprImpliesExpr`'s index-predicate-side `pE2` OR branch, which accepts either predicate arm. The repair must preserve both pinned directions—flattening OR as if it were AND would be unsound.

A single-table all-encoding matrix isolates the missing pinned `exprImpliesNotNull` branch from join provenance and lowering. For partial `WHERE c IS NOT NULL`, SQLite admits forced `p_live` when the query has represented `c>0`, `c=1`, `c IN (1,2)`, or `c BETWEEN 0 AND 2`; TypeScript rejects all 12 executions as unusable. The implication repair must port the source operator switch/NULL-propagation logic, not only exact predicate identity.

Expression identity now has a concrete all-encoding COLLATE discriminator. Pinned SQLite seeks `e_expr` for `lower(a) COLLATE BINARY` but full-index-scans for `COLLATE NOCASE`: it skips the top-level COLLATE while comparing expression structure, then applies physical collation compatibility. TypeScript returns correct rows but full-scans both (`indexSeeks=0`), proving `expressionStructuralIdentity` does not implement the `sqlite3ExprCompareSkip` boundary before the separate collation gate.

The joined partial failure is independent of selected execution order: even when SQL source order begins with `p` and exactly matches its safe INNER-ON `p.c IS NOT NULL` proof, all encodings reject forced `p_live` during planning. Inspection localizes this to `usablePartialIndex`: it compares the schema predicate tree against the entire term expression identity and requires `term.left.source===source`. A split `IS NOT NULL` term does not carry the same whole-expression/source shape, so valid source-bound proof is discarded before path solving. Repair implication against resolved term/operator/operand identity and provenance (the pinned `whereUsablePartialIndex`/`sqlite3ExprImpliesExpr` ownership), not textual/source-order workarounds.

A joined-path corruption discriminator closes the observability gap: on all three review-derived fixtures with corrupt `e_expr` roots, a forced aligned-order expression self-join returns `(1,1)` successfully with `indexSeeks/indexNext = 0` and table scan counters, rather than raising a SQLite error. Thus the selected `PhysicalIndex` identity is not merely lowered incorrectly—it is completely bypassed on this multi-source route. This violates forced-access identity and selected/off-path corruption locality even in a query whose rows happen to be correct due to source-order alignment. The fix must ensure forced selected physical identity reaches the opened cursor and corruption/error ordering; a table scan is not an acceptable forced substitute.

A source-order reversal discriminator identifies an additional, earlier handoff divergence. With SQL source order `x JOIN y`, the planner selects constrained `y` before rowid lookup of `x`, but `compileInnerTableSelect` still emits loops by `expanded.sources` order. It therefore evaluates the selected `x.rowid=y.id` seek while `y` is unpositioned and returns empty. Rewriting the equivalent query as `y JOIN x` aligns textual and selected order and returns pinned `(2,2)` in every encoding. Consequently the shared repair must drive nesting from `multiWhere.path.loops` order (subject to join prerequisites/barriers), not merely find each selected loop while iterating source order. Physical-index lowering remains required for actual selected-index movement, but path-order fidelity is independently necessary and explains this empty-result signature.

An all-encoding unforced control confirms this is not confined to `INDEXED BY`: automatic selection of `m_abc` returns `[]`, while the otherwise identical `NOT INDEXED` query returns pinned `(2,2)` in every encoding. This establishes the required unforced fallback boundary: until joined physical-index lowering exists, planner selection must not suppress executable table scan/residual behavior. Forced handling must remain atomic/truthful according to the represented contract rather than silently producing empty rows.

Direct lowering inspection identifies the owning divergence: `compileInnerTableSelect` calls `planWhere`, but then opens only `source.table.rootPage` for every source and consumes only `rowidEquality`/`rowidUpper` from each selected capability before emitting `SeekRowid` or table `Rewind`/`Next`. It never opens the selected `PhysicalIndex`, lowers its equality/range admissions, or moves an index cursor. Thus a selected non-rowid capability can suppress/shape planner residuals without any corresponding executable index loop, explaining planned paths with zero execution counters and empty joined results. Pinned `sqlite3WhereCodeOneLoopStart` instead branches on the selected loop flags and emits the index cursor seek/scan before loop-body predicates. The repair belongs in shared multi-source loop lowering: either faithfully lower retained physical capabilities and identity, or conservatively prevent unsupported selection before residual ownership changes; do not special-case expression self-joins.

A broader ordinary-index control localizes the empty self-join result away from expression identity: forced covering `m_abc` self-joins also return `[]` instead of pinned `(2,2)` in all six selected-/other-alias neighbors. The shared signature—zero movement/residual/sorter counters despite planned paths—shows a pre-execution joined indexed-loop lowering/initialization defect. Expression exact-source identity remains independently unproven, but the observed empty rows must not be misattributed only to its structural comparator.

A second joined-source defect appears on expression indexes: pinned SQLite returns `(1,1)` for forced `e_expr` self-joins both when `lower(a)` is bound to the selected alias and when the same spelling is bound to the other alias (the latter truthfully full-scans the forced index). TypeScript returns no rows for all six all-encoding cases, including the exact selected-source match. This is a public row-correctness failure, not merely planner accounting, and means exact-source identity cannot yet be accepted even though the single-source frozen examples return correct rows.

A new public all-encoding join-provenance discriminator exposes a separate implementation-owned failure: pinned SQLite admits forced `p_live` when `p.c IS NOT NULL` is either in INNER JOIN WHERE or in the safe ON clause of INNER/LEFT JOIN, returning `(1,1)`, but TypeScript rejects all nine prepares as `forced index is unusable`. Two unsafe LEFT JOIN neighbors—WHERE proof after null extension and no proof—are correctly rejected. This branch matrix confirms TS currently loses all usable joined-table implication, rather than merely mishandling outer-ON marking; acceptance is not blocked solely by lazy deferred seek.

Structural mismatch remains distinct from unusable partial access: a new all-encoding/reset forced `e_expr` mismatch (`upper(a)` versus indexed `lower(a)`) passes through a truthful full expression-index scan with residual table reads and no index seek, rather than being atomically rejected or incorrectly admitted as an expression seek. This confirms the forced fallback branch currently works for the frozen represented descriptor but does not cure the unresolved structural-identity implementation gaps. New independently generated corrupt-`p_live` and corrupt-`e_expr` fixtures also prove selected partial- and expression-index root corruption fails through the public API while the corresponding `NOT INDEXED` table path remains readable before and after the failure in every encoding. This supplies the previously missing family-specific selected/off-path corruption evidence without extending manifest credit.

The partial/expression selected-access scope remains zero credit. Direct pinned comparison corrects the earlier shorthand that `partial-implied` is covering: `wherePartIdxExpr` does not substitute `c IS NOT NULL`; SQLite emits lazy `OP_DeferredSeek`, but the query never reads an uncovered table value, so no table movement occurs. TypeScript currently executes that opcode eagerly and records one spurious seek per run in every encoding. A new all-encoding forced companion projecting `c` establishes the other side of the boundary: exactly one table seek is required when an uncovered value is actually consumed. Additional empty-result and three-row index-scan companions establish opcode timing: an empty seek performs zero table seeks, while every positioned index row currently causes an eager TS seek (three instead of pinned zero) even when no table value is consumed. A three-row projection reading uncovered `c` twice per row passes with exactly three table seeks, establishing the complementary caching requirement: after first materialization, repeated uncovered reads of the same positioned row must reuse that table position rather than seek again. The owning repair must defer—not erase or duplicate—the lookup.


The prior revision's phrase “complete-PK suffix” was too narrow. Review `record:///review.md?card=card-s-c-b&v=3` demonstrated that SQLite deduplicates matching PK fields against declared secondary fields, so a PK may be mixed across declared/auxiliary positions or have no suffix. Physical descriptors now retain an immutable exact ordinal per PK term, matching column plus required PK collation, and lowering gathers mapped values in PK order. All-encoding public/native-fixture evidence covers mixed, reordered/interspersed, suffix-free, and different-collation duplicate shapes with composite DESC PK and NULL-sensitive secondary selection. Partial/expression credit remains unchanged at zero.

#### Unforced joined IN fallback source identity ([[card:card-s-c-c-c]], 2026-09-28)

The all-encoding unhinted joined-IN fallback test exposed `invalid source ordinal` at prepare (focused 0/1, advanced 46/47): the first replan implementation cloned a `ResolvedSource` to set `notIndexed`, while `where-plan.ts:binding/prereq` and `btreeLoops` rely on exact resolved source identity. Pinned `where.c` candidates retain cursor ownership when excluding loops, and `wherecode.c:codeEqualityTerm` requires per-IN-member selected seeks if admitted. `planWhere` now accepts `excludedIndexSources` as a planning-only ordinal gate, leaving original `ResolvedSource` and column-use ownership intact; forced `INDEXED BY` still rejects and unforced selection produces an actual scan. Review-derived UTF-8/16LE/16BE test compares unhinted and explicit `NOT INDEXED` rows, first-row/reset/NULL-rebind, zero selected index seeks and positive table movement. Focused 4/4, combined 118/118; manifest unchanged, no selected IN credit.

#### Joined reverse ORDER proof correction ([[card:card-s-c-c-c]], 2026-09-28)

A new forced reverse `ORDER BY y.b DESC` check initially required zero sorter inserts and failed (three inserts in all encodings despite correct rows). Branch inspection established the test's premise was wrong: `where-plan.ts:wherePathSolver` deliberately sets multi-source `orderTermsSatisfied=0`, and joined lowering honors this by retaining a sorter. Pinned `where.c` proves ORDER across the entire chosen WherePath, not just a selected inner root's local key order; `wherecode.c:sqlite3WhereCodeOneLoopStart` then emits directional access for a proved loop. Corrected the review-derived test to assert typed forced/scan rows fresh/reset, positive selected seek, and **retained** sorter for unproved joined global order. Focused 1/1, combined advanced/shared 98/98. Do not cite it as a reverse traversal or sorter-avoidance proof; no credit change.

#### Joined selected IN gate ([[card:card-s-c-c-c]], 2026-09-28)

After the joined residual identity fix, the all-encoding forced `m_abc` IN admission discriminator passed public rows but failed the selected seek bound in every encoding: `vdbe.ts:compileInnerTableSelect` excluded `operator==='in'` from `IndexSeekPrefix` yet let the planner's selected path fall through to `IndexRewind`. Pinned `wherecode.c:codeEqualityTerm/sqlite3WhereCodeOneLoopStart` instead loops over IN values and reseeks. The bounded lowering fix checks *selected* joined equality-prefix IN admissions at prepare: reject forced `INDEXED BY` atomically as temporarily unusable, or replan an unforced path with the offending source `NOT INDEXED`. This avoids crediting an unexecuted selected IN loop and keeps actual executable path/ORDER accounting aligned; residual public rows remain available on the fallback. Initial tests that assumed forced rows were adapted to assert rejection while retaining scan fresh/reset, NULL and rebind observations. Focused 3/3, combined 97/97, manifest 7/7, first-select 8/8, typecheck, boundary and diff check pass. No pinned selected IN claim or manifest change. Full physical IN restart/key/counter implementation and pinned native recapture remain future evidence requirements.

#### Joined IN-list residual correction ([[card:card-s-c-c-c]], 2026-09-28)

A review-derived joined `y.b IN (1,3)` neighbor returned `[]` under both `INDEXED BY m_abc` and `NOT INDEXED` in all three encodings, versus `(2,3),(2,1)` under host SQLite 3.45.1 (sanity only, not a pinned oracle). This disproved an index-only IN-loop diagnosis. In `vdbe.ts:compileInnerTableSelect`, the joined `resolveTree.visit` did not descend into `in-list`; `Column` consequently read cursor zero's `x.b` instead of the joined `y.b` in the residual expression. The resolver now follows the same operand recursion as single-source binding, including IN-list, BETWEEN, IN-subquery left and aggregate args (nested SELECT ownership stays separate). Pinned `resolve.c:resolveExprStep` and `expr.c:sqlite3ExprCodeIN` require source-resolved operands before evaluation. Initial/reset typed-row assertion now passes for both index and scan in all encodings; focused 1/1 and combined advanced/shared 95/95, manifest 7/7, first-select 8/8, typecheck and package-boundary pass. No credit change: joined selected IN-prefix restart, direction and exact nine-family counts remain unverified.

#### Joined range review correction ([[card:card-s-c-c-c]], 2026-09-28)

The review-derived joined `m_abc` test initially passed with two range bounds but returned no rows for lower-only `y.b>1` in all three encodings (the `NOT INDEXED` control returned `(2,2),(2,3)`). `vdbe.ts` had treated a missing range end as the range start and immediately terminated a prefix scan on the wrong inequality. Pinned `wherecode.c:1821-1866,1952-2041` maintains distinct start and end vectors; the bounded correction retains equality-prefix seek and residual WHERE filtering but emits `IndexRangeEnd` only for an actual opposite bound. All-encoding lower-only, upper-only and two-sided joined controls pass initially and after reset; this does **not** establish exact composite range positioning, reverse/IN joined paths or full selected-access credit. Refer to [[card:card-s-c-c-c]] status for the failed 40/41 run and repaired 93/93 combined suite.


The latest complete public/internal focused run for [[card:card-s-c-c-c]] is
`node --experimental-strip-types --test test/conformance/run-advanced-index-ts.test.mjs`:
**18/40 pass, 22 fail**. This supersedes earlier partial aggregate counts and the
prior 18/39 complete run; the added failure is the pinned qualifying IIF/CASE
implication branch. Pinned `src/expr.c:sqlite3ExprIsIIF` accepts resolved
inline-IIF function identity (ASCII-case-insensitive registered `iif` and
built-in alias `if`, including upper-case spellings)
with exactly two arguments or exactly three whose third passes pinned
`sqlite3ExprIsNotTrue` (NULL, FALSE, or an integer AST recursively decoded as
zero by `sqlite3ExprIsInteger`, including decimal/hex literals (with parentheses
parse-discarded) and nested unary UPLUS/UMINUS, but excluding REAL zero at any
such unary depth, TEXT zero, parameters under the no-parse-context call, and
CAST/arithmetic constants; the
variadic runtime forms do not qualify), and accepts one-pair searched CASE with
absent or such a not-true ELSE. It then recurses into the first condition. The
all-encoding test freezes those positives plus TRUE/nonzero-ELSE, variadic-IIF,
simple-CASE, multi-WHEN, and NULL-condition rejection boundaries; TypeScript
currently rejects all 75 qualifying prepares. The
advanced-index manifest validator passes 7/7 because all four partial/expression
cases correctly remain `unattempted` with zero selected-access credit. Shared
planner/WITHOUT ROWID regressions pass 23/23 and shared multisource regressions
pass 47/47; package-boundary and baseline public TypeScript conformance checks
also pass. Those controls localize, but do not waive, the failures above. The
partial/expression tranche is not accepted and [[card:card-s-c-c-b]] requires
reopening for the owning implementation repairs.

### Revision 2026-09-23 ([[card:card-j-d-b-a-c]] derived multirow VALUES destination correction)

A post-compound C2 discriminator exposed a destination-register divergence in the newer single-source derived coroutine route: public `SELECT * FROM (VALUES(1),(2),(3))` returned the first term three times, while pinned SQLite 3.53.4 returned 1, 2, 3. Generated `valuesRows` was complete; `compileScalarSelect` emitted each term from a distinct `ResultRow.p1` range, but `compileDerivedProducer` discarded that range when replacing `ResultRow` with `Yield` and its consumer reread fixed registers. Pinned `select.c::multiSelectValues` walks every linked VALUES term through `selectInnerLoop` into the caller's stable destination.

The correction gives the coroutine a stable producer-output range, copies each actual `ResultRow` range into it before yielding, and relocates expanded child control targets with an explicit old-PC/new-PC map. The consumer reads only that destination. Child parameter descriptors remain public, and the same route now applies outer ORDER/LIMIT/OFFSET with ordinary typed sorter and limit opcodes. This is an owning destination/control-flow repair, not token parsing, row post-processing, a second AST evaluator, or a new materialization substitution.

Public focused coverage now spans all three database encodings, multirow/multicolumn payloads, parameters, NULL/INTEGER/REAL/TEXT/BLOB, ORDER plus OFFSET/LIMIT, reset/rerun, private sorter bytes, cancellation, first-error retention, cleanup, and restored admission: 8 declared / 8 attempted / 8 passed. The exact compound public gate remains 22 declared / 22 attempted / 22 passed / 22 credited. Parser/typecheck/package checks and affected coroutine lifecycle checks pass. A pre-existing three-encoding test named `materialized producer and outer sorter share private bytes` still fails unchanged at clean HEAD and with `maxPrivateBytes:1`: its query is now compiled as nested coroutines with no sorter opcodes, so its expected sorter-byte rejection is stale rather than a C2 regression. It is not waived or edited here because that concurrent route/test owner must replace it with a composition that actually owns simultaneous private cursors.

Broader expression runners currently fail independently with `key-000001` versus expected `min` on aggregate coverage; this C2 patch does not touch aggregate selection. Relational private lifecycle is 18/18. These failures are reported rather than credited or hidden.

### Revision 2026-09-23 C2 implementation-owner correction ([[card:card-j-d-b-a-c]])

This revision supersedes only the stale test-status statements in the preceding C2
entry; it preserves that entry as the original defect and repair provenance. The
two public discriminators, compared independently with pinned SQLite 3.53.4, were:

- `SELECT * FROM (VALUES(1),(2),(3))`: the reported and reproduced pre-fix
  TypeScript result was `[[1n],[1n],[1n]]`; pinned SQLite and current TypeScript
  produce `[[1n],[2n],[3n]]`.
- `SELECT * FROM (VALUES(1,'a'),(2,'b')) ORDER BY 1 DESC`: the reported and
  reproduced pre-fix TypeScript result was `[[1n,"a"],[1n,"a"]]`; pinned SQLite
  and current TypeScript produce `[[2n,"b"],[1n,"a"]]`.

The generated reduction was not incomplete: every structured VALUES row remained
in `SelectArm.valuesRows`. The divergence was destination-shaped. Each arm's
ordinary scalar program placed its row in that arm's own `ResultRow.p1..p1+p2`
register range. The derived coroutine rewrite replaced each `ResultRow` with a
`Yield`, while its consumer always reread the first fixed register range. Thus
resumption reached every arm but repeatedly exposed the first payload. In pinned
`select.c`, `multiSelectValues` walks the linked VALUES terms and invokes
`selectInnerLoop` with the caller's `SelectDest`; the destination contract, not a
token reconstruction or row post-processor, owns the row lifetime.

Commit `52e01dd2cff043911ddc6cc249f349b4ce627693` repaired that owner by allocating
one stable coroutine output register range, copying each actual `ResultRow` range
there before `Yield`, and making the consumer read that range. Because one child
instruction can expand to N copies plus a yield, it also introduced explicit
old-PC/new-PC relocation. Commit `e39d2799797556d8851bc7cb40028c935b283e73`
completed the implementation-owner correction: address-only embedded-program
relocation now covers the represented jump/empty-target variants while preserving
coroutine zero sentinels, and the related derived scan, residual, reset, budget,
cleanup, and admission paths have focused coverage. Review-only successor
`386826dc0509ff6d2db611fa4f9bbdcb7d098314` changes no implementation.

Current implementation-owner verification is exact but bounded. The derived C2
suite passes 9/9 across its focused payload, encoding, parameter, ORDER/LIMIT,
reset, budget, cancellation, first-error, cleanup, and admission cases. The public
compound gate passes 22 declared / 22 attempted / 22 passed / 22 credited. The
full subquery/view target passes 192/192, including the corrected materialized
private-byte fixture (it orders by non-rowid `b`, so the asserted inner sorter
actually exists), coroutine lifecycle, correlation, view, and derived routes. The
selected relational private lifecycle target passes 18/18, and the expression
bounded runner passes all six named resource/cleanup checks. Current focused log:
`work:///cards/card-j-d-b-a-c/processes/proc-34f50420dbf9/stdout.log`; current
192/192 log: `work:///cards/card-j-d-b-a-c/processes/proc-61c976094530/stdout.log`;
current lifecycle/resource logs:
`work:///cards/card-j-d-b-a-c/processes/proc-e6e786b77edf/stdout.log` and
`work:///cards/card-j-d-b-a-c/processes/proc-ae4e914ba0e1/stdout.log`. Original
RED and pinned-native evidence remains at
`work:///cards/card-j-d-b-a-c/processes/proc-6eff29cf73a3/stdout.log` and
`work:///cards/card-j-d-b-a-c/processes/proc-e11dcf542077/stdout.log`.

This is not general compound or derived-table compatibility. The finite typed
producer remains the documented browser/TypeScript substitution for the admitted
slice, not SQLite's general resumable merge stack. Unsafe table-derived scan/order
shapes still reject atomically, and unrepresented compound compositions involving
general joins, subqueries, aggregates, windows, CTEs, views, or unsupported
storage shapes remain outside this bounded owner unless admitted by their own
separately tested routes. No fallback evaluator, token reparsing, partial-arm
execution, or main-database write is claimed.

### Revision 2026-09-22 — C5 SELECT-list correlation disproof and correction

At clean code HEAD `a648bf0`, manifest-pinned SQLite 3.53.4 and the Chinook image
SHA-256 `7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`
returned `["AC/DC",2]` for the qualified correlated aggregate query. The public
Fetch path on the identical bytes instead failed prepare with typed SQLite error
`no such column: ar.ArtistId`. This disproved complete SELECT-list correlation
ownership despite prior C1/A1/B4 repairs.

Pinned source comparison: `resolve.c:lookupName` scans the current
`NameContext.pSrcList` and then `pNext`, establishing local-first lexical
ownership; `expr.c:sqlite3CodeSubselect` omits `OP_Once` for `EP_VarSelect` and
uses the parent Parse/VDBE register space. The TypeScript linked resolver already
matched that control. `compileTableSelect` subsequently collapsed the semantic
qualified column to a single unqualified lookup token, losing the established
source qualification. The correction reconstructs identifier components at
that lowering boundary and preserves existing child/outer cursor allocation.
It does not add alias-token matching, global symbols, catches, fallbacks, or new
shape admission.

The native oracle now captures exact source ID, image digest, and typed C5 row.
Public Chinook coverage checks exact metadata/result/reset plus two independent
correlated aggregate destinations in arithmetic composition. The all-encoding
fixture checks qualified outer filtering, count/max empty and NULL results,
reset, admission, and the existing limit/finalize first-error lifecycle gates.

#### Revision: Owner C4 shared REAL-to-text primitive

C4 now uses a direct `util.c:sqlite3FpDecode` translation shared by Mem text,
CAST/columnText, quote and formatting. The prior fixed 18-digit helper is replaced
by conversion-owned rounding and 16/20-digit decode, including exact subnormal,
Inf and round-trip-shortening observables. Native evidence reads values through
explicit C `sqlite3_column_text`; JavaScript/CLI display is not oracle evidence.

#### Revision: C4 altform2 fixed/exponential dispatch

The finding in `record:///review.md?card=card-p-b&v=16` is corrected: `%f`, `%e`
and `%E` now pass altform2's 20-digit decoder cap and apply source trailing-zero
removal; ordinary and round behavior is unchanged. Explicit C column-text evidence
also records that uppercase `%F` is not a pinned conversion and emits empty.

### Revision 2026-09-28 ([[card:card-s-c-c-b]] joined index-bound regression)

The advanced-index focused suite's 40 passing tests did not detect an unbounded selected join on the larger shared `storage_values` fixture: a public typed INNER self-join exhausted the default `maxWorkUnits`. `compileInnerTableSelect` now consumes eligible selected equality/range admissions using `IndexSeekPrefix`, `IndexPrefixEnd` and `IndexRangeEnd` before deferred table reads (pinned `wherecode.c:sqlite3WhereCodeOneLoopStart`). The three-encoding shared public discriminator and the 113-test affected joined/planner/advanced suite now pass. This narrows the specific bound/termination gap; earlier audit warnings about arbitrary `WherePath.loops` order, reverse/IN join movement, covering and outer-join generality remain unproven, not superseded by this selected regression.

### Revision 2026-09-29 ([[card:card-s-c-d-d]] competing candidate admission)

A focused red reproducer showed `where-plan.ts:capabilities` suppressed a
first-slot two-ended range whenever the same slot also admitted IN, although
pinned `where.c:whereLoopAddBtreeIndex` restores saved `nEq`/`nBtm`/`nTop`
between term proposals. Removing the early return keeps both alternatives;
the three-encoding planner reproducer and advanced-index public suite pass.
This corrects immutable candidate admission only: matching scan-equivalent rows
alone do not establish selected physical-index cursor access, and joined
selected-IN remains a separately documented unsupported lowering route.

### Revision 2026-09-29 ([[card:card-s-c-c-d]] selected-access accounting)



The 2026-09-23 prediction that all four partial/expression cases are unsupported
and the older `unattempted`/zero verdict are historical. Current frozen public
probes select loaded `p_live` and `e_expr` with KeyInfo and physical equality seeks
in all encodings, beside pinned native EQP/typed captures. Bounded eligibility
credits those two positive cases (six pairs); negative unforced base scans remain
zero selected-access credit despite matching rows. The selected-access total is
24/30, not a generic optimizer claim. Review-derived NULL/reset and corruption
checks are not native recaptures. Joined selected-IN remains unsupported.

### Revision 2026-09-29 (joined partial proof operand collision)

The goal review's same-name cross-source hypothesis is now reproduced by the public fixture: `p.a=m.c`, `m.id=1`, `p.c=NULL` returns both p rows via `NOT INDEXED` but the pre-repair unforced plan omitted p.id=2 (RED `proc-559109ebef35`, 0/1). `sameResolvedExpression` compared only folded final names after structural mismatch; whole-term `p` prerequisites did not make `m.c` a proof of `p.c`. `where-plan.ts:partialProofIdentity` now compares depth-zero resolved source and declared column to the schema predicate's indexed-table column. The all-encoding forward/reversed/LEFT and reset companion passes after repair; forced unusable `p_live` rejects before preparation publishes a statement. Earlier revision-labeled joined partial failures describe previous states, not current facts. No new frozen selected-path credit is claimed (24/30 unchanged); source-identity cases beyond this represented public discriminator require separate evidence.

2026-09-29 revision: selected single-table composite prefix IN + following
range now repeats the index seek per non-NULL distinct RHS and retains sorter
when IN iteration cannot certify output order. Six pinned encoding/state public
cases and prior single-field/planner checks pass locally; this does not close the
review's broader joined/LEFT, multi-slot IN, stat-choice, corruption, reset or
cleanup findings. See `docs/TRANSLATION.md` selected single-slot revision.

2026-09-29 joined-path revision: historical unsupported joined single-IN
claims above were superseded by per-level restart for one selected IN slot plus
composite range. Later `wherecode.c:codeINTerm`/`where.c:sqlite3WhereEnd` per-slot
lowering now tests two selected IN slots on the frozen six variants, with
separate three-slot single-table/rebind and joined LEFT selected-seek cases on
advanced-index fixtures in UTF-8/16le/16be. The original single-slot cases
retain LEFT unmatched-once, NULL RHS, duplicate and reset checks. These tests
are now supplemented by an independently captured pinned three-slot typed
oracle, not general multi-IN/ORDER/statistics parity: `capture-three-in.py`
freezes UTF-8/16le/16be read-only advanced-index fixture hashes/roots, exact
existing single/rebind and LEFT SQL plus unmatched LEFT neighbor, EQP,
VDBE per-IN cursor and composite seek instructions, typed ordered rows and
stmt counters. `three-in-native.test.py` and `three-in-native-ts.test.mjs`
assert source identity, native selected/scan structure and exact-SQL public
fresh/reset-rebind selected-probe/scan typed rows and selected-root versus
off-path scan corruption isolation. See the living guide for
finite-array adaptation; this bounded finding-1 evidence does not assert
optimizer parity. The later stat-choice revision below covers only its bounded
frozen pre/post choice.

2026-09-29 private-work and corruption revision: the in-memory selected IN RHS
set previously compared all earlier members inside one VM opcode with no work
checkpoint. `vdbe.ts:InListValue` now charges every candidate/prior comparison
and releases temporary Mem on thrown limit; six encoding/state checks assert a
selected probe before budget exhaustion and post-failure connection reuse.
Independent malformed t_ab root tests retain the frozen file bytes except page
5's type, require `NOT INDEXED` frozen typed results and selected SQLite code 11
on first seek, including post-error finalize. No general multi-IN or stats parity.

2026-09-30 two-IN revision (supersedes earlier all-multi-IN exclusion for this
bounded subset): selected two-field composite equality prefixes now support two
independent IN slots in single-table and joined LEFT callers, with inner-first
iteration and per-outer reset. Six frozen encoding/state fixtures compare public
rows for forced/unforced access and verify selected seek counts. Expected new
rows checked with host SQLite 3.45.1, not a pinned-native capture. >2 slots,
broader stats/ORDER parity and coordinated commit remain open.

2026-09-30 RHS-order finding: previous finite array preserved source-list order,
contradicting pinned `expr.c:sqlite3CodeRhsOfIN` ephemeral KeyInfo Btree traversal
in `wherecode.c:codeINTerm`. Six pinned-oracle read-only fixture comparisons
reproduced a selected no-ORDER public row-order mismatch with unsorted two-slot
RHS lists. `InListValue` now owns a bounded ordered per-iterator set; focused
135/135 selected/neighbor tests pass. This is still an array substitution,
not native Btree cost/statistics parity.

### Revision 2026-09-29 — immutable stat1 choice (bounded)

The earlier no-stat-only W1/W2 characterization is superseded for represented
index stat1 rows: loader plus planner now passes six pinned pre/post ANALYZE
stat-choice cases, including forced controls, in UTF8/16le/be. This does not
establish all WHERE pruning, stat4 or join-order fidelity. A joined forced IN
probe-count assertion was contradicted by independently queried pinned native
3.53.4 EXPLAIN: the join equality owns the index seek, IN is residual for that
case. The corrected selected-seek test and 98-test broader suite pass. Keep
unrepresented stat1 extensions/STAT4 and general path dominance as audit gaps.

[[card:card-s-c-d-f]] follow-up finding: source-case-1 subset comparison is
now index/prefix based, not term-identical; fixed guessed sort-cost and IN
cost-penalty experiments were rejected by source or frozen results. At this **earlier** stat1 revision, selected unforced composite IN after ANALYZE
and joined two-slot probes remained red despite six stat-choice successes.
That was not a permanent selected-IN exclusion: the later per-slot selected
caller and planner fixes pass the frozen selected cases, including bounded
three-slot advanced-index selected-seek tests. Candidate insertion/remaining-
term adjustment and exact wider native-vs-public access remain open for
source-based comparison; frozen stat-choice 6/6 does not establish general
index-choice parity.

[[card:card-s-c-d-f]] updated checkpoint: the insertion-order represented
case-2 subset adjustment (`where.c:whereLoopCheaperProperSubset` /
`whereLoopAdjustCost`) makes the frozen selected composite and joined two-slot
public access assertions green in the focused run. Earlier red findings above
are historical. This does not implement `whereLoopFindLesser` replacement,
STAT4, or establish general planner parity.

### Revision 2026-09-29 — joined no-GROUP aggregate child checkpoint

The earlier one-source-only aggregate-child gate is historical: the bounded
no-GROUP joined accumulator now scans each source with parent-owned cursor
allocation and emits into the parent's destination. Paired public native
cases pass, but the five-file ownership reproducer still fails on the
completed-child `compileScalarSelect` fallback. The latter is a current gap,
not a prediction about the newly migrated aggregate branch. Nonaggregate
multi-source children still require a source-owned producer before removal.

**card-t-b joined-child rowid-seek revision:** A new pre-migration oracle/public
probe for `t1.a=3` joined scalar/Exists/IN demonstrated a reachable `SeekRowid`
producer previously rejected by the completed-child fallback. Its cursor,
key register and exit PC are now admitted and rebased in that fallback; public
rows/types/names/reset pass. This does not resolve the structural ownership
finding: the nonaggregate join still produces a separate Program and is spliced.

**card-t-b nonflattenable LIMIT producer/outer WHERE revision (2026-09-29):**
Pinned `select.c:flattenSubquery` restriction (19) keeps producer LIMIT
before outer WHERE. The bounded one-table no-ORDER/no-DISTINCT producer now
lowers producer scan/LIMIT and substituted outer predicate into the same
scalar/EXISTS/IN builder, decrementing producer LIMIT on outer rejection.
Paired pinned/public `x+1 AS y FROM t2 LIMIT 1` and outer `d.y>2` typed
NULL/0/0, names, resets pass; public pre-edit failed `no such table: d`.
General ephemeral/coroutine, ORDER, DISTINCT and multirow outer callers remain
red.

**card-t-b COLLATE-wrapped producer ORDER revision (2026-09-29):**
Pinned `resolve.c:resolveOrderGroupBy` skips COLLATE to bind producer
AS-name/ordinal, retaining the wrapper during result substitution before
`select.c:flattenSubquery` transfers ORDER. Bounded public alias/ordinal
`x+1 AS y ORDER BY y/1 COLLATE BINARY DESC LIMIT 1` returned 4/2 versus
pinned 10/10 pre-edit; source-ID-checked native/public typed rows, names and
resets now pass. General NameContext and nonflattenable materialization remain
red.

**card-t-b producer ORDER ordinal before flatten transfer revision (2026-09-29):**
Pinned `resolve.c:resolveOrderGroupBy` binds ordinals to producer EList width
before `select.c:flattenSubquery` transfers ORDER. Bounded two-column
producer `x AS a, x+1 AS b ORDER BY 2` previously failed on parent's
one-column 1..1 check. Source-ID-checked native/public alias/ordinal typed
rows, metadata and resets and `ORDER BY 3` 1..2 rejection pass after binding
against producer width. Nonflattenable materialization remains red.

**card-t-b producer ORDER AS-name before flatten transfer revision (2026-09-29):**
Pinned `resolve.c:resolveOrderGroupBy` binds producer aliases before
`select.c:flattenSubquery` transfers ORDER. Bounded transfer now resolves
producer AS-names against producer EList: `x+1 AS y ORDER BY y DESC LIMIT 1`
previously produced public 4 vs pinned 10. Source-ID-checked native/public
alias/ordinal rows, metadata and resets pass. General NameContext and
nonflattenable materialization remain red.

**card-t-b source-permitted derived LIMIT transfer revision (2026-09-29):**
Pinned `select.c:flattenSubquery` (13)/(14)/(19) permits producer LIMIT
transfer only without parent LIMIT/WHERE or producer OFFSET. Bounded
one-table caller now carries producer LIMIT plus ORDER into enclosing-builder
scan/sorter/SRT; paired native/public rows, metadata and resets pass for
LIMIT 0/1 and ORDER plus LIMIT 1/2. Pre-edit public `no such table: d`.
Nonflattenable LIMIT with outer WHERE and generic completed-child relocation
remain red.

**card-t-b nonzero-source derived ORDER transfer revision (2026-09-29):**
Pinned `select.c:flattenSubquery` permits nonaggregate/non-DISTINCT
single-source producer ORDER without LIMIT and parent ORDER; producer ORDER
transfers to the flattened parent before its sorter and SRT destination.
The bounded caller now compiles this transfer in the enclosing builder.
Source-ID-checked native/public scalar/EXISTS/IN typed rows, names and resets
pass; initial public probe failed `no such table: d`. Producer LIMIT,
materialized CTE/derived, and live completed-child relocation remain red.

**card-t-b ORDER resolution for no-FROM derived producer revision (2026-09-29):**
Pinned `resolve.c:resolveOrderGroupBy` resolves AS-name and integer ordinal
against the producer EList before ordinary expression resolution. Bounded
shared-builder ORDER keys now bind these references to result registers;
ordinals outside result width reject at prepare with pinned error.
Source-ID-checked native/public typed alias/ordinal rows, reset and native
error/public post-rejection preparation pass. Generic NameContext, multirow
sorter and live completed-child relocation remain red.

**card-t-b ORDER no-FROM derived producer revision (2026-09-29):**
A producer ORDER fell through to `no such table: d`. Pinned
`flattenSubquery` restriction (7) retains the no-FROM producer;
`selectInnerLoop` loads its row before `pushOntoSorter` computes keys and
sorter LIMIT/OFFSET. The bounded shared builder now evaluates bound ORDER
keys after the producer row and before its OFFSET; a single row has no
comparison or multirow drain. Source-ID-checked native/public typed
scalar/EXISTS/IN rows/names and reset pass. Multirow sorter ownership,
general derived/CTE and live generic relocation remain red.

**card-t-b DISTINCT no-FROM derived producer revision (2026-09-29):**
A DISTINCT producer fell through to `no such table: d`. Pinned
`flattenSubquery` restriction (7) retains no-FROM producer and `sqlite3Select`
consults DISTINCT planning before `selectInnerLoop` emits its candidate.
This bounded producer has at most one admitted row, so DISTINCT cannot
suppress it; the shared builder fills its transient row and emits outer
Mem/Exists/Set without a dedup cursor. Source-ID-checked native/public typed
rows/names and reset pass. ORDER, multirow DISTINCT and live generic
relocation remain red.

**card-t-b multi-column no-FROM derived producer revision (2026-09-29):**
The one-column branch previously fell through to `no such table: d` for a
multi-column producer. Pinned `flattenSubquery` restriction (7) retains it;
`selectInnerLoop` fills its result row before the outer WHERE/result, and
`resolveExprStep` binds transient names. The bounded shared builder now
allocates producer row registers, fills them on an admitted row and binds
outer WHERE/result into those registers before Mem/Exists/Set. Source-ID-
checked native/public typed rows/names and reset pass. Wider derived/CTE,
ORDER and live generic relocation remain red.

**card-t-b outer expression on zero-source derived column child revision (2026-09-29):**
Previously `d.n+1` in the outer result over a no-FROM producer fell through
to `no such table: d`. Pinned `resolveExprStep` binds transient columns
throughout the result and `selectInnerLoop` evaluates it only after producer
admission. The bounded shared-builder child substitutes the producer
reduction into its outer result and emits Mem/Exists/Set after its gates;
unbound columns reject before ops. Source-ID-checked native/public typed
rows/names and reset pass. Independent ORDER, wider derived shapes and live
completed-child relocation keep the global structural assertion red.

**card-t-b outer WHERE on zero-source derived column child revision (2026-09-29):**
The no-FROM producer with outer WHERE previously fell through to `no such
table: d`. Pinned `flattenSubquery` restriction (7) retains the producer,
`resolveExprStep` binds its transient column, and `selectInnerLoop` evaluates
the outer predicate only after producer row admission. The shared-builder
child now substitutes that binding and gates Mem/Exists/Set before outer
OFFSET. Source-ID-checked native/public typed rows/names and reset pass;
independent outer ORDER and live generic relocation remain, leaving the
global structural assertion red.

**card-t-b nested outer LIMIT on zero-source derived column child revision (2026-09-29):**
The no-FROM producer's caller formerly rejected outer LIMIT/OFFSET by falling
through to `no such table: d`. Pinned `sqlite3Select` initializes the outer
limit ahead of the producer and `selectInnerLoop` offsets the outer row event.
The shared-builder child now owns both limit boundaries and Mem/Exists/Set.
Source-ID-checked native/public typed rows, suppressed producer/caller and
reset pass. Outer WHERE/ORDER and generic completed-child relocation remain;
the global structural assertion is red.

**card-t-b zero-source derived column child revision (2026-09-29):** Pinned
`flattenSubquery` restriction (7) leaves the no-FROM producer unflattened.
A bounded direct derived-column expression child now feeds Mem/Exists/Set in
the enclosing builder with producer WHERE/LIMIT/OFFSET; formerly the public
route failed `no such table: d`. Source-ID-checked native/public value,
empty producer, types/names and reset pass. Wider derived shapes and live
completed-child relocation still remain, so the global structural assertion
is red.

**card-t-b zero-source derived count child revision (2026-09-29):** Pinned
`flattenSubquery` restriction (7) prevents flattening a no-FROM producer.
The child `count(*)` destination previously went through a completed scalar
producer rewrite; a bounded parent-owned branch now emits producer candidate
and count finalization into the enclosing builder and Mem/Exists/Set. Paired
native/public one/zero candidate and producer LIMIT/OFFSET, names/types and
reset pass. Top-level compatibility rewrite remains; other nonflattenable
shapes and generic completed-child relocation remain unproven and the global
structural assertion is red.

**card-t-b ungrouped aggregate ORDER revision (2026-09-29):** Pinned
native/public `ORDER BY count(*) DESC` and projected alias cases pass count,
empty-input, LIMIT/OFFSET, Mem/Exists/Set and reset. `aggregateShapeSupported`
previously rejected the one-row accumulator despite existing parent-owned
finalization/destination; bounded projected-result ORDER identity is admitted
without a sorter. Independent ORDER expressions and remaining relocation are
still unproven; global structural assertion remains red.

**card-t-b ordered grouped key revision (2026-09-29):** Source-ID-checked
pinned/public descending grouped-derived and view cases now pass typed rows,
metadata and two resets. Prior public prepare rejection for `ORDER BY d.x
DESC` was an aggregate shape/producer ownership gap: ORDER used a saved GROUP
key not projected into the result. The grouped result sorter now consumes
that key after finalization, retaining its enclosing destination. This is
bounded identity admission, not arbitrary ORDER expression parity. The
completed-child fallback still fails the global structural assertion.

**card-t-b flattenable grouped child revision (2026-09-29):** The scalar
caller now routes admitted simple derived/immutable view GROUP BY expression
children through the aggregate producer's existing parent-preserving
flattening recursion. Source-ID-checked pinned/native and public paired
empty/HAVING/LIMIT and view-group cases pass with typed rows, metadata and
resets. Oracle-accepted ordered derived grouping exposed a preexisting
`aggregateShapeSupported` admission boundary and is not claimed supported.
The completed-child fallback remains for other reachable plans and the full
structural assertion still fails.

**card-t-b grouped-child destination checkpoint (2026-09-29):** Direct
physical-table GROUP BY scalar/Exists/IN children now call the aggregate
producer with the enclosing builder and destination. Existing source-ID-checked
pinned/native and public paired grouped empty/HAVING/DISTINCT/LIMIT cases pass
with typed rows/names and two reset cycles; bounded ownership assertion passes.
Derived/view and other remaining completed-child fallback consumers are not
migrated: the full scalar-child structural assertion still fails. No broad
compatibility or index parity is inferred.

**card-t-b joined-child builder checkpoint (2026-09-29):** The preceding
rowid-seek fallback finding remains historical for that path: nonaggregate
joined scalar/Exists/IN now calls the joined producer with the enclosing
builder and destination rather than splicing its Program. Native/public paired
probe passes, as does the new bounded ownership assertion. The original
structural assertion still detects the *remaining* completed-child fallback;
this revision does not claim all scalar-child ownership or broad index parity.

**card-t-b ordered nonflattenable producer checkpoint (2026-09-29):**
Pinned `select.c:flattenSubquery` restriction (19) prevents outer WHERE
from preceding a producer LIMIT. The bounded single-result one-table ORDER
producer now sorts/top-N limits before testing outer WHERE on sorted payload
in the enclosing builder; native/public paired LIMIT 1 rejected and LIMIT 2
accepted second row show NULL/0/0 and 4/1/1 with names and two resets.
Earlier unbounded sorter/scan-time outer predicate yielded wrong results.
Global completed-child relocation structural assertion remains failing;
other producer/consumer shapes and broad resource parity are not established.

**card-t-b multi-column ORDER producer / single selected payload revision (2026-09-29):**
The previous guard rejected a width-two producer even when the caller
selected one of its EList values and the producer ORDER key was resolvable
against its own EList. Compared `select.c:flattenSubquery` restriction (19)
and `resolve.c:resolveOrderGroupBy`: keep producer ORDER binding separate
from the selected materialized payload. Paired pinned/public width-two
ORDER BY 2 LIMIT 2 with `d.a` and `d.b`, outer filters, scalar/EXISTS/IN,
typed values, names and two resets now pass. This does not materialize the
other producer columns for arbitrary outer expressions. The structural
completed-child relocation assertion is still red.

**card-t-b cross-column ordered producer revision (2026-09-29):**
Rechecked pinned `select.c:flattenSubquery` (19), `generateSortTail` and
`expr.c:sqlite3CodeSubselect`: the outer predicate on a nonselected column
cannot read the scan cursor during sorter drain. The bounded one-table
producer now retains needed direct columns in its sorter payload and evaluates
the predicate after producer LIMIT, before Mem/Exists/Set. Source-ID-checked
paired `d.b` output / `d.a<9` filter yields typed 4/1/1, names and two
resets. The first public attempt rejected substituted-column binding; the
producer NameContext does not own those outer reductions. Generic completed-
child relocation still fails the structural test; this does not establish
full derived/CTE materialization, OFFSET, unsupported atomicity or budget
parity. Follow-up: the sorted-drain rewrite now walks CASE operand, WHEN,
THEN and ELSE, matching its scan-time column collector and pinned
`expr.c:TK_CASE` evaluation tree. Source-ID-checked/public CASE-over-`d.a`
with selected `d.b` returns typed 4/1/1 and two resets; the structural
relocation assertion remains red. Subsequent branch audit found the same
producer sorter was bounded only when the outer WHERE existed. Pinned
`select.c:pushOntoSorter` bounds by producer LIMIT(+OFFSET) regardless of
outer filtering; unfiltered `SorterInsert` now uses the producer capacity too.
Source-ID-checked/public direct scalar/EXISTS/IN ORDER BY x DESC LIMIT 2
returns typed 9/1/1 with names/two resets; full resource-limit parity and
completed-child migration remain unverified.

Revision (card-t-b, ordered producer OFFSET): admitting the one-table
LIMIT/OFFSET + outer WHERE path exposed a second sorted-drain divergence:
SRT_Mem kept iterating after the first accepted row and overwrote it (2
rather than pinned 4 for LIMIT 2 OFFSET 1). `expr.c:sqlite3CodeSubselect`
caps Mem/Exists to one while retaining OFFSET; the destination now stops
at its first post-filter row and Set continues draining. Source-ID-checked
native/public paired LIMIT 2/1 OFFSET 1 cases return typed 4/1/1 with
metadata and two resets. Generic completed-child relocation and full
transient source materialization remain open; the structural test remains red.

Revision (card-t-b, unsorted producer destination): `select.c:selectInnerLoop`
continues producer LIMIT across rows, but `expr.c:sqlite3CodeSubselect`
limits Mem/Exists to their first accepted result. A LIMIT 3 derived producer
with post-WHERE exposed public 4 instead of pinned 2: the unsorted branch
kept overwriting Mem. The bounded no-sort Mem/Exists destination now exits
at its first accepted outer row; Set still drains. Source-ID-checked paired
LIMIT 3, LIMIT 3 OFFSET 1, LIMIT 1 OFFSET 1 compare typed 2/1/1, 4/1/1,
NULL/0/0, names and two resets. The completed-child structural assertion
and full transient materialization remain open.

Revision (card-t-b, independent producer scalar expression): pinned
`resolve.c` does not bind nested SELECT columns in the producer's
NameContext; `expr.c:sqlite3ExprCodeTarget/sqlite3CodeSubselect` emits its
own nested scalar destination into the same Parse/Vdbe. The one-table
producer binder previously rejected scalar subqueries before its expression
compiler could call the existing enclosing-builder nested producer. A
source-ID-checked native/public ORDER BY `(SELECT 1)` producer with
scalar/EXISTS/IN now compares typed 1/1/0, metadata and two resets. This
bounded path does not establish general correlated producer expressions;
the next source-first `x IN (SELECT 4)` producer test binds only its left
operand in the producer NameContext and compiles its RHS with the existing
`expr.c:sqlite3CodeSubselect` enclosing-builder callback. Native/public
outer Mem/Exists/Set compare typed NULL/0/0 and positive-match
`x IN (SELECT 1)` typed 1/1/1, metadata and two resets.
General correlated RHS remains unestablished; completed-child relocation
structural test remains red.

Correlated scalar-producer IN RHS checkpoint (card-t-b, 2026-09-29): a
source-ID-checked pinned-native/public `x IN (SELECT x)` probe initially
returned public 3/0/0 vs native 9/1/0. Producer-side `resolve.c` NameContext
column ownership is now carried to `expr.c`-shaped no-FROM RHS lowering in
`vdbe.ts`; the paired public differential passes with metadata and resets.
This is bounded immediate physical-source correlation only. The full
completed-child relocation structural test remains red; no general correlated
SELECT parity is claimed.

Correlated RHS WHERE follow-up (card-t-b): the first correlated IN checkpoint
carried the RHS projection's outer cursor but not its WHERE test. Pinned-native
`x IN (SELECT x WHERE x>1)` typed 9/1/0 vs pre-repair public 9/1/1. The same
resolved owner is now used for both phases of the bounded no-FROM RHS; paired
public test passes. This neither removes completed-Program relocation nor
establishes arbitrary correlated expression/NameContext parity.

Revision (card-t-b, correlated function-argument probe): pinned source-ID
checked `x IN (SELECT abs(x) WHERE abs(x)>1)` under a one-table producer
returns typed 9/1/0 for scalar/EXISTS/IN, versus 3/0/0 before the new
argument binding. The bounded exprlist binding now passes paired public rows,
metadata and two resets. This is not a general correlation or SELECT compiler
parity claim; the completed-child relocation structural assertion remains red.

#### One-source scalar scan follow-up (card-t-b, bounded)

The prior one-source fast path could fall through to completed-child opcode
relocation when result or ORDER lowering failed. The shared enclosing scan
builder now accepts this nonaggregate one-source branch in addition to joins;
source-ID-checked paired two-key ORDER/limit/offset Mem/Exists/Set cases pass
publicly with typed values, names and resets. This does not retire the still
reachable generic relocation fallback or establish general SELECT parity.

Revision card-t-b grouped LEFT JOIN: earlier simple-group admission rejected
LEFT while the grouped builder's nested scan also omitted the `wherecode.c`
NULL-extension transition. That combination left a supported scalar producer
at a temporary prepare failure. The grouped scan now produces the unmatched
right row into its sorter and enclosing SRT destination; paired source-ID-checked
cases cover matched/unmatched typed counts. This does not retire completed-child
relocation for other producer shapes or certify generalized outer-join parity.

Revision card-t-b after-ON grouped LEFT: `count(*)` hid a NULL-row control
flow defect; synthetic rows re-entered the physical ON predicate, incorrectly
rejecting unmatched groups for `count(t2.x)` and post-join `WHERE t2.x IS NULL`.
Source-first paired nullable-right and ON-rejection cases reproduce and now
match after rerouting the synthetic continuation past ON. This does not clear
the unrelated scalar completed-child relocation assertion.

Revision card-t-b grouped ORDER-only expressions: previously grouped scalar
Mem/Exists/Set rejected `ORDER BY count(*)+1` even though pinned SQLite
resolves and analyzes this ORDER expression in the same AggInfo as the result.
Grouped builder now resolves and lowers the independent key before stepping,
then evaluates it from finalized accumulator and saved group payload. Paired
count expression, source-column expression and ORDER-only `sum(y)` cases pass
with limits/offset, names and resets; generic completed-child relocation
continues to fail the focused structural assertion. No whole-engine parity.

Revision (card-t-b unordered table-backed UNION ALL IN): the earlier
compound expression-subquery rejection has a bounded exception for unlimited
unordered nonaggregate table-backed IN/Set arms, emitted into the enclosing
builder per pinned `select.c:multiSelect` TK_ALL and `expr.c:sqlite3CodeSubselect`.
Source-first paired public typed hit/miss and reset pass; generic completed-child
relocation and other compound destinations still fail compiler ownership.

Revision (card-t-b compound Mem/Exists): unordered unlimited table-backed
UNION ALL now forwards a single enclosing Mem/Exists destination across arms.
The Mem found flag preserves first-row NULL vs no-row; typed public differential
first/empty-left/NULL and reset pass against pinned SQLite. Completed-child
relocation still remains in the generic scalar fallback; do not infer full
SELECT compiler ownership from this branch.

Revision (card-t-b mixed UNION ALL): the previously table-backed-only
Mem/Exists/Set branch now consumes simple no-FROM arms in the same enclosing
builder/destination. Public differential mixed-arm first/empty/NULL cases
pass. The structural completed-child relocation check remains red; this
bounded change is not a full compiler migration.

Revision (card-t-b left no-FROM compound): inspecting only the rightmost
SELECT `from` incorrectly routed left constant/right table UNION ALL through
the constant/no-FROM child. Classification now checks every arm, matching
pinned `multiSelect`'s chain walk. Paired native/public typed first and
NULL-first cases pass; the generic completed-child relocation check remains
red.

Revision (card-t-b mixed no-FROM WHERE): mixed-arm admission previously rejected
a no-FROM arm with WHERE although upstream `sqlite3WhereBegin` rejects its
candidate before `selectInnerLoop` emits. Arm-local predicate and false jump
now precede projection/destination, tested against pinned source-ID through
public scalar/EXISTS/IN with empty and NULL-first cases. Structural generic
relocation remains a live failure, not an accepted exception.

Revision (card-t-b all-no-FROM WHERE): even after mixed-arm WHERE lowering,
the earlier simple no-FROM classification intercepted two no-FROM arms with
WHERE. Deferred that compound to the shared builder. Paired source-ID/public
WHERE 0 and NULL-first WHERE 1 typed Mem/Exists/Set cases now pass. Generic
completed-child relocation remains a failing structural criterion.

Card-t-b independent ungrouped ORDER revision: source-ID-checked native/public
`count(*) FROM t2 ORDER BY sum(x)` scalar/EXISTS/IN and LIMIT 0 now match
with ORDER-only AggInfo lowering. The generic completed-child opcode relocation
is still present and the structural assertion remains red (19/20 focused).
This updates the earlier independent ORDER exclusion, not the whole compiler
ownership finding.

#### card-t-b zero-source aggregate child routing (revision, 2026-09-30)

Pinned 3.53.4 `select.c` tag-select-0820 and `expr.c:sqlite3CodeSubselect`
contradict routing a no-FROM aggregate result through ordinary expression
lowering: no-FROM count/sum failed at execution there. The aggregate producer
now receives the enclosing destination and emits its single finalized row,
including count zero when WHERE rejects the candidate. Source-ID-checked native
and typed public checks cover scalar/EXISTS/IN, LIMIT 0, names and reset. This
does not retire the generic completed-child relocation or establish full
compiler ownership; the focused structural assertion remains red.

#### card-t-b HAVING admission follow-up (revision, 2026-09-30)

The prior no-FROM aggregate child entry still excluded HAVING despite its
producer's existing finalize-then-HAVING branch. Pinned `select.c:sqlite3Select`
tag-select-0820 checks HAVING after `finalizeAggFunctions` and before
`selectInnerLoop`; `expr.c:sqlite3CodeSubselect` consumes the same destination.
The entry now admits this bounded slice. Source-ID-checked native/public typed
cases cover false HAVING, false WHERE plus HAVING, LIMIT 0 and two resets.
Focused 19/20 remains red only for generic completed-child relocation; no
claim of completed compiler migration.

#### card-t-b zero-source aggregate ORDER admission (revision, 2026-09-30)

After the HAVING admission, the scalar child entry still rejected independent
ORDER for no-FROM aggregates despite the producer's existing AggInfo register
allocation. Pinned `select.c:sqlite3Select` tag-select-0820 produces a single
accumulator row; `resolve.c:resolveSelectStep` still diagnoses invalid ORDER
ordinals. Source-ID-checked pinned native versus public typed Mem/Exists/Set
and LIMIT 0/HAVING/WHERE cases match across two resets. Generic child opcode
relocation and the structural assertion remain red; no whole-engine parity
claim follows from the bounded public differential.

Card-t-b revision — zero-source nonaggregate independent ORDER: the earlier
no-FROM scalar gate required an ORDER projection match and rejected valid
`ORDER BY 8+0`. Pinned `resolve.c:resolveSelectStep` validates every term
before `select.c:sqlite3Select` emits the one candidate into the enclosing
Mem/Exists/Set destination. The bounded child now resolves all keys before
emission, retaining ordinal/name errors at prepare; public pinned cases test
typed rows, metadata, reset/finalize and errors. This does not resolve the
remaining generic completed-child relocation or its structural test failure.

Card-t-b revision — zero-source grouped child: earlier scalar routing rejected
GROUP BY without FROM even though the grouped aggregate producer already owns
sorter/accumulator and destination construction. Pinned `select.c:sqlite3Select`
grouped WhereBegin admits one row only on true WHERE. The grouped producer now
routes false WHERE to SorterSort instead of an absent `Next` and the expression
child invokes it in its enclosing builder. Source-first public comparisons cover
typed scalar/EXISTS/IN values, LIMIT 0, names, reset/finalize. The generic
completed-child relocation and its structural failure remain unresolved.

Card-t-b revision — outer LIMIT/OFFSET on bounded zero-source derived count:
the parent-owned aggregate producer previously rejected outer limit and
fell through to an alias-as-table error. Pinned `select.c:sqlite3Select`
computes the limiter at each SELECT entry: inner limit gates input to count,
outer limit gates its final destination. Parent builder now owns both. Source-
first public scalar/EXISTS/IN typed/name/reset comparisons pass; structural
completed-child relocation assertion still fails and broader derived aggregate
migration is pending.

Card-t-b revision — HAVING on nonflattenable zero-source derived count: the
parent producer previously rejected HAVING and misresolved the derived alias
as a schema table. Pinned select.c tag-select-0820 finalizes count before
HAVING and publishes only accepted rows. Bounded parent-owned translation
now uses the finalized register and existing expression lowering; native-first
public typed/reset cases pass. General derived aggregate source and generic
completed-child relocation remain open.

Card-t-b revision — pinned resolve.c validates ORDER terms before the
ungrouped aggregate's sorter is suppressed in select.c. Parent-owned
zero-source derived count with HAVING resolves ORDER keys against a transient
derived-result schema, including qualified/unqualified derived column names,
and SQLite prepare errors in the enclosing compiler. That schema is only a
resolution adaptation; general materialized derived aggregates are not
migrated. Generic completed-child relocation remains.

Card-t-b continuation — pinned select.c tag-select-0820 counts only
WHERE-accepted derived rows, finalizes on empty input and applies HAVING after
finalization. The parent-owned one-candidate zero-source derived count now
resolves outer WHERE on the transient derived result and evaluates it after
inner producer gates, before AggStep. Invalid WHERE names and aggregate misuse
are preparation errors even with LIMIT 0. Native/public typed/reset/error
comparison passes; materialized derived scans and generic splice remain red.

Card-t-b continuation — the one-candidate derived-count producer previously
assumed a one-column row, contradicting pinned select.c projection and
sqlite3ColumnsFromExprList. It now evaluates all producer projections and binds
outer WHERE to their individual registers under resolve.c's unique transient
names. Source-ID native/public two-column, duplicate-name, empty/LIMIT,
HAVING and error probes pass; this is not materialized table-derived aggregate
support and the generic relocation remains red.

Card-t-b continuation — zero-source derived count previously rejected inner
ORDER and fell through to nonexistent physical table `d`. Pinned resolve.c
validates ORDER before select.c sorts: the at-most-one producer candidate needs
validation but no runtime sorter. Parent builder now admits that bounded
producer. Native/public typed/reset/ordinal/name-error tests pass; generic
completed-child relocation and multirow materialization remain red.

Card-t-b continuation — inner DISTINCT was previously excluded from the
parent-owned zero-source derived count and attempted physical lookup of the
transient alias. Pinned selectInnerLoop only suppresses a result already seen;
one no-FROM candidate cannot repeat. The bounded parent producer now admits
DISTINCT and still validates inner ORDER/columns at prepare. Native/public
Mem/Exists/Set typed/reset/error probes pass; multirow DISTINCT and completed
child relocation are not resolved.

Card-t-b continuation — bounded zero-source derived accumulator previously
counted only row cardinality (`count(*)`); pinned func.c countStep distinguishes
NULL arguments from zero-argument count. Parent builder now supplies one bound
`count(expr)` argument through AggStep and resolves derived names at prepare;
matching HAVING uses finalized output. Source-ID native/public NULL,
Mem/Exists/Set, reset and error comparisons pass. Different HAVING aggregates,
materialized multirow derived production and generic relocation remain red.

Card-t-b continuation — previous count(expr) route reused only projected
aggregate in HAVING and incorrectly treated another count argument as
unsupported. Pinned select.c AggInfo collects result and HAVING identities
before stepping; bounded parent builder now allocates, steps and finalizes each
distinct count on accepted one-candidate rows. Native/public NULL, mixed
HAVING, empty input, Mem/Exists/Set/reset/error cases pass. Non-count variants,
multirow materialization and generic completed-child relocation remain red.

Card-t-b continuation — the parent-owned one-candidate derived count branch
now admits one-argument DISTINCT count and tracks it separately from ordinary
count in result/HAVING. Pinned select.c uses a distinct ephemeral set before
AggStep; at most one accepted producer row cannot duplicate an earlier key.
Native/public NULL, mixed HAVING, empty input, Mem/Exists/Set and preparation
error probes pass. Multirow distinct and generic completed-child relocation
remain red.

Card-t-b continuation — bounded derived count previously rejected FILTER
aggregates and fell back to nonexistent physical derived alias. Pinned
select.c:updateAccumulator gates each AggInfo entry before argument/distinct/
step, so parent builder now emits per-count FILTER and preserves separate
FILTER-aware HAVING identities. Native/public NULL, mixed DISTINCT/FILTER,
LIMIT 0, Mem/Exists/Set, reset and prepare-error probes pass. Materialized
multirow derived sources and completed-child relocation remain red.

Card-t-b continuation — parent-owned one-candidate derived count now admits
aggregate ORDER keys with an argument. Source select.c:updateAccumulator
would sort before stepping; at most one accepted count argument cannot be
reordered, though ORDER keys are bound/coded and distinct ORDER identities
retained. Native/public NULL, FILTER/HAVING, empty input, Mem/Exists/Set and
prepare errors pass. Multirow ordered aggregate and completed-child relocation
remain red.

Card-t-b continuation — parent-owned one-candidate derived accumulator no
longer hardcodes count for result/HAVING: it emits sum/avg/total using the
translated aggregate VM and keeps names in identity. Native/public typed
INTEGER/REAL/NULL, empty input, mixed HAVING, FILTER/DISTINCT, Mem/Exists/IN,
reset and invalid names pass. Generic completed-child relocation and multirow
materialization still red.

Card-t-b continuation — one-candidate parent-owned derived aggregate now
also dispatches min/max result and HAVING through translated VM extrema with
argument collation, unlike prior hardcoded count/numeric name list. Native/
public integer/text/NULL, empty producer, FILTER/HAVING, Mem/Exists/IN,
reset and preparation error cases pass. Multirow materialization and the
generic completed-child relocation structural failure remain red.

Card-t-b continuation — single-event derived accumulator now retains a full
argument vector and routes group_concat/string_agg through existing VM
aggregate implementations. Native/public TEXT/NULL, empty, two-argument,
FILTER/DISTINCT/ORDER, mixed HAVING, Mem/Exists/IN, reset and prepare errors
pass. Completed-child relocation and multirow derived sorting still red.

Card-t-b continuation — parent-owned one-candidate derived accumulator now
resolves a GROUP BY on the no-FROM inner producer and emits its zero/one group
through the existing row gates. Pinned native/public typed Mem/Exists/IN,
WHERE-eliminated group, ORDER/LIMIT, outer HAVING, reset and GROUP BY name/
ordinal/misuse errors pass. Inner HAVING, multirow grouping and completed-child
relocation remain red.

Card-t-b next continuation — a nonaggregate HAVING over a single-candidate
no-FROM GROUP BY derived source is resolved at prepare and filters its projected
group before producer OFFSET and outer aggregate step. Source-ID native/public
accepted/rejected/NULL, typed Mem/Exists/IN, OFFSET, two reset cycles and
missing-name error comparisons pass. Inner aggregate HAVING, multirow grouping
and completed-child relocation remain red.

Card-t-b continuation — the no-FROM one-group derived producer has a distinct
inner count(*) accumulator for aggregate HAVING, finalized before HAVING,
producer OFFSET and outer AggStep. Source-ID native/public accepted/rejected,
WHERE-empty group, typed Mem/Exists/IN, mixed predicate, ORDER/LIMIT/OFFSET,
reset and missing-column errors pass. Other inner aggregate functions and
multirow grouping, plus completed-child relocation, remain unmigrated.

Card-t-b continuation — distinct inner HAVING aggregate registers now carry
FILTER, argument vectors, AggStep and AggFinal for the single-candidate
no-FROM GROUP BY producer. Native/public typed count(expr), FILTER/DISTINCT,
numeric/extrema/string NULL/collation, Mem/Exists/IN, reset and name-error
probes pass. Multirow aggregation, aggregate ORDER and completed-child
relocation remain unaddressed by this bounded migration.

Card-t-b continuation — inner HAVING aggregates on a single-candidate
no-FROM grouped producer bind ORDER keys before argument/step, retaining
prepare-time invalid-key errors even with LIMIT 0. Native/public typed
ordered string/numeric, NULL, IN and reset checks pass. This is not a
multirow aggregate sorter or removal of completed-child relocation.

Revision (card-t-b, multirow count): a nonaggregate ordinary-table derived
producer feeding uncorrelated `count(*)` now uses parent-owned scan/sorter
row events, LIMIT/OFFSET and finalization instead of attempting to open its
alias as a physical table. Pinned oracle/public cases cover the bounded
composition. General materialized derived iteration and the scalar fallback's
completed-child relocation remain open; the structural SELECT assertion still
fails. This revision does not update other baseline predictions by inference.

#### card-t-b multirow projected-argument revision (2026-09-30)
Previously the bounded ordered/limited multirow derived producer fed only
`count(*)`. Its result-register destination now steps a directly resolved
projected derived column for count/sum/avg/total; pinned oracle and public
INTEGER/REAL/NULL, LIMIT 0 name error, IN and reset probes agree. Streaming
is limited to this single-pass consumer; other materialization and completed-
child relocation remain red. Focused 19/20 and broad SELECT 33/34 still fail
the pre-existing completed-child structural assertion, not the new typed cases.

#### card-t-b multirow extrema revision (2026-09-30)
The bounded ordered/limited multirow projected-column consumer now also
steps `min/max` with the aggregate argument's collation, using the same
parent-owned destination. Pinned source ID/native and public probes agree
on INTEGER/NULL, IN/EXISTS, LIMIT 0 invalid names, names and reset. This is
not multirow group or sorter ownership. Focused 19/20 and SELECT 33/34 still
fail the earlier completed-child relocation structural assertion.

#### card-t-b expression-argument collation correction
A new pinned oracle/public case found the bounded derived aggregate argument
binder lost implicit collation when rewriting a projected column to a register:
RTRIM `max(d.z)` returned `q ` instead of pinned `q`. Selecting collation
from the unlowered argument and resolved projected descriptor repairs the
bounded branch; expression `d.z||''` remains BINARY and explicit COLLATE
wins. Public focused and broad SELECT checks still retain only the existing
completed-child relocation structural failure (19/20, 33/34); general
SELECT compiler ownership is not inferred.

#### card-t-b bounded derived FILTER revision
`select.c:updateAccumulator` checks FILTER (false or NULL) before coding the
argument and stepping. The derived-row `aggregate-expression` destination now
codes that row gate; count(*) without arguments also uses it, retiring the
unused `count-step`/`aggregate-step` variants. Pinned/public typed FILTER,
empty, invalid name and reset cases pass. Focused SELECT 19/20, broad 33/34
still fail only the generic completed-child relocation structural check;
full SELECT compiler ownership and materialization are not inferred.

#### card-t-b bounded derived DISTINCT revision
The single-pass derived aggregate destination now follows pinned
`resetAccumulator`/`updateAccumulator`/`codeDistinct`: argument-collated
per-statement ephemeral cursor, FILTER before argument, duplicate gate before
AggStep. Pinned/public typed, RTRIM, FILTER, LIMIT 0 name error, Mem/IN/
EXISTS, and two reset cycles pass. Focused SELECT 19/20 and broad 33/34
still fail only the pre-existing completed-child relocation structural check;
no general aggregate sorter or SELECT ownership follows from this revision.

#### card-t-b bounded multirow derived aggregate ORDER revision
Pinned `resetAccumulator`/`updateAccumulator`/`finalizeAggFunctions` order
sorter sequence now maps into the single-pass uncorrelated derived-row
aggregate destination: producer gate, FILTER, key, argument, DISTINCT,
insert, drain/AggStep/AggFinal. Source-ID/public typed ORDER/FILTER/
DISTINCT, empty, Mem/IN/EXISTS, LIMIT 0 key error, metadata and two reset
cycles pass. This is only a single-argument bounded producer, not general
aggregate ORDER or full SELECT compiler ownership. Completed-child
relocation structural assertion remains red (focused 19/20, broad 33/34).

Card-t-b continuation — single-argument group_concat of multirow derived
producer now consumes the same parent-owned aggregate ORDER row destination
as sum/count, with default separator. Native/public ORDER, FILTER/DISTINCT,
empty and IN probes pass. Two-argument string aggregation and generic
completed-child relocation remain open; focused structural assertion red.

Card-t-b revision — preceding one-argument-only derived-row ORDER mapping
now uses a vector of aggregate arguments, matching select.c's `nArg` sorter
payload/drain and func.c's separator argument. Pinned/public two-cycle
string_agg/group_concat separator, FILTER, NULL, IN and bad-second-name
probes pass. This supersedes the bounded two-argument exclusion, not the
remaining generic completed-child relocation structural failure.

Card-t-b revision — bounded uncorrelated derived-row aggregate destination
gates outer WHERE before aggregate FILTER and step (pinned `select.c` non-GROUP
`sqlite3WhereBegin`/`updateAccumulator`). Source-ID oracle and public two-reset
typed/invalid-name cases pass. Earlier exclusion of outer WHERE for this route
is superseded. Generic completed-child relocation remains live and structural
assertion red. The preceding two-argument exclusion is likewise superseded
for this bounded route by the argument-vector revision.

Card-t-b revision — bounded derived-row aggregate consumer now owns an outer
limiter distinct from producer LIMIT/OFFSET: source `select.c` tag-select-0650
precedes scan and `selectInnerLoop` emits post-finalization. Pinned oracle and
public typed/reset/error probes pass. Earlier outer-limit exclusion is
superseded only for this route. Generic completed-child fallback and its
structural assertion remain red.

Card-t-b revision — the existing bounded derived-row aggregate destination
now admits outer ORDER binding: pinned `resolve.c:resolveOrderGroupBy` checks
EList alias/ordinal and source expressions, and the non-GROUP
`select.c:sqlite3Select` finalization emits one row, without a second sorter.
Pinned ctypes and public two-reset typed/preparation probes pass. Earlier
outer-ORDER exclusion is superseded only for this route. Generic completed-
child relocation and its structural assertion remain red.

### Mixed IN/range future-RHS revision (card-s-c-d-j)

The prior selected-access coverage did not prove execution of a path whose RHS
comes from a later FROM source. Pinned read-only SQLite returns `(1,2,2)` for
`x JOIN y INDEXED BY m_abc ON y.a IN (x.a,z.a) AND y.b>=z.b AND y.b<3
JOIN z ON z.id=2 WHERE x.id=1`; the prior TS lowerer returned no rows despite
planning `[x,z,y]`. Entry-only reordering produced an extra `(1,2,4)` because
Next still advanced the source-order cursor. The current lowerer uses selected
ordinals for inner-join entry, readiness and continuation; the three-encoding
public test passes. LEFT/RIGHT source-order NULL continuation is not reordered.
Private chosen-work counts, physical DESC and general forced-index boundary
cases remain unqualified by this fix.

Follow-up validation corrected an unrelated latent standalone SELECT register
range off-by-one exposed by the broader join check: sorted three-source
USING/NATURAL and RIGHT/FULL cases attempted `Copy` into a nonexistent Mem.
The standalone allocator now reserves `count` registers from `registers+1`,
consistent with `select.c:selectInnerLoop` and the shared builder. The 92-case
broader join/in-range command now exits 0; its earlier 3 failing cases remain
recorded as the pre-fix result, not erased by typecheck.

### Second checkpoint attribution (2026-10-01, [[card:card-s-c-d-h]])

First SELECT checkpoint includes the minimal shared joined reverse and
insertion-order producer/consumer closure, not exclusive SELECT ownership.
Remaining selected nullable-start, cursor NullRow/reset and single-source
reverse semantics belong to the incremental WHERE checkpoint. Existing
completed-child parent-owner structural test remains red; no migration or
broad compatibility acceptance is implied. Current staged-only validation
is recorded in the card delivery status with individual process exits.

The incremental test allocation includes joined/physical linked identity and
NULL public/native companions, joined selected NULL guard, nullable range
and unbounded reverse native probes. The c&1 test companion remains outside
the index with separately attributable bitwise lowering; other arithmetic
implication assertions and native captures are retained.

### Review-v12 selected physical invalidation correction

The inherited clearPosition invalidated decoded state but left IndexCursor
physical #indexPosition live. The owning override now uses #set(null), matching
`btree.c:sqlite3BtreeClearCursor` CURSOR_INVALID and retaining generation/borrow
invalidation. Actual positioned-cursor regression failed before repair and
passes after for Next/Prev and fresh boundary/seek. This closes that narrow
state divergence only; completed-child SELECT ownership and stale GROUP BY
admission-test gaps remain separate and unwaived.

#### Current correction: forced/repeated CTE fallback (bounded)
Current compileCteDerivedSourcesFallback finished-child copying retired into
shared builder semantic producer destinations, CteUse-keyed parent fill/reuse.
Native/public LIMIT2/0/OFFSET2/repeated CROSS and lexical missing child pass;
selected300/300 not integrated acceptance. Computed/filter probes remain outside
this fallback admission; root WHERE0..30 allocator reservation/source0 lexical
caller defect and broader metadata/error/binds/resources remain unresolved.
#### Linked expression carrier first consumer correction
Joined scalar aggregate consumer now consumes resolve.ts carrier rather than
local reduction walker/name-use search. Source/depth/merged metadata preserved;
304 selected tests and pinned physical correlated JOIN evidence pass. Other
walkers/NameContext flags/aggregate carrier and NULL/literal binder admission
remain unresolved, not architecture acceptance.
#### Second linked carrier consumer correction
Ordinary scalar subquery binder duplicate traversal/search retired into carrier
and shared binding; explicit scalar-leaf mode preserves NULL/literal/CASE/
BETWEEN/prebound columns, first joined consumer remains bounded. Native two
consumers and selected490 pass. Window substitution/special aggregate binders,
full linked flags/depth/metadata/error/resource intersections remain unresolved.
#### Derived register-phase carrier correction
Actual derived scalar ALL aggregate predicate/arguments consume shared resolved
carrier with explicit producer-row register location vs lexical cursor contract.
Local bindDerived/argument walker retired. Not AggInfo finalized-row or rewritten
window identity ownership. Prior literal predicate rejection retained, producer
NULL admitted; native/type/selected496 pass. Other consumers, phase/flags/merged
metadata/resource/limit/error intersections and source0 admission remain debt.
#### Window FILTER consuming handoff correction
Owned FILTER expression carrier captured at rewrite construction and consumed by
shared window-filter cursor/register binding; local walk/search retired, source
WHERE walker remains. Physical typed NULL/COLLATE/EXCLUDE/empty/errors/reset and
selected502 pass. Retained FILTER native-supported probes returned public temporary;
not claimed migrated admission. Other rewritten identities/AggInfo remain debt.

#### Window original-source carrier correction
Original producer edge captures ON/WHERE carriers and actual physical loop
consumes shared window-source binding before Yield; local traversal/search
retired. Distinct FILTER/source policies and delegated retained/group/recursive
owners preserved. Native/type/selected508 pass, including WHERE first errors;
AggInfo/other identities/source0/root seam and exhaustive intersections remain.

#### Compound aggregate phase ownership correction
Standalone forRow name traversal retired into linked argument/order carrier and
shared source-row location binding; accumulator/finalized-output consumed by
real AggStep/AggFinal/output. Other aggregate lower/binders remain live debt.
Native/type/selected518 pass; LIMIT0 public temporary before caller remains
explicit gap, not passed errors or scope narrowing.

Ordinary original-result phase implementation is partial: linked arguments/ORDER
and accumulator/output locations are live, but preceding spelling resolve and
FILTER/alias lowering still run. Native/type30 pass does not establish retirement
or full owner fidelity; REAL/ties/errors/reset intersections require strengthening.

Ordinary original-result partial note superseded on that edge: preceding spelling
binding retired, linked args/FILTER/ORDER and GROUP payload cursor binding live.
Initial rowid payload=-1 caused GROUP metadata crash; owning location fixed to
IPK slot. native/type527/diff + exact error9 pass. Alias HAVING/ORDER/WHERE/GROUP
and subquery binders remain, so not complete AggInfo owner or full acceptance.

#### R1 bounded entry continuation (card-t-b, current dirty work)
Unlimited unordered SELECT-origin UNION ALL now receives builder, parameter
state and output destination from production compileSelect; actual existing c
arm consumers append through compileCteUnionAll's shared overload. Entry emits
one final Halt/Program; errors propagate without fallback. This supersedes the
independent-generator observation only on that entry branch. R1 remains open
for ordered/set/recursive ownership and admission phases; recursive ResultRow/
Halt rewriting at vdbe.ts ~1816 is still live. No physical0..30 seam migration.

R3 partial repair: compound lexical LIMIT0 errors now pass; prior SrcList carrier
loss repaired so source0 reaches materialized producer. LIMIT0 still rejected
by that producer's admission; current R3 remains red, not unsupported waiver.

R3 bounded failures corrected: linked source0 retained identity reaches existing
producer; normal parent limit/output sequencing, compound prep lexical errors.
Initial three UTF8/16 derived-join regressions from flattened annotation retention
corrected at parser carrier owner. Native/type536/diff pass. R2 aggregate phases,
full contract matrix, root WHERE seam/retained FILTER history remain unresolved.

R2 ordinary alias edge updated: live lowerAlias removed; HAVING/unmatched ORDER
linked resolver substitution feeds shared lowerResult phase entry. Native/type547
and R3 regression pass. GROUP/WHERE/subquery/parent and expr.c directMode/sorting
payload/REAL/RIGHT-null aggregate-column ownership still incomplete; not parent
approval/full delivery. Initial type failure fixed, earlier red expectation
shadowing corrected from native empty behavior rather than changing product.

R2 ordinary source WHERE edge updated: resolve(whereTree) replaced by live linked
source-row carrier binding before sorter capture/AggStep. Native/type555/diff pass;
GROUP/ON/subquery/parent walkers and actual AggInfoColumnReg/directMode/sorter
REAL/RIGHT-null relationships remain original obligations, not done or approval.

Third-checkpoint regressions corrected in current workspace: ordinary compound
aggregate streams rather than charging ephemeral source rows; retained aggregate
child routes original parent SRT before generic projection rejection. Exact51 and
shared424/type pass. Obsolete copy/ephemeral structural assertions reconciled to
live shared-builder coroutine owner with no-splice checks preserved. Initial type
errors and shared423/424 stale assertion failure recorded; isolated frozen test
handoff/export remains d-owned, no manifest regeneration. R2 obligations paused,
not full approval or delivery.

### Third isolated checkpoint attribution

Shared SELECT/WHERE prerequisites include lexical linked carriers, true-leaf
lookup, noVisibleRowid, only two Mem flexnum relationship hunks, expression
affinity/collation and coupled RIGHT bound/entry state. Physical cursor 0..30
reservations and f5bb86 invalidation remain; no broad nTab migration.
Compound aggregate source now streams with parent Coroutine/Yield/EndCoroutine
and retains parent Mem/Exists/Set/LIMIT; no budget increase. This is bounded
checkpoint evidence, not broad R1-R4 or optimizer acceptance.

### Third checkpoint literal C1–C6 bounded bridge (2026-10-02)

This maps root's literal cases, not B1–B5 and not a unified compatibility
denominator. Pinned source3.53.4 source ID bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc;
Chinook SHA2567651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15.
Native capture and public bridge are test/conformance/capture-canonical-c1-c6-checkpoint.py,
cases/canonical-c1-c6-checkpoint.json and canonical-c1-c6-checkpoint.test.mjs.
The capture takes LIBRARY DB CASES arguments; checks pinned identity and database
digest. Native C API column_type/int64/double/text/name and public APIs compare
INTEGER/REAL/TEXT, raw IEEE bytes, columnText and names, then reset. Public
requires CHINOOK_DB. Results:12 named obligations pass, not twelve independent
canonical cases or proof of all owner coverage.

| Literal | Existing owner/path | Original result and separate controls |
|---|---|---|
| C1 | l/m: expr.c sqlite3CodeSubselect LIMIT and select.c aggregate; select-scalar-child, expression-subquery-chinook | COUNT ordered LIMIT1 bigint4; MIN control bigint10. Control must not replace original. |
| C2 | j/m: select.c selectInnerLoop SRT_Coroutine, vdbe Yield; select-derived-values-parent, subquery-view-foundation | derived VALUES1,2,3 are three INTEGER rows; paired descending rows 2,b then1,a. |
| C3 | m: where.c IN terms/wherecode.c iterator, select.c GROUP; aggregate-group-chinook-regressions, selected-in-integration | literal Track grouped rows1,10 and2,1 INTEGER; derived InvoiceLine group_concat IN/OR individually captured equal TEXT sequences. Exact original group_concat SQL absent, no original credit. |
| C4 | p/j: vdbe.c arithmetic, util.c sqlite3FpDecode, printf.c altform2; mem-numeric, Mem/printf owner tests | maxint+1 columnText/CAST/printf 9.2233720368547758e+18; overflow Inf; tiny9.9998886718268301e-321; public raw IEEE equals native, no REAL-to-INTEGER flattening. |
| C5 | l/m: resolve.c lookupName correlation depth, expr.c subselect, select.c count; expression-subquery-chinook, select-scalar-linked-owner | Artist1 AC/DC and INTEGER2, not merely derived sample. |
| C6 | m/p: func.c substr, select.c group/order/name; aggregate-group-chinook-regressions | fresh typed TEXT years2021..2025 and INTEGER counts83,83,83,83,80; names y and COUNT(*), two executions. |

First checkpoint includes SELECT entry/producer and explicitly SHARED minimal
Mem/schema/resolve/affinity/collation/RIGHT entry prerequisites, not exclusive t
ownership. Raw patch3ea28e05 tree is handoff, not delivered tree: c&1 companion
restored to HEAD's bounded exclusion, unrelated bitwise remains dirty. Source
C-to-TS comparison of selectInnerLoop SRT_Coroutine matches parent Yield instead
of ephemeral insertion. Compound aggregate Mem/Exists/Set dispatch precedes
projection gate and parent final-row LIMIT; 24-byte lifecycle retained without
budget increase. Physical0..30 and f5bb86 cursor invalidation preserved.

Local disposable source checks: shared424/424, selected175/175, prerequisite50/50,
61 pinned SELECT/window native scripts, typecheck0. Advanced-index manifest first
failed with two missing upstream test-file errors in git archive; read-only pinned
source symlink supplied and rerun11/11. No build script exists; tsconfig noEmit is
the configured type/build boundary, not a fabricated npm build pass. Earlier
h39 runtime/structural reds remain historical failures superseded only by these
changed-source checks. No broad R1–R4, STAT4, optimizer or lifecycle acceptance.

### Third incremental WHERE / stat seam validation (2026-10-02)

The selected WHERE/Btree/index/private-state implementation seam is already
committed in f5bb86 and earlier checkpoints; this incremental checkpoint does
not invent extra source changes or import bitwise work. SELECT's RIGHT bound
expression carrier and entry initialization are explicitly shared first closure.
Existing source owners: where-plan.ts stat1 candidate/cost, schema.ts stat loader,
vdbe.ts selected index/IN ordering and btree.ts cursor invalidation. Pinned
where.c whereLoopAddBtreeIndex/stat1 cost and wherecode.c sqlite3WhereCodeOneLoopStart
IN seek/continuation remain comparison references. No STAT4 or optimizer expansion.

Independent local capture-in-range-stat.py --library pinned-library exit0 matched
all SIX frozen cases/in-range-stat-native.json snapshots (before/after STAT1 x
UTF8/UTF16LE/UTF16BE), with image hashes checked by capture; exact stat-choice
SELECT id WHERE a=1 AND b IN(13,14) ORDER BY id and forced t_a/t_ab controls.
Fresh stat-choice public tests6/6 assert existing current unforced choice and
output; before t_a (native no sorter/0 IN probes), after t_ab (native sorter/2
IN probes). TS accounting is implementation control, not native EQP/work identity.
Historical parked sorterRows4-vs0 is not assumed current red; no counter waiver.
Original c-e committed coverage rerun must be reopened only after actual commit.
