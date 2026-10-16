# Retained CTE/module Window composition

## Current bounded repair

Pinned `select.c:sqlite3ColumnsFromExprList` (2227ff) honors aliases, walks through DOT and takes TK_COLUMN's resolved table column name. `vdbe.ts:transientSourceTable` now uses resolved metadata for direct columns rather than retaining qualified SQL spans as transient names; computed expression spans and explicit CTE/VALUES renames remain owned by their existing producers.

`window.c:sqlite3WindowRewrite` moves original FROM/WHERE/GROUP/HAVING into the input SELECT, while `sqlite3WindowCodeStep` consumes the ordered producer and invokes its return subroutine. `select.c` SRT_Coroutine emits the input row into the enclosing Parse's register payload. The existing TS retained-source Window path already emits this shared inner-loop producer/destination. Multi-source retained producers now use it instead of falling through to the derived-shape rejection or flattening Window calls into a module scalar emitter. No host row materializer, fake physical scan, new frame evaluator or new algorithm substitution is introduced.

The standalone direct JSON Window dispatch still rejects `execution-only expression reached scalar lowering`; this repair is not blanket module/Window admission.

## Revision-bound evidence

Input MAIN: eb6cce617c711744c43e1daf0d3b540fc56e0348 with preserved peer work/index. Original root beta capture retained at `work:///cards/card-w/metadata-correction-diagnose/expanded/native.json` and capture script in the same directory. Version 3.53.4, source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`, library SHA256 `8d3a57c33418e6273e85046b7a8b664ad47827660658dfacef0136416c9f48f3`.

`test/conformance/cte-json-window-composition.test.mjs` asserts captured original SQL, all five metadata fields and INTEGER cells in UTF-8/UTF-16le/UTF-16be, three executions/two resets, private entry failure, preabort, zero deadline, work failure, retained errors/restart and finalize/close. Fixtures are existing corrected cte-module-owner databases. This is not independent re-capture or universal frame/lifecycle coverage.

First admission experiment exposed `no such column: x`; replacing all CTE names with generic metadata then passed original but broke explicit CTE VALUES renames (three CTE test failures). Final correction narrows name ownership to resolved direct columns. Failed run: `work:///cards/card-o-b-g/processes/proc-d49c8c3eac6b/stdout.log` (100 pass/3 fail). Corrected five-file focused run: `work:///cards/card-o-b-g/processes/proc-2d73f555ee72/stdout.log` (109 pass/0 fail). Typecheck and CTE 9/9 plus expanded diagnostic probe: `work:///cards/card-o-b-g/processes/proc-e5dc48c6441d/stdout.log`. Original case typed/fullmetadata matches all encodings: `work:///cards/card-o-b-g/processes/proc-f32bc72442d4/stdout.log`. Diagnostic harness exit alone is not an assertion gate.

Independent review and root full integration remain separate; no release/browser/alpha claim.
