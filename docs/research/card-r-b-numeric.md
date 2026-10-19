# JSON numeric header ownership — [[card:card-r-b]]

## Source and current repair

Pinned SQLite 3.53.4 source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc` (manifest archive SHA-256 `d18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b`). Independent finding: [exact282 numeric review](card-r-e-numeric-type-review.md).

`decodeJsonbSteps` formerly reparsed payload spelling and discarded numeric header identity. `scalarResult` then guessed INTEGER/REAL from canonical spelling. The repair retains the header in the private number node; TEXT production follows `jsonTranslateTextToBlob` classification, and SQL return consumes the header through `numericResult` (`jsonReturnFromBlob`3258–3310). FLOAT/FLOAT5 always use the existing translated Mem AtoF scanner and double result. INT/INT5 preserve sign stripping, unsigned hex accumulation, high-bit positive double, smallest-int64 and overflow fallback/error ordering. `mem.ts` exposes its existing internal scanners; their implementations are unchanged.

`renderNumeric` translates the distinct `jsonTranslateBlobToText`2218–2272 branches (raw INT/FLOAT, hex decimal rendering/overflow, FLOAT5 missing decimal digits). Encoding retains numeric header/payload. `validNumeric` translates the separate `jsonbValidityCheck`1394–1478 branches: deep validity is not scalar conversion admission. This separation also retains `jsonArgIsJsonb`'s ASCII-ambiguous BLOB fallback. Multipath JSONB extraction follows `jsonExtractFunc`4153–4180: accumulate rendered JSON text, then `jsonReturnString` reparses to JSONB. Single-path container output still retains binary representation directly. `jsonbMemResult` preserves admitted BLOBs rather than imposing deep validity not required by upstream.

No new algorithm exception, host JSON evaluator or SQL-text workaround. Eager private node decoding remains an existing boundary; this is not a complete malformed/off-path/error-order fidelity claim.

## Tests and evidence

Tests were authored/captured before implementation: `card-r-b-capture-numeric.py`, `card-r-b-numeric-native.json`, `test/conformance/json-numeric-type.test.mjs`. Native C API capture asserts exact source ID, 506 typed cases. FLOAT/FLOAT5 integer spelling, INT/INT5, int64 endpoints/overflow, signed hex/high bit, nonfinite/underflow, negative zero, invalid payloads, JSON5 text, text rendering, exact JSONB hex, mixed arrays/paths, arrows, typeof/json_type, arithmetic, aggregate and subtype composition. Public Fetch runs every case twice with reset/finalize across UTF-8/UTF-16LE/UTF-16BE (3036 executions); asserts columnType, one-column expression metadata and typed SQLite errors. Finalize tolerates SQLite errors after a mismatched expected-error case so aggregate failure reporting is not masked. Native `column_double` hex retains negative zero/nonfinite identity rather than reconstructing those from SQLite display text.

Commands:
- `python3 docs/research/card-r-b-capture-numeric.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"`
- `npm run typecheck`
- `node --experimental-strip-types --test test/conformance/json-numeric-type.test.mjs`

Initial tests-first process `work:///cards/card-r-b/processes/proc-d2fae56e85c6/stdout.log`: capture506, public0/3 exit1, failed-finalize masked the full mismatch list. First implementation `proc-a47255f58f01` typecheck passed but public0/3; [complete diagnostic output](work:///cards/card-r-b/processes/proc-a47255f58f01/stdout.log) exposed lost deep-validity separation, NaN json_type, multipath text reparse and harness negative-zero/Inf normalization. These were corrected at their owners, not excluded. `proc-3371eea2115a`: recapture506, typecheck, public3/3 exit0. After branch-shaped validity refinement/removal of superseded canonical-number path, `proc-c8499473d208`: typecheck and related127/127 exit0, zero skips (JSON extraction/arrows/foundation/limits/merge/table functions; REAL metadata/sum/subquery/Chinook/outer constraints). [Complete output](work:///cards/card-r-b/processes/proc-c8499473d208/stdout.log). Metadata assertions added afterward pass in `proc-458baac9e222` numeric3/3 and parser2/2; oracle command result recorded in current card status.

Finite tests do not establish full corpus/resource-zero, whole-brief compatibility or independent acceptance. Review's prior diagnosis117/native184 remain applicable to their inputs; full367 stopped14 exit0 is not green. Prior failed/stopped whole-gate qualifications remain in accepted status117/113.

## Delivery

Scoped export and manifest: `card-r-b-numeric-delivery/`. Source JSON delta is against exact `282959e901d33753158dace47c5abe8d0334d158`; other shared files use explicit staged input hashes to exclude unrelated concurrent changes. No default-index/MAIN adoption or peer ownership claim. Independent combined review and full standard gate remain required.
