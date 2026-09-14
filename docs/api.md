# Public API contract

Status: **Stage 3 first prepared-SELECT slice implemented; broader SQL remains unsupported**. `open()` fetches, bounds, validates, and owns an immutable format-3 database. `Connection.prepare()` performs UTF-8 tokenization and generated-Lemon parsing, preserves exact tails/empty SQL, and compiles bounded no-FROM integer/parameter expressions plus ordered projection and an integer-equality filter over one ordinary rowid table into an instruction program executed by the shared-Mem VDBE statement. Result storage classes, direct-column metadata, binding/reset/finalize, BUSY/deferred close, and bounded step controls are active. DISTINCT, ORDER/GROUP/LIMIT, functions/aggregates, joins, subqueries/CTEs, compounds, views, indexes/sorters and other unimplemented breadth report temporary unsupported rather than approximate results. Canonical first-SELECT TS conformance is 8/8 for the exact promoted assertions; this must not be described as broad compatibility.

This is the singular public contract. It maps the read-only-relevant SQLite 3.53.4
C API to browser-safe named ESM declarations while retaining explicit JS boundary
behavior. Product scope and permanent exclusions remain in [SPEC.md](SPEC.md).

## Import and values

```ts
import { open, JSQLiteError } from "jsqlite2";
import type {
  Connection, Statement, SqliteValue, SqliteStorageClass,
} from "jsqlite2";
```

`SqliteValue` is `null | bigint | number | string | Uint8Array`:

| SQLite storage class | JavaScript value |
|---|---|
| NULL | `null` |
| INTEGER | signed 64-bit `bigint` |
| REAL | IEEE-754 `number` |
| TEXT | `string` |
| BLOB | `Uint8Array` |

INTEGER accepts only `-9223372036854775808n..9223372036854775807n`. A value outside
that interval is JS `misuse`, not `SQLITE_RANGE` (which is used for an invalid bind
index). REAL and INTEGER stay distinct even when a REAL is integral. Binding NaN
binds SQL NULL; positive and negative infinity remain REAL, following
`sqlite3VdbeMemSetDouble` (`src/vdbemem.c`).

Bound JS strings must be well-formed UTF-16: each surrogate must belong to a valid
pair. A lone high or low surrogate is `misuse` with no SQLite code. This is an
explicit JS-boundary adaptation, separate from SQL preparation, because the C API
receives bytes while `SqliteValue` receives a JS string; silently applying
`TextEncoder` replacement would bind a different value. The binding adapter
strictly encodes Unicode scalars as UTF-8, including four bytes for a supplementary
scalar, then follows `src/vdbeapi.c:bindText`/`sqlite3_bind_text`: the Mem value
enters as copied UTF-8 and is translated immediately to the connection database
encoding (UTF-8, UTF-16le, or UTF-16be) by the SQLite-derived UTF routines. Embedded
NUL is ordinary data because the adapter always supplies an explicit byte length;
it does not terminate the value. Byte limits account for both the complete source
UTF-8 byte length and the translated logical byte length (excluding any terminator),
and failure is `limit`. UTF-16 lengths are bytes, not JS code units. This rule is
tested across all three database encodings; it does not use WHATWG replacement
semantics.

Inputs are copied when bound. Every returned BLOB is a fresh copy owned by the
caller; strings and scalar values are JS values. Thus subsequent conversion, step,
reset, finalize, or close cannot mutate a value already returned to the caller.

## Opening and residency

```ts
open(source: string | URL | Request, options?: OpenOptions): Promise<Connection>
```

`open` is the only acquisition boundary. It fetches and validates one immutable
main-database snapshot, then retains the complete file in bounded in-memory byte
storage for the connection lifetime. It follows redirects as Fetch does and does
not fetch WAL, journals, attached databases, or any SQL-selected URL. Success means
all bytes are resident; there are no hidden asynchronous page reads. Consequently
`prepare`, binding, metadata access, reset, finalize, and close are synchronous;
`step` is asynchronous so execution can yield between bounded work chunks.

The implementation constructs a new `Request` using caller `fetchOptions` and the
operation signal, but defaults to `credentials: "omit"`, `cache: "default"`, and
`redirect: "follow"`. Caller options may override these defaults, including
credentials. `fetchOptions.signal` is excluded to avoid two competing signals;
use `OpenOptions.signal`. A supplied `Request` contributes its URL and options,
then explicit `fetchOptions` override them; the API still forces the operation
signal. Transport, HTTP (non-2xx), CORS, unavailable/opaque body, premature EOF,
and body-stream failures are `transport`, not SQLite errors. HTTP success does not
imply a valid database.

`maxFileBytes` is checked against trustworthy declared length when available and
while streaming, before retaining excess data. Unsupported reserved bytes,
recovery-requiring snapshots, malformed headers/pages, or unsupported storage
features fail explicitly as documented under errors. The eventual engine must
support the SPEC's UTF-8, UTF-16le, and UTF-16be database encodings.

`signal` is observed before and during streaming and bounded work. `timeoutMs` is
a finite nonnegative duration measured from operation entry. Zero permits only
already-completed checks. Aborting wins over timeout if abort is already observable;
otherwise the first observed condition wins. Timeout does not abort the caller's
controller. Open failure owns and releases partial buffers and exposes no
connection.

## Connection and preparation

A connection owns its statements. Operations on one connection are serialized:
while `open` or `step` is pending, starting another stateful connection/statement
operation throws `JSQLiteError(kind: "misuse")`; accessors for the current row of
the stepping statement are also unavailable until its promise settles. Separate
connections may overlap. This deterministic rejection avoids races rather than
silently queueing them.

```ts
const { statement, tail, tailOffset } = db.prepare(sql, options);
```

`prepare` compiles at most the first statement. Empty, whitespace-only, and
comment-only SQL succeeds with `statement === null`. `tailOffset` is the exact
number of UTF-8 bytes consumed, and `tail` is the exact unconsumed JS-string suffix.
The implementation must map the parser boundary back to a Unicode scalar boundary;
it never splits a surrogate pair or returns a replacement-normalized suffix.
Malformed unpaired JS surrogates are `misuse`, because they have no lossless UTF-8
encoding. SQL parse/compile failure returns no handle and throws a `sqlite` error.
`maxSqlBytes` applies to encoded bytes. Public prepare flags are omitted until a
read-only-relevant behavior is implemented; this is the v2 retained-SQL model,
including future bounded automatic reprepare.

Parameter indexes are one-based and column indexes zero-based. `parameterName(i)`
returns the original marker (`:x`, `@x`, `$x`, or numbered form) or null;
`parameterIndex(name)` returns zero if absent. Unbound parameters are NULL.
`bind(number|string, value)` resolves names exactly and rejects absent names or
out-of-range indexes. Binding is allowed only before execution or after reset.
`reset()` rewinds and invalidates the row but retains bindings. Repeating reset
without an intervening step is valid and leaves the statement prepared with the
same bindings. `clearBindings()` sets every parameter to NULL and does not reset
execution.

## Stepping, bounded work, and rows

```ts
await statement.step(options) // "row" | "done"
```

`"row"` and `"done"` are control outcomes, never exceptions. Execution runs in
bounded chunks and yields to the host between chunks, preserving VM state. It
checks the effective signal, deadline, and work budget between chunks and within
bounded traversal/recursion loops. Statement operation options may only tighten,
never relax, connection limits. `maxWorkUnits` is an implementation-defined stable
unit counter intended as a safety bound, not elapsed time or a compatibility/performance
promise. In the current SELECT VM, every opcode, every local/overflow payload chunk,
and record header/serial-type decoding each charge one unit. Overflow payload chunks
are reconstructed one page at a time with a host yield after each overflow page;
signal/deadline/work checks bracket those reads while PC and cursor remain on the
current row. Other configured bounds include SQL/file bytes, rows, parser/expression depth,
b-tree depth, and overflow-page traversal.

Cancellation, timeout, limit, or corruption failure halts the run and rejects the
promise with the matching `JSQLiteError`. Lazy b-tree/record format corruption is
reported as `kind: "sqlite"`, code/extendedCode `SQLITE_CORRUPT` (11); configured
b-tree depth and overflow-page ceilings are `kind: "limit"`. Unrelated internal
`RangeError` is not treated as a resource ceiling. The row is invalidated. The statement remains owned and
must be reset or finalized; `reset()` performs cleanup and then rethrows the saved
execution error. Since checks occur only at bounded checkpoints, deadlines are not
hard real-time deadlines. Asynchronous `step` allows same-agent abort delivery;
synchronous methods can observe only a signal/deadline already visible during
their bounded synchronous call.

Column access is valid only after `"row"` and until the next step attempt, reset,
finalize, or connection destruction. `columnCount` is prepared result width;
access without a current row is misuse. `columnMetadata(i)` preserves position and
returns a fresh immutable record, so duplicate display names are not collapsed.
`name` is always present. `declaredType`, `database`, `table`, and `origin` are null
where SQLite metadata is unavailable (including expressions as applicable), not
empty strings. Origin fields require the translated equivalent of SQLite column
metadata support.

`columnType(i)` returns the row cell's **initial** storage class and is stable for
that row even after typed conversion. This is a deliberate deterministic adaptation:
`sqlite3_column_type` after a converting C accessor is undefined. `column(i)`
returns that initial-class public value. Typed accessors implement SQLite's
`sqlite3_column_int64/double/text/blob` conversion behavior but are nullable:
`columnInteger`, `columnReal`, `columnText`, and `columnBlob` return `null` for SQL
NULL. Empty TEXT is `""`; empty BLOB is a zero-length `Uint8Array`, never null.
This avoids C's ambiguous zero-length BLOB pointer. Out-of-range indexes are
`sqlite`/`SQLITE_RANGE`; unsupported conversion cannot be approximated.

## Lifecycle and cleanup

Statements begin prepared, can move through running/current-row/done, can be reset
for reuse, and end finalized. `finalize()` always invalidates the row, releases
bindings/resources, and destroys the handle, even when it throws a saved execution
error. `reset()` likewise completes cleanup before reporting the prior error, but
keeps the statement and its bindings. A second reset without another step is
valid (and has no prior execution error to rethrow); this follows the explicit
`sqlite3_reset` repeat contract in `src/sqlite.h.in` and `src/vdbeapi.c`.
Calling `finalize()` a second time is `misuse`; this explicit non-idempotence
prevents accidental suppression of meaningful errors. Every other operation on a
finalized statement is misuse.

`close()` maps legacy `sqlite3_close`: if statements remain, it throws a
`sqlite` error with primary code `SQLITE_BUSY` and leaves the connection open and
usable. It never cascade-finalizes. With no dependents it releases resident bytes
and closes. `closeDeferred()` maps `sqlite3_close_v2`: it immediately marks the
connection zombie, rejects prepare and all other new connection operations, but
existing statements remain usable; finalizing the last statement performs deferred
connection cleanup. There are intentionally no public `closed` flags: zombie
admission and completed destruction are different states, and every invalid use
is reported by the operations themselves rather than compressed into a boolean.
Repeating either close or using a fully closed connection is misuse (rather than
C's null-pointer OK adaptation). If statement cleanup reports
an earlier execution error, cleanup still completes; that earlier error is thrown,
while successful zombie deletion is not a competing error. Across explicit nested
cleanup, the first operation/execution error remains primary, otherwise a finalize
error is primary, otherwise a close error is primary. Any later finalize/close
failure is a secondary diagnostic (attached as `cause`/aggregate information by
helpers, or handled separately by the caller) and never prevents the remaining
cleanup attempt. This follows
`connectionIsBusy`, `sqlite3Close`, and `sqlite3LeaveMutexAndCloseZombie`
(`src/main.c`) plus reset/finalize cleanup (`src/vdbeapi.c`, `src/vdbeaux.c`).

GC is a leak backstop only. Applications must finalize statements and close their
connection. No finalizer timing or error reporting is part of the API.

## Errors

All library-detected failures are `JSQLiteError` with one `kind`:

- `sqlite`: SQL, binding-index, schema, database-format/corruption, and other
  SQLite-observable failures. `code` and `extendedCode` contain numeric SQLite
  primary/extended result codes.
- `transport`: Fetch/HTTP/CORS/body failures; `cause` may retain the host error.
- `cancelled`, `timeout`, `limit`: operation controls, not fabricated SQLite codes.
- `misuse`: JS API validation, illegal overlap/lifetime/index representation, or
  out-of-range bigint. (A SQLite-origin invalid bind/column index remains sqlite.)
- `unsupported`: behavior is unavailable. The `UnsupportedClassification` value is the stable typed discriminator: `"temporary"` for an untranslated in-scope feature
  and `"permanent"` for a SPEC exclusion. It is present exactly for this kind, so
  callers never parse messages to distinguish the two.
- `internal`: an impossible translated-engine state, never converted to NULL/success.

The complete permanent set is: mutating SQL/transactions/savepoints/database
rewriting/WAL checkpointing/vacuum/schema changes; runtime C, native code, WASM,
Emscripten, `sql.js`, `wa-sqlite`, or an embedded SQLite binary; externally loaded
extensions and host-registered functions/collations/authorizers/progress handlers/
application virtual tables; SQLite CLI, shell dot commands, Tcl harness, server,
network protocol, or `sql.js` API compatibility; and browser-runtime WAL/journal
recovery or sidecar application. Everything else unavailable inside broad
read-only scope is `unsupported`/`"temporary"`, never silently reclassified as a
permanent boundary.

For non-`sqlite` kinds, `code` and `extendedCode` are null. For every kind except
`unsupported`, `unsupportedClassification` is null. Errors preserve cleanup:
prepare failure leaks no statement; step failure invalidates its row; reset and
finalize report prior execution errors only after required cleanup. When cleanup
also detects an internal failure, the saved execution error is primary and cleanup
failure is attached as `cause`/aggregate diagnostic rather than replacing it.
No promise is made to catch host process termination or all host OOM failures.

Numeric constants are intentionally not declared in Stage 1; when implementation
adds them they must be sourced from the pin, not invented. Consumers may inspect
numeric codes and error kind without parsing messages.

## Limits and ownership summary

`WorkLimits` defaults are implementation constants that must be finite, documented,
and tested before runtime support is claimed. The implemented parser uses
`maxSqlBytes` (16 MiB), `maxParserDepth` (2500), `maxExpressionDepth` (1000), and
the configured work-unit budget. Callers can tighten them at open;
operation-level `maxWorkUnits` tightens the connection budget. `maxRows` counts
`"row"` outcomes across one execution until reset. Limits must cover parser
recursion, expression depth, page/b-tree/overflow traversal, and query loops as
required by SPEC. This Stage 1 contract does not falsely select numeric defaults
before measurements and engine consumers exist.

The connection exclusively owns resident database bytes and statements; a
statement owns binding copies and VM state; callers own values returned by column
methods. No public API exposes borrowed pages, pointers, mutable row arrays, native
destructors, or object-keyed rows.

## Source basis and exclusions

The pin is SQLite 3.53.4/source ID recorded in
`reference/sqlite/manifest.json`. Principal mappings are:

- `src/sqlite.h.in`: prepare v2/v3, bind, step, columns/metadata, reset/finalize
  contracts;
- `src/prepare.c`: `sqlite3LockAndPrepare`, v2/v3 retained SQL/tail, and
  `sqlite3Reprepare`;
- `src/vdbeapi.c`, `src/vdbeaux.c`: step/reset/finalize/clear-bindings, bind,
  column conversion and metadata;
- `src/vdbemem.c`: `sqlite3VdbeMemSetDouble` NaN/infinity behavior;
- `src/main.c`: `openDatabase`, busy close, zombie close, deferred cleanup;
- `test/close.test`, `test/capi3.test`, `test/capi3c.test`, and `test/bind.test`:
  future faithful Stage 2 lifecycle/tail/value/metadata assertions.

Permanent exclusions remain exactly those in SPEC: writes and transaction control,
runtime native/C/WASM backends, extension/host callback registration, CLI/server
surfaces, and sidecar recovery. The runtime now exposes a narrow compiled SQL
slice: no-FROM integer/unary/parameter projections and one ordinary rowid-table
projection plus integer-equality filtering. It preserves tails, result metadata,
connection-encoded bindings, serialized async VM admission, and statement/close
lifecycle through the public API. Temporary gaps remain broader resolver/planner
and VDBE behavior including joins, functions, aggregates, windows, subqueries,
CTEs, ordering/grouping/distinct, views, and general predicates. Internal storage
or parser tests confer only their stated bounded evidence, not broader SQLite query
compatibility.
