# Ordinary scalar source inventory and tests-first handoff

This is the bounded research deliverable for [[card:card-p-a-a]], pinned **only** by `reference/sqlite/manifest.json`: SQLite 3.53.4, source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`. Native observations are reference evidence and confer **zero TypeScript credit**.

## Artifacts and denominator

* `test/conformance/cases/stage3-ordinary-scalars.spec.json` is the machine contract: **50 active in-scope production ordinary-scalar name/arity registration rows**, implementation routine, registration macro/flags, aliases, implementation slice, and current TS status; **37** cases expand to **59** encoding observations.
* `stage3-ordinary-scalars.native.json` is fresh immutable typed output (INTEGER decimal strings, REAL C99 hex strings, TEXT plus UTF-8 bytes, BLOB hex, NULL; prepare/step code/message). It embeds source ID, compile options, manifest/spec hashes. `capture-ordinary-scalars.py` recaptures; `ordinary-scalars-manifest.test.py` independently validates the pinned catalog, flags, arities, absent-row coverage, exact selected upstream assertion hashes, fixture paths, accounting, and schema.
* Denominator rule is the production ordinary scalar entries in `func.c:aBuiltinFunc` under the oracle profile. Debug/test, `load_extension`, and conditional soundex/offset/filestat/unknown are not ordinary profile entries. Aggregates/windows are separate. Date/time, math and JSON are explicitly retained as future root-owned registry scopes, not excluded product scope.

At inventory HEAD, resolver/compiler/runtime inspection (`resolve.ts`, `vdbe.ts` `FUNCTION_ARITIES`, call lowering, `callFunction`) finds **12/50 rows genuinely dispatched**: `typeof`, `length`, `octet_length`, `abs`, `substr`, `nullif`, `coalesce`, scalar `min`, scalar `max`, `char`, `hex`, `replace`. There are **38 absent rows**. This row count deliberately does not credit the `substring` alias when only `substr` is registered, or `ifnull` when only `coalesce` is registered. Wrong arity and absent names are rejected during TS resolution; thus they cannot be mistaken for runtime implementations. Aggregates are already separate and must not be duplicated.

The fidelity audit section 7 is accurate for its bounded eight-case tranche but is not an ordinary-registry claim. Its statement that substr/length/octet_length/abs pass does not imply `upper()` exists. **At current HEAD `upper` and `lower` are absent from `FUNCTION_ARITIES` and `callFunction`; the earlier audit did not claim otherwise.**

## Source ownership and implementation slices

Implement manifest slices independently, but retain shared `Mem`, `FunctionContext`, encoding, limit/work, resolver and VDBE contracts:

1. `ascii-case`: `upperFunc/lowerFunc`; ASCII byte mapping only, not JS Unicode case conversion.
2. `like-glob`: `likeFunc`, `patternCompare`, `compareInfo`; SQL infix argument reversal, ESCAPE one-character validation, ASCII case fold, UTF decoding, complexity limit, and SQLite's BLOB policy. No regex.
3. `trim`, `search`, `unicode`, `quote`: `trimFunc`, `instrFunc`, `unicodeFunc`, `quoteFunc`; storage-class conversion, embedded NUL, BLOB paths, code-point iteration.
4. `numeric-formatting`/`formatting`: `roundFunc`, `printfFunc` and `src/printf.c`; do not substitute JS number formatting.
5. `blob-text`, `concat`, `numeric-core`, `minmax-scalar`, `value-introspection`: remaining ordinary deterministic routines and aliases.
6. `planner-inline`: `likely/unlikely/likelihood`, `ifnull/coalesce`, `iif/if`; source ownership includes resolver/compiler inline branches, not just function dispatch.
7. `connection-state`, `build-identity`, `host-side-effect`: volatile/slow-changing flags and connection context. `sqlite_log` preserves SQL argument/result semantics and routes diagnostics to an internal no-op sink; no host callback is exposed or invoked.

`FUNCTION` implies BUILTIN|CONSTANT|UTF8; `VFUNCTION` omits CONSTANT; `DFUNCTION` is SLOCHNG; `LIKEFUNC` adds LIKE/CASE; `bNC` adds NEEDCOLL. The manifest records these semantically. `min/max/nullif` consume collation. Function arguments/results remain `Mem`; text conversion and UTF-8/16 cache ownership remain `vdbemem.c`/`utf.c`; result replacement/error cleanup remains `FunctionContext`; output must honor length/result and work limits.

## Behavior contract

The corpus covers NULL and storage-class conversion, BLOB/text and embedded NUL, all database encodings where relevant, upper/lower ASCII versus non-ASCII, LIKE/GLOB argument order/BLOB policy/ESCAPE step error, trim character sets, mixed-class `instr`, Unicode first code point, SQL quoting, round and SQLite printf numeric boundaries, aliases, volatile/state functions, public typed bindings including int64/BLOB, returned typed columns, and composition. Physical Fetch fixtures exist for UTF-8/UTF-16le/UTF-16be; the manifest-defined persisted-column cases now execute through the public harness against those fixtures, while current absent-function errors receive no TS credit and future typed successes must match the recorded expectations rather than inheriting credit from `PRAGMA encoding` native captures.

Pinned owners inspected: `src/func.c`, `printf.c`, `vdbemem.c`, `utf.c`, `util.c`, and resolver/compiler callers in `resolve.c`/`expr.c`/`vdbe.c`. Upstream test sources inspected: `func.test`, `func2.test`, `e_expr.test`, `like.test`, `like2.test`, `like3.test`, `printf.test`, `printf2.test`. The selected corpus is tests-first coverage, not full upstream-test credit.

## Reproduction

```sh
tools/oracle/build.sh
LIB=/work/jsqlite2/.saivage/work/cards/card-p-a-a/oracle-build/build/libsqlite3-oracle.so
python3 test/conformance/capture-ordinary-scalars.py --library "$LIB"
python3 test/conformance/ordinary-scalars-manifest.test.py --library "$LIB"
node test/conformance/run-ordinary-scalars-unsupported-ts.mjs
python3 -m py_compile test/conformance/capture-ordinary-scalars.py test/conformance/ordinary-scalars-manifest.test.py
npm run typecheck
sha256sum test/conformance/cases/stage3-ordinary-scalars.spec.json \
  test/conformance/cases/stage3-ordinary-scalars.native.json \
  test/fixtures/expression-cursor/users-utf8.db \
  test/fixtures/expression-cursor/users-utf16le.db \
  test/fixtures/expression-cursor/users-utf16be.db
git diff --check
```

The exact `LIB` path above was present and used for the final rerun. `tools/oracle/build.sh` uses `$SAIVAGE_CARD_WORK_ROOT/oracle-build` by default; rebuild only when that library is missing. The validator printed `ordinary scalar contract: 50 active in-scope rows, 37 cases/59 native observations, 12 implemented/38 absent; profile-specific catalog, overload ownership, source/test/setup provenance verified`. This successful command loaded the library, matched its `sqlite3_sourceid()` to the manifest, and executed both persisted cases read-only against all three hashed physical fixtures. An argument-less validator invocation is invalid because `--library` is required; any historical transcript showing it is superseded and did not exercise this gate.

Capture hashes at delivery: spec `e0cba75903b74f5c93f5eb5505ceedf0342acbf85e82f8dfc7a804fc33266ae0`; native `84ac9ef390884479d4dc3d315690f9205bb3e2ce64ff7cdc1c440107e80d977a`. Physical fixture hashes: UTF-8 `3e3464fe16235ea9805c6a14304e1dda5649b30df28defd7f71c29e1e773d1c5`; UTF-16LE `cf4c67e9d3e6f7a0ab865d1384d5996d464bdb79768fc7e37e8a195fc8c313d7`; UTF-16BE `5d8a834d2d8c4e9d742af57004779befa7201b07b4465033c1dbe30320115963`. Superseded first-pass hashes remain in the machine spec with their correction rationale. Oracle profile is `ENABLE_COLUMN_METADATA`, `ENABLE_MATH_FUNCTIONS`. The manifest test passes 50-row/37-case/59-observation accounting and 12 implemented/38 absent classification. No scalar runtime code changed.

## Second repair provenance

The active in-scope denominator is **50 rows**: 12 currently dispatched and 38 absent. The two added rows are `sqlite_compileoption_used/1` and `sqlite_compileoption_get/1`, active because the oracle profile does not define `SQLITE_OMIT_COMPILEOPTION_DIAGS`. `load_extension` is active upstream but excluded by the existing `docs/SPEC.md` permanent exclusion on externally loaded extensions; other conditional rows and separate math/aggregate roots have machine-readable dispositions in the spec.

Variadic accepted maxima use captured `MAX_FUNCTION_ARG=1000`. Native cases prove the 1000-argument `printf` boundary and the 1001-argument prepare error. Every case now has either exact selected upstream assertion provenance (with explicit setup disposition and body hash) or a source-authored local-companion rationale naming its implementation branches; every slice has a machine summary. The validator parses balanced pinned catalog macro calls, operands, active preprocessor conditions, `bNC`, `mFlags`, `FUNCTION2` extras, and LIKE flags instead of using a function-name flag table.

Current delivery: 37 cases, 59 native observations, and 114 honest public Fetch unsupported observations. Hashes: spec `e0cba75903b74f5c93f5eb5505ceedf0342acbf85e82f8dfc7a804fc33266ae0`; native `84ac9ef390884479d4dc3d315690f9205bb3e2ce64ff7cdc1c440107e80d977a`. Superseded hashes and reasons remain in the spec.

## Third correction: ownership, setup, and min/max dispatch

Every case now has nonempty pinned branch ownership, and every source-owned slice owns one or more cases, including `concat`/`concat_ws`. Slice ownership includes cross-slice composed cases rather than relying only on a case's primary organizational label. Applicable direct assertions are linked while `localAddition` records what the corpus adds. External fixture setup for `func-5.1/.2`, `like-1.1`, and selected `round()` assertions has exact pinned line ranges, byte counts, and SHA-256; genuinely literal or body-contained assertions state and validate that narrower condition.

For `min`/`max`, the machine contract distinguishes the raw `FUNCTION(...,-3,...)` match range (1..1000) from effective ordinary-scalar ownership (2..1000). At one argument, the exact `WAGGREGATE(...,1,...)` registration wins `callback.c:matchQuality` over the variadic row, and `resolve.c:resolveExprStep` classifies it by `xFinalize`; aggregate/window behavior remains separately owned. `case-minmax-overload-discriminator` captures aggregate, window, and two-argument scalar dispatch through public SQL.

The validator is intentionally described as a profile-specific balanced macro-invocation parser, not a general C preprocessor. It checks the exact pinned `sqliteInt.h` macro-definition range/hash used by its encoded semantics, current-profile membership, nonempty and existent source symbols, every absent row's source-slice case ownership, exact assertion bodies/setup ranges, and min/max raw/effective arities. Current hashes: spec `e0cba75903b74f5c93f5eb5505ceedf0342acbf85e82f8dfc7a804fc33266ae0`; native `84ac9ef390884479d4dc3d315690f9205bb3e2ce64ff7cdc1c440107e80d977a`.

## Independent-review repair: persisted columns and exact routine owners

The accepted independent review at `record:///review.md?card=card-p-a&v=3` correctly found that the prior “returned typed columns” statement was not backed by persisted-table cases and that slice-level ownership could omit a row's actual routine. The replacement contract adds two `scalar_values` table cases across physical UTF-8, UTF-16LE, and UTF-16BE Fetch fixtures. The immutable table has ordinary TEXT, TEXT containing embedded NUL (`410042`), BLOB `410042`, and NULL rows. Each case records exact typed rows per encoding. Native capture opens each exact hashed physical fixture with the manifest-pinned oracle and executes the manifest SQL against its stored values; the public harness executes that same SQL against the same fixtures. Current absent functions reject all six public executions with SQLite errors, so they retain zero TS credit. The validator requires the table SQL, all three encodings, TEXT/BLOB/NULL and embedded-NUL coverage, checks fixture hashes and capture linkage, and independently opens every physical fixture read-only with the supplied pinned oracle to compare exact typed rows.

Every one of the 50 registry rows now carries `implementationOwner`. Ordinary routines map exactly to `src/func.c:<implementation>`; inline registrations explicitly map to `src/expr.c:sqlite3ExprCodeTarget` while retaining their registration operand. Slice and every covering-case provenance include that owner. The `unicode` slice now separately names `unicodeFunc`, `charFunc`, and `unistrFunc`, with `isNHex` and `sqlite3AppendOneUtf8Character` for UNISTR escape/control handling—`unicodeFunc` is not treated as CHAR or UNISTR's semantic owner. A small discriminator gives the three previously uncovered implemented rows (`octet_length`, `abs`, `replace`) explicit case ownership. Validator enforcement audits all 50 rows, not only absent rows.
