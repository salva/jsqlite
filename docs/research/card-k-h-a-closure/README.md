# Repeated corpus committed dependency closure

Bounded delivery repair for [[card:card-k-h-a]], not alpha certification or a
runtime change. Earlier cc21352 terminal238 aggregate remains failed. Prior
native-first decision evidence is retained in card records and
`../card-k-h-a-diagnosis/`; those historical dirty-overlay passes did not deliver
committed inputs.

## Reviewed inputs

Three capture producers import the already committed `capture-multisource-select.py`:
ctypes metadata-enabled loader, typed INTEGER decimal/REAL IEEE754/TEXT UTF8/BLOB
and NULL cells, prepare/step diagnostics, integer reset/rebind capture. No runtime
native dependency. Public consumers use committed `public-api-adapter.mjs` and
`close-test-server.mjs` (after statement/connection release). No consumer, engine,
quota, SQL, metadata or expected row edit in this repair.

`repeated-capture-inputs.py` checks all outputs absent before creation, archive
length/SHA256/SHA3 against manifest, and exact extracted bodies against archive
for whereInt.h, where.c, wherecode.c, select.c, resolve.c, vdbe.c, vdbeaux.c,
join8.test, VERSION and manifest.uuid. All three producers source-ID/version
check the loaded native. This closes output-overwrite and body-preflight gaps;
recorded frozen source hashes and fixture digests are unchanged.

Supplemental:21 cases x3 encodings=63 captures, zero upstream credit.
Upstream: join8-3000 setup,3010/3020/3030/3040 assertions; four adapted IDs x3
encodings=12 instances, zero exact SQL+setup ports. Literal bit rows replace
series; derived relation replaces CTAS t9; coalesce replaces NULL-to-zero UPDATE
for3030 and3040. These are explicitly disclosed read-only setup/query adaptations,
not native runtime substitutions. Full source assertions are in pinned join8.test
lines87–134. Frozen JSON includes exact adaptations and upstream body digest.

## Reproduction (clean committed export only)

From project workspace, after choosing the committed closure:

```sh
mkdir -p "$SAIVAGE_CARD_WORK_ROOT/repeated-clean-export"
git archive <closure-commit> | tar -x -C "$SAIVAGE_CARD_WORK_ROOT/repeated-clean-export"
# Supply immutable local archive + extraction (not dirty project code):
ln -s "$PWD/reference/sqlite/sqlite-src-3530400.zip" "$SAIVAGE_CARD_WORK_ROOT/repeated-clean-export/reference/sqlite/"
ln -s "$PWD/reference/sqlite/sqlite-src-3530400" "$SAIVAGE_CARD_WORK_ROOT/repeated-clean-export/reference/sqlite/"
cd "$SAIVAGE_CARD_WORK_ROOT/repeated-clean-export"
mkdir -p "$SAIVAGE_CARD_WORK_ROOT/repeated-compiler-temp"
TMPDIR="$SAIVAGE_CARD_WORK_ROOT/repeated-compiler-temp" sh tools/oracle/build.sh
PYTHONDONTWRITEBYTECODE=1 python3 test/conformance/prepare-repeated-corpus.py --library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"
```

Only the disposable export's nine frozen outputs are deleted/regenerated; every
byte must equal its committed original. Project fixtures are never overwritten.
Independent READONLY join8 verifier checks12 metadata/typed-row assertions twice
across reset and unchanged file hashes. Pin3.53.4/source ID comes from committed
manifest; external archived bodies are authenticated, not trusted overlays.
Then run each of these unchanged files with
`timeout 30s node --experimental-strip-types --test test/conformance/<file>`:
outer-constraints.test.mjs, repeated-right-full.test.mjs,
repeated-upstream-utf16be.test.mjs, repeated-upstream-utf16le.test.mjs,
repeated-upstream-utf8.test.mjs, right-nested.test.mjs, right-residual.test.mjs.
Results, exact commit/tree/file hashes and commands are in the card status and
closure evidence; no whole-alpha claim.

## Fresh closure result

Executable closure commit `cb82e85f1cc721303342b9bddfef24e440530a21`,
tree `8d33a561cbf1cd4975fd52dd6745d39a361a87cf`:1279 tracked export blobs
independently byte-compared with Git, zero drift. Clean export native build and
regeneration exit0:63 supplemental captures,12 adapted upstream instances,
READONLY12/12 replay, all nine regenerated files byte-identical. Unchanged seven
suites serial30s each exit0:48+132+5+5+5+30+36=261 Node tests (three upstream
parent tests included, not261 upstream assertions), zero skipped/cancelled.
Per-file observed times1.059,3.139,18.971,18.277,18.400,0.821,0.931s.
Exact logs and hashes: `seven-results.json`, `regeneration.log`, `evidence.json`,
`paths.json` and `dependency-hashes.json` in this directory.

Earlier clean80d32ea export0/7 ENOENT and reported cc21352 failed238 remain
historical failures, not erased by focused closure. Existing502 dirty/untracked
hash inventory and all original index entries reconciled unchanged except own
reviewed producer edits. No peer staging/overwrites, quotas, watchdogs, consumer
expectations or engine edits. Initial build succeeded but GCC temporary files
used ambient /tmp; corrected documented reproduction explicitly sets scoped
TMPDIR. This does not change the resulting tested native identity or capture
bytes. Independent consuming owner should use this committed closure and the
scoped command above; no whole-alpha or general termination claim.
