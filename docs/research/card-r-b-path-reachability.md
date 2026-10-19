# Incremental JSON path reachability

Author repair on shared HEAD `2274a1467ddaf5f6277d8f8596aa9ddcadc95851`; not the advisory isolated c2a21ef artifact and not independently accepted.

Pinned SQLite 3.53.4 source ID: `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.

## Source comparison

`jsonLookupStep` parses a dot label before checking OBJECT shape, checks ARRAY shape before parsing a bracket index, and returns NOTFOUND before consuming an unreachable tail. `jsonCreateEditSubstructure` recursively passes the unconsumed path into an empty object/array. Previously `jsonEdit` consumed the whole path before `editNode`; read lookup also continued parsing after NOTFOUND. Both diverged from the source's error order.

`pathStep` now parses one reached step. Read lookup and edits consume it only after the appropriate shape check; recursive edits and private substructure creation carry the original path plus offset. No exception suppression or SQL-text dispatch. Native byte-buffer splicing remains represented as private node construction/copy-on-write ancestors. Earlier flags coercion and peer depth/accounting machinery are retained.

## Native capture

`sh tools/oracle/build.sh` succeeded with source verification and native self-check (`work:///cards/card-r-b/processes/proc-6bb9f3888e34/stdout.log`). The fresh library was used through ctypes `sqlite3_prepare_v2`, `sqlite3_step`, `sqlite3_column_type`, `sqlite3_column_text`, `sqlite3_errmsg`, finalize and close. Every literal expression in `json-path-reachability.test.mjs` was evaluated against a private in-memory database. Actual results and source ID are [captured here](card-r-b-path-reachability-native.json); public tests compare exact type/value and error message/code to this independent capture. JSONB bytes are compared via SQLite hex (empty object `0C`). Native execution is development evidence, not a product runtime backend.

## Verification and limits

- Original accepted reproducer: 3 failures/2 controls (status v48); now passes.
- Typecheck plus path/substructure/flags/scalar/boundaries: 42/42 (`work:///cards/card-r-b/processes/proc-1d4f6bb5ad41/stdout.log`).
- Expanded oracle-backed public matrix across utf8/utf16le/utf16be: 84/84; typecheck and scoped diff check passed (`work:///cards/card-r-b/processes/proc-f573c748ac43/stdout.log`). Statements reset/reused and finalized; reached malformed tails retain exact errors, unreachable tails do not error. Covers read/type/length/arrows, replace/remove/insert/set/array-insert, TEXT/JSONB, from-end and sequential edits.
- Sum/REAL/subquery/outer constraints/Chinook command: 76 pass/1 failed, exit 1 (`work:///cards/card-r-b/processes/proc-baceb12911c3/stdout.log`). Chinook failed at module load because CHINOOK_DB was not supplied; no Chinook coverage is claimed. Other suites passed.

No failed production hypothesis: direct incremental control-flow replacement converged. Earlier red harness corrections and historical flags accessor failure remain in retained status history. No exhaustive depth/cancellation/work accounting matrix specific to this change, full standard suite, or independent acceptance. Shared overlapping files/index were not staged/discarded. Isolated attributed patch/commit remains pending coordination; a whole-file shared diff would wrongly attribute peer parser/depth machinery. Earlier full359/new360/negative SyntaxError probes remain incomplete/failed, not erased by these passes.
