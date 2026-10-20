# Local build snapshot boundary

`npm run build` and ordinary npm `prepack` both invoke `build.mjs`. The build
always removes `dist` first. Repeated compilation can reuse a verified,
content-addressed normalized output snapshot in ignored `build/package-cache/`.
Sources (including added/removed files), root tsconfig files, package/lock data,
build implementation and the installed TypeScript compiler distribution are
hashed, not timestamped. Damaged/missing snapshots fall back to compilation;
compiler failure removes partial output and never publishes a snapshot.
The snapshot inventory is checked before restoration, and restored files are
copied, not linked. This is a trusted local development cache, not an integrity
boundary against an attacker who can rewrite both its inventory and data.
Deleting `build/package-cache` forces cold compilation. Build calls on one
checkout remain serial, as before; concurrent writers to `dist` are unsupported.

No npm lifecycle is disabled, no runtime dependency is added, and no SQL
algorithm or public API changes. Actual tarball closure, declarations, browser
VM, installed imports/types and repeated-pack checks remain in
`test/package-distributable.test.mjs`. Cached builds alone do not certify a
package. Cache controls are independently exercised with the real pinned compiler
by `SAIVAGE_CARD_WORK_ROOT=<own disposable child> node test/package-build-controls.test.mjs`:
stale/damaged dist, corrupt snapshot, added/removed/changed source, changed
config/build/lock, failed compile cleanup and independent cold output equality.

Revision-specific package timing, attempts, identities and acceptance limitations
are recorded in [[card:card-v-a]] status. This optimization addresses repeated
full compilation under the unchanged package watchdog, not SQLite compatibility
or release approval. The existing guide's local distributable boundary remains
applicable; detailed controls live here to avoid mixing build-cache policy into
SQL translation contracts.
