# Expanded mixed metadata results before ORDER — [[card:card-e-n]]

## Source ownership and repair

On 41fb81de the mixed compiler resolved ORDER against syntactic select.result,
then expanded stars only in the row-consumer body. Bounds rejected visible
ordinal2 and ordinal1 attempted to lower an absent star reduction. This is a real
semantic production/caller ordering defect, not missing vtab breadth.

Pinned 3.53.4 select.c sqlite3SelectPrep6472–6474 runs sqlite3SelectExpand,
checks errors, then sqlite3ResolveSelectNames. selectExpander5962 expands * and
TABLE.* in source order. resolve.c resolveOrderGroupBy consumes that expanded
pEList; its integer bounds are against nExpr, not the pre-expansion syntax.

The bounded mixed compiler now builds its existing visible projection descriptors
before resolving ORDER. Ordinals select their expression trees; output-name/alias
lookup uses the same ordered descriptors. Projection, output metadata and
SELECT destination width continue consuming that list; DISTINCT key descriptors
also use it (metadata DISTINCT remains explicitly gated). Hidden arg/schema
remain bindable but excluded from star positions. No AST mutation, new evaluator,
nested statement or native runtime dependency. TS descriptors are an ordinary
representation adaptation, not an algorithm substitution.

Only semantic production ordering and these consumers change. Complete-scope
binding, ready INNER terms before Filter, LEFT ON matching before WHERE and
unmatched NULL completion, metadata versus JSON identity, Filter/Next ownership,
collation selection, sorter candidate payload/drain and lifecycle cleanup remain
on the existing paths. No cursor transitions or error translation are bypassed.
Untranslated projections retain null expression carriers and fail honestly.

## Revision-bound verification

Accepted red status99 records fresh native capture BEFORE repair on exact41fb:
12 SQL × three encodings; 30 successful cases with typed rows, all five metadata
fields and reset replay; six invalid ordinal prepares. Public 15 pass/21 fail.
Capture/receipt/regression are capture-tvf-star-order.py,
star-order-red-native.json and star-order-red.test.mjs beside this note. The
receipt asserts pinned source ID and hashes embedded images. This repair reuses
that unchanged independent native receipt; it does not claim a new native run.

The bounded matrix covers */t.*/p.*, first/later metadata ordinals, multikey,
output-name/alias precedence, matched/unmatched LEFT and invalid ordinals.
Invalid controls assert rejection only, not exact error-message equality.
Current-node commands, attempted implementation failure and exact delivery
identity are retained in card status.md. Existing TVF ORDER, ON, identity and
resource regressions are rerun with the new matrix. Finite success is not full
ORDER/error/resource grammar compatibility. Grouped/distinct/limited metadata
joins, database_list joins, metadata identity, generated outer bindings, attached
schemas and generic virtual-table planning remain explicit gaps.
