# SQLite-to-TypeScript Translation Guide

## Authority and use

Status: seed design for project refinement, not approved immutable requirements.
`docs/SPEC.md` owns owner product semantics and scope. This is the living
project-owned translation design entrypoint. `docs/PLAN.md` owns sequencing.
When authored in their appropriate stages, project documents own their named
surfaces. `docs/api.md` now owns the singular Stage 1 public API and
`docs/SQLITE_SOURCE_MAP.md` is the project-editable progressive source/test index.
Stage 1 is complete only as a NONFUNCTIONAL contract stage; there is no runtime
engine or Stage 2 conformance evidence.

Source-backed facts below describe the selected upstream implementation. Proposed
TS defaults, examples and open questions are local engineering choices: the
project may revise them and applicable API contracts coherently with source/test
evidence, preserving owner scope. Imperative engineering wording describes the
seed's recommended approach, not additional owner mandates. No specific internal
class model or mapping is approved merely by installing this document.

Read the core and relevant notes at the next relevant planning/implementation/
review decision, not every turn. If this file changed or quoted context conflicts,
read the relevant current section using ordinary tools. Update this guide, mappings,
examples and affected contracts/tests together with a concise rationale/source
citation where useful; no decision ledger or universal verification pass is needed.
Ordinary technical edits need no operator approval, prompt edit or service restart.
Owner product boundaries still require owner authorization to change. The pinned
upstream archive is reference evidence, not content to rewrite to fit the design.

Use SQLite 3.53.4 from `reference/sqlite/manifest.json`, the single authority for
the selected archive, source ID, hashes, and retrieval metadata.
References below are paths/symbols in that archive; line numbers are orientation
for this pin, not a second source registry. The extracted development cache is
convenience only. Do not use previous JSQLite implementation or acceptance claims.

## Core: source facts and proposed engineering defaults

### Translate semantics, not C allocation syntax

Translate upstream structures, algorithms and control flow rather than designing
a SQLite-like engine. JS objects, arrays and typed byte buffers may replace C
layouts where meaning is preserved. No general C heap/pointer emulator is required.
No native SQLite, C or WASM in the browser runtime; native development oracles
and fixture producers are separate and may perform fixture-setup writes.

Main database input remains immutable and read-only under SPEC. Removing main-file
writes, journaling and host extension APIs does **not** remove SELECT's mutable
private working state: ephemeral b-trees, sorters, automatic indexes, aggregate
state and temporary records can be necessary. Shared internal objects need not be
copied simply because public handles have single-owner JS-agent semantics.
Do not translate irrelevant fields merely to reproduce every upstream struct.
Justify omissions by the actual read-only call paths, not a field's name alone.

### Numbers and semantic state

Proposed public/internal default: SQL signed 64-bit INTEGER and
rowid use `bigint`; REAL uses IEEE-754 `number`.
An integral-valued REAL is still REAL: never infer storage class with
`Number.isInteger`. `SqliteValue = null | bigint | number | string | Uint8Array` is the public
boundary union selected in Stage 1; REAL remains distinguishable from INTEGER by
JS type even when integral-valued.
Keep bounded offsets, page numbers and register indexes as numbers only where
their range and intermediate arithmetic are exact; document the relevant bound.
Do not truncate 64-bit masks through JS's 32-bit bitwise operators.

Translate overflow, shifts, coercion and affinity per operation. Addition's
overflow-to-REAL, casts, integer division, and bit operations are not one universal
wrap rule. `BigInt.asIntN(64, ...)` is appropriate only when the source operation
calls for that behavior. Follow `vdbe.c`, `vdbemem.c`, `util.c` and their callers.
`sqlite3VdbeMemSetDouble` (`vdbemem.c:1092`) turns NaN into NULL, not all nonfinite
numbers: infinities remain REAL. Do not normalize both away in an oracle adapter.

Mem may cache simultaneous representations. Preserve needed `MEM_IntReal`, text
encoding, subtype, aggregate context, ownership and lifecycle state; a five-way
public-value union alone cannot represent it (`vdbeInt.h:228-346`). Choose a clear
internal TS model from consuming operations, not a blanket mutually exclusive tag.
Preserve macro side effects, flag masks, shared numeric flag relationships and
union selection semantics. TS enums/objects must not silently alter bit patterns
or expression evaluation order; allocation-only C details need not survive.

### References, copies and lifetime

Map pointers by meaning: object identity/reference, byte slice with explicit
offset/length, register index, or result/out-parameter return. No single pointer
replacement fits all four. Preserve ordered identity and mutation sharing.
GC releases unreachable memory; it does not implement reset, finalize, page
borrowing, aggregate cleanup or row invalidation. Specify those at their owners.

Distinguish shallow copy, full value copy and move (`sqlite3VdbeMemShallowCopy`,
`sqlite3VdbeMemCopy`, `sqlite3VdbeMemMove` in `vdbemem.c`). Do not deep-clone object
graphs as a substitute for ownership. Borrowed internal buffers must remain valid
until their consumer finishes; copy where source lifetime or mutation requires it.
Proposed default: copy public bound/returned blobs rather than exposing borrowed
engine storage. **Stage 1 decision:** `docs/api.md` adopts that default: binding
copies byte input and each returned BLOB is a fresh caller-owned copy. This avoids
making page/register borrow validity part of the public surface while preserving
internal borrowed slices where their owner outlives use.

### Bytes, text and comparison

Use `Uint8Array`/`DataView` with explicit endian interpretation for file/record
fields, including signed integer serial types and IEEE REAL bits. Byte lengths,
JS UTF-16 code-unit counts and Unicode character counts are different quantities.
Preserve UTF-8, UTF-16le and UTF-16be database encodings; keep lengths and encoding
with raw text wherever upstream consumers need them.

NUL-termination requirements and embedded NUL behavior are operation-specific.
`utf.c` `READ_UTF8`, `sqlite3Utf8Read`, `sqlite3Utf8ReadLimited` and
`sqlite3VdbeMemTranslate` do not all have the same termination/invalid-input rules.
In particular SQLite accepts some legacy UTF-8 sequences that a WHATWG decoder
handles differently (`utf.c:145-225`). Do not assume `TextDecoder`, JS string
comparison, `localeCompare` or Unicode case folding implements SQLite semantics.
Use upstream collation/length/conversion routines and focused tests for the slice;
do not invent behavior where upstream explicitly leaves it undefined.

### Execution and errors

Put asynchronous boundaries deliberately at acquisition and bounded execution
work. No hidden await inside a synchronous API. A yield must preserve Vdbe PC,
registers, cursors, pending result/error and byte borrows, with row validity and
overlapping-operation admission consistent with the API when authored. Do not
restart evaluation after a yield. Synchronous JS cannot observe a newly delivered same-agent abort
event while it monopolizes the event loop; describe cancellation honestly.

Preserve applicable primary/extended SQLite result codes and operation cleanup,
including reset/finalize after failure. Transport/CORS failures are not SQL errors.
Known resource checks and observable allocation failures can have typed errors;
do not promise to catch browser process termination or every host OOM. Impossible
internal states fail clearly, not as fabricated NULL, empty rows or success.

### Evidence and progressive decisions

For meaningful adaptations, cite upstream file/routine and a short reason near
the implementation and relevant test. Author concise progressive mapping/status
notes in `docs/SQLITE_SOURCE_MAP.md` as work needs them; no separate giant proof
inventory. Translate the relevant upstream assertions before each slice and compare actual TS behavior to the
pinned oracle. Oracle encodings must retain INTEGER/REAL, NULL/empty, raw blob and
text-encoding distinctions; no normalization that masks divergence.
Unimplemented behavior is a visible gap, never passing compatibility credit.

## Initial key-structure guidance

### Connection: sqlite3

Source: `sqliteInt.h:1669`, `main.c` `openDatabase`, `sqlite3Close`.
Retain ownership of statements, schema/backend references, limits, encoding and
applicable error state. Decide how the JS connection owns acquisition and
statement lifetimes under the future API, using source-derived close behavior
rather than assuming cascading finalization. C mutexes/lookaside allocation and
excluded callbacks are not automatically fields to emulate; internal shared identity still matters.

### Statement: Vdbe and Mem

Source: `vdbeInt.h:232,458`, `vdbe.c`, `vdbeapi.c` step/reset/finalize/bind/column
routines, `vdbeaux.c` `sqlite3VdbeReset`, `sqlite3VdbeFinalize`.
Keep program, registers, parameter storage, cursor slots, PC and result-row state
distinct. Reset retains bindings but invalidates the row; finalize destroys the
statement even when reporting its previous error. Decide register indexing and
suspension ownership before the first interpreter slice. Mem's conversion caches,
subtypes and accumulator state cannot be inferred from its public output value.

### Compilation: Expr, Select, SrcList, NameContext, Parse

Source: `sqliteInt.h:3039,3425,3506,3597,3882`; `expr.c`, `select.c`, `resolve.c`,
`prepare.c`, `parse.y`. Keep ordered result/source lists and stable cursor/register
identity; names are not unique map keys. Preserve flag-selected meanings, correlated
outer name contexts, compound SELECT linkage and compile-time allocation state.
Which nodes are shared, duplicated or rewritten by each upstream pass? Represent
that directly; do not flatten into an independent AST evaluator. C reduced-size
allocations need not be imitated, but their legal field-use distinctions matter.

### Schema: Table, Column, Index

Source: `sqliteInt.h:2252,2432,2797`; `build.c`, `prepare.c` schema initialization.
Keep the linked schema graph and column/index order, affinity, defaults/generated
expressions, view Selects and WITHOUT ROWID key mapping. Column.iDflt indexes
Table's expression list; it is not a universal inline default value. Decide which
schema parsing state is retained for read-only planning; no blanket removal of DDL
parsing just because executing user DDL is excluded.

### Keys: KeyInfo and UnpackedRecord

Source: `sqliteInt.h:2672-2748`; `vdbeaux.c` `sqlite3VdbeRecordUnpack`,
`sqlite3VdbeRecordCompare`, `sqlite3MemCompare`.
Preserve encoding, per-term collations/sort flags, key versus total field counts,
prefix comparison, default_rc and eqSeen. JS array lexicography is not a substitute.
Which records borrow Mem values, and which own them across a cursor search?

### Storage: BtShared, MemPage, BtCursor

Source: `btreeInt.h:273,425,531`; `btree.c` page/cell parsing, payload and cursor
movement routines. Preserve file/page identity, page-1 header offset, geometry,
local/overflow payload rules, table versus index keys and ordered cursor stack.
Distinguish signed rowids from page indexes. Determine byte-borrow validity when
moving the cursor. Main-file write balancing may be omitted; needed ephemeral
b-tree operations must still have faithful translated algorithms.

### Read boundary: Pager and PgHdr / PCache

Source: `pager.h:143,163-176`, `pager.c` Pager and page acquisition;
`pcache.h:25,91-97`, `pcache.c` fetch/release.
Retain page identity, bytes, reader references and valid borrow duration. Choose
residency/eviction only as needed for the selected acquisition design. Main-file
journal, dirty-page writeback and locking protocols are not browser persistence
requirements; do not discard analogous private working-state needs unexamined.

## Worked ownership example (illustration, not a universal copy pipeline)

`vdbeaux.c` `sqlite3VdbeSerialGet` (`4123`, text/blob branch after `4201`) points
Mem.z at record bytes with `MEM_Ephem` and the serial-type byte length. A TS slice
can represent this as a borrowed subarray with encoding and length, not eagerly
decode every record into JS strings. Its page/record owner must outlive the borrow.
If a consumer uses `sqlite3VdbeMemCopy` on non-static text/blob, it materializes
owned value bytes through `sqlite3VdbeMemMakeWriteable`; a shallow copy does not.
Proposed public-column default: return an owned JS string or fresh blob array.
Under this proposal a retained public blob cannot change when another column
converts or the statement steps/resets. SQL NULL and a zero-length BLOB remain distinct despite
both sometimes using null C pointers. Test that distinction and retained-copy
behavior when this path is translated; no need to clone the schema/page graph.

### Stage 1 decisions (resolved)

`docs/api.md` now owns these decisions. They are C-mapped browser adaptations,
not runtime support claims:

- `open()` asynchronously fetches, validates and retains the complete bounded
  immutable main file; `prepare` is synchronous and `step` asynchronous/yielding.
  Connection-local stateful overlap is rejected rather than queued.
- prepare returns `{statement, tailOffset, tail}`; empty/comment-only input has a
  null statement, the offset counts UTF-8 bytes, and the suffix is lossless.
- public values are `null | bigint | number | string | Uint8Array`; blobs are
  copied, NaN binds NULL, infinities stay REAL, and nullable typed access keeps
  NULL distinct from empty text/blob.
- ordered index access and positional metadata preserve duplicate names.
  `columnType` is a stable initial-storage-class observation, explicitly adapting
  native undefined post-conversion behavior.
- reset retains bindings and both reset/finalize clean up before reporting saved
  errors. Finalize is destructive. Legacy busy `close()` and zombie
  `closeDeferred()` are both exposed without cascading finalization.
- SQLite failures retain primary/extended codes; transport, cancellation,
  timeout, resource limits, JS misuse, temporary/permanent unsupported behavior,
  and impossible internal states remain distinguishable.

These choices follow `src/sqlite.h.in`, `src/main.c`, `src/prepare.c`,
`src/vdbeapi.c`, `src/vdbeaux.c`, and `src/vdbemem.c` in the selected pin. Exact
finite default limit values remain an implementation-stage decision requiring
measurement and tests; declarations are explicitly nonfunctional meanwhile.

## Bounded Stage 1 design questions (historical basis)

The questions below are retained as the historical evidence checklist that drove
the resolved Stage 1 API above. They are not open blockers, proposed signatures,
or an extra architecture/review checkpoint; later source/test evidence may still
refine the singular contract coherently.

- How will nullable typed text/blob access preserve SQL NULL versus empty TEXT
  and empty BLOB? `sqlite.h.in:5493-5496` maps SQL NULL to null pointers, while
  a zero-length BLOB can also return a null pointer (`5462-5464`).
- How will INTEGER `bigint` and REAL `number` remain distinct, including an
  integral-valued REAL? Follow SetDouble's NaN-to-NULL and infinity preservation;
  make native test transport retain these distinctions rather than lossy JSON.
- How will prepare represent success with no statement for empty/comment-only
  SQL, and return the unconsumed SQL tail? Define UTF-8 byte offsets versus JS
  string indexes explicitly from `prepare.c` and `sqlite.h.in` prepare contracts.
- What does open acquire, and what remains resident for schema/planner reads?
  Choose synchronous or asynchronous prepare consistently with that acquisition
  design, URL/input scope, Fetch controls and limits. No hidden asynchronous reads
  or silently reduced input extent. Describe cancellation/timeout honestly: a
  synchronous operation cannot receive same-agent abort events while blocking
  the event loop.
- What does column_type observe around conversions? Upstream only defines it
  before conversions (`sqlite.h.in:5421-5432`). If adapting this to an immutable
  initial-type observation, label that adaptation; undefined native post-conversion
  results are not portable oracle expectations.
- How do reset, finalize and close expose errors while performing their required
  cleanup? Finalize destroys the statement even when reporting a prior error
  (`sqlite.h.in:5595-5617`); reset retains bindings but invalidates the row.
  Derive the close choice from `sqlite3_close`/`sqlite3_close_v2` and `main.c`,
  rather than assuming cascading destruction. Any JS idempotence adaptation must
  remain explicit and must not suppress meaningful errors.
- Which errors are actual SQLite result codes and which are JS representation
  validation? An out-of-range `bigint` is not automatically SQLITE_RANGE, whose
  binding use concerns parameter indexes. Keep those cases distinguishable.
- How will temporary translation gaps and permanent SPEC exclusions be explicitly
  distinguishable? Neither may be reported as supported behavior, and a temporary
  gap cannot become a new permanent exclusion.

Choose each internal representation before its actual first consumer. Later
structure notes may remain proposed defaults; no exhaustive upfront structure
inventory, extra two-review gate, or owner engineering decision is required.
When Stage 2 authors the oracle, pin its source through the manifest and record
relevant build options, including math, JSON and column metadata needed by scope.
Native fixture setup may write; runtime main-file access may not. Classifying
an exclusion or harness-only test is not implementing an excluded capability.
