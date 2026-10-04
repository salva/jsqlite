# Public API contract

Status: implemented browser-safe read-only API with bounded progressive SQL admission.
[SPEC](SPEC.md) owns the product target; this document does not turn temporary
implementation gaps into exclusions. Public declarations are authored in `src/index.ts` and emitted to `dist/index.d.ts`.
Detailed historical contracts/runs are preserved in [card-u history](research/card-u-history/README.md).

## Import and values

`npm run build` emits browser-resolvable named ESM and declarations. Install a
local `npm pack` tarball to consume the package import below; in an unbundled
browser, serve the complete `dist/` tree and import its `index.js` URL. The
private `0.0.0-local-translated` package is experimental local output, not release
acceptance. See [local build instructions](../README.md#local-browser-esm-build).

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
promise. The VM, input decoding, scalar traversal/result copying, private comparisons and
controlled endpoint lookups charge deterministic bounded work at their owning
checkpoints. Detailed unit inventories are implementation evidence, not native
performance parity. `maxResultBytes` bounds one TEXT/BLOB result connection-wide
and cannot be relaxed per operation; output-growing functions preflight bounds
where possible and verify encoded output. Exceeding it is `kind: "limit"` with
message `string or blob too big`. Overflow reconstruction yields per page;
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
where SQLite metadata is unavailable (including expressions as applicable).
An available declared type may legitimately be the empty string, including hidden
JSON table columns; do not normalize it to null. Origin fields require the translated equivalent of SQLite column
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

## Current SQL admission

Admission follows parsed/resolved graph branches and is atomic at prepare unless a
registered runtime boundary is explicitly stated. Feature names alone do not
promise arbitrary composition. The current [translation guide](TRANSLATION.md)
and [source map](SQLITE_SOURCE_MAP.md) describe semantic owners and limitations;
[CONFORMANCE](CONFORMANCE.md) retains allocated case evidence, not corpus-wide
compatibility credit.

- No-FROM expressions, structured VALUES, ordinary rowid-table projections,
  filters and selected index/WITHOUT ROWID access execute. Multi-source comma,
  CROSS, INNER and LEFT joins are present. One RIGHT/FULL barrier, including
  downstream ordinary joins and USING/NATURAL metadata, is admitted; repeated
  RIGHT/FULL barriers remain temporary unsupported. Joined WITHOUT ROWID
  comma/CROSS/INNER/LEFT sources use primary-index storage and represented
  secondary access; WITHOUT ROWID RIGHT/FULL match tracking remains temporary
  unsupported (ordinary rowid RIGHT/FULL admission is unchanged).
- ORDER BY supports multiple terms, alias/ordinal/identical-result/source-expression
  precedence, built-in collation, ASC/DESC and NULLS FIRST/LAST. DISTINCT uses
  complete projected keys. Equal complete ORDER keys have no public deterministic
  order guarantee. Unproved index order uses a typed sorter rather than guessed
  planner equivalence.
- LIMIT/OFFSET accepts INTEGER, integral REAL and signed integral base-10 TEXT at
  first step, otherwise SQLite code 20. Negative LIMIT is unlimited; negative
  OFFSET is zero. A single SELECT coerces both before LIMIT-zero bypass; compound
  LIMIT-zero bypasses OFFSET coercion and producers. Positive ordered LIMIT
  bounds sorter retention by LIMIT+OFFSET.
- Scalar/VALUES UNION ALL, UNION, INTERSECT and EXCEPT, represented direct-table
  arms and selected aggregate/CTE compounds execute with compound-wide ORDER/
  LIMIT/OFFSET. Width and compound ORDER errors are prepare errors. Broader arms,
  arbitrary-expression set compositions and retained producer combinations remain
  bounded by their actual admission branches. Finite materialized routes do not
  imply native intermediate-error/work/suspension schedule equivalence.
- Core count/sum/total/avg/min/max/group_concat/string_agg and represented JSON
  aggregates support bounded grouped/ungrouped input, WHERE/GROUP/HAVING,
  argument DISTINCT/FILTER/local ORDER and result ORDER/DISTINCT/LIMIT. Selected
  joins, derived inputs, linked scalar/EXISTS/IN consumers and CTE/recursive
  consumers are admitted; this is not full aggregate analyzer coverage.
- Bounded flattened, coroutine and materialized FROM-derived sources and immutable
  views execute through one Statement and shared limits. View names/collation/
  origin and independent materialized reader positions are retained. Child and
  outer LIMIT are distinct. Arbitrary view bodies or planner identity are not
  promised. Scalar, EXISTS, IN/NOT IN and selected correlated expression-subquery
  compositions preserve empty/NULL and parent-phase semantics; deeper/transient
  relationships remain temporary unsupported.
- Ordinary WITH has represented flatten/coroutine/materialized and repeated-source
  routes. Recursive WITH has iterative Queue/Current, duplicate and queue-order
  behavior, body LIMIT/OFFSET separate from the outer consumer, and selected
  aggregate/window consumers. Aggregates/windows in the recursive term itself
  are not thereby admitted. Unsupported WITH shapes fail without registering a
  Statement or execution state.
- Ordinary aggregate windows and represented special builtins execute over default
  and explicit ROWS/RANGE/GROUPS frames, bounds and EXCLUDE. Compatible windows,
  named inheritance and selected joins/grouped/derived/ordinary-recursive CTE and
  outer ORDER/LIMIT compositions are present. Unrepresented combinations fail
  with temporary unsupported; no blanket window or multisource rejection remains.
  Endpoint private lookup is controlled async linear traversal; complexity is not
  native Btree complexity, but per-visited-entry work/cancel/deadline checks and
  first-error cleanup remain required.
- Ordinary scalars, translated formatter/round, LIKE/GLOB, date/time and enabled
  math callbacks execute via the internal registry. INTEGER/REAL, encoding,
  embedded NUL, NULL/domain and result limits remain observable. Host registration
  is not exposed. Read-only last_insert_rowid/changes/total_changes return INTEGER
  zero; sqlite_log is a NULL-producing no-op without a host log callback.

## JSON built-ins

JSON scalar inspection, constructors, mutation/merge patch, json/jsonb,
json_valid, json_extract and ->/->> execute through ordinary Statement values.
Canonical JSON is TEXT with private subtype 74; SQLite JSONB is a subtype-0 BLOB
(`Uint8Array`), not PostgreSQL JSONB. Malformed JSON raises a SQLite error; work,
result-byte, cancellation and deadline limits still apply. `json_pretty` is
recognized at arities 1 and 2 but raises temporary unsupported, not an approximation.

json_group_array/object and jsonb_group_array/object are aggregate/window callbacks.
Empty input returns the appropriate empty container, subtype-producing values
embed structurally, ordinary TEXT is quoted, ordinary BLOB fails, and duplicate
object labels/order follow SQLite. Grouped JSON extraction retains numeric
INTEGER versus REAL classes.

Bounded json_each/json_tree/jsonb_each/jsonb_tree accept one or two scalar arguments.
Visible expression projection, WHERE, ORDER/LIMIT, grouped/HAVING, physical-left
and two-source left-to-right JSON correlation are represented. Hidden json/root
are explicit-only (not in *). Direct resolved virtual columns expose the underlying
column name, database main, eponymous table/origin; alias overrides. Computed names
preserve exact SQL expression text and have null source metadata. Visible columns
have null declared type; hidden json/root legitimately have empty declared types.
These are internal built-in sources, not arbitrary external virtual-table modules.

## Source basis and exclusions

Pinned SQLite identity is in [manifest](../reference/sqlite/manifest.json).
`sqlite.h.in`, `main.c`, `prepare.c`, `vdbeapi.c`, `vdbeaux.c`, `vdbemem.c`
own API lifecycle/value contracts; [source map](SQLITE_SOURCE_MAP.md) links
execution owners and source-based tests. Permanent exclusions are only those in
[SPEC](SPEC.md): writes/mutation/recovery, native/Wasm runtime, host extensions,
external modules and other explicitly named environment boundaries. Everything
else unavailable within broad read-only scope remains temporary unsupported.
This consolidation preserves accepted bounded outcomes and adds no compatibility
credit; historical case counts and exact commands remain in linked evidence.

Retained single-source derived SELECTs with represented column ORDER keys may
order by a producer column omitted from the parent projection. Child ORDER/LIMIT
remains independent of parent ORDER/LIMIT. Both sorters charge the same execution
private-byte limit; prepare success does not guarantee sufficient runtime bytes.

An index whose schema names an unavailable collation retains structural metadata
but cannot provide executable access. Forced use reports SQLite `no query
solution` (code 1); an unavailable WITHOUT ROWID primary storage collation reports
SQLite `no such collation sequence` (code 1), not an untranslated-feature
classification. This does not add host-registered collation support.

The bounded immutable schema-estimate/WHERE evidence closure is documented in
[width evidence delivery](research/card-s-e-b-evidence-delivery.md). This does not
expand optimizer, STAT4, skipscan or specialized SELECT guarantees.
