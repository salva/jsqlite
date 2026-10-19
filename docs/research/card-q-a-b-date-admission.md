# Original date argument admission — author evidence

Pinned oracle SQLite 3.53.4 source ID:
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
This follow-up addresses parent review11 ORIGINAL R1/R2, not the previous provider
NULL-format/Once-budget findings. Independent nonauthor reassessment remains due.

## Source comparison

`date.c:isDate` separates INTEGER/FLOAT admission (`setRawDateNumber`) from
sqlite3_value_text. Shared Mem.valueText copies before changing encoding or
stringifying: BLOB carrier encoding is not necessarily UTF-8. No Mem producer is
changed. Literal, persisted, bound and private callback/default-UTF8 BLOBs are
separate provenance controls; the latter private diagnostic is not a public
callback API or native host callback equivalence claim.

`parseDateOrTime`/strftime stop at NUL. `parseModifier` receives n from
sqlite3_value_bytes, but its consuming branches use C comparisons, numeric
prefix scans, parseHhMmSs or overwrite n with strlen of the unit. Thus NUL is
applied at that consumer, not shared text conversion. This is a conclusion from
this pinned implementation, not an assumption that all SQLite consumers ignore
explicit extents. Native modifiers with NUL+junk (+1 day/start of month/+01:00/
subsec/weekday/unixepoch/auto) are independently captured.

`setRawDateNumber` saves raw seconds and only casts a JD for 0<=r<5373484.5.
Numeric storage never round-trips through JS String; TEXT still follows numeric
parser admission. unixepoch bounds the floating offset result before casting;
auto bounds seconds, adds epoch in floating point, then rounds/casts. timediff
must reject unresolved raw date admission before extracting calendar fields.
No broad catch or cancellation/error swallowing is added.

## Sequential timediff admission correction

Independent [[card:card-q-a-c]] status61 found that repair3c66 parsed both
operands before rejecting unresolved raw first input. Native `date.c:1628–1629`
returns after complete first `isDate`; its JD/error/range and one-argument calendar
normalization precede second admission. The owning shared `isDate` now performs
those steps for ordinary/strftime and timediff callers. This removes the duplicated
partial admission path, not VM argument evaluation or purity enforcement.

Native-first generated rawfirst (`timediff(1e300,a)`, a='now') returns NULL;
valid-first with second 'now' still errors. Generator builds that error fixture
through writable_schema/reopen because native correctly rejects inserting 'now'
when the valid-first generated expression is already installed. Initial direct
insertion failed in proc-97aa9180d670; it is not passing evidence.

`proc-a0d546d0d4fd` passes final native117/public234 typed observations (two
executions, reset/rebind, three encodings), private Mem3/3 provider/no-invocation
and reached-purity controls, provider-failure108, math23/69 and bounded resource
checks. Command uses the generator above with output
`$SAIVAGE_CARD_WORK_ROOT/timediff-order-green/fixtures`, then the admission runner,
private Mem test, provider-failure, math and expression-bounded runners.
`proc-5e6b49eca05e` passes tsc/date120/provider but fails overall at generated runner
without its required fixture argument; later commands in that chain did not run.
Earlier proc-9fa70b9d9b25 native114/public228 lacks the final valid-first error
control and is superseded for current coverage. Source/selected corpus credit is
unchanged; original R2 crash remains unconfirmed. Independent corrected-input
acceptance and combined root integration remain outstanding.

## Reproduction and commands

Accepted red status158 retains native/public six embedded-NUL mismatches. Original
R2 crash was source-derived, **not reproduced**: extremes already returned NULL
on that input. New guards repair unchecked conversions and raw-state ownership,
not a claimed previously executed crash.

- `proc-03fd87eeb8ee`: native neighbor source-ID/hex receipts, including literal
  BLOB date succeeds in UTF-8 but NULL in UTF-16LE/BE. Existing zero-credit
  blobYears companion incorrectly expected UTF-8 for all encodings; corrected.
- `proc-b94f40e767af`: `python3 docs/research/card-q-a-b-date-admission.py
  "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"
  "$SAIVAGE_CARD_WORK_ROOT/date-admission-fixtures"`, followed by
  `node --experimental-strip-types test/conformance/run-date-time-admission-ts.mjs`
  with that directory. Native93 typed observations; public186 observations
  (two executions/reset/rebind, three encodings), all pass, zero corpus credit.
  Generator retains native.json plus actual persisted carrier fixtures in work.
- `proc-eaca9db9aaf5`: guarded typecheck; date120/three encodings;
  provider three encodings/two executions; provider-failure108; seams4;
  math23/69; bounded23-fail/24-row, abort/deadline/output/reset/reuse: pass.
- `proc-4a79f8cea964`: private callback/carried Mem3/3; package boundary;
  Once21 x2/three encodings; clock entry/independent statement controls;
  date120; typecheck: pass on final timediff guard input.
- `proc-9f2303e9d650`: selected node tests49/49 (sum, REAL, FROM-subquery,
  expression-subquery); IN runner completed. Command then FAILED due to wrong
  package script path; corrected package check passes in proc-4a79f8cea964.

Failed attempts are not passing evidence: proc-e265682bbf88 accessed integer Mem
with REAL-only accessor (fixed by storage-specific getter); proc-fe6d81cef1ba
passed focused public witnesses but exposed stale BLOB companion expectation;
proc-cd637ad4dd91 used wrong oracle path; proc-dd696a5497ff imported a nonexistent
UTF encoder (test helper now encodes bytes explicitly). No runtime or producer
workaround was added for these test/probe issues.

Selected upstream remains18 exact body-hashed +11 date controls =29/29, public
selected40 cases/120 typed observations; new diagnostics confer zero corpus
credit. This is not exhaustive date compatibility, current combined-tree
certification, root integration, release approval or broad green. Retain previous
broad9102 pass/26 fail/5 skip qualification and host timezone/tzdata limitations.
Scoped delivery must preserve unrelated shared edits/index/refs and provider
chain; exact delivery identity/carrier is recorded in the card status.
