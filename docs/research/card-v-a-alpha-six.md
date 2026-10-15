# Current-engine alpha.6 package candidate

This candidate supersedes the historical alpha.5 engine for **local package
validation only**. Alpha.5's public tag and assets remain unchanged. This is not
a claim of full SQLite compatibility, independent browser acceptance, or public
release completion. Current runtime admission is defined by TRANSLATION.md and
api.md; untranslated constructs remain debt under SPEC, not new exclusions.

## Exact-source construction

The candidate source is the commit introducing this document, based on
`10f3d449bdad541646bf89e66d8ccdbb9229e055`. Only this new evidence document is
changed here; dirty runtime peers, README, PLAN and the index are not included.
The existing runner exports that explicit commit and overlays only package/lock
root version `0.0.0-alpha.6`. It does not publish. Existing private metadata,
named ESM exports, JS/declaration allowlist, dependency pin and runtime contracts
are retained. No compiler/evaluator algorithm change or upstream substitution is
needed to repair version-specific artifact provenance.

Reproduce with a fresh purpose-named child:

```sh
python3 tools/package/local-alpha.py --commit <full-candidate-commit> \
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
[[card:card-v-a]] status; evidence JSON will accompany this document.

## Remaining delivery obligations

Remote inventory at diagnosis showed alpha.4 and alpha.5 tags, and only the
alpha.5 public release. Alpha.6 must be rechecked before any remote creation.
The accepted card brief prohibits remote publishing; advisory publication
instructions conflict with that boundary. No remote mutation is authorized by
this document. Planner reconciliation is needed before public release work.
Original [[card:card-v-c]] installed demo/browser work and [[card:card-v-d]]
independent finite public checks are separate later obligations, not performed
or certified by this package-owner evidence. Preserve historical assets and
non-additive test/skip boundaries; no npm publication or operator changes.
