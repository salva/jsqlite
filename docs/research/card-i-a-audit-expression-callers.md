# Audit correction evidence: expression and scalar-function callers

Date: 2026-09-14

Owner: [[card:card-i-a]]

Scope: research evidence only; no runtime repair

## Supported conclusion

The bounded audit correction is **supported**. The lane converts the specified
finding 6/7 risks and finding 8 caller/literal impacts from untested audit
predictions into finite, typed pinned-native versus public-TS observations. It
also narrows one prediction that does not reproduce on the selected current
affinity path. This supports correction planning and owner coordination only; it
does not establish expression/function compatibility or repair any runtime owner.

## Method and provenance

`test/conformance/cases/audit-expression-callers.spec.json` declares 14 finite high-risk and neighbor inputs. `capture-audit-expression-callers.py` asserts the loaded oracle's exact pinned SQLite 3.53.4 source ID before capturing typed rows. `run-audit-expression-callers-ts.mjs` runs the same SQL through the public TS API and immutable fixtures. The committed capture is no-credit and the manifest validator binds IDs, count, source identity, native outcomes, and TS disposition.

Pinned owners inspected were `src/vdbe.c` NULL comparison/affinity and `numericType` branches, `src/expr.c` comparison caller and oversized integer `codeReal` lowering, `src/func.c` `substrFunc`, length/octet-length and numeric handling, and `src/vdbemem.c` numeric conversion. Baseline audit predictions were treated as hypotheses.

## Reproduced findings

- **Finding 6 mixed NULL:** oracle returns `0,1,0,1` for mixed `IS`/`IS NOT`; TS returns `1,0,1,0`. Reproduced.
- **Finding 6 collation precedence:** right explicit NOCASE governs `'a'='A' COLLATE NOCASE` (oracle 1); left explicit BINARY wins when both sides specify collations (oracle 0). TS returns `0,0`, reproducing the missing right-explicit rule while preserving the neighbor.
- **Finding 6 CASE truth:** `'12x'` is true and `'x12'` false in CASE; TS returns false for both. This is a caller failure dependent on card-f numeric conversion, not an independent CASE-lowering replacement.
- **Finding 7 substr:** oracle yields `ab`, `f`, `bc`, and BLOB `62`; TS yields `abc`, empty, empty, and throws `MemStateError`. All predicted branches reproduce.
- **Finding 7 abs:** oracle returns REAL 2 and REAL 12 from TEXT; TS returns INTEGER 2 and REAL 0. Both predictions reproduce and depend partly on card-f `numericType`/Mem conversion.
- **Finding 7 lengths:** oracle `length(1.0)=3`; `octet_length(1.0)` is 3 under UTF-8 and 6 under UTF-16le/be. TS returns 1 in every case. Predictions reproduce.
- **Finding 8 caller evidence:** oversized decimal literals promote to REAL (both signs); TS rejects at prepare. `typeof('1.0'+0)` is REAL, arithmetic `'1e2'+0` is REAL 100, while INTEGER casts use prefixes 1 and 123; TS produces INTEGER/100/100/12300000. Predictions reproduce.

## Disproved or narrowed hypotheses

- The focused INTEGER-affinity table comparison (`b='1'`, `b='01'`, `WHERE b=1`) now exactly matches the oracle. Thus “resolved columns lose affinity” is disproved for this current caller path/input, not globally. The adjacent `a=1` TEXT-affinity result also matches. No broad affinity-correctness claim follows.
- Genuine CASE/register lowering remains valuable. Only its conversion-dependent truth caller is shown failing.
- Finding 9 NOCASE embedded-NUL owner was not duplicated: it belongs to card-f and is activation-gated by card-e. This card's right-explicit NOCASE evidence tests collation selection, not the shared comparison algorithm.

## Coordination inputs for card-f

Exact dependent inputs are `audit-6-case-prefix-truth`, `audit-7-abs-text-prefix`, `audit-8-oversized-literal`, and `audit-8-numeric-neighbor`. The affinity comparison currently passes but should remain a neighbor regression when card-f changes Mem affinity. Finding 9 needs card-f's length-aware embedded-NUL fixture. This card does not repair or duplicate shared `Mem`, `numericType`, CAST, literal, or NOCASE owners.

## Documentation finding 11

Current `docs/api.md` no longer says functions are entirely unsupported; it describes the bounded scalar set and temporary gaps. Current TRANSLATION keeps source-shaped opcode/CASE/FunctionContext foundations. The obsolete `multiSelectOrderBy` mapping is already identified by the mutable audit; relational/source-map files have active card-j edits and were intentionally not overwritten. Host-generated fixture setup remains setup, not pinned semantic proof; this capture directly asserts the oracle source ID.

## Limits

The lane awards zero credit and does not promote compatibility. It does not test every affinity/collation/function branch, implement fixes, or establish card-f owner behavior. Public TS mismatch count is an observed current result and may change as concurrent work lands.

The committed native capture and manifest are reproducible from commit `5805f0a`.
The observed public split of one typed match and thirteen mismatch/unimplemented
cases was run against the shared working tree, which also contained uncommitted
card-j changes to `src/internal/vdbe.ts`. It is therefore a revision/worktree
observation, not behavior attributable solely to `5805f0a`. The TS runner compares
typed rows and records errors, but this focused lane is not the stronger exact
metadata/error-contract gate. The passing affinity result covers only its stated
INTEGER/TEXT setup and operand arrangements. The NOCASE case covers CollSeq
selection, not finding 9's embedded-NUL algorithm. Finding 11 remains partial
until active source-map/API edits and obsolete compound-order naming are settled
by their owner.

## Recommendations

1. Send `audit-6-case-prefix-truth`, `audit-7-abs-text-prefix`,
   `audit-8-oversized-literal`, and `audit-8-numeric-neighbor` to card-f/card-e as
   dependent caller inputs; do not move shared conversion ownership into this
   card.
2. Retain `audit-6-column-affinity` as a neighbor regression when shared Mem and
   affinity code changes, without generalizing its current pass.
3. Rerun the public lane after card-j's VDBE work is committed and after card-f is
   activated. Revise labels or grant credit only from those settled executions.
4. Have the current relational/documentation owner reconcile finding 11's
   remaining source-map naming and coverage drift after concurrent edits settle.
5. Preserve source-ID assertion, immutable native capture, typed storage classes,
   and zero-credit accounting while corrections are implemented.
