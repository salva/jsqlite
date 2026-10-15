# Mixed JSON prerequisite readiness — review33 R1

Scoped correction atop `1996da577d46bffe40cf54278031e8c859927c07`, not MAIN promotion.
The accepted red is preserved at `record:///status.md?card=card-r-d&v=120`.

## Source comparison and repair

Pinned wherecode.c:2623–2656 skips terms with unmet prereqAll/notReady and
separately defers outer-join terms via EP_OuterON/EP_InnerON/iJoin. The mixed
producer's existing two-source equivalent splits AND and binds terms with only
the physical source available; unresolved inner fields stay residual. Its
metadata-only guard incorrectly excluded JSON. Apply that same readiness stage
to both modules for INNER/CROSS, before argument evaluation and Filter; ready
terms branch to the physical Next continuation. Source identities, residual ON
and WHERE ownership, match recording, NULL extension and shared result consumers
are unchanged. LEFT deliberately remains outside this INNER rule. This is not
error suppression, SQL-text recognition, or a new algorithm substitution.

## Reproduction and verification

Purpose children of SAIVAGE_CARD_WORK_ROOT: readiness-red (unchanged red probe,
48 cases:24pass/24fail), readiness-repair/source (exact candidate archive plus
owned correction). Native uses retained oracle-build/build/libsqlite3-oracle.so,
asserting complete 3.53.4 source ID from the pinned manifest. Native captures
prepare descriptors, typed rows/error phase/code/message, reset code and repeated
execution; INTEGER strings, REAL, NULL and BLOB hex remain distinct.

Commands in repair/source:

```
python3 docs/research/card-r-d-readiness-capture.py > docs/research/card-r-d-readiness-native.json
npm run typecheck
node --experimental-strip-types --test test/conformance/json-mixed-readiness.test.mjs test/conformance/json-mixed-ordered.test.mjs test/conformance/json-mixed-rowid-integration.test.mjs test/conformance/json-grouped-rowid-metadata.test.mjs test/conformance/json-physical-left-red.test.mjs test/conformance/json-ordered-integration.test.mjs test/conformance/json-ordered-resources.test.mjs test/conformance/selected-in-integration.test.mjs
```

Initial correction and240 native/public cases passed (proc-d387e11194ff).
Expanded native repeated execution then exposed a test-harness hypothesis error:
after reset consumes saved error, finalize should succeed, not throw. First777
run669pass/108fail (proc-1e1068433bdb), all108 at that incorrect final assertion.
Corrected test to assert finalize succeeds after reset, retaining both error
executions and saved-error reset checks. Final run777/777pass, no skips/cancels
(proc-e56ec8576de0), typecheck passed. Logs in repair/{typecheck-final.log,
regressions.log,regressions-final.log}. Existing dependencies linked, not a clean
install. Original exact review queries retained among240 new cases across four
modules/all encodings; controls cover surviving errors, mixed ready/residual
ON/WHERE, DISTINCT/nonzero LIMIT, streaming LIMIT, good-input residuals and LEFT
match/WHERE rejection/null-extension/malformed ordering. Metadata is rechecked
after reset; successful executions compare ordered full typed rows twice.

No global readiness, exhaustive subquery/dependency, native spill/top-N resource,
release, original225 or new Chinook/CHECK/FK credit. Existing IN/resource suites
are bounded regressions, not universal parity. Independent review/integration
by parent and card-r-e remains required. Shared default index and peers preserved.
