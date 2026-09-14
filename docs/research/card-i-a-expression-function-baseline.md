# Final research report — expression/function evidence baseline

Card: [[card:card-i-a]]

Assessment: **supported within the bounded research question**

Date: 2026-09-14

## Executive conclusion

The repository now has a sufficiently coherent, source-pinned, tests-first baseline for beginning the bounded expression and ordinary scalar-function implementation in [[card:card-i]]. The conclusion is supported by reproducible native SQLite 3.53.4 captures, exact upstream assertion provenance, independently labeled no-credit observations, fixture-aware public-API TS attempts, explicit implementation design, accounting validation, and clean milestone commits.

This is a readiness conclusion, not evidence promotion or a compatibility claim. All 40 selected upstream TS cases remain failing or temporarily unimplemented and receive zero credit. Native oracle success does not imply translated runtime support.

## Evidence

### Source identity and provenance

The evidence is pinned to SQLite 3.53.4 source ID:

`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`

The committed manifest identity remains unchanged. Exact source/setup anchors accompany the selected assertions. Generated `e_expr-4.1` is tied to its finite Tcl `foreach` template and exact selected bindings rather than accepted through a wildcard waiver.

The active milestone chain in this checkout is `0db1b11`, `459ca9f`, and current `97f189b`. Earlier workflow summaries named alternate hashes for equivalent milestone subjects, but those objects are not present in this checkout. Current identity was inspected directly: `work:///cards/card-i-a/processes/proc-5922569bcde3/stdout.log`.

### Canonical corpus

The executable corpus contains 40 exact upstream assertions and 12 explicitly no-credit companions, with exact native typed rows or phase-specific errors, decimal INTEGER values, IEEE-754 REAL bits, byte-preserving TEXT/BLOB values, ordered columns/origin metadata, operation lists, and native/TS credit separation.

Evidence materially covers literal storage classes, remainder and CAST behavior, equality/NULL forms, CASE, selected ordinary functions, and arity errors. Independent companions cover broader arithmetic and division/NULL behavior, overflow, unary and ordered comparisons, three-valued logic, lazy branch non-evaluation, projection and WHERE, CollSeq-sensitive scalar min/max/ties/NULL, embedded NUL, resolver failures, and duplicate/ordered output metadata.

### Encoding, limits, cancellation, and lifecycle

The no-credit native boundary harness records:

- UTF-8, UTF-16le, and UTF-16be databases;
- UTF-8, UTF-16le, and UTF-16be bound text for each database encoding;
- embedded-NUL behavior;
- `SQLITE_TOOBIG` code 18 under a 40-byte limit before oversized `replace` output;
- `SQLITE_INTERRUPT` code 9 during `sqlite3_step`, after post-prepare progress-handler installation;
- result destructor release after replacement by a primary function error, reset, and finalize;
- separately identified registration teardown at close.

The primary function error remains `primary boom`. Boundary validation was reproduced at `work:///cards/card-i-a/processes/proc-5922569bcde3/stdout.log`.

### Public TS gate

The TS runner opens each declared immutable fixture. Success requires exact ordered metadata and typed rows. Expected errors require exact phase, `kind: "sqlite"`, primary code, extended code, and message. Infrastructure and unexpected execution failures are distinct. Reassessment reported 40 declared/attempted, 0 passes, 40 failing/unimplemented, 0 unattempted, and zero credit.

### Consuming design

TRANSLATION, source map, and API preserve implementation through generated Lemon reduction consumers, discriminated expression nodes, SQLite-shaped resolver name/arity behavior, affinity and CollSeq propagation, lazy compiler control flow, VDBE expression/function opcodes, shared `Mem`/function context, first-error/cleanup rules, accounting, and SQLite-derived names/metadata.

No token-array reparsing, independent evaluator, `eval`, native substitution, public host registration, or excluded aggregate/window/date/math/JSON scope is introduced.

## Inference

The evidence supports proceeding to implementation because it supplies finite oracle targets, executable zero-credit failure lanes, source-shaped decisions, and explicit boundaries for behavior unavailable before implementation. Prior provenance, expected-error, cancellation-phase, and destructor-classification deficiencies are resolved at the research-evidence level.

This does not establish runtime compatibility or exhaustive ordinary-function research. It supports only the selected bounded tranche.

## Limitations and uncertainty

1. All 40 upstream TS cases remain unimplemented and zero credit.
2. Native evidence pins step-time interruption, not portable elapsed timeout or hard real-time behavior.
3. Native progress counts do not establish exact TS opcode/function/scan/copy/output-growth charges.
4. SQLite destructors return `void`; cleanup-error precedence cannot be a native oracle and needs behavioral TS tests once function context exists.
5. Backlog remains: `replace` integration beyond its limit oracle; LIKE/GLOB pattern, ESCAPE, BLOB, recursion/work policy; and remaining ordinary strings.
6. Aggregates/windows/date/math/JSON and host registration/collations remain excluded.
7. Previously identified first-SELECT parameter/value manifest drift remains a separate reconciliation item and is not expression/function evidence.

## Recommendations

1. Begin with generated-reduction AST consumers; never add token reparsing or a parallel evaluator.
2. Implement resolver name/arity behavior and the bounded internal registry before broadening functions.
3. Grow VDBE/control flow against the 40-case lane and companions; promote credit only after exact TS outcomes pass.
4. Add shared function context and behavioral ownership tests for replacement, reset, finalize, first-error preservation, and exactly-once cleanup.
5. Add injected TS deadline/abort and stable charging tests at resumable boundaries and within function loops.
6. Keep `replace` gated by output limits; defer LIKE/GLOB implementation until its policies are pinned.
7. Preserve source identity, native/TS credit separation, immutable fixtures, ordered metadata, and recapture checks.
8. Reconcile the separate first-SELECT manifest drift before using those companions as parameter-execution evidence.

## Final disposition

**Supported, bounded:** complete enough for the selected implementation tranche. This does not approve evidence promotion, establish project/parent completion, or claim SQLite expression/function compatibility.