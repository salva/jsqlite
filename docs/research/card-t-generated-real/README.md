# Generated REAL value owner repair

Pinned 3.53.4 identity is checked by [capture.py](capture.py) against the retained
oracle library; [native.json](native.json) and fixtures were freshly captured
before the repair, then extended with signed six-byte boundary controls.

## Ownership and branch comparison

`expr.c:sqlite3ExprCodeGeneratedColumn` places IfNullRow before evaluation, copies
the generating expression, then emits STRICT VIRTUAL TypeCheck or Affinity.
`sqlite3ExprCodeGetColumnOfTable` saves SELF and maintains BUSY; TK_COLUMN
producer-register branches precede cursor generation. Those lowerings were not
missing an ordinary-column RealAffinity. The actual divergence was `vdbe.c`
OP_Affinity's REAL branch **after** applyAffinity: MEM_Int becomes MEM_IntReal for
[-140737488355328,140737488355327], otherwise double. TS previously retained
INTEGER. OP_TypeCheck owns the same transition for REAL; its former unconditional
double conversion is replaced with that shared opcode primitive.

`vdbe.ts:opcodeRealAffinity` translates these branches using existing Mem IntReal.
It deliberately does not change Mem.applyAffinity: comparison/numeric consumers
have different ownership. Null/non-numeric/fractional values skip the integer
transition. INTEGER/NUMERIC/ANY declarations are not globally realified. Shared
Btree, KeyInfo, immutable carriers, register precedence, BUSY/finally/cycles,
IfNullRow order, budgets and async execution are unchanged.

## Public differential matrix

`test/conformance/generated-real-value-native.test.mjs` independently compares
all typed cells and full metadata, columnType after copied value/text access,
DONE, reset/replay, finalize/close for all three encodings. The original declared-
type fixture is retained separately; its metadata-only origin-g exclusion is
unchanged. Extended fixtures cover NULL, integer, fraction, int64 maximum,
numeric/non-numeric text, six-byte boundaries, mixed-affinity dependencies,
VIRTUAL/STORED, STRICT ANY/REAL, table/view, join/nullrow, correlated scalar,
group aggregates and explicit selected covering index. This is bounded represented
caller evidence, not general generated/index-expression composition parity.

## Isolated candidate acceptance

This payload is constructed from exact parent
`5f6f4115bf6c340c41af0d7f6efc0d0159a0f4fb` plus only the authenticated opcode
repair, separate value witness, capture/native/fixtures and four scoped doc
additions. No live peer whole-file production or documentation changes are
included. Independent review is pending; this is not MAIN incorporation.

[Card status](record:///status.md?card=card-t-c) owns candidate commit/tree,
patch/archive hashes, exact-export commands/results, failed trials and
preservation receipts. Current native matrix is reused only after checking all
GREEN capture/native/fixture hashes. Original225 221/225 remains historical:
current bounded ordinary/view generated REAL cells pass; remaining original225
residuals are not established green by this correction or an invented225 rerun.
STRICT write admission, full NC_GenCol/lazy-schema, generic indexed expressions
and arbitrary composition remain outside this repair. Counts from overlapping
suites must not be summed. External peer189 is distinct from isolated owned188.
