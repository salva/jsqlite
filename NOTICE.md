# JSQLite licensing

JSQLite's original code, documentation and website are licensed under the GNU
General Public License, version 3 or (at your option) any later version
(`GPL-3.0-or-later`), by owner direction on
2026-10-06. Copyright (C) 2026 Salvador Fandiño and JSQLite contributors.
See [LICENSE](LICENSE) for the complete terms. JSQLite is provided without any
warranty, including merchantability or fitness for a particular purpose.

This grant includes the JSQLite translation at the published alpha source
`1984a9a4581746f5fb12e66ae03fad3451bf45bc` (alpha.4) and
`a3eb29659c793f630a9bd1a9c2b89836bf9bbe52` (alpha.5); release tags remain unchanged
for reproducibility. The licensing notice does not change the alphas' tested runtime.
The GPL grant applies to JSQLite contributions, not to independently licensed
third-party material:

- SQLite's original source and tests are dedicated to the public domain:
  https://www.sqlite.org/copyright.html. Upstream attribution and source mappings
  are retained; JSQLite is an independent translation, not an official SQLite product.
- Chinook database fixtures retain their MIT license, including the copyright
  notice in [examples/browser/CHINOOK-LICENSE.md](examples/browser/CHINOOK-LICENSE.md).
- Development dependencies keep their own licenses and are not shipped as a
  hidden runtime query backend.

The public site's downloadable `source.tar.gz` provides the corresponding engine
source at the exact pinned alpha commit, plus the site/build sources at the
published site commit and these notices. General-purpose Node/npm/TypeScript/Git
and Python tooling is described in `site/README.md`; the lockfile pins the compiler.
