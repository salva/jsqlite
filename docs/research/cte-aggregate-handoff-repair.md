# CTE / aggregate handoff repair — revision-bound evidence

Base: `4ab82183c910acd9d3c58fb622b5f175c6b6bf46`; [[card:card-n-b]].

Two independent handoffs failed. Retained derived input installed a linked transient NameContext, then the recursive aggregate compiler flattened its producer anyway. This changed result reductions without changing the linked resolved carriers. Preventing late flattening once `parent.input` exists preserves the installed AggInfo source identity; it does not relax name lookup or catch INTERNAL errors. Pinned `select.c:substSelect` substitutes result, GROUP/ORDER/HAVING/WHERE together; a consumer cannot retain pre-substitution bindings. Retained input is the existing bounded coroutine adaptation, not a new evaluator.

The scalar compound producer received a row callback but no SelectDest. Its merge branch uses SelectDest, so it defaulted to SRT_Output, bypassing the aggregate consumer. Passing the same coroutine destination through both compiler contracts restores `selectInnerLoop`'s SRT_Coroutine versus SRT_Output ownership (pinned select.c 1440–1455). No changes to MakeRecord, JSON, generated columns, vector behavior or index execution were made by this repair.

## Verification

Original existing tests were red before edits: 18 tests, 12 pass, 6 fail, both failures across three encodings. After repair:

```
node --experimental-strip-types --test test/conformance/cte-execution.test.mjs test/conformance/recursive-cte-aggregate.test.mjs
npm run typecheck
```

18/18 pass and typecheck passes. Added full one-column count metadata assertion to the existing reset/binding/NULL/empty-input destination tests. Existing reproducer SQL and expectations unchanged.

Independent ctypes capture using retained pinned library verifies version 3.53.4 and exact source ID against manifest. Both SQL statements prepare successfully and finish SQLITE_DONE in all encodings; grouped rows are INTEGER pairs (1,1),(3,1),(5,1),(7,1), and ordered UNION count is INTEGER 2. Capture also records full metadata. Artifact: `work:///cards/card-n-b/cte-handoff-verification/oracle.json`; command output: `work:///cards/card-n-b/processes/proc-c72415aea3e0/stdout.log`.

Original225 manifest file list rerun through existing `tools/test/integration.py --jobs 2 --oracle-library <retained library> <original225 files>`, with Chinook environment and purpose-named work root. 225 components completed: 221 exit zero, four failing components (index planner, select-entry-context, select-scalar-child, select-window-cross-layer-integration). Original baseline had seven failing components; current CTE execution, recursive aggregate, multisource order and subquery foundation components pass. Inputs include unrelated peer edits; differences are not all attributed to this repair. Nine remaining raw348 components were not rerun or merged into this denominator. Manifest: `work:///cards/card-n-b/cte-handoff-verification/integration-run/manifest.json`.

Lifecycle/control companions: retained `derived-aggregate-alias` capture passes derived-order-limit-aggregate (3/3); retained `common-red` capture passes derived-aggregate-resources (24/24), including private bytes/entries/work/results failures, refund/reset/rebind, live abort and deadline. An initial attempt incorrectly supplied common-red to the ORDER/LIMIT test, which then exercised a different broader matrix and failed three components with temporary unsupported compound arms; correct separate captures passed. That failure is not compatibility credit.

No whole-suite green claim. Shared main workspace has large unrelated staged/unstaged changes including the same VDBE and guide paths. A scoped integration commit has not yet been made; these repair edits must be isolated from peer changes rather than committing the existing index wholesale.

## Pre-integration destination strengthening

Pinned-native-first companion SQL: `SELECT count(*) FROM (SELECT ?1 UNION SELECT ?2 UNION SELECT NULL ORDER BY 1 LIMIT ?3)`.
One prepare with six reset/rebinding runs: (3,4,-1)→3; (3,3,-1)→2;
(NULL,NULL,-1)→1; (7,8,0)→0; (9,10,1)→1; (11,12,-1)→3.
All outputs INTEGER, one row then DONE; all three encodings have full count
metadata (name count(*), all origin/type fields NULL). This distinguishes empty
producer from an all-NULL distinct set and proves changed parameter values after
reset do not retain producer/accumulator state. Added tests before any further
production change; no further production change was necessary.

Native capture script and JSON: `work:///cards/card-n-b/cte-handoff-strengthening/oracle.py`
and `work:///cards/card-n-b/cte-handoff-strengthening/oracle.json`.
Command `python3 "$SAIVAGE_CARD_WORK_ROOT/cte-handoff-strengthening/oracle.py"`
passed (`proc-1e347e4bce05`), exact pinned source ID verified in output.
Expanded focused command `node --experimental-strip-types --test test/conformance/cte-execution.test.mjs test/conformance/recursive-cte-aggregate.test.mjs && npm run typecheck`
passed (`proc-2acc154ee865`): 21/21 and typecheck. No artificial whole-green criterion.
The public typed row/DONE discriminator is sufficient here; no brittle opcode
count is added for the ordered merge implementation.
