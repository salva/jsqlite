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

Singular Fetch admits the captured scalar subquery, EXISTS, IN/NOT IN, and correlated expression routes, including the documented bounded JOIN/aggregate/GROUP/HAVING/ORDER/DISTINCT/LIMIT/compound compositions. Results retain SQLite INTEGER/REAL/NULL/BLOB distinctions and database encoding. Uncorrelated producers may execute once; correlated producers rerun for each outer row. In the represented physical-table IN/NOT IN expression-subquery target, CASE descendants (operand/WHEN/THEN/ELSE) retain resolved source-column identities; this does not admit arbitrary CASE/subquery compositions. Reset/rebind/finalize/deferred-close and cancellation/deadline/work/private-byte failures preserve the first error, release owned state, and restore admission as tested. Compound ORDER terms bind by resolved output ownership and structural expression identity, not SQL token spelling. WITH support is limited to the bounded ordinary and recursive surfaces below; aggregate windows use the separately bounded surface below, while unsafe unmatched forms remain unsupported atomically at prepare.

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

Physical one-column compound table arms with GROUP BY/HAVING are currently
prepare-time `unsupported` / `temporary`; these clauses are never silently
ignored by the raw table compound producer. This restriction does not change
represented standalone/noncompound grouped aggregates. Ordinary arm DISTINCT
remains local to its SELECT, including UNION ALL tails.

The physical grouped-compound temporary boundary has a bounded exception:
unordered derived UNION ALL with supported physical GROUP BY in every arm now
uses each arm's aggregate producer, preserving per-arm HAVING and common
LIMIT/OFFSET. Mixed grouped/raw, ordered or set-operator forms remain temporary.

The unordered derived physical UNION ALL grouped exception also represents
mixed grouped/ordinary physical arms. Per-arm WHERE, GROUP and HAVING keep their
own producers; all arms share compound LIMIT/OFFSET. Ordered and set-operator
grouped compounds remain prepare-time temporary unsupported.

Represented grouped/mixed physical derived UNION ALL column projections now
retain rightmost-arm declared type and database/table/origin metadata, including
projection names from the leftmost arm; origin follows the rightmost arm.

For represented raw physical compound-derived column projections as well as
mixed/grouped ALL, output names come from the leftmost arm while type/origin
metadata follows the derived rightmost Select source. A later arm alias does
not rename the derived output column.

Direct represented physical compound SELECT metadata uses the leftmost output
arm; this differs from the derived-wrapper type/origin rule above. Aliases in
later arms do not change direct output names or origins.

The represented specialized joined-first/scalar-tail ordered UNION ALL branch
retains its rows and metadata contract while composing the join producer in
one parent program; this does not extend general ordered compound support.

Represented ordered UNION ALL composition emits all intermediate VALUES rows,
including when a physical join is another arm. VALUES in the final arm still
follows SQLite syntax restrictions on a following ORDER BY clause.

Represented one-column physical ordered ALL composition retains GROUP BY and
HAVING per arm. False or NULL HAVING suppresses only that arm's output; it does
not filter another join or scalar arm. Unrepresented GROUP/HAVING carriers
remain temporary unsupported instead of silently ignored.

Represented ordered ALL respects explicit output COLLATE in the first available
arm and explicit ORDER BY COLLATE overrides. This correction does not establish
general expression collation propagation through every scalar function.

Within represented ordered ALL, CAST and unary plus preserve their source
column's collation. Concatenation does not implicitly inherit a column collation.

Comparison expressions do not implicitly inherit source column collation through
concatenation, ordinary scalar functions or CASE. CAST/unary plus preserve it;
absent left collation permits the right source column collation before BINARY.

Scalar min/max and nullif choose the first argument with a collation (including
an implicit source column collation). A later explicit COLLATE does not replace
that first argument's collation; function-result comparison remains separate.

Represented ordered ALL permits per-arm DISTINCT, including a DISTINCT physical
arm after a join arm. Only that arm's duplicate rows are suppressed; ALL preserves
matching rows from different arms.

Represented ordinary DISTINCT uses result-expression collation: CAST and unary
plus preserve column NOCASE for duplicate filtering; concatenation does not.

Direct single-table DISTINCT and represented parent-destination DISTINCT use
the same expression-collation duplicate-key contract.

For admitted top-level zero-FROM grouping, `SELECT 1 GROUP BY 1` returns one
INTEGER row named `1`; `WHERE 0` returns no group. GROUP BY ordinals refer to
result expressions. Out-of-range ordinals, unknown group names, and aggregate
result expressions used as GROUP BY keys are SQLite code 1 prepare errors,
not temporary-unsupported errors. Ordinary statement reset/finalize rules apply.


Unordered UNION ALL window arms now share the existing window destination
lowering. Admitted arms preserve complete rows (including empty arm transitions)
without publishing a first-arm-only Statement. Compound ORDER, set operators,
and compound-wide child LIMIT on window arms remain temporary unsupported;
outer derived LIMIT/OFFSET applies after the producer. Wider transient window
arm contexts remain bounded by their existing resolver/producer admissions.

Retained compound-arm derived LIMIT/OFFSET gap: parser now recognizes clauses
owned by a FROM SrcItem Select as nested, not misplaced arm ORDER/LIMIT
(parse.y623ff composition). Native nested LIMIT2/OFFSET1 arm+scalar returns
INTEGER[5,7,8]; public formerly parse-error then, after ownership repair,
no-such-table:n. select.c4336–4340 restrictions13–15 prevent flattening this
producer. No materialization implementation is claimed: descriptor/emitter
owners now reject retained non-CTE derived arms atomically typed temporary
before physical schema lookup. Standalone/derived wrappers both covered;
ordinary flattened renamed arms remain supported. Next implementation needs
shared builder/parameters/destination on compileDerivedProducer, including
caller coroutine termination and LIMIT after child output, not flattening
OFFSET or copying completed child programs.

Nested limited ordinary physical arm supersedes the preceding blanket gap:
compileDerivedProducer accepts enclosing builder/parameters/destination for its
existing single physical child path. InitCoroutine patches use local init PC,
resolver uses enclosing cursor floor, allocators propagate high-water, output
uses caller destination, exhaustion falls through without Halt/freezing shared
ops. Child LIMIT/OFFSET remains inside child coroutine; parent output remains
outside (select.c8055–8074). Native/public nested LIMIT2/OFFSET1+scalar [5,7,8]
and existing reset/finalize pass. Shared owner conservatively declines DISTINCT,
ORDER/WHERE/aggregate/window/multiple-source parents and nonordinary children;
compound-wide LIMIT on retained arm also stays temporary. Descriptor resolution
uses child descriptors then transient names; emitter makes final shape admission.
General child.ops/pcMap fallback remains, no general nested-materialization claim.

Retained DISTINCT ordinary physical child is now admitted by the shared derived
owner. This delegates to existing compileInnerTableSelect result KeyInfo,
Found/IdxInsert before OFFSET/destination/LIMIT, matching select.c selectInnerLoop
codeDistinct; DISTINCT is per child, never compound ALL deduplication. It remains
unflattened (select.c4342 restriction4). Pinned/public duplicates t2[1,1,3,9]
produce child[1,3,9]+tail8; childLIMIT1/OFFSET1 => [3,8], empty child => [8].
No ORDER/window/aggregate/nested child admission change. General copied child
fallback and shared compound-limit filtering still unresolved.

Retained ordinary physical derived arms now carry compound LIMIT/OFFSET output
through compileCteUnionAll's existing emitRow continuation. The derived consumer
calls it after local child coroutine Yield; shared compound iOffset/iLimit never
replaces the child's own limit. Shared stops patch to compound end, not child
EndCoroutine; zero LIMIT still resolves all arms before publication. This follows
select.c selectInnerLoop destination+LIMIT ordering and multiSelect shared limit.
Pinned/public child DISTINCT LIMIT2/OFFSET1 then compoundLIMIT2/OFFSET1 [9,8],
derived parentLIMIT1 [9], compoundLIMIT0[]; public missing tail under LIMIT0
errors before Statement. Limited CTE/window/aggregate arms remain temporary.
No generalized evaluator/coroutine VM alteration or finished Program relocation.

Retained physical child's ascending ORDER is now forwarded by shared derived
owner to existing compileInnerTableSelect sorter. DISTINCT before sorter insertion,
child OFFSET/LIMIT on sorter drain, then coroutine/compound output continuation
retain select.c selectInnerLoop/pushOntoSorter/generateSortTail ordering. Paired
child DISTINCT ORDERx LIMIT2/OFFSET1 + scalar [3,9,8], with compoundLIMIT2/OFFSET1
[9,8] pass INTEGER/name/reset/finalize. Descending child remains typed temporary
under existing scan-direction admission; parent ORDER is not newly admitted.
This is owner forwarding to existing specialized sorter, not new generic sort or
claim of complete ORDER/collation/NULL compatibility. Parent WHERE binding and
general fallback copier remain open.

Shared retained derived owner now forwards zero-FROM ordinary children to its
existing scalarProducer selectInnerLoop candidate instead of physical-only
admission. LIMIT/OFFSET/WHERE enters local EndCoroutine, then existing compound
output continuation. scalarProducer resolves all child names even LIMIT0 (not
only when ORDER exists), preserving atomic error before publication. Paired
scalar3 LIMIT1+tail8 [3,8], compoundLIMIT1/OFFSET1 [8]; public empty/offset/WHERE
and missing-column LIMIT0 regressions. No additional expression walker or VM
change; parent WHERE NameContext work and general copier census remain open.

Retained VALUES child compound descriptors now use transient column1..columnN
names rather than expression token names; width is validated before descriptor
publication (select.c sqlite3ColumnsFromExprList/multiSelectValues). Existing
compileDerivedProducer VALUES branch already feeds each row to coroutine then
shared compound output continuation; no emitter/VM change. Pinned/public nested
VALUES(2),(1)+scalar8 [2,1,8], compoundLIMIT2/OFFSET1 [1,8], column1/types/reset/
finalize pass. Missing projected name and mismatched VALUES width at LIMIT0
reject atomically. General transient NameContext/copy census remains open.

Standalone scalar/EXISTS over retained unordered ordinary UNION ALL now composes
compileDerivedProducer on enclosing builder with Mem/Exists destination and
first-output break (select.c SRT_Mem, expr.c sqlite3CodeSubselect). Child arms are
bounded ordinary <=1-source, no CTE/nested/window/aggregate/set/ORDER. Empty gives
NULL/0; parent LIMIT/OFFSET remain independent. Scalar compiler now emits result
body and LIMIT setup on one builder using setup/body/continuation labels, replacing
its detached resultOps append, so nested coroutine PCs remain absolute. Derived
OFFSET now targets actual resume after destination, not fixed instruction count.
Pinned standalone qualified child scalar => INTEGER1; public OFFSET1=>3,
LIMIT0/empty=>NULL, EXISTS=>1, invalid tail LIMIT0 atomic error. Expanded cases
not newly native paired. Outer compound scalar-expression emission remains
excluded; generic child.ops copier/census and affinity/collation gaps remain.

Unordered ordinary zero-FROM ALL arms now call compileScalarSelect with enclosing
builder/ParameterBuilder and output continuation, sharing its expr.c subquery
owner instead of compileExpression without subquery hook. Scalar publication/
Halt belong only to root; shared return leaves ops mutable and common compound
LIMIT/OFFSET stays in multiSelect output. Scalar entry also routes eligible ALL
to common owner, including when parser recovered nested LIMIT means top-level
FROM is empty. Pinned/public nested physical compound scalar +8 => INTEGER[1,8],
x/reset/finalize. Public common OFFSET=>[8], childLIMIT0=>[NULL,8], parentLIMIT0=>[],
invalid tail under parentLIMIT0 atomic SQLite error. Expanded probes not newly
native paired. WHERE/DISTINCT scalar arms and VALUES retain existing specialized
routes; no general correlated/JSON/ORDER/set coverage claim. General copier gate
still red, source/transitive census and C1–C6/Chinook/resources remain required.

Common ALL zero-source ordinary WHERE arms now compose shared scalar owner too.
The owner codes predicate with the same expr.c subquery hook and jumps to its
local continuation on false/NULL before result body/output; common compound
OFFSET/LIMIT only sees admitted rows. Pinned select.c8292/8347 invokes WHERE
before selectInnerLoop; where.c7020–7035 nTabList==0 tests predicate with
SQLITE_JUMPIFNULL to iBreak. No physical WHERE planner/interface changed.
Pinned/public nested scalar WHERE1+8 [1,8], WHERE0+8 [8], empty predicate EXISTS
+8 [8], predicate EXISTS true commonOFFSET1 [8], name x/INTEGER/reset/finalize.
Invalid projected child under WHERE0/parentLIMIT0 rejects atomically (public-only
new error probe). DISTINCT/VALUES/physical predicate branches retain their
specialized routes. General transient binding, clone census and full integration
remain open; this is not a general WHERE/correlation parity claim.

Common ALL ordinary zero-source DISTINCT arms now call shared scalar expression/
subquery owner, with or without WHERE. Upstream where.c6945–6952 establishes
WHERE_DISTINCT_UNIQUE for nTabList==0; select.c codeDistinct UNIQUE emits no filter.
A sole candidate needs no new KeyInfo/ephemeral set (not an algorithm exception).
The scalar owner's clause gate acknowledges that bounded shared ordinary case;
VALUES/compound/physical DISTINCT keep existing owners/boundaries. Pinned/public
nested DISTINCT scalar +8 [1,8], WHERE0 +8 [8], ALL equal tail [1,1] (no cross-arm
DISTINCT), name x/INTEGER/reset/finalize. Public NULL child plus commonOFFSET [8]
and invalid child WHERE0/parentLIMIT0 atomic error. No generic DISTINCT/correlation
or multirow VALUES parity claim. General copier/census and full integration open.

Ordinary scalar-root DISTINCT now acknowledges the same WHERE_DISTINCT_UNIQUE
single-candidate branch as shared ALL scalar arms (where.c6945–6952,
select.c codeDistinct972–976). Root versus shared destination does not change
uniqueness. Admission excludes VALUES, compound and physical FROM; ORDER/group/
HAVING retain clause gates. Root publication/Halt remains unchanged. Pinned/public
standalone DISTINCT retained-compound scalar => INTEGER1/x/reset/finalize. Public
childLIMIT0=>NULL, rootLIMIT0/rootOFFSET1=>empty and invalid child rootLIMIT0
atomic error. Expanded probes public-only. This repair does not establish general
DISTINCT, retained producer/correlation/copy-retirement or integrated compatibility.

Root ordinary zero-source WHERE is resolved by compileTableSelect then handed to
compileScalarSelect's shared expression/predicate owner, after window rewrite
and before physical scan admission. No physical WHERE interface/planner change.
select.c8292/8347 and where.c7025–7035 order zero-source predicate before result
production; false/NULL exits before output. Scalar owner root admission now accepts
WHERE as well as shared arms. Pinned/public DISTINCT retained scalar WHERE1=>
INTEGER1/x, WHERE0/NULL=>empty/reset/finalize. Public predicate EXISTS=>3, LIMIT0
empty and invalid predicate/projected child atomic SQLite errors. ORDER/VALUES/
compound/group/window retain their specialized routes/boundaries. This is not
completion of linked NameContext/correlation or general copier retirement.

Retained ordinary zero-source scalar child producer now invokes shared
compileScalarSelect expression/predicate owner with SRT_Coroutine callback
(select.c8055–8073 tag-select-0482 sqlite3Select(pSub,&dest)). Child LIMIT/OFFSET
and false predicate exit fall through to its EndCoroutine; parent/common limits
remain separate. Replaced duplicate predicate/result/DISTINCT/limit emission,
including unnecessary single-candidate set, not completed Program/PC copying.
Pinned/public nested scalar-expression child +8 => INTEGER[1,8]/x/reset/finalize.
Public childLIMIT0, childOFFSET1/DISTINCT, WHERE0, commonOFFSET1 =>[8] and invalid
projected grandchild childLIMIT0 atomic error. Expanded cases public-only.
General compound scalar/VALUES/ordered child specialized routes, transitive
copier census, linked transient affinities and full integration remain open.

Retained zero-source ALL ordinary SELECT arms now compose shared scalar
expression/predicate owner and coroutine destination under the child's common
LIMIT/OFFSET (select.c3010ff multiSelect shares limit/offset and calls sqlite3Select).
Multirow VALUES retains its specialized loop. Arm projection resets hasValues
from arm.origin, not inherited compound flags, in resolution and lowering.
Pinned/public retained nested scalar ALL =>INTEGER[1,8]/x and commonOFFSET1=>[8].
Public WHERE0/DISTINCT=>[8], NULL scalar=>[NULL,8], LIMIT0 empty and invalid child
atomic error/reset/finalize. Expanded non-OFFSET probes public-only. No complete
compound/VALUES/correlation/copy-retirement or integrated compatibility claim.

Retained ALL VALUES row ELists now use shared scalar expression/subquery owner
one row at a time, retaining row iteration/common child LIMIT/OFFSET/coroutine
(select.c multiSelectValues2862–2889 invokes selectInnerLoop for each node;
shared scalar owner supplies expression/destination body in TS).
Not scalarizing the entire multirow VALUES or introducing another evaluator.
VALUES-first retained ALL metadata now uses column1..N rather than lexical
expression text (select.c sqlite3ColumnsFromExprList). Pinned/public nested scalar
VALUES + (3) +8 =>INTEGER[1,3,8]/column1/reset/finalize. Public OFFSET=>[3,8],
NULL scalar=>[NULL,3,8], LIMIT0 empty and invalid child atomic error. Expanded
probes public-only. Standalone VALUES/ordered/set specialized expression emitters
and general copier/census/transient affinity/integration remain open.

Standalone VALUES now iterates row ELists on one SelectProgramBuilder/parameters
and uses shared scalar expression/subquery/destination owner for each one-row
body (select.c2875–2889 multiSelectValues/selectInnerLoop). Width validation and
column1..N metadata retained; every row resolves before publication; root alone
Halts/freezes. Program carries supplied database/maxRows because row subqueries
may open physical cursors: expression composition must preserve execution context,
not merely ops/registers. Pinned/public VALUES nested scalar,(3) =>INTEGER[1,3]/
column1/reset/finalize; public reversed rows[3,1], NULL child[NULL,3], invalid late
row/grandchild atomic SQLite errors. Expanded probes public-only. Other specialized
VALUES/compound/ordered routes and general copier/census/integration remain open.

Pure retained VALUES producer now calls the shared VALUES expression owner with
coroutine destination on the enclosing builder/parameters, replacing its duplicate
no-subquery-hook row emitter (select.c8055–8073 coroutine and2877–2889 VALUES
selectInnerLoop iteration). Parent limits stay consumer-owned; producer finishes
with local EndCoroutine. Pinned/public retained VALUES nested scalar,(3) =>
INTEGER[1,3]/column1/reset/finalize. Public parentOFFSET1=>[3], childLIMIT0=>
[NULL,3], parentLIMIT0 empty, invalid late row atomic SQLite error. Expanded probes
public-only. Ordered/set expression paths and general copier/census/transient
binding/integrated compatibility remain unresolved.

Retained ordered zero-source ALL now composes shared scalar expression/predicate
owner per ordinary arm/VALUES EList with sorter insertion continuation. This
removes independent no-hook expression/predicate emission; ordinary single-row
DISTINCT uses existing UNIQUE proof, VALUES iteration preserved. Common sorted
LIMIT/OFFSET/topN and coroutine destination unchanged. Upstream select.c3584/3599
multiSelectByMerge compiles each arm with sqlite3Select, and selectInnerLoop owns
expression evaluation. Existing bounded finite-sorter adaptation is not replaced
by upstream merge here; no broader ordering/correlation compatibility claimed.
Pinned/public nested scalar +8 ORDER DESC =>INTEGER[8,1]/x/reset/finalize. Public
commonOFFSET=>[1], WHERE0=>[8], NULL scalar=>[8,NULL], invalid child LIMIT0 atomic
SQLite error. Expanded probes public-only. General copier/census/transient
binding/integration remain unresolved; set destinations still have separate
expression emission requiring owning-path translation.

Retained set/mixed arms now compose shared expression/predicate body into existing
IdxInsert/SetDelete and ALL-tail destinations; duplicate no-hook evaluators removed.
VALUES ELists iterate fully before INTERSECT retention. Pinned/public nested
scalar UNION8 =>INTEGER[1,8]/x/reset/finalize. Public INTERSECT[1], EXCEPT[],
NULL UNION NULL[NULL], WHERE0[8], mixed tail/commonOFFSET[8,1], invalid child LIMIT0
atomic SQLite error pass. Expanded probes public-only.
Important current-source comparison: SQLite3.53.4 select.c2987–3003 routes *all*
non-ALL compounds through multiSelectByMerge, synthesizing ORDER BY1. The retained
TS KeyInfo ephemeral-set route is pre-existing adaptation, NOT a translation of
an upstream temporary-set branch. This slice changes expression/destination
ownership only; source-faithful merge replacement/technical rationale review
remain open along with general copier/census/transient binding/integration.
Upstream3584/3599 compiles arm sqlite3Select coroutines; shared body preserves
that semantic ownership while current TS destination algorithm remains debt.

Retained two-arm unordered non-ALL zero-source compounds now use source-shaped
multiSelectByMerge control flow (select.c2987–3003,3570–3719): sorted arm
coroutines, A<B/A==B/A>B, eof-A/eof-B, generateOutputSubroutine previous-key
suppression before common OFFSET/LIMIT. Shared scalar/VALUES expression owner
feeds each arm sorter. No ephemeral union/delete/intersection on this admission.
Existing sorter arm representation remains browser-safe; CompareJump fuses
OP_Compare/OP_Jump using shared Mem/KeyInfo (all ascending full-row tie keys here;
explicit ordered/mixed/more-than-two arms retain old route). Both initially empty
and exhausted transitions use caller Yield P2; no completed Program relocation.
Pinned/public multi-column INTEGER,NULL duplicate UNION=>[[1,NULL],[2,NULL],
[3,NULL]], INTERSECT=>[[2,NULL]], EXCEPT=>[[1,NULL]], metadata/reset/finalize pass.
Public initial empty arms/common limits pass. Illegal trailing VALUES LIMIT
fixture was removed: pinned grammar rejects it too, not a product regression.
General old set-route replacement, collation/encoding/REAL/BLOB/resources/ordered
merge and transitive copier census/integration remain open. This is bounded
source-owner progress, not complete compound fidelity or exception approval.

Unordered retained pure set chains now recursively compose prior SELECT merge
into A coroutine (select.c3570–3607 destA/pPrior sqlite3Select). Prefix merges
own previous-key suppression but not root common LIMIT/OFFSET; their end falls
through to local EndCoroutine. Root alone applies common limits. This replaces
pre-existing ephemeral-set algorithm on admitted pure unordered set chains,
not mixed ALL/ordered paths. Pinned/public left-associated UNION/EXCEPT/INTERSECT
and three-arm duplicate UNION commonOFFSET pass INTEGER/x/reset/finalize.
Structural regression requires recursive merge/CompareJump/root limits and
excludes ephemeral set/child.ops in that producer. 149 focused tests/type pass;
general copier ownership remains red. REAL/BLOB/collation/encoding/resource and
mixed/ordered merge translation plus transitive census/full integration remain
open; no broad compatibility claim.

Retained unordered mixed chains ending in a set operator now recursively merge
ALL prefixes as sorted streams (select.c3507–3516 regPrev=0 for TK_ALL,
3653–3689 equal emits A/advances A, EOF drains both). ALL merge allocates no
previous-key state; enclosing set merge suppresses duplicates. Common limits
remain root-only. Chains ending ALL retain existing sequential output route,
not sorted by this change. Pinned/public ALL-prefix duplicate UNION[1,2],
INTERSECT[2], EXCEPT[1], commonOFFSET[2] pass INTEGER/x/reset/finalize.
This removes ephemeral set consumption on this admission; ordered/mixed tails
and old set fallback still need displacement. Final regPrev branch source
comparison prompted deletion of unnecessary ALL state; type26 focused pass
following earlier native/type149 pass. General compatibility/census/integration
and collation/REAL/BLOB/encoding/resource gaps remain open.

Retained unordered mixed compounds ending ALL now emit merged prefix then
sequential tail to same coroutine destination/common limit registers, matching
select.c3004–3045 multiSelect TK_ALL ownership. Prefix limit exhaustion skips
all tails; prefix EOF resumes tail with residual OFFSET/count. Tail WHERE runs
in shared expression owner before counting output. No tail sorting/deduplication.
All admitted unordered set/mixed paths now avoid old ephemeral-set branch;
that branch remains for explicit ordered sets pending merge permutation work.
Pinned/public UNION2,1 ALL2=>[1,2,2], empty EXCEPT prefix=>[1], common
LIMIT2 OFFSET1=>[2,2], OFFSET2=>[2], INTEGER/x/two resets/finalize pass.
Public LIMIT0/LIMIT1/false tail/two unsorted tails/invalid tail despite LIMIT0
atomic error pass. Native/type149/diff pass; general copier16/1 remains red.
REAL/BLOB/collation/encoding/resources/full census/peer integration open.

Retained admitted ordered set/mixed compounds now use recursive coroutine merge,
removing superseded ephemeral-set/delete/intersection/output-sorter branch.
Existing ordered admission remains one column/one term: permutation identity,
not general ORDER support. select.c3465–3507 distinguishes merge vs duplicate
KeyInfo: descending/explicit collation/NULLS placement affect merge/arm sorter,
previous-row equality remains compound collation ascending. CompareJump now
honors KeyInfo nullsLarge before descending reversal (shared Mem storage class).
Ordered ALL tails are recursive sorted merge, unordered tails stay sequential.
Pinned/public DESC[2,1], DESC NULLS FIRST[NULL,1], mixed DESC/commonOFFSET[2,1]
with x/types/reset/finalize pass; native/type149/diff pass. Full collation/type
encoding/resources, multi-column permutation/order admission and general
copier/census/integration remain open. Structural tests updated to require merge
ownership, not deleted ephemeral implementation details.

Retained ordered ALL one-column/one-term producers now dispatch to shared
recursive source merge instead of finite whole-compound sorter. TK_ALL owns
no regPrev (select.c3507–3516), equal emits A/advances A, both EOF branches drain
remaining duplicates (3662–3684). Common limits root-only; shared expression
body produces arm sorter/coroutine. Wider/multiple-order supported ALL retains
existing sorter adaptation until permutation support lands, not rejected.
Pinned/public duplicate DESC[2,2,1], DESC NULLS FIRST[NULL,1], commonOFFSET[2,1],
metadata/types/two resets/finalize pass; native/type149/diff pass; broad copier16/1
still red. No full compound/type/encoding/collation/resource compatibility claim.

Retained wider/multiple-term ordered ALL now shares recursive source merge:
ORDER resolution maps each term to result index, arm sorter stores permuted keys
plus full payload, CompareJump indexes payload through permutation (select.c
3479–3505 OP_Permutation/KeyInfo). Removed whole-compound finite-sorter branch;
no supported width/order contract narrowed. Set admission remains existing
one-term/one-column; no claim general set tie-key expansion implemented.
Pinned/public two-column ORDER2,1DESC=>[[3,1],[2,1],[1,2]], alias ORDER y,xDESC
LIMIT1 OFFSET1=>[[2,1]], INTEGER/x,y/two resets/finalize pass. Earlier NULL,
scalar/predicate/VALUES/compound probes retained. Native/type149/diff pass after
obsolete structural locator updated; broad copier16/1 remains red. Full type,
collation,encoding,resources/census/linked contexts/integration remain open.

Root zero-source set/mixed compound arms now use shared scalar expression body
and destination callbacks on enclosing builder/parameters; replaces no-hook
compileExpression row emitters in prefix and ALL suffix. Physical scalar
subqueries carry Program.database/maxRows at publication. Pinned select.c3584/
3599 arm sqlite3Select and expr.c scalar destination ownership inform composition;
root ephemeral set algorithm remains debt, not claimed pinned merge translation.
Pinned/public SELECT(SELECT a FROM t1 LIMIT1) UNION8=>INTEGER[1,8]/x/reset/finalize
now passes (previous public typed temporary); EXCEPT/INTERSECT/ALL suffix pass.
Native/type149/diff pass. Root ordered/unordered ALL emitter and root set merge
algorithm remain unresolved, as do general census/resources/integration.

Root admitted scalar set/mixed compounds and retained set/ordered ALL now call
one emitScalarCompoundMerge mutable-builder/destination owner, rather than root
ephemeral insertion/delete/intersection/output sorting. select.c2987–3005 and
multiSelectByMerge arm/destination/output policy own recursion; root SRT_Output,
retained SRT_Coroutine. Unordered trailing ALL sequential/common limits retained.
Root width/ORDER admission unchanged (ordered sets one-column/term). No synthetic
FROM wrapper/finished graph relocation. Root prevalidation still computes unused
old limit setup before selecting merge; not emitted/published, cleanup debt.
Pinned/public root EXCEPT chain[1], ALL-prefix INTERSECT[2], ALL-tail OFFSET[2,8],
DESC OFFSET[1] INTEGER/x/reset/finalize pass; physical scalar regression remains.
Native/type149/diff pass after structural helper-following assertion update;
broad copier16/1 red. Root pure ALL/ordered ALL duplicate emitters, full type/
collation/encoding/resources/linked contexts/census/integration remain unresolved.

Root ordered scalar/VALUES ALL now calls emitScalarCompoundMerge with SRT_Output,
same owner as retained coroutine compounds. Removed independent ORDER resolver,
compileOrderedScalarSubquery hook and whole-compound sorter; source TK_ALL
regPrev=0/recursive arm coroutine ownership select.c3507–3518,3580–3605.
Root set prevalidation/unused duplicate limit setup removed: shared owner resolves
ORDER/errors and owns limits. Existing ordered set width admission unchanged.
Pinned/public duplicate DESC[2,2,1], NULLS FIRST[NULL,1], two-column permutation,
physical scalar ORDER/OFFSET[1] pass; physical scalar previously typed temporary.
Native/type149/diff pass, broad copier16/1 remains red. Root unordered ALL still
uses separate no-hook row emitter; encoding/type/collation/resources/census and
linked transient contexts/integration remain open, not compatibility acceptance.

Root zero-source unordered ALL now lowers every arm/VALUES EList through shared
scalar expression owner on enclosing builder/parameters with sequential output
and common limits, per select.c3005–3048 TK_ALL. Dispatcher no longer sends this
zero-source contract to compileCteUnionAll's no-hook expression route; physical/
CTE/predicate/DISTINCT/group branches retain their specialized producer. Program
carries database/maxRows for physical scalar cursor execution. No sorting/dedup.
Pinned/public physical scalar ALL[1,8], OFFSET[1], scalarLIMIT0[8,NULL], INTEGER/
NULL/x/two resets/finalize pass. Public VALUES[1,3,8] and invalid late scalar
under LIMIT0 atomic SQLite error pass. Native/type149/diff pass; broad copier16/1
red. Specialized CteUnionAll zero-source arm emission still needs shared owner;
full type/encoding/collation/resources/census/linked contexts/integration open.

compileCteUnionAll zero-source ordinary/VALUES arms now use compileScalarSelect
with shared builder/parameters/common emitRow, removing fallback no-hook emitter
that scalarized VALUES to its first EList. select.c multiSelect TK_ALL3005–3048
and multiSelectValues/selectInnerLoop own row iteration. Compiled descriptor
columns preserve VALUES-first column1 naming. Physical/CTE/aggregate/window arm
branches unchanged. Zero-source grouping remains typed temporary not partial.
Pinned/public VALUES physical-scalar + table ALL[1,3,1,3,5,7], table+VALUES
[1,3,5,7,1,8], common OFFSET[3,1] INTEGER/column1 or x/reset/finalize pass.
Native/type149/diff pass; expanded public metadata/late-invalid-LIMIT0 pass after
illegal trailing VALUES LIMIT fixture corrected with SELECT tail. Ordered CTE
zero-source emitter and CTE materialization row hooks remain unresolved; broad
copier16/1/type encodings resources/census/integration remain open.

Ordered specialized ALL no-source arm now uses shared scalar/VALUES expression
owner feeding its existing sorter destination (select.c3580–3605 arm owner).
Project hasValues from arm.origin in semantic producer: compound-wide flag was
wrong on mixed SELECT/VALUES and caused missing-row invariant failure. Manual
predicate/result hookless loop removed. Numeric complete-result ORDER admission
unchanged; alias ordering remains temporary in this specialized route. Legal
VALUES middle+SELECT tail required (trailing VALUES ORDER is syntax error).
Pinned/public table+scalar[1,1,3,5,7], table+VALUES+tail[1,1,3,5,7,8,9], scalar
WHEREfalse[1,3,5,7] INTEGER/x/reset/finalize pass. Native/type149/diff pass after
structural test follows shared owner. Existing specialized whole-compound sorter
algorithm debt remains; CTE materialization/census/resources/integration open.

CteUnionAll bounded materialized SELECT/VALUES producer now delegates row
expressions to shared compileScalarSelect builder/parameters/ephemeral destination
rather than no-hook compileExpression. select.c8102–8139 tag-select-0488 calls
sqlite3Select(SRT_EphemTab); existing Gosub/Return/OpenDup reuse remains. Pinned/
public repeated physical-scalar VALUES CTE[1,3,1,3], empty scalar CTE[NULL,NULL]
metadata x/reset/finalize pass, native/type149/diff. Scalar LIMIT nested in CTE
currently misattributed by parser (LIMIT before UNION error); probes use WHERE
unique/empty instead, parser gap retained. Materialization Once/error ordering,
CTE descriptor/collation/general shape and specialized ordered merge debt remain;
no exhaustive compatibility/resources/integration claim.

Ordinary physical/scalar ordered ALL numeric complete-result keys now compose
shared recursive merge via arm emitter interface: physical compileInnerTableSelect
feeds source sorter destination, scalar owner feeds ordered row callback. Pinned
select.c3580–3605 destinations remain arm-owned; aggregate/CTE/derived/window/
DISTINCT specialized routes retain old bounded sorter until integrated. No
finished graph relocation. Resolved implicit column collation accompanies ORDER
KeyInfo (first emitted attempt lost NOCASE; existing regression exposed it and
owning key producer fixed). Pinned/public physical WHERE/empty/tie cases pass;
native/type149/diff pass. Whole-compound sorter remains for excluded specializations,
not removed globally; interfaces/census/type encoding resources/integration open.

Ordered specialized numeric complete-result ALL aggregate/GROUP/HAVING arms
now feed shared recursive merge through compileAggregateSelect sorter destination,
not whole-compound sorter. select.c3580–3605 compiles arm sqlite3Select; aggregate
output flows through selectInnerLoop destination. Empty SUM NULL, HAVINGfalse,
group rows preserve output/lifecycle, pinned/native/type149/diff pass. KeyInfo
resolution must project each arm GROUP/HAVING carriers as row lowering does;
inherited compound HAVING caused false nonaggregate error, owning semantic
projection corrected. DISTINCT/CTE/derived/window specialized sorter remains;
no census/resource/full compatibility acceptance claimed.

Ordered physical DISTINCT ALL arms now enter shared recursive merge, preserving
arm DISTINCT carrier and compileInnerTableSelect Found/IdxInsert before sorter
destination (select.c selectInnerLoop/codeDistinct); no-source DISTINCT retained
specialized route until its row contract integrates. Numeric complete-result ORDER
admission unchanged. Pinned/public duplicate parity [1,1], empty A [1], NULL ties
[NULL,NULL] plus existing CAST/+column NOCASE cases pass; native/type149/diff,
then new shared-owner structural test passes. Specialized CTE/derived/window and
no-source DISTINCT whole-compound sorter remains; exhaustive census/resources/
C1–C6/Chinook integration unclaimed.

Ordered specialized ALL single-candidate no-FROM SELECT DISTINCT now feeds shared
merge through scalar row callback. No-source SELECT has at most one candidate;
lexical DISTINCT resolution retained then dedup flag elided in lowering, matching
select.c codeDistinct WHERE_DISTINCT_UNIQUE no-op. VALUES multirow not included;
physical DISTINCT retains own Found/IdxInsert. Pinned/public physical-scalar
DISTINCT, false predicate and NULL ties preserve rows/types/x/reset/finalize;
native/type150/diff pass. Old sorter remains for CTE/derived/window and non-single
candidate specializations; census/resources/full integration not approved.

Ordered single-use ordinary CTE flatten now precedes shared merge admission/key
resolution (select.c7879 flattenSubquery before producer). Existing bounded
restriction and EList/WHERE substitution moved, not expanded: materialized,
repeated, compound, GROUP/DISTINCT/ORDER/LIMIT/nested sources still excluded.
Reconstructed arm carriers carry substituted result/from/where to merge while
preserving original compound operator. Pinned/public table CTE predicate and
combined parent predicate [2,5,7]/[2,5] metadata/reset/finalize pass; native/type150/
diff pass after shared-owner locator updated. Old ordered sorter remains for
other specializations, generic flatten restrictions/CTE mappings/census/resources/
full integration remain debt; no exhaustive compatibility claim.

Ordered ALL represented window arms now compose shared merge through existing
compileWindowSelectLowering sorter destination on enclosing builder. select.c7699/
window.c958 sqlite3WindowRewrite applies to individual pPrior==0 arm; multiSelect
3580–3605 composes destinations. Never invoke window lowerer on whole compound.
Pinned/public row_number ordered tie [1,2,2,3,4] and empty A [2] INTEGER/x/reset/
finalize pass; prior caller fell through to typed temporary complex table arm.
Native/type150/diff pass. Numeric complete-result ORDER bounded admission unchanged;
retained derived/CTE/materialization and generic copying/census/resources/integration
remain open, not global window/compound compatibility approval.

Ordered ordinary derived single-table flattenable arm now uses existing
flattenOrdinaryDerived before shared merge. select.c flattenSubquery4290ff/7879
substitutes EList/WHERE before execution; lexical output column names survive
producer substitution (qualified d.x outputs x, not producer a). Preserve aliases
from lexical column expression, not expressionName token text. Pinned/public
predicate and combined predicate [2,5,7]/[2,5] INTEGER/x/reset/finalize pass;
native/type150/diff. Retained LIMIT/compound/DISTINCT/group/window derived
producers remain excluded by existing flatten restrictions, no general flatten/
metadata/type-origin/resource compatibility claim; copier/census/integration open.

Ordered retained ordinary derived noncompound/nonnested projection now invokes
compileDerivedProducer shared destination/row callback inside merge (select.c
3580–3605 arm destination,8048+ retained coroutine). Child LIMIT remains owned by
child, never flatten into parent. KeyInfo collation derives through producer
projection descriptor/name substitution for this bounded single-level branch,
not physical lookup of lexical d. Arm emitter owns resolution; scalar-only merge
validation remains when no emitter supplied. Pinned/public LIMIT2 [1,2,3] and
LIMIT0 [2] names/reset/finalize pass; native/type150/diff. Compound/nested retained
keys, CTE/materialization, generalized transient NameContext/copying/census/types/
resources/integration remain debt; no general descriptor compatibility claim.

Retained derived merge key now checks explicit collation inherited from producer
projection before implicit resolved-column fallback. select.c2574 multiSelectCollSeq
uses first non-null sqlite3ExprCollSeq in left-to-right arm order; prior bounded
metadata substitution omitted producer explicit COLLATE. Child execution/LIMIT
unchanged. Pinned/public retained literal NOCASE 'a' versus 'B' => ['a','B'], TEXT,
x/reset/finalize; baseline wrongly binary ['B','a']. Native/type150/diff pass.
This repairs existing key producer, not full transient resolver/descriptor debt;
compound/nested sources/census/resources/full integration remain unclaimed.

Retained transient column default BINARY now terminates compound collation search
when its producer has no explicit/implicit collation. expr.c248 TK_COLUMN always
looks up column collation; select.c2426–2429 sets optional producer collation on
transient descriptor, otherwise default remains BINARY. Metadata projection must
not treat a literal producer's lack of collation as the outer column's lack.
Pinned/public retained literal 'a' then 'B' COLLATE NOCASE => ['B','a'], TEXT/x/
reset/finalize; prior output ['a','B'] wrongly inherited later arm NOCASE.
Native/type150/diff pass; cast/unary-plus column identity preserved. General
transient descriptors/compound keys/census/resources/integration still open.

Transient merge collation metadata now derives recursively from leftmost producer
EList (select.c2346 sqlite3SubqueryColumnTypes follows pPrior) and resolved
expression collation/default BINARY. Consumer projected column identity is matched
to unique transient names; CAST/+ preserve identity. No expression substitution
or child predicate/LIMIT movement in key producer. Removed prior substituted-key
and special default fallback path. Ordered nonnested compound derived projection
now feeds existing shared producer; pinned/public NOCASE scalar ALL child plus
outer 'B' => ['a','B','c'], TEXT/x/reset/finalize. Native/type150/diff pass after
normalizing descriptor uppercase BINARY at KeyInfo boundary. Helper covers
collation only, not full affinity/type/name/NameContext migration; unsupported
noncolumn nested projection remains typed temporary. Copier/census/resources/
CTE/full integration still open.

Transient collation metadata now requires resolution of represented producer arms
before leftmost descriptor extraction, matching select.c2346 SF_Resolved
precondition. Reuses expandAndResolveSelect (no new expression walker), maps
NameResolutionError to SQLITE error before descriptor/Program publication; nested
producer validation recurses. Public/native later missing-column both ordinary
and LIMIT0 reject at prepare (native SQLITE_ERROR/null stmt). Corrected baseline
already rejected during lowering; this is error/semantic ownership relocation,
not a newly fixed behavioral red. Initial test used wrong error.reason instead
of API error.kind; corrected baseline passed. Native/type150/diff pass.
General linked transient resolver/affinity/types/census/resources still open.

Transient descriptor precondition now validates later derived arm projection as
well as its child producer: isolate arm then existing descriptor qualifier/name
checks; recursion terminates on single-arm branch. select.c2346 SF_Resolved
requires consumer expressions resolved, not only producer. Public/native nested
later n.missing with inner LIMIT0 yields atomic SQLITE prepare error (native null
stmt). Baseline already rejected during lowering; ownership moved earlier, not
behavioral red. Native/type150/diff pass. Full linked NameContext integration
remains missing; this local descriptor precondition is not its replacement.

Transient merge metadata now binds a SrcItem-indexed descriptor to the existing
expandAndResolveSelect linked NameContext instead of local name/qualifier lookup.
select.c2346 builds transient columns; resolve.c278 lookupName owns consumer
expression resolution. Descriptor override is explicit optional resolver argument,
not schema mutation/alias. Metadata-only rootPage0 table never enters physical
producer; affinity remains placeholder BLOB, not full type/affinity translation.
Removed local projection walker/name matching; inherited collation through resolved
column uses existing implicit owner. Native/type150/diff pass. Invalid direct
column with child LIMIT0 remains atomic SQLITE. COLLATE-wrapped invalid projection
still fails earlier typed temporary in compoundArmColumns (unimplemented shape),
not falsely claimed repaired. Physical planner interfaces unchanged.

compoundArmColumns retained direct projection now consumes the same transient
SrcItem descriptor/resolver as merge collation. Removed independent name splitting,
qualifier matching and exposed-index walker; resolver's direct column reference
owns index and output alias. Shared transientSourceTable supplies unique names,
collations and declaration metadata (select.c2346 / resolve.c278 lookupName).
Metadata-only physical rootPage0 isolation unchanged; affinity placeholder BLOB
and general type-origin propagation remain debts. Public/native aliased retained
NOCASE column yields renamed/['a','B']; baseline already passed, ownership repair.
Native/type150/diff pass. Unsupported nondirect projections still typed temporary;
producer/register contexts/census/resources/full integration not claimed.

Bounded single-source CTE compound column metadata now attaches shared transient
SrcItem descriptor to resolver, deleting duplicate name/qualifier walker. CTE
explicit column aliases preserved from normalized producer EList (VALUES default
column1 is not CTE x). Collation precondition likewise binds CTE descriptors,
without schema mutation or physical planner changes. select.c2346 and resolve.c278
own descriptor/lookup path. Public/native repeated q(x) VALUES child projected
renamed => [2,1,2,1], INTEGER/name; baseline passed. First implementation lost CTE
names to VALUES defaults; corrected descriptor name policy. Native/type150/diff
pass. Runtime materialization/register/affinity/census/resources still debt.

Transient SrcItem descriptors now carry noVisibleRowid independently of physical
WITHOUT ROWID. select.c5908 sets TF_NoVisibleRowid on derived transient table;
resolve.c471/564 VisibleRowid guards implicit rowid candidates. Resolver checks
this flag only after real column lookup, preserving explicitly projected rowid
and physical table rowids. Shared transientSourceTable sets flag for derived/CTE
metadata; no physical planner/storage semantics changed. Unit red allowed hidden
rowid via descriptor; corrected. Pinned/public rowid/_rowid_/oid missing with child
LIMIT0 are atomic SQLITE prepare errors; explicit rowid returns [1,2]. Native/
type157/diff pass. General affinity/type/register/census/resources still open.

Transient metadata now has one resolveTransientArm binding/error owner shared by
compoundArmColumns and collation extraction. Removed separate validation recursion
and duplicated derived/CTE resolver setup: each arm resolves its actual SrcItems
once in collation extraction, then leftmost plan supplies descriptors (select.c2346
SF_Resolved / pPrior, resolve.c278 lookupName). Recursive child descriptors remain
metadata-only, never physical scans. Public/native COLLATE missing-column LIMIT0
atomic SQLITE error verified; current baseline already rejects after previous
column resolver repair, superseding older temporary prediction. Native/type157/
diff pass. Affinity placeholder and general execution register contexts remain.

Ordinary transient descriptor affinity now uses resolvedExpressionAffinity
(expr.c45 sqlite3ExprAffinity): resolved column/rowid, CAST type, COLLATE operand,
parentheses representation; unary plus and literals have no affinity. Consumes
columnUses or direct result binding, not declared-type guess. Shared descriptor
uses this only for noncompound producers. Compound cross-arm DataType/conflict/
FLEXNUM scan (select.c2378–2398) remains explicitly BLOB placeholder; scalar SELECT
expression affinity remains absent, not claimed translated. Unit source-branch
coverage plus existing pinned public differential native/type158/diff pass.
No runtime producer/register context migration or broad compatibility claim.

Nested compound-derived resolver descriptor now uses SrcItem-indexed binding,
not child schema alias injection, and carries TF_NoVisibleRowid (select.c5908,
resolve.c471). Explicit rowid columns remain visible. Scalar retained compound
caller resolves consumer before temporary destination admission, preserving lexical
error precedence even LIMIT0. Pinned/public nested implicit rowid/_rowid_/oid now
SQLITE_ERROR before statement publication; first public attempt remained temporary
because capability check preceded resolution, corrected at caller. Unit/native/
type159/diff pass. Runtime unsupported destination remains temporary for valid
unimplemented shapes; compound affinity/register/census/resource debt remains.

resolvedExpressionAffinity now includes expr.c56 TK_SELECT: scalar SELECT follows
semantic SelectNode identity into existing linked resolved child then first result
expression affinity. Correlated outer column and differently typed siblings use
their actual resolved contexts; IN/EXISTS/unary plus do not inherit SELECT affinity.
Shared ordinary transient descriptor consumes this without independent re-resolution.
Unit baseline undefined scalar affinities repaired; existing pinned differential/
type160/diff pass. No new public affinity observability claim. Compound cross-arm
DataType/FLEXNUM scan, general register contexts/copiers/resources remain open.

Transient compound descriptor now scans resolved arm expression affinity and prior
DataType masks (select.c2378–2398), stopping on real BLOB affinity, not confusing
it with NONE. expr.c106 DataType owner covers represented literals/parameters/
functions/column/CAST/scalar SELECT/CONCAT/CASE output unions, unary plus/COLLATE.
Numeric/text prior conflict gives BLOB; no affinity defaults BLOB. FLEXNUM on
numeric leftmost CAST remains explicit metadata placeholder BLOB, not a claimed
runtime substitute; shared Mem has no FLEXNUM yet. Unit mask red then native/
type161/diff pass; public affinity observability not newly asserted. Runtime
register contexts/copiers/census/resource acceptance remain open.

Correction to compound affinity scan: source select.c2387 loops over later arms
AFTER selecting first affinity owner as well as prior NONE masks. Previous scan
omitted tail masks. resolvedCompoundAffinity now owns both loops; transient table
caller consumes it. Source tests numeric column then text => BLOB, TEXT CAST then
numeric => BLOB, NULL/integer/NULL => integer, BLOB CAST stops. Native/type162/diff
pass. Numeric CAST FLEXNUM placeholder remains explicit; no new public affinity
observability acceptance or general execution context migration claimed.

Shared Mem affinity now represents FLEXNUM explicitly (vdbe.c386–410): converts
numeric text, preserves preexisting REAL/IntReal, NULL/BLOB/non-numeric text.
NUMERIC also performs source integer-affinity on existing REAL (old TS incorrectly
exempted NUMERIC). Compound numeric leftmost CAST now supplies FLEXNUM instead of
BLOB placeholder (select.c2397); comparison affinity treats FLEXNUM as numeric.
Unit REAL/text/BLOB across three encodings plus descriptor CAST branch; native/
type178/diff pass. Initial test used nonexistent setReal; corrected setDouble;
initial red was test API failure, not demonstrated production red. General runtime
register contexts/copier/census/resource acceptance still open.

Compound FLEXNUM CAST identity now peels TS-only parentheses (parse.y1176
returns same Expr); COLLATE remains real Expr, so does not qualify as TK_CAST
(select.c2397). Source-unit nested parentheses red repaired. Added pinned/public
retained compound numeric CAST/ALL/order probe: REAL1/INTEGER2/INTEGER3, name x,
reset twice/finalize. Native/type179/diff pass; probe was already supported, not
claimed public behavioral red. General register/copier/census/resources remain.

Resolved affinity/DataType now includes represented TK_VECTOR first-field metadata
(expr.c76–81/135–145), through leftmost nexprlist, using actual linked column use.
Does not admit row-value result lowering. Function DataType branch now recognizes
actual grouped Lemon function signature explicitly; previously function happened
to return unknown via generic identifier affinity branch (baseline passed).
Unit vector red repaired; function coverage passing baseline retained. Native/
type181/diff pass; TK_SELECT_COLUMN/deferred-function affinity and generic runtime
contexts/copier/census/resources remain unclaimed.

Nested scalar compound-derived resolver descriptor now resolves every represented
producer arm and consumes shared resolvedCompoundAffinity, replacing blanket BLOB
(select.c2378–2399 SF_Resolved prerequisite/scan). First-arm output names unchanged;
SrcItem-index attachment/noVisibleRowid preserved. Linked scalar affinity now
integer/NULL, numeric/text conflict BLOB, numeric CAST FLEXNUM. Unit red repaired,
existing pinned/public native/type182/diff pass; no new runtime destination admitted.
Nested descriptor collation/type-origin and general runtime contexts/copier/census/
resources remain open; later arm lexical resolution now happens at descriptor owner.

resolvedImplicitCollation now consumes direct ResolvedResult binding when no
columnUses entry exists (expr.c248 TK_COLUMN); nested compound transient descriptor
uses first resolved producer implicit collation, default BINARY. NOCASE/BINARY
first-column order coverage unit red repaired, native/type183/diff pass. This is
not full nested explicit EP_Collate propagation: explicit COLLATE/expression
children and type-origin remain open at nested descriptor owner. No new destination
admission or broad compatibility claim; runtime/copier/census/resources remain.

Resolved expression collation owner now handles represented explicit COLLATE and
EP_Collate left-to-right children (expr.c276–308), skipping scalar SELECT contents,
CAST/UPLUS/parentheses operand ownership first. Nested compound descriptor and
transientResultCollations consume it; latter removes duplicate expression-tree
conversion for explicit collation. Unit explicit/function/binary/SELECT boundary
red repaired; native/type184/diff pass. Vector/deferred-function/register collation
branches and full type-origin/runtime/census/resource coverage remain unclaimed.

Resolved TK_VECTOR collation now follows first field before EP_Collate child scan
(expr.c271): later explicit COLLATE cannot override first field or supply missing
collation. Affinity/collation share parser first-field extraction. Result KeyInfo
consumer uses resolvedExpressionCollation, removing duplicate explicit-tree walk.
Unit red repaired; native/type pass, initial suite184/1 obsolete structural locator,
updated locator then185/0. Native not rerun after assertion-only change. Deferred/
register collation, remaining compound callers/runtime/census/resources still open.

Compound merge now resolves each actual arm and uses shared resolvedCompoundCollation
(select.c2574 prior-first/non-null); removes explicit/implicit/derived conditional
collation walker from emitScalarCompoundMerge. Whole-compound ordered CTE route
also uses resolvedExpressionCollation per arm; no resolvedImplicitCollation calls
remain in vdbe.ts. BINARY physical column stops later NOCASE, literal NONE permits
later collation. Unit owner red; initial type narrowing failure then obsolete
locator185/1, corrected native/type186/diff pass. General source/type-origin/
register/copier/census/resources remain; not exhaustive compatibility acceptance.

Nested compound resolver descriptor declared type no longer blanket NULL: shared
transientDeclaredType normalizes original resolved direct-column type against
computed affinity (select.c2399–2420/global.c standard table), NUM for FLEXNUM,
INT/REAL/TEXT/BLOB otherwise. Original INTEGER preserved, numeric/text conflict
BLOB, CAST FLEXNUM NUM source-unit red repaired; native/type187/diff pass.
This is descriptor metadata, not new public provenance acceptance: full columnType
CAST/scalar SELECT/origin recursion and general transientSourceTable consumer still
need migration, as do runtime/copier/census/resources.

Nested transient type normalization now consumes resolvedExpressionDeclaredType:
select.c columnTypeImpl TK_COLUMN and semantic-linked TK_SELECT (including outer
binding) only; TS parentheses preserve Expr identity, CAST/UPLUS/functions do not
inherit declared type. Unit red repaired with direct wrapped fallback; native/
type188/diff pass. General producer descriptor/origin recursion and public metadata
assertions still pending; not a new declared-type compatibility claim.

General transientSourceTable now consumes resolved columnType and shared declared
normalization (select.c2399–2420), removing independent compoundArmColumns type
copy. Public/native compound CAST probe additionally checks top-level decltype
NULL (leftmost CAST expression has no columnType), rows/types/name/reset unchanged; this is not evidence
that descriptor NUM equals public origin metadata. Ownership locator red repaired;
native/type189/diff pass. Derived origin recursion, scalar expression metadata and
remaining runtime/copier/census/resource integration remain pending.

Resolved scalar SELECT result descriptors now inherit linked child type/database/
table/origin (select.c2033 TK_SELECT), preserving parent name and not copying
child affinity/collation. Parentheses only preserve C Expr identity; CAST/UPLUS/
functions remain expression metadata. Unit metadata red repaired; native/public
scalar INTEGER/name/value probe passes, public provenance checked against source
(not native metadata functions); type190/diff pass. Derived-origin recursion and
runtime/copier/census/resources remain unresolved.

Derived descriptor columnType now follows attached resolved current producer EList
(select.c1988–2005), not transient alias as main-table origin. WeakMap keyed by
TableNode represents SrcItem subquery relationship without modifying physical
schema; ordinary derived producers attach, CTE names excluded (separate C branch).
Nested scalar unit alias-origin red repaired, literal producer type/origin null.
Native/type191/diff pass before CTE guard; guard type33/diff pass afterward.
No fresh public/native derived-origin probe; retained execution metadata copier
and exhaustive CTE/view/type-origin integration still pending.

Retained derived compoundArmColumns now consumes resolved descriptor producer
relationship (columnTypeImpl subquery branch), removing independent child metadata
recursion while preserving direct-projection capability boundary. New native/public
derived physical-column probe preserves INTEGER/name/value and source provenance.
Initial oracle expectation of last literal decltype NULL was disproved (INTEGER);
corrected test passed baseline, not a public product red. Native/type192/diff pass.
Public compound metadata arm selection still requires generalized source census;
runtime/copier/resource integration remains open.

Residual compound destination metadata now takes leftmost arm for both name/type/
origin (select.c2155 and generateColumnTypes call), removing last-arm provenance
copy. Earlier commentary attributing CAST probe NULL to last literal was wrong:
CAST itself has no columnType. Native derived-column/literal pair confirms INTEGER
while CAST/literal pair NULL; existing public probes pass. Structural branch red
repaired; native/type193/diff pass. No exhaustive compound metadata census or
runtime/copier/resource acceptance implied.

Correction: columnTypeImpl subquery branch uses pS->pEList, with no pPrior rewind
(select.c1999). Compound derived origin therefore follows current/rightmost arm,
unlike GenerateColumnNames top-level leftmost and transient affinity/type scan.
Producer bindings now attach rightmost plan. Native literal-first/physical-last
retained derived probe disproved NULL hypothesis: INTEGER; public baseline passed,
nested resolver source-unit red repaired. Native/type193/diff pass. Earlier
residual leftmost metadata repair still needs caller-context distinction review:
public root vs derived producer cannot share blanket arm ownership. No complete
compound metadata/census/runtime/resources acceptance.

Residual derived producer metadata correction: current/rightmost type/origin with
leftmost transient names, not top-level GenerateColumnNames. Attempted parent
resolved metadata passed193 tests but inspection showed producerOutput width must
remain child width, independent of parent projection; removed that attempt before
handoff. Current source-specific producer composition restored (columnTypeImpl
1999); type/focused tests pass. Full suite/native from removed attempt are not
acceptance evidence for final code; broad rerun remains due.

Producer-width follow-up differential now covers three-column compound coroutine
payload consumed by one-column parent and reordered/repeated three-column parent,
LIMIT2 and two reset cycles, INTEGER rows and names through public/native APIs.
Both pass on final current-arm metadata composition. Native/type193/diff rerun
closes prior removed-attempt verification gap, not overall migration acceptance.
The child payload register range must not be allocated from parent EList width
(selectInnerLoop destination count vs parent result; TS producerOutput).

columnTypeImpl represented COLUMN/SELECT metadata now shares
resolvedExpressionMetadata for declared type and origin; declared-type wrapper and
scalar result finalization consume it. Parent scalar identity gate does not rewrite
ordinary merged/coalesce result descriptors. Direct descriptors take precedence
over columnUses to preserve INTEGER PRIMARY KEY origin name. Unit absent-owner
red then IPK/merged descriptor regressions repaired; type194/diff pass. Native pair
passed before final identity gate; public pair rerun afterward. No new execution
admission or complete origin/branch compatibility claim.

Shared columnType metadata now honors resolver FULL USING semantic coalesce rewrite
before looking at child columnUses: resolve.c lookupName builds TK_FUNCTION,
columnTypeImpl default has null type/origin. TS retains Lemon syntax and explicit
ResolvedResult coalesce marker, so metadata checks that marker. Direct, wrapped,
and scalar-linked FULL USING metadata unit red repaired. Native/type195/diff pass;
no new public FULL execution admission or native provenance-function comparison.
Affinity/collation semantic rewrite ownership remains to census independently.

FULL USING deferred coalesce correction: resolve.c774 assigns SQLITE_AFF_DEFER;
expr.c76/272 explicitly follows first argument for affinity/collation, while
DataType FUNCTION is7 (scalar SELECT wrapper instead uses text affinity mask6).
Merged result bindings now supply first source for affinity/collation and function
mask for direct DataType. Initial generic-function no-affinity hypothesis was
wrong and removed. Wrapped missing-bindings repaired; final type29/diff pass.
Broad/native final rerun due; no new FULL public execution admission.

Deferred coalesce ownership lookup is now shared across affinity/DataType/
collation/columnType metadata, matching Lemon parentheses by semantic identity
(parse.y same Expr, resolve.c774 deferred function, expr.c76/272 first argument).
Source test directly passes peeled inner expression to all owners; final
native/type197/diff pass closes prior final broad/native verification gap.
This is represented result rewrite ownership only, not exhaustive predicate or
runtime context binding. No new public FULL execution compatibility claim.

lookupName now carries FULL USING merged argument sources on ResolvedColumnUse,
not just result descriptors (resolve.c774 deferred coalesce rewrite). Shared
semantic owner consults these bindings for predicates and correlated references;
DataType FUNCTION7 and null columnType no longer infer first raw column type.
Predicate source-unit verifies WHERE-only binding. Initial probe used wrong
fixture index2 (actual same index1), corrected; no claimed baseline product red.
Native/type198/diff pass. Runtime codegen use of merged argument list and full
transitive semantic context census still pending; no new public admission.

Coalesce/ifnull scalar lowering now follows expr.c4592–4607: first argument
copies into target, target NotNull precedes each next argument, no redundant
last test/NULL write. Mem Copy and async execution retained. Existing lowering
already short-circuited observably; pinned public/native overflow-unused-argument
probe passed before and after, integer result with reset twice. Structural owner
coverage verifies branch order. Final native/type199/diff pass. This does not yet
lower lookupName deferred merged argument bindings in runtime predicates:
joined resolveTree still searches names, and correlated binder selects first
raw column. Deferred flags/affinity/collation and root WHERE interfaces must land
together; no FULL predicate admission or general migration approval claimed.

Joined correlated aggregate scalar binder now lowers lookupName mergedSources
into deferred coalesce arguments (resolve.c774), mapping inner source to its
allocated cursor and retaining outer cursors. Expression deferredAffinity flag
supplies first-argument affinity/collation (expr.c76/272), distinct from ordinary
coalesce call. Shared expr.c4592 lowering emits short circuit. Native/public
matched FULL USING correlated aggregate probe passes baseline and final; final
native/type199/diff pass. Unmatched FULL/residual outer WHERE/name-search binder
coverage still pending; scalar nonaggregate LIMIT form remains typed temporary.

Joined residual predicates/result expressions and non-result ORDER now carry
Lemon reduction identity into resolver columnUses lowering, including FULL USING
mergedSources to deferred coalesce (resolve.c774/expr.c4592). Removed independent
name search for these original expressions. Native/public FULL USING WHERE x=1
probe reproduced internal lost-identity error and now passes integer result.
Physical selected operands/generated USING still lack reduction identity and
retain bounded name binding: coordinate root WHERE interface before removal.
Final native/type199/diff pass, not exhaustive CASE/subquery/outer-pass coverage.

Joined original-expression and correlated scalar binders now align erased
parentheses with Lemon identity before operand traversal (parse.y expr LP expr
RP returns same Expr). Parenthesized searched/simple CASE public probes first
reproduced internal operand identity failure, repaired at binder entry; expr.c
5683 CASE producer ordering preserved. Qualified unmatched FULL residual pass
and reset twice verified, not new merged unmatched coverage. Native/type199/diff
pass; native/public rerun after adding wrapped correlated aggregate coverage.
Physical synthetic binding/deferred unmatched/context census remain open.

Parentheses identity alignment is shared in expressionIdentityReduction
(parse.y1176 A=X), consumed by joined original/scalar and window source/FILTER/
retained producer binders. Window WHERE (a=1) native passes/public internal
operand binding red repaired at owning representation primitive. Only LP expr RP
is peeled; CAST/COLLATE/unary semantics survive. Final native/type199/diff pass.
FILTER/retained contexts consume same primitive but fresh public probes there
still due; no exhaustive window rewrite/runtime ownership claim.

Window FILTER BETWEEN probe exposed ignored filter in whole-partition drain
(native1/public16). window.c1049 duplicates full FILTER into producer payload;
1688 reads it before AggStep. FILTER binder now traverses BETWEEN/IN/call/CASE
operands. Existing unguarded regAccum AggStep sites in represented specialized
window drains now share emitStep's IfNot(payload filter) around callback only;
AggValue and row/group progress remain unconditional. Shared Mem/async intact.
Native/type199/diff pass. Temporary-accumulator exclusion branches already have
individual guards and remain; inverse/direct-frame exhaustive census and fresh
IN/CASE FILTER probes remain due. No general window compatibility claim.

Filtered sliding ROWS IN probe native [1,1,NULL,NULL] exposed inverse callback
without stepped value. window.c1688 guard applies to inverse as well as step.
Specialized drains now share guarded emitStep(inverse), and pending bounded
streaming rows invoke existing windowCodeOp WINDOW_AGGINVERSE. Cursor positioning
and unconditional progress unchanged. Native/type199/diff pass. Combined
step/value/inverse sites and transitive frame census remain due: this is not
exhaustive FILTER compatibility. Probe covers INTEGER/NULL distinction.

windowAggregateCallback now owns shared FILTER/args/callback guard for
windowAggStep and specialized emitStep, removing duplicate guard production
(window.c1688). Ordered EXCLUDE TIES combined step/value/inverse routes callbacks
through it while value stays unconditional. CASE NULL/false FILTER current-row
and RANGE EXCLUDE TIES probes pass baseline/final, not behavioral reds.
Final native/type199/diff pass. Unordered no-current peer combined pair and
already individually guarded pending branches remain to consolidate/census;
no exhaustive callback or NULL/filter compatibility claim.

Unordered GROUPS1 FOLLOWING..UNBOUNDED CASE NULL/false FILTER public/native
probe (two reset cycles) passes baseline/final, not a behavioral red. No-order
combined pair and remaining pending inverse producers now use shared guarded
windowAggregateCallback/windowCodeOp (window.c1688); cursor advance still precedes
callback and progress/value remains unconditional. Direct AggInverse producer
census leaves only shared conditional opcode production plus runtime consumer
in vdbe.ts. This is textual producer census, not exhaustive frame/reachable
transitive admission proof. Step/temporary accumulator duplicate production,
resources/limits and full integration remain due. Native/type199/diff pass.

Retained derived parent expression projection: native filtered window over a
LIMIT2 physical producer yields two INTEGER1 rows, but destination composition
is not yet implemented. compileDerivedProducer no longer reports the whole
valid function expression as a missing column. It resolves the transient parent
NameContext via resolveTransientArm before typed temporary capability rejection;
actual missing identifiers remain SQLITE errors. No window admission added or
LIMIT flatten bypass. window.c1049 FILTER payload/select.c retained coroutine
composition remains required. Native/type199/diff pass includes this explicit
gap test, not row parity for this unimplemented combination.

Pending individual cumulative/sliding/following window step now consumes
windowAggregateCallback, replacing duplicate FILTER guard (window.c1688).
Fresh abs(a) FILTER cumulative public/native INTEGER1 probe passes baseline/final;
not a behavioral red. Native/type199/diff pass. Retained physical LIMIT2 window
composition was inspected (source coroutine, grouped payload and derived dispatch)
but not implemented: existing producer requires direct parent projections and
register binder/destination must be composed rather than child Program copying.
Temporary-accumulator step producers and remaining pending shared-step production
still require consolidation; no completed window producer migration claim.

GROUPS cumulative EXCLUDE CURRENT ROW temporary accumulator scan now consumes
windowCodeOp WINDOW_AGGSTEP with accumulator override. window.c1688 guards every
aggregate callback on FILTER false/NULL, including full-scan exclusion paths.
Its missing guard produced [NULL,1,4,9] instead of pinned [NULL,1,1,1] for sum(a)
FILTER WHERE a=1. Six specialized temporary scans now share this owner, retaining
identity/peer exclusions, cursor positioning and unconditional row progress.
Focused red→pass, native/type199/diff pass. Remaining pending shared step producers,
retained derived-window destination and full frame/resource census remain open;
this repairs the reproduced exclusion FILTER defect, not overall migration.

### Retained physical producer → window parent (card-t-c current repair)
The previously temporary LIMIT2/FILTER window probe is now admitted. Production
compileSelect→compileTableSelect resolves the parent via resolveTransientArm;
compileWindowSelectLowering consumes retainedSource on the same builder through
compileInnerTableSelect SRT_Coroutine. select.c8048–8077 (tag-select-0482) owns
InitCoroutine/child result range/EndCoroutine; window.c1049 copies complete FILTER
into producer payload. Direct transient column bindings copy child result registers
(not physical Column on rootPage0); FILTER uses the existing resolver-identity
expression binder returning register leaves, compiled by compileExpressionTree.
This reuses normal expression lowering, not a separate evaluator or SQL rewriting.
Child LIMIT/OFFSET belongs to its source and survives parent limits/window buffering.
No finished child Program or pcMap on this consuming path. Existing generic fallback
still remains for other callers, not retired globally. Bounds: single noncompound
physical child without DISTINCT/group/HAVING/window/order and parent without WHERE/
group/HAVING/compound; other valid destinations remain temporary, lexical errors
resolve first. Broader expression buffer slots remain atomically unrepresented.
Pinned/public INTEGER1x2/reset, LIMIT0 empty, OFFSET1 sum3, qualified FILTER plus
parent LIMIT1 pass; native/type199/diff pass. Structural gate now16/18: new retained
producer ownership passes; generic fallback and CTE metadata Program tests remain
red. Grouped owner test delimiter updated for preceding retained-source branch,
no assertion waived. Prior 15/18 intermediate included this stale delimiter.

Bounded compound ALL CTE source now admits a single-column physical producer
without DISTINCT/group/HAVING/order/window/compound, preserving child LIMIT and
physical predicate ownership. Public result metadata follows the producer origin;
missing columns remain SQLITE. Specialized outer compound LIMIT contexts still
reject atomically temporary. No general CTE/compound compatibility claim.

Zero-FROM noncompound scalar SELECT retains resolved ORDER BY expressions and
multiple terms without a sorter (one candidate); WHERE/LIMIT/OFFSET still apply.
Unknown ORDER identifiers are SQLITE even at LIMIT0. This also holds when the
scalar producer feeds a retained derived coroutine; no broader sorted compound
or aggregate admission follows from this singleton ordering proof.

Bounded nested retained single-source direct projections preserve independent
child SQL LIMIT/OFFSET and physical origin metadata instead of treating parser
synthetic `(subquery)` as a schema table. Existing recursive capability bounds
still apply; this is not general nested SELECT/CTE/window admission.

Retained derived producer residual composition now uses the enclosing SELECT
builder/destination and semantic metadata rather than relocating a completed
child Program. Existing owner capability gates still decide unsupported shapes
atomically; selected destination/metadata/reset tests are not a general nested
SQL or complete compatibility guarantee.

The admitted second-source retained JOIN producer now shares enclosing SELECT
register/parameter/destination state. Its child LIMIT/OFFSET and reset behavior
remain tested; this is not a broader JOIN/derived/window support guarantee.

Admitted retained first-source CTE JOIN materialization now shares SELECT
allocation and production destination; child LIMIT/OFFSET, empty/reset and
lexical missing-column LIMIT0 checks remain tested. Direct-derived source0
admission is a distinct unresolved gap, not newly promised support.

The admitted compound-derived aggregate consumer now retains shared SELECT
allocation through final result production. Ordered aggregate/multiple outputs,
empty inputs and reset controls are tested; broader enclosing physical aggregate
producer support is not implied.

Forced/repeated admitted CTE fallback materialization shares enclosing SELECT
allocation/parameter/destination state; bag duplicates, empty/SQL child limits,
ordinal order/reset and missing identifier LIMIT0 remain tested. No wider
computed/filter or resource/binding compatibility guarantee is added.

Joined correlated scalar aggregate compilation now carries linked resolver
identity through expression binding. Existing admission remains bounded; alias
names/types/reset and missing/ambiguous LIMIT0 prepare errors are retained.
This is not broader scalar NULL/literal expression admission.

Ordinary scalar subquery result/WHERE/ORDER binding now retains linked resolver
identity via shared carrier without narrowing admitted NULL/literal/CASE support.
INTEGER/NULL alias/reset and ambiguous/missing LIMIT0 checks are paired; this
does not imply broader window/correlated aggregate/resource admission.

Derived scalar ALL aggregate payload binding now retains linked identities with
explicit producer-row register phase. Existing predicate/argument narrow bounds
and ordinary scalar NULL/literal support are unchanged; no broader derived
predicate admission implied. Typed NULL sum/INTEGER count, names/reset/outer
LIMIT0 and lexical first-error controls are paired; wider lifecycle unproved.

Window FILTER now retains resolver-linked identity through producer payload
binding, preserving existing physical NULL/COLLATE/EXCLUDE/order behavior and
window lexical LIMIT0 first errors. Retained-derived FILTER probe intersections
remain typed temporary; no wider window admission or lifecycle guarantee added.

Window original physical source ON/WHERE binding now retains resolved identity
through rewrite producer handoff. Existing predicate-before-window behavior,
NULL/empty/EXCLUDE/FILTER combinations and lexical WHERE LIMIT0 errors remain;
retained FILTER temporary intersections and wider lifecycle are not new support.

Standalone derived UNION ALL aggregate binding now retains linked argument/order
identity and distinct source-row/accumulator/finalized-output locations. Existing
empty/NULL/REAL/order/reset results preserved. LIMIT0 missing-column probes still
return public temporary before this caller (native lexical error); not new support.

Ordinary aggregate phase work is partial, no new admission or compatibility claim.
Selected GROUP/FILTER/DISTINCT/bare/empty regressions pass; legacy resolution and
alias edges and LIMIT0 evidence remain outstanding.

Original ordinary aggregate result binding now retains resolved source identity
through FILTER/argument/ORDER production and accumulator/finalized output.
GROUP/ORDER, bare tie, FILTER/DISTINCT, NULL empty/count, REAL sum/avg and resets
are covered; missing column/nested aggregate errors still precede LIMIT0 execution.
Standalone compound LIMIT0 first-error discrepancy remains unresolved.

For the admitted unordered SELECT-origin UNION ALL route, compound classification
precedes each arm's aggregate production. First-arm names and INTEGER/REAL/NULL
values survive across arms and reset. A selected arm compiler's prepare error
aborts the entire prepare; no partial statement or alternate-compiler retry is
published. This bounded ownership correction does not broaden admission.

R3 partial work restores compound-derived missing-column diagnostics before
LIMIT0 capability decline. Source0 retained join LIMIT/OFFSET remains unfinished;
no full compatibility/admission claim from this work.

Bounded source0 retained join now preserves child LIMIT before join and parent
LIMIT/OFFSET after ordering; negative LIMIT and zero rows tested with reset.
Pinned compound missing-column diagnostics precede LIMIT0 admission decline.
Existing UTF8/16 derived-join regressions pass; not a full compatibility claim.

Bounded aggregate alias owner coverage preserves source-name shadowing in HAVING,
aggregate alias expressions in HAVING/unmatched ORDER, INTEGER/REAL/NULL, names
and reset. Paired pinned tests pass; this is not full GROUP/RIGHT/subquery or
metadata/resource compatibility. No supported admission change intended.

Ordinary aggregate source WHERE linked-owner coverage now includes grouped IPK/
REAL, CASE short circuit, FILTER DISTINCT/NULL and min-tie/reset cases, with exact
LIMIT0 prepare errors preserved. No admission/API changes; full aggregate phase,
RIGHT, metadata/resources and whole-candidate guarantees remain under verification.

Checkpoint repair preserves admitted retained compound aggregate Mem/Exists/Set
and LIMIT/OFFSET behavior, reset/types/names, plus streaming private-byte baseline
and ordered-sorter error/finalize precedence across UTF8/UTF16LE/UTF16BE. No budget
or admission narrowing. Shared424 current workspace pass is not isolated export
or complete lifecycle/origin/resource compatibility acceptance.


### R1 partial Boolean implication correction (2026-10-02)

`expr.c:exprImpliesNotNull` (6698–6768) distinguishes true-only from non-NULL proof and has no TK_AND/TK_OR cases. `where.c:whereUsablePartialIndex` (3700–3735) consumes that proof before choosing a partial index. The former TS unconditional AND recursion under NOT was unsound: NULL AND false is false, so NOT can be true while the partial predicate column is NULL. Nested AND now yields no proof; top-level conjunct splitting remains in `analyzeWhere`. Query-side OR is **not a direct translation of this switch**: the bounded true-only extension requires both arms independently prove the target and is disabled in every seenNot/non-NULL context. This compensates for absent upstream OR-derived analysis terms in the represented scalar path, rather than installing general OR optimization. If OR is true at least one arm is true; requiring both true-only proofs is sufficient. It cannot establish non-NULL OR operands (NULL OR true is true). Pinned public capture confirms `a=1 AND (c>0 OR c<0)` still admits forced p_live; removing this positive branch would reject a represented valid proof. Index-predicate-side OR remains a separate pinned `sqlite3ExprImpliesExpr` branch.

Verified pinned 3.53.4 native read-only fixture behavior in UTF-8/UTF-16LE/UTF-16BE: `a=1 AND NOT(c>0 AND a=2)` and reversed arms reject forced p_live at prepare and return INTEGER ids 1,2 unforced/NOT INDEXED. Parameter neighbors `[1,1]` and `[NULL,2]` return empty controls. The public regression checks both orders, reset/rebind, NULL, forced preparation rejection, zero unsafe index seeks, damaged partial-root off-path isolation, and a valid c>0 selected neighbor. No output filtering is used to compensate for an incomplete index. Frozen 24/30 selected-access accounting is unchanged; no general optimizer or complete implication claim follows.


#### R1 ordered enclosing entry ([[card:card-t-b]])
Bounded ordered table UNION ALL retains first-arm names and INTEGER/REAL/NULL types through reset. An out-of-range compound ORDER BY ordinal fails prepare with SQLite code1 instead of temporary unsupported. Enclosing preparation publishes no partial Program and does not retry a different compiler after a selected arm error. Admission breadth and other limits remain unchanged.

R2 bounded GROUP source-key owner update: ordinary compileAggregateSelect GROUP
keys now use resolvedExpressionCarrier + shared bindResolvedExpression with
aggregate resultLocation (linked SrcItem/cursor and IPK physical payload slot),
not resolve(aliasExpression(...)) spelling lookup before sorter capture. Deleted
now-unused aliasExpression walker; resolve remains live for ON/subquery owners.
Pinned resolve.c2081 GROUP ownership and expr.c4977 TK_AGG_COLUMN/select.c8579
source-key capture comparison supports this edge only: full directMode /
AggInfoColumnReg / sortingIdxPTab/iSorterColumn/REAL/RIGHT invalid-null and
source→sorter→bare/accumulator/final relationships remain original R2 debt.
Native source+alias/full-context tests and public phase/source/alias28 pass;
current type/shared aggregate/select/resolver + digest-pinned Chinook487 pass.
Earlier broad484/485 lacked CHINOOK_DB, rerun with existing pinned fixture, not
suppression. c828 streaming/budget/destinations and b547 ordered shared entry
remain unchanged. No new feature/admission/budget/WHERE reservation change.
GROUP ordinal semantic production and ON/subquery/parent consumers remain
explicit dependent seams; do not claim this bounded key edge completes R2.

R2 aggregate ON source-row update (supersedes preceding live-resolver census):
compileAggregateSelect grouped and ungrouped ON now consume aggregatePlan's
resolved ON expression carrier through shared bindResolvedExpression and
resultLocation, retaining linked lexical source identity/IPK/cursor/affinity.
Pinned select.c504+ ON tagging and resolve.c1062+ join-expression scope own
resolution, not a second spelling walker at predicate emission. Existing
predicate/reject-level/LEFT match/null-row/WHERE ordering and subquery callback
contracts are unchanged. Actual post-migration census finds no external calls
to the local recursive resolve walker: it was deleted with its stale comment.
The earlier claim that it remained a subquery consumer was incorrect; aggregate
subquery emission has its own linked context path. This is not proof that all
nested/parent contexts or AggInfo phases have migrated. No scope/admission or
private budget change. Native-first paired ON cases (grouped LEFT NULL/IPK,
ungrouped CASE/REAL/FILTER/DISTINCT/min bare tie) pass; focused31 and shared550
including canonical C1–C6, pinned Chinook, recursive destinations and private
lifecycle pass. Original full source→sorter→bare/accumulator/finalized column
ownership (expr.c4977 directMode/AggInfoColumnReg/useSortingIdx/iSorterColumn,
REAL extraction and RIGHT invalid-column NULL), GROUP ordinal production and
parent consumers remain explicit dependencies, not completed by this edge.


#### R1 recursive enclosing output entry ([[card:card-t-b]])
Ordinary admitted recursive queue output retains INTEGER/REAL types, names, bindings, reset/finalize and existing queue/private limits. Enclosing compile entry now constructs its shared program state and publishes only after successful compilation. This ownership change does not admit previously unsupported outer consumer LIMIT/OFFSET forms.

R2 grouped column-phase migration: compileAggregateSelect's linked binding now
attaches shared columnOwner/iAgg identity to actual column expressions. Grouped
payload production retains physical source-width layout; each payload column
owns iSorterColumn and saved bare accumulator cell. Shared expression emission
consumes directMode/useSortingIdx: source cursor before capture, sorter row
register+iSorterColumn for arguments/FILTER/local aggregate ORDER, saved column
cell for HAVING/output/unmatched ORDER after finalization. Removed independent
rowColumns/savedColumns recursive walkers and register-range/group-index identity
inference. select.c8579+ capture, updateAccumulator/reset/finalization and
expr.c4977–5027 TK_AGG_COLUMN govern the relationship. Bare saved-cell copies and
min/max tie change gating are retained. REAL sorter extraction copies into a
fresh Mem and emits RealAffinity only for iColumn>=0 REAL, not rowid; absent
column entry in phase lookup emits NULL. No RIGHT expression-index admission
claim: native iAgg>=nColumn NULL branch is represented but exact upstream
expression-index RIGHT invalidation producer remains unproved/dependent.
Browser VM adaptation: SorterData already decodes payload into contiguous Mem
registers rather than SQLite's pseudo-table cursor; sortingIndexRegister plus
owned iSorterColumn addresses that same row, preserving shared sorter budget,
async lifetime and Mem types. This replaces AST register rewrites, not a generic
evaluator. Native source/alias and focused phase/private tests41 passed; added
native-first BETWEEN/IN bare min tie + CASE REAL argument combination passes42.
Initial broad556 passed; fresh final offset-field refinement broad557 passed.
GROUP ordinal production, parent/subquery correlation phase contexts and full
AggInfo analyzer/index-expression relationships remain unfinished. No budget,
feature admission or public resource/lifecycle guarantee change; c828 streaming
private24 and d244 separate recursive counters remain intact.

R2 correlated aggregate EXISTS consumer repair (after d260): actual
compileAggregateSubquery EXISTS branch now obtains aggregatePlan.nested linked
select identity. Inner WHERE/ON reductions use shared resolvedExpressionCarrier
and bindResolvedExpression; local sources map to allocated inner cursors, outer
source identity maps through resultLocation to existing AggregateColumnOwner.
Deleted this branch's owners[] name/depth guessing and independent recursive
expression binder. Parent grouped HAVING (!directMode) reads saved bare cell;
source WHERE reads live source, sorter argument phase remains owner-selected.
expr.c analyzeAggregate7403+ source-column/nested traversal and TK_AGG_COLUMN4977+
plus resolve.c linked NameContext lookup and select.c capture/update/finalization
own this relationship. Existing sole-equality EXISTS ephemeral-key specialization
retains Once/KeyInfo/local materialization and probes with the same linked outer
phase; general predicate runs existing inner loops. Public native-first grouped
HAVING red returned [] instead of two INTEGER groups; now repaired. Additional
native controls for source WHERE, local alias shadow and sole equality were
captured after repair (not all native-first). Native source/alias, type, focused63,
changed-input broad664 including canonical/Chinook/index/private/recursive pass.
No new engine, budgets or root cursor remapping. d260 grouped coroutine and
ordinal, d247 recursive counters and c828 streaming private24 remain covered.
This is the EXISTS consuming slice, not full aggregate-subquery migration:
other scalar/IN contracts and full AggInfo analyzer/index-expression/RIGHT
invalidation remain incomplete. Retained producer ORDER/LIMIT composition is
separate coordination debt; no full R1/R2 architecture acceptance claimed.


#### R1 scalar/set enclosing entry ([[card:card-t-b]])
Zero-source scalar/VALUES and admitted compound sets now compile into enclosing SELECT construction state. Observable first names, INTEGER/REAL representative types, NULL, bindings and reset/finalize remain unchanged; missing arm column even LIMIT0 and ordinal range errors are prepare-time code1. No supported admission broadened or narrowed by this ownership migration.

R2 ordered scalar parent consuming migration: compileAggregateSubquery's
retained single-source ORDER BY/LIMIT1 SRT_Mem branch now binds actual result,
WHERE and ORDER reductions through nested resolved select/carrier identity.
Local source maps to its allocated cursor; outer reference maps via parent
resultLocation to AggregateColumnOwner source/sorter/saved phase. Removed only
this branch's independent local spelling/recursive walker. resolve.c linked
NameContext lookup, expr.c analyzeAggregate7403+/TK_AGG_COLUMN4977+ and
sqlite3CodeSubselect EP_VarSelect/Once branch govern actual consumers. Correlated
nestedPlan omits Once; each evaluation initializes NULL and reopens existing
sorter before reading local rows. Uncorrelated nestedPlan retains Once and
cached SRT_Mem. Existing read/WHERE rejection/Next/empty SorterSort/topN1/end
and shared async Mem/KeyInfo/private control remain unchanged; no new evaluator.
Native-first grouped nearest-row red (wrong no-such-column t.a) passes with
four distinct typed parent groups. Additional native controls captured after
repair (before paired public additions) cover source WHERE correlation, saved
output predicate with empty->NULL then populated groups, and local alias-shadow
uncorrelated cached scalar; types/names/reset/done/finalize retained. Native
source/alias, type/focused75 and changed-input selected broad670 pass including
b568 entry/canonical/Chinook/private/index/recursive. No entry edit or budget,
root reservation/admission guarantee change. c864 EXISTS/d260 ordinal+transient
sourceRegisters/d247 counters/c828 private24 preserved. This bounded consuming
migration does not complete scalar aggregate/IN/full nested depth, AggInfo
index-expression/RIGHT invalidation producers or general retained ORDER/LIMIT
composition. Parent architectural review remains revision_required.


#### R1 ordinary aggregate enclosing entry ([[card:card-t-b]])
Ordinary nonwindow aggregate entry shares enclosing program allocation and preserves grouped/ungrouped, empty aggregate, DISTINCT/ordered private limits, linked correlated subqueries, typed rows/metadata and reset/finalize behavior. Existing zero-source derived COUNT VALUES/compound support retained on shared parent state. No broader aggregate admission or guarantees added.

R2 scalar aggregate argument consuming repair: compileAggregateSubquery's
retained single-local-source aggregate scalar now binds actual aggregate
reduction/arguments via nested resolved identity and shared carrier/binder.
Local reference maps to inner cursor, outer reference through parent
resultLocation to AggregateColumnOwner live source or saved finalized phase.
Displaced local spelling/recursive argument walker removed. expr.c
sqlite3CodeSubselect EP_VarSelect guard, analyzeAggregate7403+ and
TK_AGG_COLUMN4977+ plus select.c resetAccumulator/update/finalize own state:
correlated invocation omits Once and initializes accumulator NULL each time;
uncorrelated retains Once. Empty Rewind goes to AggFinal, normal Next precedes
AggFinal. Same shared Mem/KeyInfo/async/error cleanup, no new evaluator.
Native-first SUM(local+parent) prepare-error red now passes distinct totals;
post-repair native-before-public controls source WHERE, REAL arguments,
local shadow/cache and NULL argument group then populated sums pass. Existing
runner checks types/names/two reset iterations/done/finalize. Type/focused81
pass. Selected broad676 has 25 failures (651 pass), NOT a green compatibility
claim: same-input disposable baseline with only vdbe pre-repair restored
reproduces all failing names across baseline suites. Existing enclosing
aggregate retained derived/COUNT composition failures require coordinated
follow-up; not waived as unsupported. No changes to b577 COUNT5268–5546/entry,
c873/c864/d260/d247/private/root seam. Full scalar/IN nested-depth/analyzer,
index-expression/RIGHT invalidation producers and retained composition remain
unfinished; parent revision_required. Phase NULL is not RIGHT producer proof.


#### R1 retained aggregate caller correction ([[card:card-t-b]])
Retained derived compound aggregate entry supports its prior physical/scalar arms, multiple outputs and ordered aggregate queues under shared parent state. Metadata, typed SUM promotion/overflow/TOTAL/group_concat, private limits and lifecycle remain covered by existing native/public tests. This corrects entry regression, not new shape admission.

R2 aggregate IN RHS consuming repair: retained one-column/one-local-source
compileAggregateSubquery IN branch now consumes nested resolved select/result
carrier through bindResolvedExpression. Local identity maps to allocated inner
cursor; outer maps via parent resultLocation to AggregateColumnOwner live or
saved phase. Deleted displaced local spelling/index/affinity column binder.
expr.c sqlite3CodeRhsOfIN3592+ EP_VarSelect and SRT_Set3711+ govern conditional
Once: correlated RHS reopens empty ephemeral set and recomputes child limits
per invocation; uncorrelated retains cached set. Existing OpenRead/Rewind,
OFFSET-before-insert, LIMIT-after-insert, Next/empty/end and shared InSet
probe/NULL/negation remain unchanged. Parent phase follows TK_AGG_COLUMN4977+
and linked resolve NameContext, not qualification text. Browser shared
Mem/KeyInfo/async/private cleanup unchanged, no new evaluator or admission
widening beyond correctly binding existing projected column contract.
Native-first grouped outer RHS red no-such-column t.a passes hit1/0/0/0;
post-repair native-before-public controls source WHERE, local shadow/cached
set, NULL-left empty LIMIT0 and LEFT-null-parent NOT IN prove distinctions.
Names/types/two resets/done/finalize and focused86/type/native source+alias
pass; fresh selected broad681/681 includes C1-C6/Chinook/private/index/recursive
and b unified compound aggregate repair. Previous c882 integration25 are
resolved by b583, not waived. No b583 compound/COUNT/entry or c882/c873/c864/
d260/d247/root reservation changes. Still unfinished: deeper aggregate lexical
ownership, full AggInfo analyzer/index-expression/RIGHT invalidation producers,
general retained ORDER/LIMIT/destination composition. NULL phase tests are not
RIGHT producer parity; selected tests are not whole-card architecture approval.


Bounded aggregate lexical ownership correction: on the ordinary physical
aggregate path, a scalar child SUM whose arguments reference only the outer
source now aggregates in that outer SELECT, not once per inner row. Child
empty source/WHERE retains scalar NULL; INTEGER/REAL and bare-column provenance
remain observable through the existing API. No API/scope or limits change;
general nested producer/AggInfo/RIGHT parity is not claimed. Paired regression:
select-aggregate-lexical-owner-native.py / .test.mjs.

R2 lexical aggregate scalar-expression consuming repair ([[card:card-t-c]]):
d269 resolve.c1356–1386 aggregateUses depth and expr.c analyzeAggregate
matching walkerDepth enrollment unchanged. Actual scalar result carrier now
consumes enrolled aggregate leaf registers through optional aggregateOutput
on existing shared expression binder, before argument binding. Retired
whole-result sole-aggregate lookup/Copy restriction; linked composite
arithmetic/CASE/cast codegen runs only on qualifying local scalar row, otherwise
initialized NULL survives Rewind/WHERE rejection. Source local cursor and
parent saved/source binding retained. Mixed unenrolled aggregate leaves remain
atomic typed temporary; local aggregate branch still owns its accumulator.
No generic evaluator, new graph walker or broad physical/transient/no-FROM
preparation guard removal. Native-first ungrouped SUM(outer)+1=[1,17] and
grouped totals2/4/6/8; native-before-public empty scalar and multi-leaf CASE
REAL/overflow-short-circuit controls pass. Names/origin/types/two resets/done/
finalize retained. Native lexical/source/type/focused260 and fresh selected
broad690 pass including C1-C6/Chinook/private/index/recursive. b583/c891/d269
and root WHERE0..30/sourceRegisters/private24/LIMIT contracts preserved.
Deeper/transient owners, full AggInfo analyzer/index-expression/RIGHT
invalidation producers, general retained producer/destination composition
remain unfinished. Phase NULL is not RIGHT analyzer proof; selected coverage
is not original architectural acceptance.


#### R1 specialized recursive SUM entry ([[card:card-t-b]])
Public recursive SUM selection now allocates enclosing builder/parameters/output destination before invoking compileRecursiveAggregateSelect. Existing queue producer and accumulator consume these allocations; finalize/Copy feeds emitSelectDestination rather than a hardcoded ResultRow. Parent entry alone adds Halt/finish; standalone helper mode remains for live callers. select.c generateWithRecursiveQuery/selectInnerLoop and sqlite3Select finalizeAggFunctions share Parse/Vdbe/destination; aggregate-expression queue destination is the existing bounded TS accumulator construction adaptation, not native SRT. Pre-emission decline preserves window/multiple-CTE ownership; selected errors remain terminal. No preparation guard broadening, lexical enrollment/binding change, flag removal or budget adjustment. Existing unsupported recursive SUM ORDER/LIMIT/other aggregate consumers remain honest exclusions, not silently discarded flags. Native INTEGER55/reset plus three-encoding public recursive controls precede migration; entry22/22 and destination/lexical/scalar/composition neighbors52/52 after migration, type/diff clean. Remaining table/window/multiple-CTE and general preparation R1 still incomplete; selected checks are not full architectural acceptance.


#### R1 multiple recursive CTE enclosing composer ([[card:card-t-b]])
compileSelect now supplies actual compileMultipleRecursiveCtes builder/parameters/output destination; existing producers materialize through sorter destinations in that same owner. Consumer row/output/order-key ranges now allocate through SelectProgramBuilder.range, not a separate manual counter; sorted and unsorted final events use supplied destination. Parent entry alone Halt/finishes; standalone callers remain live. select.c generateWithRecursiveQuery/selectInnerLoop SRT_Coroutine/SRT_Output and sorter output use one Parse/Vdbe; current zero-key FIFO sorter materialization/nested-loop representation is existing bounded browser adaptation, no new evaluator or finished-child relocation. Shared ParameterBuilder removes post-emission parameter decline: legitimate producer bindings now complete selected compilation and share numbering, independently native/public tested with rebinding/reset. Existing ORDER/collation/NULL support retained; LIMIT/OFFSET/other capability declines unchanged. Selected errors terminal, preparation depth/enrollment/composite binding guards unchanged. Fresh changed-input broad692/692 (includes prior SUM slice), initial focused52/52 and expanded CTE bindings31/31; native cross-join/bindings0/type/diff0. Remaining window/table/general preparation R1 unfinished; no architectural acceptance claim.


#### R1 recursive window enclosing entry ([[card:card-t-b]])
Public compileSelect now passes its builder/parameters/output destination through actual compileRecursiveWindowSelect transient preparation to existing compileWindowSelectLowering owner. sqlite3WindowRewrite/recursive source coroutine therefore consume enclosing state, output uses existing owner destination, root drain jumps past appended window subroutines to enclosing Halt; parent alone finishes. Standalone preparer/lowerer retained for live callers. select.c8314+ sqlite3WindowCodeStep/regGosub/addrGosub and window.c sqlite3WindowRewrite share Parse/Vdbe; existing async coroutine/window event representation unchanged adaptation. Lowerer initializes register highwater from supplied builder and publishes again after late frame/subroutine allocations, preventing enclosing continuation allocation overlap. No lexical guard, clause flag, queue/WHERE/root/private budget or error conversion changes. NameResolutionError remains public code1 and selected errors terminal; compound windows still explicitly reject. Source-first pinned recursive INTEGER row_number/reset/body LIMIT controls and cross-feature public baseline precede migration. Focused13/13 then final window/entry/CTE/private46/46, native/type/diff clean; fresh changed-input broad recorded in card status. Original ordinary window/table/general preparation convergence remains unfinished, not whole task acceptance.


#### R1 ordinary physical window entry ([[card:card-t-b]])
For a noncompound/no-WITH ordinary unqualified single physical table (not derived/CTE/flattened/function input), compileSelect allocates builder/parameters/output and reserves the live physical WHERE0..30 range, then passes shared state through actual compileTableSelect name preparation into compileWindowSelectLowering. Rewrite/WHERE/window/result destination and root continuation now consume enclosing owner; parent alone Halt/finishes. Other table specializations and qualified/multisource window inputs retain live standalone contracts, not unsupported flag dropping. Table preparer preserves NameResolutionError code1 and existing atomic zero-column incomplete-lowering rejection; unsupported translation is terminal, never a retry. Source select.c8318+ window step/Gosub/selectInnerLoop and window.c sqlite3WindowRewrite use same Parse/Vdbe; existing coroutine/event representation unchanged adaptation. Earlier late highwater/ownerExit contract retained, manual lowerer allocator convergence remains unfinished. Native paired physical FILTER/NULL/WHERE/EXCLUDE/order/limit rows/types/names/reset baseline before migration and after0; final focused49/49/type/diff0. Current fresh broad evidence in card status, not prior recursive694 reuse. Remaining ordinary table/general preparation, broader window branches/full allocator convergence and committed architecture proof remain original debt; bounded entry does not certify the full correction.

Bounded outer windows over retained simple physical SELECT/UNION ALL sources
and lowered nonrecursive CTE sources now reach window preparation before the
ordinary derived-scan ORDER rejection. FILTER/NULL and child-versus-consumer
LIMIT behavior is checked against the pinned native source via public APIs,
including reset/finalize. This is a repaired temporary-admission gap, not a new
scope exclusion or general transient/window compatibility claim.


#### R1 window setup register owner ([[card:card-t-b]], after d278)
compileWindowSelectLowering partition registers, partition-initialized/one/output-ready setup now allocate through enclosing SelectProgramBuilder.register (window.c1408–1418 sqlite3WindowCodeInit shared Parse.nMem). At each layer import still-manual prior consumer highwater before allocation, then publish frontier to remaining manual frame/buffer consumers; final late-subroutine highwater/ownerExit remains necessary. No independent setup counter, new evaluator or behavior flags; constant/null initialization and frame error ordering unchanged. Partition-initialized/output-ready are existing coroutine TS state, not new native registers claimed. Preserves d278 window-before-ORDER/flattening, retained compound+ordinary shared coroutine/common EndCoroutine/FILTER/independent LIMIT and standalone live callers, peer lexical/root/private/WHERE guards. Source-first linked native0 and public neighbors before migration; final focused88/88/native0/type/diff0 and changed-input selected broad in card status. Only these setup producers moved, not full lowerer allocation or ordinary table/general preparation convergence. Bounded ownership regression is not whole architecture approval; parent revision_required/original obligations remain.


#### R1 frame expression register owner ([[card:card-t-b]], after setup)
Actual compileWindowSelectLowering frame-bound compileExpressionTree callback now uses enclosing builder.register, retiring its independent ++registers producer. window.c sqlite3WindowCodeStep2881–2884 allocates offsets in shared Parse.nMem; 2941–2945 evaluates/checks them before partition processing. Existing TS once-before-producer evaluation/check adaptation unchanged; expression traversal, shared ParameterBuilder, ROWS/GROUPS integer vs RANGE numeric checking and error order unchanged. Published builder frontier back to still-manual exclusion/application/buffer consumers, keeping prior-layer import and final late-subroutine highwater/ownerExit. No flags/admission or root drain changes; d278 retained source rewrite/order/common coroutine/EndCoroutine/FILTER/independent limits and semantic/private/root WHERE guards preserved. Native-first ROWS1 PRECEDING..1 FOLLOWING and RANGE2 PRECEDING..CURRENT typed controls0; existing offset affinity/error/layered controls pass; final expanded focused183/183/native0/type/diff0, fresh selected broad in card status. Only frame expression owner moved; application/buffer/output/cursor/label/general table preparation still unfinished, not full architecture approval.


#### R1 window application register/cursor owner ([[card:card-t-b]])
Actual EXCLUDE rowid pair and EXCLUDE/lead/lag/first/nth application cursor producers now use enclosing builder.register/cursor (window.c1417–1422 sqlite3WindowCodeInit shared Parse.nMem/nTab). Import cursor next-free frontier with reserveCursorsThrough(frontier-1), preserving enclosing physical/rewrite reservations; publish builder register/cursor frontier to still-manual buffer/sorter/child/outer consumers. EXCLUDE-first branch, Integer1/0/OpenDup ordering, null application cursor when unused and existing cached-partition value/offset adaptation unchanged. Retired these ++registers/nextApplicationCursor++ producers only; shared late root/subroutine highwater, d278 rewrite/order/retained compound+ordinary coroutine/EndCoroutine/FILTER/independent LIMIT, semantic/private/root WHERE guards and standalone remain. Native-first typed EXCLUDE SUM/lag/first_value controls0; final focused184/184/native0/type/diff0 and fresh selected broad in card status. Remaining buffer/output/cursor/label/manual owners and ordinary table/general preparation plus committed architectural proof are unfinished; bounded producer migration is not full task approval.


#### R1 window input/record/rowid/peer register owner ([[card:card-t-b]])
Actual input range and four peer arrays now consume builder.range; record/rowid consume builder.register, retiring their ++registers producers (window.c2868–2902 sqlite3WindowCodeStep shared Parse.nMem). Zero input preserves next-free regNew without range(0); unused peers remain null/empty without allocation, contiguous range views are immutable arrays. Publish final builder register frontier to still-manual source/producer coroutines/output; setup/frame/application and late-root/subroutine handoffs remain necessary. Existing order/check/EXCLUDE/peer semantics and d278 rewrite/retained coroutine/EndCoroutine/FILTER/independent limits, semantic/private/root WHERE and standalone contracts unchanged. Native-first ROWS/RANGE/GROUPS typed controls0; final focused185/185/native0/type/diff0 and fresh broad in card status. Strengthened structural check initially sliced after regNew declaration (focused184/185, broad705/706); corrected test start boundary only, no production waiver. Buffer setup allocator moved, not remaining output/other cursor/label/manual allocation or real table/general preparation/committed architecture proof. Original task remains revision_required, not whole approval.


Bounded ROWS window correction (post-b658): moving first_value/nth_value ending CURRENT and following EXCLUDE CURRENT on unpartitioned retained VM frames now publish frame-specific values, including NULL empty frames, rather than cumulative first values or silent no-row output. Binding, frame validation, saved-error reset, finalize and suspension contracts unchanged. General partition/derived preparation remains incomplete; see TRANSLATION for bounded source mapping and resource adaptation limits.


#### d non-EXCLUDE bounded ROWS endpoint migration
[[card:card-t-d]] supersedes the preceding first/nth rescan rationale for admitted unpartitioned ROWS PRECEDING/CURRENT..CURRENT without EXCLUDE. Missing implementation was not a browser constraint. `compileWindowSelectLowering` setup now gives each affected function builder-owned contiguous start/end registers and an OpenDup cursor (window.c1452–1460,2009–2010). `emitEndpointRowsDrain` admits one end row, advances start after offset+1, increments exclusive-start/inclusive-end instead of first/nth callbacks (1718–1724), restores current payload, initializes NULL, validates current nth through WindowCheck (1480–1520), adds start, guards end, seeks and reads the argument (1930–1955). Builder labels resolve at the enclosing owner's finish; allocation imports/publishes late manual highwater. Sorter reservation now includes per-function cursors: the initial draft omitted these and overwrote an OpenDup with SorterOpen. No VM seek cast workaround.

Compiler owns this schedule/labels/register and cursor identities; VDBE still owns running PC, Mem arithmetic/affinity, cursor positioning, private budgets, Yield suspension, binding, saved-error reset/finalize. OpenDup/SeekRowid consumers compared with vdbe.c4480–4508/5495ff; duplicate positions remain independent over shared entries. Root [[card:card-s]] WHERE0..30/index/restart/RIGHT contracts untouched. No completed-program copying or independent evaluator added. Shared application cursor remains only for offset functions and specialized unconsumed first/nth branches; endpoint-only slice no longer allocates the superseded shared cursor. EXCLUDE retains reset/rewind/FILTER/step/value scan, including repaired readiness. Other partitions/frames, specialized callback schedules, source/producer/output manual frontiers and broader preparation gaps remain live debt, not migrated by this slice.

Observable typed rows/NULL/zero/empty/current-only/FILTER, bindings and saved errors remain covered by cross-layer tests; endpoint ownership tests require no first/nth callback plus guarded seek and retain EXCLUDE scan control. Independent pinned narrow3/expanded5 baseline was captured before edits; public two-execution/reset/metadata comparison passes after migration. Fresh pinned nth NULL/0/-1/1.5/non-numeric TEXT errors and numeric TEXT2 values agree with public binding tests. Existing focused/private tests exercise cancellation/suspended reset/deadline/lifecycle; not an exhaustive new concurrency matrix. Evidence and exact commands/hashes: work:///cards/card-t-d/endpoint-owner-green/ and card status. No exact native work-count parity: endpoint bytecode removes repeated candidate AggStep scans, but EphemeralIndexCursor.seekRowid still linearly searches shared entries; source Btree seek complexity/storage and cache-retention differences remain explicit existing primitive debt. No change to owner scope or resource guarantees, no whole architecture/compatibility approval.

Endpoint verification revision: typecheck and owner/cross-layer/private13 passed; final public narrow3/expanded5 failures0, focused197/197 and selected broad715/715 (C1–C6/Chinook/lifecycle/index/stat), zero skips/cancellations. Commands/logs in endpoint-owner-green; production SHA256 a336537d7cfec644416108183043a4c27b822ac4210ba183d7aad0801354b514 (final source comment only after runtime checks, typecheck rerun). No fresh full canonical12 native capture. Earlier typecheck and cursor-collision failures retained in card status.


#### R1 window coroutine destination register ownership ([[card:card-t-b]], post-d296)
Actual sourceCoroutine and per-rewrite-layer producerCoroutines now allocate on enclosing SelectProgramBuilder before InitCoroutine/body/SelectDest construction (select.c8058–8075 tag-select-0482 shared Parse.nMem, SRT_Coroutine, recursive sqlite3Select, EndCoroutine). Import register frontier then publish to still-manual source/buffer expression/output consumers; retired these independent ++registers producers only. Source/grouped/retained compound/recursive destinations use the same identity, payload/ParameterBuilder and common EndCoroutine; empty sources, predicates, child LIMIT and root readiness unchanged. d296 per-function endpoint cursors/labels and corrected sorter reservation, EXCLUDE scan, late highwater/ownerExit, d278 and semantic/private/root WHERE guards preserved. Final focused198/198, linked pinned native0 and independent previously captured narrow3/expanded5 public typed rows/reset/metadata controls0; fresh selected broad in status. Source/buffer callbacks, prior-peer/output-save/projection and other cursor/label/manual control plus ordinary table/general preparation and R1–R4 architectural proof remain unfinished; not whole approval or exact resource parity. No public contract narrowing or new algorithm substitution.


#### R1 positioned window source/buffer expression allocation ([[card:card-t-b]])
Actual source predicate, producer FILTER and constant unary/cast/parameter compileExpressionTree callbacks now allocate on enclosing builder.register, importing/publishing manual frontier around each actual expression producer. expr.c sqlite3GetTempReg7600+ consumes shared Parse.nMem (with native temporary reuse); existing TS monotonic temporary allocation remains, now shares enclosing ownership. Source IfNot-before-Yield and FILTER/carrier positioned-row evaluation before payload Copy remain unchanged; retained/grouped/recursive and prior-window identity copies precede expression branch as before. No new evaluator, late recomputation or flag narrowing. d296 endpoints/cursors/labels/sorter reservation/EXCLUDE/readiness, b coroutine identity, d278 child LIMIT, semantic/private/root WHERE0..30/late highwater preserved. Focused199/199/type/diff0 and native FILTER/public expanded controls0, fresh selected broad in status. Remaining prior-peer/save/output projection and manual cursor/label/control plus ordinary/general preparation/R1–R4 proof are not waived; no exact native work/temporary reuse parity claim.


#### R1 retained output/peer range allocation ([[card:card-t-b]])
Eleven actual cached-drain outputSave/endSave/startSave/currentPeer/previousPeer contiguous producers now use enclosing builder.range, preserving zero-width frontier without allocation and importing/publishing to live manual consumers. window.c2870–2904 shared Parse.nMem input/peer ranges compared. TS payload operations overwrite regNew while independent cursors advance; existing saved row Copy/restore before Yield remains necessary adaptation, not a new algorithm. No step/inverse/EXCLUDE/readiness/error branch reordered; d296 endpoint saved ranges/cursors/labels/sorter frontier untouched. Source/callback/coroutine handoffs, d278 child LIMIT and semantic/private/root guards preserved. Focused200/200/type/diff/native/public0, selected broad in status. This bounded saved-row/peer allocation repair does not certify output projection/callback ownership, other cursors/labels/control/general preparation, temporary reuse or full R1–R4 closure; no public narrowing.


Retained-window publication regression (post-b685, [[card:card-t-d]]): finite
admitted ordinary/CTE/UNION ALL children with bounded first/nth ROWS frames and
outer ORDER/LIMIT/OFFSET now resolve compiler labels before VM publication.
Public typed INTEGER/NULL rows, metadata and reset repeat execution are covered
by `select-window-retained-endpoint-integration.test.mjs`. No API, limits or
unsupported-boundary change; linear private seek and broader preparation gaps
remain documented in TRANSLATION.


#### R1 window root projection/consumer limit register owner ([[card:card-t-b]])
Actual outputStart contiguous row range and computeLimitRegisters callback now allocate on enclosing builder after frontier import, publishing to remaining manual output/late-subroutine consumers. select.c1177–1202 selectInnerLoop iSdst/nSdst shared Parse.nMem compared: allocation is conditional on emitting a nonempty admitted row, non-emitting remains0. Consumer OFFSET-before-SelectDest and LIMIT-after, direct/sorted projection and shared parameters unchanged. Existing sort prefix/key construction and manual other consumers remain debt, not source ownership completion. d305 outer Halt/finish after late subroutines and ownerExit retained (never finish nested builder); endpoint cursor/sorter/labels/EXCLUDE/readiness, retained child LIMIT/common coroutine and semantic/private/root WHERE0..30 untouched. Focused204/204/type/diff/public-three/native0; expanded native12/public still ten matches/two preparation failures aggregate compound child/first_value CAST, not waived. Fresh broad in status; no full R1–R4 or resource parity claim/public narrowing.


#### R1 ordered root key/sorter allocation owner ([[card:card-t-b]])
Actual outerSorter now consumes enclosing builder.cursor after conditional reservation through live application/rewrite sorter frontier; publishes next-free cursor to remaining manual callers. Actual SorterInsert keyStart contiguous range now builder.range with register handoff; no-sort branches allocate neither cursor nor key. select.c8215–8235 tag-select-0600 shared Parse.nTab cursor construction and1180–1207 sort prefix/iSdst Parse.nMem compared. Existing separate key/payload VM representation retained; readiness/Copy/SorterInsert/SorterData/SelectDest/OFFSET/LIMIT order unchanged. Reserved application endpoint cursors remain disjoint; d305 outer Halt/finish after late bodies and ownerExit, d296 labels/EXCLUDE/readiness, semantic/private/root WHERE0..30/peer dirty intact. Focused205/205/type/diff/native/public-three0; expanded12 still ten matches/two preparation failures, not waived. Fresh selected integration in status; broader register/frame temporary/cursor/control/general preparation/R1–R4 ownership remains debt, not full approval or exact resource parity.


#### R1 late bounded-peer EXCLUDE scan construction ([[card:card-t-b]])
sharedBoundedPeerExclusion now consumes shared builder registers for current/start/candidate rowids, temporary accumulators, constant width and ties identity. Rewind/first/bounds/peer/ties/FILTER/next/finish branches now shared labels marked in the same order; displaced per-op manual address writes retired only here. Enclosing finish resolves labels after late bodies (d305 Halt/ownerExit unchanged); existing application OpenDup cursor remains setup-owned, no replacement cursor. Compare pinned window.c1814–1910 windowFullScan: current identity, reset before scan, skip before start/stop after end, EXCLUDE GROUP or TIES current-row exemption, FILTER before step, aggregate value then payload restoration. Existing TS bounded-rowid start computation and monotonic temporaries remain adaptations, not a new evaluator/native temp-reuse or resource-count claim. Source/producer current payload is authoritative because candidate EphemeralData overwrites regNew. Pin-checked public GROUP/TIES/NO OTHERS FILTER rows/NULL/metadata/reset added; existing error/bind/limits/suspension controls retained. Shared parameters/destination and root output/key/limit unchanged; d296 endpoints/sorter cursor reservations/EXCLUDE/readiness, semantic/private/WHERE0..30/peer dirty preserved. Expanded12 remains two preparation RED gaps; earlier independent drains/general preparation/control/full R1–R4 ownership unfinished. Exact checks/patch/hashes in card status, no full compatibility approval.


#### R1 late sliding/current-following drain control ([[card:card-t-b]])
Actual sharedSliding/sharedFollowing FILTER skips and size-gated inverse/snapshot continuations now builder labels/jumps; displaced manual per-op PC fixups removed in both callers. Registers/bound parameters/duplicate cursors were already setup-owned; no replacement state/cursor or algorithm. Pinned window.c2995–3044 step/return/inverse branches and vdbeaux.c610 label production compared. Sliding step -> trim/inverse -> authoritative producer Copy restore -> value, following step -> readiness -> snapshot/value -> ready flag -> inverse remain distinct and ordered. Labels defer to d305 enclosing finish/Halt after late subroutines/ownerExit, never finish nested graph. Public pin-confirmed preceding/current, current/current, current/following FILTER INTEGER/NULL/metadata/reset controls added; existing binding/error/limits/suspension controls retained. b709 bounded-peer labels/frontiers, d296 endpoints/sorter cursor identity/EXCLUDE/readiness, semantic/private/root WHERE0..30/peer dirty preserved. Neighbor cached-offset/other frame drains have independent admission/readiness/return targets and remain debt, as do general preparation/WHERE/full R1–R4 and expanded12 two preparation RED gaps. No exact native work/temp-reuse/linear-seek parity claim; exact checks/patch/hashes in status.


Recursive window FILTER regression (post-b721, [[card:card-t-d]]): admitted
recursive coroutine rows now supply FILTER from the current destination payload
before caching frame arguments. Bounded ROWS with EXCLUDE GROUP/TIES/NO OTHERS,
ordered LIMIT and reset preserve INTEGER/NULL results in the existing cross-layer
tests. No public signature, resource limit, binding/lifecycle or admission change.
Remaining grouped/CAST/compound preparation gaps are documented in TRANSLATION.

Grouped ordinary aggregate/window FILTER consuming repair ([[card:card-t-c]]):
resolve.c1320–1355 retains NC_AllowAgg for pWin, disables NC_AllowWin:
ordinary aggregates in window args/FILTER are legal, nested windows remain
misuse. TS nested-aggregate diagnostics now apply only to ordinary calls;
ordinary aggregate FILTER misuse remains code1. window.c rewrite caches
pWin->pFilter expression, not the FILTER-clause syntactic container.
window-rewrite.ts now buffers that actual predicate reduction and the same
resolved carrier; retired wrapper-as-buffer-value mechanism. Actual grouped
producer's compileAggregateSelect destination evaluates/finalizes COUNT and
predicate then copies its rewritten expression column into window cached
FILTER slot; window.c1685–1701 cached IfNot/AggStep order preserved.
No raw cursor substitution or evaluator, no vdbe/producer/index remap.
Native-before-code original count/count FILTER gives INTEGER[4,4]; false and
NULL FILTER give NULL, CAST(count AS REAL) arg gives REAL4. Two-run public
metadata/reset/done/finalize tests and ordinary misuse code1 controls retained.
Resolver expectations for window-over-aggregate permission/error category
corrected to pinned context semantics (median unavailable in native build;
supported SUM/JSON substitute confirms nested-window error category).
Standalone first_value CAST argument and aggregate-compound derived window
child remain separate unimplemented preparation gaps, not expanded here.
Preserve d314 retained/recursive columnIndex vs grouped expression index vs
previous-layer identity/physical cursors, b721 labels/frontiers, d305 finish,
d296 endpoints/EXCLUDE/readiness, private24 and root WHERE0..30. Deeper/mixed/
transient lexical/full analyzer/index-expression/RIGHT/general composition
unfinished; no whole architecture/native-resource compatibility claim.

Window producer expression consuming repair ([[card:card-t-c]], CAST tranche):
pinned window.c1036–1060 appends full argument expressions/pFilter to the
rewritten producer (SQLITE_SUBTYPE specialized branches remain distinct);
expr.c5171 TK_CAST recursively codes child then OP_Cast; select.c preparation
invokes rewrite before WHERE lowering. Actual emitProducerBinding now uses
resolvedExpressionCarrier + bindResolvedExpression + compileExpressionTree
for represented producer expressions, including CAST(column), composite args
and FILTER. Retired literal opcode emitter/producerConstant private admission
walker and separate FILTER evaluator at this caller; no new evaluator.
Deferred window-result slots remain structural handoff NULLs, not scalar
functions; previous-layer exact expression/window result copies precede new
binding. Composite previous-layer columns bind to child regNew binding indexes
or reject typed temporary if absent, never exhausted physical cursors.
First retained/recursive expressions bind payload+resolved columnIndex;
grouped finalized-expression-index copy remains earlier and distinct.
Physical sources still bind positioned cursor, shared Mem/KeyInfo/Btree async,
b721 labels/d305 finish/d296 endpoints/private24/root WHERE0..30 unchanged.
Eight independent native/public controls in cross-layer suite check REAL vs
INTEGER, NULL, TEXT, arithmetic/lag/default, FILTER, retained LIMIT and CTE,
column names and two executions/reset/done/finalize. Original REAL CAST native
before code; baseline driver incorrectly projected TEXT as NULL (missing text
API), corrected independent native capture supplies TEXT "1" (not product
waiver). Frame/binding/error/private lifecycle checks rerun as existing coverage.
CAST first_value preparation gap closed for represented linked expressions;
aggregate compound-derived child/full analyzer/deeper/mixed/transient/RIGHT/
index-expression/general composition/linear-resource debt remains. Arbitrary
residual expression/subtype/deeper previous-layer combinations are not declared
supported merely by this tranche; no architecture-wide compatibility claim.

Aggregate compound-derived window consuming closure ([[card:card-t-c]]):
the preceding CAST suffix's aggregate-compound-child preparation gap is now
closed for represented ordinary aggregate/GROUP/HAVING UNION ALL producers.
select.c multiSelect TK_ALL shares destination and LIMIT state across complete
arm SELECTs (3000ff); selectInnerLoop SRT_Coroutine1441ff copies result/yields;
sqlite3Select prepares window rewrite7699 and analyzes aggregate ELists/HAVING
before producer output. Actual compileTableSelect retained-window preparation
now precedes older CTE/repeated/single-compound derived interceptors, retaining
this existing specialized owner for eligible single source window consumers.
compileWindowSelectLowering → compileTableCompoundProducer → compileCteUnionAll
→ compileAggregateSelect(parent destination, compoundLimit) yields directly
into enclosing window sourceCoroutine/payload. Ordered arms use existing
compileOrderedCteUnionAll merge destination with child LIMIT/OFFSET. Noncompound
aggregate retained child dispatches to the same aggregate owner, not raw scan.
GROUP/HAVING arm carriers now preserved rather than flags with erased trees;
GROUP-only arms use aggregate grouping owner. Complete arm dispatch precedes
simple relational gate, without masking flags. Shared LIMIT initialized once,
OFFSET checked before destination, aggregate stop branches patched to compound
end, EndCoroutine child then enclosing finish/Halt; no child Program copying.
Retired intercepted preparation for these callers and aggregate/window-only
compound LIMIT exclusion where shared aggregate contract already exists.
Missing tree/unsupported arm still aborts prepare typed temporary. SELECT
outer WHERE/grouped/window-in-child/joins/general composition remains separately
bounded; this is not generic AggInfo/analyzer/RIGHT/index-expression/subtype or
linear-resource acceptance. Shared expression phases, c909 FILTER/!over, d314
recursive payload, root WHERE0..30 and frame/private/label/finish seams unchanged.
Independent pinned original + empty/child LIMIT0/1/order/group/HAVING/predicate/
CAST outer LIMIT/OFFSET/noncompound aggregate/GROUP-only controls retained in
cross-layer suite: typed rows and native names, two runs/reset/done/finalize;
parameterized compound frame binds/error-reset validated. Existing selected
suspension/private budgets/frame controls rerun, not newly comprehensive native
metadata origin/encoding/BLOB/resource comparison. Broader debts unwaived.

Grouped incompatible window frames now preserve finalized aggregate values
inside complete CAST/FILTER argument expressions through the previous rewritten
layer payload ([[card:card-t-d]]). INTEGER/TEXT and reset regression lives in
select-window-cross-layer-integration; no API/limit/admission changes. Remaining
correlated window argument/general preparation and resource debt remains explicit.

Scalar-subquery window producer consuming closure ([[card:card-t-c]], after
d323 aggregateOutput handoff): complete window argument expression codegen now
supplies the existing linked scalar-subselect lowering owner, extracted from
compileInnerTableSelect into resolvedScalarSubqueryEmitter (not a second
expression evaluator). resolve.c TK_SELECT links pNext and sets EP_VarSelect;
expr.c sqlite3CodeSubselect initializes NULL SRT_Mem, uses Once only when not
correlated, and first-row return/SELECT LIMIT. window.c selectWindowRewriteExprCb
and argument projection keep the complete expression at producer evaluation.
TS consumer uses resolved.nested identity/column carriers; local reader has its
own builder cursor, outer source reads use actual window phase location callback
(positioned physical, retained/recursive payload or previous regNew buffer).
Predicate rejection advances Next, empty scalar remains NULL; ordinary aggregate
scan finalizes even on empty input; scalar projection copies into Mem and exits
on first row. LIMIT follows expr.c:sqlite3CodeSubselect X<>0 with numeric affinity, then
select.c integer admission (NULL errors; nonzero TEXT/REAL admit one row),
not ordinary raw LIMIT admission or SQL-text guards. Nested code recurses through same
callback; zero-FROM scalar fallback preserved. DISTINCT/GROUP/HAVING/ORDER/set/
OFFSET/other unrepresented subselect branches remain atomic typed temporary.
Joined callers retain their original normal affinity/collation binding; window
phase policy is supplied only by window consumer. A broad joined NULL identity
regression exposed erroneous applying window policy everywhere (COUNT became1
instead of2); corrected owning callback policy before acceptance. Opening nested
reader at its consuming body replaces unconditional pre-opening; Once encloses
open/initialization/scan for uncorrelated, correlated reinitializes each input.
No VM/storage/WHERE change, Program copying or independent evaluator added.
Full ordinary scalar owner broader implementation remains live, not claimed
retired; new shared consumer is bounded to these existing resolved scan branches.

Native-first eight cases + four connected LIMIT0/-1/REAL CAST/empty-aggregate
controls, rows/types/names retained in cross-layer suite, twice/reset/done/finalize.
Original inequality MAX first_value produces all NULL under pin (first frame
argument is NULL), NOT inferred lack of correlation. CURRENT ROW equality checks
1/3/5/7. CTE retained/grouped/incompatible previous-layer controls retained;
parameter LIMIT0/1/-1 and NULL saved-error/reset plus nonzero TEXT/REAL admission, lexical missing column
and width diagnostics checked. Existing frame/private/suspension tests rerun,
not exhaustive new native origin/BLOB/encoding/resources/suspension comparison.
d323 aggregateOutput/deferred/grouped/prior/physical, c909 permissions,c927 arm
shared limits, d305 Halt/finish, d296 endpoints/b labels/root WHERE0..30/private24
remain. Full analyzer/deeper transient/mixed/RIGHT/nTab/index/subtype/general
preparation and linear seek/storage/resource debt unwaived; bounded ownership
restoration, not architecture acceptance or blanket scalar/window compatibility.

Scalar child LIMIT correction (current closure): exact expr.c3880–3946 comparison
found original raw computeLimitRegisters admission was wrong. Pinned X<>0 numeric
comparison admits nonzero TEXT/REAL, rejects NULL at integer admission, and skips
numeric zero. Independently captured five native controls (bad TEXT, REAL0.5,
NULL, TEXT0/1) in window-subquery-repair/oracle-limit.json; shared subquery owner
now emits comparison before MustBeInt. This supersedes earlier invalid-TEXT
code20 test/document claims; ordinary enclosing SELECT LIMIT remains unchanged.


#### R1 joined direct/sorted destination exit closure ([[card:card-t-b]])
compileInnerTableSelect now emits direct OFFSET continuation, producer LIMIT/first-row iBreak and sorter empty/data/OFFSET/next/break via shared builder labels; standalone consumer uses local builder. select.c1177ff selectInnerLoop and vdbeaux.c610 label contracts: destination is emitted before count decrement, OFFSET skips destination, empty sort skips all output. Removed outputLimitStops and producer Goto0 scanner, sortAt/offsetAt/limitAt drain mutations only within this consumer. Compound LIMIT stops deliberately remain enclosing-owned numeric handoff until that caller migrates; source WHERE/RIGHT rewinds/interior validation remain live. New resolveLabel resolves a closed producer's selected labels without freezing the enclosing program: RIGHT interior numeric validator requires resolved targets now; d305 enclosing finish/Halt still publishes all other deferred bodies. No nested finish or PC-copy rewrite. Shared c936 resolved scalar emitter/phase/X<>0+MustBeInt and d323 finalized aggregateOutput, b scan/drains, d296 endpoint/sorter readiness/EXCLUDE/physical0..30/private24 preserved. Native-first public joined direct/sorted LIMIT/OFFSET, scalar first-row and empty controls added with INTEGER/name/reset checks. Full analyzer/RIGHT/nTab/resource/general preparation/R1–R4 remain, no architecture acceptance/native resource-count parity claim. Exact checks and gaps in status.


#### Linked scalar projection consumes ordinary SELECT destination ([[card:card-t-c]])
Current consuming repair (supersedes census RED for projection only):
resolvedScalarSubqueryEmitter now hands its already-admitted nonaggregate,
one-local-physical-source projection to compileInnerTableSelect on the same full
builder/parameters and initialized Mem destination. Removed its independent
projection scan/first-row success Goto; specialized scalar aggregate scan remains
live. Both complete window arguments and joined expression callers use this
handoff. No child Program/PC relocation/finish or generic evaluator added.
Pinned expr.c3841–3978 owns Once/NULL/numeric X<>0 child LIMIT admission;
select.c1177ff/1422 owns WHERE→projection→Mem and first-row producer exit.
Prepared scalar flag means admission was already emitted, not permission to
ignore LIMIT; zero/NULL/nonzero TEXT/REAL controls retained. Linked child source
identity is unchanged, cursorFor maps local physical reads consistently including
Next; explicit window binding carries retained/prior/physical outer phase into
projection and WHERE, whereas joined default retains affinity/collation. Actual
full builder replaces the standalone legacy adapter; standalone nested cursor
frontier999 stays, enclosing-owned callers retain their own frontier. Register
allocation and final standalone register count now use that builder.

For this bounded linked scalar handoff, existing source scan owner uses its
ordinary full scan rather than physical candidate seeks: generated WHERE seek
operands currently have no reduction/outer-phase identity, and cannot consume a
prior-buffer outer register honestly. This does NOT add a scan evaluator or
change root WHERE0..30. Ordinary scan result/predicate/Next branches are reused;
root selected index/RIGHT callers unchanged. Native/public equality, inequality,
empty, first-row and CURRENT ROW controls plus existing LIMIT/error/reset tests
check observable preservation, not index/resource parity. Full linked preparation
and a phase-aware root WHERE candidate operand interface remain prerequisites
for later convergence. GROUP/HAVING/ORDER/DISTINCT/compound/OFFSET/IN/EXISTS and
multisource admission not widened; supported shapes cannot be reclassified
unsupported. d323 aggregateOutput,c927 limits,b730 RIGHT resolveLabel validation,
d305 late finish/Halt,endpoints/EXCLUDE/readiness/frontiers/private24 unchanged.

Production/source/prerequisite census:
docs/research/card-t-c-linked-scalar-preparation-census.md. New durable ownership
check and six independent pinned typed-row/name/reset controls:
test/conformance/select-linked-scalar-preparation-owner.test.mjs. Existing scalar
LIMIT window tests include NULL saved error/rebind and TEXT/REAL numeric admission;
selected tests do not establish complete metadata/BLOB/encoding/resource parity.
Full analyzer/RIGHT/nTab/storage/linear native work and general destinations remain
unwaived. This is bounded consumer convergence, not architectural acceptance.


Linked scalar aggregate implementation note: already-supported joined/window
one-physical-source scalar aggregates now share aggregate SELECT production and
Mem destinations; public admission and metadata contracts unchanged. Correlated
invocations explicitly reset accumulators, scalar LIMIT retains numeric X<>0
admission and NULL code20 behavior. No FILTER/DISTINCT/GROUP/ORDER admission
expansion or complete native resource/metadata parity implied. See TRANSLATION
“Linked scalar aggregate producer convergence” and card-t-c status for evidence.


#### Ordinary physical output/drain graph closure ([[card:card-t-b]])
compileTableSelect physical output now builds its direct/sorted destination graph in one local SelectProgramBuilder, publishing finish after SELECT-owned terminal Halt. select.c generateSortTail1673ff addrContinue/addrBreak and selectInnerLoop own DISTINCT/filter bypass, OFFSET-before-destination/count-after, empty sorter/drain/next. Removed tail arrays/splice/result-opcode scans and scanContinue/first IfPos/decrement/Halt searches. sqlite3WhereEnd3538ff now falls through to SELECT-owned drain instead of inserting premature Halt; the SELECT marks its continuation before source unwind; existing IN restart/seek/bound/NULL exits remain source-owned. Actual DISTINCT/residual/offset/limit/sorter consumers use builder labels, not an unused facade. Ordinary register/parameter/cursor preparation still manual; no general allocator or nTab closure claimed. Root phase-aware seek seam unchanged.
Source-first DISTINCT INTEGER DESC LIMIT/OFFSET exposed planner-authorized reverse table loop emitted Rewind/Next despite consumed ORDER. Corrected owning positioning to Last and paired Prev for ordinary reverse table scans (wherecode.c aStartOp/aStep, where.c sqlite3WhereEnd7520ff). Intermediate Prev-with-Rewind error corrected at source positioning, not VM. Native3/public3 now agree including ordered empty/direct filtered controls; metadata/reset verified publicly, no native origin/resource parity. Joined b resolveLabel RIGHT validation, c/d scalar LIMIT/Once/NULL/phase/aggregateOutput/recursive input/compound limits and late d305 finish unchanged. Guide/source mapping boundedly updated, API signatures unchanged. General preparation/full analyzer/RIGHT/nTab/resources/direct-derived/grouped/multiple-minmax/unqualified substitution/R1–R4 remain unaccepted.


Physical scalar implementation convergence: already-supported nonordered
physical scalar projection/aggregate and nonaggregate EXISTS share linked SELECT
production/Mem/Exists destinations. No public signature change; numeric scalar
LIMIT, saved NULL errors, reset and first-row/empty semantics preserved. Ordered
scalar/aggregate EXISTS/IN/transient fallbacks remain specialized; previously
rejected ORDER/OFFSET is still documented debt, not a new exclusion. See current
TRANSLATION physical linked scalar caller convergence evidence and limitations.


### Ordered linked scalar destination closure ([[card:card-t-b]])
Current resolvedScalarSubqueryEmitter now hands ordinary scalar projection ORDER/OFFSET to compileInnerTableSelect with scalarPrepared and explicit sharedLimit. expr.c3933–3962 normalization owns X<>0/numeric guard/NULL datatype20, initialized Mem/Exists and Once; SELECT gets count1 default or normalized count, integer OFFSET and combined/capacity ranges. select.c selectInnerLoop SRT_Mem and generateSortTail1673ff own OFFSET-before-destination, destination/count/first-row exit, empty NULL and drain labels. No ordinary raw-LIMIT reevaluation. Scalar-prepared producers intentionally retain c945 full scan adaptation (phase-aware candidate operand seam); now multiOrderConsumed cannot claim ordering from the planner path whose physical loops are suppressed. Otherwise DESC lost sorter and yielded1 instead of7. Scalar correlated sorter opens before scan each invocation, not only after first accepted WHERE input, fixing empty/first transitions without VM patch.
Physical ordinary ordered scalar callers now delegate actual linked shared production; removed their superseded manual ORDER/SorterOpen/insert/drain/ClearSorter mechanism. IN/zero-source/transient/aggregate EXISTS live, no indiscriminate removal. Aggregate scalar ORDER singleton remains aggregate-owned; aggregate OFFSET admission still explicit temporary (not approved permanent exclusion). Nonaggregate physical OFFSET now translated using normalized scalar count; no product scope change. Shared cursor/register/parameters/outer phase/Once/frontier/late finish preserved. Public signatures unchanged. Native-before full enclosing8 includes existing correlated/empty crash and OFFSET admission gap; seven row controls plus NULL20 saved-finalize regression added. Selected typed/reset/origin controls are not full resources/BLOB/encoding/suspension fidelity. Full preparation/AggInfo/nTab/RIGHT/phase-aware seeks/R1–R4 remain unaccepted.


Bare aggregate output correction: admitted physical/join non-GROUP min/max
now capture source-owned winning input columns after accumulator update;
correlated scalar output binds those saved columns. Ordinary aggregates retain
first-row bare values; empty input retains NULL. Multiple min/max does not
promise a unique winner, and DISTINCT can retain a different tied input per
upstream magnet semantics. No API signature change; FILTER admission and
unproved deeper/grouped/recursive ownership remain documented engineering debt.


Admitted ordinary physical/join min/max FILTER calls dispatch to aggregate
production using call argument arity (FILTER is not another argument). Ordinary
local aggregates combined with windows now finalize the inner aggregate producer
before window input, including no-GROUP/empty aggregate output. Typed rows and
lifecycle retain their existing contracts; no public signatures changed. Plain
recursive aggregate and correlated scalar FILTER admissions remain temporary
implementation gaps, not scope exclusions or compatibility guarantees.


### Ordinary recursive aggregate input closure ([[card:card-t-b]])
Current compileSelect recursive branch now selects compileRecursiveAggregateSelect with real schema/database, replacing SUM-only argument/destination/evaluator specialization. It reuses recursive-window resolver-only transient SrcItem description (prepareRecursiveSource), resolves immutable linked NameContext, composes existing compileRecursiveCteSelect Queue/Current producer to SRT_Coroutine on same builder, then feeds compileAggregateSelect input.first/emit. No rootPage0 OpenRead, synthetic read producer, new runtime or completed Program relocation. TableNode metadata is the existing browser resolver representation of CTE SrcItem columns, not new physical schema. Input registers own direct AggInfo reads; saved/final binding owns output. SELECT owns WHERE/step/bare capture/AggReset/finalization/destination and consumer LIMIT/OFFSET; producerOnly keeps CTE body LIMIT separate. Enclosing entry publishes shared parameter names and late Halt/finish after all labels. Retired SUM aggregate-expression path only in this migrated consumer; other destinations stay live.
Source: select.c generateWithRecursiveQuery2667–2830 Queue/Current/setup/recursive/destination/body limits, sqlite3Select preparation and SrcItem coroutine path, selectInnerLoop Mem/Output/Coroutine, updateAccumulator6880–6977 shared regHit/regAcc NEEDCOLL/FILTER, expr.c saved aggregate column phase. Streamed input now reuses existing emitPhysicalAccumulator rather than independent exactly-one-minmax capture: last invoked magnet controls bare row; FILTER regAcc-before-jump and DISTINCT bypass preserved; ordinary aggregate saves first admitted input; empty finalizes once. This closes plain recursive MAX+bare pin5/5. SUM/count/min/max/FILTER/WHERE-empty/DISTINCT/REAL/multiple-minmax/LIMIT0/OFFSET controls pass selected matrix. GROUP/HAVING and nonordinary multi-source/compound consumers remain explicitly unsupported, scalar nested output admission remains a separate debt; no silent partial grouping or scope exclusion. Nine native-first full enclosing typed/name/reset controls added; original public18 no longer has this admission failure. Grouped/correlated full matrix residuals remain documented, no resource/origin/BLOB/encoding/suspension parity claim from selected controls. General preparation/AggInfo/nTab/R1–R4 remain open. Public method signatures unchanged; admitted recursive ordinary aggregate output broadened through existing semantic owner, not SQL-text special cases.


### Recursive grouped aggregate admission ([[card:card-t-b]])
Bounded single recursive CTE aggregate consumers now support GROUP BY/HAVING
through the existing grouped aggregate owner, including typed winner/ordinary
bare rows, FILTER/DISTINCT, empty groups and consumer ORDER/LIMIT/OFFSET. CTE
body LIMIT/OFFSET remains separate. No method signatures or lifecycle contracts
changed. Recursive nested zero-source scalar output and combined grouped
FILTER-window admission remain implementation gaps, not scope exclusions.
Selected controls do not certify native metadata origins or global compatibility.


Ordinary physical scalar singleton SELECT now observes child WHERE and normalized
scalar count/OFFSET via shared prepared production, initialized NULL on skipped
rows; correlated direct singleton references consume the current outer row.
EXISTS uses the same predicate-aware singleton visit and initialized0. Typed
values/reset/finalize contracts unchanged. Transitive nested singleton correlation and nested EXISTS now preserve per-row
outer binding and avoid incorrect Once caching, with UTF8/16 regression controls.
Grouped aggregate FILTER plus window preparation remains an explicit
implementation gap, not an exclusion or a new compatibility guarantee.


### Grouped-to-window outer expression ownership ([[card:card-t-c]])
Supersedes the retained original15 grouped FILTER-window admission prediction.
Native-first full9 sibling baseline (source-ID asserted) and original15/18
are at work:///cards/card-t-c/group-filter-window-red/. All9 siblings rejected
before this slice; inner lowering returned columns0, not an accumulator/frame
exception. window.c selectWindowRewriteExprCb744ff rewrites terminals while
sqlite3WindowRewrite958ff moves GROUP/HAVING and persists AggInfo in the child.
TS lifted terminals correctly but outer output required whole-expression identity:
a%3 had lifted a, not a%3, so publication remained atomic unsupported.

compileWindowSelectLowering now binds surviving outer expressions through the
existing resolver carrier/expr lowering to finalized root payload registers.
Lifted aggregates consume their finalized payload; columns consume saved group
winner values, never raw source cursor; existing shared scalar producer receives
the same producer-row binding for correlated subqueries. The first trial omitted
that callback and admitted NULL for (SELECT t.a); corrected owning callback and
builder frontier synchronization. Ordinary outer ORDER/result aliases use the
same compiled entries. Existing window execution admission remains intact.
No new evaluator, guard-only acceptance, Program relocation, VM or WHERE change.
Grouped producer/updateAccumulator remains unchanged, preserving FILTER/regAcc,
NEEDCOLL/magnet/NULL/tie capture, resets and coroutine boundaries. Pinned expr.c
column/aggregate register consumption and resolve linked carrier identities own
expression lowering, not SQL-text recognition. No allocation/entry seam change
requiring b coordination was identified.

Regression matrix adds9 native-first cases to existing cross-layer public suite:
with/without FILTER, NULL/ties/filter0, incompatible windows/multiple aggregates,
empty GROUP input, saved correlation and descending ORDER/LIMIT/OFFSET. Public
full9/original15/original18 pass typed rows/two runs/reset; existing suite verifies
names/done/finalize. Evidence work:///cards/card-t-c/group-filter-window-repair/.
Type/focused437 pass; broad/immutable result must be read from current status,
not inferred from this note. No full origins/BLOB/encoding/error/resource parity
claim. Parent status79 R1–R4/reviewv3 and general preparation/identity/AggInfo/nTab
and C-subroutine/retained destination fidelity remain open. Public API unchanged;
unimplemented output expressions still reject atomically typed temporary.


### Ordinary physical compilation ownership ([[card:card-t-b]])
Ordinary single-table SELECT now consumes the enclosing program builder and
output destination through scan and ordered drain; terminal publication occurs
at the enclosing entry. Public rows, bindings, resource limits, reset/finalize
and supported-shape admission are unchanged. Retained/JSON/join/compound
specializations remain live and are not silently narrowed. Existing implicit
rowid result-name vs native INTEGER PRIMARY KEY declared-name divergence remains
tracked in the focused regression; no full native metadata parity is claimed.

### Bounded fourth-checkpoint compound collation correction

The independently pinned 3.53.4 matrix exposed wrong UNION/INTERSECT/EXCEPT
rows when explicit compound ORDER COLLATE differed from set equality. The
existing two KeyInfo objects alone were insufficient: `select.c:5502–5584`
`convertCompoundSelectToSubquery` runs before merge and moves ORDER/LIMIT to
an outer SELECT whenever a set prefix and explicit ORDER collation coexist
(ALL-only remains mergeable). `emitScalarCompoundMerge` now composes the
unordered set producer into a same-builder coroutine, then sorts surviving
payload using the outer ORDER KeyInfo. Inner merge/duplicate KeyInfo remain
independent (`select.c:2600–2630,3502–3523`); equality is never ORDER equality.
No SQL-text special case, VM workaround or extra DISTINCT evaluator was added.
Compound LIMIT/OFFSET apply only while draining outer sorting.

The checkpoint's repeated NOT MATERIALIZED VALUES CTE structural red also
proved a real producer-ownership divergence, not justification for deleting
its assertion. `fromClauseTermCanBeCoroutine:7266–7290` permits independent
repeated NOT MATERIALIZED sources. The compound CTE arm delegates its retained
producer into the shared destination/builder rather than the shared CteUse
spool branch; the table compound caller publishes that builder's columns/ops.
The original two-InitCoroutine assertion remains intact. Public INTEGER8,8
rows already matched before repair; the structural ownership obligation is
separate from the runtime compound wrong-row defect.

Native-first typed/reset controls and the original checkpoint regressions are
retained in `test/conformance/compound-collation.test.mjs` and
`test/conformance/cte-opcodes.test.mjs`; bounded command/results and attempted
hypotheses live in [[card:card-t-c]] status and checkpoint-collation-red/repair
work artifacts. This is not R1–R4 architecture acceptance or new breadth;
metadata/origins, general resources/storage and unrepresented shapes retain
previous qualifications. No bitwise excluded changes are part of this repair.

#### Specialized SELECT construction checkpoint

Joined UNION ALL, bounded compound-derived, repeated immutable-view and CTE-derived
preparation now use the same enclosing program/destination owner. This is an
internal construction change, not new SQL admission or changed lifecycle/API
semantics. Existing names/types/metadata, bindings/reset/finalize, LIMIT and atomic
preparation errors are preserved by bounded consumer tests. Standalone internal
compiler wrappers remain; remaining JSON/retained-window publication and general
cursor/metadata fidelity are not certified by this checkpoint. In particular, the
recorded rowid/IPK output-name qualification is unchanged.

### Direct rowid result metadata (bounded repair, 2026-10-03)

For admitted direct rowid projections on ordinary physical tables, display names
and origins use the declared INTEGER PRIMARY KEY column when present; otherwise
rowid/_rowid_/oid display the canonical `rowid` name and origin. An explicit AS
alias overrides the display name but not the physical origin. Negative rowid
addressing and name lookup are unchanged. This bounded repair is tested through
public columnMetadata, typed rows, reset and finalize; it does not certify all
expression or transient-source metadata branches. See TRANSLATION's bounded IPK
repair entry for the pinned source and retained qualifications.


### Bounded JSON/retained-window enclosing publication correction (2026-10-03)

[[card:card-t-b]] forwards the actual table-entry builder, ParameterBuilder and
SelectDest through mixed physical/JSON, two correlated JSON sources, and single
JSON scan/group/aggregate/sorter drains. Their local contiguous ranges begin at
the enclosing register frontier; manual range increments are synchronized back
to the builder before expression allocation and return. Shared paths neither
freeze ops nor emit terminal Halt/finish. The retained-window path forwards
parameters/destination, including its flattened recursive caller, and leaves
window labels/subroutine finalization to the enclosing late Halt/finish. Actual
standalone wrappers remain. Source: select.c sqlite3Select7615, selectInnerLoop
1139ff/SRT_Output1442ff, coroutine/materialization tags0482/0488 recursively use
the same Parse/Vdbe with chosen destinations; vdbeaux label resolution remains
late. Objects/register indices are TS representation adaptations, not a new
algorithm or evaluator. Fixed JSON cursor0/1 and physical/private fences remain;
this is not general nTab/WHERE equivalence or RIGHT acceptance.

Native source-ID checked JSON five-case and retained-window probes ran BEFORE
product edits. Public JSON metadata/bind/reset/limit/error controls and window
controls are preserved; construction checks assert consumed ownership and late
publication, not SQL compatibility. A native grouped JSON control independently
shows existing TEXT `text`/REAL0.0 versus public retained `string`/INTEGER0 for a
text input: this pre-existing semantic discrepancy is not repaired or concealed
by the construction migration. No blanket metadata/type parity claim.

Revision 2026-10-03, five-caller correction: the previous omitted-edge census
above is superseded for ordinary flatten, materialized derived, immutable-view
recursion, zero-source scalar and multisource table entry. These now consume the
enclosing builder/parameters/destination. See
`docs/research/card-t-b-fallthrough-owner-census.md` for the finite branch census,
source comparison, specialization/admission constraints and verification limits.
The ops-identity escape is now an internal invariant failure, not publication of
a private Program. This does not close parent R1–R4, RIGHT or exported-candidate
acceptance, and does not repair the documented grouped JSON type discrepancy.

### Bounded grouped JSON storage-class correction (card-t-c)

The b818 grouped JSON witness is now repaired at semantic owners, not at the
SELECT drain: `json.c:jsonEachColumn`/`aJsonType` uses TEXT label `text` for
JSON strings. The table producer now shares `jsonTypeName` with `json_type`,
removing its duplicate label rule. Internal parser kind remains `string`.
`vdbe.c:sqlite3_value_numeric_type` applies numeric affinity only to fully
numeric TEXT with bTryForInt=0; nonnumeric TEXT/BLOB keep their type.
`Mem.valueNumericTypeCopy` mirrors that classification without mutating the
producer payload; arithmetic `numericTypeCopy` remains unchanged.
`func.c:sumStep1929ff` and `sumInverse1963ff` now consume this classification
and use the existing `valueDouble` accessor for non-INTEGER contributions,
so nonnumeric text contributes REAL zero, not INTEGER zero. Sum/total/avg
share the same accumulator. No new evaluator or change to group builder,
destination, parameters, cursor allocation, reset or error lifetimes.

Source-ID-checked native controls captured before consuming edits and public
storage-class/reset/rebind regressions are retained in
`test/conformance/json-group-numeric-types.test.mjs`; the existing grouped
JSON assertion now expects `text`/REAL0.0. Exact commands, failed intermediate
hypotheses and immutable input evidence live in [[card:card-t-c]] status and
json-group-semantic-red/repair artifacts. This supersedes only the b818
specific unresolved grouped witness, not general JSON/storage/resource parity,
parent R1–R4 or independent RIGHT/export proof. Metadata origins remain qualified.


### F1 endpoint lookup control repair (card-t-d, 2026-10-03)
Supersedes provisional uncontrolled linear-seek acceptance. Pinned window.c1948–1950
bounds regApp target and emits SeekRowid; vdbe.c5495–5568 performs Btree lookup
and propagates errors before position publication. Browser shared finite records
still use sequence+1 linear identity lookup (not native Btree complexity), avoiding
new shared mutation/index bookkeeping. EphemeralIndexCursor.seekRowid now requires
PrivateStateControl, charges one deterministic unit per visited entry, checks even
empty/completed searches and publishes position only after successful checks.
EphemeralSeekRowid awaits it with VM private control: host yield every256 total
work units, cancellation/deadline/limit checks within traversal. NULL target still
branches without lookup; OpenDup positions remain independent. No regApp/result
or destination lowering change, no guarantee narrowing or native work equality.
Existing primary-error/exhaustive cleanup/reset/finalize ownership is unchanged.
Primitive and public600-row bounded PRECEDING endpoint tests isolate600 visited
units by public budget delta; actual host yields inside seek, cancellation/deadline,
reset/reexecution, shared replacement/missing/failure position checks pass.
Exact attempts/native temporal provenance/export evidence in card-t-d status and
work:///cards/card-t-d/endpoint-seek-repair/. Grouped RIGHT remains delegated
in-scope feature debt; general nTab/resource/native error parity is not certified.
