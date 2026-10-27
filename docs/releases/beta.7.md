# JSQLite2 0.0.0-beta.7

Seventh public beta: selected LIKE/GLOB index ranges, scalar-equality-prefix
composition and necessary read-only correctness/compiler repairs. Independent
root review12 accepted local snapshot
`0931c0c3824ffe7a14eff03cd7c62edc093c2b81` (tree
`f42c02d1fa0bbbda0a23a71249bddbc1cfef0d7e`) on 2026-10-27.
Publication adds legal/package metadata and documentation, not engine changes.
Subsequent beta.8 resolver repairs and cleanup are excluded. Earlier releases
remain immutable; this is not whole-project completion or full SQLite compatibility.

## Changes since beta.6

- Selected first-field LIKE/GLOB prefix ranges and contiguous scalar-equality
  prefixes on standalone ordinary rowid indexes use the existing full-key,
  affinity, direction, NULL and repeat/WhereEnd machinery. Tests distinguish
  actual bounded index access from correct scan fallback.
- Read databases with omitted trailing fields after native ALTER ADD COLUMN:
  program-owned encoding/affinity-aware defaults apply to absent persistent
  fields, never stored NULL or NullRow. This is reading existing files, not
  executing ALTER TABLE or adding write support.
- Retained CTE/source identity, stored-view substitution, window/CASE linked
  bindings and explicit window setup/entry/drain preserve shared compiler owners
  instead of independent fallback decisions or instruction relocation.
- Native harness enrollment authenticates version and SourceID, original producer
  recapture, complete receipt/database equality and final generated/source drift.
  Original ALTER/no-UPDATE, synthetic-short and materialized composite fixtures
  remain distinct. Meaningful ownership controls replace obsolete lexical tests.

Residual LIKE/GLOB evaluation on both passes and per-dispatch String8 conversion
retain extra scalar/conversion work versus native behavior. No native work,
allocation or speedup parity is claimed. See [translation guidance](../TRANSLATION.md),
[source map](../SQLITE_SOURCE_MAP.md) and [conformance](../CONFORMANCE.md).

## Accepted validation, with explicit qualifications

- Full556 attempt remains **failed**:524 component exits0, two timeouts,
  30 explicitly not run;51 native prerequisites passed and284 generated inputs
  had no drift. Correlated-IN UTF16be hit100s; JSON-object UTF16le was interrupted
  about9s into its file by the600s enclosing batch. Timing cause remains unknown.
- An explicit same-input32-component replay passed all32 under unchanged limits.
  Authenticated5453 source-input maps and generated hashes establish successful
  component union exactly556 across two invocations, **not one green full run**.
  Independent root review12 accepted this qualified preservation evidence.
-13 package commands passed; authenticated built and actual offline-installed
  Chromium230/230 each. Independent installed HTTP Chromium230/230,96 original
  DEFAULT statements across encodings/full metadata/reset/error controls,12
  C1–C6 checkpoints, types/ESM/demo/Chinook checks passed. Counts overlap and are
  not a compatibility denominator. Earlier concurrent browser timeout remains
  failed; serial success does not prove its cause.
- Local accepted tarSHA
  `e8ec8603223756a90eafe9944ed425c345d53d4618da95673095ecda21e5a313`
  contains59runtime modules/118emitted JS/declarations. Publication separately
  validates the versioned package and compares emitted bytes to that artifact.

These are retained revision-qualified acceptance results, not publication-wide
reruns. Historical failed, timed-out and incomplete invocations remain nonpasses.
Publication adds fresh package/playground/versioned-demo/download/source checks.

## Development environment incident

A validation npm install inadvertently traversed from an empty intended consumer
to the enclosing development checkout, adding this package and removing extraneous
Playwright tooling. Proven prior top-level manifests were restored exactly;
original removed tooling bytes/versions and one retired npm log are unavailable.
Added package/hidden-lock residue remains inventoried and unused. Full dependency
restoration is **not** claimed. Candidate validation used explicit isolated
manifests/tooling and authenticated artifacts, so independent review distinguished
this unresolved preservation incident from a defect in the shipped runtime.

## Distribution and remaining boundaries

Download `jsqlite2-0.0.0-beta.7.tgz` and SHA256SUMS from the
[GitHub prerelease](https://github.com/salva/jsqlite/releases/tag/v0.0.0-beta.7).
Verify hashes before installing. No npm registry publication. Serve the complete
ESM dist tree. GPL-3.0-or-later; LICENSE/NOTICE and corresponding source accompany
the release. Chinook retains its separate MIT notice.

Joined/nested/IN/skipscan/WITHOUT ROWID/prefix STAT4 combinations, broader matched
joins/automatic-index/Bloom, specialized minmax/DISTINCT/BIGNULL/order/statistics
and wider SELECT/virtual compositions remain progressive work, not exclusions.
Unsupported admission is not a correct-result or optimization claim. All database
text encodings remain in scope. Browser certification is bounded Chromium evidence.
No hard latency/fairness/native allocator parity is promised. Development100s/file,
serial≤80/600s batches is separate from playground60s/1000rows. Runtime remains
read-only browser-safe JS/TS without native SQLite, WASM or query-service backend.
