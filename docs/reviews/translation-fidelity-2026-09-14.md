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


### R1 partial Boolean implication correction (2026-10-02)

`expr.c:exprImpliesNotNull` (6698–6768) distinguishes true-only from non-NULL proof and has no TK_AND/TK_OR cases. `where.c:whereUsablePartialIndex` (3700–3735) consumes that proof before choosing a partial index. The former TS unconditional AND recursion under NOT was unsound: NULL AND false is false, so NOT can be true while the partial predicate column is NULL. Nested AND now yields no proof; top-level conjunct splitting remains in `analyzeWhere`. Query-side OR is **not a direct translation of this switch**: the bounded true-only extension requires both arms independently prove the target and is disabled in every seenNot/non-NULL context. This compensates for absent upstream OR-derived analysis terms in the represented scalar path, rather than installing general OR optimization. If OR is true at least one arm is true; requiring both true-only proofs is sufficient. It cannot establish non-NULL OR operands (NULL OR true is true). Pinned public capture confirms `a=1 AND (c>0 OR c<0)` still admits forced p_live; removing this positive branch would reject a represented valid proof. Index-predicate-side OR remains a separate pinned `sqlite3ExprImpliesExpr` branch.

Verified pinned 3.53.4 native read-only fixture behavior in UTF-8/UTF-16LE/UTF-16BE: `a=1 AND NOT(c>0 AND a=2)` and reversed arms reject forced p_live at prepare and return INTEGER ids 1,2 unforced/NOT INDEXED. Parameter neighbors `[1,1]` and `[NULL,2]` return empty controls. The public regression checks both orders, reset/rebind, NULL, forced preparation rejection, zero unsafe index seeks, damaged partial-root off-path isolation, and a valid c>0 selected neighbor. No output filtering is used to compensate for an incomplete index. Frozen 24/30 selected-access accounting is unchanged; no general optimizer or complete implication claim follows.


#### R1 ordered enclosing entry ([[card:card-t-b]])
R1 current continuation: bounded unlimited single-column ordered table UNION ALL entry now passes parent builder/parameters/output to existing shared composer and publishes one Program. Ordinal range diagnostic repaired at compound owner before merge-key eligibility. This supersedes independent ownership only on this entry slice; ordered general/set/recursive/ordinary ownership and phase obligations remain open. c828 streaming/destinations unchanged; recursive producer.ops ResultRow/Halt rewrite still live.

R2 bounded GROUP source-key owner update: ordinary compileAggregateSelect GROUP
keys now use resolvedExpressionCarrier + shared bindResolvedExpression with
aggregate resultLocation (linked SrcItem/cursor and IPK physical payload slot),
not resolve(aliasExpression(...)) spelling lookup before sorter capture. Deleted
now-unused aliasExpression walker; resolve remains live for ON/subquery owners.
Pinned resolve.c2081 GROUP ownership and expr.c4977 TK_AGG_COLUMN/select.c8579
source-key capture comparison supports this edge only: full directMode /
AggInfoColumnReg / sortingIdxPTab/iSorterColumn/REAL/RIGHT invalid-null and
source→sorter→bare/accumulator/final relationships remain original R2 debt.
Native source+alias/full-context tests and public phase/source/alias28 pass;
current type/shared aggregate/select/resolver + digest-pinned Chinook487 pass.
Earlier broad484/485 lacked CHINOOK_DB, rerun with existing pinned fixture, not
suppression. c828 streaming/budget/destinations and b547 ordered shared entry
remain unchanged. No new feature/admission/budget/WHERE reservation change.
GROUP ordinal semantic production and ON/subquery/parent consumers remain
explicit dependent seams; do not claim this bounded key edge completes R2.

R2 aggregate ON source-row update (supersedes preceding live-resolver census):
compileAggregateSelect grouped and ungrouped ON now consume aggregatePlan's
resolved ON expression carrier through shared bindResolvedExpression and
resultLocation, retaining linked lexical source identity/IPK/cursor/affinity.
Pinned select.c504+ ON tagging and resolve.c1062+ join-expression scope own
resolution, not a second spelling walker at predicate emission. Existing
predicate/reject-level/LEFT match/null-row/WHERE ordering and subquery callback
contracts are unchanged. Actual post-migration census finds no external calls
to the local recursive resolve walker: it was deleted with its stale comment.
The earlier claim that it remained a subquery consumer was incorrect; aggregate
subquery emission has its own linked context path. This is not proof that all
nested/parent contexts or AggInfo phases have migrated. No scope/admission or
private budget change. Native-first paired ON cases (grouped LEFT NULL/IPK,
ungrouped CASE/REAL/FILTER/DISTINCT/min bare tie) pass; focused31 and shared550
including canonical C1–C6, pinned Chinook, recursive destinations and private
lifecycle pass. Original full source→sorter→bare/accumulator/finalized column
ownership (expr.c4977 directMode/AggInfoColumnReg/useSortingIdx/iSorterColumn,
REAL extraction and RIGHT invalid-column NULL), GROUP ordinal production and
parent consumers remain explicit dependencies, not completed by this edge.


#### R1 recursive enclosing output entry ([[card:card-t-b]])
R1 bounded ordinary recursive queue entry now passes its parent builder/parameters/output to the existing queue producer; terminal Program publication belongs entry. This supersedes independent ownership only on that fallback queue branch, not specialized window/SUM/multiple-CTE paths. d238 genuinely removed completed-program SUM and zero-source derived COUNT rewrites (COUNT was not recursive); c846 linked ON migration preserved. Native/public outer LIMIT and LIMIT0 lexical-resolution admission gaps remain unresolved.

Current revision d outer-LIMIT repair supersedes b559/d241's two ordinary
recursive outer LIMIT admission/error findings: separate outer destination
limits preserve body decrement/restart and compile-time missing-column binding.
Native/public regression controls cover both reproduced gaps. This does not
supersede specialized recursive/set/ordinary ownership or R2 source/sorter/bare,
REAL/RIGHT-null/subquery/parent findings. Selected integration is not full R1–R4.

R2 grouped column-phase migration: compileAggregateSelect's linked binding now
attaches shared columnOwner/iAgg identity to actual column expressions. Grouped
payload production retains physical source-width layout; each payload column
owns iSorterColumn and saved bare accumulator cell. Shared expression emission
consumes directMode/useSortingIdx: source cursor before capture, sorter row
register+iSorterColumn for arguments/FILTER/local aggregate ORDER, saved column
cell for HAVING/output/unmatched ORDER after finalization. Removed independent
rowColumns/savedColumns recursive walkers and register-range/group-index identity
inference. select.c8579+ capture, updateAccumulator/reset/finalization and
expr.c4977–5027 TK_AGG_COLUMN govern the relationship. Bare saved-cell copies and
min/max tie change gating are retained. REAL sorter extraction copies into a
fresh Mem and emits RealAffinity only for iColumn>=0 REAL, not rowid; absent
column entry in phase lookup emits NULL. No RIGHT expression-index admission
claim: native iAgg>=nColumn NULL branch is represented but exact upstream
expression-index RIGHT invalidation producer remains unproved/dependent.
Browser VM adaptation: SorterData already decodes payload into contiguous Mem
registers rather than SQLite's pseudo-table cursor; sortingIndexRegister plus
owned iSorterColumn addresses that same row, preserving shared sorter budget,
async lifetime and Mem types. This replaces AST register rewrites, not a generic
evaluator. Native source/alias and focused phase/private tests41 passed; added
native-first BETWEEN/IN bare min tie + CASE REAL argument combination passes42.
Initial broad556 passed; fresh final offset-field refinement broad557 passed.
GROUP ordinal production, parent/subquery correlation phase contexts and full
AggInfo analyzer/index-expression relationships remain unfinished. No budget,
feature admission or public resource/lifecycle guarantee change; c828 streaming
private24 and d244 separate recursive counters remain intact.

Revision d after c855: ordinary GROUP integer ordinal now publishes selected
result-expression identity and aggregate group lowering consumes that carrier
instead of grouping by literal integer. d250 GROUP1 public divergence repaired;
not full analyzer/parent/subquery/RIGHT acceptance. d250 grouped derived compound
parent no-such-table:d divergence remains: specialized ungrouped stream isn't a
linked grouped source capture. No stale canonical blocker or scope reduction.

Revision d grouped-stream repair supersedes d250/253 grouped derived UNION ALL
no-such-table:d finding for bounded unordered/unlimited producer. Shared transient
binding/coroutine rows now feed existing grouped capture/phase consumers; no
shadow table/evaluator. Metadata uses resolved descriptors. WHERE/ordinal/HAVING/
local ORDER and private-entry cleanup controls added. Does not settle general
parent/subquery/RIGHT analyzer ownership or original full R1–R4.

R2 correlated aggregate EXISTS consumer repair (after d260): actual
compileAggregateSubquery EXISTS branch now obtains aggregatePlan.nested linked
select identity. Inner WHERE/ON reductions use shared resolvedExpressionCarrier
and bindResolvedExpression; local sources map to allocated inner cursors, outer
source identity maps through resultLocation to existing AggregateColumnOwner.
Deleted this branch's owners[] name/depth guessing and independent recursive
expression binder. Parent grouped HAVING (!directMode) reads saved bare cell;
source WHERE reads live source, sorter argument phase remains owner-selected.
expr.c analyzeAggregate7403+ source-column/nested traversal and TK_AGG_COLUMN4977+
plus resolve.c linked NameContext lookup and select.c capture/update/finalization
own this relationship. Existing sole-equality EXISTS ephemeral-key specialization
retains Once/KeyInfo/local materialization and probes with the same linked outer
phase; general predicate runs existing inner loops. Public native-first grouped
HAVING red returned [] instead of two INTEGER groups; now repaired. Additional
native controls for source WHERE, local alias shadow and sole equality were
captured after repair (not all native-first). Native source/alias, type, focused63,
changed-input broad664 including canonical/Chinook/index/private/recursive pass.
No new engine, budgets or root cursor remapping. d260 grouped coroutine and
ordinal, d247 recursive counters and c828 streaming private24 remain covered.
This is the EXISTS consuming slice, not full aggregate-subquery migration:
other scalar/IN contracts and full AggInfo analyzer/index-expression/RIGHT
invalidation remain incomplete. Retained producer ORDER/LIMIT composition is
separate coordination debt; no full R1/R2 architecture acceptance claimed.


#### R1 scalar/set enclosing entry ([[card:card-t-b]])
R1 continuation: final zero-source scalar/VALUES/set branch now passes enclosing builder/parameters/emitRow/output destination to actual compileScalarSelect and publishes terminal Program. This supersedes independent generator ownership only on that entry branch (including existing early owner-forwarding window/CTE paths); standalone callers and table/aggregate/specialized recursive public owners remain live. c864/d260/d247 carriers/recursive limits untouched; broader R1 architectural acceptance remains open.

R2 ordered scalar parent consuming migration: compileAggregateSubquery's
retained single-source ORDER BY/LIMIT1 SRT_Mem branch now binds actual result,
WHERE and ORDER reductions through nested resolved select/carrier identity.
Local source maps to its allocated cursor; outer reference maps via parent
resultLocation to AggregateColumnOwner source/sorter/saved phase. Removed only
this branch's independent local spelling/recursive walker. resolve.c linked
NameContext lookup, expr.c analyzeAggregate7403+/TK_AGG_COLUMN4977+ and
sqlite3CodeSubselect EP_VarSelect/Once branch govern actual consumers. Correlated
nestedPlan omits Once; each evaluation initializes NULL and reopens existing
sorter before reading local rows. Uncorrelated nestedPlan retains Once and
cached SRT_Mem. Existing read/WHERE rejection/Next/empty SorterSort/topN1/end
and shared async Mem/KeyInfo/private control remain unchanged; no new evaluator.
Native-first grouped nearest-row red (wrong no-such-column t.a) passes with
four distinct typed parent groups. Additional native controls captured after
repair (before paired public additions) cover source WHERE correlation, saved
output predicate with empty->NULL then populated groups, and local alias-shadow
uncorrelated cached scalar; types/names/reset/done/finalize retained. Native
source/alias, type/focused75 and changed-input selected broad670 pass including
b568 entry/canonical/Chinook/private/index/recursive. No entry edit or budget,
root reservation/admission guarantee change. c864 EXISTS/d260 ordinal+transient
sourceRegisters/d247 counters/c828 private24 preserved. This bounded consuming
migration does not complete scalar aggregate/IN/full nested depth, AggInfo
index-expression/RIGHT invalidation producers or general retained ORDER/LIMIT
composition. Parent architectural review remains revision_required.


#### R1 ordinary aggregate enclosing entry ([[card:card-t-b]])
R1 ordinary aggregate entry migrated to actual parent contract (not independent Program return); physical0..30 reservation preserved. Intermediate migration exposed parent admission decline for zero-source derived COUNT VALUES/compound, corrected producer parent state/destination/no-child-Halt contract. Source-phase c873/c864 and sourceRegisters d260 remain untouched. Table/window/specialized recursive enclosing entry and complete semantic preparation remain R1 debt; no architectural completion claim.

R2 scalar aggregate argument consuming repair: compileAggregateSubquery's
retained single-local-source aggregate scalar now binds actual aggregate
reduction/arguments via nested resolved identity and shared carrier/binder.
Local reference maps to inner cursor, outer reference through parent
resultLocation to AggregateColumnOwner live source or saved finalized phase.
Displaced local spelling/recursive argument walker removed. expr.c
sqlite3CodeSubselect EP_VarSelect guard, analyzeAggregate7403+ and
TK_AGG_COLUMN4977+ plus select.c resetAccumulator/update/finalize own state:
correlated invocation omits Once and initializes accumulator NULL each time;
uncorrelated retains Once. Empty Rewind goes to AggFinal, normal Next precedes
AggFinal. Same shared Mem/KeyInfo/async/error cleanup, no new evaluator.
Native-first SUM(local+parent) prepare-error red now passes distinct totals;
post-repair native-before-public controls source WHERE, REAL arguments,
local shadow/cache and NULL argument group then populated sums pass. Existing
runner checks types/names/two reset iterations/done/finalize. Type/focused81
pass. Selected broad676 has 25 failures (651 pass), NOT a green compatibility
claim: same-input disposable baseline with only vdbe pre-repair restored
reproduces all failing names across baseline suites. Existing enclosing
aggregate retained derived/COUNT composition failures require coordinated
follow-up; not waived as unsupported. No changes to b577 COUNT5268–5546/entry,
c873/c864/d260/d247/private/root seam. Full scalar/IN nested-depth/analyzer,
index-expression/RIGHT invalidation producers and retained composition remain
unfinished; parent revision_required. Phase NULL is not RIGHT producer proof.


#### R1 retained aggregate caller correction ([[card:card-t-b]])
Changed-input broad c882651/676 (25 failures) exposed b574 narrow parent retained producer admission/columns[] regression, independently reproduced without c882 edits. Unified existing richer coroutine producer onto parent contracts and removed narrow parent walker. Focused foundation+retained179/179 after production repair. Initial broad675/676 remaining stale COUNT structural guard assertion corrected to compound/VALUES exclusion; exact fresh final broad recorded in card status. No carrier rollback, budget inflation or scope waiver; remaining original R1 architecture debt unchanged.

R2 aggregate IN RHS consuming repair: retained one-column/one-local-source
compileAggregateSubquery IN branch now consumes nested resolved select/result
carrier through bindResolvedExpression. Local identity maps to allocated inner
cursor; outer maps via parent resultLocation to AggregateColumnOwner live or
saved phase. Deleted displaced local spelling/index/affinity column binder.
expr.c sqlite3CodeRhsOfIN3592+ EP_VarSelect and SRT_Set3711+ govern conditional
Once: correlated RHS reopens empty ephemeral set and recomputes child limits
per invocation; uncorrelated retains cached set. Existing OpenRead/Rewind,
OFFSET-before-insert, LIMIT-after-insert, Next/empty/end and shared InSet
probe/NULL/negation remain unchanged. Parent phase follows TK_AGG_COLUMN4977+
and linked resolve NameContext, not qualification text. Browser shared
Mem/KeyInfo/async/private cleanup unchanged, no new evaluator or admission
widening beyond correctly binding existing projected column contract.
Native-first grouped outer RHS red no-such-column t.a passes hit1/0/0/0;
post-repair native-before-public controls source WHERE, local shadow/cached
set, NULL-left empty LIMIT0 and LEFT-null-parent NOT IN prove distinctions.
Names/types/two resets/done/finalize and focused86/type/native source+alias
pass; fresh selected broad681/681 includes C1-C6/Chinook/private/index/recursive
and b unified compound aggregate repair. Previous c882 integration25 are
resolved by b583, not waived. No b583 compound/COUNT/entry or c882/c873/c864/
d260/d247/root reservation changes. Still unfinished: deeper aggregate lexical
ownership, full AggInfo analyzer/index-expression/RIGHT invalidation producers,
general retained ORDER/LIMIT/destination composition. NULL phase tests are not
RIGHT producer parity; selected tests are not whole-card architecture approval.


### Bounded lexical aggregate ownership repair ([[card:card-t-d]])
Pinned resolve.c1356–1378 assigns TK_AGG_FUNCTION.op2 to nearest referenced
SrcList NameContext (unreferenced count/constants stay local); expr.c7473
analyzeAggregate enrolls only matching walkerDepth. resolve.ts now publishes
function reduction→lexical depth separately from column location. Physical
ordinary SELECT entry consults that resolved ownership when its aggregate
exists only inside a scalar child; existing transient/set/window/recursive
preparation branches retain their owners. Resolver exceptions become public
SQLite errors before publication. General preparation migration is not done.

compileAggregateSelect enrolls nested outer-owned functions into enclosing
linked phase/AggStep/AggFinal entries before stepping. Nested SRT_Mem reads the
final accumulator through a local source existence loop, initializing NULL,
Rewind empty→end, WHERE failure→Next, first match Copy→end. It does not step an
outer function once per inner row. Local-owning scalar aggregate still resets
and steps its own accumulator. Browser reduction identity/depth map and shared
registers adapt upstream Expr.op2/pAggInfo/iAgg; no independent evaluator or
SQL-text substitution. Bare ungrouped result metadata now uses resolved result
descriptors rather than unconditional computed/null origins.

Paired select-aggregate-lexical-owner-native.py and .test.mjs retain native-first
ungrouped/grouped red cases and local-owning control; added native-before-public
empty scalar WHERE and REAL argument controls (after implementation). Five
public cases check exact types/origins, completion, reset and finalize. This is
bounded physical single-source scalar consuming coverage, not full lexical
ownership parity: deeper transient/ordered/limited/compound producers, general
AggInfo analyzer/index rewrite/RIGHT invalidation remain load-bearing. Missing
column phase NULL is not RIGHT producer evidence. Root0..30/private24/recursive
consumer/body LIMIT and peer b583/c891 consumers preserved. Commands, failed
hypotheses and final verification live in card status and lexical-owner-repair
work artifacts. No API scope or budget changes.

R2 lexical aggregate scalar-expression consuming repair ([[card:card-t-c]]):
d269 resolve.c1356–1386 aggregateUses depth and expr.c analyzeAggregate
matching walkerDepth enrollment unchanged. Actual scalar result carrier now
consumes enrolled aggregate leaf registers through optional aggregateOutput
on existing shared expression binder, before argument binding. Retired
whole-result sole-aggregate lookup/Copy restriction; linked composite
arithmetic/CASE/cast codegen runs only on qualifying local scalar row, otherwise
initialized NULL survives Rewind/WHERE rejection. Source local cursor and
parent saved/source binding retained. Mixed unenrolled aggregate leaves remain
atomic typed temporary; local aggregate branch still owns its accumulator.
No generic evaluator, new graph walker or broad physical/transient/no-FROM
preparation guard removal. Native-first ungrouped SUM(outer)+1=[1,17] and
grouped totals2/4/6/8; native-before-public empty scalar and multi-leaf CASE
REAL/overflow-short-circuit controls pass. Names/origin/types/two resets/done/
finalize retained. Native lexical/source/type/focused260 and fresh selected
broad690 pass including C1-C6/Chinook/private/index/recursive. b583/c891/d269
and root WHERE0..30/sourceRegisters/private24/LIMIT contracts preserved.
Deeper/transient owners, full AggInfo analyzer/index-expression/RIGHT
invalidation producers, general retained producer/destination composition
remain unfinished. Phase NULL is not RIGHT analyzer proof; selected coverage
is not original architectural acceptance.


#### R1 specialized recursive SUM entry ([[card:card-t-b]])
Public recursive SUM selection now allocates enclosing builder/parameters/output destination before invoking compileRecursiveAggregateSelect. Existing queue producer and accumulator consume these allocations; finalize/Copy feeds emitSelectDestination rather than a hardcoded ResultRow. Parent entry alone adds Halt/finish; standalone helper mode remains for live callers. select.c generateWithRecursiveQuery/selectInnerLoop and sqlite3Select finalizeAggFunctions share Parse/Vdbe/destination; aggregate-expression queue destination is the existing bounded TS accumulator construction adaptation, not native SRT. Pre-emission decline preserves window/multiple-CTE ownership; selected errors remain terminal. No preparation guard broadening, lexical enrollment/binding change, flag removal or budget adjustment. Existing unsupported recursive SUM ORDER/LIMIT/other aggregate consumers remain honest exclusions, not silently discarded flags. Native INTEGER55/reset plus three-encoding public recursive controls precede migration; entry22/22 and destination/lexical/scalar/composition neighbors52/52 after migration, type/diff clean. Remaining table/window/multiple-CTE and general preparation R1 still incomplete; selected checks are not full architectural acceptance.


#### R1 multiple recursive CTE enclosing composer ([[card:card-t-b]])
compileSelect now supplies actual compileMultipleRecursiveCtes builder/parameters/output destination; existing producers materialize through sorter destinations in that same owner. Consumer row/output/order-key ranges now allocate through SelectProgramBuilder.range, not a separate manual counter; sorted and unsorted final events use supplied destination. Parent entry alone Halt/finishes; standalone callers remain live. select.c generateWithRecursiveQuery/selectInnerLoop SRT_Coroutine/SRT_Output and sorter output use one Parse/Vdbe; current zero-key FIFO sorter materialization/nested-loop representation is existing bounded browser adaptation, no new evaluator or finished-child relocation. Shared ParameterBuilder removes post-emission parameter decline: legitimate producer bindings now complete selected compilation and share numbering, independently native/public tested with rebinding/reset. Existing ORDER/collation/NULL support retained; LIMIT/OFFSET/other capability declines unchanged. Selected errors terminal, preparation depth/enrollment/composite binding guards unchanged. Fresh changed-input broad692/692 (includes prior SUM slice), initial focused52/52 and expanded CTE bindings31/31; native cross-join/bindings0/type/diff0. Remaining window/table/general preparation R1 unfinished; no architectural acceptance claim.


#### R1 recursive window enclosing entry ([[card:card-t-b]])
Public compileSelect now passes its builder/parameters/output destination through actual compileRecursiveWindowSelect transient preparation to existing compileWindowSelectLowering owner. sqlite3WindowRewrite/recursive source coroutine therefore consume enclosing state, output uses existing owner destination, root drain jumps past appended window subroutines to enclosing Halt; parent alone finishes. Standalone preparer/lowerer retained for live callers. select.c8314+ sqlite3WindowCodeStep/regGosub/addrGosub and window.c sqlite3WindowRewrite share Parse/Vdbe; existing async coroutine/window event representation unchanged adaptation. Lowerer initializes register highwater from supplied builder and publishes again after late frame/subroutine allocations, preventing enclosing continuation allocation overlap. No lexical guard, clause flag, queue/WHERE/root/private budget or error conversion changes. NameResolutionError remains public code1 and selected errors terminal; compound windows still explicitly reject. Source-first pinned recursive INTEGER row_number/reset/body LIMIT controls and cross-feature public baseline precede migration. Focused13/13 then final window/entry/CTE/private46/46, native/type/diff clean; fresh changed-input broad recorded in card status. Original ordinary window/table/general preparation convergence remains unfinished, not whole task acceptance.


#### R1 ordinary physical window entry ([[card:card-t-b]])
For a noncompound/no-WITH ordinary unqualified single physical table (not derived/CTE/flattened/function input), compileSelect allocates builder/parameters/output and reserves the live physical WHERE0..30 range, then passes shared state through actual compileTableSelect name preparation into compileWindowSelectLowering. Rewrite/WHERE/window/result destination and root continuation now consume enclosing owner; parent alone Halt/finishes. Other table specializations and qualified/multisource window inputs retain live standalone contracts, not unsupported flag dropping. Table preparer preserves NameResolutionError code1 and existing atomic zero-column incomplete-lowering rejection; unsupported translation is terminal, never a retry. Source select.c8318+ window step/Gosub/selectInnerLoop and window.c sqlite3WindowRewrite use same Parse/Vdbe; existing coroutine/event representation unchanged adaptation. Earlier late highwater/ownerExit contract retained, manual lowerer allocator convergence remains unfinished. Native paired physical FILTER/NULL/WHERE/EXCLUDE/order/limit rows/types/names/reset baseline before migration and after0; final focused49/49/type/diff0. Current fresh broad evidence in card status, not prior recursive694 reuse. Remaining ordinary table/general preparation, broader window branches/full allocator convergence and committed architecture proof remain original debt; bounded entry does not certify the full correction.

Current d outer-window transient-source repair (post-b622/c900): reproduced
retained UNION ALL/CTE FILTER windows were rejected before rewrite, despite
native success. Existing retained-window table dispatch moved before ordinary
scan/flattening; its source lowerer now sends compounds into existing shared
multiSelect coroutine destination. Lexical guards, ordinary shared-entry fence,
WHERE reservations and VM unchanged. Native/public seven-case regression plus
selected integration evidence is bounded; full transient preparation/manual
allocator/analyzer/RIGHT debt remains. Earlier broad698 structural assertion
failure preserved in work artifacts; no runtime failure waiver.


#### R1 window setup register owner ([[card:card-t-b]], after d278)
compileWindowSelectLowering partition registers, partition-initialized/one/output-ready setup now allocate through enclosing SelectProgramBuilder.register (window.c1408–1418 sqlite3WindowCodeInit shared Parse.nMem). At each layer import still-manual prior consumer highwater before allocation, then publish frontier to remaining manual frame/buffer consumers; final late-subroutine highwater/ownerExit remains necessary. No independent setup counter, new evaluator or behavior flags; constant/null initialization and frame error ordering unchanged. Partition-initialized/output-ready are existing coroutine TS state, not new native registers claimed. Preserves d278 window-before-ORDER/flattening, retained compound+ordinary shared coroutine/common EndCoroutine/FILTER/independent LIMIT and standalone live callers, peer lexical/root/private/WHERE guards. Source-first linked native0 and public neighbors before migration; final focused88/88/native0/type/diff0 and changed-input selected broad in card status. Only these setup producers moved, not full lowerer allocation or ordinary table/general preparation convergence. Bounded ownership regression is not whole architecture approval; parent revision_required/original obligations remain.


#### R1 frame expression register owner ([[card:card-t-b]], after setup)
Actual compileWindowSelectLowering frame-bound compileExpressionTree callback now uses enclosing builder.register, retiring its independent ++registers producer. window.c sqlite3WindowCodeStep2881–2884 allocates offsets in shared Parse.nMem; 2941–2945 evaluates/checks them before partition processing. Existing TS once-before-producer evaluation/check adaptation unchanged; expression traversal, shared ParameterBuilder, ROWS/GROUPS integer vs RANGE numeric checking and error order unchanged. Published builder frontier back to still-manual exclusion/application/buffer consumers, keeping prior-layer import and final late-subroutine highwater/ownerExit. No flags/admission or root drain changes; d278 retained source rewrite/order/common coroutine/EndCoroutine/FILTER/independent limits and semantic/private/root WHERE guards preserved. Native-first ROWS1 PRECEDING..1 FOLLOWING and RANGE2 PRECEDING..CURRENT typed controls0; existing offset affinity/error/layered controls pass; final expanded focused183/183/native0/type/diff0, fresh selected broad in card status. Only frame expression owner moved; application/buffer/output/cursor/label/general table preparation still unfinished, not full architecture approval.


#### R1 window application register/cursor owner ([[card:card-t-b]])
Actual EXCLUDE rowid pair and EXCLUDE/lead/lag/first/nth application cursor producers now use enclosing builder.register/cursor (window.c1417–1422 sqlite3WindowCodeInit shared Parse.nMem/nTab). Import cursor next-free frontier with reserveCursorsThrough(frontier-1), preserving enclosing physical/rewrite reservations; publish builder register/cursor frontier to still-manual buffer/sorter/child/outer consumers. EXCLUDE-first branch, Integer1/0/OpenDup ordering, null application cursor when unused and existing cached-partition value/offset adaptation unchanged. Retired these ++registers/nextApplicationCursor++ producers only; shared late root/subroutine highwater, d278 rewrite/order/retained compound+ordinary coroutine/EndCoroutine/FILTER/independent LIMIT, semantic/private/root WHERE guards and standalone remain. Native-first typed EXCLUDE SUM/lag/first_value controls0; final focused184/184/native0/type/diff0 and fresh selected broad in card status. Remaining buffer/output/cursor/label/manual owners and ordinary table/general preparation plus committed architectural proof are unfinished; bounded producer migration is not full task approval.


#### R1 window input/record/rowid/peer register owner ([[card:card-t-b]])
Actual input range and four peer arrays now consume builder.range; record/rowid consume builder.register, retiring their ++registers producers (window.c2868–2902 sqlite3WindowCodeStep shared Parse.nMem). Zero input preserves next-free regNew without range(0); unused peers remain null/empty without allocation, contiguous range views are immutable arrays. Publish final builder register frontier to still-manual source/producer coroutines/output; setup/frame/application and late-root/subroutine handoffs remain necessary. Existing order/check/EXCLUDE/peer semantics and d278 rewrite/retained coroutine/EndCoroutine/FILTER/independent limits, semantic/private/root WHERE and standalone contracts unchanged. Native-first ROWS/RANGE/GROUPS typed controls0; final focused185/185/native0/type/diff0 and fresh broad in card status. Strengthened structural check initially sliced after regNew declaration (focused184/185, broad705/706); corrected test start boundary only, no production waiver. Buffer setup allocator moved, not remaining output/other cursor/label/manual allocation or real table/general preparation/committed architecture proof. Original task remains revision_required, not whole approval.


#### d post-b658 bounded ROWS frame publication repair
[[card:card-t-d]] independent native-first integration found two incorrect-row paths, not an allocator collision. Resolver frameForBuiltin agrees with window.c699–730 and does not coerce first_value. The actual divergence was callback sliding first/nth (inverse is a noop), plus missing executable following-EXCLUDE schedule and root readiness. `scannedRowsLayer` now selects unpartitioned moving ROWS first/nth ending CURRENT and following/current-only EXCLUDE CURRENT; ordinary sliding/exclusion schedules remain live outside this slice. Compiler caches producer rows, positions current independently, resets temporary aggregates for each frame, rewinds scan cursor, checks inclusive start/end and current-row exclusion before FILTER/AggStep, publishes AggValue, restores current payload and sets readiness before Yield. Root and parent consume only ready rows; late shared allocations import manual frontier and publish highwater. No VM/evaluator/parameter/error-order change; d278 preparation/source ordering, d269/c900/private24/WHERE0..30 and b setup/frame/application/buffer handoffs preserved.

Source: window.c1814–1910 windowFullScan supplies reset/frame-bound/EXCLUDE/step/value ownership; windowReturnOneRow1930–1955 uses regApp-bounded seek for first/nth (not cumulative inverse). TS bounded first/nth uses the existing full-scan callback machinery instead of that optimized regApp seek: current browser representation lacks per-function regApp frame endpoints in this lowerer, and callback inverse cannot evict the first value. This explicit bounded substitution preserves frame membership, NULL/INTEGER results, nth validation/FILTER/error and lifecycle ownership through VM ops; full cache/frame rescans cost more work than upstream optimized seek. It is not resource-count parity or broader frame approval. Direct regApp production remains a concrete optimization/fidelity debt; do not reuse this branch for partitions or general frames without source-based tests.

Independent native then public captures and exact scoped patch/hashes: work:///cards/card-t-d/window-cross-layer-repair/. Durable select-window-cross-layer-integration tests preserve both RED cases plus independently captured nth/current-only/FILTER/zero-width frame/empty controls and binding/error reset. Native narrow3 and expanded5 public differentials failures0; selected fresh type/focused192/broad713 passed before final extra binding test, which passes separately8/8. Prior intermediate partial/expanded-zero failures and test reset-contract mistake are recorded in status, not erased. Original R1–R4 revision_required and remaining ordinary/transient/manual producers unchanged; partition-expression and outer window-child preparation RED gaps from post-b658 report remain unresolved. No full compatibility or fresh canonical12 native recapture claim.


#### d non-EXCLUDE bounded ROWS endpoint migration
[[card:card-t-d]] supersedes the preceding first/nth rescan rationale for admitted unpartitioned ROWS PRECEDING/CURRENT..CURRENT without EXCLUDE. Missing implementation was not a browser constraint. `compileWindowSelectLowering` setup now gives each affected function builder-owned contiguous start/end registers and an OpenDup cursor (window.c1452–1460,2009–2010). `emitEndpointRowsDrain` admits one end row, advances start after offset+1, increments exclusive-start/inclusive-end instead of first/nth callbacks (1718–1724), restores current payload, initializes NULL, validates current nth through WindowCheck (1480–1520), adds start, guards end, seeks and reads the argument (1930–1955). Builder labels resolve at the enclosing owner's finish; allocation imports/publishes late manual highwater. Sorter reservation now includes per-function cursors: the initial draft omitted these and overwrote an OpenDup with SorterOpen. No VM seek cast workaround.

Compiler owns this schedule/labels/register and cursor identities; VDBE still owns running PC, Mem arithmetic/affinity, cursor positioning, private budgets, Yield suspension, binding, saved-error reset/finalize. OpenDup/SeekRowid consumers compared with vdbe.c4480–4508/5495ff; duplicate positions remain independent over shared entries. Root [[card:card-s]] WHERE0..30/index/restart/RIGHT contracts untouched. No completed-program copying or independent evaluator added. Shared application cursor remains only for offset functions and specialized unconsumed first/nth branches; endpoint-only slice no longer allocates the superseded shared cursor. EXCLUDE retains reset/rewind/FILTER/step/value scan, including repaired readiness. Other partitions/frames, specialized callback schedules, source/producer/output manual frontiers and broader preparation gaps remain live debt, not migrated by this slice.

Observable typed rows/NULL/zero/empty/current-only/FILTER, bindings and saved errors remain covered by cross-layer tests; endpoint ownership tests require no first/nth callback plus guarded seek and retain EXCLUDE scan control. Independent pinned narrow3/expanded5 baseline was captured before edits; public two-execution/reset/metadata comparison passes after migration. Fresh pinned nth NULL/0/-1/1.5/non-numeric TEXT errors and numeric TEXT2 values agree with public binding tests. Existing focused/private tests exercise cancellation/suspended reset/deadline/lifecycle; not an exhaustive new concurrency matrix. Evidence and exact commands/hashes: work:///cards/card-t-d/endpoint-owner-green/ and card status. No exact native work-count parity: endpoint bytecode removes repeated candidate AggStep scans, but EphemeralIndexCursor.seekRowid still linearly searches shared entries; source Btree seek complexity/storage and cache-retention differences remain explicit existing primitive debt. No change to owner scope or resource guarantees, no whole architecture/compatibility approval.

Endpoint verification revision: typecheck and owner/cross-layer/private13 passed; final public narrow3/expanded5 failures0, focused197/197 and selected broad715/715 (C1–C6/Chinook/lifecycle/index/stat), zero skips/cancellations. Commands/logs in endpoint-owner-green; production SHA256 a336537d7cfec644416108183043a4c27b822ac4210ba183d7aad0801354b514 (final source comment only after runtime checks, typecheck rerun). No fresh full canonical12 native capture. Earlier typecheck and cursor-collision failures retained in card status.


#### R1 window coroutine destination register ownership ([[card:card-t-b]], post-d296)
Actual sourceCoroutine and per-rewrite-layer producerCoroutines now allocate on enclosing SelectProgramBuilder before InitCoroutine/body/SelectDest construction (select.c8058–8075 tag-select-0482 shared Parse.nMem, SRT_Coroutine, recursive sqlite3Select, EndCoroutine). Import register frontier then publish to still-manual source/buffer expression/output consumers; retired these independent ++registers producers only. Source/grouped/retained compound/recursive destinations use the same identity, payload/ParameterBuilder and common EndCoroutine; empty sources, predicates, child LIMIT and root readiness unchanged. d296 per-function endpoint cursors/labels and corrected sorter reservation, EXCLUDE scan, late highwater/ownerExit, d278 and semantic/private/root WHERE guards preserved. Final focused198/198, linked pinned native0 and independent previously captured narrow3/expanded5 public typed rows/reset/metadata controls0; fresh selected broad in status. Source/buffer callbacks, prior-peer/output-save/projection and other cursor/label/manual control plus ordinary table/general preparation and R1–R4 architectural proof remain unfinished; not whole approval or exact resource parity. No public contract narrowing or new algorithm substitution.


#### R1 positioned window source/buffer expression allocation ([[card:card-t-b]])
Actual source predicate, producer FILTER and constant unary/cast/parameter compileExpressionTree callbacks now allocate on enclosing builder.register, importing/publishing manual frontier around each actual expression producer. expr.c sqlite3GetTempReg7600+ consumes shared Parse.nMem (with native temporary reuse); existing TS monotonic temporary allocation remains, now shares enclosing ownership. Source IfNot-before-Yield and FILTER/carrier positioned-row evaluation before payload Copy remain unchanged; retained/grouped/recursive and prior-window identity copies precede expression branch as before. No new evaluator, late recomputation or flag narrowing. d296 endpoints/cursors/labels/sorter reservation/EXCLUDE/readiness, b coroutine identity, d278 child LIMIT, semantic/private/root WHERE0..30/late highwater preserved. Focused199/199/type/diff0 and native FILTER/public expanded controls0, fresh selected broad in status. Remaining prior-peer/save/output projection and manual cursor/label/control plus ordinary/general preparation/R1–R4 proof are not waived; no exact native work/temporary reuse parity claim.


#### R1 retained output/peer range allocation ([[card:card-t-b]])
Eleven actual cached-drain outputSave/endSave/startSave/currentPeer/previousPeer contiguous producers now use enclosing builder.range, preserving zero-width frontier without allocation and importing/publishing to live manual consumers. window.c2870–2904 shared Parse.nMem input/peer ranges compared. TS payload operations overwrite regNew while independent cursors advance; existing saved row Copy/restore before Yield remains necessary adaptation, not a new algorithm. No step/inverse/EXCLUDE/readiness/error branch reordered; d296 endpoint saved ranges/cursors/labels/sorter frontier untouched. Source/callback/coroutine handoffs, d278 child LIMIT and semantic/private/root guards preserved. Focused200/200/type/diff/native/public0, selected broad in status. This bounded saved-row/peer allocation repair does not certify output projection/callback ownership, other cursors/labels/control/general preparation, temporary reuse or full R1–R4 closure; no public narrowing.


### Retained endpoint outer publication repair ([[card:card-t-d]], post-b685)

The retained-window branch in `compileTableSelect` owns the outer
`SelectProgramBuilder`; `compileWindowSelectLowering(owner)` deliberately returns
unresolved shared ops so nested consumers do not finalize an enclosing graph.
This outer caller previously returned those ops directly. Endpoint frame
`builder.jump` fixups therefore retained zero targets: execution after the
second child row reached the frame-value Goto and restarted at PC0, reopening
private cursors until work exhaustion. Child LIMIT and coroutine continuation
were correct; this is not evidence of an allocator or VM PC defect.

The outer caller now appends Halt and publishes `builder.finish()` and the
complete register frontier, following pinned vdbeaux.c610–654 label marking and
850ff resolveP2Values (fixups only after all opcodes have been inserted).
Pinned vdbe.c1174–1240 coroutine transitions retain their next-PC TS
representation unchanged. SELECT owns relocation; VM still owns PC/Mem/cursors,
budgets, suspension, bindings, saved-error reset/finalize. No parallel evaluator
or source copying was added; root [[card:card-s]] WHERE0..30 contracts untouched.

Preserved public regression `select-window-retained-endpoint-integration.test.mjs`
uses independently captured pinned INTEGER/NULL rows for ordinary/CTE/compound
children, outer ORDER/LIMIT/OFFSET and two executions/reset. All three now
terminate and agree; native capture preceded edits. Focused203 passes. Exact
commands, scoped patch and hashes: card status and
work:///cards/card-t-d/endpoint-repair/. Existing EXCLUDE/specialized frame
branches, linear ephemeral seek/storage and general preparation debt remain;
no exact resource parity, broader compatibility approval, or scope change.

Publication-repair verification: fresh typecheck, reproducer3/3, focused203/203
and selected broad755/755 (canonical C1–C6/Chinook, index/stat, private lifecycle
and parser/resolver/select included), no skips/cancellations; diff check clean.
Expanded captured-native public12 probe still exits1: ten matches and two
unchanged preparation gaps (aggregate compound derived child; CAST first_value).
These are not repaired or waived by label publication. vdbe SHA256
fe37a84027f2f4e98fd7a5d2a8a7e4a2cc4f363ded3b3be856f3378d7cbeb6b5.


#### R1 window root projection/consumer limit register owner ([[card:card-t-b]])
Actual outputStart contiguous row range and computeLimitRegisters callback now allocate on enclosing builder after frontier import, publishing to remaining manual output/late-subroutine consumers. select.c1177–1202 selectInnerLoop iSdst/nSdst shared Parse.nMem compared: allocation is conditional on emitting a nonempty admitted row, non-emitting remains0. Consumer OFFSET-before-SelectDest and LIMIT-after, direct/sorted projection and shared parameters unchanged. Existing sort prefix/key construction and manual other consumers remain debt, not source ownership completion. d305 outer Halt/finish after late subroutines and ownerExit retained (never finish nested builder); endpoint cursor/sorter/labels/EXCLUDE/readiness, retained child LIMIT/common coroutine and semantic/private/root WHERE0..30 untouched. Focused204/204/type/diff/public-three/native0; expanded native12/public still ten matches/two preparation failures aggregate compound child/first_value CAST, not waived. Fresh broad in status; no full R1–R4 or resource parity claim/public narrowing.


#### R1 ordered root key/sorter allocation owner ([[card:card-t-b]])
Actual outerSorter now consumes enclosing builder.cursor after conditional reservation through live application/rewrite sorter frontier; publishes next-free cursor to remaining manual callers. Actual SorterInsert keyStart contiguous range now builder.range with register handoff; no-sort branches allocate neither cursor nor key. select.c8215–8235 tag-select-0600 shared Parse.nTab cursor construction and1180–1207 sort prefix/iSdst Parse.nMem compared. Existing separate key/payload VM representation retained; readiness/Copy/SorterInsert/SorterData/SelectDest/OFFSET/LIMIT order unchanged. Reserved application endpoint cursors remain disjoint; d305 outer Halt/finish after late bodies and ownerExit, d296 labels/EXCLUDE/readiness, semantic/private/root WHERE0..30/peer dirty intact. Focused205/205/type/diff/native/public-three0; expanded12 still ten matches/two preparation failures, not waived. Fresh selected integration in status; broader register/frame temporary/cursor/control/general preparation/R1–R4 ownership remains debt, not full approval or exact resource parity.


#### R1 late bounded-peer EXCLUDE scan construction ([[card:card-t-b]])
sharedBoundedPeerExclusion now consumes shared builder registers for current/start/candidate rowids, temporary accumulators, constant width and ties identity. Rewind/first/bounds/peer/ties/FILTER/next/finish branches now shared labels marked in the same order; displaced per-op manual address writes retired only here. Enclosing finish resolves labels after late bodies (d305 Halt/ownerExit unchanged); existing application OpenDup cursor remains setup-owned, no replacement cursor. Compare pinned window.c1814–1910 windowFullScan: current identity, reset before scan, skip before start/stop after end, EXCLUDE GROUP or TIES current-row exemption, FILTER before step, aggregate value then payload restoration. Existing TS bounded-rowid start computation and monotonic temporaries remain adaptations, not a new evaluator/native temp-reuse or resource-count claim. Source/producer current payload is authoritative because candidate EphemeralData overwrites regNew. Pin-checked public GROUP/TIES/NO OTHERS FILTER rows/NULL/metadata/reset added; existing error/bind/limits/suspension controls retained. Shared parameters/destination and root output/key/limit unchanged; d296 endpoints/sorter cursor reservations/EXCLUDE/readiness, semantic/private/WHERE0..30/peer dirty preserved. Expanded12 remains two preparation RED gaps; earlier independent drains/general preparation/control/full R1–R4 ownership unfinished. Exact checks/patch/hashes in card status, no full compatibility approval.


#### R1 late sliding/current-following drain control ([[card:card-t-b]])
Actual sharedSliding/sharedFollowing FILTER skips and size-gated inverse/snapshot continuations now builder labels/jumps; displaced manual per-op PC fixups removed in both callers. Registers/bound parameters/duplicate cursors were already setup-owned; no replacement state/cursor or algorithm. Pinned window.c2995–3044 step/return/inverse branches and vdbeaux.c610 label production compared. Sliding step -> trim/inverse -> authoritative producer Copy restore -> value, following step -> readiness -> snapshot/value -> ready flag -> inverse remain distinct and ordered. Labels defer to d305 enclosing finish/Halt after late subroutines/ownerExit, never finish nested graph. Public pin-confirmed preceding/current, current/current, current/following FILTER INTEGER/NULL/metadata/reset controls added; existing binding/error/limits/suspension controls retained. b709 bounded-peer labels/frontiers, d296 endpoints/sorter cursor identity/EXCLUDE/readiness, semantic/private/root WHERE0..30/peer dirty preserved. Neighbor cached-offset/other frame drains have independent admission/readiness/return targets and remain debt, as do general preparation/WHERE/full R1–R4 and expanded12 two preparation RED gaps. No exact native work/temp-reuse/linear-seek parity claim; exact checks/patch/hashes in status.


### Recursive window FILTER producer location ([[card:card-t-d]], post-b721)

Independent changed-input native21/public integration found recursive SUM
FILTER+bounded ROWS EXCLUDE TIES returning NULL instead of INTEGER2/5.
`compileWindowSelectLowering.emitProducerBinding` copied direct recursive
columns from the SRT_Coroutine payload but bound composite FILTER references
to a nonexistent positioned physical source cursor. The first rewrite layer
now binds retained **or recursive** FILTER carriers to `groupedPayload +
columnIndex`, using the same destination identity as direct arguments. Physical
sources keep cursor locations; grouped producer payload and later layer
identity-copy branches remain unchanged. This fixes semantic production before
caching, not output SQL or scan callbacks.

Pinned window.c sqlite3WindowRewrite stores FILTER next to function arguments;
windowAggStep1685–1701 reads `iArgCol+nArg` from the candidate cached row and
IfNot gates stepping. select.c SRT_Coroutine producer-row ownership and current
TS compileRecursiveCteSelect destination agree: the coroutine yields a complete
row in registers, not the queue cursor. EXCLUDE scan and sliding/following
consumers still read that cached predicate. SELECT owns the expression location
and shared builder allocation; VM owns Mem/cursor/PC/budgets/suspension. d305
outer Halt/finish after late bodies, b root projection/key/LIMIT/scan/drain
labels, endpoint identities/readiness and root WHERE0..30 unchanged. No new
evaluator, temporary reuse claim or algorithm substitution.

Existing cross-layer regression preserves the failing SQL and adds independently
pin-captured two-column recursive payload controls with GROUP/TIES/NO OTHERS
and sliding default frames, ordered LIMIT, typed rows, metadata names and reset.
Native21 was captured before product edits; native-extra4 was captured after
repair to strengthen identity coverage, not a pre-edit baseline. Public21 now
has18 matches/3 unchanged preparation gaps: aggregate compound child, CAST
first_value and grouped nested-count FILTER window misuse error. These remain
unwaived. Source comparison, scoped patch, commands/hashes and focused/broad
evidence in card status and work:///cards/card-t-d/recursive-filter-repair/.
Linear seek/storage/temp/resource complexity and broader R1–R4 remain unfinished;
no origin-metadata parity or exhaustive new suspension/native-resource claim.

Recursive FILTER repair verification: fresh focused218/218 and selected
broad764/764 (C1–C6/Chinook, index/stat/private lifecycle/resources) pass without
skips/cancellations. Initial focused and broad runs failed only stale source
regex requiring a now-unneeded non-null assertion; updated that assertion to
match guarded payload access, reran both. No functional assertion removed.
Public21 remains exit1 with18 matches/3 preparation gaps, extra4 matches;
type/diff pass. Final vdbe SHA256
e6f0b01f6dba2f44ccf0ae866a3abdeb54b1ca12c6f4e82fb69112af868c22d2.

Grouped ordinary aggregate/window FILTER consuming repair ([[card:card-t-c]]):
resolve.c1320–1355 retains NC_AllowAgg for pWin, disables NC_AllowWin:
ordinary aggregates in window args/FILTER are legal, nested windows remain
misuse. TS nested-aggregate diagnostics now apply only to ordinary calls;
ordinary aggregate FILTER misuse remains code1. window.c rewrite caches
pWin->pFilter expression, not the FILTER-clause syntactic container.
window-rewrite.ts now buffers that actual predicate reduction and the same
resolved carrier; retired wrapper-as-buffer-value mechanism. Actual grouped
producer's compileAggregateSelect destination evaluates/finalizes COUNT and
predicate then copies its rewritten expression column into window cached
FILTER slot; window.c1685–1701 cached IfNot/AggStep order preserved.
No raw cursor substitution or evaluator, no vdbe/producer/index remap.
Native-before-code original count/count FILTER gives INTEGER[4,4]; false and
NULL FILTER give NULL, CAST(count AS REAL) arg gives REAL4. Two-run public
metadata/reset/done/finalize tests and ordinary misuse code1 controls retained.
Resolver expectations for window-over-aggregate permission/error category
corrected to pinned context semantics (median unavailable in native build;
supported SUM/JSON substitute confirms nested-window error category).
Standalone first_value CAST argument and aggregate-compound derived window
child remain separate unimplemented preparation gaps, not expanded here.
Preserve d314 retained/recursive columnIndex vs grouped expression index vs
previous-layer identity/physical cursors, b721 labels/frontiers, d305 finish,
d296 endpoints/EXCLUDE/readiness, private24 and root WHERE0..30. Deeper/mixed/
transient lexical/full analyzer/index-expression/RIGHT/general composition
unfinished; no whole architecture/native-resource compatibility claim.

Window producer expression consuming repair ([[card:card-t-c]], CAST tranche):
pinned window.c1036–1060 appends full argument expressions/pFilter to the
rewritten producer (SQLITE_SUBTYPE specialized branches remain distinct);
expr.c5171 TK_CAST recursively codes child then OP_Cast; select.c preparation
invokes rewrite before WHERE lowering. Actual emitProducerBinding now uses
resolvedExpressionCarrier + bindResolvedExpression + compileExpressionTree
for represented producer expressions, including CAST(column), composite args
and FILTER. Retired literal opcode emitter/producerConstant private admission
walker and separate FILTER evaluator at this caller; no new evaluator.
Deferred window-result slots remain structural handoff NULLs, not scalar
functions; previous-layer exact expression/window result copies precede new
binding. Composite previous-layer columns bind to child regNew binding indexes
or reject typed temporary if absent, never exhausted physical cursors.
First retained/recursive expressions bind payload+resolved columnIndex;
grouped finalized-expression-index copy remains earlier and distinct.
Physical sources still bind positioned cursor, shared Mem/KeyInfo/Btree async,
b721 labels/d305 finish/d296 endpoints/private24/root WHERE0..30 unchanged.
Eight independent native/public controls in cross-layer suite check REAL vs
INTEGER, NULL, TEXT, arithmetic/lag/default, FILTER, retained LIMIT and CTE,
column names and two executions/reset/done/finalize. Original REAL CAST native
before code; baseline driver incorrectly projected TEXT as NULL (missing text
API), corrected independent native capture supplies TEXT "1" (not product
waiver). Frame/binding/error/private lifecycle checks rerun as existing coverage.
CAST first_value preparation gap closed for represented linked expressions;
aggregate compound-derived child/full analyzer/deeper/mixed/transient/RIGHT/
index-expression/general composition/linear-resource debt remains. Arbitrary
residual expression/subtype/deeper previous-layer combinations are not declared
supported merely by this tranche; no architecture-wide compatibility claim.

Aggregate compound-derived window consuming closure ([[card:card-t-c]]):
the preceding CAST suffix's aggregate-compound-child preparation gap is now
closed for represented ordinary aggregate/GROUP/HAVING UNION ALL producers.
select.c multiSelect TK_ALL shares destination and LIMIT state across complete
arm SELECTs (3000ff); selectInnerLoop SRT_Coroutine1441ff copies result/yields;
sqlite3Select prepares window rewrite7699 and analyzes aggregate ELists/HAVING
before producer output. Actual compileTableSelect retained-window preparation
now precedes older CTE/repeated/single-compound derived interceptors, retaining
this existing specialized owner for eligible single source window consumers.
compileWindowSelectLowering → compileTableCompoundProducer → compileCteUnionAll
→ compileAggregateSelect(parent destination, compoundLimit) yields directly
into enclosing window sourceCoroutine/payload. Ordered arms use existing
compileOrderedCteUnionAll merge destination with child LIMIT/OFFSET. Noncompound
aggregate retained child dispatches to the same aggregate owner, not raw scan.
GROUP/HAVING arm carriers now preserved rather than flags with erased trees;
GROUP-only arms use aggregate grouping owner. Complete arm dispatch precedes
simple relational gate, without masking flags. Shared LIMIT initialized once,
OFFSET checked before destination, aggregate stop branches patched to compound
end, EndCoroutine child then enclosing finish/Halt; no child Program copying.
Retired intercepted preparation for these callers and aggregate/window-only
compound LIMIT exclusion where shared aggregate contract already exists.
Missing tree/unsupported arm still aborts prepare typed temporary. SELECT
outer WHERE/grouped/window-in-child/joins/general composition remains separately
bounded; this is not generic AggInfo/analyzer/RIGHT/index-expression/subtype or
linear-resource acceptance. Shared expression phases, c909 FILTER/!over, d314
recursive payload, root WHERE0..30 and frame/private/label/finish seams unchanged.
Independent pinned original + empty/child LIMIT0/1/order/group/HAVING/predicate/
CAST outer LIMIT/OFFSET/noncompound aggregate/GROUP-only controls retained in
cross-layer suite: typed rows and native names, two runs/reset/done/finalize;
parameterized compound frame binds/error-reset validated. Existing selected
suspension/private budgets/frame controls rerun, not newly comprehensive native
metadata origin/encoding/BLOB/resource comparison. Broader debts unwaived.


### Grouped aggregate identity across window layers ([[card:card-t-d]])
Independent post-c927 original21 now all match: c909/c918/c927 closures remain
GREEN. New grouped count + TEXT CAST first_value + incompatible current-row SUM
FILTER prepared INTERNAL because a nested finalized aggregate reached scalar
lowering in a subsequent window producer. Pinned window.c789–820
selectWindowRewriteExprCb matches TK_AGG_FUNCTION against pSub expressions, then
rewrites to TK_COLUMN/iEphCsr/iColumn. Current TS exact whole-expression copies
did not cover aggregate nodes inside CAST or FILTER.

The shared resolved expression binder now consumes an explicitly supplied
aggregateOutput mapping before scalar recursion, independently of the ordinary
aggregate enrollment policy. The later window producer supplies previous-layer
buffer expression identity/equivalence → regNew+column. Ordinary aggregate
enrollment, deferred slots, grouped first-layer finalized indexes and physical/
retained/recursive column bindings are unchanged. No new aggregate evaluator,
VM workaround, PC copy or algorithm substitution. An absent mapping does not
pretend a source column is a finalized aggregate. d305 enclosing finish/Halt,
b labels/frontiers, d296 endpoints/readiness/EXCLUDE, c predicate and destination
contracts/root WHERE0..30/private24 preserved.

Existing cross-layer reproducer retains native INTEGER/TEXT rows and names,
two runs/reset, error/binding/lifecycle controls. Native capture preceded this
repair; original21 captures reused unchanged. Public targeted6 now5 matches and
one retained correlated subquery argument unsupported gap, not reclassified.
No origin/BLOB/encoding/native resource equivalence claim. Exact scoped patch,
hashes, attempts and verification in card status and
work:///cards/card-t-d/grouped-layer-repair/. Broader analyzer/R1/R2/RIGHT/nTab/
linear seek/storage/temp debt remains; selected totals not architecture proof.

Scalar-subquery window producer consuming closure ([[card:card-t-c]], after
d323 aggregateOutput handoff): complete window argument expression codegen now
supplies the existing linked scalar-subselect lowering owner, extracted from
compileInnerTableSelect into resolvedScalarSubqueryEmitter (not a second
expression evaluator). resolve.c TK_SELECT links pNext and sets EP_VarSelect;
expr.c sqlite3CodeSubselect initializes NULL SRT_Mem, uses Once only when not
correlated, and first-row return/SELECT LIMIT. window.c selectWindowRewriteExprCb
and argument projection keep the complete expression at producer evaluation.
TS consumer uses resolved.nested identity/column carriers; local reader has its
own builder cursor, outer source reads use actual window phase location callback
(positioned physical, retained/recursive payload or previous regNew buffer).
Predicate rejection advances Next, empty scalar remains NULL; ordinary aggregate
scan finalizes even on empty input; scalar projection copies into Mem and exits
on first row. LIMIT follows expr.c:sqlite3CodeSubselect X<>0 with numeric affinity, then
select.c integer admission (NULL errors; nonzero TEXT/REAL admit one row),
not ordinary raw LIMIT admission or SQL-text guards. Nested code recurses through same
callback; zero-FROM scalar fallback preserved. DISTINCT/GROUP/HAVING/ORDER/set/
OFFSET/other unrepresented subselect branches remain atomic typed temporary.
Joined callers retain their original normal affinity/collation binding; window
phase policy is supplied only by window consumer. A broad joined NULL identity
regression exposed erroneous applying window policy everywhere (COUNT became1
instead of2); corrected owning callback policy before acceptance. Opening nested
reader at its consuming body replaces unconditional pre-opening; Once encloses
open/initialization/scan for uncorrelated, correlated reinitializes each input.
No VM/storage/WHERE change, Program copying or independent evaluator added.
Full ordinary scalar owner broader implementation remains live, not claimed
retired; new shared consumer is bounded to these existing resolved scan branches.

Native-first eight cases + four connected LIMIT0/-1/REAL CAST/empty-aggregate
controls, rows/types/names retained in cross-layer suite, twice/reset/done/finalize.
Original inequality MAX first_value produces all NULL under pin (first frame
argument is NULL), NOT inferred lack of correlation. CURRENT ROW equality checks
1/3/5/7. CTE retained/grouped/incompatible previous-layer controls retained;
parameter LIMIT0/1/-1 and NULL saved-error/reset plus nonzero TEXT/REAL admission, lexical missing column
and width diagnostics checked. Existing frame/private/suspension tests rerun,
not exhaustive new native origin/BLOB/encoding/resources/suspension comparison.
d323 aggregateOutput/deferred/grouped/prior/physical, c909 permissions,c927 arm
shared limits, d305 Halt/finish, d296 endpoints/b labels/root WHERE0..30/private24
remain. Full analyzer/deeper transient/mixed/RIGHT/nTab/index/subtype/general
preparation and linear seek/storage/resource debt unwaived; bounded ownership
restoration, not architecture acceptance or blanket scalar/window compatibility.

Scalar child LIMIT correction (current closure): exact expr.c3880–3946 comparison
found original raw computeLimitRegisters admission was wrong. Pinned X<>0 numeric
comparison admits nonzero TEXT/REAL, rejects NULL at integer admission, and skips
numeric zero. Independently captured five native controls (bad TEXT, REAL0.5,
NULL, TEXT0/1) in window-subquery-repair/oracle-limit.json; shared subquery owner
now emits comparison before MustBeInt. This supersedes earlier invalid-TEXT
code20 test/document claims; ordinary enclosing SELECT LIMIT remains unchanged.


#### R1 joined direct/sorted destination exit closure ([[card:card-t-b]])
compileInnerTableSelect now emits direct OFFSET continuation, producer LIMIT/first-row iBreak and sorter empty/data/OFFSET/next/break via shared builder labels; standalone consumer uses local builder. select.c1177ff selectInnerLoop and vdbeaux.c610 label contracts: destination is emitted before count decrement, OFFSET skips destination, empty sort skips all output. Removed outputLimitStops and producer Goto0 scanner, sortAt/offsetAt/limitAt drain mutations only within this consumer. Compound LIMIT stops deliberately remain enclosing-owned numeric handoff until that caller migrates; source WHERE/RIGHT rewinds/interior validation remain live. New resolveLabel resolves a closed producer's selected labels without freezing the enclosing program: RIGHT interior numeric validator requires resolved targets now; d305 enclosing finish/Halt still publishes all other deferred bodies. No nested finish or PC-copy rewrite. Shared c936 resolved scalar emitter/phase/X<>0+MustBeInt and d323 finalized aggregateOutput, b scan/drains, d296 endpoint/sorter readiness/EXCLUDE/physical0..30/private24 preserved. Native-first public joined direct/sorted LIMIT/OFFSET, scalar first-row and empty controls added with INTEGER/name/reset checks. Full analyzer/RIGHT/nTab/resource/general preparation/R1–R4 remain, no architecture acceptance/native resource-count parity claim. Exact checks and gaps in status.


#### Linked scalar projection consumes ordinary SELECT destination ([[card:card-t-c]])
Current consuming repair (supersedes census RED for projection only):
resolvedScalarSubqueryEmitter now hands its already-admitted nonaggregate,
one-local-physical-source projection to compileInnerTableSelect on the same full
builder/parameters and initialized Mem destination. Removed its independent
projection scan/first-row success Goto; specialized scalar aggregate scan remains
live. Both complete window arguments and joined expression callers use this
handoff. No child Program/PC relocation/finish or generic evaluator added.
Pinned expr.c3841–3978 owns Once/NULL/numeric X<>0 child LIMIT admission;
select.c1177ff/1422 owns WHERE→projection→Mem and first-row producer exit.
Prepared scalar flag means admission was already emitted, not permission to
ignore LIMIT; zero/NULL/nonzero TEXT/REAL controls retained. Linked child source
identity is unchanged, cursorFor maps local physical reads consistently including
Next; explicit window binding carries retained/prior/physical outer phase into
projection and WHERE, whereas joined default retains affinity/collation. Actual
full builder replaces the standalone legacy adapter; standalone nested cursor
frontier999 stays, enclosing-owned callers retain their own frontier. Register
allocation and final standalone register count now use that builder.

For this bounded linked scalar handoff, existing source scan owner uses its
ordinary full scan rather than physical candidate seeks: generated WHERE seek
operands currently have no reduction/outer-phase identity, and cannot consume a
prior-buffer outer register honestly. This does NOT add a scan evaluator or
change root WHERE0..30. Ordinary scan result/predicate/Next branches are reused;
root selected index/RIGHT callers unchanged. Native/public equality, inequality,
empty, first-row and CURRENT ROW controls plus existing LIMIT/error/reset tests
check observable preservation, not index/resource parity. Full linked preparation
and a phase-aware root WHERE candidate operand interface remain prerequisites
for later convergence. GROUP/HAVING/ORDER/DISTINCT/compound/OFFSET/IN/EXISTS and
multisource admission not widened; supported shapes cannot be reclassified
unsupported. d323 aggregateOutput,c927 limits,b730 RIGHT resolveLabel validation,
d305 late finish/Halt,endpoints/EXCLUDE/readiness/frontiers/private24 unchanged.

Production/source/prerequisite census:
docs/research/card-t-c-linked-scalar-preparation-census.md. New durable ownership
check and six independent pinned typed-row/name/reset controls:
test/conformance/select-linked-scalar-preparation-owner.test.mjs. Existing scalar
LIMIT window tests include NULL saved error/rebind and TEXT/REAL numeric admission;
selected tests do not establish complete metadata/BLOB/encoding/resource parity.
Full analyzer/RIGHT/nTab/storage/linear native work and general destinations remain
unwaived. This is bounded consumer convergence, not architectural acceptance.


### d direct scalar projection phase closure

The c945 ordinary scalar producer handoff requires phase binding for **all**
result productions, including direct resolved columns and merged expressions,
not only composite expressions/WHERE. `compileInnerTableSelect` now routes
results through the existing linked carrier binder when its caller supplies
`expressionBinding`. Otherwise the ordinary physical source/affinity/collation
fast paths are unchanged. Pinned select.c selectInnerLoop expression-list code
then SRT_Mem (1418ff) owns result production before destination copy/first-row
exit; an outer retained/recursive payload is not a positioned Btree cursor.
No VM, NULL fallback, evaluator, or PC-copy repair. Local cursor mapping and
Mem/Once/scalar LIMIT admission, late enclosing finish and RIGHT selective
label closure remain unchanged. Native-first post-c945/oracle-phase.json
controls (retained and recursive current-row first_value of SELECT q.a)
previously returned NULL rather than current INTEGER; durable linked scalar
owner tests retain typed rows/names/two executions/reset/finalize.
This closes direct projection phase only, not aggregate preparation or the
root seek-operand reduction/phase interface; full-scan adaptation/resource
debt and R1–R4 remain unwaived. Public scope/API unchanged.


### Linked scalar aggregate producer convergence ([[card:card-t-c]])
Supersedes the earlier finding that the shared emitter retains a specialized
aggregate scan. Window complete arguments (vdbe compileWindowSelectLowering) and
joined expressions now hand their already-admitted one-physical-source aggregate
to compileAggregateSelect using the enclosing builder/parameters, linked nested
plan, physical cursor mapper, explicit outer phase binding when supplied and
initialized Mem destination. Removed emitter OpenRead/Rewind/AggStep/Next/AggFinal.
expr.c3841–3978 still owns Once/NULL/numeric X<>0 child LIMIT admission; prepared
scalar prevents raw LIMIT readmission. select.c8390–8458 owns aggregate analysis,
8860–8919 reset→WHERE→update→finalize→selectInnerLoop/Mem. The shared no-group
producer now explicitly AggReset before positioning on every invocation (not
merely relying on standalone initial NULL registers). Empty correlated COUNT/MAX
and later nonempty invocations therefore retain source reset semantics.

Linked preparation may supply a plan without schema: already-resolved source
objects provide physical tables and local cursor mapping; no null-outer
re-resolution or fabricated schema. Ordinary schema callers are unchanged.
Outer references bypass local accumulator-column enrollment and consume explicit
window phase location or ordinary linked physical cursor. Parent label/finish,
shared Mem/Btree/KeyInfo and private limits remain owned by the enclosing program.
FILTER/DISTINCT/ORDER/GROUP/HAVING and other previously rejected shapes in this
emitter are not newly admitted. Ordinary physical scalar callbacks, general
linked dispatcher, C subroutine reuse, deeper aggregate ownership and phase-aware
root WHERE seeks remain unresolved, not architectural acceptance.

Tests: select-linked-scalar-preparation-owner structural gate plus independently
source-ID-asserted full enclosing native controls, including REAL SUM, retained
CTE window MAX, joined COUNT and scalar LIMIT0; typed rows/names/reset/done/finalize.
select-linked-correlated-owner retains linked carrier protection at its new shared
producer rather than requiring the retired local traversal. Existing window LIMIT
NULL saved errors/TEXT/REAL rebind controls remain. Selected tests do not prove
full native origin/BLOB/encoding/resource parity; no scope or budget change.


### d c955 grouped aggregate callback partial closure

Grouped window scalar arguments reach compileAggregateSelect's expression
callback, whose ordered LIMIT gate rejected scalar aggregate LIMIT1. Admitted
one-source scalar aggregates now delegate to existing linked scalar emitter
with resultLocation/enclosing builder and shared aggregate producer/Mem.
No DISTINCT/FILTER/order/group/compound/OFFSET widening; specialized other
callbacks remain live. Pinned expr.c sqlite3CodeSubselect and select.c AggInfo
then SRT_Mem own admission/production; regression retains typed rows/names
over reset/two runs. No Program finish/PC copying. Overall d integration RED:
compound retained child LIMIT cardinality and resolve.c1356–1378 outer-only
aggregate NameContext ownership remain defects, not resource parity approval.


### d c955 compound producer order/LIMIT integration (next repair)

Native EXPLAIN QUERY PLAN demonstrates MERGE(UNION ALL) under the window
producer and plain derived consumer, not concatenation LIMIT then sort.
window.c987–1038 moves the source clauses into its ordered inner producer;
select.c flattenSubquery4390–4448/4478ff distributes that producer over
UNION ALL, transfers LIMIT4695ff. Our retained-source lowering previously
limited concatenation first. Bound generated producer keys now enter the
existing source-owned ordered compound merge before LIMIT when the bounded
flatten restrictions admit it (no child order/OFFSET, distinct/group/aggregate
arm or non-UNION-ALL); plain prefix derived specialization likewise transfers
parent ordering before its shared child output limit. Existing child order
and OFFSET remain retained. Ordered merge resolves represented EList keys
by structural expression/alias as well as ordinals, rather than falling back
to an unordered simple loop for WHERE arms. No VM PC/cursor/Mem change.

Owner/caller: window lowerer → compileTableCompoundProducer → ordered
compound shared merge → compileInnerTableSelect; enclosing builder owns
publication/labels, VM Yield/PC/budgets still execute those opcodes. Existing
plain prefix specialization's sorter remains live (not a newly introduced
substitute); this bounded handoff is not complete AST flatten/substitution
parity. Eight durable pinned controls cover exact correlated SUM/window,
plain ASC/DESC, row_number ASC/DESC, child OFFSET, child order and zero LIMIT
with typed rows/names/reset/two runs. Native captures first; public7 matches.
Broad first 972/976 exposed WHERE key fallback and three lexical aggregate
regressions from the prior callback delegation: now delegate only local
aggregateUses depths; outer-owned functions retain lexical AggInfo output
callback. Corrected focused35/type/public local6 and broad976/976 pass,
including C1–C6/Chinook and selected lifecycle/limits checks. Outer-only
SUM/MAX in window arguments still fail: syntax-only grouped-producer trigger
does not consume resolver aggregateUses owning a nested function. This is
the next preparation/lifting dependency, not supported-shape permission.
Evidence work:///cards/card-t-d/c955-next/; no resource/encoding/origin matrix
or full R1–R4/analyzer/index approval. API contract unchanged.


### d outer-window NameContext partial repair

Physical-source window preparation now consumes resolver aggregateUses depths
(resolve.c1356–1378), not only top-level GROUP syntax, to route its inner
producer to the existing aggregate owner. No window-rewrite change: pinned
window.c748–766 explicitly does not lift nested aggregates as local window
terminals. The ordinary aggregate owner enrolls them through its existing
linked nested-plan walk (expr.c analyzeAggregate7405ff). Its lexical scalar
callback now precedes the specialized ORDER/LIMIT gate for unordered children
and applies expr.c's numeric X<>0 scalar LIMIT before OpenRead/Rewind.

Owning primitive correction: nested outer columns in WHERE/projection need
AggInfo saved first-row values after accumulator finalization, just like bare
output columns. The no-GROUP capture now enrolls those columnUses and maps
their existing accumulator registers into AggregateColumnOwner; directMode
is false for final output, matching select.c updateAccumulator6950–6966 and
first-row regAcc8838–8864. Previously outer scalar predicates reread exhausted
physical cursors. No independent evaluator, VM PC/Mem/Btree/budget change.
Ordered lexical children remain specialized/rejected rather than silently
ignoring ORDER. Existing local-aggregate delegation stays depth-guarded.

Six fresh pinned controls (typed rows/names/reset/two runs) cover physical
window outer SUM REAL+bad-TEXT LIMIT, bare outer SUM, grouped predicate, zero
LIMIT, nonwindow predicate, and local+outer operands. Type/public6/focused128
pass; broad982/982 including C1–C6/Chinook and selected lifecycle/limits passes.
Evidence work:///cards/card-t-d/outer-window-owner/. Retained CTE outer-only
SUM and recursive outer MAX remain red: retained preparation re-resolution
and nested result substitution must preserve aggregate owning depth, and
recursive aggregation needs its payload producer (not OpenRead on synthetic
root). A trial broadening the trigger hit synthetic page11; it was restricted
to physical callers, not labeled unsupported permission. Source graph versus
VM ownership/R1–R4/resource/RIGHT gaps unchanged; API contract unchanged.


### d retained ordinary-CTE outer aggregate repair

Source comparison: select.c substExpr/substSelect3782–3940 traverses nested
EList/GROUP/ORDER/HAVING/WHERE; TS substituteViewExpression updated only nested
WHERE. The bounded ordinary derived flatten owner now also substitutes nested
result and clause carriers, excluding locally shadowed qualifiers and bare
local names. A producer qualifier is explicitly carried through this boundary
so a replacement bare `a` cannot rebind to inner `u.a`. It is not stored as an
output alias. This remains a bounded lexical representation adaptation, not
general resolved-iTable substitution parity (unqualified correlated references,
multi-source aliases, compound nested FROM and general flatten remain gaps).

Window retained ordinary CTE caller now uses its existing bounded
flattenOrdinaryDerived owner before retained-source lowering, when child is
not aggregate. Child aggregate, DISTINCT/GROUP/ORDER/LIMIT/compound producers
retain their existing specialization. Thus ordinary CTE nested outer SUM flows
through physical window preparation -> shared aggregate owner -> lexical
AggInfo scalar callback, preserving outer cardinality and saved bare row.
No VM PC/register/Mem/Btree/budget/suspension changes or completed-PC copy.

Fresh pinned native-first six CTE controls cover REAL+LIMIT0.5 outer SUM,
outer-only predicate, local+outer operands, local-only SUM, qualifier shadowing,
zero LIMIT; typed rows/names/two runs/reset/done/finalize pass. Initial rewrite
failed because replacement `a` rebound locally; explicit producer qualification
corrected it. First focused run found illegal aggregate-child flattening;
restored that retained specialized branch, no test weakening. Guarded type,
public6, focused282, broad988/988/C1–C6/Chinook/selected lifecycle+limits/diff
pass. Evidence work:///cards/card-t-d/retained-owner/. Direct derived probes
are still rejected by existing derived admission and remain a gap (not
passed/waived); original recursive outer MAX still returns three rows rather
than pinned [5,5]. Next recursive seam is common aggregate producer capture
via coroutine payload, not opening synthetic root. Prior resource/RIGHT/index
and R1–R4 debt unchanged; API contract unchanged.


### d recursive outer aggregate input boundary closure

The accepted recursive outer MAX window control now matches pin [5,5].
Window preparation consumes nested owning aggregateUses for recursive sources
as for physical sources. Its grouped inner producer receives the original
linked resolved sources/nested carriers (with rewritten source result), not
re-resolution against a synthetic schema root. It composes the existing
recursive queue producer into a nested SRT_Coroutine payload on the enclosing
builder and supplies a compile-time input emitter to compileAggregateSelect.
The aggregate owner sets its existing AggregateColumnOwner.sourceRegisters
to that payload: reset/WHERE/step/bare capture/finalize/projection remain
aggregate-owned; recursive queue/Current/termination stay recursive-owned.
No runtime evaluator, completed Program copy, or synthetic OpenRead.

select.c updateAccumulator6915–6966 controls bare-row retention: one min/max
uses the existing AggStep change register (CollSeq/regHit semantics) to capture
the winning row; ordinary aggregates save the first admitted input row.
Final output uses saved AggInfo columns with directMode false. Nested scalar
WHERE/LIMIT observes finalized registers and saved outer row. Empty scans
still finalize; correlated accumulator initialization remains explicit.
Grouped/multiple-minmax general input and preparation remain outside this
bounded handoff, not claimed compatible.

Pinned vdbe.c OP_Yield1229ff/EndCoroutine return-PC swapping and vdbeaux.c
ResolveLabel636ff compared: new source start/consumer end/backedge relocation
belongs to SelectProgramBuilder labels, not VM PC copying. VM coroutine Mem,
register/cursor/budget/suspension/reset/finalize remain unchanged. Existing
retained compound/grouped/local aggregate specializations remain live. Root
WHERE/index/RIGHT contracts not changed.

Six native-first recursive typed/name/two-run/reset controls cover exact MAX
with correlated WHERE, MIN, REAL SUM, zero LIMIT, local+outer MAX, empty child
WHERE. Original post-c955 public integration controls now all pass. Guarded
type/public/focused114/broad994/994 including C1–C6/Chinook and selected
lifecycle/limits/diff pass; evidence work:///cards/card-t-d/recursive-aggregate-input/.
Two initial type failures (syntax then exact optional linkedPlan) corrected
before public verification. No resource/suspended native parity or general
architecture/R1–R4 approval; direct-derived admission and general qualified
substitution debt from previous revision remain. API unchanged.


#### Ordinary physical output/drain graph closure ([[card:card-t-b]])
compileTableSelect physical output now builds its direct/sorted destination graph in one local SelectProgramBuilder, publishing finish after SELECT-owned terminal Halt. select.c generateSortTail1673ff addrContinue/addrBreak and selectInnerLoop own DISTINCT/filter bypass, OFFSET-before-destination/count-after, empty sorter/drain/next. Removed tail arrays/splice/result-opcode scans and scanContinue/first IfPos/decrement/Halt searches. sqlite3WhereEnd3538ff now falls through to SELECT-owned drain instead of inserting premature Halt; the SELECT marks its continuation before source unwind; existing IN restart/seek/bound/NULL exits remain source-owned. Actual DISTINCT/residual/offset/limit/sorter consumers use builder labels, not an unused facade. Ordinary register/parameter/cursor preparation still manual; no general allocator or nTab closure claimed. Root phase-aware seek seam unchanged.
Source-first DISTINCT INTEGER DESC LIMIT/OFFSET exposed planner-authorized reverse table loop emitted Rewind/Next despite consumed ORDER. Corrected owning positioning to Last and paired Prev for ordinary reverse table scans (wherecode.c aStartOp/aStep, where.c sqlite3WhereEnd7520ff). Intermediate Prev-with-Rewind error corrected at source positioning, not VM. Native3/public3 now agree including ordered empty/direct filtered controls; metadata/reset verified publicly, no native origin/resource parity. Joined b resolveLabel RIGHT validation, c/d scalar LIMIT/Once/NULL/phase/aggregateOutput/recursive input/compound limits and late d305 finish unchanged. Guide/source mapping boundedly updated, API signatures unchanged. General preparation/full analyzer/RIGHT/nTab/resources/direct-derived/grouped/multiple-minmax/unqualified substitution/R1–R4 remain unaccepted.

### Physical scalar LIMIT integration repair ([[card:card-t-d]])
Pinned expr.c3933–3962 sqlite3CodeSubselect normalizes scalar/EXISTS LIMIT X
as numeric-affinity X<>0 before SELECT integer admission. Physical
compileTableSelect.compileExpressionSubquery previously invoked ordinary
computeLimitRegisters, rejecting REAL0.5 while shared linked/aggregate callers
accepted it. computeScalarLimitRegisters now owns this normalization for the
physical callback, resolvedScalarSubqueryEmitter and lexical aggregate callback.
Destination NULL/Exists initialization precedes guard; correlated calls still
reinitialize, uncorrelated Once still skips repeated execution. NULL comparison
remains NULL and MustBeInt produces code20; finalize preserves that saved error.
IN retains ordinary LIMIT/count decrement. No VM, WHERE, cursor, budget or graph
finish changes. Physical independent scan remains live; this is guard semantic
ownership consolidation, not migration of its whole producer. ORDER/OFFSET scalar
admission remains rejected; no supported matrix narrowed to conceal that gap.
Native-first ten controls (nine typed/name/two-run successes plus NULL code20)
and fresh integration18 pass. Final type/focused268/broad1008 incl C1–C6/Chinook,
selected lifecycle/limits/diff and unchanged-input hash comparison pass. Earlier
NULL test failed by forgetting finalize rethrows saved error; fixed test cleanup,
not runtime. Evidence work:///cards/card-t-d/physical-scalar-limit-repair/.
Next seam remains physical scalarPlans linked carriers into shared scalarPrepared
producer/destination, with allocation/cursor identity and Once/NULL/phase/reset
preserved; full general preparation/AggInfo/nTab/R1–R4/native BLOB/origin/encoding/
resource/suspension debt remains. API unchanged.


### Physical linked scalar caller convergence ([[card:card-t-c]])
Current physical compileTableSelect passes already-linked scalarPlans via
resolvedScalarSubqueryEmitter to shared scalarPrepared compileInnerTableSelect
(Mem or Exists) and compileAggregateSelect (Mem). Supported nonordered physical
projection, correlated scalar aggregate and nonaggregate EXISTS now consume real
shared production, not the physical callback's replayed scan. The caller syncs
manual parent registers with builder.registers before/after production and
reserves live nested/IN cursor ranges; enclosing destination/Halt/finish remains
physical-owned. Explicit mappings retain local source versus positioned outer
identity/affinity. expr.c3841–3978 owns Once, NULL/Exists0 initialization before
shared numeric scalar LIMIT and error admission; resolve.c1392–1419 supplies
correlation, selectInnerLoop SRT_Mem/Exists first-row exit and select.c8860–8919
AggInfo reset/update/finalize supply actual producers. Per-invocation AggReset
and d368 computeScalarLimitRegisters remain unchanged. Shared nonaggregate
Exists now initializes0 and emits Exists destination, never a projected value.

Physical ordered scalar, aggregate EXISTS, IN, zero-source and transient derived
count/sum remain live specialized callers and are intentionally not deleted.
Attempted ordered handoff returned first source row instead of sorted winner:
shared producer suppresses sorter when no ordinary limit, but scalarPrepared
already owns its guard. Retained ordered specialized production until that
source-owned sort-tail contract migrates, and restored shared ORDER rejection.
No supported physical route regressed/reclassified; ORDER/OFFSET remains prior
admission debt. No new window/join ORDER or aggregate-Exists admission implied.
No VM workaround, child Program/PC copy, generic evaluator or root WHERE changes.
Preopened physical nested reads remain necessary for live fallback routes.
Ordinary preparation/manual allocator/frontier, general dispatcher, zero-source,
subroutine reuse, full identity/AggInfo/nTab/R1–R4 and native resource/origin/BLOB/
encoding parity remain incomplete. Existing physical0..30/private24 and b
Last/Prev/drain/late finish/RIGHT contracts preserved.

Native-first eight full enclosing controls (source-ID asserted) cover correlated
projection/REAL SUM/MAX/empty/zero/numeric LIMIT/local shadow/EXISTS and ordered
fallback. Typed rows/names/reset/done/finalize in existing linked-scalar test;
d numeric9/integration18 independently rerun (original19 ORDER/OFFSET gap not
claimed green). Physical structural gate protects shared delegation/frontier;
Mem gate now recognizes destination conditional for Exists as well as literal.


### Ordered linked scalar destination closure ([[card:card-t-b]])
Current resolvedScalarSubqueryEmitter now hands ordinary scalar projection ORDER/OFFSET to compileInnerTableSelect with scalarPrepared and explicit sharedLimit. expr.c3933–3962 normalization owns X<>0/numeric guard/NULL datatype20, initialized Mem/Exists and Once; SELECT gets count1 default or normalized count, integer OFFSET and combined/capacity ranges. select.c selectInnerLoop SRT_Mem and generateSortTail1673ff own OFFSET-before-destination, destination/count/first-row exit, empty NULL and drain labels. No ordinary raw-LIMIT reevaluation. Scalar-prepared producers intentionally retain c945 full scan adaptation (phase-aware candidate operand seam); now multiOrderConsumed cannot claim ordering from the planner path whose physical loops are suppressed. Otherwise DESC lost sorter and yielded1 instead of7. Scalar correlated sorter opens before scan each invocation, not only after first accepted WHERE input, fixing empty/first transitions without VM patch.
Physical ordinary ordered scalar callers now delegate actual linked shared production; removed their superseded manual ORDER/SorterOpen/insert/drain/ClearSorter mechanism. IN/zero-source/transient/aggregate EXISTS live, no indiscriminate removal. Aggregate scalar ORDER singleton remains aggregate-owned; aggregate OFFSET admission still explicit temporary (not approved permanent exclusion). Nonaggregate physical OFFSET now translated using normalized scalar count; no product scope change. Shared cursor/register/parameters/outer phase/Once/frontier/late finish preserved. Public signatures unchanged. Native-before full enclosing8 includes existing correlated/empty crash and OFFSET admission gap; seven row controls plus NULL20 saved-finalize regression added. Selected typed/reset/origin controls are not full resources/BLOB/encoding/suspension fidelity. Full preparation/AggInfo/nTab/RIGHT/phase-aware seeks/R1–R4 remain unaccepted.

### Finalized aggregate ordinary scalar destination integration ([[card:card-t-d]])
compileAggregateSubquery now delegates child-local ordinary scalar result rows
(including ORDER/OFFSET/normalized LIMIT) through resolvedScalarSubqueryEmitter
and compileInnerTableSelect with resultLocation's saved/grouped AggInfo phase.
Pinned expr.c3933–3962 preparation and select.c1418–1442 Mem/sort-tail remain
shared owners; aggregate parent owns grouping/finalization and outer binding.
Outer-owned lexical aggregate and specialized EXISTS/IN/transient producers stay
live. The old ordered branch is retained for nonmigrated lexical cases, not
claimed removed: trial deletion was reverted before final checks. No VM/WHERE
index/physical0..30/private24 or public API changes. Fullscan phase adaptation
remains; no general identity/AggInfo/nTab architectural completion claim.
Accepted grouped count + ordered scalar REAL0.5 OFFSET1 reproducer now gives
pinned [0,1,5],[1,2,5],[2,1,5]. Native-first8 found seven passing phase controls
(grouped correlated/unrelated/empty/zero guarding bad OFFSET/text/REAL and MIN)
and an adjacent MAX winning bare-row gap: max=7 but saved a=1 instead of7;
scalar consequently NULL instead of3. That control is preserved in evidence,
not included as a passing regression or claimed fixed. Physical aggregate bare
capture still uses Once whereas recursive input's single-minmax change guard
already mirrors select.c updateAccumulator6915ff. Next owning repair is that
physical/join capture, not an ordered scalar SQL patch. Native errors/resources/
suspension/general retained/recursive/IN/aggregate OFFSET debts remain.
Final type/focused338/public7 and immutable all-src/test broad1033 including
C1–C6/Chinook/selected lifecycle+limits pass; evidence and exact command logs
work:///cards/card-t-d/grouped-scalar-owner/. API unchanged.


### Physical/join AggInfo magnet capture repair ([[card:card-t-c]])
Supersedes the adjacent MAX bare-row gap recorded under d377 above: native
max=7/bare a=7/scalar3 now matches. compileAggregateSelect physical and joined
no-GROUP owners invoke emitPhysicalAccumulator AFTER WHERE/ON admission. It
steps before capture, and shares one captureChange (inverse polarity of pinned
regHit/skipFlag) across invoked unordered min/max in aggregate-list order;
last invoked NEEDCOLL function owns capture, not an asserted unique minmax.
The ordinary no-minmax case retains first-row Once, now after steps. Empty
input captures nothing. Reset initializes magnet/seen per invocation alongside
AggReset; direct input versus saved resultLocation/accumulator phase unchanged.
Shared scalar finalized binding observes winning saved columns, not a query
specific patch or new scalar evaluator. Grouped sorter and recursive specialized
capture remain their existing owners, not silently replaced or generalized.

Source: select.c updateAccumulator6810–6977, sqlite3Select8870ff; func.c
minmaxStep2107–2143. CollSeq initializes regHit only when invoked; duplicate
DISTINCT bypass retains previous magnet, so DISTINCT ties may capture a later
bare row (native max(DISTINCT a%3),a =>2,7), unlike ordinary ties =>2,5.
The TS extrema callback now returns capture=true for NULL while no non-NULL
best exists, matching minmaxStep's absent skipAccumulatorLoad. Once a best
exists NULL/ties/nonwinning values suppress capture. This callback semantic
fix applies to existing consumers without VM changes; shared Mem/budgets kept.
FILTER's source copy-regAcc-before-jump is represented via seen/inverse magnet;
physical FILTER admission itself currently raises baseline internal execution-
only-lowering error on tested forms and is NOT claimed repaired/supported here.
No scope change or reclassification. Aggregate ORDER-delayed min/max is not
asserted to capture a winner at row ingestion. Multiple-minmax general grouping/
recursive/filter combinations remain unproved; native sampled physical
max(a),min(a),a follows last min's capture, not a unique-minmax guarantee.

Native-first14 include physical/join max/min, ordinary ties/NULL/empty,
DISTINCT ties/multiple minmax/ordinary count/grouping/correlated reset plus two
FILTER baselines. Twelve admitted controls and d's enclosing MAX scalar added
to existing typed/name/two-run/reset/done/finalize tests. FILTER errors retained
explicitly in artifacts, not excluded to conceal row regressions. No SQL-text
special case, VM/WHERE/root cursor0..30/private24/index/RIGHT/late finish change.
General AggInfo/identity/nTab/admission/resources/R1–R4 remain open. Evidence:
work:///cards/card-t-c/minmax-capture-repair/ native.py/oracle.json/public-before,
public2 (FILTER errors), success12.json/public8/scoped.patch/final logs.

### Grouped accumulator capture closure ([[card:card-t-d]])
Grouped compileAggregateSelect sorter drain now mirrors select.c
updateAccumulator6880–6977 shared regHit, represented by inverse changed magnet:
all unordered NEEDCOLL min/max steps share it, last invoked controls capture;
DISTINCT bypass preserves previous state. Per-group seen/regAcc and initial
magnet reset alongside AggReset at first/next group, outside CompareGroup
backedge. FILTER copies inverse seen before branch, suppressing saved payload
overwrite on later rejected rows. Ordinary no-minmax retains first admitted
payload after steps; columnOwner.directMode selects sorter then saved phase.
No scalar output/VM/WHERE/private24 workaround or speculative recursive merge.
Multiple grouped min/max and grouped FILTER reproductions now match pin;
eight typed/name/two-run/reset controls include NULL/DISTINCT/empty filter,
ordinary count, both minmax orders and enclosing saved-winner scalar OFFSET.
Native18 full public remains exit1 only for physical minmax FILTER internal,
aggregate+window internal lowering, and plain recursive aggregate admission.
These remain obligations, not owner exclusions. Next preparation owner must
preserve aggregate/window/FILTER carriers before execution-only scalar lowering;
R1–R4/general AggInfo/nTab/resources/native origin/BLOB/encoding/suspend debts
remain. Final type/focused359/original d8/native grouped8 and immutable broad1054
C1–C6/Chinook/selected lifecycle+limits/diff pass. Evidence:
work:///cards/card-t-d/grouped-capture/; API unchanged.


### FILTER call arity and local aggregate window producer ([[card:card-t-c]])
Supersedes d386's two INTERNAL carrier gaps, not its recursive admission debt.
Physical max(a) FILTER(WHERE a<7),a now yields typed [5,5]. Its failure was
BEFORE AggInfo: selectHasAggregate counted descendant expressions including
FILTER as min/max arguments, routed to compileTableSelect projection5375,
and leaked an execution-only aggregate to scalar lowering1893. Count arguments
with the existing aggregateParts semantic production, not a second descendant
walk; FILTER/ORDER/OVER children are separate. select-compiler aggregate entry
now consumes shared compileAggregateSelect → lowerResult/AggInfo → emitSteps,
FILTER-before-arguments → post-step magnet → saved result output. Scalar guard
remains unchanged. No aggregate added to scalar evaluator or SQL special case.

Aggregate+window failure was another producer classification gap: window
rewrite lowered aggregate/column payloads correctly but groupedLayer selected
only syntactic GROUP or nested outer aggregates. It now recognizes resolver
aggregateUses owner depth0 in addition to existing nested ownership, selecting
the existing aggregate coroutine producer even WITHOUT GROUP BY. Retained
source still owns its separate production; no new generic evaluator/VM path.
Window buffer receives finalized aggregate and saved winner from the same
builder via compileAggregateSelect, then executes windows over that payload.
Producer WHERE/empty/no-GROUP one-row aggregate, deferred window placeholders,
window ORDER/sorter/lifecycle and scalar destinations retain existing owners.
Pinned authority: resolve.c resolveExprStep1275–1356 separates x.pList arity
from window/filter properties; select.c analyzeAggFuncArgs6518–6548 separately
analyzes args/order/FILTER; sqlite3Select7699 runs window rewrite before aggregate
analysis; window.c selectWindowRewriteExprCb780–835 lifts TK_AGG_FUNCTION and
TK_COLUMN into sublist, sqlite3WindowRewrite996ff transfers aggregate/group/
HAVING work to the subquery and clears outer SF_Aggregate. TS keeps its object/
async/phase representations; this repair removes wrong scalar dispatch, not
an algorithm substitution or a claim of complete AggInfo analyzer fidelity.

Independent native FIRST14 over physical/join FILTER, REAL/NULL/empty/DISTINCT,
local aggregate window/count/multiple and correlated scalar FILTER were captured
BEFORE consuming edits. Thirteen now pass typed/name/two-run/reset/finalize
public controls, added to existing linked scalar suite. Correlated scalar FILTER
remains baseline temporary admission ('this scalar subquery shape is not
implemented'); full14 is NOT green. Original d full18 now only plain recursive
aggregate unsupported, not physical/window INTERNAL. Preserve this obligation,
not an owner exclusion. No grouped/physical magnet/reset/callback modification;
b count/OFFSET/order/Mem and d saved result phases untouched. Native metadata
origins/BLOB/encoding/resource/suspension parity, deeper retained/recursive
windows, general identity/AggInfo/nTab/preparation R1–R4 remain unproved.

Fresh type/focused372/public13 pass; immutable final src/test broad1067/1067
including C1–C6/Chinook fail/skip/cancel0, hashes OK. Evidence:
work:///cards/card-t-c/carrier-repair/{before.ts,stack.mjs,native.py,oracle.json,
public-before.log,public1.log,public18.log,success13.json,public13.log,focused.log,
broad.log,inputs.sha,immutable.log,scoped.patch}. Baseline stack proves actual
production callers; full matrices preserve residual admissions explicitly.


### Ordinary recursive aggregate input closure ([[card:card-t-b]])
Current compileSelect recursive branch now selects compileRecursiveAggregateSelect with real schema/database, replacing SUM-only argument/destination/evaluator specialization. It reuses recursive-window resolver-only transient SrcItem description (prepareRecursiveSource), resolves immutable linked NameContext, composes existing compileRecursiveCteSelect Queue/Current producer to SRT_Coroutine on same builder, then feeds compileAggregateSelect input.first/emit. No rootPage0 OpenRead, synthetic read producer, new runtime or completed Program relocation. TableNode metadata is the existing browser resolver representation of CTE SrcItem columns, not new physical schema. Input registers own direct AggInfo reads; saved/final binding owns output. SELECT owns WHERE/step/bare capture/AggReset/finalization/destination and consumer LIMIT/OFFSET; producerOnly keeps CTE body LIMIT separate. Enclosing entry publishes shared parameter names and late Halt/finish after all labels. Retired SUM aggregate-expression path only in this migrated consumer; other destinations stay live.
Source: select.c generateWithRecursiveQuery2667–2830 Queue/Current/setup/recursive/destination/body limits, sqlite3Select preparation and SrcItem coroutine path, selectInnerLoop Mem/Output/Coroutine, updateAccumulator6880–6977 shared regHit/regAcc NEEDCOLL/FILTER, expr.c saved aggregate column phase. Streamed input now reuses existing emitPhysicalAccumulator rather than independent exactly-one-minmax capture: last invoked magnet controls bare row; FILTER regAcc-before-jump and DISTINCT bypass preserved; ordinary aggregate saves first admitted input; empty finalizes once. This closes plain recursive MAX+bare pin5/5. SUM/count/min/max/FILTER/WHERE-empty/DISTINCT/REAL/multiple-minmax/LIMIT0/OFFSET controls pass selected matrix. GROUP/HAVING and nonordinary multi-source/compound consumers remain explicitly unsupported, scalar nested output admission remains a separate debt; no silent partial grouping or scope exclusion. Nine native-first full enclosing typed/name/reset controls added; original public18 no longer has this admission failure. Grouped/correlated full matrix residuals remain documented, no resource/origin/BLOB/encoding/suspension parity claim from selected controls. General preparation/AggInfo/nTab/R1–R4 remain open. Public method signatures unchanged; admitted recursive ordinary aggregate output broadened through existing semantic owner, not SQL-text special cases.

### Linked scalar aggregate FILTER caller closure ([[card:card-t-d]])
resolvedScalarSubqueryEmitter and finalized/grouped compileAggregateSubquery
now admit FILTER for child-local ordinary aggregate result into existing linked
compileAggregateSelect (not scalar evaluation). FILTER semantic carrier binds
inner cursor and outer current/saved AggInfo phase; shared emitSteps owns
predicate-before-args/step, AggReset per invocation, capture/finalization and Mem.
Pinned select.c updateAccumulator6880ff separates FILTER from arguments and
copies regAcc before branch; expr.c scalar preparation remains NULL/Once and
numeric limit guard. DISTINCT/order/offset/EXISTS/outer-owned aggregate
restrictions stay live; no general guard removal or VM/WHERE/private24 edit.
Accepted correlated MAX FILTER returns [1,NULL],[3,1],[5,3],[7,5]. Eight public
native controls cover MAX/MIN/SUM REAL/count, uncorrelated Once, zero/REAL limit
and grouped saved-winner outer binding, two-run/reset/finalize. Original native15
now only recursive GROUP/nested scalar and grouped FILTER-window admissions
remain (not exclusions). Additional8 captured post-first edit, pre-grouped-caller
edit; original15 preconsuming capture is primary independent repair oracle.
Type/focused410/immutable broad1084 C1–C6/Chinook/selected lifecycle+limits/diff
pass; evidence work:///cards/card-t-d/scalar-filter/. No general identity/AggInfo/
nTab R1–R4/native origins/BLOB/encoding/suspension/resource parity claim.


### Recursive grouped input closure ([[card:card-t-b]])
Supersedes the prior ordinary-input GROUP/HAVING admission debt for bounded
single recursive SrcItem aggregate consumers. compileRecursiveAggregateSelect
now passes GROUP/HAVING through the real linked plan and same Queue/Current →
Coroutine input. compileAggregateSelect's existing grouped sorter population
consumes input.emit(insertGroupedRow), evaluating consumer WHERE then GROUP keys
and copying queue payload registers. Physical OpenRead/Next and groupedStream
production are bypassed only when genuine parent.input exists; neither is removed
for live callers. WHERE rejection returns to the input owner's next Yield.
SorterSort empty exit, key comparison, AggReset, seen/magnet reset, shared
FILTER-before-arguments/DISTINCT/last-invoked minmax capture, saved/final phase,
HAVING and result destination/ORDER/LIMIT/OFFSET remain the existing group owner.
The queue body LIMIT/OFFSET stays producer-owned; no new runtime/evaluator,
rootPage0 physical read or completed Program relocation. Same enclosing builder,
parameters/register/cursor labels and late finish remain. TS register payloads
are the browser representation of the C coroutine SrcItem and AggInfo sorter
payload, not an exceptional grouping algorithm substitution.
Pinned select.c: generateWithRecursiveQuery2790–2835 emits Current before
recursive resume; sqlite3Select8570–8615 constructs GROUP key/AggInfo payload
sorter and switches useSortingIdx; 8650–8745 compares groups, outputs/resets on
transition and final exhaustion; updateAccumulator6830–6970 owns FILTER regAcc,
NEEDCOLL regHit/DISTINCT and saved bare capture. Existing sorter/group bytecode
is retained, not newly asserted as complete AggInfo analyzer parity.
Native FIRST11 before consuming edits covers exact grouped MAX+bare, multiple
minmax, FILTER, DISTINCT, all-NULL aggregate, REAL/ordinary first bare, empty,
HAVING/ORDER/consumer limits, NULL key and body LIMIT/OFFSET. Additional five
post-migration native controls cover ties, all-filtered first bare, multiple
FILTER, NULL source and saved correlated scalar FILTER. Public typed/name/two-run
reset/done/finalize regressions reside in the existing linked scalar suite.
Full original15 now retains two admissions: recursive nested zero-source scalar
and combined grouped FILTER-window. No full15 success, origin/BLOB/encoding/
resources/suspension parity or R1–R4/general identity/AggInfo/nTab claim.
Evidence: work:///cards/card-t-b/recursive-group-repair/; public API signatures
unchanged, bounded recursive grouping admission broadened rather than narrowed.

### Prepared zero-source scalar consumer closure ([[card:card-t-d]])
Finalized/grouped compileAggregateSubquery delegates child-local zero-source
SELECT to resolvedScalarSubqueryEmitter. Removed its unbound compileExpressionTree
shortcut: linked Mem/Exists producer now initializes NULL/0 and Once/normalized
scalar count, skips on WHERE/offset, binds result with enclosing saved AggInfo
and visits selectInnerLoop/destination once without physical WHERE planning.
bindResolvedExpression no longer preserves prebound cursor when a semantic
binding is supplied; rebind owns coroutine/sorter/saved phase. Pinned expr.c
sqlite3CodeSubselect3841–3950 owns correlation/Once/init/limit and select.c
selectInnerLoop owns destination; zero SrcList needs no cursor loop. Failed
empty-SrcList physical planner trial produced invalid cursor; rejected, not VM
patched. DISTINCT/GROUP/compound/VALUES/outer-owned aggregates stay guarded.
Eight typed/name/two-run/reset controls cover recursive ordinary/grouped saved
winner, child WHERE false/true, scalar REAL/zero LIMIT and OFFSET; original
pre-edit14 supplies accepted independent oracle, extra10 was captured post-code.
Full extra10 retains unrelated physical zero-source WHERE defects (literal WHERE0
returns42; correlated physical child admission rejects), not exclusions. Combined
grouped FILTER-window remains the original15 admission. General preparation,
identity/AggInfo/nTab/R1–R4/origin/BLOB/encoding/resource/suspend parity unproved.
Type/focused434/immutable broad1108/public8+original18 pass. Evidence
work:///cards/card-t-d/zero-scalar/. Public contracts/signatures unchanged.


### Physical singleton scalar caller migration ([[card:card-t-c]])
Supersedes d404's physical zero-source bypass only. compileTableSelect's
compileExpressionSubquery now hands scalar zero-source children (including
EXISTS) to existing resolvedScalarSubqueryEmitter/prepared singleton SELECT.
The caller supplies linked outer CURRENT cursor binding and synchronizes the
manual register frontier/cursor reservation before and after handoff, just as
its physical child producer. Removed old unconditional Copy/Exists1 shortcut,
which ignored WHERE/count/offset and failed correlation/Once. No empty SrcList
physical WHERE loop, child Program/manual PC copy, SQL-specific evaluator or VM
change. Physical source bound at cursor0, nested source reads keep relocated
cursors; prepared producer initializes NULL/0, skips Once only if correlated,
normalizes count, evaluates WHERE then offset then one destination visit.
Retained IN/derived/aggregate-EXISTS/lexical/GROUP/compound/VALUES restrictions
remain separate, no unsupported shape silently emits a partial result.
Authority: expr.c sqlite3CodeSubselect3841–3964 correlated/Once/NULL/count;
select.c selectInnerLoop SRT_Mem1422ff publishes after OFFSET/predicate admission;
resolve.c NameContext.nRef/pNext/correlated ownership. Shared Mem/Btree/KeyInfo,
async and d saved/grouped/recursive phase semantics unchanged. R1–R4/full
preparation/identity/AggInfo/nTab and index/resource/suspension parity not proved.

Existing independently pinned full10 reused BEFORE consuming edit, eight matched
two failed: physical42 WHERE0 gave42 notNULL; correlated WHERE/count/OFFSET
rejected. After caller migration full10 and original18 pass typed/name/two-run/
reset/finalize. Existing linked scalar suite adds both accepted controls and nine
post-code native boundary expansion cases (NULL/WHERE/count0/REALcount/OFFSET1,
REAL/correlated/EXISTS/descending output). Initial extra10 exposed deeper nested correlated singleton NULL for all rows
(pin5/7 on last rows), then the first broad run failed six existing UTF8/16
correlated-two-level/nested EXISTS regressions. Full extra10 now passes after
owning NameContext/producer fixes below. Capture is postrepair expansion, not
FIRST; not relabeled pre-code evidence. Original15 still only grouped FILTER-
window temporary admission. Passing focused445/public10+18 does not waive these.
Evidence work:///cards/card-t-c/physical-singleton-repair/ including baseline
before.ts, extra native script/oracle, public10/public18/public15/public-extra,
focused-final.log, broad.log, inputs.sha/immutable.log; native baseline reused
from work:///cards/card-t-d/zero-scalar/. No owner API signature change.


Physical singleton affected-path integration: first broad run1119 tests had six
failures (existing two-level correlation and nested EXISTS in all three
encodings), not erased by focused445/public10+18. resolve.c lookupName848–853
increments contexts up to the matching context; TS incremented only innermost
owner, so a singleton containing a correlated SELECT was wrongly Once cached.
TS nRef is a correlation-only marker (local refs are NOT correlation); increment
all intervening contexts before the matched context for outer references,
retaining this representation contract. Initial literal C inclusive increment
made local SELECT correlated and failed existing resolver-facing tests; adjusted
to preserve local=false. Nested physical compileInnerTableSelect also created a
fresh scalar emitter without passing its active cursor/outer-binding map;
resolve.c assigns global SrcItem cursor identities whereas TS linked sources
still use relocated mapping. Supply nested binding: local refs map via cursorFor,
outer refs via enclosing expressionBinding. Shared singleton callback then sees
correct current physical row and transitive Once state; scalar guard untouched.
This correction belongs to resolver+consumer, not a nested SQL workaround.
New deeper singleton regression and existing UTF8/16 full174 foundation suite
now pass. Final focused620 (prior11 files plus foundation) and full native10,
extra10, original18 pass. Original15 still only grouped FILTER-window temporary
admission; this repair does not widen GROUP/compound/outer-owned lexical work.
Artifacts preserve broad.log failure, nested.log inclusive-nRef trial failure,
nested2.log174 success, public-extra2/3/final, focused-own-final.log and final
immutable broad evidence. General correlation/identity/index/resource parity
is not established by these finite matrices. No VM/root/private-budget changes.

Final resolver contract alignment: second broad had1119 pass/1 failure: old
parser/resolver test explicitly expected intermediate deep.nested[0].correlated
false. Pinned lookupName848–853 plus native/public execution require true to
avoid stale Once. Updated that assertion with source note, retaining top-level
local=false and inner=true, source cursors/shadowing/ambiguity tests. This is
source-backed correction of an obsolete internal expectation, not suppression of
an SQL regression. Final focused650 includes resolver30 + foundation174; final
broad-complete and immutable-complete logs are the final acceptance evidence;
earlier broad logs retain actual failures. No src/test edits while final broad
runs. Full native10/extra10/original18 successful; original15 grouped FILTER-
window still temporary. Current bounded green is not R1–R4 approval.


### Grouped-to-window outer expression ownership ([[card:card-t-c]])
Supersedes the retained original15 grouped FILTER-window admission prediction.
Native-first full9 sibling baseline (source-ID asserted) and original15/18
are at work:///cards/card-t-c/group-filter-window-red/. All9 siblings rejected
before this slice; inner lowering returned columns0, not an accumulator/frame
exception. window.c selectWindowRewriteExprCb744ff rewrites terminals while
sqlite3WindowRewrite958ff moves GROUP/HAVING and persists AggInfo in the child.
TS lifted terminals correctly but outer output required whole-expression identity:
a%3 had lifted a, not a%3, so publication remained atomic unsupported.

compileWindowSelectLowering now binds surviving outer expressions through the
existing resolver carrier/expr lowering to finalized root payload registers.
Lifted aggregates consume their finalized payload; columns consume saved group
winner values, never raw source cursor; existing shared scalar producer receives
the same producer-row binding for correlated subqueries. The first trial omitted
that callback and admitted NULL for (SELECT t.a); corrected owning callback and
builder frontier synchronization. Ordinary outer ORDER/result aliases use the
same compiled entries. Existing window execution admission remains intact.
No new evaluator, guard-only acceptance, Program relocation, VM or WHERE change.
Grouped producer/updateAccumulator remains unchanged, preserving FILTER/regAcc,
NEEDCOLL/magnet/NULL/tie capture, resets and coroutine boundaries. Pinned expr.c
column/aggregate register consumption and resolve linked carrier identities own
expression lowering, not SQL-text recognition. No allocation/entry seam change
requiring b coordination was identified.

Regression matrix adds9 native-first cases to existing cross-layer public suite:
with/without FILTER, NULL/ties/filter0, incompatible windows/multiple aggregates,
empty GROUP input, saved correlation and descending ORDER/LIMIT/OFFSET. Public
full9/original15/original18 pass typed rows/two runs/reset; existing suite verifies
names/done/finalize. Evidence work:///cards/card-t-c/group-filter-window-repair/.
Type/focused437 pass; broad/immutable result must be read from current status,
not inferred from this note. No full origins/BLOB/encoding/error/resource parity
claim. Parent status79 R1–R4/reviewv3 and general preparation/identity/AggInfo/nTab
and C-subroutine/retained destination fidelity remain open. Public API unchanged;
unimplemented output expressions still reject atomically typed temporary.


### Recursive GROUP→window moved-column identity ([[card:card-t-d]])
Native-first post-c1000 public integration found INTERNAL for recursive GROUP
with `(SELECT (SELECT q.a))` plus first_value: pinned rows
[0,3,3,3],[1,7,7,3],[2,5,5,3]. Physical sibling matched. Stack evidence
places the first failure in compileAggregateSelect result binding, not VM step.
window.c selectWindowRewriteExprCb744–829 copies outer-source TK_COLUMN even
inside scalar children into the grouped producer and rewrites its consumer to
an ephemeral payload column. Recursive lowering reuses the resolver-only queue
source plan: replacing only plan.source omitted the moved child's columnUses.
The producer now publishes moved outer-source uses with local selectDepth0,
retaining original source/reduction identities and nested correlation metadata.
No token re-resolution, scalar evaluator or VM exception workaround is added.

The next divergence was producer publication: recursive grouped expressions
were being rebound/recomputed from queue positions; bound columns used raw
queue columnIndex instead of grouped payload position. All grouped producers
now copy their finalized expression payload by producer/buffer position through
emitProducerBinding. Ordinary recursive non-grouped producers still use queue
columnIndex and current expression binding: their dependency is different. An
initial overbroad trial broke that live branch (focused failures retained) and
was narrowed at this ownership distinction. This retires the grouped recursive
raw-source recomputation only; other manual PC/allocation branches remain live.
Compiler owns moved semantic graph, allocation, labels and coroutine payload
contract. VM retains InitCoroutine/Yield/Once PC/register/Mem/budget/reset and
suspension; root WHERE/index/RIGHT/private24 contracts unchanged. No API change.

Regression adds exact original SQL plus six independently pinned siblings to
select-window-cross-layer-integration: shallow/deeper correlation, FILTER saved
winner, singleton WHERE/numeric LIMIT, window argument, incompatible windows,
empty groups; names/types/two executions/reset/done/finalize. Original oracle
was captured before consuming edits; extra6 after edits, not native-first.
Evidence work:///cards/card-t-d/recursive-window-identity/ and post-c1000/;
current status contains exact commands/hashes/outcomes. Four unrelated scalar
DISTINCT/GROUP/compound/multisource admissions remain unresolved, not exclusions.
No general identity/AggInfo/nTab/subroutine/metadata/error/storage/resource or
R1–R4 architecture acceptance follows from this bounded closure.


### Ordinary physical entry construction ownership ([[card:card-t-b]])
Pinned select.c sqlite3Select7590–7695 obtains the enclosing Parse Vdbe and
SelectDest; selectInnerLoop1140–1205 assigns its result range from Parse.nMem;
vdbeaux.c610–650 and2647–2685 keep label resolution and MakeReady on that owner.
The ordinary single-table producer now consumes the actual entry builder,
parameters and destination. Result, expression/IN/LIMIT/scalar registers, sort
keys, nested and private sorter cursors allocate on that frontier; scan and
sorter drain dispose through the supplied destination. Local register counters,
scalar highwater handoffs and hardcoded result register1/output are retired in
this branch. Entry emits the terminal Halt and finishes after producer exits;
the standalone compileTableSelect wrapper does the same for still-live callers.

Fixed physical WHERE cursors0/3 and reserved0..30/private24 remain deliberate
partial-migration contracts; nested physical cursor namespace starts beyond999
via builder reservation, not a separate counter. They are not general nTab
fidelity. Ordinary labels/WHERE positioning, reverse/seek/IN/error gates, result
metadata and VM/Mem/Btree/budgets are unchanged. Other JSON/derived/join/compound
specializations still return independently published programs: the entry only
finishes its builder when the producer returned that same ops identity. This
identity distinguishes live ownership (no completed-child splice), not shape
reclassification or fallback after error. Those producers remain R1 obligations.

Seven independent native-first controls (source-ID asserted) exercise ordinary
scan/sort/DISTINCT/IPK seek, nested singleton, INTEGER/REAL/NULL, empty and LIMIT0.
Durable test checks typed rows/two runs/reset/done/finalize and names, recording
existing rowid public-name versus native IPK-name divergence explicitly. This
migration does not repair that prior naming gap. Existing broader tests supply
bindings, atomic errors, physical index and lifecycle coverage, not a new full
native cross-shape oracle claim. Evidence/actual command outcomes are in current
status and work:///cards/card-t-b/ordinary-entry-repair/. No new supported shapes,
algorithm substitution, full metadata parity or R1–R4 acceptance claimed.

### Bounded fourth-checkpoint compound collation correction

The independently pinned 3.53.4 matrix exposed wrong UNION/INTERSECT/EXCEPT
rows when explicit compound ORDER COLLATE differed from set equality. The
existing two KeyInfo objects alone were insufficient: `select.c:5502–5584`
`convertCompoundSelectToSubquery` runs before merge and moves ORDER/LIMIT to
an outer SELECT whenever a set prefix and explicit ORDER collation coexist
(ALL-only remains mergeable). `emitScalarCompoundMerge` now composes the
unordered set producer into a same-builder coroutine, then sorts surviving
payload using the outer ORDER KeyInfo. Inner merge/duplicate KeyInfo remain
independent (`select.c:2600–2630,3502–3523`); equality is never ORDER equality.
No SQL-text special case, VM workaround or extra DISTINCT evaluator was added.
Compound LIMIT/OFFSET apply only while draining outer sorting.

The checkpoint's repeated NOT MATERIALIZED VALUES CTE structural red also
proved a real producer-ownership divergence, not justification for deleting
its assertion. `fromClauseTermCanBeCoroutine:7266–7290` permits independent
repeated NOT MATERIALIZED sources. The compound CTE arm delegates its retained
producer into the shared destination/builder rather than the shared CteUse
spool branch; the table compound caller publishes that builder's columns/ops.
The original two-InitCoroutine assertion remains intact. Public INTEGER8,8
rows already matched before repair; the structural ownership obligation is
separate from the runtime compound wrong-row defect.

Native-first typed/reset controls and the original checkpoint regressions are
retained in `test/conformance/compound-collation.test.mjs` and
`test/conformance/cte-opcodes.test.mjs`; bounded command/results and attempted
hypotheses live in [[card:card-t-c]] status and checkpoint-collation-red/repair
work artifacts. This is not R1–R4 architecture acceptance or new breadth;
metadata/origins, general resources/storage and unrepresented shapes retain
previous qualifications. No bitwise excluded changes are part of this repair.


### Correlated scalar destination admission repair ([[card:card-t-d]], 2026-10-03)
Supersedes only the four unresolved scalar admissions recorded above. Fresh
source-ID asserted native-first DISTINCT, GROUP/ORDER, ordered UNION ALL and
multi-source physical scalar children reproduced temporary prepare failures.
Pinned expr.c:sqlite3CodeSubselect (3870–3970) initializes NULL/Exists on each
correlated invocation, applies Once only without correlation, converts scalar
LIMIT X to X<>0 (retaining OFFSET), and calls sqlite3Select with SRT_Mem.
select.c:selectInnerLoop/SRT_Mem (1412ff), generateSortTail and multiSelect
own projection, DISTINCT/grouping, OFFSET before destination and count after.

Current owner/caller chain: physical compileExpressionSubquery delegates to
resolvedScalarSubqueryEmitter; linked resolver plans retain NameContext sources
and original reductions. Local cursor maps adapt physical addresses without
re-resolving correlated names. Ordinary DISTINCT/multiple-source children call
compileInnerTableSelect on the enclosing builder/parameters/Mem destination;
GROUP/HAVING calls compileAggregateSelect with the normalized sharedLimit, so
sorted group draining cannot overwrite the scalar with later groups. Nested
compoundArms are resolved in the same outer context and ordered UNION ALL uses
emitScalarCompoundMerge with linked plans/common normalized root LIMIT. The
unordered ALL path emits sequential arm coroutines, not an invented merge of
the first arm with itself; OFFSET and destination remain at the root drain.
Physical arms consume existing linked full-scan admission (scalarPrepared),
not the selected WHERE bound-operand path that lacked reduction identity for
an outer reference. Root [[card:card-s]] WHERE/index/private24 contracts are
unchanged; this is a retained optimization gap, not a root defect finding.

Compiler still owns graph/allocation/labels and coroutine payload contracts.
No completed Program copying, independent evaluator or VM opcode special case
was introduced. VM retains PC/register/cursor/Mem/KeyInfo/Btree, budget and
suspension/reset/finalize ownership. Existing manual-PC/specialized publishers
remain live outside this bounded slice and must not be removed prematurely.
Correlated set operators, VALUES, aggregate/transient compound arms remain
honest temporary rejections; this is not general compound scalar acceptance.
No exceptional algorithm substitution or public contract/product-scope change.

Durable select-correlated-scalar-destination.test.mjs embeds independent pinned
rows/names for the four reproducers plus five LIMIT0/OFFSET/exhausted DISTINCT
and ordered/unordered ALL controls, checks INTEGER/NULL, two executions/reset,
done/finalize. Original ten-case cross-feature oracle remains in
work:///cards/card-t-d/finite-assessment/red-current/; controls and commands,
failed hypotheses and final hashes are in scalar-admission-repair/ and current
status. These tests do not establish full metadata/origins/encoding/BLOB/error
or storage/resource parity, nor finish the seven-item R1–R4 assessment.

### Current bounded R1 update (2026-10-03, post ee5252ee + d423 dirty inputs)

The four independently identified parent publication families now consume actual
enclosing builder/parameters/destination, including CTE fallback; shared calls
return columns and the table caller retains ops identity. Local parent Halt and
finish survive only standalone. Compound-derived aggregate already shared state
and is unchanged. Initial five ownership checks fail before repair, pass after;
expanded allocation/destination/caller assertions prevent an inert signature fix.
Native/public controls and immutable changed-input integration are bounded evidence
recorded by [[card:card-t-b]], not whole-card architecture acceptance. Repeated
view native execution was post-edit, not native-FIRST. Remaining fixed cursor/WHERE
seam, independent JSON/retained-window publishers, IPK name mismatch and finite
export/metadata/resource acceptance qualifications remain open. Historical four
scalar admissions and lexical/source0 runtime cases were repaired by d423 and
are not reinstated as current failures.

### Bounded IPK result metadata repair (2026-10-03, card-t-d)

The ordinary-entry pinned witness no longer exempts `rowid` naming: direct
negative-column addressing now produces the declared INTEGER PRIMARY KEY name
(or canonical `rowid` when no IPK exists). `resolve.ts` keeps lookup spelling,
source identity and negative physical columnIndex intact; only resolved-result
name production and descriptor column selection consume iPKey identity.
Explicit AS aliases still win. Pinned `select.c:sqlite3GenerateColumnNames`
2141–2210 and `columnTypeImpl` around2009 own these two consumers; VM cursor/PC,
WHERE/index and suspended execution are unchanged. No algorithm substitution.

`select-ordinary-entry-owner.test.mjs` preserves the original native-first
rows/types/names/reset witness and adds freshly source-ID-asserted native-before-
repair controls for rowid/_rowid_/oid on IPK/no-IPK tables, qualified/AS access,
origin/declaredType and leftmost compound naming. Disposable native capture and
unchanged RED diagnostic are retained under
work:///cards/card-t-d/ipk-metadata-repair/ and finite-combined-assessment/.
This supersedes the earlier bounded IPK naming qualification only, not complete
metadata parity. COLLATE expression-name/metadata and transient-table name
production have distinct upstream branches and are not certified by this slice;
JSON/retained-window publication, nTab, exact export and broader resource
qualifications remain. No root WHERE fault or scope change is asserted.


### Bounded JSON/retained-window enclosing publication correction (2026-10-03)

[[card:card-t-b]] forwards the actual table-entry builder, ParameterBuilder and
SelectDest through mixed physical/JSON, two correlated JSON sources, and single
JSON scan/group/aggregate/sorter drains. Their local contiguous ranges begin at
the enclosing register frontier; manual range increments are synchronized back
to the builder before expression allocation and return. Shared paths neither
freeze ops nor emit terminal Halt/finish. The retained-window path forwards
parameters/destination, including its flattened recursive caller, and leaves
window labels/subroutine finalization to the enclosing late Halt/finish. Actual
standalone wrappers remain. Source: select.c sqlite3Select7615, selectInnerLoop
1139ff/SRT_Output1442ff, coroutine/materialization tags0482/0488 recursively use
the same Parse/Vdbe with chosen destinations; vdbeaux label resolution remains
late. Objects/register indices are TS representation adaptations, not a new
algorithm or evaluator. Fixed JSON cursor0/1 and physical/private fences remain;
this is not general nTab/WHERE equivalence or RIGHT acceptance.

Native source-ID checked JSON five-case and retained-window probes ran BEFORE
product edits. Public JSON metadata/bind/reset/limit/error controls and window
controls are preserved; construction checks assert consumed ownership and late
publication, not SQL compatibility. A native grouped JSON control independently
shows existing TEXT `text`/REAL0.0 versus public retained `string`/INTEGER0 for a
text input: this pre-existing semantic discrepancy is not repaired or concealed
by the construction migration. No blanket metadata/type parity claim.

Revision 2026-10-03, five-caller correction: the previous omitted-edge census
above is superseded for ordinary flatten, materialized derived, immutable-view
recursion, zero-source scalar and multisource table entry. These now consume the
enclosing builder/parameters/destination. See
`docs/research/card-t-b-fallthrough-owner-census.md` for the finite branch census,
source comparison, specialization/admission constraints and verification limits.
The ops-identity escape is now an internal invariant failure, not publication of
a private Program. This does not close parent R1–R4, RIGHT or exported-candidate
acceptance, and does not repair the documented grouped JSON type discrepancy.

### Bounded grouped JSON storage-class correction (card-t-c)

The b818 grouped JSON witness is now repaired at semantic owners, not at the
SELECT drain: `json.c:jsonEachColumn`/`aJsonType` uses TEXT label `text` for
JSON strings. The table producer now shares `jsonTypeName` with `json_type`,
removing its duplicate label rule. Internal parser kind remains `string`.
`vdbe.c:sqlite3_value_numeric_type` applies numeric affinity only to fully
numeric TEXT with bTryForInt=0; nonnumeric TEXT/BLOB keep their type.
`Mem.valueNumericTypeCopy` mirrors that classification without mutating the
producer payload; arithmetic `numericTypeCopy` remains unchanged.
`func.c:sumStep1929ff` and `sumInverse1963ff` now consume this classification
and use the existing `valueDouble` accessor for non-INTEGER contributions,
so nonnumeric text contributes REAL zero, not INTEGER zero. Sum/total/avg
share the same accumulator. No new evaluator or change to group builder,
destination, parameters, cursor allocation, reset or error lifetimes.

Source-ID-checked native controls captured before consuming edits and public
storage-class/reset/rebind regressions are retained in
`test/conformance/json-group-numeric-types.test.mjs`; the existing grouped
JSON assertion now expects `text`/REAL0.0. Exact commands, failed intermediate
hypotheses and immutable input evidence live in [[card:card-t-c]] status and
json-group-semantic-red/repair artifacts. This supersedes only the b818
specific unresolved grouped witness, not general JSON/storage/resource parity,
parent R1–R4 or independent RIGHT/export proof. Metadata origins remain qualified.

### 2026-10-03 d bounded RIGHT aggregate correction
The final finite assessment's admitted ungrouped RIGHT mismatch is superseded:
physical outer-join aggregates consume the existing joined WHERE continuation
before single finalization, without aggregate result projection. The newly
exercised caller exposed hardcoded cursorIds in unmatched NullRow/RHS positioning;
those now honor the same cursorFor as OpenRead. Not a VM Return/AggFinal patch
or root planner fault. Native-before2 and post-first-edit6 typed public controls,
frozen1347 regression/type/diff pass; evidence and failed attempts in card-t-d
status. Grouped RIGHT rejection, repeated barriers and general resource/nTab
qualifications remain; no blanket parent review or compatibility acceptance.


### F1 endpoint lookup control repair (card-t-d, 2026-10-03)
Supersedes provisional uncontrolled linear-seek acceptance. Pinned window.c1948–1950
bounds regApp target and emits SeekRowid; vdbe.c5495–5568 performs Btree lookup
and propagates errors before position publication. Browser shared finite records
still use sequence+1 linear identity lookup (not native Btree complexity), avoiding
new shared mutation/index bookkeeping. EphemeralIndexCursor.seekRowid now requires
PrivateStateControl, charges one deterministic unit per visited entry, checks even
empty/completed searches and publishes position only after successful checks.
EphemeralSeekRowid awaits it with VM private control: host yield every256 total
work units, cancellation/deadline/limit checks within traversal. NULL target still
branches without lookup; OpenDup positions remain independent. No regApp/result
or destination lowering change, no guarantee narrowing or native work equality.
Existing primary-error/exhaustive cleanup/reset/finalize ownership is unchanged.
Primitive and public600-row bounded PRECEDING endpoint tests isolate600 visited
units by public budget delta; actual host yields inside seek, cancellation/deadline,
reset/reexecution, shared replacement/missing/failure position checks pass.
Exact attempts/native temporal provenance/export evidence in card-t-d status and
work:///cards/card-t-d/endpoint-seek-repair/. Grouped RIGHT remains delegated
in-scope feature debt; general nTab/resource/native error parity is not certified.


### 2026-10-03 original-e integration correction: shared join plan accounting

The accepted stabilization's enclosing-builder multi-source path planned real
WHERE loops but discarded its `whereAccounting` when the producer returned to
`compileTableSelectProducer`. Preserve that owning planner result across the
shared producer return; do not invent counters at execution or weaken the frozen
LEFT JOIN ON-provenance assertion. Pinned `select.c:8292–8314` retains the
`sqlite3WhereBegin` result for the actual loop producer; TS planning remains
`planWhere`-owned (including ON prerequisites/null-extension). This is private
prepare accounting propagation, not a new access algorithm or public API.
The unchanged ordinary public driver now passes 23 cases/69 encoding assertions
including exact zero index seeks on this LEFT JOIN control; selected/storage204
also passes on isolated committed source plus this repair. Earlier e0f6913
ordinary failures (twice, plannerCandidates0<1) remain historical evidence.
No advanced24/30 selection inflation, optimizer/architecture breadth or native
work-equivalence claim follows. See [[card:card-s-c-e]] repair status for commands.

### R1 shared WHERE operand boundary — corrected evidence (2026-10-03)

Root immutable review `record:///review.md?card=card-s&v=3` correctly identified
a blocking wrong-row plan: recursive column use promoted id+1 into id and
all-use minus owner erased same-source RHS dependencies. New independent pinned
native/public RED obtained 72 failing executions among 117 prepared cases;
id+1=2 returned id=2 instead of native id=1 with an actual table seek.

The owner now separates exact ordinary column binding from recursive use and
source-identified actual expression-index matching. RHS usage (including full
IN lists) is independently retained and overlap prevents original/commuted
seek eligibility. Residuals, safe scans, forced full-index scans and LEFT
provenance survive. Public rerun passes 117 cases/234 changed-binding executions
across all encodings plus six exact errors, metadata and genuine expression
seek/nonmatching scan controls. This is not a blanket fidelity approval;
independent re-review is required. Advanced selected credit stays 24/30,
not 30/30 by counting fallback. No production compiler edit was needed.

### R2 ORDER-consumption repair evidence (2026-10-03)

Root review v6 correctly found that finding10's sorter-route resolver guarantees
did not cover planner bypass. Independent native/public RED: 30 wrong-order
executions in 57 cases, all encodings. Token-spelling handoff is now replaced by
existing SELECT alias/ordinal and column ownership; NULL placement is explicit.
Only true represented IPK, not arbitrary primaryKeyPosition, supplies rowid
order. Nondefault NULL index traversal retains sorter (no BIGNULL claim).
Public discrimination now passes 114 executions plus six errors, with actual
sorter/index accounting. Tied-key ordering is not an observable guarantee; the
exact NULL-discriminator fixture uses distinct keys. Advanced24/30 and default
order consumption remain separately tested. Independent review remains needed.

### R2 consuming integration: physical WITHOUT ROWID NOT INDEXED storage

The additional advanced public discriminator `SELECT k FROM wr NOT INDEXED
ORDER BY k ASC NULLS LAST` exposed a rowid-table cursor on an index-btree root.
Pinned `where.c:whereLoopAddBtree` (4035–4058) chooses the real WITHOUT ROWID
index chain instead of the synthetic rowid index; NOT INDEXED cannot remove
physical primary storage. The shared candidate owner now never publishes a
rowid table scan for WR and always retains its represented primary capability,
including unconstrained/non-consumed ORDER cases. Optional secondary indexes
remain suppressed. No compiler/VM change or BIGNULL optimization is introduced.
The public regression covers all encodings, primary physical access, both
nondefault NULL directions, reset/rebind and sorter counters. Ordinary69,
selected/storage206 and R1/R2 focused24 pass on the isolated parent plus patch.
Additional exploratory expression-index ORDER scans still produce wrong rows
(repeated id1); those failures are not waived by this repair or existing greens.
Integration remains withheld pending their separate owner/caller diagnosis.

### R2 consuming loop restart correction (expression-index full scans)

The WR repair exposed twelve native/public wrong-row comparisons on forced
expression-index ORDER scans without WHERE: indexNext advanced four records,
but tableSeeks stayed one and every projected id reused the first base row.
Pinned `where.c:sqlite3WhereEnd` (7593–7595) jumps to the WHERE loop position,
not the SELECT result body; `vdbe.c:OP_DeferredSeek` (6740–6753) marks each new
base target/cache stale. The TS DeferredSeek owner already did that correctly,
but the shared SELECT caller skipped it on next/previous when WHERE was absent.
The caller now always restarts at scan.loopStart, including termination and
deferred positioning, before result/sorter evaluation. No VM cache workaround,
SQL special case or algorithm substitution is introduced. Source-ID checked
R2 native/public matrix now includes both expression ORDER NULL orientations:
63 prepared cases/126 executions plus six errors across all encodings. The
work-only extended90/180 discriminator also passes; earlier12 failures remain
recorded. This closes the concrete residual failure noted above, not full
BIGNULL optimization or broader optimizer equivalence. Selected credit24/30
and conservative nondefault NULL sorter contract remain unchanged.

### Retained ORDER/LIMIT hidden-key repair (2026-10-03, current working revision)

Independent source-ID-verified capture and public Fetch red showed the original
browser composition rejected at prepare in all encodings. Parent ORDER lookup
searched only projected indices and returned undefined for hidden b. Owning
consumer now maps alias/ordinal through parent EList and source key through the
complete producer EList, copying from coroutine producer registers. Restriction
(11) preserves both ORDER owners; sole-source coroutine (1a)/0482 remains intact.
No host slicing, evaluator, flatten override or materialization substitution.

Three-encoding regressions prove rows/origin metadata, 300-byte success,
simultaneous shared reservations beyond 150, 150-byte step failure, saved reset
error, full release and fresh admission; reset after suspension, cancellation
and deadline also pass. Route test asserts coroutine controls/two sorters.
Original Chromium gap lane passes 2/2 (153.0.8010.12, Playwright 1.63.0), without
changing expectations or previously accepted browser milestone accounting.
Broader FROM runtime and general expression ORDER are not established here.

### Revision 2026-10-04 — row-width pre-runtime evidence (proposal only)

[[card:card-s-e-a]] compared pinned build.c column/default/physical widths,
analyze.c callback-text/fakeIdx parser and where.c width consumers with current
schema.ts/where-plan.ts. The 2026-09-29 six stat-choice successes do not cover
NULL idx/table sz or default declared widths: current loader rejects sz tokens,
skips NULL idx and produced indexed loops lack width metadata. New pinned
three-encoding development snapshots and public/real-plan/production-root
preimplementation assertions precede runtime edits; their failures are retained,
not weakened or assigned compatibility credit. Decision/denominators/commands:
[card-s-e-row-width](../research/card-s-e-row-width.md). Planner assessment pending;
STAT4/noSkipScan/automatic query indexes and other residuals unchanged.

### Revision 2026-10-04b — row-width proposal review response (no runtime repair)

[[card:card-s-e-a]] responds to immutable review
`record:///review.md?card=card-s-e-a&v=3`: correct argv[0] table assignment,
post-load defaults, unsigned hex parser ordering, reset-retained executions and
real planWhere ordinary/joined cost/path and width-tie/full-scan discriminators.
120 pinned exports, independent recapture exit0; TS237 attempted/9 pass/228 fail,
exit1. Before roots and coincident table-only roots are not width fidelity credit.
Current runtime still lacks estimate owners and rejects sz; join row defect
remains. Decisions/artifact hashes/bounded gaps in research/card-s-e-row-width.md.
Planner assessment required; no src runtime changes or corpus-wide acceptance.

### Revision 2026-10-04c — path-cost acceptance correction only

[[card:card-s-e-a]] addresses immutable component review
`record:///review.md?card=card-s-e-a&v=6`: joined acceptance now feeds prior
biased unsorted cost per round, not prior total. Dedicated real joined path-bias
control expects total51/unsorted49 versus erroneous52/50, with pinned native
chosen access and typed rows. No runtime repair or corpus-wide acceptance claimed.

### Revision 2026-10-04d — row-width runtime checkpoint, not acceptance
[[card:card-s-e-b]] implements approved SECOND producer/consumer ownership:
local defaults/stat1/post-load/freeze replaces competing stats, physical fields
own width, WHERE consumes explicit BigInt costs; parse preserves declared type
spans. No source algorithm substitution claimed. Runtime fresh117/240 passes,
123 failures unwaived; all120 public nodes stop at joins before later lifecycle
assertions, but additional ordinary failures were hidden. Before-ANALYZE empty
join predates repair. Ordinary-only diagnostic11/120 reveals rowid number binds:
TS SeekRowid lacks vdbe.c5495 numeric-copy coercion, unchanged from HEAD;
BigInt-only rowid diagnostic120/120 supports ownership, not acceptance.
Three remaining auxiliary no-ORDER tie assertions conflict with fresh pinned
native tb (captured ORDER query correctly chooses ta). Dominance omits width in
upstream, so adding width to insertion would be a false repair. Bounded IPK
singleton ordering proof fixes three small-b joined root checks. Third checkpoint
repairs IS NULL/range/clamp and full-scan covered-prefix costs; fresh affected
169/170 still fails preserved reverse sorter expectation. Independent native
sort0 (NOT INDEXED control1) contradicts that assertion; parent disposition is
still required before revision. Supplemental cost/order6/6 and resource50/50
pass; no complete resource or optimizer claim. STAT4 unsupported; truthProb,
invalid bytes, wider metadata and WR/transient census remain gaps. Fourth
checkpoint native-first quoted declared-type hex/overflow/doubled-quote fixtures
exposed missing build.c1584 Dequote in the type producer; parse now translates
util.c299 dequoting of the exact span. Fresh3/3 validates bounded widths and
complete direct-column origin metadata/typed reset rows across encodings, not
full metadata fidelity. Fifth checkpoint independently captures encoded BLOB/NUL
stat1 records, exposes false WR-only equal-name PK lookup, and repairs its
analyze.c1611/build.c1069 owner plus persistent UNIQUE distinction. Bounded
callback ownership tests pass; invalid byte conversion and complex autoindex
constraint/ordinal census remain open. Sixth checkpoint native-first WR duplicate
key fixtures expose omitted build.c2417/isDupColumn compaction. Corrected key
producer before physical widths/stat1/defaults and secondary PK mapping; bounded
three-encoding tests pass. Distinct collation duplicate and full constructor
census remain uncertified. Seventh checkpoint closes inconsistent inferred IPK
identity: build.c AddPrimaryKey distinguishes inline DESC from table-list DESC,
while TS width/autoindex/resolver/WHERE/VDBE disagreed. Real schema publishes
one identity; transient constructors null; native-first all-encoding typed tests
pass. Private legacy mocks alone retain fallback. Eighth checkpoint independent
WR distinct-collation/noncovering oracle reproduces BLOB instead of TEXT payload
because ordinary lowering used table column ordinal after correct PK seek.
Mapped expr.c4462 primary physical column owner for direct/residual reads;
three-encoding regression passes, joined mapping still uncertified.
Selected greens are not acceptance. Ninth checkpoint callback path decoded
UTF8 before byte hash lookup, incorrectly aliasing overlong e083a9 to canonical
é/c3a9. Native exec callback preserves raw bytes. Schema now keeps Mem-converted
UTF8 bytes through ASCII-only name lookup/token parsing; bounded three-encoding
regression passes. Tenth checkpoint implicit producer grouped PK first then
UNIQUE, wrong physical columns/widths and stat ownership for UNIQUE-before-PK.
Grammar now retains ordered actions and schema translates build.c equivalence
merge ignoring direction/retaining first, promoting PK origin. Bounded native
rowid tests pass. Eleventh checkpoint WR primary name hardcoded ordinal1 and
implicit UNIQUE rejected: native UNIQUE-before-PK requires primary ordinal2 and
secondary1/3. Shared ordered definitions now publish correct names/roots and
ordinary physical secondary fields/default/stat ownership; bounded native typed
noncovering/reset tests pass. Twelfth checkpoint WR merged PK direction was
still rebuilt from later declared PK, losing earlier UNIQUE direction. Retained
merged primary now owns pre-compaction/storageKey construction; independent
all-encoding fixture reproduces false ASC→true DESC and covering typed reset
passes. Thirteenth checkpoint shared Mem UTF16→UTF8 replaced final lone
surrogate via Unicode string re-encoding, unlike pinned default utf.c. Direct
source read/write loop repairs bytes; pinned column_text12 cases reproduce8/12
then12/12. Fourteenth checkpoint encoded stat1 caller fixtures prove bounded
malformed-name ignored/unknown-token conversion boundary/default width/public
typed reset parity; inherited sz=8 assertion was wrong (space consumed into
surrogate pair, so source ignores sz within token), corrected against callback
hex/source not production. Fifteenth rowid PK promotion native index_xinfo
and noncovering typed reset pass all encodings, no runtime edit. Constructor
census exposes omitted onError grammar/conflict merge and REPLACE linkage:
source branch ownership remains incomplete despite ordinary default tests.
Sixteenth checkpoint onError retained/merged before PK promotion, first-REPLACE
source list bubbling translated. Native index_list3/1/2 tests pass, formerly3/2/1;
constructor explicit-conflict error/inheritance oracle pending, census not closed.
Seventeenth promotion native1/2 exposes final-policy reconstruction2/1:
producer now retains grammar-action prepend/cleanup even when merge promotes
policy/origin. Native all-encoding list/typed reset passes. Explicit conflicting
error branch/public cleanup remains independently untested.
Eighteenth native corrupted-schema conflict exposes raw SchemaFormatError;
merge now preserves corruptSchema object context, public prepare maps schema
failure to sqlite11/cause. All-encoding native code/message/repeated failure
passes. WR+APPDEF list oracle matches current publication. Error mapping beyond
schema formats and full resource/constructor census remain unclaimed.
Nineteenth publication removes late implicit-slot reorder: automatic identities
and grammar linkage exist before APPDEF insertion/cleanup on actual list, before
width/stat publication. Native conflict families13/13 preserved; no universal
constructor/optimizer claim. Twentieth isolated original-native ordinary cases1080/1080 preserve full typed
runs/column names/reset-retained/rebind-clear, avoiding hidden assertions after
joined failure. Cost/root9/9 source-derived private checks, not independent
native internal cost capture. No joined/full metadata closure. Full invalid
matrix/conflict policy/census open.
Twenty-first new independent direct-column metadata/REAL-noncover fixtures
49,152 bytes all encodings3/3: five metadata fields, typed values and public
clear/rebind/reset. No alias/expression/join metadata closure; no runtime edit.
Twenty-second WR IPK source census identifies missing delayed persistent-PK
creation after other grammar indexes. Native-first three-encoding fixture
reproduces rowLogEst crash; ordinal/identity repair, not undefined-stat default,
passes focused19/19,typecheck0. Constructor closure remains unclaimed.
Twenty-third nine encoded native controls184,320 bytes verify inline DESC vs
table DESC timing and delayed UNIQUE merge; shared AddPrimaryKey identity
removes duplicate inference. Focused15/15,typecheck0, no universal closure.
Twenty-fourth transient census compares select.c zero-allocated columns/unused
szEst/nonzero table1. Resolver/VDBE synthetic owners now0/1,not persistent1/16.
Nested source-derived check3/3, no native metadata/private cost credit.
Checkpoint25 estimate-census research file supplies review inventory, not closure.
Fresh complementary candidate/stat/WR/order/resources94/94; prior width1410
1287/123 and lifecycle118117/1 reused unchanged. No original red waiver.
Checkpoint26 missing matrix80:74 pass6 fail; joined two-slot IN crashes at
iteration register integerValue. Isolated HEAD identical tests6/6 pass, so new
checkout regression cannot be labeled preexisting. Advanced resources8/8;
path/lowering/register lifetime isolation remains required.
Checkpoint27 trace localizes first-IN empty→LEFT null-row→uninitialized inner
restart. where.c7627 IfNotOpen analogue now fences synthetic null continuation
past physical/IN advance with per-outer reset.45/45 selected tests; fresh
width1287/123 and affected143/1 unchanged residuals, no universal closure.
Checkpoint28 independently native retained reset/clear/rebind NULL sets6
snapshot controls public6/6/pre-guard0/6.184,320 existing fixture bytes reused;
no new native DB construction or universal joined credit.
Checkpoint29 isolated mixed VDBE11 owned versus2 preserved bitwise peer hunks,
reverse-check only,no staging. Fresh width14161293/123,affected/resources229
228/1,typecheck0; original expectation/root conflicts and review remain open.
Checkpoint30 declared hex controls20×3 native direct metadata/rows3/3,
36,864 new bytes; internal widths source-derived. Invalid raw declaration
bytes and alias/expression/join metadata still unclosed, no universal credit.
Checkpoint31 raw schema ff/c183 control UTF8 accepted,width5; UTF16 retained
UTF8 bytes rejected native/TS CORRUPT11,3/3. Not actual malformed UTF16
declared-type coverage; immutable error publication checked repeated prepare.
Checkpoint32 actual malformed UTF16 encoded schema surrogate+X consumption
native raw UTF8 metadata hex all5 fields/TEXT/reset2/2,24,576 new bytes;
declared combined8/8. Bounded control only,not full raw-byte closure.
Checkpoint33 reviewer handoff authored,not reviewed. Fresh width14241301/123
and affected/resource229228/1; original public/tie/sorter dispositions unwaived.
Checkpoint34 original-bound isolated join/rowid/path-bias36011/349 vs HEAD
0/360; diagnostic INTEGER360/360 vs HEAD135/225 narrows rowid semantic
owner,not native REAL-binding acceptance. Original tests unchanged.
Checkpoint35 exact no-ORDER tie query pinned EQP tb9/9; TS plan/OpenIndex/
public reset9/9. Original3 ta assertions conflict with native exact query,
remain unmodified pending parent review; no universal width-tie credit.
Checkpoint36 reverse outer LEFT two-IN native8 sets×6 controls6/6,including
unmatched→matched→unmatched and retained reset. No universal LEFT credit.
Checkpoint37 joined WR native nonempty controls current/HEAD0/3 both
unsupported storage-shape fence3376,not new width regression or joined
mapping proof. Native expectations retained,broader SELECT work unwaived.
Checkpoint38 persistent single-owner/cache/freeze/read-only invariant120/120
original snapshots; source-derived not native compatibility/cleanup closure.
Checkpoint39 invalid stat1 no publication fresh errors6/6 plus existing
public corruption6/6; native permissive corruption behavior not equivalence.
Checkpoint40 fresh all width1928:1453/475,affected129:128/1 reverse-sorter,
zero skips/cancels,standalone typecheck0; review draft not acceptance.
Checkpoint41 exact reverse-order native forced SORT0/scan SORT1×3,
TS rows/reset/sorter parity6/6; original sorter>=3 unchanged pending review.
Checkpoint43 residual output heuristic before insertion now translated;
truthProb/HIGHTRUTH/LIKE/self-cull producers still absent. Initial matrix
1942:1464/478 included3 stale internal cost expectations; corrected owned
source expectation3/3,native unchanged; no final whole rerun yet.


Checkpoint44 residual literal production corrected to expr.c2899 EP_IntValue
not runtime INTEGER;source19/19,fresh width1951:1476/475 and resource/affected
178:177/1,zero skips/cancels. Full truthProb/HIGHTRUTH/LIKE/self-cull gap persists.

Checkpoint45 trace: TERM_HEURTRUTH only consumed by STAT4 HIGHTRUTH
where.c3519/7086 second-pass; nonempty STAT4 rejects before publication.
No missing admitted shared-state consumer; no mutable clause workaround.
SELFCULL consumer6606 Bloom generation unsupported,not width cost.
Fresh selected55/55,WR/residual complement43/43,stat/STAT4 boundary36/36;
44 changed-runtime width1951:1476/475 and resources178:177/1 reused.

Checkpoint46 current constructor census: transient result tables column0/table1/
rows200 (select.c2376/2432/2464) now consistently freeze completed metadata at
publication via schema freezeTransientTable; not persistent default/stat1 pass.
See refreshed estimate census and implementation handoff; independent review pending.

Checkpoint47 transient publication regression targets real withTransientTable:
3/3 current versus isolated freeze-call removal0/3; broad publication200/200,
typecheck0,width1956:1481/475,resources49/49,affected170:168/2 (sorter assertion,
missing r2-native artifact). No new runtime edits; independent review pending.

Checkpoint48 transient guard-before-freeze/repeated-identity controls pass;
publication/WR/STAT4/corruption159/159. Persistent PhysicalIndex-null fallback
width1 flagged as open source ownership branch (build.c2236 versus schema574);
unsupported access does not automatically justify fabricated width estimates.

Checkpoint49 real unknown-collation index reproduces fabricated width (3/3 red).
Pinned native ordinary q scan succeeds with A in all encodings; forced qi returns
SQLITE_ERROR/no query solution. Tried whole-schema rejection,then reverted:
that blocks legitimate table scan and is not a coherent source-faithful policy.
Need structural field ownership separate from executable built-in KeyInfo;
no width1 fallback or global rejection credit. Final tests retain expected
structural width LogEst(108) (CHAR100=26 plus rowid1),still0/3. No runtime change
retained this checkpoint; missing four Chinook tests remain unwaived.

Checkpoint50 replaces fabricated nullable-physical width with shared immutable
PhysicalIndexLayout owner; executable built-in KeyInfo uses same fields/PK
mapping only when collations available (build.c2236,5653–5700). Unknown collation
preserves structural width and ordinary table read,declines index access;
no competing statistics or host callback support. Review pending.

Checkpoint51 native WR unknown-CollSeq exact index_xinfo records agree with
shared layout fields: PK a custom DESC,b,c; same-collation suffix dedups a;
different-collation suffix repeats a custom DESC and maps PK [1,2]. Three
encodings frozen metadata/source widths pass3/3; independent native ordinary
WR read and forced secondary reads fail prepare1,TS rejects too (not exact
code/message parity). New36,864 fixture bytes; no WR executable access credit.
Fresh complement156:153/3 includes existing joined-WR storage fence failures,
not new owner regressions. Checkpoint50 width/affected evidence reused runtime
unchanged; independent review/root/parent/native-input gaps remain unwaived.

Checkpoint52 unknown-CollSeq caller now preserves native SQLite error1 rather
than temporary unsupported: forced unavailable index => no query solution;
unforced WR unavailable primary storage => no such collation sequence.
Owning btreeLoops uses retained layout names; existing capability gating/cost
ordering unchanged. build.c5653–5700/where.c6169 branches; six encoding controls
assert exact public kind/code/extendedCode/message/null classification across
repeated prepares,stable graph and immediate close. First harness syntax error
corrected;final6/6. Fresh affected173:170/3 existing joined-WR fence only.

### Revision 2026-10-04d — post-runtime auxiliary acceptance correction

[[card:card-s-e-a]] freshly captures exact no-ORDER/ORDER BY a controls after
implementation: tb for all no-ORDER tie fixtures; ORDER ta for small-a, tb for
small-b/equal. Three false no-ORDER ta expectations corrected; forced cost equality
and ORDER solver width discrimination retained. Dominance remains width-free.
No runtime repair or public semantic waiver; peer reverse-sorter contradiction
is not authored acceptance ownership here. Original reported475 root failures
remain outstanding. Commands/current outcomes/hashes in row-width decision note.


### Revision 2026-10-04 — bounded numeric seek / LEFT continuation supersession

This revision supersedes **only** the earlier absent NUMERIC-copy claims in the
row-width checkpoints (including checkpoint34 and audit2026-10-04d), not their
historical reds or pending e/root qualifications. See
[causal repair/evidence note](../research/seek-rowid-numeric-repair.md).
Commits `4fa06e2441b978406cbd285b34ff4e6a25868ebc` and
`5713c0f68bfb733ecb4e527fc74841394066ceac` correct these bounded owners:

- Pinned `vdbe.c:5495 OP_SeekRowid` copies the input Mem and applies NUMERIC
  affinity before integer gating/cursor access, preserving original binding
  payload/type. `vdbemem.c:sqlite3VdbeIntegerAffinity` uses the **exact bigint
  slot for IntReal**, including both signed64 endpoints and values above2^53.
  Existing REAL instead uses double-to-integer roundtrip equality and **strict
  signed64 endpoint exclusion**. This is distinct from the narrower
  `sqlite3RealSameAsInt` text-numericization rule; it is not a text shortcut.
- `where.c:sqlite3WhereEnd` distinguishes continuation, advancement and LEFT
  synthetic-null re-entry. TS `nextAt` enters LEFT null-pass / RIGHT Return
  guards; `advanceAt` identifies the actual singleton Goto or movement opcode.
  Singleton target patching now uses advanceAt, not an offset into nextAt.
  ON matching remains before null extension; WHERE remains after positioning.
- `where.c:wherePathSatisfiesOrderBy` /5273 WHERE_ONEROW supports only the bounded
  represented proof: **FINAL ordered producer after exact rowid-equality
  singleton predecessors**. Statistical nOut0 is not uniqueness. Outer ordering
  before later fanout is NEVER promoted by this proof. Other joined paths retain
  zero global order; this is not general multi-source ordering acceptance.

Fresh strict singular-public ordinary execution on the disclosed peer-dirty
runtime completed **69/69** cases across UTF8/UTF16LE/UTF16BE, exact rows/errors
and every exact/min/max private bound, with no prepare waiver or increased limit.
Earlier63/69 with six LEFT limits and66/69 with three sorter minima remain
historical failures, causally repaired rather than waived. Primitive IntReal
coverage is not a claim of a public IntReal producer. No public API change.
Runtime commit/tree and fresh five-fix delivery evidence are in current executor
status for [[card:card-s-b-a-a-b-a-a-a]]. Native fixtures/pin evidence are not TS
execution credit. Shared dirty work is NOT a clean export; e aggregate1962/1490/472,
cFAILED, joined-WR and broader historical reds remain unwaived/separately owned.

### 2026-10-04 revision: bounded joined WR caller repaired

Checkpoint37 historical current/HEAD0/3 is now superseded for the original
three-encoding public reproducer. Joined lowering consumes existing BLOBKEY
primary identity, physical column ordinals and secondary PK lookup, not a new
evaluator or removal of the fence alone. New typed/native metadata/reset controls,
selected/off-path corruption and LEFT/resources tests are in
`without-rowid-joined.test.mjs`; manifest-checked capture script is retained.
WR RIGHT/FULL Rowid match tracking remains honestly rejected; broader SELECT
fences and parent width-owning rerun are not waived. Ordinary69 and advanced
runner verification are recorded with exact results in this card's status; no
clean mixed-checkout/export or whole-goal approval follows from these tests.


### Joined column-location correction (2026-10-04)
The semantic location contract now distinguishes `physicalColumnIndex` (table
primary/secondary storage ordinal) from aggregate `payloadIndex`/iAgg bookkeeping.
Joined columnAccess produces the former; binding replaces any prior physical
location when rebinding, and expression emission consumes only that location.
Logical transient indices and aggregate registers retain their own owners.
Pinned expr.c:sqlite3ExprCodeGetColumnOfTable4462 maps table storage;
TK_AGG_COLUMN4995–5015 uses accumulator/sorter locations first, and select.c
AggInfo production owns those locations. vdbe.c OP_Column reads the already
chosen cursor record ordinal, not a universal semantic-to-physical conversion.
This repairs the source-only45/68 cross-layer regression without reverting real
WR collation-aware mapping. Exact corrected candidate tests: discriminator68/68,
broad910/910,joined/shared184/184. Historical24/30 credit, wider fences and
post-runtime/native-FIRST shortfall remain unchanged; no B4-cause claim.

### Current bounded width evidence closure — 2026-10-04

Actual integrated source is `644cbcd827a2fbdf3a14407210941e38ac945a01`
(tree `7669377f99ead8c9bed67c52695cfa549863fa2d`), not the historical
mixed ACK candidate. Joined owner correction uses dedicated `physicalColumnIndex`
for storage; `payloadIndex`/iAgg remains logical aggregate state. Old checkpoints
and their failures remain chronological evidence, not current acceptance claims.
Independent [[card:card-s-e-c]] / [[card:card-s-e-d]] support bounded original
width and tested lifecycle on exact source plus inventoried297 evidence paths.
The coherent generator→case JSON→fixture/test corpus is promoted by
[[card:card-s-e-b]]; scope, hashes, fresh export checks and reuse are in
[width evidence delivery](../research/card-s-e-b-evidence-delivery.md). Fresh exact
export original240/240, closure2034/2034 and read-only pinned120 snapshot equality
are bounded evidence, not whole-product approval. B4 now returns INTEGER1984 with
reset/admission on reviewed source; sole causation is not proved and cancelled
baselines supply no causal credit. Native-FIRST chronology is unchanged.
STAT4 unsupported, noSkipScan retained/unconsumed, advanced24/30 and analyzeC0/24,
OR/skipscan/wider SELECT/metadata/resource fences remain unchanged.


### Current bounded infix caller repair — card-p-b-c (2026-10-04)

Pinned `parse.y:1363–1383` creates LIKE/GLOB function lists as RHS pattern,
LHS candidate, optional ESCAPE. Syntax reduction children remain LHS/RHS/ESCAPE.
`vdbe.ts:bindResolvedExpression` and joined `resolveTree` now use the same
infix child permutation in every applicable caller policy, not only windows;
infix NOT binds its synthesized unary child against the same infix carrier.
Explicit function-call children remain unchanged. No patternCompare algorithm,
function breadth, fixture, or expected-count change was needed.

Fresh source-ID-pinned C API on actual UTF-8/UTF-16LE/UTF-16BE users files
confirms Alice/Bob/Cara LIKE results 1/0/1 and filtered count 2. Public infix
aggregate/join/NOT/ESCAPE and explicit-call controls now agree. Executable evidence:
`ordinary-scalars-pattern-native.test.py` (36 INTEGER checks),
`run-ordinary-scalars-pattern-ts.mjs` (5 observations, 24 boundaries,
90 discriminators, 33 compositions, 9 lifecycle cases). Detailed chronology and
commands: `docs/research/card-p-b-c-pattern-count-diagnosis.md`.
The 50 active ordinary non-pattern registry rows / 0 absent count is unchanged;
this caller repair is not new aggregate/window or excluded-family support.
Original broad exit1 1539/1543 four reds are not universally dispositioned by
this focused repair. C4 and direct REAL/expression-subquery regressions remain
retained; no global cleanliness or universal acceptance claim.

### LIMIT-zero OFFSET adjudication — [[card:card-j-b-b]] (2026-10-04)

At input HEAD `54a2face7bf2bc90ea1c0e55fdd53257ba76cce1`, original broad
1539/1543 is reported evidence, not a current broad green. Fresh exact public
runner reproduced two failures (5/7): stale `SELECT 1 LIMIT 0 OFFSET 'x'`
rejection expectation and separate scalar-subquery admission expectation.
Pinned 3.53.4 sourceID was independently verified as
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
Identical SQL prepares successfully and returns DONE, reset OK, re-step DONE,
finalize OK in both native and public execution; OFFSET NULL likewise bypasses.
NULL/noninteger LIMIT and invalid OFFSET with nonzero LIMIT return code20 at
step, reset and finalize (public typed sqlite/datatype mismatch).

`select.c:2517 computeLimitRegisters` emits integer-zero Goto or evaluated
LIMIT MustBeInt/IfNot **before** OFFSET expression/MustBeInt; `vdbe.c:2105`
coerces without loss or raises MISMATCH; `2747 IfNot` branches on zero. Current
committed TS already has this correct ordering (introduced at `1010b15`), not
an uncommitted runtime repair. Only the obsolete assertion and contradictory
single-SELECT documentation are corrected. No source or dirty-runtime change.

New shared 16-case matrix checks literals, bound parameters, scalar/derived
children, compound and admitted window composition across UTF-8/UTF-16LE/BE:
48 native preparations/96 executions with reset/finalize and exact expected
rows/errors; three public tests check the same 48 preparations/96 executions.
The initially chosen derived constant-parent projection was typed unsupported;
we retain that gate and use admitted direct parent-column projection instead.
An attempted sqlite_schema window source failed name resolution; use existing
storage_values fixture, not a special-case bypass. Those exploratory failures
remain evidence, not broad coverage claims.

Commands: `PYTHONDONTWRITEBYTECODE=1 python3
 test/conformance/limit-offset-adjudication-native.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"`;
`node --experimental-strip-types --test --test-name-pattern='ORDER expressions|LIMIT zero short'
 test/conformance/run-order-limit-contract-ts.mjs test/conformance/limit-offset-adjudication.test.mjs`.
Both pass (`work:///cards/card-j-b-b/processes/proc-e1129aaba230/stdout.log`).
Typecheck, focused rerun, preserved expression budget check pass
(`proc-89d7c36172c8`). Full ORDER runner now 6/7 (`proc-b097cfecae97`): separate
stale scalar-subquery unsupported expectation remains intentionally untouched.
No broad-green/clean-workspace/extra upstream-credit claim. Prior `54a2face`
22-reject/23-pass expectation-only work and `6a7c8d5` infix repair are preserved.

### Revision 2026-10-04 — ORDER/LIMIT stale assertion versus scalar LIMIT defect

[[card:card-m-f-j]] source-ID-verified pinned 3.53.4: exact compound returns
INTEGER 0; exact bare-derived ORDER query also returns 0 natively but remains
TS temporary unsupported; exact unordered scalar returns 31 with full table
origin metadata. Public all-encoding compound/scalar execution/reset/NULL/empty/
LIMIT/lifecycle replacement passes 3/3. This does not credit the derived gap.
An additional source discriminator is genuinely red: scalar `LIMIT 'x'` returns
31 natively, but current generic scalar table-child lowering uses ordinary
`computeLimitRegisters` and errors at step with code 20. Compare pinned
`expr.c:sqlite3CodeSubselect` 3933–3958 (X<>0 normalization) to
`vdbe.ts:compileScalarSelect` child LIMIT handoff around 2908. Existing
`computeScalarLimitRegisters` is not reached by this route. Owner correction
must preserve IN ordinary LIMIT and OFFSET/error ordering. Native capture is
`test/conformance/cases/order-limit-subquery-native.json`; scoped suite is 9/10,
not a compatibility pass; historical combined 1539/1543 remains nonpass until an
actual combined run. Prior budget/LIKE/LIMIT0-offset corrections are untouched.

### Revision 2026-10-04 — generic scalar table-child LIMIT correction

The immediately preceding text-LIMIT defect is repaired by [[card:card-m-f-j]]:
`compileScalarSelect` selects existing scalar X<>0 normalization for Mem/Exists
at the shared LIMIT setup, before OFFSET admission. IN and retained derived
post-predicate producer row-count LIMITs stay ordinary. Public exact-discriminator
and all-encoding controls pass, with independently pinned 51-case typed captures
including NULL/zero/OFFSET errors and IN/outer LIMIT counterexamples. The original
9/10 failure is retained as historical evidence; neither derived admission nor
conformance credit expands. Combined historical 1539/1543 remains nonpass unless
and until an actual combined command produces a new denominator/outcome.
