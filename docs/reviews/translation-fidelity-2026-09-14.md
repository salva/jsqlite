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

**Current static label: unchanged.**

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

**Current static label: unchanged.**

Baseline `src/internal/schema.ts:200-213` derives `Column.notNull` only from the
literal declaration. It omits implicit PRIMARY KEY NOT NULL for
`CREATE TABLE t(a TEXT PRIMARY KEY) WITHOUT ROWID`; compare
`src/build.c:2354-2506`. `src/internal/parse.ts:23-34` extracts selected
constraints, while CHECK/REFERENCES semantics are neither constructed nor
explicitly unsupported despite the source-map claim. Correct the read-relevant
graph or state truthful unsupported boundaries. This does not require write-side
enforcement in the read-only engine.

### 3. B-tree seek algorithm replacement

**Current repaired label (working tree over HEAD `303a8746b35df03f233c78a46fa668507bdb794d`): corrected; focused validation passing.**

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

### 10. Committed ORDER BY shortcut and evolving replacement

**Current static label: partial/active/unverified.**

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

**Current static label: unchanged.**

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

**Current static label: unchanged.**

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

**Current static label: unchanged.**

Baseline `src/internal/comparison.ts:103-109` continues after embedded NUL.
SQLite's `sqlite3StrNICmp` stops there and then applies byte-length tie-breaking:
equal-length `a\0b` and `a\0c` should compare equal under NOCASE, but the baseline
differs. Current embedded-NUL coverage is BINARY-only. Protect the shared NOCASE
owner with a length-aware typed fixture, not source-language string truncation.

## Priority C — documentation and evidence precision

### 11. Stale coverage/mapping claims and oracle provenance

**Current static label: partial.**

At baseline, `docs/api.md:3` said functions were unsupported despite an
implementation; `docs/TRANSLATION.md:1168` described the old Expression opcode and
materialized sort while 1174 described newer lowering; and
`docs/SQLITE_SOURCE_MAP.md:601` called function collation backlog immediately
before an implemented row. Some mapped method names do not exist in the pinned
definitions. Current dirty API/source-map edits improve relational accounting but
do not reconcile all stale claims, including the obsolete compound-order routine
name. Preserve those autonomous edits and reconcile documents with actual behavior
as their semantic fixes land.

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
