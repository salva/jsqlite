# JSQLite2 0.0.0-beta.3

Third public beta: a useful bounded index-planning improvement, independently
accepted locally at `14d15a3f1d6d69ea9ed88d7a44a01ca412acbd96`. Publication adds
version/license/documentation and legal-notice package checks, not engine edits.
Unfinished beta.4 work is excluded; previous releases remain immutable.

## Changes since beta.2

- STAT4-informed scalar range estimates for invalid-prefix skip-scans now feed
  actual candidate costing and selected index execution, translating SQLite's
  `whereRangeSkipScanEst` and scalar sample extraction. Known-prefix KeyStats
  and fallback behavior remain distinct.
- Schema-owned sample records are borrowed by internal readers without an
  unnecessary full-record copy before resource checks; public copies stay defensive.
- Numeric separator tokens publish the normalized owning semantic production
  consistently for planner probes and ordinary execution.
- Meaningful sample-loop interruption, cleanup, reset/retry and actual elapsed
  deadline-control checks accompany the translated production paths.

The representative native-backed20k-row fixture demonstrates useful index
selection and reduced JSQLite cursor work against a forced alternative. These
are fixture-specific access observations, not universal speedups, native VM-step
equivalence or full optimizer parity. Broader index-supported SELECT coverage is
the separate beta.4 workstream, not a claim of this release.

## Accepted evidence

Exact local-beta source: **485/485 files completed,8,707 passes,five existing
skips,zero failures/cancellations/timeouts**,16 prerequisites successful, and
**809/809 companion tests across39 files**. No input drift or unrun files.
Five skipscan-copy compiled/concurrent/corruption/memory/recovery cases receive
no coverage credit. Counts overlap and are not a compatibility percentage.

Fresh native/public common45,leads45 and six-family18 observations match typed
rows/full metadata/two executions across all three encodings. Original unreduced
20k6/6 and unpartitioned WR87/87 complete; WR58.302s is close to the60s ceiling,
not evidence of performance headroom. Historical failed/drifted/masked runs and
timeouts remain historical failures, not retroactively green.

Actual rebuilt package/offline strict consumer checks, HTTP Chromium148 /
Playwright1.60 current48 plus separate gap2, authenticated52 served runtime
modules, independent installed six demo groups and original native-typed Chinook
query three executions/two resets passed. Publication separately validates its
versioned tar, identical accepted emitted bytes and actual public playground.
Accepted full-suite results are not claimed as newly rerun publication tests.

## Delivery and remaining boundaries

Download `jsqlite2-0.0.0-beta.3.tgz` and SHA256SUMS from the
[GitHub prerelease](https://github.com/salva/jsqlite/releases/tag/v0.0.0-beta.3),
verify the tarball hash, then install the local tarball with npm. For unbundled
browsers serve its complete `dist/` tree and import `dist/index.js`. No npm
registry publication. GPL-3.0-or-later; LICENSE/NOTICE and corresponding source
accompany the release. Chinook retains its separate MIT notice.

This is bounded read-only support, not all SQLite query/optimizer combinations.
General parameter-sensitive reprepare-plan parity, vector/function/subquery
probes, broader selected index/composition paths and exhaustive resource/error
schedules remain work. Cooperative controls are not hard preemption, native heap
parity or all-browser certification. Native SQLite is development-only: no
native/WASM/query-server evaluator is shipped. See exact-version [API](../api.md),
[guide](../TRANSLATION.md), [conformance](../CONFORMANCE.md) and [SPEC](../SPEC.md).

The public playground keeps its60-second watchdog and1000-row cap. Publication
receipts retain exact artifact hashes, commands, outcomes and applicability.
Beta.3 is an accepted milestone, not whole-project completion.

## Reproducible development evidence

With explicit owner authorization, nine unpublished development commits were
rewritten to remove oversized, duplicated research output. Original accepted
source14d15a3f maps to494ace2f5a48b3ebee160b9d3b1712e65bea03b9. Runtime/API/build
and all other source inputs are unchanged; the package reproduces the original
accepted artifact byte-for-byte. Published history/releases were not rewritten.

The native regression fixture losslessly shares ten repeated typed rowsets;
all102 query/profile/encoding captures reconstruct identically with hash checks.
The exploratory search retains all29 plan differences, setup/work counters,
row counts and typed-result hashes. Pinned generators freshly reproduced both
committed compact outputs, writing full raw captures only to disposable card
work. See [capture policy and regeneration](../research/card-s-h/CAPTURES.md).
Original captures/Git state remain in the verified operator backup; historical
accepted evidence retains original source-era hash identities. This is evidence
storage repair, not new engine behavior or a claim that old tests ran on new hashes.
