# JSQLite2 0.0.0-beta.4

Fourth public beta: materially broader index-supported SELECT planning and
execution, independently accepted locally on 2026-10-23 at
`f6ae8c3dfc9963b1a8f0aa02c60b8dee7784734d`, over runtime
`7d9a7822620adc8559f003b63cf7cd730b3effdc`. Publication changes version, legal
packaging and documentation, not engine behavior. Later RIGHT/FULL matched-pass
development is deliberately excluded. Existing public releases remain immutable.

## Changes since beta.3

- Scalar/vector/correlated selected IN now uses eligible persistent ROWID/UNIQUE
  indexes or translated private B-tree set destinations, including projection,
  physical direction, affinity/collation, NULL and repeated-field handling.
- Index paths feed ordinary, joined, recursive OR, derived, retained LIMIT and
  GROUP/aggregate consumers through shared SELECT and VDBE owners.
- Resolved-source flattening, retained coroutine eligibility, ORDER reference
  projection and explicit COLLATE comparison repairs preserve real callers,
  full-tuple residuals, typed results and lifecycle semantics.
- The twelve-family admission ledger distinguishes actual selected access from
  correct scan fallbacks, partial support and missing optimizations. It covers
  equality/IPK/prefix/range/composite, IN/OR, skipscan, covering/WITHOUT ROWID,
  bounded ORDER/GROUP/DISTINCT/LIMIT and joined/correlated consumers,
  statistics/parameters, expression/partial indexes and enrolled modules.

See [family-level scope and evidence](../research/where-beta4-admission.md).
This is a MOST-major-family milestone, not a compatibility percentage, all-query
guarantee, universal optimizer parity or native cost/work equivalence.

## Accepted local evidence

- **509/509 test files completed successfully, 8,806 passes and five existing
  skips**, 16 successful prerequisites, no input drift or unrun tail.
- **812 companion passes across 39 files**; focused counts overlap and are not
  additive compatibility coverage. The five existing skips receive no credit.
- Original 20k/20-outer/20-RHS selected-versus-scan workloads complete around
  21.6–21.8 seconds across encodings under unchanged serial/file60s/batch600s
  limits. WR87 is the authenticated 85+2 partition with unchanged assertions,
  not a newly run obsolete unpartitioned file or a universal speed claim.
- Native/public common45, leads45 and six-family18 compare typed rows, all five
  metadata fields and repeated execution/reset across UTF-8/UTF-16le/UTF-16be.
- Package/offline strict-consumer checks, actual Chromium48 plus two separate
  gap controls, independent installed HTTP six demo groups and original
  native-typed query three executions/two resets passed.

These are retained accepted exact-input results, not newly rerun publication-wide
tests. Historical failures/timeouts remain failures on their original inputs;
unknown causes remain unknown. Publication separately validates its versioned
tarball, equality of all 112 emitted JS/declaration files with the accepted local
artifact and the actual public playground. Gap controls do not implement gaps.

## Delivery and limitations

Download `jsqlite2-0.0.0-beta.4.tgz` and SHA256SUMS from the
[GitHub prerelease](https://github.com/salva/jsqlite/releases/tag/v0.0.0-beta.4).
Verify its hash and install the local tarball; no npm registry publication.
For unbundled browsers serve the complete dist tree and import dist/index.js.
GPL-3.0-or-later; LICENSE/NOTICE and corresponding source accompany the release.
Chinook retains its separate MIT notice.

At this accepted milestone RIGHT/FULL main matched-pass planning still falls
back; a selected unmatched drain does not earn matched-pass credit. Runtime
automatic-index/Bloom construction, general LIKE/GLOB range synthesis,
specialized minmax/DISTINCT/BIGNULL, wider multisource ordering and broader
STAT4 vector/function/subquery proofs remain incomplete. Immutable PK/UNIQUE
indexes are not runtime automatic indexes. Broader SQL compositions and finite
resource/interruption schedules remain progressive work, not scope exclusions.

The runtime remains read-only browser-safe TypeScript/JavaScript: no native
SQLite, WebAssembly or SQL-query backend. Cooperative controls do not establish
hard preemption, native heap parity or all-browser certification. See the
versioned [API](../api.md), [guide](../TRANSLATION.md), [SPEC](../SPEC.md) and
[conformance](../CONFORMANCE.md). The public playground retains its 60-second
watchdog and 1,000-row cap. Beta.4 is not whole-project completion.
