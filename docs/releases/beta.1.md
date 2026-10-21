# JSQLite2 0.0.0-beta.1

First public beta, published with explicit owner authorization. The accepted
local-beta source is `d2780fb63b20d560ed1f960c32b221b850e02573` (runtime
`331128e5686362916373f3047431469bb3a8c42a`). Release metadata, licensing and
publication documentation do not change its TypeScript engine. Post-beta
development is deliberately excluded from this release.

## Delivery

Download the tarball, checksum list and corresponding source from the
[GitHub prerelease](https://github.com/salva/jsqlite/releases/tag/v0.0.0-beta.1).
Install the local tarball with npm, or serve its complete `dist/` ESM tree and
import `dist/index.js`. No npm registry publication is involved.

The [playground](https://salva.github.io/jsqlite/) uses this pinned package.
Queries execute locally in a dedicated worker, with cancellation and a
60-second demo watchdog. The demo is capped at 1,000 rows. These are containment
limits, not promises about arbitrary SQL performance or engine preemption.

## Changes since alpha.7

Bounded native-backed support now includes repeated recursive CTE readers,
recursive joined UNION/UNION ALL arms, recursive and WITHOUT ROWID RIGHT/FULL,
mixed physical/JSON USING/NATURAL and RIGHT/FULL, ordered-derived outer filters,
and multi-column joined/retained compound inputs. The original nine-item gap
inventory's representative cases all match the pinned oracle, including typed
rows, metadata and reset behavior across all three database encodings.
Metadata aggregation and correlated consumers received corrections after the
immutable alpha.7 release; alpha.7 itself retains its disclosed defect.

## Evidence and limits

The accepted runtime's complete integration run finished **476 files**, with
**8,285 TAP passes, zero failures/cancellations, five existing skips**, plus five
separately inspected non-TAP scripts. **39 companion files / 809 tests** passed;
all 16 fixture prerequisites completed and there were no timeouts, unrun files
or input drift. Five skipped skipscan compiled/concurrent/corruption/memory/
recovery-copy cases receive no passing credit. Counts overlap and are not a
SQLite-compatibility percentage.

Independent installed-package evidence includes strict declarations/imports,
real Chromium Fetch checks (48 main plus two separate resource controls), six
demo groups and the original Chinook query with typed ordered rows/full
metadata/three executions/two resets. Release publication additionally checks
the actual versioned tarball and public playground. Fresh publication commands,
artifact hashes and outcomes are recorded in the publication receipt; earlier
accepted runs are not described as newly rerun.

This remains a **bounded beta, not all of SQLite**. Important remaining work:

- Legacy mixed metadata joins still reject some generated outer-column Filter
  arguments; post-beta repair is ongoing, not included here.
- Arbitrary joined aggregate/window/compound/nested and nondeterministic virtual
  Filter/planner combinations are not universally admitted or certified.
- Resource/cancellation checks are cooperative and finite; exact internal
  failure-phase coverage, native allocation/work parity, universal browser
  compatibility and hard-real-time guarantees are not established.
- Some recursive consumers eagerly materialize retained rows, with disclosed
  latency/memory costs; further faithful index-supported paths remain work.

See the exact-version [API](../api.md), [translation guide](../TRANSLATION.md),
[conformance evidence](../CONFORMANCE.md) and [SPEC](../SPEC.md). Temporary gaps
remain obligations, not newly permanent exclusions. Writes, recovery of WAL or
journal sidecars, host extensions and native/WASM runtime backends stay excluded.

## License and history

GNU GPL version 3 or later: [LICENSE](../../LICENSE),
[notices](../../NOTICE.md). Chinook has its own MIT notice. Corresponding source
is provided with the release and website. Previous alpha tags/assets are not
rewritten. Beta is a milestone; continued development is not project completion.
