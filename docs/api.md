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
in the FROM-derived section below. The represented bounded ordinary aggregate-
window surface specified below is also admitted. Unrepresented window
compositions, unregistered aggregate functions, and broader join/compound or
subquery/CTE behavior remain future scope and reject atomically at prepare.

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
producers, materializations, aggregate state, and sorters. The bounded repeated
one-table immutable view self-join now also accepts a parent `LIMIT`/`OFFSET`
independently of the view's own LIMIT, including `LIMIT 0`; its materialized
readers have separate positions. This admission does not promise arbitrary
view bodies, view-plan identity with SQLite's first-source coroutine, or
multi-source view predicates.

This 19-case FROM-derived/view tranche does not itself imply scalar
subqueries, general `EXISTS`, or `IN`; those forms, including admitted correlated
expression routes, are governed only by the immediately following bounded
expression-subquery contract and its limits. General aggregate-over-derived and
general compound-derived SQL are also not promised. The former blanket CTE rejection at
this boundary has been superseded by the bounded ordinary and recursive surfaces
below. WITH shapes outside those surfaces still fail atomically during
`prepare()`; rejection registers no statement or private execution state and
leaves the connection reusable. The represented bounded aggregate-window surface
specified below is admitted. Unrepresented window compositions and unsafe/unmatched
derived shapes fail atomically under their typed prepare boundaries. No native/host
fallback or partial statement shape is exposed.

### Expression subqueries (Stage 3 bounded admission)

Singular Fetch admits the captured scalar subquery, EXISTS, IN/NOT IN, and correlated expression routes, including the documented bounded JOIN/aggregate/GROUP/HAVING/ORDER/DISTINCT/LIMIT/compound compositions. Results retain SQLite INTEGER/REAL/NULL/BLOB distinctions and database encoding. Uncorrelated producers may execute once; correlated producers rerun for each outer row. Reset/rebind/finalize/deferred-close and cancellation/deadline/work/private-byte failures preserve the first error, release owned state, and restore admission as tested. Compound ORDER terms bind by resolved output ownership and structural expression identity, not SQL token spelling. WITH support is limited to the bounded ordinary and recursive surfaces below; aggregate windows use the separately bounded surface below, while unsafe unmatched forms remain unsupported atomically at prepare.

### Ordinary WITH (bounded Stage 3 surface)

`prepare()` admits the represented ordinary, non-recursive WITH forms exercised by
the conformance suite, including aliases, multiple declarations, repeated
references, and `AS MATERIALIZED` / `AS NOT MATERIALIZED` planning hints. For
represented FROM-owned nested SELECTs, lexical lookup is innermost-first, falls
back to an outer WITH frame, and ignores CTE names for `main.`-qualified sources;
these prepare successfully and return typed rows/metadata in every supported
database encoding. Rows,
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

## Window rewrite/setup historical boundary (2026-09-18; superseded for aggregate execution)

The following two paragraphs describe the pre-execution checkpoint before the
aggregate-window completion below. They remain historical evidence for resolver,
rewrite, diagnostic precedence, and atomic publication; they are not the current
aggregate-window capability statement. The represented special built-ins are
specified below; unrepresented window compositions still reject atomically.

Window syntax was then structurally parsed and resolved, but remained **temporary unsupported for execution**. Internal compilation emitted source-shaped setup operations and real register/cursor/subroutine identities for compiler verification, but that setup-only product was never publicly published because frame stepping was absent. `Connection.prepare()` resolved and performed the pinned pre-execution rewrite validation for both scalar and table-backed window SELECTs. Observable resolver/rewrite errors therefore took precedence where SQLite raised them (for example code 1 `misuse of aggregate: sum()` for an unowned aggregate in a non-aggregate SELECT's `ORDER BY`). If validation succeeded, prepare threw temporary unsupported `window functions are not implemented`; no `Statement` or partial Program was published, and the connection remained reusable. The public table-backed architecture gate verified both diagnostic precedence and atomic rejection/reuse in UTF-8, UTF-16LE, and UTF-16BE fixture databases. This checkpoint did not admit frame stepping, window rows, or TypeScript conformance credit.

### Aggregate-window preimplementation boundary (historical)

Before [[card:card-o-c-b]], window syntax was represented and rewritten internally, but aggregate-window frame execution was not yet a public capability. `prepare()` rejected statements requiring `sqlite3WindowCodeStep` atomically before returning a Program or Statement, including otherwise-supported compositions. The 44-case implementation gate then had 0 TypeScript attempts. The execution section below supersedes that historical accounting and boundary for the represented aggregate-only subset.

### Aggregate-window execution (2026-09-19)

The represented ordinary aggregate-window subset is executable through the normal
`Statement` API. It includes the documented default/ROWS/RANGE/GROUPS frames,
bounds and EXCLUDE forms, compatible-window sharing, and represented join,
grouped, derived, ordinary/recursive CTE and outer ORDER/LIMIT compositions.
Execution obeys the same signal, deadline, work, row, result and private-state
limits and reset/finalize/first-error rules as other VDBE programs. Unsupported
compositions reject atomically at prepare. Special built-ins use the separately
bounded execution contract below.

### Special built-in window preimplementation contract (historical, 2026-09-19)

Before [[card:card-o-d-b]], ranking, distribution, offset and value built-ins were
outside the public execution surface. The pinned 43-case gate recorded their exact
contract with 0 TypeScript attempts/credits. The execution section below supersedes
that historical boundary for represented shapes; unrepresented compositions still
reject atomically during `prepare()` without publishing a Statement or partial
Program.

## Special built-in windows (Stage 3 bounded surface)

Prepared SELECT execution includes `row_number`, `rank`, `dense_rank`,
`percent_rank`, `cume_dist`, `ntile`, `lead`, `lag`, `first_value`, `last_value`,
and `nth_value` at SQLite's registered arities. SQLite frame coercions, peer and
EXCLUDE behavior, lead/lag default offset/default value, INTEGER/REAL result types,
and prepare/step diagnostics apply on represented window shapes. Compatible
windows may share execution; represented incompatible windows nest through joins,
grouping, subqueries, CTEs/recursive producers, compounds, and outer ORDER/LIMIT.
An unrepresented expression or composition rejects atomically during prepare;
this does not advertise arbitrary window SQL.

### Ordinary scalar boundary

The represented SQLite 3.53.4 ordinary-scalar registry has 50/50 executable rows.
`printf`, its `format` alias, and `round` execute through the translated SQLite
formatter; `like` and `glob` execute through the translated
pattern matcher. LIKE uses `%`/`_` with ASCII-only case folding; GLOB uses
case-sensitive `*`/`?` and source-shaped classes, ranges, inversion, and malformed-
class failure-to-match behavior. Infix operands are lowered to SQLite's pattern-
first callback order. LIKE accepts the registered two- and three-argument forms;
ESCAPE must decode to exactly one character (through the first embedded NUL) and
otherwise raises SQLite code 1 during `step()`. NULL propagates, text matching
stops at embedded NUL, and BLOB-to-text observables follow the physical database
encoding. Pattern length, work, cancellation, and deadline controls are bounded;
the implementation uses no RegExp, native SQLite, eval, or host callback.
Date/time and the profile-enabled math scalar families are exposed through the same registry and VDBE Function dispatch; JSON and host function/log callback registration are not exposed. Math includes the documented SQLite 3.53.4 names/aliases and arities (`ceil` through `pi`) with each wrapper's SQLite numeric conversion (including two-argument `log`'s distinct value-double conversion for its second argument), NULL/domain handling and REAL result classes. Delivered scalar results preserve the five public
storage classes, database-encoding conversion, embedded NUL, and int64 `bigint`.
Read-only `last_insert_rowid()`, `changes()`, and `total_changes()` return integer
zero. `sqlite_log()` is a SQL NULL-producing no-op because this API has no host log
callback. `quote(REAL)` uses pinned `sqlite3QuoteValue` `%!0.17g` semantics (REAL literal identity, round-trip boundaries, signed zero, and `±9.0e+999` infinities), and quote TEXT/BLOB expansion is checked against `maxResultBytes` before construction.

SQL formatting preserves SQLite's supported flags, width/precision, integer and
REAL conversions, `%q`/`%Q`/`%w`, missing/NULL arguments, and embedded-NUL format
termination. Formatting is locale-independent and does not expose a host printf.

Owned ordinary scalar builders honor `maxResultBytes` before oversized string/BLOB materialization and charge deterministic work while scanning or producing results. `instr` comparison loops, Unicode escape/quote builders, trim/unhex/concat/char loops, and random/zero BLOB production observe work, cancellation, and deadline controls at bounded intervals. A scalar execution error is saved on its statement: repeat `step()` and `finalize()` report the first error, while `reset()` reports it once and restores statement reuse; the connection remains usable.

### Ordinary math functions

The pinned `SQLITE_ENABLE_MATH_FUNCTIONS` profile exposes exactly these 30
name/arity rows (29 distinct names) through ordinary `prepare()` and statement
execution:

| Arity | Names |
|---|---|
| 0 | `pi` |
| 1 | `ceil`, `ceiling`, `floor`, `trunc`, `ln`, `log`, `log10`, `log2`, `exp`, `acos`, `asin`, `atan`, `cos`, `sin`, `tan`, `cosh`, `sinh`, `tanh`, `acosh`, `asinh`, `atanh`, `sqrt`, `radians`, `degrees` |
| 2 | `log`, `pow`, `power`, `mod`, `atan2` |

`ceil` and `ceiling` are aliases, as are `pow` and `power`. `ceil`, `ceiling`,
`floor`, and `trunc` preserve an INTEGER argument's exact signed-int64 payload and
storage class; when their argument is REAL they return REAL. Every other
successful math callback returns REAL, including calls whose arguments are
INTEGER. Consequently INTEGER inputs to unary/binary libm callbacks first undergo
SQLite's double conversion and may lose low-order precision.

The wrapper-gated arguments accept INTEGER, REAL, or wholly numeric TEXT under
SQLite numeric conversion; NULL, BLOB, nonnumeric TEXT, and numeric-prefix-only
TEXT produce NULL. The second argument of two-argument `log(B,X)` follows pinned
`sqlite3_value_double()` instead, so it accepts a numeric prefix and BLOB bytes in
the database encoding before the positive-domain check. Invalid domains and NaN
results produce NULL; finite values, signed zero, and infinity retain REAL storage.
Wrong arity is a SQLite prepare error under the ordinary built-in contract.

ECMAScript `Math` is the browser-safe adaptation of the pinned C-libm callbacks.
The captured public corpus pins exact IEEE-754 results on the development oracle
and current JavaScript engine, but finite transcendental last-bit identity across
different host libm/ECMAScript implementations is not a public portability
guarantee.

### Value-list `IN` conformance note (2026-09-20)

Within the documented prepared read-only SELECT surface, scalar value lists are
accepted in `expr IN (expr, ...)`, `expr NOT IN (expr, ...)`, and their empty-list
forms. Results use SQLite three-valued membership semantics, shared comparison
affinity/collation, ordered RHS evaluation, and parameter binding. Public statement
lifecycle behavior includes repeatable results after `reset()`, stable first-error
identity, and ordinary `finalize()` cleanup. This bounded statement does not admit
or promise subquery/index-backed `IN`, host function registration, or broader SQL
forms not otherwise documented. The conformance tranche is deliberately zero-
credit: 21 cases run against each of UTF-8, UTF-16LE and UTF-16BE fixtures.

### Internal immutable schema constraint metadata

Schema initialization used by the read pipeline retains generated-parser CHECK and
REFERENCES/FOREIGN KEY declarations (ordered expressions/source, local and referenced
columns, target-table identity links, actions, and deferral state). The same graph is
validated in all three database encodings; a public Chinook Fetch capture is accepted
only at 1,007,616 bytes and SHA-256
`7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`, then compared
with source-ID-verified SQLite 3.53.4 read-only behavior. This is not a new
public schema-introspection API, does not expose `sqlite_schema` through SQL, and does
not add write-time constraint enforcement.

## JSON built-ins

The read-only SQL surface currently includes `json(X)`, `jsonb(X)`,
`json_valid(X[,flags])`, `json_extract(X,path,...)`, JSON array/object aggregates,
and the bounded `json_each`, `json_tree`, `jsonb_each`, and `jsonb_tree` table
routes described below. Results follow SQLite storage classes:
canonical JSON is TEXT, JSONB is `Uint8Array`/BLOB, validity is INTEGER, and SQL
NULL remains NULL. Canonical JSON TEXT carries SQLite's private subtype 74 across
expression composition. JSONB is instead a subtype-0 BLOB recognized by validated
SQLite JSONB structure, matching the pinned `jsonb` result flags; this distinction
is internal and the public value remains the documented TEXT/BLOB value. Malformed
JSON is a `JSQLiteError` with `kind:"sqlite"`; statement work, result-byte,
cancellation and deadline controls apply normally.

The current table-valued surface is intentionally narrower than SQLite's module:
The internal `json_each`, `json_tree`, `jsonb_each`, and `jsonb_tree` table sources
accept one or two scalar-expression arguments through the ordinary Fetch
metadata/value contract. Visible expression projection, WHERE, ORDER/LIMIT/OFFSET, grouped aggregate projection/HAVING, physical-left correlation, and two-source left-to-right JSON correlation are admitted;
`json` and `root` may be read explicitly but remain absent from `*`. A direct JSON
source column reports the underlying column name (rather than its SQL qualifier),
`database: "main"`, the eponymous function table name, and its origin; an explicit
alias overrides the result name. Computed expression names preserve their SQL
source text and have null source metadata. The eight visible fields have no declared
SQL type; the hidden `json` and `root` fields preserve SQLite's empty declared-type
string. Mixed physical/JSON joins retain each direct source column's own declared
and origin metadata. The recursive
`json_tree` producer follows
pinned depth-first JSONB-offset id/parent shaping. Direct public evidence includes
scalar-root `fullkey`, rooted parameter scans and reset, hidden columns, JSONB
container values, ORDER/LIMIT/OFFSET, and JSON-to-JSON correlation. RIGHT/FULL mixed joins, reverse correlation, and advanced aggregate-modifier compositions
remain typed temporary unsupported, not compatibility credit.

### JSON scalar functions

Prepared SELECT expressions support SQLite JSON scalar inspection, constructors,
mutation/merge patch, and `->`/`->>` operators through the ordinary public
Statement/Fetch value and `columnType` contract. JSON values are represented as
TEXT with private subtype chaining; JSONB is SQLite JSONB in BLOB values. No host
function registration or PostgreSQL JSONB interpretation is involved.

### JSON aggregates

The built-in aggregate/window surface includes `json_group_array(X)`,
`json_group_object(NAME,X)`, `jsonb_group_array(X)`, and
`jsonb_group_object(NAME,X)`. Text forms return canonical JSON text; JSONB forms
return SQLite JSONB as `Uint8Array`. Empty inputs return the appropriate empty
container rather than NULL. JSON-producing subtype values embed structurally,
ordinary SQL text is quoted, ordinary BLOB values fail, and duplicate object
labels/order follow SQLite. They use the same operation limits, cancellation,
reset/finalize lifecycle, and represented window-frame support as other built-in
aggregates.

JSONB scalar output names `jsonb_array`, `jsonb_object`, `jsonb_insert`,
`jsonb_replace`, `jsonb_set`, `jsonb_remove`, `jsonb_patch`, and
`jsonb_array_insert` return SQLite JSONB BLOBs; `json_array_insert` returns JSON
TEXT. `json_pretty` is recognized at arities 1 and 2 but currently fails with a
typed temporary-unsupported error rather than an approximation.

JSON mutation paths follow SQLite sequencing: NULL path/value pairs are skipped
for insert/replace/set/array-insert; root `$` removal returns SQL NULL and stops;
and valid `[#-N]` addresses from array end (`#-0` is the append position).

JSON document arguments retain SQLite's compatibility treatment for BLOB input:
recognized JSONB is parsed as binary; a non-JSONB BLOB is interpreted as UTF-8 JSON
text. This does not make BLOB a JSON value type—passing an ordinary BLOB as a value
to `json_array`, `json_object`, or JSON aggregates remains an SQLite error.

The bounded represented shape consisting of a grouped/ordered/limited CTE producer
as source 0, joined to one ordinary schema table, executes through the public
Fetch path. It preserves typed values and metadata and supports one represented
outer `ORDER BY` term. The producer is materialized within the same VDBE and is
subject to the statement's work/private-state and lifecycle controls. Other
represented derived/CTE compositions that no translated consumer accepts remain
atomic prepare-time temporary gaps (`this derived CTE composition is not
implemented`), rather than being misreported as missing schema tables.

### `BETWEEN` and computed result names (2026-09-22)

The admitted expression surface includes scalar and predicate `BETWEEN`/`NOT
BETWEEN` with SQLite comparison affinity, collation and three-valued NULL behavior.
The lhs is evaluated once; observable lower/upper evaluation follows the applicable
projection or predicate control path. Unaliased computed columns report the exact
original SQL expression slice, including spacing/comments/Unicode; `AS` wins, and
a direct qualified column reports its resolved column name. This does not add host
function registration. SQL is supplied as a JavaScript string; the implementation's
UTF-8 source-byte adaptation is the tested contract, not alternate SQL encodings.

### WHERE planning implementation note

The existing prepared-statement API is unchanged. Persistent-index selection and
its nine production-private counter families are implementation-private; counter
access is limited to the conformance adapter and is not exported by the package.
All nine begin fresh at zero for each execution/reset. Their operation-shaped
semantics, including `inProbes`, are defined by the authoritative private
accounting contract in `docs/TRANSLATION.md` and tested as described in
`docs/CONFORMANCE.md`; they are not public statement-status or diagnostics.
Reset, rebind, finalize, deadline, cancellation, row/work/output limits, and
deferred close retain their documented public behavior while the immutable
selected plan and bindings are retained as applicable.

### Advanced index public boundary (revision 2026-09-23)

Single-table read-only SELECT admits represented ordinary secondary-index access and represented WITHOUT ROWID tables through the same public `prepare`/bind/step/reset/finalize API in UTF-8, UTF-16LE, and UTF-16BE databases. The WITHOUT ROWID subset accepts column-only composite primary keys and column-only secondary keys using built-in BINARY/NOCASE/RTRIM collations, ASC/DESC direction, and default SQLite NULL ordering. It includes exact/prefix primary traversal, secondary covering reads from appended primary-key terms, and non-covering secondary lookup of the primary BLOBKEY using exact PK-term-to-record-field mapping (including mixed declared/auxiliary, reordered, suffix-free, and collation-duplicate layouts). Values, limits, lifecycle, and corruption errors retain the existing public contracts; no planner diagnostics are public.

Partial-index implication and expression-index selected access are not part of this revision's credited boundary. Unsupported collation/NULL-order modifiers, expression/partial physical layouts, or descriptors that cannot preserve the complete key identity are not approximated: they remain excluded from selection or fail atomically as temporary unsupported. Covering access includes residual WHERE and ORDER/sorter reads, not projection alone.

Bounded SELECT implementation note (card-t-b): unordered unlimited
nonaggregate table-backed `UNION ALL` RHS of `IN` is admitted via a shared
Set destination. This does not promise general compound scalar/EXISTS, ordered
or limited compound SELECT support; unsupported preparation remains subject to
normal error handling.

The same bounded unordered unlimited nonaggregate table-backed UNION ALL
producer also supports scalar and EXISTS expression destinations, including a
NULL first scalar row. This does not extend support to general ordered/limited
compound expression subqueries.

The bounded unordered unlimited UNION ALL scalar/EXISTS/IN expression shape
may mix table-backed arms with simple no-FROM single-row arms. General
compound expression support remains outside this bounded contract.

For the bounded mixed unordered unlimited UNION ALL expression shape,
no-FROM arms may precede table-backed arms. Mem/EXISTS keep the first
accepted row, including NULL, while IN/Set collects both arms.

In the bounded unordered unlimited mixed UNION ALL expression subset, a
no-FROM arm's represented WHERE may reject that arm's single candidate before
projection. The next arm then supplies the first Mem/EXISTS row, or IN/Set
collects all accepted values. No general compound guarantee follows.

The bounded unordered, unlimited UNION ALL expression subset also accepts
represented WHERE on all no-FROM arms: a rejected candidate does not evaluate
its projection or occupy the first-row scalar/EXISTS destination. This does not
extend the supported ordered/limited or set-operator subset.

SELECT compiler checkpoint (card-t-b): ungrouped aggregate expression children
with independent `ORDER BY` aggregates use the same Mem/Exists/Set destination
as projected aggregate children; the single result row has no sort order to
apply. This does not extend compound/window SELECT admission or guarantee
completion of the internal compiler migration.

Zero-source aggregate expression subqueries (`count(*)`, `sum(1)` and
false-WHERE count in the tested scalar/EXISTS/IN positions) compile into the
parent VM's Mem/Exists/Set destination; false WHERE still produces one
aggregate row. LIMIT 0 suppresses publication. This is not a guarantee for
ordered, grouped or compound aggregate expression subqueries.

In the bounded unordered ungrouped no-FROM aggregate expression child,
HAVING tests the finalized aggregate before Mem/Exists/Set publication:
false HAVING yields NULL/0/no IN entry; false WHERE still finalizes `count(*)`
as zero. Ordered/grouped/compound variants remain outside this guarantee.

For the bounded ungrouped no-FROM aggregate expression child, independent
ORDER BY aggregates are resolved and evaluated in the accumulator context;
one output row needs no sorting. Invalid ordinal resolution remains a
prepare-time error. This does not extend independent ORDER behavior to
ordinary nonaggregate no-FROM children.

In the bounded no-FROM nonaggregate expression child, independent ORDER BY
expressions are resolved even though the sole candidate cannot be reordered.
Invalid ordinals and unknown names fail during prepare (including LIMIT 0);
valid independent keys preserve scalar/EXISTS/IN destinations. This does not
extend admission to multirow ordered compounds or retire the remaining
completed-child program splice.

For the bounded zero-source GROUP BY expression child, a WHERE-accepted
candidate forms one group; a rejected candidate forms none. Scalar/EXISTS/IN
and LIMIT 0 retain the enclosing destination's usual NULL/0/set semantics.
This does not imply general grouped compound or window support.

For the admitted zero-source derived `count(*)` expression child, outer
LIMIT/OFFSET filters its final aggregate row independently of the derived
source's LIMIT/OFFSET filtering its input. LIMIT 0 yields NULL for scalar and
0 for EXISTS/IN. General derived aggregate support is not implied.

For the admitted zero-source derived `count(*)` scalar/EXISTS/IN child,
`HAVING count(*)` predicates filter the finalized row, including the empty
input count 0. Outer LIMIT/OFFSET applies separately. This does not promise
general derived-table aggregate HAVING support.

The bounded scalar/EXISTS/IN zero-source derived count(*) child resolves
ORDER BY expressions, result aliases, valid ordinals and qualified or
unqualified derived-result columns before preparing its one aggregate result;
invalid ordinals/names fail prepare even under LIMIT 0. This does not imply
general derived-table materialization or multirow sorted aggregates.

For the bounded zero-source derived `count(*)` child, outer WHERE can filter
the derived row (including a qualified derived-result column) before counting;
no accepted row still finalizes count to zero before HAVING and outer LIMIT.
Invalid derived names and aggregate use in WHERE fail preparation even under
LIMIT 0. This does not promise general materialized derived aggregates.

The bounded no-FROM derived producer of scalar/EXISTS/IN `count(*)` may
project multiple named columns; outer WHERE can bind each column (including
SQLite's deduplicated `:1` name) before counting the single accepted row.
This is not a general multirow derived-table aggregate.

A bounded one-candidate no-FROM derived `count(*)` producer can carry inner
ORDER BY expressions, aliases and ordinals; invalid names and ordinals fail
prepare even under LIMIT 0. This does not implement ordering of multirow
derived aggregates.

A bounded no-FROM DISTINCT derived producer can feed the scalar/EXISTS/IN
count(*) destination: at most one projected row reaches the outer accumulator.
This does not cover multirow DISTINCT or materialized derived aggregation.

In the bounded one-candidate no-FROM derived producer, `count(expr)` counts
the candidate only when its bound derived-result argument is non-NULL;
`count(*)` counts any accepted row. Unknown result columns fail prepare even
under LIMIT 0. Distinct/filter variants and unrelated HAVING aggregates are
not promised by this route.

The bounded one-candidate derived count path can evaluate different `count`
arguments in HAVING independently (for example count(x) versus count(y));
these do not alias the projected count. Other aggregate families, DISTINCT
aggregate arguments and general materialized derived sources are not covered.

For a derived no-FROM producer with at most one candidate, count(DISTINCT x)
obeys count(x)'s NULL rule and can coexist with an ordinary count in HAVING.
This is not a multirow distinct-aggregate contract.

On the bounded one-candidate derived count route, FILTER predicates gate each
aggregate separately, before its argument and AggStep; unknown result columns
and nested aggregate FILTERs fail at preparation even under LIMIT 0. This does
not promise multirow derived FILTER/DISTINCT execution.

On the one-candidate derived count route, aggregate ORDER keys resolve and
execute after FILTER, before count's argument; a single accepted row needs no
sorter. Invalid ORDER column or nested aggregate still fails preparation under
LIMIT 0. No general ordered-aggregate claim follows from this route.

The bounded derived no-FROM numeric aggregate route preserves sum/avg/total
empty-input distinctions: sum and avg return NULL, total returns REAL zero.
It retains SQLite INTEGER versus REAL for nonempty numeric inputs, without a
general materialized-derived aggregate guarantee.

On the bounded no-FROM derived one-candidate route, min/max return the
non-NULL argument with its type and NULL on empty or NULL input, including
argument collation binding. This does not establish general multirow derived
extrema support.

The bounded one-candidate derived route also admits group_concat(value[,separator])
and string_agg(value,separator): NULL/empty values finalize to NULL and a
non-NULL single value retains TEXT. Multirow derived aggregation is not
covered by this route.

The bounded one-candidate derived producer may have a GROUP BY: a rejected
no-FROM input yields no group, while an accepted input yields one. GROUP BY
names and ordinals are validated at prepare even with LIMIT 0; inner HAVING
and general multirow grouping remain separate unsupported compositions.

For the bounded single-candidate derived GROUP BY composition, a nonaggregate
inner HAVING filters its one possible group before OFFSET and outer aggregate
consumption. Invalid inner names fail preparation even with LIMIT 0. This
does not admit inner aggregate HAVING or multirow grouped materialization.

The bounded no-FROM derived GROUP BY composition supports inner HAVING
`count(*)` over its zero/one group. Rejected input creates no group; an accepted
group finalizes its own count before HAVING and producer OFFSET. This does not
extend inner aggregate HAVING to other functions or multirow materialization.

Within the bounded one-candidate derived GROUP BY composition, inner HAVING
can use supported count(expr), numeric, extrema and string aggregates; their
own FILTER/arguments/finalization precede HAVING and producer OFFSET. This
is not a general multirow GROUP BY or aggregate-ORDER implementation.

Inner HAVING aggregate ORDER keys are validated and evaluated in the bounded
no-FROM single-group derived composition. With at most one candidate, their
sort order cannot change a result; multirow aggregate ORDER is not implied.

A bounded uncorrelated scalar `count(*)` over an ordered/limited ordinary-table
nonaggregate derived SELECT now feeds the enclosing statement's destination;
its producer LIMIT/OFFSET determine the integer cardinality, including zero.
EXISTS of that aggregate is true for its finalized result row and IN compares
the typed integer. This does not imply support for arbitrary materialized
subqueries or aggregate arguments over their projected columns.

For bounded scalar aggregate subqueries over an ordered/limited ordinary-table
projection, direct `count(column)`, `sum(column)`, `avg(column)` and
`total(column)`, `min(column)` and `max(column)` accept a projected derived column, returning SQLite typed
INTEGER/REAL/NULL as applicable. Missing derived columns fail preparation even
with LIMIT 0. This does not promise arbitrary derived aggregate expressions,
outer predicates or general multirow materialization.

For the bounded uncorrelated derived-row scalar aggregate route, supported
single-argument count/sum/avg/total/min/max can evaluate expressions over
projected derived columns after producer ORDER/LIMIT/OFFSET; invalid projected
names fail at prepare, including when LIMIT is zero. This is not a general
materialized derived-table or nested-subquery argument guarantee.

In that bounded uncorrelated derived-row aggregate route, a non-nested FILTER
may refer to projected derived columns; false and NULL FILTER rows skip the
argument and aggregate step. Invalid FILTER column names fail preparation
including with producer LIMIT 0. This does not extend the route to nested
FILTER subqueries, DISTINCT or aggregate ORDER BY.

The bounded derived-row scalar aggregate route also accepts a single DISTINCT
argument for count/sum/avg/total/min/max, optionally with a non-nested FILTER;
duplicates compare under the argument collation after producer ORDER/LIMIT.
This does not guarantee aggregate ORDER BY or arbitrary materialized producers.

The same bounded scalar derived-row route accepts aggregate ORDER BY for
single-argument count/sum/avg/total/min/max. The producer first applies its
own ORDER/LIMIT/OFFSET; the aggregate then sorts accepted arguments after
FILTER and optional DISTINCT and finalizes even for zero accepted rows.
ORDER key names fail at prepare under producer LIMIT 0. This is not general
aggregate ORDER or a guarantee for string_agg/group_concat.

Bounded SELECT compilation note: uncorrelated `group_concat(x ORDER BY y)`
over an ordinary-table, non-grouped derived row producer uses the enclosing
sorter/aggregate destination, including FILTER and DISTINCT and the default
comma separator. This is not a general derived-table or two-argument string
aggregation guarantee. Preparation errors and reset/finalize remain statement
owned; see the scalar-child conformance probes.

The same bounded uncorrelated derived-row consumer also accepts
`group_concat(value,separator ORDER BY key)` and
`string_agg(value,separator ORDER BY key)` with optional non-nested FILTER;
DISTINCT still requires exactly one argument. Both arguments bind at prepare
(including producer LIMIT 0). This supersedes the earlier two-argument
exclusion for this bounded route, not for all derived or grouped SELECTs.

For that same bounded uncorrelated derived-row aggregate route, a non-nested
outer WHERE over projected columns gates candidate rows after producer
ORDER/LIMIT/OFFSET and before aggregate FILTER/ORDER/DISTINCT. Invalid outer
WHERE column names fail at prepare even with producer LIMIT 0; this is not a
general materialized derived-table or correlated-WHERE guarantee.

For this same bounded derived-row aggregate consumer, an outer LIMIT/OFFSET
is independent of the producer's LIMIT/OFFSET: outer LIMIT 0 or OFFSET 1
suppresses the sole aggregate row in scalar, EXISTS and IN destinations. Names
still bind at prepare, including with LIMIT 0. This does not extend support
to arbitrary derived/grouped aggregate shapes.

For the bounded uncorrelated ordinary-table derived-row aggregate destination,
outer ORDER BY aliases, ordinals and projected-column expressions are checked
at prepare (even with outer LIMIT 0). Its single aggregate row requires no
additional outer sort; producer ORDER and aggregate argument ORDER retain
their own ordering and limit semantics. This is not a general ORDER guarantee
for arbitrary derived or grouped producers.

Selected inner-join index access evaluates a dependent IN/range RHS only after
its selected preceding source is positioned; LEFT/RIGHT NULL-row continuation
retains source order. The mixed IN/range public regression is bounded to the
represented index/outer-join shapes in three encodings, not general optimizer or
STAT4 parity (`test/conformance/mixed-in-range-red.test.mjs`).

Bounded derived-source revision ([[card:card-t-c]]): `Connection.prepare()` also
admits a pair of non-flattenable constant unordered `UNION ALL` FROM subqueries
with direct column projection, an inner-join equality or column/literal `ON`
condition, and ascending result ordinals in the outer `ORDER BY`. The two
producers share one prepared statement and materialize into separate transient
cursors before the parent join; `reset()` re-executes them. This is not a
promise of general compound-derived/CTE, collations, outer joins, child ORDER or
LIMIT support. Shapes outside the translated boundary must reject atomically
with temporary `unsupported` rather than return partial rows. The paired native
and public cases are `test/conformance/select-derived-composition-native.py` and
`test/conformance/select-derived-composition.test.mjs`.

The bounded parent SELECT route also accepts two distinct explicitly
`MATERIALIZED` constant unordered `UNION ALL` CTE producers with direct-column
parent projection, admitted inner-join equality, and ascending ordinal outer
`ORDER BY`. Each declaration materializes into its own transient cursor before
the parent scan; public `reset()` reruns the statement. This does not imply
support for nonmaterialized/recursive/ordered/aggregate compound CTEs or
arbitrary CTE joins. See the pinned/public paired
`test/conformance/select-cte-compound-composition-{native.py,test.mjs}`.

For the bounded two-materialized constant `UNION ALL` CTE route, each no-FROM
`SELECT` arm may also carry a WHERE predicate. Its gate runs before that arm
materializes, not after the parent join; e.g. filtering the first arm does not
suppress a later arm. This does not extend support to table-backed compound
arms or arbitrary nested correlated expressions. See the pinned/native and
public `test/conformance/select-cte-compound-where-{native.py,test.mjs}` pair.

The bounded MATERIALIZED pair route also admits a physical-table-backed,
WHERE-filtered unordered `UNION ALL` arm when the parent joins two CTE sources.
Each arm emits into its CTE materialization destination before the parent join;
unsupported arm shapes are not partially published. This is not general
correlated, ordered, aggregated or parameterized compound support. Paired native
and public fixture controls: `test/conformance/select-cte-table-compound-parent-native.py`
and `select-cte-table-compound-parent.test.mjs`.

Two explicitly MATERIALIZED CTEs in the bounded parent join may also combine
an ordered/LIMIT physical-table producer with an unordered constant UNION ALL
producer. The table producer's ORDER/LIMIT applies to its CTE rows *before*
the parent joins the two destinations. See the paired pinned/native and public
`test/conformance/select-cte-ordered-mixed-parent-{native.py,test.mjs}`;
this does not guarantee arbitrary ordered compound or correlated CTE shapes.

A bounded correlated scalar `count(*)`/`sum(x)` over a single-column, no-FROM
`UNION ALL` derived source is currently supported in a physical-table SELECT.
Other correlated derived subquery shapes may still raise a temporary unsupported
error at prepare; this is not a general compound-subquery guarantee.

Within that bounded correlated derived aggregate path, qualified outer rowid
and ordinary columns retain their resolved identity; missing qualified columns
are preparation errors rather than deferred evaluation failures. This does not
extend support to general correlated derived SELECT shapes.

For the supported correlated physical-table scalar aggregate path, qualified
outer rowid is bound as the rowid column and linked missing-name/inner ambiguity
errors are reported during preparation. This does not imply support for all
correlated scalar shapes or joined-scalar producers.

Supported joined-row correlated scalar count now respects qualified outer
rowid and the second outer joined source; inner ambiguous names and missing
outer names fail during preparation. Other joined scalar shapes remain subject
to typed temporary unsupported classification, not a promise of general
correlated expression support.

Bounded correlated scalar aggregates over no-FROM constant `UNION ALL` derived
rows accept multiple projected columns, including SQLite's `:1` suffix for
duplicate projected names. Missing names still fail preparation; this does
not extend support to general derived producers.

For the admitted table-backed `UNION ALL` derived projection, output aliases
follow the first arm's collision-free transient names (`x`, `x:1` for duplicate
`x` aliases); each arm's qualifying rows are returned in arm order. Unknown
projected names fail during preparation. This is bounded support, not a general
compound-derived SELECT guarantee. The bounded table-backed arms now share a
parent-owned output/sorter destination and drain each arm before the next;
this is not a promise that other derived/compound or coroutine routes share
that lowering.

#### Bounded window-derived materialized source (implementation note)
For the admitted single-source window-derived outer predicate route, the child
window rows are materialized in the enclosing program before outer WHERE,
ORDER and LIMIT/OFFSET. The pinned/public `select-derived-window-parent-*`
checks INTEGER ranks, projected name, reset, zero LIMIT, missing projected name
(`no such column`, SQLite code 1), finalize and close. This does not admit all
window-derived shapes; unsupported forms remain temporary at prepare.

#### Bounded table-backed LIMIT-derived producer (implementation note)
For the admitted single-column, single-table inner SELECT with LIMIT and no
inner WHERE/ORDER, DISTINCT, compound or window, `prepare` exposes the child
column name; missing projected names produce SQLite `no such column` (code 1).
The inner scan yields typed INTEGER cells into the parent's coroutine; inner
and outer LIMIT/OFFSET are independent, and `reset` replays the query.
Pinned/public `test/conformance/select-derived-table-parent-*` check metadata,
limits, reset, error, finalize and close. This does not admit general table or
window derived shapes; unsupported variants remain temporary at prepare.

#### Bounded ordered non-VALUES derived producer (implementation note)
The admitted single-column no-FROM ordered UNION ALL derived coroutine uses
parent-owned typed sorter and registers. Projected missing names fail at
prepare with SQLite `no such column` (code 1); source/outer LIMIT and OFFSET,
INTEGER cells, metadata, reset, finalize and close are covered by pinned/public
`test/conformance/select-derived-nonvalues-parent-*`. This does not promise
general compound, other table-backed or window derived producer support; those
remaining fallback branches require separate admission tests.

#### Bounded derived VALUES producer (implementation note)
For an admitted single-source derived multirow `VALUES` query, `prepare`
exposes the projected names and reports missing projected names as SQLite
`no such column` (code 1). `step` retains INTEGER versus REAL, NULL, TEXT
and BLOB values; `reset` replays all rows, `finalize` releases VM resources.
This is not general derived/compound SELECT support: unimplemented shapes
remain temporary unsupported at prepare, not partial result programs. Pinned
and public evidence: `test/conformance/select-derived-values-parent-*` and
`derived-values-registers.test.mjs` (all three fixture encodings).

A bounded unordered `UNION ALL` arm may read a one-column constant ordinary,
MATERIALIZED, or repeated NOT MATERIALIZED CTE using the shared compound
statement destination. This is not general CTE/compound support; unsupported
arm producer shapes remain prepare-time temporary unsupported.
