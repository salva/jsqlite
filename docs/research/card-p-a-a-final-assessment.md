# Final assessment: ordinary scalar inventory and tests-first contract

Card: [[card:card-p-a-a]]

Assessed delivery: commit `20f88c1`

Conclusion: **refuted for the full bounded acceptance question**

## Executive conclusion

The second repair resolves the previously identified catalog-denominator and maximum-arity defects, and it preserves useful source-pinned native and unsupported-path evidence. It does not, however, satisfy the brief's requirement for an implementation-ready source/test handoff that another executor can consume without re-inventorying ownership and provenance.

The remaining refutation is specific to the machine contract and validator: several local cases have no source ownership, the `concat` slice has no owned case, directly applicable upstream assertions are mislabeled as unavailable, assertion setup provenance is represented by unverified null placeholders, and the validator does not reject those conditions. The validator's macro handling is materially improved but narrower than the documentation's “independent derivation” wording.

This conclusion does not invalidate the corrected 50-row denominator or the captured outcomes. Native evidence remains reference-only and grants no TypeScript compatibility credit.

## Supported evidence

### Source identity and active denominator

The artifacts remain pinned solely through `reference/sqlite/manifest.json` to:

- SQLite version: 3.53.4
- source ID: `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`

The repaired inventory contains 50 active, in-scope ordinary-scalar registration rows, including `sqlite_compileoption_used/1` and `sqlite_compileoption_get/1`. Their inclusion agrees with the captured profile, which does not define `SQLITE_OMIT_COMPILEOPTION_DIAGS`. Within that denominator, the declared current-HEAD classification is 12 TypeScript-dispatched rows and 38 absent rows.

The contract explicitly dispositions nearby conditional registrations. In particular, active upstream `load_extension` remains outside product scope under the existing permanent exclusion for externally loaded extensions; debug, inactive conditional, aggregate/window, and future date/time, math, and JSON roots remain visible rather than being silently declared permanent exclusions.

### Arity correction and native captures

Variadic maxima now use the captured `SQLITE_MAX_FUNCTION_ARG=1000`. Fresh pinned-oracle evidence includes:

- a successful 1000-argument `printf` execution; and
- a 1001-argument prepare-phase `SQLITE_ERROR` with message `too many arguments on function printf`.

The replacement corpus has 33 cases and 51 typed native observations. Its hashes are:

- spec: `067de7bdb7f238814c63f9238fa54fbb6d9e288503c1261b824fee112bff0c52`
- native capture: `538b9e7f535c5ee47f47de21bfbe7316018de063504e151fab83c84aae074933`

Earlier generations remain recorded as superseded provenance.

### Public unsupported evidence and verification

The public Fetch harness opens the three physical UTF-8, UTF-16LE, and UTF-16BE fixtures and reports 114 unsupported observations across the 38 rows classified absent. These are honest unsupported/no-credit observations, not scalar parity evidence. `upper` and `lower` remain absent at current HEAD, and no scalar runtime behavior was added.

The exploration reported successful native recapture, focused manifest validation, public Fetch harness execution, Python compilation, TypeScript checking, and diff checking. It did not present the earlier hanging adapter lifecycle run as a pass.

## Refuting evidence

### 1. Seven local cases have no source ownership

Direct inspection of the machine spec finds empty `sourceBranches` arrays for:

- `case-bound-params`
- `case-composed`
- `case-variadic-zero`
- `case-variadic-minima`
- `case-arity-concat-zero-error`
- `case-arity-concat-ws-one-error`
- `case-arity-coalesce-one-error`

These cases use the `public-bind`, `composition`, and `arity` slices, but those keys are absent from `implementationBranchesBySlice`. The generic provenance generator therefore emitted empty ownership lists.

This directly contradicts the claim that every source-authored local companion names its pinned implementation branches. The validator checks only whether the provenance `kind` is one of two accepted strings; it neither requires nonempty branch ownership nor verifies that cited branch symbols exist.

### 2. The `concat` implementation slice has no owned case

The machine record for `scope.sliceProvenance.concat.caseIds` is empty, although `concat` and `concat_ws` are absent registry rows assigned to that implementation slice. Those functions are incidentally exercised by cases assigned to the `blob-text` and `arity` slices, but the cases are not linked back to the `concat` slice.

Consequently, the assertion that every implementation slice has machine-readable case ownership is false. A future executor taking the `concat` slice would still need to discover which cross-slice cases form its contract. The validator checks that two slice maps have equal keys, but does not require nonempty case ownership or enforce row-to-slice-to-case coverage.

### 3. Some “no direct assertion” rationales contradict pinned tests

Several cases use the generic rationale:

> No single direct upstream assertion owns this composed/storage-class/boundary case.

That explanation may be appropriate for genuinely local composed or boundary cases, but it is not sufficient where directly applicable upstream assertions exist and are omitted from the case link.

For example:

- `case-upper-ascii-unicode` is marked as a local companion with no direct assertion, even though the same spec records `func-5.1` and `func-5.2` from pinned `func.test:358-363` for `upper` and `lower`.
- `case-round` receives the same generic rationale despite numerous direct `round()` assertions in pinned `func.test`, beginning in the section around lines 183-304.

A locally authored composed case does not have to reproduce an upstream assertion exactly. But implementation-ready provenance should link the relevant direct source assertions and then explain what additional boundary or composition behavior the local case contributes. The present blanket rationale incorrectly implies that direct test ownership is unavailable.

### 4. Upstream setup provenance is not established

All eight upstream assertion entries carry the same setup object:

- kind: `none-required-for-selected-assertion`
- line range: null
- hash: null

That claim is false for at least `func-5.1` and `func-5.2`, which query `tbl1`; the table and its data are created outside the selected assertion bodies. A future executor cannot reproduce or interpret those assertions from the hashed bodies alone without finding the setup in the pinned test file.

The validator hashes each assertion body, but for setup it checks only that a `setup` key exists. It does not require a setup range or hash, establish that an assertion is self-contained, or verify the declared “none required” condition.

### 5. Independent derivation is narrower than claimed

The revised validator does parse balanced catalog macro invocations and operands, and it resolves the conditions needed for the current captured profile. That is a substantive improvement over the former function-name flag table.

However, macro semantics and flag-token mappings remain encoded in Python rather than being parsed or checked against the pinned `sqliteInt.h` macro definitions. Preprocessor handling is a small special-case interpreter, with a generic `#if` fallback that evaluates false. The validator also does not independently validate:

- implementation routine operands;
- aliases;
- slice assignment;
- current TypeScript status derivation;
- cited branch symbols;
- nonempty case/branch ownership; or
- complete upstream setup provenance.

The available evidence therefore supports a current-profile consistency check, not the broader claim of independently derived and exhaustively validated metadata and implementation ownership.

## Inference, limitations, and uncertainty

The defects above concern provenance, ownership, and validation strength. They do **not** establish that the corrected 50-row catalog is wrong, nor do they disprove the values captured in the 51 native observations.

The following qualifications remain necessary:

- Native observations are immutable reference outcomes for their exact executions; they provide zero TypeScript compatibility credit.
- Public unsupported probes show current failure for the tested paths. They do not establish behavioral parity, broader incompatibility, or necessarily identify the exact rejection layer.
- The 12/38 status classification is supported within the corrected 50-row denominator, but the validator does not independently reconstruct that classification from TypeScript resolver/compiler/VDBE source.
- Not all local cases need a one-to-one upstream test. Local composed, parameter, storage-class, encoding, and boundary cases are valid when they truthfully identify source ownership and link relevant upstream assertions where those exist.
- The assessment does not require reconsidering the existing product exclusion for externally loaded extensions and does not change owner product scope.
- Focused successful checks are not a repository-wide compatibility result. The historical adapter lifecycle failure/hang remains neither a scalar-contract refutation nor a passing check.

## Recommendations and actionable handoff

Before claiming an implementation-ready handoff:

1. **Repair empty case ownership.** Give each of the seven unmapped local cases nonempty pinned source branches, or assign the cases to the source-owned implementation slices they exercise.
2. **Make slice coverage consumable.** Ensure every absent registry row and every implementation slice has explicit case ownership. In particular, link the existing `concat`/`concat_ws` cases to the `concat` slice.
3. **Link directly applicable upstream tests.** Attach relevant assertions such as `func-5.1`/`func-5.2` and selected `round()` assertions to the corresponding cases or slices. Retain a local-companion rationale only for the additional behavior not directly owned upstream.
4. **Capture reproducible setup provenance.** Record and hash the exact setup ranges needed by each upstream assertion. Use `none-required` only when the selected body is genuinely self-contained, and validate that assertion.
5. **Strengthen validation.** Reject empty source branches, empty required slice case sets, missing row-to-slice-to-case links, nonexistent source symbols, and null or unverified setup provenance.
6. **Narrow or substantiate derivation claims.** Either describe the current validator as a profile-specific parser with encoded macro semantics, or parse/check the relevant pinned `sqliteInt.h` definitions and preprocessor expressions directly.
7. **Regenerate linked artifacts.** If spec changes alter hash linkage, recapture the native artifact; update counts, hashes, prose, and superseded provenance; rerun the focused validator, public Fetch harness, Python compilation, typecheck, and diff checks; then commit with a clean tree.

Until these corrections are made, commit `20f88c1` should be retained as a materially improved partial scalar inventory and native corpus, not as the exhaustive implementation-ready contract requested by parent [[card:card-p-a]].
