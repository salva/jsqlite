# Local distributable evidence — [[card:card-v-a]]

## Decision and ownership

Keep the package private and use `0.0.0-local-translated`: local installation is
supported, remote release acceptance is not asserted. Use the existing pinned
TypeScript 5.9.3 compiler, no added dependencies or bundler. Source-only build
config emits the complete 31-module engine closure and declarations. Build
cleans dist first and removes partial compiler output on failure. TS rewrites
relative JS imports but leaves `.ts` module specifiers in declarations; the
build's AST-owned module-string normalization repairs those to `.js` without
rewriting SQL or arbitrary strings. All shipped declarations are independently
checked with strict NodeNext resolution and no skipLibCheck.

No engine algorithm or public SQL guarantee changed. SPEC/TRANSLATION/API/source
map, source manifest, mutable fidelity audit and existing boundary/type tests
were consulted. Old private/no-distributable assertions were replaced with exact
private local metadata/allowlist checks; existing runtime native/eval/Function
assertions remain. Development scripts are retained. No runtime dependencies,
exports of internals, operator inputs, config/remotes, or native oracle changes.

## Reproduction and attempted hypotheses

Before repair: `npm run build` failed (missing script); source typecheck and old
boundary test passed. `import('jsqlite2')` failed ERR_MODULE_NOT_FOUND. Local pack
dry-run listed 1,228 files, no dist, and development/reference material (see card
status RED evidence). Source-relative type tests were not consumer validation.

First emitted build exposed TS 5.9's declaration `.ts` specifiers; normalized
only AST import/export/import-type module strings, then verified all declarations.
The first full package check reached publish dry-run but FAILED: npm 11 requires
an explicit tag for prerelease versions. The probe now uses `--tag local`; this
is a dry-run only, not a publication. Subsequent full runs passed. Earlier first
passing tarball was superseded when README changed; final hash below is the
current artifact. No SQL defect was diagnosed or patched.

## Final executed evidence

`npm run test:package` passed on Node v24.18.0 / npm 11.16.0. Exact child commands,
cwds, outputs, return codes and full per-file size/SHA256 inventory are retained
in [evidence.json](card-v-a-package/evidence.json) (SHA256
`14abaeda8b1917c10bb19f91798ab02a8507d16beb4a007b3d17a13b0d97a0d2`).
All 13 child commands exited 0:

- two clean `npm run build` calls with a stale-file discriminator; byte-identical
  emitted inventory and stale output removal;
- `npm run typecheck` and `npm run test:package-boundary`;
- `npm pack --dry-run --json`, two actual local `npm pack --json` invocations:
  contents match dry-run and repeated tarball hashes/integrity are identical;
- tar extraction and full artifact inventory/AST import and security inspection;
- offline, ignore-scripts local tarball installation;
- installed-package named ESM import, strict public consumer compilation using
  the existing positive/negative API type expectations, and strict compilation
  of every shipped declaration;
- `npm publish <local-tarball> --dry-run --json --ignore-scripts --tag local`.
  No remote publication occurred. Package stays private.

Inventory: **64 files** = 31 JS modules, 31 declarations, README.md and
package.json; 1,827,755 unpacked bytes, 355,076 tarball bytes. No reference/native/
oracle sources, fixtures/tests/tooling, node_modules, caches, Saivage state or
secrets in actual tarball. Static JS closure is entirely local, browser-resolvable
`.js` imports with all targets present. AST checks reject Node globals/APIs,
dynamic imports, eval/Function/WASM and network APIs outside the single public
Fetch acquisition site. No URLs/telemetry sites were found in emitted code;
Web Crypto is the only globalThis use (SQL randomness), not a Node dependency.

Final `jsqlite2-0.0.0-local-translated.tgz`:

- SHA256 `132e5994fd7bdb126b971d5bbde4ac37d117f507ccf6f4ff590498948a1e8750`
- npm SHA1 `f5d83a2b4c0983992fb4e5e5b20cdf82ab045273`
- integrity `sha512-ThEA3LKOVWbnd4hHRkm/uApQGga4Tkliusai2uhCGja6O8vkstdfB+5CHyuLm/gEAOnfmq8hH34C/FTFAuidpg==`

The extracted artifacts also execute in an isolated browser-global VM with no
Node globals, no real network, no dynamic code generation. Public open/prepare/
bind/step/reset/finalize/close runs across UTF-8, UTF-16le and UTF-16be existing
fixtures, retaining int64 BigInt, REAL, NULL, text and BLOB distinctions. Exactly
three explicit acquisitions occur; each URL request defaults credentials to
omit. The only runtime namespace exports are open and JSQLiteError.

## Limitations and handoff

This is a browser-global VM execution smoke, **not a GUI browser test** (no local
Chromium executable found). It establishes bounded packaging/type/import safety,
not all browser versions, all security properties or full SQLite compatibility.
No new native-oracle differential SQL or corpus coverage is claimed. The package
includes the workspace's current translated engine, including unchanged peer
runtime edits; no engine cleanup or peer edits/index changes were performed.
Independent review remains required. Build output is ignored/generated, not
committed; owned source/tool/config/test/docs are committed coherently.
