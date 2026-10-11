# WR Case5 consuming evidence — [[card:card-s-i-c-b-c]]

Current bounded implementation/evidence entrypoint; **not reviewed milestone approval or whole-suite compatibility**. The original tests-first brief and red predictions are preserved verbatim in [baseline README](tests-first-baseline-readme.md); they are historical, not current runtime assertions.

## Current owner path

`where-plan.ts` admits selected persistent WR multi-or through the existing OR graph/frontier. `vdbe.ts` ordinary, represented INNER and simple persistent scalar builders lower Case5 through shared register/cursor allocation and Gosub/Return continuations. No aggregate or transformed EXISTS expansion and no parallel evaluator. [Consumer decisions](consumer-decisions.md) distinguish direct RIGHT exclusion from surrounding forced/NOT INDEXED guards and the safe nullable-side LEFT boundary; [nullable source comparison](nullable-boundary.md) retains readiness/null-extension limits.

Dedup identity is the primary physical descriptor's first nKeyCol/aiColumn order, with logical Column/REAL extraction and typed KeyInfo encoding/collation/direction. Accepted page-backed `PrivateKeyVmCursor` owns ephemeral keys; array storage is not used for WR Case5. Residual truth precedes dedup. First arm bypasses Found, final bypasses insertion, middle uses safe packed reseek for USESEEKRESULT rather than a trusted location token. Duplicate jumps skip exactly Gosub. Compact secondary suffix extraction plus persistent NotFound positions the WR primary or resumes continuation on miss; primary cursor identity bypasses redundant positioning. Common secondary covering excludes WR primary. Rowid RowSet remains separate.

Joined covering remaps physical primary fields before secondary lookup; correlated scalar references retain WR physical ordinals. Per-outer/nested ephemeral reset and shared-body readiness remain caller-owned. These are finite implemented paths, not exhaustive WhereEnd or optimizer parity. [Source owner comparison](source-owner-comparison.md) and [original comparison/provenance](owner-comparison.md) retain source/error-order rationale and outstanding boundaries.

## Evidence and remaining gates

[Finite acceptance matrix](acceptance-matrix.md) is the named evidence/boundary index, not an optional parity checklist. Selected boundary plus primitive and expanded-source tests passed85/85; affected ten-file selection passed224/224. Five genuine upstream execsql cases are classified separately from authored supplemental probes and encoding variants: [expanded independent capture](native-wherei-expanded.json), [dev-only harness](capture-wherei-expanded.py). Native is not a product dependency.

[Actual browser report](browser-wr-report.json): Chromium148/Playwright1.60, selected supplemental overlap/middle probes in three encodings,6/6 executed of46 declared. This is not whole-browser signoff. Captures and report authenticate fixture/source/runtime inputs; public typed comparisons preserve INTEGER/REAL, NULL, TEXT and BLOB distinctions.

[Original225 evidence](original225-residual-attribution.md) retains earlier222/3, corrected diagnoses and later packaged225/225 versus archive224/1 plus separate generator retry. MakeRecord phase-domination hypothesis was refuted by verified adaptive endpoint bounds. Endpoint/byte/sorter proposals remain provisional original-owner handoffs, excluded from WR publication.

Metadata capture, nested arm/register audit, missing-primary ordering and selected/offpath movement now have finite witnesses in the matrix. Exhaustive heap/Pager/microcheckpoint and total comparison-cost parity remain unclaimed. Independent d/e represented source assessment is integrated; publication is scoped separately from provisional original225 proposals.

Detailed revision-bound commands, failures, hypotheses and hashes remain in the card's status records and linked research artifacts. Historical coverage.log/hashes.txt describe tests-first inputs, not current runtime acceptance.

## Current independent integration disposition

d22 coverage and e9 source assessment support the represented WR contract; [matrix](acceptance-matrix.md) is current. Both additive d tests/capture are integrated without altering original window/index expectations. Original225 endpoint/byte/sorter proposals remain separate provisional payload75a4, not approved or part of WR delta. Full-browser45/46 failure is owner-routed, not waived. Historical test counts remain revision evidence, not current gate predictions.
