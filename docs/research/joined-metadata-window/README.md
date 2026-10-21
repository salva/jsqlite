# Joined metadata Window input

The compiler routes a joined metadata source to the existing Window original-input
WHERE coroutine, as already done for singleton metadata and mixed JSON. Real
ResolvedSource/register identity and sourceRow/consumeRow enrollment remain the
owner; Filter/Next, WHERE/ON, LEFT null completion and hidden argument selection
are not reimplemented. This is bounded composition admission, not general module
planner closure or a new frame algorithm.

## Source comparison

Pinned SQLite 3.53.4 (`reference/sqlite/manifest.json`): `window.c:sqlite3WindowRewrite`
moves original Src/Where into the producer; `sqlite3WindowCodeInit/Step` share
cursors and drive producer rows. `pragma.c:pragmaVtabFilter/Next` prepares an
invocation, steps its first row, then advances. The TS path is
`compileTableSelectProducer → compileWindowSelectLowering → inputSelect →
compileInnerTableSelect → sourceRow/consumeRow → Yield`, not legacy mixed scalar
projection (which cannot lower a Window node).

An expanded incompatible rank/count regression revealed overlapping schedule
selection: cumulative RANGE selected both peer drain and generic row RANGE drain.
Pinned `window.c:windowAggFinal` emits xValue into regResult; `windowCodeOp`
performs it before the peer ReturnOneRow loop. `rankValueFunc` clears nValue on
publication. Repeated xValue per row produced zero for later peers. The compiler
now makes these schedule classes disjoint and reuses the existing peer drain;
no callback semantic change or parallel evaluator. Inner incompatible results
remain lifted payload columns, while only outer group results remain live.

## Finite evidence

`native.json` embeds independent pinned native typed rows, all five column metadata
fields, fixture bytes and SHA256 for nine cases × three encodings × two executions.
The library was reused from the root SourceID-verified build, not independently
rebuilt. Capture: `tools/oracle/capture-joined-metadata-window.py` takes the library
path with COMMON_CHECKPOINT_SOURCE and fresh COMMON_CHECKPOINT_OUTPUT; run with
PYTHONDONTWRITEBYTECODE=1. NULL and empty declaredType stay distinct.
`joined-metadata-window.test.mjs` verifies original seven triples, hidden arguments,
LEFT empty, NULL input, generated outer columns, filter-before-window, incompatible
groups, and neighboring scalar aggregates. `joined-metadata-window-controls.test.mjs`
covers all encodings, pre-abort/deadline/work failure with retained reset error and
restart, live held-task abort/deadline, and deferred-close statement lifetime.
These are author tests, not independent acceptance, universal schedules, memory
accounting closure or original20k performance proof. No direct upstream accounting
credit is added. Commands/results and failed hypotheses are in [[card:card-o-b-g]]
status; root matrices/browser and independent review are separate gates.
