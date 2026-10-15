# Local alpha.6 package delivery and provenance

Alpha.6 supersedes the historical alpha.5 engine for local consumption only.
Alpha.5's public tag and assets remain unchanged. Runtime admission remains in
TRANSLATION.md and api.md; untranslated constructs remain debt under SPEC.

## Tested inputs and local acquisition

- Tested source: `a572862f74876f8c29a7ab4697cfb5e9fc842840`.
- Tree: `346a09c20bbfecf6fa0b7ea881d4fc7b9ba5cc53`.
- Tarball: `jsqlite2-0.0.0-alpha.6.tgz`, SHA256
  `66dfc717f6b490b347f67064afea59a076d3c7ac462bde29e702c543949019d8`;
  92 files: 45 runtime JS, 45 declarations, README and package metadata.
- Retained local handoff: `.saivage/work/cards/card-v-a/alpha-six-candidate/`
  beneath the project workspace; obtain the tarball and `local-alpha-manifest.json`
  from that directory. It is local work evidence, not a public download or a
  promise of continued file availability. If unavailable, request that exact
  handoff from the package owner; do not silently substitute another version.
- Durable [runner manifest](card-v-a-alpha-six/manifest.json) and
  [package gate](card-v-a-alpha-six/package-evidence.json) retain full inventory,
  commands, source and content hashes. `b566e75a` commits evidence only and is
  **not the tested packed source**; neither is this documentation correction.

The parent reports [[card:card-v-d]] d109 independent finite local acceptance of
this exact artifact, including installed browser/demo, current48 and separate gap2,
and the original query. This is attributed independent evidence, not a fresh
package-owner browser run or whole-engine acceptance. Browser guidance and its
separate evidence remain with [[card:card-v-c]]; no duplicate browser claim here.

The immutable tarball's packed README still names alpha.5 and pending checks.
That is a historical documentation/provenance limitation, not the current local
consumption contract. Preserve the tarball bytes; use the mutable root README
for acquisition and consumption. No rebuild, repack or alpha.7 is needed to
correct this guidance.

## Exact-source construction

The tested source above introduced this document, based on
`10f3d449bdad541646bf89e66d8ccdbb9229e055`. Only this new evidence document is
changed here; dirty runtime peers, README, PLAN and the index are not included.
The existing runner exports that explicit commit and overlays only package/lock
root version `0.0.0-alpha.6`. It does not publish. Existing private metadata,
named ESM exports, JS/declaration allowlist, dependency pin and runtime contracts
are retained. No compiler/evaluator algorithm change or upstream substitution is
needed to repair version-specific artifact provenance.

For a separate construction experiment only (not acquisition of the retained
accepted artifact), reproduce with a fresh purpose-named child:

```sh
python3 tools/package/local-alpha.py --commit a572862f74876f8c29a7ab4697cfb5e9fc842840 \
  --version 0.0.0-alpha.6 --name alpha-six-candidate
# In that exported source, with a distinct purpose-named card work root:
npm run test:package
```

The runner records commit/tree/archive, tracked input and controlled-overlay
hashes, actual tarball inventory/digest, independently installed consumer import
and strict public types, every command/exit and unexpected source drift. The
package gate adds repeated clean builds/packing, all declarations, actual-artifact
AST closure/security, browser-global VM execution and local publish **dry-run**.
The VM is not a GUI browser. No unchanged-input credit from alpha.5 substitutes
for these fresh checks. Detailed results and exact handoff identities are in
[[card:card-v-a]] status and the linked evidence JSON.

## Publication disposition

Immediate public alpha.6 publication is **WITHDRAWN/DEFERRED**, not completed.
The accepted local-only brief prohibits remote publishing; the earlier advisory
publication request was withdrawn. No current publication-authority blocker or
public-release task is inferred. Historical public alpha.5 stays unchanged.
No tag, release asset, npm publication, Pages/site or operator change is part of
this correction. Finite local acceptance does not certify beta, all browsers,
arbitrary SQL composition, performance bounds or the whole project.
