# JSQLite2 Product Specification

Status: owner-directed, API-first TypeScript translation specification.

Version: 0.3.0-draft.

## Product Goal

`jsqlite2` is primarily a translation of SQLite's read-only C implementation into TypeScript, distributed as browser-safe JavaScript for browser and Fetch-compatible runtimes. It opens immutable SQLite main database files from URLs and answers read-only SQL with SQLite-compatible results, metadata, typing, collation, error behavior, and file-format handling.

The project goal is broad SQLite compatibility for read-only use, not a small SQL subset. The target is approximately 99% of SQLite read-only SQL behavior that can run without writes, host extensions, external virtual table modules, native code, or SQLite's CLI/test shell. Valid read-only SQLite queries should be expected to work unless they depend on a permanent exclusion in this spec.

This is not a newly designed database engine with SQLite-like syntax. Translate upstream structures, algorithms, control flow, and read-only semantics, including parser, planner, and VDBE machinery where required. Use upstream documentation and reference behavior to check the translation, not as a substitute for reading the implementation. Adapt memory ownership, data representation, asynchronous I/O, and environment boundaries idiomatically to TypeScript; mechanical pointer emulation is not required. Cite upstream files/routines for meaningful translated parts and briefly explain necessary deviations.

`docs/TRANSLATION.md` is living project-owned engineering guidance subordinate
to this specification. Its initial mappings are proposed technical defaults,
not additional owner requirements. The project may refine technical designs and
applicable API contracts with source/test evidence while maintaining a coherent
current contract and unchanged product scope. Owner product boundaries cannot
be changed by revising the guide. Read-only main-file access does not prohibit
private mutable working state required by in-scope queries.

The approximately 99% target is an aspiration, not an automatic acceptance percentage. Numerical compatibility claims require an explicitly defined denominator, executed evidence, and disclosed exclusions and remaining gaps.

## Source Baseline And Sequence

Use the latest stable official SQLite release, pinned reproducibly rather than floating on trunk or a prerelease. As verified on 2026-09-12, the selected baseline is SQLite 3.53.4, released 2026-07-24. `reference/sqlite/manifest.json` owns its exact source archive URL, hashes, source ID, size, and retrieval metadata. Source, upstream tests, and the native development oracle must use this same selected baseline.

Recheck the official latest stable release at meaningful development/release milestones. Deliberately update the reference, translated source/test mappings, and oracle together when adopting a newer version; do not silently float builds or recheck the network on every invocation.

Required order: first define the C-mapped TypeScript public API; second establish the translated-test harness and a meaningful first upstream-test tranche; then progressively translate implementation with the relevant tests ahead of each slice. Translating the entire upstream suite is not a prerequisite for beginning implementation. `docs/PLAN.md` owns the staged roadmap.

Required source workflow:

- Keep the verified official full source-and-test archive under `reference/sqlite/`, outside the runtime package.
- Author `docs/SQLITE_SOURCE_MAP.md` progressively when mapping work, referencing the pinned manifest; keep source/test mapping focused on the work being translated, not an exhaustive preimplementation signoff exercise.
- Map SQLite read-only subsystems to jsqlite TypeScript modules before implementing the corresponding runtime work.
- Translate SQLite C internals into maintainable TypeScript. Do not ship native C, embedded SQLite, or WebAssembly as the runtime implementation. Compiling and running native SQLite is allowed in development-only oracle, fixture-generation, and test tooling; it must never service runtime queries as a hidden backend.
- For every ported feature, add conformance tests that compare jsqlite against upstream SQLite.

Required test workflow:

- Treat SQLite's own test collection as the compatibility backlog.
- Translate read-only-relevant upstream Tcl/C/SQL tests into JS/TS tests or faithful differential cases, preserving identifiable upstream assertions, expected results, and case IDs. Adapt harness mechanics rather than rewriting expectations to match the implementation.
- Keep a coverage map from upstream SQLite test files/cases to jsqlite conformance suites.
- Prefer differential tests that run the same database setup and read-only SQL against upstream SQLite and jsqlite, then compare rows, column metadata, storage classes, and expected errors.
- When upstream tests contain writes only as fixture setup, run those writes in the reference/fixture-generation layer, then execute the read-only assertions through jsqlite.
- A feature is not complete because it works for hand-picked examples; it is complete when relevant upstream SQLite tests or faithful JS/TS ports pass.
- Keep unported and unsupported cases visible as backlog, not passing compatibility credit. Start with a meaningful bounded test tranche and expand alongside subsystem translation; do not require the entire corpus to be translated before coding.
- Tests of permanent exclusions or upstream harness-only behavior may be classified as such without implementing excluded runtime capabilities. This does not excuse untranslated in-scope behavior or require classifying the whole corpus upfront.

## Compatibility Contract

SQLite behavior is authoritative for all read-only features in scope:

- SQL grammar and parse errors.
- `SELECT`, `WITH`, joins, subqueries, compound queries, `VALUES`, aggregates, windows, views, expression handling, ordering, grouping, limits, and result-column naming.
- Storage classes, manifest typing, affinity, casts, numeric conversion, integer overflow, null and three-valued logic.
- Built-in collations and built-in scalar, aggregate, window, date/time, math, and JSON functions that are part of ordinary SQLite builds.
- SQLite database file format 3 reading, including schema, b-trees, records, overflow, indexes, rowid tables, and read-only-relevant schema objects.
- Error behavior where observable through SQL execution or file opening.

Any divergence from SQLite inside read-only scope is a bug unless this spec explicitly lists the behavior as a permanent exclusion.

## Permanent Exclusions

These are product boundaries, not staged deferrals:

- No write capability: no mutating SQL execution, transactions, savepoints, database rewriting, WAL checkpointing, vacuuming, or schema changes through jsqlite.
- No C, native code, WebAssembly, Emscripten, `sql.js`, `wa-sqlite`, or embedded SQLite binary in the runtime.
- No externally loaded extensions or host-registered callbacks: loadable extensions, user-defined SQL functions, user-defined collations, authorizers, progress handlers, and application-defined virtual table modules are outside the public API.
- No SQLite CLI, shell dot-command, Tcl test harness, server, network protocol, or `sql.js` API compatibility.
- No WAL/journal recovery or sidecar-file application in the browser runtime. jsqlite reads immutable main database files; publishers are responsible for serving clean snapshots.

Read-only queries may inspect schema objects and query views when their behavior is implemented. Internal implementation may emulate SQLite machinery, including virtual-table-like internals, when needed for compatibility, but jsqlite must not expose extension registration.

## Input Database Contract

The runtime opens one immutable SQLite main database file from a URL or browser-supported URL-like source. Files are untrusted input.

Expected file baseline:

- SQLite database file format 3 with header magic `SQLite format 3\0`.
- Page sizes 512 through 65536 bytes, including SQLite's 65536 page-size encoding.
- Reserved bytes per page `0`.
- UTF-8, UTF-16le, and UTF-16be database text encodings, decoded according to the format-3 header.
- Clean main database snapshot with no required WAL or rollback-journal recovery.

Malformed files, impossible page structures, unsupported storage states, and features requiring host extension callbacks fail with typed errors rather than partial or approximate operation.

## API-First TypeScript Contract

Before implementing the engine, design and document the read-only-relevant equivalent of SQLite's C API as idiomatic TypeScript, exported through named ESM APIs. Deliver `docs/api.md`, public type declarations or minimal nonfunctional scaffolding, examples, and API-test expectations. This specification sets requirements, not final method signatures.

- Map connection open/close, statement prepare/step/finalize/reset, parameter binding and clearing, column values/storage classes/metadata, observable result codes, and applicable limits to the corresponding SQLite C routines.
- Define connection and prepared-statement handles, valid lifecycle transitions, reset/binding retention semantics, cleanup, and use-after-finalize/close behavior from upstream evidence.
- Define asynchronous URL/file acquisition and execution boundaries without forcing unnecessary promises on purely local accessors. Preserve Fetch options, cancellation, timeout, and resource-limit controls.
- Define exact integer handling using `bigint` where needed, real-number handling, SQL NULL as `null`, text as strings, and blobs as `Uint8Array`, including copy/lifetime rules and conversion semantics. Do not silently lose 64-bit integer precision.
- Preserve column order, duplicate result names, storage-class observations, and SQLite's metadata availability rules. Ordered rows/column access must remain possible; object-row convenience APIs cannot be the sole representation.
- Expose SQLite primary and extended result-code meaning through deliberately designed JS/TS results and typed errors. Separate row/done control outcomes from failures.
- Optional query convenience helpers must build on the C-mapped core; they do not replace prepared statements or justify a separate query engine.

Only C APIs relevant to the established read-only product scope are required. This does not add mutation, transaction/savepoint control, extension registration, host callbacks, native pointer APIs, or WASM. Refine the API when translation/test evidence warrants it, updating the singular contract, callers, and tests together rather than preserving competing wrappers.

## Error Model

The API design must map SQLite-observable failures to typed JS/TS errors with primary/extended SQLite codes where applicable, preserving the relevant error semantics instead of replacing them with an unrelated fixed taxonomy. URL transport/CORS failures and JS-specific misuse or cancellation need explicit, distinguishable representation; do not invent SQLite SQL failures for transport errors.

Document typed failure behavior for detected malformed storage, configured resource-limit failures, invalid SQL/binding, closed/finalized handles, cancellation, timeout, and impossible internal states. This is not a promise to survive host out-of-memory termination or catch every allocation failure. Permanent exclusions and temporarily untranslated behavior must fail explicitly and remain distinguishable from supported behavior. Temporary unsupported cases are implementation gaps, not a narrower product definition.

## Security And Runtime Requirements

- Database files and SQL strings are untrusted input.
- Browser runtime code must not depend on Node-only APIs such as `fs`, `path`, `Buffer`, or `process`.
- No `eval`, `Function`, dynamic user-supplied imports, analytics, or telemetry.
- No credentialed fetch by default; callers control `fetchOptions`.
- Parser recursion, expression depth, page traversal, b-tree traversal, overflow chains, and query loops must be bounded.
- Query execution must honor `AbortSignal`, `timeoutMs`, and configured row/file/work limits between bounded work chunks.

## Implementation Strategy

Implementation is iterative but the destination is broad read-only SQLite, not a deliberately small SQL dialect.

Follow the staged API-first, test-harness-first, incremental-translation plan in `docs/PLAN.md`. Translate file/header/page/record/b-tree reading, schema, tokenizer/parser, values/affinity/collations/functions, name resolution, planner/VDBE, and read-only SQL execution in dependency-informed vertical slices. Keep relevant upstream tests ahead of each slice and expand them as behavior becomes available.

Do not substitute a handwritten AST engine merely because it is easier to start. Architecture and algorithms should remain recognizably derived from upstream SQLite; deviations require a concrete TypeScript/browser adaptation reason and behavioral tests. This is semantic translation, not compulsory line-for-line C syntax or pointer emulation.

## Validation Requirements

SQLite conformance is a release requirement.

Required validation layers:

- Source/test map documenting which SQLite files and test suites inform each jsqlite subsystem.
- Differential SQL tests against an official upstream SQLite CLI or library pinned by the reference manifest, with relevant build options recorded. The oracle profile must align with the specified math, JSON, and column-metadata scope rather than silently narrowing it to convenient build defaults.
- JS/TS ports of read-only-relevant SQLite test cases.
- SQLite-created database fixtures covering realistic schemas, indexes, overflow payloads, record serial types, page sizes, and corruption cases.
- A small demo app with a simple SQLite database fixture, visible queries, and expected results so developers can manually verify the browser build quickly.
- Browser E2E tests that fetch actual SQLite files and run representative read-only queries.
- Type tests for public API declarations.
- Resource and malicious-input tests demonstrating typed failures for detected malformed input and configured limits, rather than hangs or raw exceptions; host termination is not a recoverability guarantee.

Acceptance for the rebooted project is measured by upstream compatibility coverage, not by a small fixed query list. Each implemented feature must be pinned by upstream SQLite behavior before it is treated as complete.

## Documentation Requirements

Author implementation documents when the corresponding stage warrants them;
their filenames below are future deliverables, not required empty placeholders.

- `README.md`: project goal, quick start, read-only/no-C/no-WASM boundaries, and current compatibility status.
- `docs/SPEC.md`: this product contract.
- `docs/PLAN.md`: source/test-driven implementation plan.
- `docs/SQLITE_SOURCE_MAP.md`: upstream SQLite source and test mapping.
- `docs/TRANSLATION.md`: living project-owned translation design and progressive structural guidance.
- `docs/api.md`: public API reference.
- `docs/file-format.md`: SQLite file-format reading notes as ported.
- `docs/sql-compatibility.md`: compatibility matrix generated from upstream test coverage.
