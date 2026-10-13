# R1 mixed row identity — [[card:card-r-d]]

Review [[card:card-r]] v27 identified negative-column input mapping to base-1.
Pinned `json.c:jsonEachCursorReset/Next/Rowid` resets iRowid to zero, advances once
per cursor row and returns it independently of byte-offset id/key. Pinned
`expr.c:sqlite3ExprCodeGetColumnOfTable` selects OP_Rowid for negative columns;
AggInfo preserves this identity across direct and grouped sorter/saved phases.

The mixed producer now maintains a separate identity register reset on filter and
incremented on successful Next. NULL extension clears it separately from the ten
JSON fields. Physical identity is emitted by OP_Rowid into a dedicated input
slot (including INTEGER PRIMARY KEY tables), not inferred from an adjacent
column. Each input source owns named columns followed by one identity slot.
Negative-column binding selects that slot; grouped capture includes both slots
and uses existing sorter/saved mapping. Metadata for implicit identity uses the
resolved result descriptor rather than indexing a nonexistent named column.
No JSON id alias, host evaluator, broad admission disable, membership change,
SrcItem ownership change or R2 guide-baseline rewrite.

## Evidence

Exact milestone `662b97b5646bded78cdcc8bfd0b8e41c053d81d6` was extracted via git
archive, not workspace snapshot. Tests first: current public and exact milestone
0/6; native six numeric/NULL companions passed capture. Logs:
`work:///cards/card-r-d/processes/proc-32389154f2cb/stdout.log` and
`work:///cards/card-r-d/processes/proc-928c476df6f1/stdout.log`.
Initial repair 4/6; grouped payload values were fixed but column metadata still
indexed missing named-column descriptor. Corrected descriptor ownership; all
six pass. Expanded nine cases cover projection/reset, all three JSON/physical
aliases, unmatched LEFT, aggregate arguments/FILTER/GROUP/HAVING and per-physical
scan 0/1 restart. Native expanded output matches expected INTEGER/NULL rows:
[retained capture](card-r-d-rowid-native.jsonl). Existing independently built
3.53.4 shared oracle/profile is used, not host SQLite.

Current focused typecheck + nine cases + diff check passed. Same nine cases
passed on milestone with patch applied; IPK fixture (native-generated 31-row
`t1(n INTEGER PRIMARY KEY,x TEXT)`) also passes all nine. Initial broad repair
chain passed typecheck and existing affected JSON/aggregate/subquery/packed-IN
suites; final focused rerun follows physical OP_Rowid explicit slot refinement.
Full commands/output references and final delivery identity are in
[status](record:///status.md?card=card-r-d).

Scope is mixed physical-left/JSON-right identity, not broad virtual-table parity.
General single-source aggregate rowid mapping is not claimed repaired. New cases
are UTF-8, not exhaustive all-encoding/resource/error certification. No claim of
R2 correction, parent coordination approval, MAIN promotion or CHECK/FK-specific
new verification. Patch is isolated against reviewed milestone; default index,
remotes/configuration and inherited source/docs remain untouched.
