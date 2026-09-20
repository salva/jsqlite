# Date/time translation architecture and pinned evidence

Status: implementation handoff; no TypeScript compatibility credit. Pinned source is SQLite 3.53.4, source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc` (`reference/sqlite/manifest.json`).

## Scope and source model

This slice owns the production registrations in `src/date.c:sqlite3RegisterDateTimeFunctions`: variadic `julianday`, `unixepoch`, `date`, `time`, `datetime`, and `strftime`; exact-2 `timediff`; and zero-argument non-pure `current_time`, `current_date`, and `current_timestamp`. `datedebug` is debug-only and excluded. The three CURRENT_* spellings are parser keywords as well as registered functions (`src/parse.y:term`); they must lower to an ordinary zero-argument function call, not a host-language constant. Resolver arity/name behavior, VDBE `Function`/`PureFunc`, shared `FunctionContext`, Mem coercion/result ownership, result-size accounting, cancellation and cleanup remain the existing owners.

Translate `src/date.c`, rather than wrapping JavaScript `Date` formatting. `DateTime` uses exact signed `bigint` `iJD` milliseconds plus integer Y/M/D/h/m/tz, IEEE `number` seconds, `nFloor`, and the independent `validJD`, `validYMD`, `validHMS`, `rawS`, `isError`, `useSubsec`, `isUtc`, and `isLocal` flags. Cached forms are intentionally simultaneous. `computeJD`, `computeYMD`, `computeHMS`, `computeYMD_HMS`, `clearYMD_HMS_TZ`, and error/reset transitions preserve those flags. Checked bigint arithmetic prevents JS safe-integer loss; conversion to `number` occurs only where upstream does floating arithmetic. Valid output is bounded by `validJulianDay` to `0..464269060799999` iJD and representable years are `0000..9999` (negative intermediate years remain relevant to source branches).

Parsing ports byte-oriented `getDigits`, `parseTimezone`, `parseHhMmSs`, `parseYyyyMmDd`, `parseDateOrTime`, SQLite numeric parsing, `setRawDateNumber`, and `isDate`. Inputs use shared Mem TEXT conversion/UTF-8 bytes; no JS `Date.parse`, `Number(string)`, locale parser, regex grammar, or Unicode case-folding. Preserve exact digit widths, ASCII whitespace/T separators, timezone normalization, fractional-second truncation/rounding, numeric raw-state, day overflow normalization, NULL/BLOB/numeric coercion, and invalid/range-to-NULL behavior. A missing/invalid value or modifier normally leaves the FunctionContext result NULL; only explicit local-time provider failure reports `SQLITE_ERROR` with `local time unavailable`, while allocation/result length and existing VM failures keep their existing identities.

`parseModifier` is one source-shaped dispatcher, including `auto`, `julianday`, `unixepoch`, `ceiling`, `floor`, `weekday N`, `start of day/month/year`, `subsec`/`subsecond`, `localtime`, `utc`, signed clock deltas, signed Y-M-D/time deltas, and singular/plural seconds/minutes/hours/days/months/years. Preserve first-modifier restrictions, `rawS`, `nFloor`, magnitude checks, month/year overflow, UTC fixed-point loop, and unknown-modifier NULL. Output callbacks port their source formatting and result classes: julianday REAL; unixepoch INTEGER unless subsec then REAL; date/time/datetime/strftime/timediff TEXT; invalid input NULL. `strftime` supports exactly the pinned conversion table and returns NULL for unknown conversions. Do not substitute `Intl`, host `strftime`, or generic project printf.

## Clock and timezone seam

Add an internal, connection-owned `DateTimeEnvironment` (name may vary without changing the contract):

```ts
interface DateTimeEnvironment {
  nowUnixMilliseconds(): bigint;
  localFieldsAtUnixSecond(second: bigint):
    | { year:number; month:number; day:number; hour:number; minute:number; second:number }
    | null;
}
```

The default browser adapter reads `Date.now()` and derives local fields with a host `Date`; deterministic tests inject both methods. A statement execution owner lazily samples `nowUnixMilliseconds()` once on its first `sqlite3StmtCurrentTime` equivalent, converts it to iJD with checked bigint arithmetic, and caches it through all rows, subqueries, functions, yields, reset-to-next-execution boundaries, and CURRENT_* aliases. A new execution after reset samples again. Preparation does not sample. Calls in pure/schema contexts retain `sqlite3NotPureFunc` rejection semantics. This is an adaptation of VFS `xCurrentTimeInt64` plus `sqlite3StmtCurrentTime` (`src/vdbeapi.c`), not an algorithm substitution.

`localFieldsAtUnixSecond` is the sole host timezone/tzdata boundary and corresponds to `date.c:osLocaltime`; `toLocaltime` keeps upstream's 1970..2038 direct range and equivalent-year remapping outside it. The returned fields, DST transition choice, historical offsets, platform range, and future tzdata revisions are therefore host-dependent. A null/throw/out-of-range host result maps to `local time unavailable`. Everything before/after that call—including UTC conversion's at-most-four guesses—is translated. Tests that claim exact local results must inject the seam. Host-default tests may assert only documented self-consistency or record environment/TZ and are zero-credit. No global timezone mutation, ambient `process.env.TZ`, or public API expansion is required.

## Integration, invariants, and slicing

1. Add a private date module and registry rows, preserving all ten registrations even before every callback dispatches. Make unsupported residuals fail atomically at prepare/execution as existing registry policy requires.
2. Unit-test DateTime flags/parsers/JD conversions and modifier branches through a diagnostic test-only seam; then connect Mem arguments and FunctionContext outputs.
3. Integrate statement clock ownership before admitting `now`/CURRENT_*; test one sample across rows/yields/aliases and resampling after reset. Integrate deterministic timezone provider before admitting localtime/utc.
4. Add source output callbacks, exact arities, keyword lowering, length/work checks, then promote manifest cases only when they pass through public Fetch/prepare/execute. Do not award credit to internal helpers or native observations.

Invariants: no partially installed result on failure; FunctionContext cleanup remains once-only; no clock sample at prepare; all `now` observations in one execution are identical; iJD is exact bigint; cached-valid flags, not field values, establish authority; local/UTC flags only follow source transitions; invalid syntax/range is NULL rather than a fabricated date; local provider failure is an error rather than NULL.

Alternatives rejected: host `Date.parse`/ISO formatting (different grammar, range, normalization and precision), `Intl` timezone formatting (locale/tzdata output and no SQLite equivalent-year/UTC-loop control), one canonical epoch value without source flags (loses raw numeric, floor, UTC/local and lazy-cache branches), and freezing a fixed timezone (would change observable SQLite localtime semantics). The small two-method seam is the minimum adaptation needed for browser VFS-clock absence and deterministic tests.

## Tests-first evidence and accounting

`test/conformance/cases/stage3-date-time.spec.json` selects 20 literal upstream assertions from `test/date.test` and `test/date2.test` across parsing, normalization, modifiers, all result classes/registrations, and formatting. Their exact Tcl assertion IDs and SQL are provenance. The denominator is **18 upstream assertions**; current TS credit is **0/18**, because date/time callbacks are not yet dispatched publicly. Six separately labeled adaptations cover deterministic statement-stable clock, keyword aliases, reset resampling, injected localtime/utc, provider failure, and range boundaries; they are **zero credit** and not added to the denominator. `stage3-date-time.native.json` is pinned native reference evidence, not TS credit. Oracle capture uses the pinned library profile and retains INTEGER/REAL/NULL/TEXT distinctions (REAL as IEEE-754 hex).

The mutable fidelity audit was re-read at current HEAD: it contains no date/time-specific finding. Its general FunctionContext, Mem, lowering, comparison, and truthful-accounting corrections remain applicable; this proposal does not reopen or bypass them.
