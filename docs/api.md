# Public API contract

Status: **Stage 3 first prepared-SELECT plus bounded relational and compound/VALUES working-state slices implemented; broader SQL remains unsupported**. `open()` fetches, bounds, validates, and owns an immutable format-3 database. `Connection.prepare()` performs UTF-8 tokenization and generated-Lemon parsing, preserves exact tails/empty SQL, and compiles bounded no-FROM expressions plus projection/filter over one ordinary rowid table into the shared-Mem VDBE. The admitted relational slice accepts one or more `ORDER BY` expression terms. Each term resolves by SQLite precedence as result alias, positive result ordinal, identical selected expression, then an admitted table expression, with optional explicit `COLLATE BINARY|NOCASE|RTRIM`, `ASC|DESC`, and `NULLS FIRST|LAST`; otherwise the resolved expression/column collation applies. `LIMIT`/`OFFSET` expressions accept INTEGER, integral REAL, and signed base-10 integral TEXT at first `step()` and follow the zero/negative/error timing specified below. Complete immutable multi-field `KeyInfo` keys run through typed bounded sorter comparison. SELECT DISTINCT is admitted for the same single-table direct-column/direct-expression projection surface; it compares complete projected records through typed ephemeral `KeyInfo` state, with NULL-equal and INTEGER/REAL-equal semantics and resolved BINARY/NOCASE/RTRIM collations. The bounded compound surface admits standalone structured one- and multirow `VALUES`; scalar `UNION ALL`, `UNION`, `INTERSECT`, and `EXCEPT`; multi-term compound `ORDER BY` for admitted finite scalar/VALUES rows (including multi-column results) and one-result-column direct-table arms; and compound-wide `LIMIT`/`OFFSET`. A table-arm subset admits one direct column from each single ordinary rowid table without `WHERE`: all four set operators and left-to-right mixed chains are supported, `UNION ALL` preserves scan order/multiplicity when unordered, set operators use typed NULL-equal and INTEGER/REAL-equal comparison under the leftmost column's declared collation, and metadata comes from the leftmost column. Ordered admitted table chains use one bounded global sorter after set transitions. Unsupported compound shapes reject during prepare before any arm executes. Ordinary rowid-table comma, CROSS, and INNER joins are admitted with ON/WHERE, aliases, USING/NATURAL visibility, expression projection, DISTINCT/ORDER/LIMIT, and the bounded one-column joined-left-arm `UNION ALL ... ORDER BY 1` composition. They stream source-order cursor loops; they do not materialize a blanket Cartesian product. LEFT and one RIGHT/FULL barrier are admitted as specified by the current boundary below; repeated RIGHT/FULL barriers, indexes, and the other exclusions below remain temporary unsupported. The allocated bounded FROM-derived and immutable-view tranche described below is also admitted; it does not imply general scalar/EXISTS/IN, CTE, window, or aggregate-over-derived support. The aggregate tranche admits grouped and non-grouped `count`, `sum`, `total`, `avg`, unary `min`/`max`, and `group_concat`, including HAVING and the modifiers and bounded compositions stated below. Canonical first-SELECT TS conformance remains 8/8; the compound/VALUES contract is 22/22 exact public TS passes (15 native-valid executions and seven native prepare-error cases); relational schema-v4 accounting is 2/18 (`up-limit-1.2.1`, `up-select4-10.3`); `up-distinct-3.0` passes publicly but is no-credit because its fixture cannot yet preserve the upstream UNIQUE autoindex setup.

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
while streaming, before retaining excess data. `maxResultBytes` (default 1,000,000,000) bounds each scalar TEXT/BLOB result; see stepping below. Unsupported reserved bytes,
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
and record header/serial-type decoding each charge one unit. Scalar Function input traversal and result copies charge one unit per started 256-byte chunk; delivered output-growing `hex`, `replace`, `substr`, and `char` additionally charge their deterministic scan/build units. `maxResultBytes` is the connection-wide maximum byte length of one TEXT/BLOB result and cannot be relaxed per operation. Output-growing functions preflight a source-derived exact bound before materialization where possible (`hex` doubles input bytes; `replace` counts matches and replacement delta), then verify encoded output. Exceeding it is `kind: "limit"` with message `string or blob too big`. Overflow payload chunks
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
operation-level `maxWorkUnits` tightens the connection budget. Private sorter and
ephemeral-index work charges one unit per inserted record, copied logical byte,
visited `KeyInfo` comparison term, and merge move, in addition to the enclosing
VDBE opcode. Cancellation, deadline, and work checks bracket bounded growth and
run at each comparison/move charge; failed post-growth admission rolls the entry
back. `maxRows` counts
`"row"` outcomes across one execution until reset, and `maxResultBytes` bounds only public/scalar result values. Private sorter/ephemeral state is independently bounded by `maxPrivateEntries` (default 100,000), `maxPrivateKeyBytes` (default 16 MiB), and `maxPrivateBytes` (default 256 MiB), fixed immutably when a statement Program is prepared. `maxPrivateBytes` is one aggregate execution-wide budget shared by every simultaneously live sorter and ephemeral cursor in that statement; it is not a per-cursor allowance. Reset, failure, and finalize release all reservations before later connection work is admitted. Limits must cover parser
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
surfaces, and sidecar recovery. The public read-only SELECT subset currently admits:

- bounded no-FROM scalar expressions and projection/filter over one ordinary rowid table;
- `ORDER BY` with one or more comma-separated expression terms; each term may use a result alias, positive result ordinal, identical selected expression, or admitted table expression, followed by optional `COLLATE BINARY|NOCASE|RTRIM`, `ASC|DESC`, and `NULLS FIRST|LAST`;
- the resolved expression/column collation when `COLLATE` is omitted, including declared column collation; all terms participate in typed SQLite storage-class/`Mem` comparison;
- scalar `LIMIT expr`, `LIMIT expr OFFSET expr`, and `LIMIT offset, limit`. LIMIT/OFFSET are evaluated at first `step()`: INTEGER, integral REAL, and signed base-10 integral TEXT are accepted; other values and int64 overflow are code-20 datatype mismatch. Negative LIMIT is unlimited and negative OFFSET is zero. For a single SELECT, LIMIT zero bypasses result/scan work after both LIMIT and OFFSET coercion. For a compound SELECT, LIMIT is coerced first and zero bypasses OFFSET evaluation/coercion and all producers. Admitted programs implement this with VDBE register counters (`MustBeInt`, `OffsetLimit`, `IfPos`, `IfNotZero`, and `DecrJumpZero`) rather than statement-host LIMIT fields; ordered positive LIMIT bounds sorter retention to LIMIT+OFFSET.

ORDER aliases follow SQLite alias precedence; positive ordinals are 1-based and
out-of-range ordinals are prepare errors. Equal complete ORDER keys have no public
deterministic-order guarantee. Compound forms outside the bounded scalar and direct-column table-arm surfaces, FROM
subqueries/CTEs, windows, views, indexes, unregistered functions, and broader resolver/planner
grammar remain temporary unsupported (unless separately admitted above). Ordinary
rowid-table comma/CROSS/INNER and LEFT joins are admitted: LEFT preserves
ON/USING/NATURAL match ownership, emits one cursor-shaped NULL extension for an
unmatched left row, and applies WHERE afterward. One RIGHT/FULL barrier is also
admitted under the current boundary below; repeated barriers remain temporary
unsupported. The runtime also preserves tails, result metadata, connection-encoded bindings,
serialized async VM admission, and statement/close lifecycle through the public
API. Internal storage or parser tests confer only their stated bounded evidence,
not broader SQLite query compatibility.

### Historical tests-first expression/function boundary (superseded)

`test/conformance/cases/stage3-expression-functions.json` records native expectations but awards zero TS credit. When implemented, expression results continue to use the existing five public value classes; ordered/duplicate column names and direct-column origin metadata follow the existing Statement contract. Expression aliases name computed columns, while unaliased names are SQLite's expression text; computed expression origins are null. Resolver/step errors use the existing SQLite-compatible error object and first-error rule. No host function or collation registration API is introduced.

### Historical audit and relational-foundation precision (2026-09-14; superseded)

At that checkpoint public expression execution reproduced the 14-case pinned typed audit, including numeric-prefix boolean/`abs`, REAL arithmetic classification, and INTEGER-cast prefix behavior. The lane was explicitly zero-credit until conformance promotion. Private relational state was a foundation rather than a promise of general relational SQL; the public guarantee was only the then-current ORDER BY/LIMIT/OFFSET subset. DISTINCT outside that admitted projection surface, compound, aggregate, window, join, and unsupported structural forms were not implied. The relational manifest then attempted/passed 3/18 and credited 2/18; the passing DISTINCT upstream assertion remained no-credit pending exact UNIQUE-autoindex fixture parity. Later sections and the opening status own the current boundary.

### Compound result collation and gate accounting

For the admitted scalar/VALUES compound surface, each result column takes the
first explicit built-in collation found scanning arms left-to-right, otherwise
BINARY. UNION, INTERSECT, and EXCEPT use that collation for duplicate equality.
Compound ORDER BY inherits the resolved result collation when COLLATE is omitted;
an explicit `COLLATE BINARY|NOCASE|RTRIM` overrides ordering only and does not
alter set membership. The exact compound contract is 22/22 credited public cases.
Its seven prepare-error cases record only open, prepare, and close as attempted;
metadata, step, and finalize remain explicitly unattempted because no statement
exists. Credit requires the runner's actual operation trace to match that record.

Set operators may be followed by trailing `UNION ALL` arms in the admitted
scalar/structured-VALUES surface. The completed set prefix retains SQLite typed
representatives, then trailing rows retain source order and multiplicity; compound
ORDER and global LIMIT/OFFSET apply to the combined result. This does not admit
previously excluded table-arm expressions, per-arm WHERE, joins, or broader SQL.

## Historical bounded outer-join runtime status (2026-09-17; superseded below)

The existing prepared read-only SELECT surface now executes LEFT joins and a bounded
RIGHT/FULL tranche over ordinary rowid tables. RIGHT/FULL is admitted only when its
barrier is terminal and merged-column lowering is representable by the resolved
source graph. Non-terminal RIGHT/FULL continuation and multi-left merged
USING/NATURAL wildcard forms fail prepare with `unsupportedClassification:
"temporary"`; this is an implementation boundary, not a product-scope exclusion.

### RIGHT/FULL joins (2026-09-17 revision)

`prepare()` supports the bounded ordinary-table RIGHT/FULL matrix documented in `docs/CONFORMANCE.md`, including downstream joins and USING/NATURAL wildcard metadata. Statements retain normal typed values, reset/rebind behavior, asynchronous cancellation/deadline/work limits, and shared private-state limits. Existing feature gates (including unsupported aggregate/subquery and unsupported storage shapes) remain explicit prepare errors.

### Current RIGHT/FULL boundary correction (2026-09-17)

Earlier statements that all RIGHT/FULL joins were unsupported, that non-terminal joins were unsupported, or that the 15-case promotion implied arbitrary chains are superseded. One RIGHT or FULL barrier is supported, including downstream ordinary joins. More than one RIGHT/FULL barrier in the same SELECT fails atomically during `prepare()` with temporary unsupported message `multiple RIGHT/FULL JOIN barriers are not implemented`; no rows can execute. This is the per-`WhereLevel` next tranche identified by `record:///review.md?card=card-k&v=3`.

### Aggregate SELECT tranche

`prepare()` currently admits core `count`, `sum`, `total`, `avg`, unary `min` and
`max`, and `group_concat` in grouped and non-grouped SELECTs over no FROM or
ordinary rowid-table input. The admitted surface includes WHERE, GROUP BY, HAVING,
scalar composition of aggregate results, aggregate-argument DISTINCT and FILTER,
and aggregate-local ORDER BY. It also includes the exact tested grouped inner-join
input, parameter-free ordered aggregate `UNION ALL`, and result ORDER BY,
LIMIT/OFFSET, and SELECT DISTINCT compositions. Column names and null metadata
follow the SELECT expressions. The public aggregate matrix passes all 34 native-
success cases; four bounded compound-derived cases are admitted only as specified
in the FROM-derived section below. Windows, unregistered aggregate functions,
broader join/compound forms, and broader subquery/CTE behavior remain future scope.

### Bounded grouped SELECT DISTINCT

Within the documented admitted GROUP BY/HAVING aggregate surface, SELECT-level
`DISTINCT` is applied to finalized projected rows before result ORDER BY and
LIMIT/OFFSET. Equality uses SQLite storage classes and expression collation; NULLs
compare equal for duplicate removal. Its ephemeral index and all grouping/result
sorters share the connection's per-statement private-state limits. The usual
`step()` cancellation, timeout, and work-unit options apply; failure is retained
by `reset()`/`finalize()` while a later execution after reset may proceed.
Aggregate-argument DISTINCT, FILTER, and aggregate-local ORDER BY use the same
execution-wide private-state budget and cleanup rules. This does not admit window
execution or aggregate syntax outside the bounded tranche above.

## Bounded FROM-derived and immutable-view surface

`Connection.prepare()` admits the allocated 19-case FROM-derived/view tranche:
bounded flattened and nested projections, LIMIT materialization, joins,
GROUP/HAVING, ORDER/DISTINCT/LIMIT composition, bounded `UNION ALL`, and persisted
immutable views with explicit/inferred names, duplicate-name behavior, inherited
collation, and origin metadata. The four allocated compound-derived aggregate
forms complete the aggregate native-success matrix at 34/34. Execution remains a
single public `Statement` and shares its work and private-state limits across
producers, materializations, aggregate state, and sorters.

This API boundary is not general subquery support. Scalar subqueries, general
`EXISTS`, and `IN` are not promised here; the admitted correlated form is only the
allocated persisted-view composition. General aggregate-over-derived and general
compound-derived SQL are also not promised. The former blanket CTE rejection at
this boundary has been superseded by the bounded ordinary and recursive surfaces
below. WITH shapes outside those surfaces still fail atomically during
`prepare()`; rejection registers no statement or private execution state and
leaves the connection reusable. Windows and unsafe/unmatched derived shapes fail
under their existing typed prepare boundary. No native/host fallback or partial
statement shape is exposed.

### Expression subqueries (Stage 3 bounded admission)

Singular Fetch admits the captured scalar subquery, EXISTS, IN/NOT IN, and correlated expression routes, including the documented bounded JOIN/aggregate/GROUP/HAVING/ORDER/DISTINCT/LIMIT/compound compositions. Results retain SQLite INTEGER/REAL/NULL/BLOB distinctions and database encoding. Uncorrelated producers may execute once; correlated producers rerun for each outer row. Reset/rebind/finalize/deferred-close and cancellation/deadline/work/private-byte failures preserve the first error, release owned state, and restore admission as tested. Compound ORDER terms bind by resolved output ownership and structural expression identity, not SQL token spelling. WITH support is limited to the bounded ordinary and recursive surfaces below; windows and unsafe unmatched forms remain unsupported atomically at prepare.

### Ordinary WITH (bounded Stage 3 surface)

`prepare()` admits the represented ordinary, non-recursive WITH forms exercised by
the conformance suite, including aliases, multiple declarations, repeated
references, and `AS MATERIALIZED` / `AS NOT MATERIALIZED` planning hints. Rows,
metadata, errors, reset/finalize, cancellation, yielding, and limits use the same
statement/VDBE contract as the underlying SELECT route. This is not unrestricted
WITH support: represented derived/view ownership (with stored-view scope isolation),
mixed CTE/table CROSS JOIN, grouped aggregation, and bounded UNION ALL composition
are covered. Recursive self-reference is dispatched to the bounded recursive
contract immediately below; only recursive shapes outside that represented surface
reject temporarily. Expression-owned nested WITH remains a distinct temporary
`common table expressions are not implemented` residual. Other unrepresented shapes retain typed temporary/SQLite errors.

### Recursive CTEs

`prepare()` accepts the represented read-only recursive CTE subset documented in `TRANSLATION.md`, including the bounded direct-projection cross join of distinct recursive declarations with optional direct-column output ordering (explicit built-in collation, direction, and NULL placement are preserved). Rows and metadata use the normal `Statement` API for UTF-8/UTF-16 databases. Recursive execution is iterative and subject to the same `step({signal, timeoutMs, maxWorkUnits})`, row, result, and private-state limits as other VDBE programs. Unsupported recursive shapes fail atomically at prepare with temporary unsupported classification; SQLite-owned invalid shapes use SQLite diagnostics. `reset()` clears queue/history/materialization state but retains bindings, and rebinding requires reset; `finalize()` releases all state.

## Window prepare boundary (2026-09-18)

Window syntax is structurally parsed and resolved, but remains **temporary unsupported for execution**. Internal compilation now emits source-shaped setup operations and real register/cursor/subroutine identities for compiler verification, but that setup-only product is never publicly published because frame stepping remains absent. `Connection.prepare()` resolves and performs the pinned pre-execution rewrite validation for both scalar and table-backed window SELECTs. Observable resolver/rewrite errors therefore take precedence where SQLite raises them (for example code 1 `misuse of aggregate: sum()` for an unowned aggregate in a non-aggregate SELECT's `ORDER BY`). If validation succeeds, prepare throws temporary unsupported `window functions are not implemented`; no `Statement` or partial Program is published, and the connection remains reusable. The public table-backed architecture gate verifies both diagnostic precedence and atomic rejection/reuse in UTF-8, UTF-16LE, and UTF-16BE fixture databases. This does not admit frame stepping, window rows, or TypeScript conformance credit.

### Aggregate-window preimplementation boundary

Window syntax is represented and rewritten internally, but aggregate-window frame
execution is not yet a public capability. `prepare()` must reject any statement
requiring `sqlite3WindowCodeStep` atomically before returning a Program or
Statement, including otherwise-supported join/group/subquery/ordinary or recursive
CTE/outer ORDER compositions. Consumers must not observe a partially lowered
statement or runtime host recomputation. The implementation gate and lifecycle/
resource expectations are the 44-case matrix documented in `docs/CONFORMANCE.md`;
its current TypeScript accounting is 0 attempted/0 credited/44 unattempted. This
paragraph changes no public method signature or owner guarantee.
