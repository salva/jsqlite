# JSQLite2

A fresh TypeScript translation of SQLite's read-only C implementation and tests
for browsers and Fetch-compatible runtimes. The runtime must not embed
C, native SQLite, or WebAssembly.

The complete product contract is [docs/SPEC.md](docs/SPEC.md); the owner-directed
[roadmap](docs/PLAN.md) starts with a JS/TS-friendly C-equivalent API, then an
upstream-test harness and first test tranche, followed by progressive translation
with tests ahead of each slice. This is an input-only baseline: no API scaffold,
engine, test pipeline, or compatibility evidence is present. No stage is claimed
complete. Native SQLite is permitted only for development oracles and fixture
generation, never as the runtime backend.

[docs/TRANSLATION.md](docs/TRANSLATION.md) is living project-owned engineering
guidance: its proposed mappings can be refined through source/test evidence.
`docs/api.md`, `docs/SQLITE_SOURCE_MAP.md`, `docs/oracle.md`, and
`docs/CONFORMANCE.md` are future deliverables, authored when their stage warrants
them, not missing prerequisites to read now. Technical choices remain provisional.

The official SQLite 3.53.4 full source/test archive, latest stable as checked on
2026-09-12, is available locally under
`reference/sqlite/`. Its tracked [manifest](reference/sqlite/manifest.json)
records the upstream download URL, checksums, size, and public-domain license.
The archive itself is ignored by Git and can be downloaded again from that URL
and verified against the manifest.
The reference is pinned; later stable releases are adopted deliberately at
meaningful milestones with source, tests, and oracle updated together.
