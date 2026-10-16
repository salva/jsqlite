# Public alpha.7

Experimental prerelease, not beta or full SQLite compatibility. No npm publication.

- Source: `57b498caac4e337172eb07ccfa9812ef338d5fd7`.
- Tree: `db1443ec2f1517ce12d99fa1155ef57b16c766c4`.
- Tag: `v0.0.0-alpha.7`.
- Package SHA256: `0e1da3bf5ccb385e182e37429cc8aa3ed7301aca6bf876cd14079d114d07a0fd`.
- Package: 530038 bytes, 96 members, 47 JavaScript modules plus declarations.
- Development source/oracle pin: SQLite 3.53.4; not a latest-upstream claim.

## Known wrong-result limitation

Metadata-table aggregation is not reliable in this immutable release. For example,
`SELECT name,count(*) FROM pragma_table_info('t') GROUP BY name ORDER BY name`
can return source `cid/name` payloads instead of the requested grouped names and
counts. The observed reproduction affects UTF-8, UTF-16le and UTF-16be. Matching
column metadata does not establish correct row values. Do not use metadata-table
aggregation in alpha.7; ongoing development fixes are not included in these bytes.

The selected candidate's earlier integration run passed 7033 tests, failed none
and skipped five, across 337 file executions. Installed Chromium checks and
native-backed finite comparisons also passed. Those are bounded evidence, not
proof against this subsequently discovered issue or all query compositions.

## Release and demos

- [GitHub prerelease](https://github.com/salva/jsqlite/releases/tag/v0.0.0-alpha.7)
- [Package](https://github.com/salva/jsqlite/releases/download/v0.0.0-alpha.7/jsqlite2-0.0.0-alpha.7.tgz)
- [Playground](https://salva.github.io/jsqlite/)
- [Versioned installed demo](https://salva.github.io/jsqlite/alpha/0.0.0-alpha.7/examples/browser/)

Install the downloaded tarball locally; for an unbundled browser, serve its entire
`dist/` tree and import `dist/index.js`. All active playground modules come from
the accepted package, not from current development source. The site builder checks
the tarball hash before extraction; the demo wrapper retains a 60-second watchdog.
Versioned demo files are the accepted 104-file handoff. Existing alpha.6
content-addressed assets remain served for cached workers and imports. Previous
release assets and tags are not replaced.

Build this branch with `python3 tools/package/build-site.py`, then run
`JSQLITE_PLAYWRIGHT=<playwright/index.mjs> node test/browser/public-site.test.mjs`.
The existing Pages workflow executes this check before deployment. A successful
workflow alone does not prove live visibility; verify public HTTP statuses,
package/module hashes and actual browser execution separately after deployment.

The public repository's GPL-3.0-or-later license and third-party notices remain
applicable; SQLite and Chinook notices retain their separate ownership. The
corresponding source download contains the pinned engine and website sources.
