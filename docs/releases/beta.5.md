# JSQLite2 0.0.0-beta.5

Fifth public beta: broader join-aware index execution and real runtime automatic
indexes/Bloom filters, with source-owned packed private storage and required
correctness/resource fixes. Independently accepted locally on2026-10-25 at
`942e6135ab5c212cf02d46d51171cfb94ce807ab`, tree
`24944e9ed6e19bd5ba19d612bc28fc492c013a8b`.
Publication changes version, legal packaging and documentation, not engine
behavior. Ongoing beta.6 maintainability work is excluded; prior releases remain
immutable. This is a bounded milestone, not whole-project completion.

## Changes since beta.4

- Broader RIGHT/FULL matched index access for represented two/three-rowid and
  rowid-left/WITHOUT ROWID-right joins. Complete primary-key identity, ON hit
  before WHERE, exact physical positioning and independent unmatched drain are
  preserved. Selected drain access does not masquerade as matched-pass credit.
- Native-costed automatic packed-index construction, Once build/probe/covering
  for ordinary two-physical-rowid INNER/LEFT joins, plus persistent-index Bloom
  production. Live affinity precedes Filter/seek; collisions still require the
  authoritative comparison. No host hash join, decoded-array evaluator or fake
  persistent schema index is introduced.
- Shared packed private Delete and application cursor operations now back
  represented window extrema instead of sorted-array search/splice. Window
  result ownership, typed ties, EXCLUDE and primary-error cleanup are corrected.
- Comparison-affinity, predicate NULL/error short-circuit and ordering repairs;
  explicit Mem input/output overlap, reserve-before-copy, rollback/sequence and
  zero-tail sizing corrections. Resource limits retain real live ownership,
  rather than discounting it to preserve obsolete test thresholds.
- Test orchestration now enrolls required pinned native fixture producers and
  detects generated-input drift. Long RIGHT/FULL tests run separately by encoding
  with the full original workloads and assertions.

See [translation guidance](../TRANSLATION.md), [source map](../SQLITE_SOURCE_MAP.md)
and [conformance evidence](../CONFORMANCE.md) for exact scope and mappings.

## Accepted local evidence

- Fresh full **528/528 component exits0;9,161 passes,zero failures/cancellations,
  five opt-in skips**,36 successful native prerequisites,201 generated inputs,
  no timeout/unrun/source or generated-input drift.
- **829/829 companion checks** across39 files, no skips/failures/drift.
- All five skipped production skipscan units separately exercised through the
  existing closure:6 prerequisites,13 files,28/28 units,zero skips. These overlap
  full coverage and are not added to9,161; the full manifest retains its skips.
- Build/type/package checks passed. Actual built and offline-installed
  Chromium148/Playwright1.60 each passed **230/230** all-lane checks, with
  build/tar/install/served module equality. Independent installed HTTP six demo
  groups and the original native-typed query three executions/two resets passed.
- Native/public checks cover all three database text encodings, typed results,
  all five metadata fields, errors, reset/rebind and cleanup at the represented
  boundaries. Execution claims remain revision-qualified, not a compatibility
  percentage or exhaustive fault-schedule guarantee.

Those are retained exact-input acceptance results, not newly rerun
publication-wide tests. Publication separately checks its versioned package and
all114 emitted JS/declarations against accepted local tarSHA
`dfbd0b653310e4b191669423c69ae4277c0af395f14055dd0414228becac8c6f`,
and validates the actual public playground. Historical failed/partial runs remain
failed/partial on their original inputs.

## Delivery and remaining boundaries

Download `jsqlite2-0.0.0-beta.5.tgz` and SHA256SUMS from the
[GitHub prerelease](https://github.com/salva/jsqlite/releases/tag/v0.0.0-beta.5),
verify the hash, then install the local tarball. No npm registry publication.
Unbundled browsers must serve the complete dist tree and import dist/index.js.
GPL-3.0-or-later; LICENSE/NOTICE and corresponding source accompany this release.
Chinook retains its separate MIT notice.

Wider/repeated/module/USING matched layouts, broader automatic/Bloom and
virtual-table/planner/Filter compositions, specialized LIKE/GLOB ranges,
minmax/DISTINCT/BIGNULL, wider multisource ordering and statistics-sensitive paths
remain progressive work, not permanent exclusions. Correct scan fallback earns
no index-use credit. No all-query guarantee, native cost/work/allocator parity,
stable speedup or hard latency/fairness claim follows.

Development validation uses100s/file, serial batches<=80 and an independent600s
batch ceiling; performance is not this stage's acceptance objective. These test
settings do not weaken public API memory/work/cancellation/deadline semantics.
The public playground keeps its separate60-second watchdog and1,000-row cap.
Runtime remains browser-safe read-only TypeScript/JavaScript with no native
SQLite, WebAssembly or SQL-query backend. SPEC scope is unchanged; beta.6 quality
work and continued development follow without automatic publication authority.
