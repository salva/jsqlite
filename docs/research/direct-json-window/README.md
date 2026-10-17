# Direct JSON Window finite author evidence

Pinned SQLite3.53.4 sourceID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
`tools/oracle/capture-direct-json-window.py` uses ctypes against a freshly built,
column-metadata-enabled pinned library, fixture hashes and genuine native prepare/
step/reset. `native.json` is independently obtained C output, not TS expectations.
60 variants = four modules × three encodings × direct probe/hidden/JSONB/empty/
SQL NULL input;180 native executions including two resets per statement. Public
TS comparator preserves all five metadata fields, INTEGER/REAL/NULL/TEXT/BLOB
representations, values and rows. This finite set does not contain REAL output or
BLOB container output, nor arbitrary frame/partition/error parity.

Commands on workspace HEAD46fa4589952a3f6124c3e847d47f0fe2f05bf379 plus existing
shared edits:

- `sh tools/oracle/build.sh`: exit0; source verification/configuration/build receipt
  `work:///cards/card-o-b-g/processes/proc-c445cd187b3a/stdout.log` (partial inline,
  complete durable log). Uses designated oracle-build work child.
- `python3 tools/oracle/capture-direct-json-window.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" > docs/research/direct-json-window/native.json`: exit0; final capture in
  `work:///cards/card-o-b-g/processes/proc-07e9e73c2edd/stdout.log` preceded test failure
  below; earlier36-variant capture receipt proc-a5c02fe0b791.
- New controls initially failed3/75 because test finalized malformed-error statements
  without asserting the retained error. Source/API existing behavior rethrows that
  same error on finalize. Corrected test asserts identity, not runtime behavior.
  Failed output `work:///cards/card-o-b-g/direct-final.log`; proc-07e9e73c2edd.
- Final `node --experimental-strip-types --test test/conformance/direct-json-window*.test.mjs test/conformance/cte-json-window-composition.test.mjs test/conformance/window-rewrite.test.mjs test/conformance/select-json-window-parent-entry-owner.test.mjs test/parser/window-graph.test.mjs`: **186/186**. Followed by typecheck, package boundary, accounting and diff check, all five statuses0. Receipt
  `work:///cards/card-o-b-g/processes/proc-032a3eb3b236/stdout.log`, full tests
  `work:///cards/card-o-b-g/direct-expanded-final.log`.

Control companion checks each encoding with direct JSON Window: initially aborted
signal, zero timeout, work-unit cap, private-entry cap, reset failure retention and
restart, malformed JSON/finalize retained error, subsequent scalar recovery.
The integrated companion also covers initially-live cancellation and deadline
expiration during a held host task on a300-row direct input, with reset error
retention and restart (integration evidence below). This finite suspension test
does not prove every sort/frame schedule or allocation failure. Demand-copy and
internal refund instrumentation are separate independent review evidence, not
assertions in this delivered companion (see review scope below). Prior focused original123/123 and
physical Column-vs-Copy failed-hypothesis evidence remains in
`record:///status.md?card=card-o-b-g&v=134`.

Current native.json SHA256 `b100846d58350f71b4b4a0b46dd3ea8eb1f7e1d025401d48a0375f352dde2d72`.
No new upstream assertion credit; historical denominators are unchanged.
Isolated integration candidate is archived HEAD46fa4589952a3f6124c3e847d47f0fe2f05bf379
plus only direct Window compiler hunks, tests/capture and finite documentation.
It needs neither untracked host-admission nor module-plan peer changes. Initial
75/75 plus typecheck passed (proc-b448b0c1ad14). Wider wildcard run614/619:
three CHINOOK_DB-required files and two COMMON_CHECKPOINT_OUTPUT-required files
failed due absent external inputs; not waived or counted passing. Package and
accounting passed. Log: work:///cards/card-o-b-g/direct-integration/regressions.log.
Suspension control first used two input rows, never reached a host task and was
terminated (proc-87924dffe0d6). Corrected to300 rows, actual scheduler suspension,
then abort or expiration while held;3/3 pass (proc-bd5fec43bd86). This is a test
workload correction, not a runtime or scheduler change. Final focused candidate
183/183 and typecheck pass (proc-6fe8540e8ee1), log
work:///cards/card-o-b-g/direct-integration/final.log. Count differs from mixed
workspace186 because its unrelated peer tests are not in immutable base.
Independent runtime review of installed ec74321e796e31234a16bb4fd98516acf57501df
is retained at `record:///status.md?card=card-o-b-c&v=110`:183 focused, fresh60-variant
native comparison, supplemental48 native/public variants, demand/refund3/3,
and affected1117/1117. Fresh inputs resolve the five historical missing-input
gates above;614/619 remains a failed historical run, not retroactively passing.
Supplemental review artifacts are not integrated tests. The review accepts the
bounded runtime, not exhaustive schedules/allocations or root/release acceptance;
its D1 current-prose correction still needs independent confirmation on the
final doc-only input. Exact installation receipt and commit in [[card:card-o-b-g]] status.
