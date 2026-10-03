# Pre-consolidation documentation evidence

This directory is historical evidence, **not current engineering guidance**.
The exact workspace documents were captured before [[card:card-u]] replacement,
at the HEAD recorded in [manifest.json](manifest.json). Each entry records its
original path, SHA-256, byte count and line count. Original headings, line numbers,
commands, hashes, conflicting proposals and correction reports are unchanged.
The capture is a workspace snapshot, not a claim that every statement was valid
at that HEAD; earlier revisions/checkpoints named inside each document retain
their own provenance. Git history and durable card records remain authoritative
for authored revision/acceptance identity.

- [TRANSLATION.md](TRANSLATION.md): full prior guide. The initial core, storage,
  parser, Mem and first-SELECT sections precede aggregate/subquery/CTE/window/
  function/WHERE tranches and later t/s corrections. In particular the former
  finite-materialization “avoids coroutine machinery” rationale around original
  lines 1738–1748 is historical, not an approved current platform limitation.
- [SQLITE_SOURCE_MAP.md](SQLITE_SOURCE_MAP.md): full prior upstream/TS/test map,
  including detailed inventories, exact runs and all historical mapping sections.
- [api.md](api.md): full prior public contract and appended refinements, including
  original empty-type/JSON-unavailable contradictions and their later corrections.
- [PLAN.md](PLAN.md), [root README](root-README.md): original baseline/first-SELECT status
  assertions preserved rather than erased from provenance.
- [oracle.md](oracle.md): original documented invocation, including the incorrect
  manifest-path argument to the source-ID self-check.

Current counterparts live two directories above and are the consuming entrypoints.
[Reconciliation evidence](../card-u-consolidation.md) explains verification,
limitations and the runnable replacement command. Existing research and
`record:///` status/review records are retained, not replaced by this archive.
No prior accepted outcome is revoked by preserving a contradicted historical claim.
