# JSQLite2 Translation Roadmap

Status: owner-directed initial sequence; the project Planner owns concrete
decomposition and evidence-based updates. [SPEC.md](SPEC.md) is the product
contract. This plan does not authorize expanding its read-only exclusions.
This is an input-only roadmap; no implementation stage is complete. The root
Planner directs goals and sequencing, not an exhaustive leaf-task inventory.

## Stage 0: Pin And Orient

Use the verified latest-stable SQLite 3.53.4 full source/test archive selected by
the [reference manifest](../reference/sqlite/manifest.json). Verify the pin and
extract it into a non-runtime reference directory. Begin a small
`docs/SQLITE_SOURCE_MAP.md` linking the API and first subsystem work to upstream
files/routines and tests. Do not make exhaustive corpus classification or a large
approval matrix a prerequisite for the next stage.

Exit: reproducible source identity, usable upstream source/tests, and enough
source orientation to design the public API.

## Stage 1: C-Mapped TypeScript API

First define the read-only SQLite C API equivalent in JS/TS-friendly form.
Document connection and statement handles, open/close, prepare/step/finalize/reset,
binding/clearing, column access and metadata, storage classes, result/error codes,
limits, async acquisition/execution, cancellation, and value ownership. Preserve
64-bit integers, NULL, blobs, ordered columns, and lifecycle semantics. Query
convenience helpers are optional and subordinate to this core.

Exit: `docs/api.md`, TypeScript public declarations or minimal nonfunctional
scaffolding, representative usage examples, and API/type-test expectations
mapped to relevant upstream C routines. No database engine implementation is
needed to finish this stage. Resolve the main contract choices before proceeding;
later evidence may refine the API with matching caller/test updates.
Use the bounded Stage 1 design questions in [TRANSLATION.md](TRANSLATION.md).
Choose internal representations before their actual first consumer needs them,
not every engine structure before any implementation.

## Stage 2: Upstream Tests Before Engine Code

Establish a development-only native SQLite oracle pinned to the same source ID,
fixture generation, and JS/TS test-harness adapters for relevant upstream
Tcl/C/SQL assertions. Native compilation and fixture writes are allowed here,
never as a backend for the shipped runtime.
Document this future oracle in `docs/oracle.md` and actual test evidence in
`docs/CONFORMANCE.md`. Its build profile must record relevant options and support
the specified scope, including math, JSON, and required column metadata; a
convenient default native build must not silently narrow compatibility.

Translate a meaningful first tranche of upstream tests covering the API lifecycle,
binding/value/metadata expectations, and representative file/read-only behavior.
Preserve case IDs, assertion meaning, setup, and expected outcomes. Use the native
oracle to verify the harness and fixtures, including representative UTF-8,
UTF-16le, and UTF-16be databases. Record truthful failing/unimplemented TS cases;
mock success and rewritten expectations are not conformance evidence.

Exit: reproducible oracle identity/build instructions, executable JS/TS harness,
first faithful test tranche, verified reference outcomes, and an explicit
remaining backlog. Do not wait for the whole SQLite suite to be translated.

## Stage 3: Progressive Translation Slices

For each bounded slice: identify upstream routines and dependencies, translate
its relevant tests first, translate the corresponding C structures/algorithms
into TypeScript, and make those tests pass against actual TS execution. Record
exact commands/results and short reasons for necessary language adaptations.
Each child brief should name relevant guide sections and upstream routines, with
needed representation decisions made before their consuming implementation.

Start with source-informed file/storage and schema foundations, then expand
tokenizer/parser, values and expression semantics, name resolution, planner/VDBE,
and SQL breadth in dependency order. A slice may introduce internal scaffolding,
but do not replace upstream algorithms with a new SQLite-like engine or require
unrelated corpus work before delivering bounded tested behavior.

Exit per slice: actual translated implementation, faithful passing tests,
source/test map updates, and explicit unsupported cases. Expand the upstream-test
ports continuously alongside the code; a narrow green slice is not whole-project
acceptance.

## Stage 4: Expand And Validate

Grow coverage toward the complete read-only scope: joins, subqueries, compounds,
CTEs, aggregates, windows, views, functions, collations, index-aware behavior,
error cases, and malformed/resource-limited inputs. Keep regression tests and
browser E2E running through real Fetch-loaded databases. Deliver browser-safe
ESM packaging, public type tests, the small demo, and the remaining specification
documentation as functionality becomes real.

Exit: demonstrated broad read-only coverage, truthful known gaps/exclusions, and
reproducible conformance/browser evidence. Define a denominator whenever claiming
a numerical compatibility percentage; the approximately 99% aspiration is not a
numerical acceptance gate and does not justify invented completion.

At meaningful milestones, recheck the official stable release. Adopt any new
baseline deliberately with source, tests, and oracle updated together, not through
silent floating downloads. Keep stages practical: API first, an initial test
pipeline second, then repeated tests-before-translation cycles.
