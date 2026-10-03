# Shared private budget coverage — unresolved admission

Follow-up to [[card:card-v-b]] verify gaps. New corrupt-page test keeps the valid
SQLite header/schema and sets t1 page-2 flags to zero in a digest-bound CURRENT
subquery fixture. It asserts SQLITE_CORRUPT (11) on step, saved reset error and
cleanup; this passes in actual Chromium Fetch/ESM execution. Source owner is
pinned btree.c btreeInitPage flag validation, not open-time format detection.

Shared-budget probes independently capture pinned-native typed rows using
`python3 test/browser/capture-budget.py /path/to/pinned/libsqlite3-oracle.so`.
The script source-ID checks and read-only opens CURRENT subquery-utf8. Standalone
inner sorter and outer sorter pass under maxPrivateBytes=150. The composition
uses inner ORDER BY b LIMIT 4 and outer ORDER BY b DESC; at 300 it should produce
the unchanged native ordered values if admitted. A 150-byte composition probe
is intended to test shared reservation and reset cleanup. Neither composition
currently reaches execution: built artifact rejects prepare as unsupported,
`this derived CTE composition is not implemented`. Thus **no shared-budget proof
or byte threshold credit** is obtained; the passing small-limit probe with the
previous outer ORDER BY a was not proof of simultaneously live sorters.

Latest full run exit 1: 38 executed, 36 pass, 2 fail, 0 timeout. Both failures
are unsupported admission, not demonstrated wrong rows or shared-budget defect.
Expectations and failures are retained rather than changing them to unsupported
success or deleting suites. Original semantic/goal owners must adjudicate current
admission and select an admitted producer composition or repair if required.
This test card does not extend engine admission or change owner scope.

Full evidence: work:///cards/card-v-b/processes/proc-eb3e5330e6d4/stdout.log;
report work:///cards/card-v-b/browser-e2e/report.json SHA256
8729b45e978d3e91630eead597a4f85c73b0712439dc4cf0fea12d706056c2a2.
Chromium 148.0.7778.96 / Playwright 1.60.0. Existing 33 cases and corruption plus
two standalone sorter companions all pass. Independent/global acceptance remains
absent; no new upstream test compatibility credit claimed.
