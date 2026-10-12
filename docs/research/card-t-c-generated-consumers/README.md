# Bounded SELF TABLE binding decision
Use resolveAgainstSources on immutable generated ExprNode, with a SELF TABLE
NameContext containing exactly the consuming ResolvedSource. Carrier dependency
column uses retain that same identity; do not resolve by SQL reconstruction or
schema mutation. Each alias is a different source and busy set key. Recursively
bind VIRTUAL expressions through the same physical-location binding policy as
ordinary dependencies; restore compile-time busy in finally. Register locations
already represent producer-finalized logical values and must not expand again.
Cursor dependencies retain logical index, stored physical mapping and selected
index field supplied by location; generated column wraps shared expression
IfNullRow-before-dependencies and affinity. No STRICT TypeCheck admission added.
Ordinary joined/aggregate/correlated guards may be removed only for consumers
whose bindings and source capture are corrected and tests pass. Single-source
immutable expression foundation is retained. Generated dependencies in aggregate
producer register capture must evaluate logical columns, not raw physical slots.

## Current production branch map and bounded evidence
- `resolve.c:sqlite3ResolveSelfReference`2308 →
  `resolvedGeneratedExpressionCarrier`: resolve the retained generating ExprNode
  with a single existing source, no alias collapse or declaration mutation.
- `expr.c:sqlite3ExprCodeGetColumnOfTable`4393ff → linked binder:
  STORED table-to-storage offsets; VIRTUAL recursive carrier binding; per-source
  busy set restored in finally across every recursive scalar/argument/modifier
  edge, matching saved selftable/BUSY lifetime (review24 R1 correction below).
- `expr.c:TK_COLUMN`5050ff → aggregate direct/register/sorter locations are
  consumed before VIRTUAL cursor expansion. Register producers already hold
  logical values, so do not re-evaluate dependencies there.
- `sqlite3ExprCodeGeneratedColumn` → shared `compileExpressionTree`:
  IfNullRow precedes dependencies (even constant expressions) and affinity.
- `compileInnerTableSelect` → resolved predicate binder and direct/coalesced
  result owner now use logical Column binding, not raw physical ordinals.
- `compileAggregateTableSelect` → resultLocation and grouped sorter payload
  capture bind logical fields; capture evaluates VIRTUAL before sorting. Existing
  correlated scalar binder receives same dependency carrier/physical policy.
- Single-source immutable/quoted binder remains unchanged; mixed JSON producer
  guard remains. WITHOUT ROWID aggregate restrictions remain. STRICT admission
  and TypeCheck are not added. Existing all-column joined planner demand remains
  conservative (upstream generated colUse824 sets all bits); no new optimizer.

Native `capture.py` produces all three encodings before corresponding public
assertions. Committed `generated-consumer-native.json` contains digested immutable
images plus typed INTEGER/REAL/TEXT/BLOB/NULL rows and column names; public test
replays each twice with reset and finalize. Eleven combinations per encoding:
joined mixed/dependent reads, grouped generated keys/sums, correlated scalar,
outer unmatched constant/dependent VIRTUAL, nocase join/filter, joined aggregate,
single-source regression, quoted components, indexed filter, outer joined group
HAVING/ORDER, quoted correlated result. Additional three resource checks verify
first limit error/reset/finalize and admission restoration.

Actual detailed trial logs/commands are retained in
`work:///cards/card-t-c/generated-consumer-repair/` and
`record:///status.md?card=card-t-c` ([[card:card-t-c]]).
Fresh previous183 passed. Affected regression family69 passed before expansion
from24 to33 native cases; focused expanded36 passed (33 replay +3 limit).
Selected single-source covering VIRTUAL reads now consume the materialized
logical field of the selected index rather than expanding dependencies against
index ordinals. This is the direct generated-column portion of
`where.c:whereAddIndexedExpr`6664ff and `expr.c:sqlite3IndexedExprLookup`4766ff;
not a generic indexed-expression matcher. Noncovering paths still compute from
table dependencies; joined outer reads retain table NullRow-before-expansion.
The selected single-source covering path has no outer NullRow production;
ordinary Column reads retain cursor NULL behavior. Shared expression affinity and
collation/metadata remain logical. Upstream generic expression matching, affinity
compatibility, subtype exclusions and nullable indexed-expression fallback are
not claimed translated by this direct-column correction.

Native-first composite index `(v VIRTUAL,s STORED)` controls explicitly force
INDEXED BY and cover covering/noncovering and unmatched same-source LEFT join,
all three encodings. Full origin/declared metadata is now asserted for all42
differential cases. The prior covering case failed typed rows in all encodings;
see current card status and index-red/index-repair work evidence.

Current isolated prior candidate `3957684173f37fb792ba122ed62e59e83e06a964`
was exported and checked exactly, but review24 withheld approval for the recursive
BUSY lifetime gap. It is not MAIN incorporation. Metadata42 and native diagnostic18
are certified only for their bounded captured cases, not a universal metadata or
malformed-definition matrix. Revised own-hunk delivery and exact-export receipts
are in [card status](record:///status.md?card=card-t-c); detailed failed trials remain
there. Peer schema stat-sample conversion removal and staged reversals are excluded.
No universal indexed-expression substitution, full AggInfo architecture or STRICT
support is certified.

## Generated initialization diagnostic owner

`capture-diagnostics.py` uses actual pinned writable-schema fixture setup, then
reopens read-only: 18 controls (six per encoding), independent native source ID,
digested images, two failed prepare attempts plus same-connection SELECT1,
finalize/close. Self/mutual cycles remain compile-time SQLITE_ERROR; missing
STORED/VIRTUAL dependency, aggregate misuse and syntax are schema-time CORRUPT.
`build.c:sqlite3EndTable`2763 resolves *every* generating definition with
`resolve.c:sqlite3ResolveSelfReference`; TS uses its existing immutable SELF
resolver before publishing the Table. It intentionally does not recursively
expand dependencies at schema initialization. `prepare.c:sqlite3InitCallback`
malformed-schema error ownership supplies the schema-name diagnostic.

Public entry previously forced initialization even for source-free SELECT1.
`select.c:selectExpander`6036 instead locates tables only while expanding FROM.
TS now reuses the existing Select admission graph traversal to detect schema
need and supplies an uncached empty carrier for source-free graphs. WITH and
source-bearing graphs conservatively initialize; this bounded preflight is not
a complete translation of lazy native schema load at every name lookup. Failed
catalog graphs remain unpublished; no fabricated successful schema cache.

Native matrix led production correction; RED6/18 versus GREEN18/18, plus
generated binding45/45, current original composition232/232, affected108/108
and previous183/183. Failed capture mixed STORED-cycle hypothesis and diagnostic
wrapper/subsequent admission trials are retained in card status; command/log
evidence lives in generated-consumer-diagnostic-red and -repair card work areas.
General nondeterministic/subquery generated checks beyond existing SELF resolver,
STRICT and full native schema-load state remain progressive gaps.

## Scalar dependency BUSY lifetime — review24 R1/R2

Pinned expr.c4393–4422 generates the entire expression between IfNullRow and
logical affinity; expr.c4449–4464 keeps COLFLAG_BUSY and saved iSelfTab for that
whole recursive generation. The immutable TS per-source map must span every
recursive binder edge, not restart at scalar helpers. Review24 found that scalar
bindChild (CASE/BETWEEN/IN-list) and ordinary aggregate argument/filter/order
recursion omitted this map. All four sites now forward the same map. Existing
finally cleanup, source identity, register/sorter precedence and NullRow ordering
are unchanged; no RangeError catch or separate evaluator is introduced.

`capture-scalar-busy.py` and `generated-scalar-busy-native.json` cover81 independent
native boundary cases: CASE/BETWEEN/IN-list × joined/grouped/correlated ×
self/mutual/acyclic × three encodings. Public native-first RED27/81 (all54 cycles
reported limit instead of sqlite) → focused GREEN81/81. Cycles compare typed exact
error/message, twice failed prepare/no published statement and same-connection
SELECT1 recovery; acyclic controls compare typed rows, reset/finalize/close.
Evidence: `work:///cards/card-t-c/generated-scalar-busy-red/` and
`work:///cards/card-t-c/generated-scalar-busy-repair/`, with precise isolated
commit/tree/export, inclusion/exclusion hashes and fresh regression gates in
[status](record:///status.md?card=card-t-c). Revised delivery remains subject to
independent review, not MAIN or universal generated-expression parity. Remaining
NC_GenCol nondeterminism/subquery checks, generic lazy-schema state, STRICT and
generic indexed-expression matching/affinity/subtype/nullable fallback stay open.
