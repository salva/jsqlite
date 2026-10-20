# Mixed physical/JSON USING and NATURAL

HEAD-relative candidate over `0f9bf55894dd7c2774b7a835bf14fa6726e71387`: only the nine scoped mixed-producer hunks are included, preserving committed aggregate, parameter, async JSON and helper implementations. Dirty peer changes are excluded. Candidate assembly, per-hunk classification, hashes and verification are retained in [[card:card-r-d]] status and its `head-gap` evidence. This supersedes the earlier dirty-source candidate, not its retained provenance.

## Source and decision

Pinned SQLite 3.53.4 `select.c:sqlite3ProcessJoin`516+ synthesizes NATURAL USING from visible common columns, validates the list, and creates left/right equalities with join ownership. `resolve.c:lookupName` suppresses right USING matches for unqualified references; `select.c` star expansion suppresses them only for unqualified star. `json.c:jsonEachConnect`5143 declares eight visible and two hidden fields; `jsonEachColumn` owns their values. `wherecode.c` readiness and LEFT hit-before-WHERE/null extension must remain intact.

Reuse the existing ordinary `expandAndResolveSelect` source declarations, NATURAL synthesis, validation and canonical result list. Consume its USING list in the existing mixed producer, generating bound comparisons before readiness partitioning, with left affinity/collation and JSON register demand. Unqualified merged references prefer left; qualified fields remain distinct. Keep explicit expression reductions (COLLATE/CAST/aliases) bound through their resolved expression carriers; expanded stars and generated equalities consume resolved source identities directly. Do not reconstruct a qualifier and re-resolve it: coincident or case-equivalent aliases cannot identify a SrcItem. Projection subqueries use the same compileWideSubquery/positioned-source binding as predicates, including JSON column demand; result metadata comes from the resolved descriptors. This follows resolve.c TK_SELECT/pOuterNC and lookupName's left-most INNER/LEFT USING ownership. The module remains a module, not a fake catalog table. No SQL rewrite, alternate evaluator, traversal change or exceptional algorithm substitution. RIGHT/FULL guard remains; this is bounded two-source INNER/LEFT coverage, not general join certification.

## Native/public evidence

`native.json` and three hash-authenticated SQLite fixtures preserve the original independent w lead capture: sourceID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`; library SHA `8d3a57c33418e6273e85046b7a8b664ad47827660658dfacef0136416c9f48f3`. Original capture provenance is accepted card-r-d status238 and work:///cards/card-w/recursive-current/leads/capture.py. Its two queries return2 USING rows and1 NATURAL row across all encodings, twice after reset.

`tools/oracle/capture-json-mixed-using.py` independently expands the receipts with a retained source-ID-checked library (not a fresh native build). `expanded.json` records its separate library hash, typed values, all five metadata fields, prepare errors and two runs. Original capture converted empty metadata strings to null; the expansion intentionally distinguishes empty hidden declared types from null, without altering the retained original leads. Public tests compare exact storage types/bytes/metadata and prepare error messages. Coverage includes all four modules, TEXT/actual JSONB, multiple shared fields, qualified stars, aliases, ambiguous/missing names, NATURAL ON rejection, hidden fields, NULL/empty inputs, LEFT WHERE hit behavior and ORDER ordinals. Finite expression-collation preservation is covered, not an exhaustive collation matrix.

Run:

```
PYTHONDONTWRITEBYTECODE=1 python3 tools/oracle/capture-json-mixed-using.py <pinned-library.so>
node --experimental-strip-types --test test/conformance/json-mixed-using*.test.mjs
npm run typecheck
```

Before runtime change, original lead regression fails3/3 (before.log); after repair the original leads pass3/3 (proc-f00711560c0c). Expansion first exposed an incorrect alias/COLLATE source-column shortcut; preserving explicit reductions fixed it. Next mismatch was capture normalization of hidden empty declared types, corrected in the capture rather than product metadata. Final all-module native/public plus resource selection passes6/6 (proc-50f42f0d1388). Resource controls use an initially-live timer abort during a large ordered USING producer plus work/private failures, saved error/reset/rebind/finalize/recovery. This is not latency/fairness or native allocator equivalence.

Additional shared readiness/resolution controls pass954/954 (proc-93f1a08d1d3a). Final typecheck passes (typecheck-last.log). Logs reside work:///cards/card-r-d/mixed-using-repair/; exact export hashes and final broader selection are in its delivery manifest and card status.

## Resolved binding correction (independent e561 findings)

`binding-native.json` retains the independently obtained 45 probes (15 shapes × three encodings) from work:///cards/card-r-e/mixed-using-review/verify/native-probes.json, original SHA256 `505ee514d8aec09c749e4f7ec3ea584f20d6aeb63ea24947438f3f17fff640ff` (JSON whitespace in this copy differs). Native retained library SHA `b74284142511a672e841ef5c370cab35f2d873912082319831759459bba05347`, pinned sourceID as above; no fresh native build/capture claimed. `json-mixed-binding.test.mjs` compares typed rows, five metadata fields, errors and two public reset runs. It includes exact correlated result and coincident/case-equivalent alias witnesses, aliases/COLLATE/coercion, INNER/LEFT, star/null extension and ordinal ordering. Earlier expansion retains qualified-ambiguity controls.

Tests-first proc-7b53acb3ec86 fails3/3 on prior runtime. Initial correction proc-530b1c82fe63 failed typecheck (type spelling/reduction narrowing) and6/6 tests: direct resolved reads had bypassed lazy JSON demand. Correcting owning location/star demand registration and preserving already-bound column identities gives typecheck plus6/6 (proc-9dbdf1746ec1). Shared focused selection1243/1243 passes (proc-abd67550c306); final rerun identities/results and exact expanded narrow export are recorded in current card status. Projection and ORDER expression compilation use the existing subquery callback, not the scalar fallback. No general SQL-composition, fresh full-gate or independent acceptance claim.

## Qualifications

Broad attempted selection:507 tests/468 pass/39 fail (focused.log), not green. Thirty-six JSON parameter/metadata/nested failures also reproduce with the exact saved pre-edit runtime in disposable baseline (147/111/36, baseline-corrected.log); these paths do not enter the changed two-source branch. Remaining three file failures were missing CHINOOK_DB or COMMON_CHECKPOINT_OUTPUT prerequisites, not passed tests. Baseline derived controls also fail absent COMMON_CHECKPOINT_OUTPUT. Initial baseline-copy attempt followed a cyclic reference symlink and failed before runtime restoration; its results are not baseline credit. Corrected baseline explicitly restored the original runtime. No whole standard/native/Chinook acceptance, independent approval or integration commit is claimed. Existing F8/root and other historical evidence remains input-bound; do not adopt dirty peer paths or treat these temporary gaps as exclusions.
