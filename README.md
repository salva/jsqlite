# JSQLite2

A fresh TypeScript translation of SQLite's read-only C implementation and tests
for browsers and Fetch-compatible runtimes. The runtime must not embed
C, native SQLite, or WebAssembly.

The complete product contract is [docs/SPEC.md](docs/SPEC.md); the owner-directed
[roadmap](docs/PLAN.md) starts with a JS/TS-friendly C-equivalent API, then an
upstream-test harness and first test tranche, followed by progressive translation
with tests ahead of each slice. The public API, pinned development oracle, test
harness and progressive TypeScript engine now exist. Represented joins,
compounds, aggregates, subqueries/views, CTEs, windows, functions (including JSON)
and selected index planning execute at documented bounded admission gates. This
is not full read-only SQLite compatibility or whole-project completion. Native
SQLite is development-only, never the runtime backend.

[Current translation guidance](docs/TRANSLATION.md), [public API](docs/api.md),
[source map](docs/SQLITE_SOURCE_MAP.md), [oracle setup](docs/oracle.md), and
[conformance evidence](docs/CONFORMANCE.md) are available. Technical choices remain
mutable under SPEC. The original baseline and subsequent guidance are preserved
with provenance in [documentation history](docs/research/card-u-history/README.md).

The official SQLite 3.53.4 full source/test archive, latest stable as checked on
2026-09-12, is available locally under
`reference/sqlite/`. Its tracked [manifest](reference/sqlite/manifest.json)
records the upstream download URL, checksums, size, and public-domain license.
The archive itself is ignored by Git and can be downloaded again from that URL
and verified against the manifest.
The reference is pinned; later stable releases are adopted deliberately at
meaningful milestones with source, tests, and oracle updated together.
## Local browser ESM build

Requires Node.js 24 and the lockfile-pinned TypeScript 5.9.3 for development:

```sh
npm ci
npm run build
npm pack --pack-destination /your/local/output
```

`dist/index.js` is the named ESM entry (`open`, `JSQLiteError`);
`dist/index.d.ts` supplies the public TypeScript contract. Relative JS imports
are browser-resolvable; serve the complete `dist/` tree, not just its entry file.
For package consumers, install the local tarball and import from `"jsqlite2"`.
For browsers without a bundler, import from the served `dist/index.js` URL.
Requires ES2022 (including BigInt), Fetch/Streams, AbortController, text codecs,
and Web Crypto for SQL randomness. No runtime dependencies, Node APIs, native
SQLite, WASM, dynamic code generation or telemetry are shipped.

The package remains **private**, versioned `0.0.0-local-translated`: locally
consumable experimental output, not registry release approval or a claim of full
SQLite compatibility. SQL admission remains bounded as described above.
Packaging explicitly includes only emitted JS/declarations, plus npm's mandatory
package metadata and this README; reference sources, fixtures, tools and research
are development-only. `npm pack` rebuilds before packing.

`npm run test:package` requires `SAIVAGE_CARD_WORK_ROOT` pointing at a disposable
work directory. It checks clean byte-identical builds, actual local tarball
contents/security closure, strict consumer types, named package imports, and
browser-global execution across the three database encodings. It uses an isolated
VM browser-global realm, not a GUI browser; no remote publication occurs.
