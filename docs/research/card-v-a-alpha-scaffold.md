# Private local alpha packaging scaffold — [[card:card-v-a]]

## Current delivery, not candidate certification

Owner's [updated sequence](../PLAN.md) (c7d5267) and
[proposed alpha criteria](card-v-private-alpha.md) require a PRIVATE LOCAL
versioned alpha, stabilizing the implemented core before residual breadth.
This scaffold reuses the accepted ESM/declaration compiler and private allowlist.
It does **not** certify alpha. STAT4 admission is routed through root/original
owners (gate c87ef40, native portability ab3beac). No engine repairs here.
Old tarball/browser/integration results remain provenance, not fresh acceptance.
No publication, public repository, external distribution or operator changes.

## Reproduction interface

From the repository, with `SAIVAGE_CARD_WORK_ROOT` set to a disposable card work
root, use an explicit full committed source identity:

```sh
python3 tools/package/local-alpha.py \
  --commit <40-hex-reviewed-stabilized-commit> \
  --version 0.0.0-alpha.1 --name alpha-candidate-one
python3 test/package-local-alpha.test.py
```

A name is an exclusive new child directory; choose a new name for reruns.
The version shape is intentionally `0.0.0-alpha.N`; private=true is required
and retained. This numbering is local and carries no acceptance guarantee.
`--offline` optionally restricts lockfile installation to the scoped existing
npm cache. With no offline flag npm may retrieve lockfile-pinned development
dependencies; it never publishes. Python 3.12+, Git, Node 24/npm11 and access to
the pinned TS dependency are build-tool requirements, not runtime dependencies.

`local-alpha.py` exports **only git archive of the explicit commit** into the
purpose-named work child. It does not checkout/reset, read staged engine inputs,
copy ignored native binaries, borrow node_modules, or build the main dirty tree.
It rejects moving refs, non-alpha versions, unsafe output names and archive path/
symlink escapes. It records full commit/tree, source archive SHA256, every tracked
file's SHA256, source pin, CURRENT fixture generation and its content inventory.
Only package.json and package-lock.json root versions are changed in the export;
both hashes and the overlay description are recorded. All other tracked inputs
are checked for drift after build/pack/consumer verification. This is explicit
controlled packaging metadata, not an engine overlay or accidental dirty closure.

The exported source installs its own lockfile dependency, builds and packs its
own existing scripts. Artifact entries are checked against the private dist JS/
declaration/mandatory metadata+README boundary. Actual tarball SHA256, integrity,
bytes and full extracted content hashes go into `local-alpha-manifest.json`.
An independent consumer directory installs the tarball offline with scripts
disabled, checks named exports, and strictly typechecks existing positive and
negative public API expectations against installed declarations. Every command,
exit, stdout/stderr path and digest is retained; failure is not certification.
Manifest always says `scaffold-only-not-certified` and lists pending gates.

## Executed scaffold evidence

Fresh scaffold source (not a stabilized or approved alpha candidate):

- commit `ab3beac0ae4c6ae012a05403255e7beb20c591e9`
- tree `0eea9ff2b01f179eb107d86322648e6b5632f1d6`
- package overlay `0.0.0-alpha.1`, private=true
- actual tarball SHA256 `725e373f7679bc804aba83cc4026e6852de316d785a33db3e76ae98a9e8e6693`

Commands actually executed twice:

```sh
python3 tools/package/local-alpha.py --commit ab3beac0ae4c6ae012a05403255e7beb20c591e9 --version 0.0.0-alpha.1 --name alpha-scaffold-ab3beac
python3 test/package-local-alpha.test.py
python3 tools/package/local-alpha.py --commit ab3beac0ae4c6ae012a05403255e7beb20c591e9 --version 0.0.0-alpha.1 --name alpha-scaffold-ab3beac-repeat
```

Both builds/pack/install/types passed. Three argument rejection tests pass.
Repeated artifact metadata/content hashes, tracked inputs and fixture inventory
were equal; unexpected input drift empty. Exact manifests:
[first](card-v-a-alpha-scaffold/manifest.json), SHA256
`2625f7462106e960c00d53e4f5eefb069a7b734a33aaa1028d6c10c4cde7a09b`;
[repeat](card-v-a-alpha-scaffold/repeat-manifest.json), SHA256
`509cb40963917896ae04a6cdaf0f403bcc743986ee7a2220d0beb1c59e85e4bf`.
First-run command streams are retained beside the manifest. These identities
cannot be relabeled as a later candidate. The manifest records tool hash as
well as source hash; the scaffold source baseline need not contain the runner.

## Coordination / pending exact candidate recapture

[[card:card-v-d]]: continue core stabilization using w's retained harness; do not
wait for or reactivate w. Once original semantic owners' repairs are reviewed and
committed, supply the **full reviewed candidate commit/tree** and current finite
acceptance evidence. No current scaffold commit is claimed reviewed/stabilized.
Run this interface afresh against that identity, attaching reference archive and
extracted-source inventory hashes, native library/profile hashes and sqliteSourceId,
CURRENT fixture identity and fresh integration results. The native/reference
manifest slots are expressly pending, never filled with guessed historical data.
No skipped wrong rows/errors or inflated watchdogs constitute acceptance.

[[card:card-v-c]]: consume the actual candidate artifact identified by its manifest,
not workspace dist. Capture demo inputs/fixture hashes and real browser HTTP Fetch
against the installed/extracted candidate; coordinate artifact digest with d.
Current versioned scaffold has installed-package imports/types evidence, but
**real-browser Fetch and demo validation have not run on it**. Earlier browser
results are not transferred to alpha. d independently verifies the final artifact
with retained harness and browser/types evidence; final source+artifact recapture
and independent review are pending after semantic repair. All artifacts remain
private local. These are actionable interfaces, not a circular dependency on w.
