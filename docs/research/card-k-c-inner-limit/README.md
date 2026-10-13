# INNER direct-result stabilization

Bounded correction of `afa4d01e6044f19389df1a556d645af51eddc624` (parent
`d5933deb81b8b02f7c905d71d1b18278cc8abd97`), not new join breadth.

Pinned `select.c:selectInnerLoop` reserves iSdst and passes it to
`expr.c:sqlite3ExprCodeExprList`; `sqlite3ExprCodeTarget` writes a plain TK_COLUMN
there, and a copy is emitted only for a different returned register. The joined
TS caller instead allocated a column temporary, copied into a second temporary,
then copied to the result. Direct bound column/rowid production now targets the
result register. Physical access and REAL affinity remain intact; generated,
STRICT-generated, aggregate and non-column carriers retain the shared emitter.
LIMIT initialization, work charging, ResultRow/DecrJumpZero ordering and resource
owners are unchanged. No shared expression or LIMIT interface repair is required.

Native-first `capture.py` accepts a pinned native library and expr-relational DB.
`native.json` retains source identity, fixture hash, typed rows, all five metadata
fields and DONE for LIMIT1, LIMIT0, offset1 and empty WHERE. Native work-budget
parity is not claimed. The unchanged public 20-unit test now returns INTEGER31/31
then done; an added cumulative boundary test returns a row at18 but fails before
completion, completes at19, and preserves reset's first-error identity/recovery.
These numbers describe this fixture/program's charged checkpoints, not a universal
cost guarantee. ORDER's original20-unit rejection remains required.

Failure chronology and commands: [[card:card-k-c]] status and card work evidence
`inner-limit-evidence/`. Initial direct-emitter-only candidate still failed on
second step: the caller's second temporary copy remained. Removing that redundant
caller materialization completed the repair. The new boundary test initially
misused reset after error; corrected to assert retained primary error, then retry.
Native capture was obtained through a retained sourceID-checked 3.53.4 library,
not rebuilt here. Exact committed-archive verification receipt is in card status.
No broad-green, alpha, skipscan/WHERE/JSON closure or release claim.
