# JSQLite2

**Public beta: [0.0.0-beta.7](https://github.com/salva/jsqlite/releases/tag/v0.0.0-beta.7).**
Browser-safe read-only SQLite, released under [GNU GPL v3 or later](LICENSE).
[Release scope, validation and remaining limitations](docs/releases/beta.7.md).
Try the [live playground](https://salva.github.io/jsqlite/).
No npm registry publication; install the GitHub release tarball.

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

[Functional-first beta categories](docs/PLAN.md#functional-first-beta-view) distinguish
committed functionality from gaps, optimization and delivery evidence; beta is not
publication.

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
## Public beta.7

This release packages the independently accepted local-beta engine from
`0931c0c3824ffe7a14eff03cd7c62edc093c2b81`. Release changes add version/license,
packaging checks and documentation, not engine changes. It is not full SQLite
compatibility or arbitrary SQL-composition support. All database text encodings
(UTF-8, UTF-16le, UTF-16be) are covered by the represented tests. SPEC breadth is
unchanged; untranslated in-scope constructs remain temporary gaps.

Earlier alpha artifacts and their disclosed limitations remain immutable.
Historical private/deferred-alpha instructions in research documents describe
their original handoffs, not this owner-authorized public beta.

```sh
curl -fLO https://github.com/salva/jsqlite/releases/download/v0.0.0-beta.7/jsqlite2-0.0.0-beta.7.tgz
curl -fLO https://github.com/salva/jsqlite/releases/download/v0.0.0-beta.7/SHA256SUMS
# Check the tarball entry against SHA256SUMS before installation.
npm install --ignore-scripts --no-audit --no-fund ./jsqlite2-0.0.0-beta.7.tgz
```

```ts
import { open } from 'jsqlite2';
const db = await open('https://your-local-origin/database.sqlite');
try {
  const { statement } = db.prepare('SELECT 1');
  if (!statement) throw new Error('no statement');
  try {
    while (await statement.step() === 'row') console.log(statement.column(0)); // 1n
  } finally { statement.finalize(); }
} finally { db.close(); }
```

Serve the complete installed `dist/` tree for unbundled browsers and import from
its `index.js` URL, not the bare package name without a bundler/import map. Fetch
uses default credentials omit; explicit Request/options retain their contract.
Serve static demo inputs with the installed artifact using
[installed-demo instructions](docs/research/card-v-c-installed-alpha-demo.md).
`installed-demo.py --package-manifest <manifest> --name <new-child>` installs the
actual tarball and runs the real-browser demo; this requires development-only
Playwright/Chromium. No query backend or native runtime is used.

## Static browser demo quickstart (worktree development only)

From the repository root, build the same local ESM artifact described below and
serve only static files (Python 3 is development serving tooling):

```sh
npm ci
npm run build
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/examples/browser/index.html>. The
[small demo](examples/browser/index.html) imports public named `open` and
`JSQLiteError` from `../../dist/index.js`; it fetches the bundled immutable
Chinook fixture locally, not from a live service. Choose the Album/Track join or
INTEGER/REAL/NULL/BLOB discriminator, inspect visible SQL and pinned-native
expected typed rows, and click Run. A failed-open button and editable SQL show
errors and cleanup diagnostics. No server query backend is involved.
[Demo instructions/provenance](examples/browser/README.md) and
[real-browser evidence](docs/research/card-v-c-demo-evidence.md) cover reproduction
and bounded results. This is a smoke demo, not a compatibility percentage or
release claim. Serve the repository root, not just the demo folder; `file://`
is not supported.

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

The package retains **private: true** to prevent accidental npm registry
publication; beta.6 is distributed as a versioned GitHub tarball. This is not
a claim of full SQLite compatibility. SQL admission remains bounded above.
Packaging explicitly includes only emitted JS/declarations, plus npm's mandatory
package metadata and this README; reference sources, fixtures, tools and research
are development-only. `npm pack` rebuilds before packing.

`npm run test:package` requires `SAIVAGE_CARD_WORK_ROOT` pointing at a disposable
work directory. It checks clean byte-identical builds, actual local tarball
contents/security closure, strict consumer types, named package imports, and
browser-global execution across the three database encodings. It uses an isolated
VM browser-global realm, not a GUI browser; no remote publication occurs.
