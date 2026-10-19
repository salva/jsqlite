# JSON result-column origins

Pinned SQLite `select.c:columnTypeImpl` starts declared type and all origins at
NULL, attributes only TK_COLUMN to its source, and follows TK_SELECT's result
expression recursively. `sqlite3GenerateColumnNames` owns names independently.
The public adapter copies compiled metadata and does not invent provenance.

The singleton internal module producer had separate grouped and ungrouped
aggregate returns that assigned its FROM module name to every output. Both now
use the same `jsonResultMetadata` as ordinary module projection, on the original
bound result trees **before** accumulator/sorter rewriting. A direct grouped
column therefore retains its database/table/origin; an aggregate expression does
not inherit the origin of its arguments. No value, subtype, accumulator, cursor,
null-extension, REAL or resource semantics are changed. This is translation of
the C semantic distinction, not an exceptional algorithm substitution.

## Evidence and boundary

The accepted red record is [[card:card-r-d]] status200. Inputs are the independently
assembled4918-file union with manifest SHA256
`4faf00c7a4f826a9c36ee502b85a9258e03afc0d179244506123cdd6dc37ba89`.
`tools/oracle/capture-json-result-metadata.py` imports no product code, asserts the
manifest source ID, opens each actual UTF-8/UTF-16le/UTF-16be fixture separately,
and captures all five C API metadata fields and typed rows through three runs.
`native.json` includes fixture hashes. Native library is the retained pinned
metadata-enabled build identified in [[card:card-r-e]] status368; captures here are
fresh, not candidate-derived expectations.

Original public/native reproducer:60tests/24pass/36fail before repair;
60/60 after repair (`proc-86b2fc25168d`), exact log
work:///cards/card-r-d/aggregate-metadata-red/repair.log. Four modules × allenc ×
count-star, count/sum/min aliases, direct column, grouped direct+aggregate, Window.
The extended capture adds scalar arithmetic, derived direct columns, physical
sqlite_schema JOIN/group controls, and two original lowering gaps now repaired in the isolated combined-input delivery.
Initial extended run120/96pass/24fail (`proc-8331abb8cac1`), log
work:///cards/card-r-d/aggregate-metadata-red/extended.log. Those failures were
nested aggregate arithmetic (`sum(value)+1`) and scalar aggregate subqueries.
The repair enrolls singleton JSON aggregates in existing shared AggInfo with
linked source identity, rather than lowering original aggregate trees as scalar
expressions. Ordinary singleton projection passes the linked scalar-subquery
emitter and synchronizes the builder/register high-water; aggregate children use
the existing wide Mem/Exists/Set destination path. AggInfo owns NULL reset, step,
finalization and result-expression register binding; the producer supplies owning
positioned column copies. No eager cursor reads or separate evaluator are added.
This follows `select.c:resetAccumulator/updateAccumulator/finalizeAggFunctions`
and final `selectInnerLoop`, with `expr.c:TK_AGG_COLUMN/TK_AGG_FUNCTION` register
reads and `sqlite3CodeSubselect` shared Parse/register/destination ownership.
The final isolated comparator includes all120 native shapes without exclusions.

Repair evidence: authenticated4918 plus accepted metadata patch, runtime input
SHA256 `9faa7b0e648514581de2549010c22db43993cced48b44c4447ac25c3a2c1d32c`;
output `b2cedb9c83433c3f41c1d89cd60417921fa7250fb5e6fdc5487a515707ffa66c`.
Exact incremental patch SHA256
`4396f08574580c162e8660e4e4e963d26d65c6f0f3bd0006acadbdc0652bf02a`,
work:///cards/card-r-d/json-nested-lowering-repair/delivery.patch.
Focused reproducer24/24 (`proc-30a37025846c`), typecheck plus522/522 focused
checks (`proc-e6d1edc06c09`) including full120 typed/five-metadata/three-run native
comparison, shared aggregate lifecycle/sum, expression subqueries, Window and
producer EOF/reset/close. Logs:
work:///cards/card-r-d/json-nested-lowering-red/final-reproducer.log and
work:///cards/card-r-d/json-nested-lowering-red/focused3.log.
Earlier broad resolution enrollment broke derived aliases and error wrapping;
it was narrowed to singleton module enrollment and NameResolutionError conversion.
The delivery is isolated: the dirty workspace patch check conflicts, and no MAIN,
default index or whole workspace runtime is adopted. Exact export and tests are
in work:///cards/card-r-d/json-nested-lowering-repair/export/. These are author
checks, not independent combined acceptance or general nested SQL certification.

The separate grouping/snapshot finding from peer b remains unadjudicated by this
metadata repair; the passing grouped shape here is a finite source/metadata
control only. Full configured inventory, CHECK/FK/IN-list/Chinook acceptance and
independent combined-input review remain parent obligations. No MAIN adoption,
publication or whole JSON scope acceptance is implied.
