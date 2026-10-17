# Hidden JSON document input coverage

Candidate: `025ca6e8486029b615aedf9afd3e7399df431284`; baseline parent `d4bfd8fc93385a58c0b49af296133aeabf379579`. Test-only integration overlay; not MAIN approval.

## Source and scope

Pinned `json.c:jsonEachColumn` JEACH_JSON returns original TEXT or BLOB using SQLITE_TRANSIENT; default ROOT returns retained prefix. Source demand avoids producing unreferenced hidden fields, not owning copies of explicitly demanded values. The new test wraps and calls original production `Mem.copyFrom`; exact source-payload equality counts real copied payload bytes. It restores prototypes/fetch in finally. This is not total heap, parse-image, transient conversion, reservation or peak-memory accounting.

`card-r-e-hidden-blob-native.py` obtains rows and all five column metadata fields independently from a development-only library. It asserts the full source ID and actual sqlite3_libversion_number **3053004** (the project's manifest/profile uses archive versionNumber3530400). Fresh isolated build uses ENABLE_COLUMN_METADATA/MATH_FUNCTIONS and passes all build profile probes. Native capture96 =3 encodings ×2 actual input storage classes ×4 modules ×4 projections (value/root/star/json). TEXT and literal JSONB BLOB inputs are distinct; module names alone earn no BLOB-input credit. Public Fetch tests use corresponding encoded databases, compare every typed cell and full metadata, repeat after reset and retain public BLOB values across reset/finalize. Hidden json keeps subtype-0 BLOB versus TEXT distinctions through columnType. No subtype introspection or exhaustive cancellation claim.

## Reproduction and results

Purpose work: `$SAIVAGE_CARD_WORK_ROOT/hidden-demand-diagnose/source`, exact candidate archive plus new fixture/test; existing dependencies linked. Fresh native build: `ORACLE_WORK_ROOT=$SAIVAGE_CARD_WORK_ROOT/hidden-blob-oracle sh tools/oracle/build.sh` (proc-e78ffa7f55b9 exit0; build log `work:///cards/card-r-e/hidden-demand-diagnose/blob-oracle-build.log`, profile `work:///cards/card-r-e/hidden-blob-oracle/profile.json`). Capture:

`HIDDEN_BLOB_ORACLE_LIBRARY=$SAIVAGE_CARD_WORK_ROOT/hidden-blob-oracle/build/libsqlite3-oracle.so python3 docs/research/card-r-e-hidden-blob-native.py`

Capture SHA256 `f1093bafe5866039399bf92bfc6fb4aca968a421f4856d7b3802c88d10d77342`.

Final set-e proc-db06f22747bb exit0: `node --experimental-strip-types --test test/conformance/json-hidden-blob-integration.test.mjs` **96/96**; `npm run typecheck`; `node --experimental-strip-types --test test/conformance/json-hidden-*.test.mjs` **100/100**. Logs `work:///cards/card-r-e/hidden-demand-diagnose/{blob.log,blob-type.log,hidden-all.log}`. Counts overlap. Previously diagnosed1519 focused tests unchanged except new test overlay; not rerun as a full product suite.

Exact parent archive plus same test/fixture: proc-c57f2bda635d exit1, **24 pass/72 fail**; visible/root/star allocation bounds fail, explicit json24 controls pass. This proves regression sensitivity, not a current candidate failure. Log `work:///cards/card-r-e/hidden-demand-diagnose/blob-baseline.log`.

Actual production samples each pass: UTF8 TEXT json_each visible/root/star1 copy ×183bytes=183; explicit129×183=23607. Actual BLOB json_each visible/root/star0 document copies; explicit128×184=23552. BLOB literal setup does not use copyFrom, so zero is correctly no owning copy of that exact input at this primitive, NOT zero allocations. Tree visible containers legitimately add document-sized copies; test allows at most3 versus1 otherwise. Final jsonb_tree explicit BLOB130×184=23920. Actual TEXT Mem encodings can differ from database encoding: count actual textBytes, allow UTF8/database-sized payloads rather than asserting database byte width for every copy.

## Corrected harness failures

Initial capture asserted archive3530400 against C API3053004 and stopped before capture; actual identity was inspected, fixed and fresh build performed. First test run incorrectly mapped native empty declaredType bytes to NULL; corrected pointer-presence check preserves empty string. Next test run incorrectly assumed every TEXT Mem used database UTF16; corrected to measure actual payload bytes and allow UTF8/UTF16. Neither is a runtime defect; final96/100 passes are on corrected fixtures/assertions. Prior failures remain in process evidence, not acceptance substitutes.

Broader independent caller/lifecycle assessment, original20k/profile reconciliation, current full342/adjacent/package gates and independent candidate review remain separate verification obligations. No runtime repair, MAIN/index/peer cleanup, scope expansion or release claim.
