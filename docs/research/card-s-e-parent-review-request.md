# Parent/component review request: immutable estimates bounded runtime

From [[card:card-s-e-b]] to [[card:card-s-e]] / independent reviewers. Parent status v2 reread checkpoint42; architecture approval only, no residual disposition. **Not accepted; no staging authorization inferred.**

## Required technical dispositions (original tests unchanged)

1. **Three no-ORDER width tie assertions.** Original `row-width-preimplementation.test.mjs` expects ta in tie-small-a despite equal setup/run/output and same sort identity. Independently pinned exact `SELECT a FROM t WHERE a=1` selects tb9/9 across all tie states/encodings. TS chosen capability/OpenIndex/public rows/reset9/9. where.c2744 discards equal later candidate before5818 width tie. Please review whether original assertions should follow native tb; implementation must not revive discarded ta.
2. **One joined reverse-sorter assertion.** Original advanced test1235 expects sorterRows>=3 forced m_abc. Exact same SQL pinned SORT0 forced/SORT1 NOT INDEXED across3 encodings; TS rows/reset/sorter presence6/6. where.c5273 skips ONEROW x.id=2 ordering, allowing y reverse order. Please review source/native expectation correction; do not impose nonnative sorter merely for conservative historical comment.
3. **Root existing REAL SeekRowid divergence.** Original JS-number bindings preserved; isolated joined/rowid/path-bias360 current11 pass349 fail, HEAD0/360. INTEGER diagnostic current360/360 vs HEAD135/225 is not acceptance. vdbe.c5495 copy+NUMERIC lossless conversion absent at TS integer-only SeekRowid guard. Root semantic owner must implement conversion/consumer contract; no per-SQL width workaround or binding-type waiver.
4. **Joined WR outside executed bounded lowering.** Native3 joined controls nonempty; current and HEAD0/3 same compileInnerTableSelect3376 storage-shape rejection. No new width regression or joined mapping credit; ordinary WR mapping repair does not prove joined support. Root/parent assign coherent SELECT storage lowering rather than deleting fence.

## Fresh evidence / limits

Checkpoint40 standalone typecheck0; all width1928:1453 pass475 fail,0 skipped/cancelled (original123+isolated349+WR3). Affected129:128/1 reverse-sorter,0 skipped/cancelled. Subsequent exact reverse-order6/6 separately; no manufactured refreshed aggregate. Checkpoint33 full affected/resources229:228/1 reused: broader branches not freshly recertified. Advanced exact24/30, analyzeC0/24, four broad root reds and missing external artifacts unchanged.

Native original120 snapshots8,785,920 bytes reused. Ordinary selected1080/1080 plus private9/9; new actual LEFT guard regression/reset native6/6 versus pre-guard0/6,reverse outer transitions6/6. Persistent publication120/120 and failed publication6/6 are source-derived internal invariants,not native estimate introspection/complete cleanup proof. Metadata/hex/raw UTF8/UTF16 controls bounded; arbitrary byte/alias/expression/join coverage remains open. Native permissive malformed stat-record behavior differs from existing strict loader policy. STAT4 unsupported/noSkipScan retained unconsumed; no universal optimizer/skipscan/OR/count optimization credit.

## Ownership and staging boundary

HEAD6ba3b52c2a3d4740164656882618aa37e5f64280. Checkpoint42 actual dirty/index inventories under card work width-fortysecond; index empty. No runtime edits since27. Current mixed VDBE diff SHA6315332880a8caac0aaa0e1a556e1d5544e86c3a2f12885626c9b9980e40b8dc:29+/14− combines owned27+/12− and preserved peer2+/2−; prior owned review patch checkpoint29 remains separate,not staged. Mixed docs/advanced test changes must not be staged wholesale. Parent-approved component/system review must inspect actual diff and new untracked captures/tests; this document is a request,not evidence review occurred.

Implementation ownership/source rationale: `card-s-e-implementation-review.md`, `card-s-e-estimate-census.md`, living guide/source map/current audit. Per-command hashes/results and failed hypotheses in [[card:card-s-e-b]] status. Independent review must assess residual clause selectivity,constructor/default/error ownership,physical capabilities and resource gaps; named source routines and sample passes are not full fidelity certification.
