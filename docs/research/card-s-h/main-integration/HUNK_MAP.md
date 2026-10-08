# MAIN scoped hunk map — before effects

Base 2653e5afe7d433bacbee4521e1347d86ee50d94d; candidate bafa7744e5d9a687e9a453354d3e8bc82acc0767; numeric owner04a76531; R2bafa7744. Actual staged entries277261b6 (full checksum in status).

No bitwise/cache/index/evaluator/scheduler/aggregate edits. Temp index based actual committed HEAD, never actual peer index.

Source rationale: schema analyze column_bytes→blob shared stringify; stat4-estimate whereKeyStats virtual prefix/gap counts; probe vdbemem extraction/reservation/all-slot free; where-plan equality/IN/range prefix restoration and complete HIGHTRUTH AddAll; btree/storage/VDBE required reservation forwarding, no cursor replacement. Existing b overflow fix remains committed base.

Caller/test dependencies: 4 VDBE reserveProbe calls ordinary and OR; btree forwards temporary allowance; source-map/API/guide bounded contracts; where-plan-analysis sPk equivalence expectation; OR truth carrier frontier reset assertions; skipscan/docs boundaries; KeyStats native test/tools; research public/caller/typed cleanup/fixture closure. New R2 doc guard included.

Excluded CONFORMANCE repeated RIGHT/FULL barrier hunk341 (unrelated). All other selected diffs inspected as STAT4 closure. No full peer commit or file replacement; exact base-relative patches preserve base unrelated bytes. Actual workspace/index stays untouched; after commit master ref changes deliberately and peer index remains old.

diff --git a/docs/CONFORMANCE.md b/docs/CONFORMANCE.md

@@ -738,7 +738,7 @@ pass typed rows, forced alternatives and selected access/sorter accounting;

@@ -838,3 +838,29 @@ reset in all three encodings; physical trace/page-count tests run internally in

diff --git a/docs/SQLITE_SOURCE_MAP.md b/docs/SQLITE_SOURCE_MAP.md

@@ -411,7 +411,7 @@ Checkpoint44 expr.c2899–2927/util.c1303 EP_IntValue positive signed32

@@ -558,7 +558,7 @@ reset/admission on reviewed source; sole causation is not proved and cancelled

@@ -801,13 +801,14 @@ whereexpr.c997–1023 /1827–1863 -> where-plan.ts prereq: relevant resolved SE

@@ -822,7 +823,7 @@ extraction from existing Lemon semantic productions and all-slot Mem cleanup.

@@ -905,16 +906,62 @@ maps to `stat4-probe.ts` and `stat4-value-oracle.c`/`stat4-probe-primitive.test.

diff --git a/docs/TRANSLATION.md b/docs/TRANSLATION.md

@@ -734,7 +734,7 @@ Checkpoint43 where.c3037 residual output adjustment now runs after physical

@@ -751,7 +751,7 @@ Ordinary lowering now maps table cursor columns through the physical primary

@@ -788,7 +788,7 @@ residual literal check; parentheses/unary signs recurse,only positive signed32

@@ -1296,13 +1296,27 @@ The shared WHERE prerequisite owner now follows only SELECT-bearing expression i

@@ -1317,21 +1331,60 @@ extraction from existing Lemon semantic productions and all-slot Mem cleanup.

diff --git a/docs/api.md b/docs/api.md

@@ -459,4 +459,14 @@ contracts. Represented LEFT ON-OR uses the shared source-owned pipeline;

diff --git a/docs/research/card-s-h/c-red/frontier-native.json b/docs/research/card-s-h/c-red/frontier-native.json

@@ -0,0 +1,122 @@

diff --git a/docs/research/card-s-h/c-red/keystats-native.json b/docs/research/card-s-h/c-red/keystats-native.json

@@ -0,0 +1,1316 @@

diff --git a/docs/research/card-s-h/c-red/or-frontier-native.json b/docs/research/card-s-h/c-red/or-frontier-native.json

@@ -0,0 +1,254 @@

diff --git a/docs/research/card-s-h/caller-first.test.mjs b/docs/research/card-s-h/caller-first.test.mjs

@@ -0,0 +1,36 @@

diff --git a/docs/research/card-s-h/caller-native.json b/docs/research/card-s-h/caller-native.json

@@ -0,0 +1,47496 @@

diff --git a/docs/research/card-s-h/d-diagnosis/MAPPED_REVIEW.md b/docs/research/card-s-h/d-diagnosis/MAPPED_REVIEW.md

@@ -0,0 +1,27 @@

diff --git a/docs/research/card-s-h/d-diagnosis/R1_R2.md b/docs/research/card-s-h/d-diagnosis/R1_R2.md

@@ -0,0 +1,13 @@

diff --git a/docs/research/card-s-h/d-diagnosis/R2_DOC_CLOSURE.md b/docs/research/card-s-h/d-diagnosis/R2_DOC_CLOSURE.md

@@ -0,0 +1,7 @@

diff --git a/docs/research/card-s-h/d-diagnosis/README.md b/docs/research/card-s-h/d-diagnosis/README.md

@@ -0,0 +1,157 @@

diff --git a/docs/research/card-s-h/d-diagnosis/acquisition-manifest.json b/docs/research/card-s-h/d-diagnosis/acquisition-manifest.json

@@ -0,0 +1,104 @@

diff --git a/docs/research/card-s-h/d-diagnosis/acquisition.log b/docs/research/card-s-h/d-diagnosis/acquisition.log

@@ -0,0 +1,19 @@

diff --git a/docs/research/card-s-h/d-diagnosis/affected-inputs.json b/docs/research/card-s-h/d-diagnosis/affected-inputs.json

@@ -0,0 +1,110 @@

diff --git a/docs/research/card-s-h/d-diagnosis/binding-affinity-isolated.log b/docs/research/card-s-h/d-diagnosis/binding-affinity-isolated.log

@@ -0,0 +1,11 @@

diff --git a/docs/research/card-s-h/d-diagnosis/binding-affinity-native.json b/docs/research/card-s-h/d-diagnosis/binding-affinity-native.json

@@ -0,0 +1,19087 @@

diff --git a/docs/research/card-s-h/d-diagnosis/binding-affinity.log b/docs/research/card-s-h/d-diagnosis/binding-affinity.log

@@ -0,0 +1,11 @@

diff --git a/docs/research/card-s-h/d-diagnosis/binding-affinity.test.mjs b/docs/research/card-s-h/d-diagnosis/binding-affinity.test.mjs

@@ -0,0 +1,31 @@

diff --git a/docs/research/card-s-h/d-diagnosis/caller.log b/docs/research/card-s-h/d-diagnosis/caller.log

@@ -0,0 +1,29 @@

diff --git a/docs/research/card-s-h/d-diagnosis/capture-binding-affinity.py b/docs/research/card-s-h/d-diagnosis/capture-binding-affinity.py

@@ -0,0 +1,17 @@

diff --git a/docs/research/card-s-h/d-diagnosis/checkpoint-affected.log b/docs/research/card-s-h/d-diagnosis/checkpoint-affected.log

@@ -0,0 +1,27 @@

diff --git a/docs/research/card-s-h/d-diagnosis/closure-affected.log b/docs/research/card-s-h/d-diagnosis/closure-affected.log

@@ -0,0 +1,28 @@

diff --git a/docs/research/card-s-h/d-diagnosis/closure-broad-missing-reference.log b/docs/research/card-s-h/d-diagnosis/closure-broad-missing-reference.log

@@ -0,0 +1,457 @@

diff --git a/docs/research/card-s-h/d-diagnosis/closure-broad.log b/docs/research/card-s-h/d-diagnosis/closure-broad.log

@@ -0,0 +1,442 @@

diff --git a/docs/research/card-s-h/d-diagnosis/closure-committed.log b/docs/research/card-s-h/d-diagnosis/closure-committed.log

@@ -0,0 +1,19 @@

diff --git a/docs/research/card-s-h/d-diagnosis/coverage-committed-suite.log b/docs/research/card-s-h/d-diagnosis/coverage-committed-suite.log

@@ -0,0 +1,527 @@

diff --git a/docs/research/card-s-h/d-diagnosis/coverage-lifecycle-suite.log b/docs/research/card-s-h/d-diagnosis/coverage-lifecycle-suite.log

@@ -0,0 +1,21 @@

diff --git a/docs/research/card-s-h/d-diagnosis/focused.log b/docs/research/card-s-h/d-diagnosis/focused.log

@@ -0,0 +1,522 @@

diff --git a/docs/research/card-s-h/d-diagnosis/input-closure.log b/docs/research/card-s-h/d-diagnosis/input-closure.log

@@ -0,0 +1,10 @@

diff --git a/docs/research/card-s-h/d-diagnosis/input-closure.test.mjs b/docs/research/card-s-h/d-diagnosis/input-closure.test.mjs

@@ -0,0 +1,28 @@

diff --git a/docs/research/card-s-h/d-diagnosis/integration-final.log b/docs/research/card-s-h/d-diagnosis/integration-final.log

@@ -0,0 +1,546 @@

diff --git a/docs/research/card-s-h/d-diagnosis/integration-initial.log b/docs/research/card-s-h/d-diagnosis/integration-initial.log

@@ -0,0 +1,566 @@

diff --git a/docs/research/card-s-h/d-diagnosis/integration-intersections.log b/docs/research/card-s-h/d-diagnosis/integration-intersections.log

@@ -0,0 +1,327 @@

diff --git a/docs/research/card-s-h/d-diagnosis/new-coverage.log b/docs/research/card-s-h/d-diagnosis/new-coverage.log

@@ -0,0 +1,18 @@

diff --git a/docs/research/card-s-h/d-diagnosis/package-final.json b/docs/research/card-s-h/d-diagnosis/package-final.json

@@ -0,0 +1,612 @@

diff --git a/docs/research/card-s-h/d-diagnosis/parameter-reset.test.mjs b/docs/research/card-s-h/d-diagnosis/parameter-reset.test.mjs

@@ -0,0 +1,48 @@

diff --git a/docs/research/card-s-h/d-diagnosis/parameter.log b/docs/research/card-s-h/d-diagnosis/parameter.log

@@ -0,0 +1,11 @@

diff --git a/docs/research/card-s-h/d-diagnosis/payload-cleanup.test.mjs b/docs/research/card-s-h/d-diagnosis/payload-cleanup.test.mjs

@@ -0,0 +1,65 @@

diff --git a/docs/research/card-s-h/d-diagnosis/postrepair-intersections.log b/docs/research/card-s-h/d-diagnosis/postrepair-intersections.log

@@ -0,0 +1,417 @@

diff --git a/docs/research/card-s-h/d-diagnosis/pre-r1-inputs.json b/docs/research/card-s-h/d-diagnosis/pre-r1-inputs.json

@@ -0,0 +1,105 @@

diff --git a/docs/research/card-s-h/d-diagnosis/r1-alpha.log b/docs/research/card-s-h/d-diagnosis/r1-alpha.log

@@ -0,0 +1,22 @@

diff --git a/docs/research/card-s-h/d-diagnosis/r1-external-inputs.json b/docs/research/card-s-h/d-diagnosis/r1-external-inputs.json

@@ -0,0 +1,42 @@

diff --git a/docs/research/card-s-h/d-diagnosis/r1-final-lifetime.log b/docs/research/card-s-h/d-diagnosis/r1-final-lifetime.log

@@ -0,0 +1,28 @@

diff --git a/docs/research/card-s-h/d-diagnosis/r1-focused.log b/docs/research/card-s-h/d-diagnosis/r1-focused.log

@@ -0,0 +1,193 @@

diff --git a/docs/research/card-s-h/d-diagnosis/r1-intersections-final.log b/docs/research/card-s-h/d-diagnosis/r1-intersections-final.log

@@ -0,0 +1,327 @@

diff --git a/docs/research/card-s-h/d-diagnosis/r1-intersections-retry.log b/docs/research/card-s-h/d-diagnosis/r1-intersections-retry.log

@@ -0,0 +1,350 @@

diff --git a/docs/research/card-s-h/d-diagnosis/r1-intersections.log b/docs/research/card-s-h/d-diagnosis/r1-intersections.log

@@ -0,0 +1,430 @@

diff --git a/docs/research/card-s-h/d-diagnosis/rebuild-affected.log b/docs/research/card-s-h/d-diagnosis/rebuild-affected.log

@@ -0,0 +1,53 @@

diff --git a/docs/research/card-s-h/d-diagnosis/rebuild-checkpoints.log b/docs/research/card-s-h/d-diagnosis/rebuild-checkpoints.log

@@ -0,0 +1,11 @@

diff --git a/docs/research/card-s-h/d-diagnosis/rebuild-checkpoints.test.mjs b/docs/research/card-s-h/d-diagnosis/rebuild-checkpoints.test.mjs

@@ -0,0 +1,28 @@

diff --git a/docs/research/card-s-h/d-diagnosis/repair-isolated.log b/docs/research/card-s-h/d-diagnosis/repair-isolated.log

@@ -0,0 +1,209 @@

diff --git a/docs/research/card-s-h/d-diagnosis/repair-workspace.log b/docs/research/card-s-h/d-diagnosis/repair-workspace.log

@@ -0,0 +1,209 @@

diff --git a/docs/research/card-s-h/d-diagnosis/schema-checkpoints-isolated.log b/docs/research/card-s-h/d-diagnosis/schema-checkpoints-isolated.log

@@ -0,0 +1,18 @@

diff --git a/docs/research/card-s-h/d-diagnosis/schema-checkpoints-workspace.log b/docs/research/card-s-h/d-diagnosis/schema-checkpoints-workspace.log

@@ -0,0 +1,11 @@

diff --git a/docs/research/card-s-h/d-diagnosis/schema-checkpoints.test.mjs b/docs/research/card-s-h/d-diagnosis/schema-checkpoints.test.mjs

@@ -0,0 +1,39 @@

diff --git a/docs/research/card-s-h/d-diagnosis/schema-envelope-isolated.log b/docs/research/card-s-h/d-diagnosis/schema-envelope-isolated.log

@@ -0,0 +1,44 @@

diff --git a/docs/research/card-s-h/d-diagnosis/schema-envelope-workspace.log b/docs/research/card-s-h/d-diagnosis/schema-envelope-workspace.log

@@ -0,0 +1,11 @@

diff --git a/docs/research/card-s-h/d-diagnosis/schema-envelope.test.mjs b/docs/research/card-s-h/d-diagnosis/schema-envelope.test.mjs

@@ -0,0 +1,37 @@

diff --git a/docs/research/card-s-h/d-diagnosis/selected-final.log b/docs/research/card-s-h/d-diagnosis/selected-final.log

@@ -0,0 +1,155 @@

diff --git a/docs/research/card-s-h/d-diagnosis/selected-owner-affected.log b/docs/research/card-s-h/d-diagnosis/selected-owner-affected.log

@@ -0,0 +1,134 @@

diff --git a/docs/research/card-s-h/d-diagnosis/selected-owner.log b/docs/research/card-s-h/d-diagnosis/selected-owner.log

@@ -0,0 +1,11 @@

diff --git a/docs/research/card-s-h/d-diagnosis/selected-owner.test.mjs b/docs/research/card-s-h/d-diagnosis/selected-owner.test.mjs

@@ -0,0 +1,37 @@

diff --git a/docs/research/card-s-h/d-diagnosis/verify-affected.log b/docs/research/card-s-h/d-diagnosis/verify-affected.log

@@ -0,0 +1,51 @@

diff --git a/docs/research/card-s-h/d-diagnosis/verify-alpha-core.log b/docs/research/card-s-h/d-diagnosis/verify-alpha-core.log

@@ -0,0 +1,174 @@

diff --git a/docs/research/card-s-h/d-diagnosis/verify-broad.log b/docs/research/card-s-h/d-diagnosis/verify-broad.log

@@ -0,0 +1,549 @@

diff --git a/docs/research/card-s-h/d-diagnosis/verify-final-broad.log b/docs/research/card-s-h/d-diagnosis/verify-final-broad.log

@@ -0,0 +1,512 @@

diff --git a/docs/research/card-s-h/d-diagnosis/verify-intersections.log b/docs/research/card-s-h/d-diagnosis/verify-intersections.log

@@ -0,0 +1,495 @@

diff --git a/docs/research/card-s-h/d-diagnosis/verify-isolated.log b/docs/research/card-s-h/d-diagnosis/verify-isolated.log

@@ -0,0 +1,51 @@

diff --git a/docs/research/card-s-h/d-diagnosis/verify-key-callers.log b/docs/research/card-s-h/d-diagnosis/verify-key-callers.log

@@ -0,0 +1,71 @@

diff --git a/docs/research/card-s-h/r1-numeric/REPORT.md b/docs/research/card-s-h/r1-numeric/REPORT.md

@@ -0,0 +1,11 @@

diff --git a/docs/research/card-s-h/r1-numeric/UTF-16be.db b/docs/research/card-s-h/r1-numeric/UTF-16be.db

diff --git a/docs/research/card-s-h/r1-numeric/UTF-16le.db b/docs/research/card-s-h/r1-numeric/UTF-16le.db

diff --git a/docs/research/card-s-h/r1-numeric/UTF-8.db b/docs/research/card-s-h/r1-numeric/UTF-8.db

diff --git a/docs/research/card-s-h/r1-numeric/loader.test.mjs b/docs/research/card-s-h/r1-numeric/loader.test.mjs

@@ -0,0 +1,24 @@

diff --git a/docs/research/card-s-h/r1-numeric/oracle.c b/docs/research/card-s-h/r1-numeric/oracle.c

@@ -0,0 +1,7 @@

diff --git a/docs/reviews/translation-fidelity-2026-09-14.md b/docs/reviews/translation-fidelity-2026-09-14.md

@@ -4364,7 +4364,7 @@ repairs IS NULL/range/clamp and full-scan covered-prefix costs; fresh affected

@@ -4495,16 +4495,16 @@ zero skips/cancels,standalone typecheck0; review draft not acceptance.

@@ -4904,8 +4904,20 @@ paths. See the same evidence link for failed runs and current bounded results.

diff --git a/src/internal/btree.ts b/src/internal/btree.ts

@@ -48,6 +48,7 @@ function limit(value: number | undefined, fallback: number, name: string): numbe

diff --git a/src/internal/schema.ts b/src/internal/schema.ts

@@ -809,7 +809,12 @@ export function loadSchemaGraph(connection: StorageOwnerCarrier, context: Schema

diff --git a/src/internal/stat4-estimate.ts b/src/internal/stat4-estimate.ts

@@ -0,0 +1,31 @@

diff --git a/src/internal/stat4-probe.ts b/src/internal/stat4-probe.ts

@@ -53,15 +53,36 @@ export class Stat4Probe extends UnpackedRecordKey {

diff --git a/src/internal/storage.ts b/src/internal/storage.ts

@@ -25,11 +25,21 @@ export class ImmutableStorage {

diff --git a/src/internal/vdbe.ts b/src/internal/vdbe.ts

@@ -3527,7 +3527,7 @@ function compileInnerTableSelect(select:SelectNode,expanded:ReturnType<typeof ex

@@ -3616,7 +3616,7 @@ function compileInnerTableSelect(select:SelectNode,expanded:ReturnType<typeof ex

@@ -5597,7 +5597,7 @@ function compileTableSelectProducer(select: SelectNode, schema: SchemaGraph, dat

@@ -5832,7 +5832,7 @@ function compileTableSelectProducer(select: SelectNode, schema: SchemaGraph, dat

diff --git a/src/internal/where-plan.ts b/src/internal/where-plan.ts

@@ -10,6 +10,8 @@ import type {SqlToken} from "./tokenize.ts";

@@ -29,9 +31,10 @@ export interface WherePath {readonly loops:readonly WhereLoop[];readonly ready:S

@@ -82,7 +85,7 @@ function makeCapability(index:IndexNode,physical:PhysicalIndex,equality:readonly

@@ -157,11 +160,14 @@ function* capabilities(index:IndexNode,terms:readonly WhereTerm[],ordinal:number

@@ -306,49 +312,66 @@ function exprInteger32(value:ExprReduction):bigint|null {

@@ -374,7 +397,7 @@ export function btreeLoops(source:ResolvedSource,sourceOrdinal:number,clause:Whe

@@ -403,7 +426,7 @@ export function btreeLoops(source:ResolvedSource,sourceOrdinal:number,clause:Whe

@@ -422,11 +445,11 @@ export function btreeLoops(source:ResolvedSource,sourceOrdinal:number,clause:Whe

@@ -504,17 +527,86 @@ function literalInLogEst(term:WhereTerm):bigint {

@@ -522,7 +614,7 @@ function indexLoopEstimate(index:IndexNode,cap:BtreeCapability,source:ResolvedSo

@@ -540,6 +632,7 @@ function indexLoopEstimate(index:IndexNode,cap:BtreeCapability,source:ResolvedSo

@@ -643,11 +736,13 @@ export function wherePathSolver(candidates:readonly (readonly WhereLoop[])[],sou

@@ -665,7 +760,9 @@ export function wherePathSolver(candidates:readonly (readonly WhereLoop[])[],sou

@@ -1403,20 +1500,52 @@ export function rightJoinResidual(resolved:ResolvedSelect,ordinal:number):readon

diff --git a/test/conformance/or-rowid-red.test.mjs b/test/conformance/or-rowid-red.test.mjs

@@ -53,9 +53,14 @@ for(const v of capture.variants){

diff --git a/test/conformance/skipscan-docs.test.mjs b/test/conformance/skipscan-docs.test.mjs

@@ -37,6 +37,7 @@ test('public skipscan contract retains bounded callers and exclusions without di

diff --git a/test/conformance/stat4-docs.test.mjs b/test/conformance/stat4-docs.test.mjs

@@ -0,0 +1,35 @@

diff --git a/test/conformance/stat4-frontier-oracle.c b/test/conformance/stat4-frontier-oracle.c

@@ -0,0 +1,22 @@

diff --git a/test/conformance/stat4-keystats-oracle.c b/test/conformance/stat4-keystats-oracle.c

@@ -0,0 +1,36 @@

diff --git a/test/conformance/stat4-keystats.test.mjs b/test/conformance/stat4-keystats.test.mjs

@@ -0,0 +1,286 @@

diff --git a/test/conformance/where-plan-analysis.test.mjs b/test/conformance/where-plan-analysis.test.mjs

@@ -1346,7 +1346,7 @@ test('cost rowid scanner follows column equivalence retaining original RHS prere
