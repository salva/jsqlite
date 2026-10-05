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
ordinary/compound/aggregate/derived physical callers, including R1 IN/scalar
subquery callers. The original seven-call migration missed two neighbors; the
revision-qualified evidence below preserves that omission and its correction. `resolve.c:isValidSchemaTableName`
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


## R1 follow-up — source/native-FIRST integration repair

Review [[card:card-e]] v25 identified raw `tables.get` in aggregate IN/scalar.
Direct compiler census before repair found exactly those two; after repair no
`tables.get` remains in `vdbe.ts`. `schema.ts:findSchemaTable` intentionally reads
the map then maps preferred to legacy; it is the owning lookup, not a bypass.
No duplicate alias Table, host row producer or query-spelling branch was added.

Pinned `build.c:sqlite3FindTable` owns alias identity. `expr.c:sqlite3CodeSubselect`
owns shared subquery execution (Once for uncorrelated invocations), while
TK_AGG_COLUMN reads accumulator registers outside direct mode. Aggregate IN's
bare left operand previously reread the exhausted outer cursor: `cacheBare`
now descends into that operand. Aggregate argument/filter/order expression
production now supplies the existing linked subquery callback instead of
unconditionally rejecting translated subqueries. `resolve.c:resolveExprStep`
clears AllowAgg while walking same-context aggregate arguments;
`resolveSelectStep` creates a new AllowAgg NameContext for a nested SELECT.
`firstAggregateName` now stops at SELECT boundaries; normal same-context nested
aggregate misuse remains rejected by the existing checks. These are producer/
consumer repairs, not exceptional replacement algorithms.

### Revision-bound attempts and verification

Original red/native 140-case provenance above remains unchanged. Follow-up new
queries were captured **before this repair** with the source-ID-checked pinned
3.53.4 library, then consumed through public Fetch/open/prepare/step assertions.
First expansion: 220 native cases; TS160/220, exit1. The review's SUM probes
failed both spellings at missing argument callbacks or incorrect aggregate
misuse, not the proposed missing-table branch. Result-expression expansion:
280 native cases; TS200/280, exit1. Preferred aggregate IN output failed code1
`no such table: sqlite_schema` at6329; legacy progressed but returned NULL
instead of native INTEGER1. Scalar LIMIT1/count result pairs already passed
via linked routes, not evidence that the raw scalar caller was safe.

Capture script/snapshot retain all paired IN, scalar LIMIT1, scalar count(*)
SUM-argument and result-expression cases, plus exact missing-column errors,
metadata and storage-class-tagged rows across ten digested images/all encodings.
Snapshot SHA256: `6a151527c63b17cff4f57e56b11dc111576bfe176acee8b357fc0925b7227457`.
Fixture bytes were unchanged by recapture. No BLOB catalog fields occur.

After repairing the two lookups, argument callbacks, bare-IN operand caching and
SELECT-local aggregate check, `node --experimental-strip-types --test
 test/schema/public-catalog.test.mjs`: **280/280**, exit0. This includes the
original ten truthful temporary flattened-derived cases, not native equivalence
for those cases. No new unsupported waiver was needed for the R1 pairs.

Focused combined command (public/lifecycle/catalog-init, aggregate-group-lifecycle,
select-scalar-child, row-width-real-metadata): **332/332**, exit0;
`work:///cards/card-e-m/processes/proc-eae1f9be4f21/stdout.log`.
`npm run typecheck && npm run build`: exit0;
`work:///cards/card-e-m/processes/proc-3499a1d9302f/stdout.log`.
Red attempt outputs: `work:///cards/card-e-m/processes/proc-5a9fdca7ba79/stdout.log`
and `work:///cards/card-e-m/processes/proc-23adfc2bb583/stdout.log`; full TAP logs
are under the purpose-named card work-root `catalog-red` child. First repaired
public output: `work:///cards/card-e-m/processes/proc-b58fd2193e74/stdout.log`.
Remaining boundaries above (temp/attached/PRAGMA/mutation and untranslated
composition consumers) stay unchanged; no whole-corpus compatibility claim.

Additional preserved shared/RIGHT/constraint/index neighbors (compound-union-all,
subquery-view-foundation, repeated-right-full, outer-constraints,
run-advanced-index-ts): **473/473**, exit0;
`work:///cards/card-e-m/processes/proc-3d4a34b7223b/stdout.log`.
Package distributable first invocation without `--experimental-vm-modules`
failed with `vm.SourceTextModule is not a constructor` (0/1, exit1); output
`work:///cards/card-e-m/processes/proc-ee26ade44dec/stdout.log`.
Corrected invocation uses that required flag; its settled result is recorded in
card status. This does not erase the initial failed command.

Corrected `node --experimental-vm-modules --experimental-strip-types --test
 test/package-distributable.test.mjs`: **1/1 PASS**, exit0, 31 runtime modules,
64 files, isolated browser-global VM (not GUI browser), output
`work:///cards/card-e-m/processes/proc-b2ce82e06f86/stdout.log`.
Tarball SHA256 `e342eee398be1e9f71a63e136aebdc307f8e8f7c406ea9f9912b284b5e1571a8`.
Tests/package ran in the retained dirty tree, not a clean-checkout certification.
