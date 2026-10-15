# Public alpha.6

Owner-authorized publication: 2026-10-15. Experimental read-only TypeScript ESM,
not beta or full SQLite compatibility. Public alpha.5 remains immutable.

## Immutable identities and installation

- Version/tag: `0.0.0-alpha.6` / `v0.0.0-alpha.6`.
- Accepted source: `a572862f74876f8c29a7ab4697cfb5e9fc842840`;
  tree `346a09c20bbfecf6fa0b7ea881d4fc7b9ba5cc53`.
- Package: `jsqlite2-0.0.0-alpha.6.tgz`, SHA256
  `66dfc717f6b490b347f67064afea59a076d3c7ac462bde29e702c543949019d8`.
- Contents: 92 files, including 45 JavaScript modules and 45 declarations.
- [GitHub release](https://github.com/salva/jsqlite/releases/tag/v0.0.0-alpha.6),
  [playground](https://salva.github.io/jsqlite/).

Download the tarball from the release, verify its SHA256, then install locally:

```sh
npm install --ignore-scripts --no-audit --no-fund ./jsqlite2-0.0.0-alpha.6.tgz
```

No npm registry publication. The unchanged accepted package retains private
metadata and a historical README referring to earlier local alpha work; those
do not describe the current publication authorization. GPL-3.0-or-later LICENSE
and NOTICE.md accompany the unchanged package as separate release assets.
SQLite and Chinook attribution remains separate in NOTICE.md.

## Source reproduction and site

Use Node 24+, Python 3 and the pinned TypeScript dependency. At the exact tagged
source, `tools/package/local-alpha.py --commit <full-source-commit> --version
0.0.0-alpha.6 --name <fresh-name>` constructs a source-exported local package
under `$SAIVAGE_CARD_WORK_ROOT`; see its `--help` for the work-root requirement.
It never publishes. Packaging uses explicit source, not a dirty workspace.

On `public-site`, `python3 tools/package/build-site.py` builds the site using
that same pinned source. Browser modules are checked against the accepted
tarball before publication. Content-addressed app/worker/query assets and a
source-specific engine directory isolate prior cached versions. The public
watchdog remains 60 seconds. The site's `source.tar.gz` includes committed
engine and website/build sources plus licensing notices.

## Finite accepted evidence and changes since alpha.5

The accepted source includes read-relevant trigger/generated/STRICT schema
work, ordered filtered compound SELECT repair using shared VM merge machinery,
represented recursive CTE join/aggregate and JSON/metadata combinations, and
the private B-tree bounded bulk-copy repair. These are bounded translations,
not unrestricted support for every composition or optimizer strategy.

Prior independently accepted source integration: 348 files completed in two
ordered partitions, 6,039 passing cases and five existing skips; 1,629 companion
checks and 45 common typed/native comparisons. Counts overlap and are not a
compatibility percentage. They are source/input-bound evidence, not a fresh
whole-suite run performed for public upload.

Exact-package acceptance completed before publication: packaging runner 9,
package checks 13, guards 3; independently installed Chromium 148 current 48
cases and two separate gap probes; six demo groups; the original Chinook
aggregate query matched ten native typed rows across three executions/two
resets. Other browsers, arbitrary query combinations and universal latency or
heap guarantees are not certified. Public-site browser tests additionally
exercise compressed fixture transfer, the GitHub Pages base path, native-matching
Chinook rows, rendering, errors, cancellation/reuse and mobile layout.

Use the [tagged API contract](https://github.com/salva/jsqlite/blob/v0.0.0-alpha.6/docs/api.md)
for exact admission boundaries. Remaining deep correlated, recursive/derived,
module/JSON/metadata and RIGHT/FULL combinations may be unsupported. Later
uncommitted beta work is not included. Unsupported in-scope behavior remains
translation debt, not a permanent product exclusion. Runtime writes, WAL
recovery, native/WASM query backends and external extensions stay excluded.

Historical source documents saying publication was blocked/local-only describe
their earlier task scope. The owner subsequently authorized this external
publication; that changes no past acceptance evidence or engine bytes.
