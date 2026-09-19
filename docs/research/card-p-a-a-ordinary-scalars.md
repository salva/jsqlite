# Ordinary scalar source inventory and tests-first handoff

This is the bounded research deliverable for [[card:card-p-a-a]], pinned **only** by `reference/sqlite/manifest.json`: SQLite 3.53.4, source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`. Native observations are reference evidence and confer **zero TypeScript credit**.

## Artifacts and denominator

* `test/conformance/cases/stage3-ordinary-scalars.spec.json` is the machine contract: **50 active in-scope production ordinary-scalar name/arity registration rows**, implementation routine, registration macro/flags, aliases, implementation slice, and current TS status; **30** cases expand to **48** encoding observations.
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

The corpus covers NULL and storage-class conversion, BLOB/text and embedded NUL, all database encodings where relevant, upper/lower ASCII versus non-ASCII, LIKE/GLOB argument order/BLOB policy/ESCAPE step error, trim character sets, mixed-class `instr`, Unicode first code point, SQL quoting, round and SQLite printf numeric boundaries, aliases, volatile/state functions, public typed bindings including int64/BLOB, returned typed columns, and composition. Physical Fetch fixtures already exist for UTF-8/UTF-16le/UTF-16be; future implementation tests must execute these SQL cases through the public API against those fixtures rather than treating `PRAGMA encoding` native captures as TS credit.

Pinned owners inspected: `src/func.c`, `printf.c`, `vdbemem.c`, `utf.c`, `util.c`, and resolver/compiler callers in `resolve.c`/`expr.c`/`vdbe.c`. Upstream test sources inspected: `func.test`, `func2.test`, `e_expr.test`, `like.test`, `like2.test`, `like3.test`, `printf.test`, `printf2.test`. The selected corpus is tests-first coverage, not full upstream-test credit.

## Reproduction

```sh
tools/oracle/build.sh "$SAIVAGE_CARD_WORK_ROOT/oracle-build"
python3 test/conformance/capture-ordinary-scalars.py --library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"
python3 test/conformance/ordinary-scalars-manifest.test.py
sha256sum test/conformance/cases/stage3-ordinary-scalars.*.json
```

Capture hashes at delivery: spec `aa7139122530cad046e2d36ff6096a7b8e02fb60d2ef66cdfac308d7105cf97f`; native `46360db3627e2b002d35a764cdac38092f05314b50ccb46a1e0287ee0cf0711e`. Superseded first-pass hashes remain in the machine spec with their correction rationale. Oracle profile is `ENABLE_COLUMN_METADATA`, `ENABLE_MATH_FUNCTIONS`. The manifest test passes 50-row/34-case/52-observation accounting and 12 implemented/38 absent classification. No scalar runtime code changed.

## Second repair provenance

The active in-scope denominator is **50 rows**: 12 currently dispatched and 38 absent. The two added rows are `sqlite_compileoption_used/1` and `sqlite_compileoption_get/1`, active because the oracle profile does not define `SQLITE_OMIT_COMPILEOPTION_DIAGS`. `load_extension` is active upstream but excluded by the existing `docs/SPEC.md` permanent exclusion on externally loaded extensions; other conditional rows and separate math/aggregate roots have machine-readable dispositions in the spec.

Variadic accepted maxima use captured `MAX_FUNCTION_ARG=1000`. Native cases prove the 1000-argument `printf` boundary and the 1001-argument prepare error. Every case now has either exact selected upstream assertion provenance (with explicit setup disposition and body hash) or a source-authored local-companion rationale naming its implementation branches; every slice has a machine summary. The validator parses balanced pinned catalog macro calls, operands, active preprocessor conditions, `bNC`, `mFlags`, `FUNCTION2` extras, and LIKE flags instead of using a function-name flag table.

Current delivery: 34 cases, 52 native observations, and 114 honest public Fetch unsupported observations. Hashes: spec `aa7139122530cad046e2d36ff6096a7b8e02fb60d2ef66cdfac308d7105cf97f`; native `46360db3627e2b002d35a764cdac38092f05314b50ccb46a1e0287ee0cf0711e`. Superseded hashes and reasons remain in the spec.

## Third correction: ownership, setup, and min/max dispatch

Every case now has nonempty pinned branch ownership, and every source-owned slice owns one or more cases, including `concat`/`concat_ws`. Slice ownership includes cross-slice composed cases rather than relying only on a case's primary organizational label. Applicable direct assertions are linked while `localAddition` records what the corpus adds. External fixture setup for `func-5.1/.2`, `like-1.1`, and selected `round()` assertions has exact pinned line ranges, byte counts, and SHA-256; genuinely literal or body-contained assertions state and validate that narrower condition.

For `min`/`max`, the machine contract distinguishes the raw `FUNCTION(...,-3,...)` match range (1..1000) from effective ordinary-scalar ownership (2..1000). At one argument, the exact `WAGGREGATE(...,1,...)` registration wins `callback.c:matchQuality` over the variadic row, and `resolve.c:resolveExprStep` classifies it by `xFinalize`; aggregate/window behavior remains separately owned. `case-minmax-overload-discriminator` captures aggregate, window, and two-argument scalar dispatch through public SQL.

The validator is intentionally described as a profile-specific balanced macro-invocation parser, not a general C preprocessor. It checks the exact pinned `sqliteInt.h` macro-definition range/hash used by its encoded semantics, current-profile membership, nonempty and existent source symbols, every absent row's source-slice case ownership, exact assertion bodies/setup ranges, and min/max raw/effective arities. Current hashes: spec `aa7139122530cad046e2d36ff6096a7b8e02fb60d2ef66cdfac308d7105cf97f`; native `46360db3627e2b002d35a764cdac38092f05314b50ccb46a1e0287ee0cf0711e`.
