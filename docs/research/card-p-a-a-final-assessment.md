# Final assessment: ordinary scalar inventory and tests-first contract

Card: [[card:card-p-a-a]]

Assessed delivery: commit `c4b3c81`

Conclusion: **refuted for the full bounded acceptance question**

## Executive conclusion

The delivered artifacts are materially useful partial research, but they do not establish the exact, exhaustive, source-owned implementation handoff required by the brief. The accepted assessment found two direct source/profile contradictions—incorrect variadic maxima and omitted active scalar registrations—and two material provenance/validation gaps. Passing focused checks therefore cannot promote the artifact set to full acceptance, because parts of the validator encode the same incorrect or manually curated assumptions it is intended to test.

This conclusion does **not** invalidate every artifact. The pinned identity, exact captured outcomes for the 30 declared cases, public unsupported-path observations, and bounded `upper`/`lower` finding remain usable with the qualifications below. Native captures confer no TypeScript compatibility credit.

## Evidence that remains supported

1. **Pinned identity.** Provenance is tied to `reference/sqlite/manifest.json`: SQLite 3.53.4, source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
2. **Declared corpus and immutable capture.** Commit `c4b3c81` contains 48 declared rows, 30 cases, and 48 fresh typed native observations. Delivery hashes are:
   * spec: `d0500841d3eafa82db12e58cad9b05400325c5abccc6b656fb1b327cfcc1010c`
   * native: `7fdf75835284454a6dcff22595eb64c968bc34907465b093baf67661561e3582`
3. **Public unsupported evidence.** The harness opens physical UTF-8, UTF-16LE, and UTF-16BE fixtures through the public Fetch path and records 108 honest unsupported observations for the 36 rows classified absent by the manifest. This establishes those unsupported paths under the tested inputs; it is not scalar parity evidence.
4. **Bounded current-HEAD classification.** Within the delivered 48-row set, current TypeScript inspection supports 12 implemented and 36 absent rows. `upper` and `lower` are absent. No scalar runtime behavior was added.
5. **First-pass repairs.** The delivery corrected zero-argument minima for `printf`, `format`, and `char`, added previously missing direct cases, repaired principal macro-flag errors, and kept aggregate/window and future date/time/math/JSON scopes visible.

## Evidence that refutes full acceptance

### 1. Variadic maxima contradict the pinned profile

Every negative-arity registration in the machine spec has `acceptedArities.maximum: 127`. Pinned `src/sqliteLimit.h:147-148` defines `SQLITE_MAX_FUNCTION_ARG` as 1000, and the captured oracle compile options contain `MAX_FUNCTION_ARG=1000`. Pinned `src/callback.c:matchQuality` establishes minimum argument semantics for raw arities `-1`, `-3`, and `-4`; it does not establish a maximum of 127.

The validator uses the same hard-coded 127 value, so its pass is circular on this point. No native boundary probes independently support the declared maxima.

### 2. The declared denominator omits active production registrations

Pinned `src/func.c:aBuiltinFunc` contains `sqlite_compileoption_used/1` and `sqlite_compileoption_get/1` when `SQLITE_OMIT_COMPILEOPTION_DIAGS` is not defined. The captured profile does not report that omission option, but both registrations are absent from the machine inventory. The validator explicitly filters them rather than deriving their exclusion from pinned preprocessor/profile evidence.

Accordingly, the claim that 48 rows form the exhaustive production ordinary-scalar denominator is not established. The resulting 12/36 split remains meaningful only **within that incomplete denominator**. Whether extension-facing registrations such as `load_extension` belong in a later product denominator can be decided separately; the two compile-option diagnostic registrations are sufficient to refute present exhaustiveness.

### 3. Upstream assertion provenance is sparse and not linked to cases

The machine artifact records eight upstream assertion bodies: four from `func.test`, one from `like.test`, two from `func9.test`, and one from `printf.test`. None of the 30 cases links to an upstream assertion, and the records do not encode setup boundaries.

This is insufficient for the brief's implementation-ready source/test ownership across all slices. Future executors would still need to re-inventory upstream setup and assertion relevance for many cases.

### 4. Validation does not independently derive complete metadata

The validator parses macro name, function name, and raw arity from the catalog, but reconstructs symbolic flags through a handwritten function-name table. It does not derive all metadata from macro operands such as `bNC`, `mFlags`, `FUNCTION2` extras, or LIKE branch flags. Conditional profile membership is also manually filtered.

This is a useful consistency check, but it does not substantiate the stronger claim of independently validated, exhaustive FuncDef metadata and active-profile membership.

## Inference, limitations, and uncertainty

* The accepted assessment does not reject the values in the 48 native observations. They remain immutable reference evidence for exactly the declared executions.
* It does not infer broader runtime incompatibility from unsupported-path probes. Those probes establish only current rejection/unsupported behavior for their tested public paths.
* It does not promote native results to TypeScript credit or scalar compatibility.
* It does not decide every disputed scope boundary. In particular, extension-facing functions may require planner or owner-scope interpretation. That uncertainty does not affect the conclusive denominator defect caused by active compile-option diagnostic registrations.
* The exploration reported successful recapture, focused validator, Fetch harness, Python compilation, TypeScript checking, and diff checks. It also reported that no generic `npm test` script exists and that a selected combined Node run failed and hung on an adapter lifecycle issue. That failure is not evidence for the scalar contradictions, but the interrupted run cannot be represented as broad passing validation.
* No evidence here changes product scope, approves the proposed `sqlite_log` treatment, or completes parent [[card:card-p-a]].

## Recommendations and actionable handoff

Before this research artifact can support the full brief:

1. Derive the active production scalar denominator from pinned source conditions and actual profile options. Include `sqlite_compileoption_used/1` and `sqlite_compileoption_get/1`, or document an authorized scope basis for excluding them.
2. Replace the hard-coded variadic maximum of 127 with the actual profile limit and add native valid-boundary and over-limit error observations.
3. Make validation derive macro operands, flags, conditional branches, and active registration membership rather than reproducing handwritten name rules.
4. Link every case and implementation slice to exact upstream assertion and required setup/body provenance. Explicitly mark source-authored cases for which no direct upstream assertion exists instead of leaving provenance absent.
5. Correct counts and prose, recapture immutable outputs, publish replacement hashes while retaining superseded provenance, rerun focused checks, and commit the repaired handoff.

Until then, retain the delivery as partial research evidence and tests-first material, not as the exhaustive implementation contract requested by [[card:card-p-a]].
