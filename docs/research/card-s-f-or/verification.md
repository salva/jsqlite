# Verification inventory

Pinned build profile matched manifest version/source identity and all encoding/metadata probes; development build succeeded. Native candidate is oracle-build/build/libsqlite3-oracle.so built with COLUMN_METADATA and MATH_FUNCTIONS, never runtime.

Commands are in the parent research document. Native capture exit 0; final active red TS suite exit 1 (69 tests, 24 pass, 45 fail); initial exit 1 (21 pass/48 fail). npx tsc --noEmit exit 0; node --experimental-strip-types --test test/conformance/where-plan-analysis.test.mjs test/conformance/where-plan-ordered-red.test.mjs exit 0, 33/33 pass. Empty typecheck.log reflects successful no-output typecheck, not missing evidence.

## Final fixture identities

- test/fixtures/or-rowid/utf8.db: 86016 bytes; SHA-256 `7ab050a57c647203f8c915cac00cc450b282851fe5eb39cf0ad7aa531cd3daf4`.
- test/fixtures/or-rowid/utf16le.db: 86016 bytes; SHA-256 `6be246f7e414ac90d46dc8319f993bd43d9829515b60139c89a1b33497016681`.
- test/fixtures/or-rowid/utf16be.db: 86016 bytes; SHA-256 `c02f44e25fe6ce0d0cc2e382e8a04a723d0dd8c3520399dc9027d5c25af1e163`.

[Initial TS failure](ts-initial.log), [final TS failure](ts-final.log), [existing focused tests](ordinary-focused.log), [typecheck](typecheck.log). Earlier exploratory missing guessed files and unavailable rg were tool discovery failures, not product test passes. No broader suites, internal RowSet native harness, limit/corruption or cancellation tests were executed.
