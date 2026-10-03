# JSQLite2 Agent Instructions

`docs/SPEC.md` is the product authority: translate SQLite's read-only C internals
into browser-safe TypeScript, without native SQLite or
WebAssembly in the runtime. Preserve the complete scope, including UTF-8,
UTF-16le, and UTF-16be database text encodings.

Follow the owner-directed stages in `docs/PLAN.md`: C-mapped TypeScript API first,
translated upstream-test harness and a first meaningful test tranche second,
then progressive tests-before-implementation translation slices. The project
Planner owns concrete decomposition, plan updates, and `docs/SQLITE_SOURCE_MAP.md`
as work warrants it, using the pinned official source/test reference in
`reference/sqlite/manifest.json`. The source map and API/oracle/conformance
documents are future deliverables, not required files to read before they exist.
No previous project's plan, implementation, coverage claims, or acceptance
evidence is inherited.

Translate upstream structures and algorithms rather than inventing a SQLite-like
engine. Native SQLite is allowed only as a development oracle/fixture tool.
Map each subsystem before its implementation, add faithful
differential/conformance tests, and record exact
commands, outcomes, and remaining gaps. Do not invent corpus-wide research or
approval gates before bounded implementation work. Claims of compatibility must
follow demonstrated evidence, not estimates or unexecuted tests.

`docs/TRANSLATION.md` is the living project-owned translation design entrypoint
under SPEC, initially seeded with proposed mappings and source-backed notes.
Before decomposing, implementing or reviewing a relevant slice, read its core
and needed sections and consult the mapped upstream source. Refine technical
choices autonomously as evidence develops, keeping guide, source map, applicable
API contracts, examples and tests coherent within the assigned work. Keep the guide's
current contracts, decisions, source rationale and relevant limitations concise;
replace or consolidate superseded current assertions rather than append competing
accounts. Keep detailed revision/test inventories, hashes, commands and results in
existing card records or research/evidence documents, linked from relevant guidance;
preserve provenance rather than delete history merely to shorten documents. Keep the
source map a navigable current upstream-to-TS/test mapping with evidence links, not
an execution diary. Decide needed representations before
their consuming implementation, not every structure before engine work. Re-read
relevant current sections when changed or contradicted by context, not every turn.

Keep credentials and Saivage-generated state out of Git. Commit coherent,
validated project work; do not change the operator-owned deployment or model
routing as part of product development.

Stable prompt fragments supply generic role obligations and document pointers,
not fixed technical mappings. Ordinary guide/source-map/technical-contract edits
use project tools and require no service restart or operator approval. Product
boundaries remain owner-controlled. Do not edit deployment prompts, routing or
services as engine work; operator refresh is needed only if the static prompt
wiring or generic responsibilities themselves change, not when design docs evolve.
