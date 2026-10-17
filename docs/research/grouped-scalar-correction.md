# Zero-source grouped scalar destination correction

## Source and owning paths

Pinned source: SQLite 3.53.4, `reference/sqlite/manifest.json`.
`resolve.c:1968–1991` preserves the enclosing NameContext and sets SF_Aggregate
for GROUP BY even without an aggregate function. `select.c:selectInnerLoop`
omits result-value generation for SRT_Exists; with neither result sorting nor
DISTINCT, codeOffset precedes projection. `sqlite3Select` IgnorableDistinct/
IgnorableOrderby removes irrelevant Exists output processing. GROUP production,
HAVING and prepare-time name resolution still occur. `expr.c:sqlite3CodeSubselect`
owns Once, the prepared scalar LIMIT and the Mem/Exists destination.

The TS correction uses existing AggInfo/group-sorter machinery, not a new evaluator:

- `compileScalarSelect` delegates noncompound zero-source GROUP to
  `compileAggregateSelect`, retaining builder, parameters, linkedPlan,
  expressionBinding, destination and prepared LIMIT. Ungrouped scalar routing is unchanged.
- `compileWideSubquery` remains the common Mem/Set/Exists producer. The physical
  `compileTableSelectProducer` grouped IN caller and AggInfo's
  `compileAggregateSubquery` nested grouped caller now reach that producer.
- `resolvedScalarSubqueryEmitter`'s aggregate branch retains Exists rather than
  always choosing Mem. Grouped linked result metadata comes from resolved
  descriptors, not a nonexistent local physical source for outer columns.
- AggInfo derives effective result clauses from its destination, matching
  `select.c:7637–7656` IgnorableDistinct: Exists suppresses both result DISTINCT
  and ORDER processing, together with runtime EList. Grouped and ungrouped
  output therefore never DISTINCT-compare unproduced registers. OFFSET precedes
  projection when no effective DISTINCT/result sorter intervenes; Mem/Set keep
  their DISTINCT-before-OFFSET publication semantics. Resolution, GROUP/HAVING,
  aggregate-local DISTINCT and shared LIMIT/error cleanup remain owned as before.

Other `compileScalarSelect` consumers include standalone SELECT, compound arms,
zero-source derived/aggregate inputs and recursive row producers. The focused
existing child suite exercises derived/grouped/shared-builder publication;
metadata bind/invocation, aggregate lifecycle and JSON readiness suites exercise
representative caller and shared-budget boundaries. This is not an exhaustive
proof of every compound/recursive/virtual-table shape.

## Primary native controls

`tools/oracle/capture-grouped-scalar.py` loads the retained pinned C library via
ctypes, verifies sourceId and image SHA256, and records prepare phase, complete
ordered five-field metadata, typed INTEGER/NULL rows, terminal errors and two
executions per binding in `grouped-scalar-native.json`. Inputs are
`grouped-scalar-queries.json`; images reuse the independently generated metadata
fixture receipt. No system SQLite fallback or shipped native dependency.

The public Fetch test `test/conformance/grouped-scalar-destination.test.mjs`
compares those receipts in UTF-8/UTF-16le/UTF-16be: the original (7,1,1)
witness; empty input; NULL; HAVING false/NULL/true/error; ordinal versus arithmetic
GROUP; LIMIT zero/OFFSET; skipped malformed-JSON projection and Exists ORDER;
correlated physical-parent destinations; nested grouped scalar composition;
prepare-time invalid ordinal/missing column; integer/null rebind and reset.
F4 adds the multi-group DISTINCT/Exists/OFFSET witness, constant-projection
Mem/Exists/Set contrasts (only Exists ignores DISTINCT), bound/exhausted OFFSET,
empty/HAVING cardinality, lazy projection, HAVING errors, prepare rejection and
ungrouped aggregate destination controls. These extend, rather than replace,
the original 16 native queries; the receipt now has 25 queries per encoding.
Additional API-only controls check clearBindings, pre-step cancellation/reset,
saved private-entry error identity, finalization and fresh connection recovery.
They do not prove mid-execution cancellation or exhaustive resource schedules.

## Verification and remaining acceptance

Current command results, failed hypotheses and exact delivery identity belong to
[[card:card-m-f-k]] status. Independent corrective-delta review by
[[card:card-m-f-l]] and ROOT [[card:card-w]]'s unchanged integrated replay remain
separate obligations. No product/release or zero-remaining-gap claim follows.
