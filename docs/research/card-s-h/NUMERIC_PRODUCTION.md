# Numeric semantic production repair

Base: ordinary delivery 0dd232ed0be49c74f9d25d75662323083dcfab98/tree d2725496decc9878c62e72d4fe4cb41708c9e049. Independent finding: [[card:card-s-h-d]] accepted status47; original public red retained in [[card:card-s-h-c]] status28.

## Source and diagnosis

Pinned parse.y2141 `term ::= QNUMBER` calls util.c328 `sqlite3DequoteNumber` before consumers. tokenize.c CC_DIGIT dispatch selects QNUMBER when separators occur. TS tokenizer already retained these raw integer/float tokens, but parser dispatched INTEGER/FLOAT, bypassing normalization. Both stat4-probe valueFromExpr and vdbe expressionFromReduction therefore received raw text. BigInt threw; Number returned NaN. The REAL token flowed through where range extraction/cost and actual index-bound/residual VDBE lowering, so a probe-only repair could not fix row production. A canonical reduction repair fixes both; neither consumer was patched.

parse.ts now dispatches QNUMBER and validates each separator's decimal/hex neighbors, removes separators, reclassifies hex versus decimal FLOAT, and replaces only the popped reduction-owned terminal in its children array. This array is freshly owned by lemonParse's reduction; raw lexical token identity and byte spans remain unchanged. Parent reductions and existing leaves consumers see the same normalized leaf. Reassigning only a local children variable was experimentally rejected: it left ordinary lowering raw and scalar public regression threw (proc-785b6ef42fdb). No Lemon runtime interface change, second evaluator, numeric affinity change or browser exception is needed. Native EP_IntValue compact storage is represented by existing BigInt consumers rather than a second small-int carrier. Existing signed-width consumers are retained.

## Finite verification

Tests first: numeric-production.test.mjs failed3/3 with raw BigInt SyntaxError (proc-fa985365e294). Early test assumptions corrected: negative -100 selects2858rows, not28 (plain control proved this); public parse error kind is sqlite, not sql. Failed runs proc-1856f9ee4987 and proc-a204564520c4 are not passing evidence; the latter shell continued to a passing typecheck, aggregate exit0 does not erase test failure.

Final public regression covers all three useful encodings, actual selected work equality to plain numeric controls, INTEGER/REAL/exponent/hex/unary forms, typed scalar output including signed64 boundary and overflow REAL, unchanged string, raw result names, direct probe types, reset/repeat rows, malformed separator rejection. No-separator useful20k discriminator and parser suite: **39/39 exit0** proc-e7aa2e9b921d. Typecheck exit0 proc-84ef03c7eb2a. Final native-hash comparison rerun is recorded in current card status.

Fresh pinned oracle built via `sh tools/oracle/build.sh` in card work root (proc-c36842b0f648 exit0), noSTAT4 library SHA2566c413f86bee2b4da475bf2be0a8751d53d6c3a97c52f913a049f4ff4428b00b9. Source ID in numeric-native.jsonl. `python3 docs/research/card-s-h/numeric-native.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"` independently uses sqlite3_prepare_v2/step over the same fixtures, retaining typed id/text row hashes/counts; JS compares those hashes through public API. Numeric result proof is not enabled-native optimizer plan parity.

Finite repair evidence is author evidence, not independent acceptance; earlier profile/cleanup/WR/whole integration gates remain with d and parent. No publication, owner scope or operator inputs changed.
