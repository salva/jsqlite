# Public beta.1 publication

Owner-authorized GitHub release and Pages publication, 2026-10-21. No npm registry
publication or change to the running autonomous service. Unfinished working-tree
edits are not staged, discarded or presented as beta acceptance.

## Pinned source and artifact

- Accepted local beta: `d2780fb63b20d560ed1f960c32b221b850e02573`.
- Public release source: `a8bdaa90f3ba6720434b601d6e79d9855cabfc63`, tag
  `v0.0.0-beta.1`. It preserves published master history and adds only release
  metadata, GPL notices, documentation and package-notice checks to the accepted
  source. No TypeScript engine changes or post-beta repair are included.
- Package: `jsqlite2-0.0.0-beta.1.tgz`, SHA256
  `25b05def0ed601c2c36aa79dbad5657ce756edaadc2c8ba85dc8f004fd482a82`,
  585253 bytes,104 members including LICENSE/NOTICE. All100 dist JS/declaration
  files equal the accepted local-beta tarball byte-for-byte.
- [Beta scope and limitations](../releases/beta.1.md), exact-version API and
  source are linked from the release/site. Previous alpha tags, assets and the
  versioned alpha.7 demo remain unchanged. Cached content-addressed alpha.7
  engine/worker/query resources are retained.

## Executed publication checks

The versioned release package passed `node --experimental-vm-modules
test/package-distributable.test.mjs`: clean reproducible builds/packing,
typecheck, strict installed consumer declarations/imports, dependency/runtime
closure and notice-byte checks. The first attempt exposed the old dist-only
package allowlist; it was explicitly extended to include GPL LICENSE/NOTICE,
without relaxing runtime/native/fixture exclusion. Full accepted476-file and
809-companion results are reused only through unchanged runtime/source input
identity, not described as a fresh publication rerun.

`python3 tools/package/build-site.py` builds exclusively from the pinned source
and hash-checked tarball. `node test/browser/public-site.test.mjs` executes actual
Chromium with the `/jsqlite/` base path and compressed database transport:

- Twelve exact native-backed presets, ordered rows/column names/storage classes.
- Original ten-row Chinook query and INTEGER/REAL/NULL/BLOB rendering.
- Fresh pinned-native metadata GROUP, recursive RIGHT and JSON RIGHT controls,
  two reset captures each. This checks the earlier alpha.7 metadata defect is
  corrected in this beta rather than silently changing alpha.7.
- Query error, cancellation/reuse,390px layout, license/corresponding-source links.
- Versioned installed-package demo, failed-open recovery and release/license links.

The versioned demo initially exposed compressed wire Content-Length mismatch.
Its website-owned app now decodes the fixed fixture into a Blob, exactly as the
main worker already does; release engine/query helper bytes remain unchanged.
The local test server's subdirectory-index handling was also corrected. Failed
attempts remain in the external publication logs; they are not passing runs.

The main public demo retains its **60-second watchdog** and1000-row cap. These
are containment policies, not latency/native-allocation/hard-preemption claims.
Chinook's MIT notice is retained. No native SQLite, WASM, server query backend,
telemetry or credentials are deployed.

External operation receipts under workspace
`tmp/jsqlite-beta1-publication-20261021/` retain package/source hashes, exact
commands, local/live browser results, GitHub release downloads and Pages outcome.
Only successful final remote/live checks establish completed publication.
