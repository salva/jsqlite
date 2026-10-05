# Public immutable catalog SELECT — [[card:card-e-m]]

## Current bounded repair

Pinned SQLite 3.53.4 source ID: `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
`prepare.c:sqlite3InitOne` creates schema Table metadata before persisted declarations;
`build.c:sqlite3StartTable/sqlite3EndTable` substitute the legacy name and root 1.
TS uses its existing DDL parser/construction and freeze/publication path for that
synthetic descriptor. The descriptor is not inserted in persisted `objects` or
physical catalog rows. Internal load failures still publish no graph; connection
storage remains the single owner. No recursive public prepare or evaluator is added.

`build.c:sqlite3FindTable` maps preferred to legacy names; shared
`schema.ts:findSchemaTable` and `SchemaGraph.findTable` now serve resolver and
ordinary/compound/aggregate/derived physical callers. `resolve.c:isValidSchemaTableName`
allows preferred/legacy column qualification, unless hidden by an explicit alias.
`select.c:selectExpander` (6173–6188) instead compares qualified-star tokens to
canonical Table/alias names: `sqlite_schema.* FROM sqlite_master` errors natively.
This distinction is tested, not papered over. `build.c:sqlite3AddColumn` standard
type encoding yields uppercase TEXT/INT metadata; the synthetic descriptor retains
that normalization without changing persisted declaration handling in this slice.

Root 1 reaches existing OpenRead/Column/Rowid and SELECT control branches. Rowids,
NULL SQL, implicit indexes, table/index/view declarations and main origin metadata
come from actual immutable bytes. Browser object/async representations do not
substitute a metadata-row algorithm. Internal init cleanup/atomicity is untouched;
no malformed-schema bypass or writable-schema mode is introduced.

## Revision-bound checks

Baseline HEAD `904025427abc44e381580ca222b0e288fd1bde4d` with retained unrelated staged
and unstaged work. Detailed red evidence: `record:///status.md?card=card-e-m&v=3`.
The first 63 native cases were captured before implementation. Added view/all-encoding
fixtures and neighboring cases were captured after initial repair, before their
consuming tests; do not label the entire expansion native-FIRST implementation.

`test/schema/capture-public-catalog.py` builds new fixture images only using the
source-ID-checked pinned public C library. `public-catalog-native.json` SHA256:
`8a917ad4fa8fdeac4fab12e0efe71fd3f4992c9edb6809ab3199870c34ade8b3`.
It embeds ten image paths/digests and 140 public prepare/step/column snapshots:
six existing encoding images, exact browser Chinook, three new persisted-view
images. Each cell retains storage class and integer string; metadata includes
all five public attributes. No BLOB-valued catalog fields occur in these images.
New fixture SHA256s: UTF-8 `51cf00bb9bdb5d2c371e43b187bd87b408eff3902779ec8509764e41eb7695e7`,
UTF-16le `ef4faaca2818921ab7a03b18683d5f6d47f3c16fa3506b707c88bb099d7c5e92`,
UTF-16be `62495df0ff3dde7692ab0329744bd41fc23a5dc1262c519c779f882e79dc00ad`.

Actual commands/results (work products under `$SAIVAGE_CARD_WORK_ROOT/catalog-red`):
- `sh tools/oracle/build.sh`: pass, source checked; `python3 test/schema/capture-public-catalog.py`: pass, 140 snapshots on expansion.
- Initial focused TS: 7/63 pass, 56 missing-table/misowned-error failures.
- First repair: unresolved compiler direct lookups and lowercase synthetic types;
  second repair: original reproducer **63/63** passes.
- Expansion: **120/140**, failing canonical-star over-admission and the existing
  flattened-derived outer ORDER boundary. Corrected owning star match; preserved
  neighbor boundary with explicit temporary-unsupported assertions. Ten cases
  therefore test truthful rejection, not native successful-query equivalence.
- First typecheck failed because `ResolutionSchema` has only tables; shared lookup
  helper corrected the caller contract rather than requiring every transient schema
  to be a SchemaGraph. Initial internal tests lacked card-local Chinook copy;
  copied unchanged `examples/browser/chinook.sqlite` into purpose-named work child.
- `npm run typecheck`: subsequent pass.
- `node --experimental-strip-types --test test/schema/public-catalog.test.mjs test/schema/catalog-init.test.mjs`: **154/154** pass.
- Lifecycle/neighbor batch: **297/300**, three new tests incorrectly assumed
  parsed mutation errors always permanent unsupported; existing grammar rejects
  DELETE as syntax. Corrected tests to assert existing honest rejection, not a new
  mutation parser promise.
- `node --experimental-strip-types --test test/schema/public-catalog.test.mjs test/schema/public-catalog-lifecycle.test.mjs`: **143/143** pass. Includes reset/rebind,
  graph identity, view root 0, NULL SQL and mutation rejection.
- `node --experimental-strip-types --test test/conformance/compound-union-all.test.mjs test/conformance/subquery-view-foundation.test.mjs test/conformance/select-scalar-child.test.mjs test/conformance/run-advanced-index-ts.test.mjs test/conformance/repeated-right-full.test.mjs test/conformance/outer-constraints.test.mjs test/conformance/row-width-real-metadata.test.mjs`: **498/498** pass, including shared-builder, repeated RIGHT, constraints/index/REAL and retained source consumers.
- Chinook audit runner first invocation failed (required argument absent).
  `node --experimental-strip-types test/conformance/run-audit-chinook-b1-b5-ts.mjs examples/browser/chinook.sqlite`: **56/56 match**, credit 0.
- `git diff --check`: pass. No all-project compatibility claim.

Logs and exact process references are in the current card status. Current root
bitwise/research/cache and staged peer edits were preserved, not delivered as this
card's work. Scoped commit excludes them and uses only reviewed paths/hunks.

## Remaining consumers

Existing flattened derived outer ORDER rejection remains temporary; it is not a
catalog-specific missing storage path. Temp/attached schemas, PRAGMA introspection,
write/registration APIs and corrupt-schema writable bypass are not added. Existing
SELECT composition/admission limits still apply, not universal catalog query
compatibility. Full suite, native intermediate scheduling/cleanup equivalence,
and additional planner/error compositions are not certified by these checks.
