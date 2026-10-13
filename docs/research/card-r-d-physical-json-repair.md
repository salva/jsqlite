# Physical-left JSON repair evidence — [[card:card-r-d]]

Base MAIN `10634c80e6bdf622cd21c68459000e2f482c3e3d` includes packed membership/parser ownership `e17d3a12`. This is a scoped repair, not general virtual-table planning or a global signoff. No host evaluator/module registration or pretty rewrite.

## Source and implementation

Pinned 3.53.4 source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`; independently built with ENABLE_COLUMN_METADATA/ENABLE_MATH_FUNCTIONS. `json.c:jsonEachBestIndex/Filter/Next/Column` retain cursor argument/traversal ownership. `where.c:sqlite3WhereEnd` records ON matches independently of WHERE, then NULL-extends unmatched rows. Mixed `compileTableSelectProducer` now follows that completion with a match register and shared consumer subroutine, clearing all ten payload fields. The complete parse image remains statement-owned, not streaming parsing.

Mixed aggregates now use `compileAggregateSelect`'s existing input-register seam for AggInfo, FILTER, scalar aggregate projections and grouped sorter/finalization. SELECT-private resolution-only virtual columns are supplied via existing `SchemaGraph.withTransientTable`; they are never OpenRead tables. Generated payload expressions go through the parser; original SrcItem/arguments/ON reductions are retained, including immediate nested SELECT ownership. Physical cursor 0/JSON cursor 1 are reserved before aggregate temporaries. Hidden columns retain empty types. Mixed binder now descends scalar/vector IN, BETWEEN and CASE operands, instead of leaving unresolved column names to cursor defaults; packed IN implementation is unchanged.

## Reproduction and native evidence

Red public/native probes: CROSS/INNER equality correlation and nested scalar SELECT argument matched; LEFT empty cursor silently lost 31 rows; grouped count threw `no such table: json_each`; scalar IN produced 4 rather than 62 rows. Red logs and build profile are linked in [status](record:///status.md?card=card-r-d).

Current independently obtained captures:
- [Six pinned queries](card-r-d-physical-json-native.jsonl), SHA256 `cdb6db8c9374dd4b650144ff6cbfcfefdda626334cf91da2e50ee7cde2bde253`.
- [Current public six-query capture](card-r-d-physical-json-public.jsonl), SHA256 `830c395c37f2409b1b78646b853274ff38a3b3d7ce0284543b8c65427314520c` (typed rows and metadata).
- [Expanded pinned cases](card-r-d-physical-json-expanded-native.jsonl), SHA256 `966d0d5531c7ad9125336607a6d910873a533aeb17dd792c2351a3d5b310079f`; [capture script](card-r-d-physical-json-native.py), using independently built shared oracle in `$SAIVAGE_CARD_WORK_ROOT/oracle-build`. INTEGER/NULL are explicit. This script is only for this numeric/NULL matrix, not general BLOB/REAL oracle serialization.

## Verification

- Final `npm run typecheck && node --experimental-strip-types --test test/conformance/json-physical-left-red.test.mjs && git diff --check`: exit 0, 5/5. Includes LEFT projection/aggregate, ON versus WHERE, NULL input, JSONB/tree missing path, hidden NULL fields, grouped/ungrouped FILTER/projections, scalar/vector IN and reset/re-step. Earlier generated quoted payload attempt failed `no such column: "t1"."n"`; corrected identifier decoding at mixed binder. Earlier failed edit script made no project changes.
- Typecheck + focused/JSON/shared-parent/outer-aggregate/subquery/multisource-left/selected-IN/reset suites: 228/228, exit 0; `work:///cards/card-r-d/processes/proc-7d3a757c0677/stdout.log`. This preceded final cursor-frontier reservation; focused tests were rerun afterward.
- Initial Chinook invocation failed missing CHINOOK_DB. Found fixture and reran `CHINOOK_DB="$SAIVAGE_CARD_WORK_ROOT/chinook-fixture/Chinook_Sqlite.sqlite" node --experimental-strip-types --test test/conformance/aggregate-group-chinook-regressions.test.mjs test/conformance/expression-subquery-chinook.test.mjs`: exit 0; `work:///cards/card-r-d/processes/proc-77b53bdbae06/stdout.log`. Expanded native capture shares that log. No specific CHECK/FK suite result is claimed.

## Boundaries

Measured new mixed cases use the UTF-8 select4 fixture; existing metadata/subquery suites exercise all encodings, not an all-encoding mixed oracle matrix. Dynamic-path/duplicate/malformed/depth/resource/control exhaustive mixed schedules remain uncaptured. Existing cursor resource/first-error tests passed; this does not prove every mixed cancellation schedule. RIGHT/FULL/NATURAL/USING/reverse correlation are not enabled. General mixed ordering/projection combinations and correlated nested SELECT contexts need readiness/admission work. No review or peer coordination approval is inferred. Extensive inherited staged/unstaged docs/resolver edits remain preserved; delivery staging/commit must isolate owned changes and coordinate overlapping current documentation with Planner.
