# JSQLite2

## Public project and license

JSQLite is published under **GNU GPL version 3 or later (`GPL-3.0-or-later`)**.
See [LICENSE](LICENSE) and [third-party notices](NOTICE.md).
The owner authorized the public repository and documentation/demo on 2026-10-06;
the private-local distribution restriction in historical alpha evidence below
is superseded for this publication, not a change to its compatibility evidence.
There is no npm registry publication yet. Public documentation and a live browser
playground are maintained independently on the `public-site` branch:
https://salva.github.io/jsqlite/.

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
## PRIVATE LOCAL alpha

The local alpha packages the implemented, bounded read-only core; it is not full
SQLite compatibility, arbitrary SQL-composition support or a public release.
[Finite supported/gap/exclusion matrix](docs/research/card-v-private-alpha.md)
and [release evidence/identity](docs/research/card-v-a-final-alpha.md) identify the
exact source, artifact and independent test boundaries. SPEC breadth is unchanged;
unimplemented in-scope constructs remain temporary gaps, not new exclusions.
Core stabilization and targeted adversarial/reuse, credential/CORS and realistic
indexed/overflow scenarios pass on the identified runtime. Performance observations
are finite tests, not workload-wide latency/heap guarantees or other-browser proof.
Only private local consumption is authorized: no registry, public repository or
external distribution. Final installed-artifact demo/review is tied to its digest.

```sh
# Use the full source identity in the release evidence, not HEAD or dirty source.
python3 tools/package/local-alpha.py \
  --commit <40-hex-release-source-commit> --version 0.0.0-alpha.4 --name alpha-local
npm install --ignore-scripts --no-audit --no-fund \
  "$SAIVAGE_CARD_WORK_ROOT/alpha-local/jsqlite2-0.0.0-alpha.4.tgz"
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

The development package remains **private**, versioned `0.0.0-local-translated`;
the explicit-source local alpha command applies a recorded `0.0.0-alpha.N`
metadata overlay in its isolated export. Neither is registry release approval
or a claim of full SQLite compatibility. SQL admission remains bounded above.
Packaging explicitly includes only emitted JS/declarations, plus npm's mandatory
package metadata and this README; reference sources, fixtures, tools and research
are development-only. `npm pack` rebuilds before packing.

`npm run test:package` requires `SAIVAGE_CARD_WORK_ROOT` pointing at a disposable
work directory. It checks clean byte-identical builds, actual local tarball
contents/security closure, strict consumer types, named package imports, and
browser-global execution across the three database encodings. It uses an isolated
VM browser-global realm, not a GUI browser; no remote publication occurs.
