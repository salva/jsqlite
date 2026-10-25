# JSQLite2 0.0.0-beta.6

Sixth public beta: a bounded structural-maintainability milestone, retaining
beta.5's join/index/Bloom functionality while clarifying shared compiler ownership.
Independently accepted locally on2026-10-25 at
`c59d3bb6205ade1a98d09c1c6665174118833934`, tree
`ec4ac7f56f91552994c39b1d0cffd87b699de4a0`, under root review10.
Publication changes legal/package metadata and documentation, not engine behavior.
Later LIKE/GLOB prefix-range work and subsequent development are excluded.
Prior releases remain immutable; this is not whole-project completion.

## Changes since beta.5

- Consolidate identical aggregate-subquery destination production behind the
  union of its original admission guards. Shared builder/destination, GROUP BY
  without aggregates, Once and IN evaluation order remain explicit.
- Share INDEX_INFO semantic row production while retaining direct PRAGMA versus
  module protocols, field typing, error/check order and cursor cleanup.
- Replace obsolete clone-return machinery in RIGHT target verification with
  read-only visitation: express the actual responsibility instead of allocating
  cloned operations that are discarded.
- Introduce cohesive SELECT result delivery via `createSelectDelivery`:
  DISTINCT, direct/sorted publication, sorter draining and OFFSET/LIMIT have an
  identifiable owner. WHERE/RIGHT positioning, snapshots, shared register/cursor/
  label allocation, enclosing compound stops and cleanup remain in their owners.
- Update source-sensitive tests to protect the relocated responsibilities, with
  negative mutations and actual public/native result checks rather than obsolete
  helper adjacency. Preserve explicit integration inventory and native enrollment.

Pinned local ESLint/typescript-eslint and jscpd findings guided contextual review.
The affected hotspot's same-config complexity changed455→432; total warnings
remain310. Metrics are supporting evidence, not acceptance quotas or proof of
correctness. Large source-shaped dispatch is retained where justified. SonarJS's
SSAL distribution was not adopted. See
[maintainability research](../research/card-t-a-beta6-maintainability.md),
[translation guidance](../TRANSLATION.md) and [source map](../SQLITE_SOURCE_MAP.md).

## Accepted evidence and important qualifications

- The full532-file integration run on c90 completed with531 component exits0
  and one obsolete compound-owner observer failure:9174passes/1failure/5skips.
  That historical invocation remains failed, **not retroactively green**.
- On the accepted final test-only correction, fresh35/35 affected checks passed.
  Independent acceptance reconciled all5357 source inputs,40 native prerequisites,
  203 generated inputs and logs to permit unchanged531-component reuse. No
  newly executed monolithic532-green run is claimed.
- 39 companion files/829passes, explicit opt-in13files/28passes,13 package commands
  and actual built/offline-installed Chromium230/230 each are authenticated
  unchanged-input evidence, not newly rerun final-commit executions. Counts overlap
  and are not an additive compatibility denominator. Five full-suite skips remain.
- Fresh independent35/35 checks, actual installed HTTP native-query repetitions/
  reset/full metadata, six demo groups and error precedence, typecheck and package
  boundaries passed on the accepted applicability closure.
- Accepted local tarSHA
  `15d73b321e3b2890f069f25501f97bf7f7b46e3ac2e9ccfede7d316aec4f237d`
  contains57 runtime modules/114 emitted JS/declarations, authenticated across
  build/tar/extraction/installation and browser serving.

These are retained acceptance results, not publication-wide reruns. Publication
separately validates its versioned package, compares all emitted files with the
accepted artifact, and tests the actual playground/versioned installed demo.
Historical failures, partial runs and unmeasured limitations remain qualified.

## Delivery and remaining boundaries

Download `jsqlite2-0.0.0-beta.6.tgz` and SHA256SUMS from the
[GitHub prerelease](https://github.com/salva/jsqlite/releases/tag/v0.0.0-beta.6).
Verify hashes before installing. No npm registry publication. Serve the complete
dist tree for unbundled browsers. GPL-3.0-or-later; LICENSE/NOTICE and corresponding
source accompany the release; Chinook retains its separate MIT notice.

This release does not add the later selected LIKE/GLOB prefix-range implementation.
Wider/repeated/module/USING join layouts, broader automatic-index/Bloom and virtual
planner compositions, specialized range/minmax/DISTINCT/BIGNULL/order/statistics
paths and broader SELECT combinations remain progressive work, not exclusions.
Correct scan fallback is not index-use credit; no exhaustive compatibility,
native work/allocator parity, guaranteed speedup or hard latency/fairness claim.

Development policy100s/file/serial≤80/600s independent batch is distinct from the
playground's unchanged60-second watchdog/1000-row cap. Public API memory/work/
cancellation/deadline guarantees are unchanged. Runtime remains browser-safe
read-only TypeScript/JavaScript without native SQLite, WebAssembly or query backend.
