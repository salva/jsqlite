# Final assessment — ordinary scalar tests-first contract

Card: [[card:card-p-a-a]]

Assessed delivery: `61c5071` (`research: finalize scalar ownership contract`)

Conclusion: **supported for the bounded research and implementation-contract question**

This conclusion accepts the source-pinned inventory, provenance model, machine contract, and tests-first corpus as an implementation-ready handoff. It does **not** claim that absent TypeScript scalar behavior is implemented, promote native results to TypeScript credit, complete parent [[card:card-p-a]], or establish repository-wide SQLite compatibility.

## Evidence

### Pinned identity and scope

The contract pins SQLite only through `reference/sqlite/manifest.json`:

- SQLite version: `3.53.4`
- source ID: `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`
- captured profile includes `MAX_FUNCTION_ARG=1000`

The machine denominator contains 50 active, in-scope ordinary-scalar registration rows. It classifies 12 as currently TypeScript-dispatched and 38 as absent. The denominator includes active `sqlite_compileoption_used/1` and `sqlite_compileoption_get/1`. Conditional registrations, the existing external-extension exclusion, and separately owned date/time, math, JSON, aggregate, and window roots remain visible rather than silently disappearing from the inventory.

The current-HEAD inspection still supports the mutable fidelity audit correction: `upper()` and `lower()` are absent. The earlier repaired scalar tranche did not establish broad registry support.

### Source and case ownership

The final machine contract contains 34 cases and 52 encoding-expanded native observations. All 34 cases have nonempty pinned branch ownership. Every declared source-owned implementation slice has both nonempty source branches and one or more owned cases.

Ownership is not limited to each case's primary organizational label: composed cases are also linked to every source slice they exercise. In particular, the `concat` slice owns four cases that cover both `concat` and `concat_ws`. Validator checks require every absent registration row to be named by a case owned through that row's source slice.

The previously unmapped public-bind, composition, and arity cases now identify their relevant pinned binder, expression/VDBE, resolver/matching, and function implementation paths. Source references are machine-checked for an existing file and leading symbol.

### Upstream assertion and setup provenance

Applicable direct pinned assertions are linked to corpus cases, including:

- `func-5.1` and `func-5.2` for upper/lower;
- selected `func-4.6` and `func-4.8` round assertions;
- `func9-100`, `func9-120`, `func9-130`, and `func9-160` for concat/concat_ws and arity;
- selected LIKE, trim, quote, unistr, and formatting assertions.

Each linked assertion body has an exact pinned line range and SHA-256. External SQL fixture setup for upper/lower, LIKE, and the selected round tests has exact line ranges, byte counts, purpose, and SHA-256. Assertions that are literal-only or establish their fixture inside the selected body use explicit narrower setup declarations with rationales. Local corpus extensions are distinguished from direct upstream behavior through `localAddition` instead of being represented as if no applicable upstream assertion existed.

### Validator scope and enforcement

`test/conformance/ordinary-scalars-manifest.test.py` now enforces:

- pinned source identity and profile argument limit;
- the 50-row active catalog membership;
- raw and normalized arity data and relevant FuncDef flags;
- exact selected assertion bodies and external setup ranges;
- nonempty case and slice branches with existing cited leading symbols;
- nonempty case ownership for every implementation slice;
- absent-row-to-source-slice-to-case linkage;
- fixture existence, typed native observation presence, and artifact linkage;
- the raw-versus-effective `min`/`max` overload contract.

Its claim is deliberately bounded. It is a profile-specific balanced macro-invocation parser with encoded macro/token semantics checked against an exact hashed range in pinned `sqliteInt.h`; it is not described as a general C preprocessor.

### `min`/`max` overload ownership

The final contract separates two concepts:

- raw `FUNCTION(min|max,-3,...,minmaxFunc)` FuncDef matching admits 1 through 1000 arguments;
- effective ordinary-scalar ownership is 2 through 1000 arguments.

Pinned `src/callback.c:matchQuality` gives an exact-arity definition a higher score than a variadic definition. For one argument, the exact `WAGGREGATE(min|max,1,...)` definition therefore wins over raw `nArg=-3`. Pinned `src/resolve.c:resolveExprStep` classifies the selected definition as aggregate when `xFinalize!=0`. One-argument `min(x)`/`max(x)` is consequently aggregate/window-owned, while two-or-more-argument calls belong to ordinary scalar `minmaxFunc`.

`case-minmax-overload-discriminator` captures aggregate `min/max`, window `min`, and two-argument scalar `min/max` through public SQL. Its typed native result is `1, 3, 1, 3, 1`.

### Artifacts and checks

Final immutable artifact hashes:

- spec: `aa7139122530cad046e2d36ff6096a7b8e02fb60d2ef66cdfac308d7105cf97f`
- native capture: `46360db3627e2b002d35a764cdac38092f05314b50ccb46a1e0287ee0cf0711e`

The accepted assessment reran and passed:

```text
python3 test/conformance/ordinary-scalars-manifest.test.py
node test/conformance/run-ordinary-scalars-unsupported-ts.mjs
sha256sum test/conformance/cases/stage3-ordinary-scalars.spec.json \
  test/conformance/cases/stage3-ordinary-scalars.native.json
git diff --check
```

Observed focused counts were:

- 50 registrations;
- 34 cases;
- 52 typed native observations;
- 12 currently dispatched / 38 absent rows;
- three physical public Fetch fixtures;
- 114 unsupported/no-TypeScript-credit Fetch observations (38 absent rows × three encodings).

The delivery also records successful native recapture, Python compilation, and `npm run typecheck`. During exploration, the Fetch harness initially failed because it still read the superseded `acceptedArities` field; it was corrected to use `effectiveScalarArities` and then passed. The initial failure is retained as repair history, not represented as a pass.

## Inference

The corrected catalog, explicit scope dispositions, source-slice ownership, assertion/setup provenance, typed reference corpus, and overload discriminator jointly support the bounded conclusion that another executor can take any declared ordinary-scalar implementation slice without repeating the specific source-ownership inventory required by this card.

This inference is stronger than the two earlier deliveries because the formerly prose-only or missing relationships are now represented in machine data and rejected when empty or inconsistent. The third correction therefore supersedes the earlier refuted assessments for this bounded question.

## Limitations and uncertainty

1. **No runtime implementation credit.** No scalar runtime behavior was added. Native captures are reference outcomes for exact executions and grant zero TypeScript compatibility credit.
2. **Unsupported is not parity evidence.** The 114 Fetch observations honestly show unsupported outcomes for generated probes. They do not identify every rejection layer, prove broad incompatibility, or establish eventual parity.
3. **Profile-specific validation.** The catalog validator does not implement a complete C preprocessor. Macro semantics and token mappings remain encoded, although their pinned definition range is hash-checked and the public claim is correspondingly narrow.
4. **Symbol validation is lexical.** A cited leading symbol must occur in the cited pinned file, but this is not a semantic C call-graph proof. Caller and branch mappings remain reviewed research annotations.
5. **Setup declarations have different evidence strengths.** External setup ranges are separately hashed. `self-contained-no-fixture` and body-contained declarations are reviewed semantic claims with rationales; their assertion bodies are hashed, but no separate external range exists by definition.
6. **Focused checks only.** Passing the manifest validator, Fetch harness, typecheck, and artifact checks is not repository-wide compatibility evidence. No prior unrelated lifecycle hang is converted into a pass.
7. **Separate scopes remain open.** Date/time, math, JSON, aggregates, windows, and the product's extension exclusion are not implemented or approved by this result. The min/max discriminator assigns ownership; it does not implement aggregate/window behavior.
8. **Current-HEAD classification can change.** The 12/38 classification is supported for assessed commit `61c5071`. Future runtime work must update the machine contract, evidence, and TypeScript credit rather than relying on this snapshot indefinitely.
9. **`sqlite_log` remains an implementation proposal.** Its internal no-op browser diagnostic sink is a technical contract proposal, not evidence of implemented behavior or a new host-callback policy.

## Recommendations and handoff

1. Accept `61c5071` as the bounded implementation-ready ordinary-scalar research contract for parent [[card:card-p-a]].
2. Have future executors consume `test/conformance/cases/stage3-ordinary-scalars.spec.json` and the linked pinned source/test ranges rather than reconstructing the registry from summaries.
3. Preserve raw FuncDef arity separately from resolver-selected effective scalar ownership, especially for one-argument versus multi-argument `min`/`max`.
4. Implement source-owned slices through the shared Mem, UTF, FunctionContext, collation, lifecycle, and bounded-work primitives. Do not substitute JS regex/eval, host formatting, callbacks, or a native runtime fallback.
5. Earn TypeScript compatibility credit only with independent public-path tests that preserve INTEGER/REAL/TEXT/BLOB/NULL, encoding, embedded-NUL, parameter, returned-column, and error phase/code/message distinctions.
6. Keep date/time, math, JSON, aggregate/window, and excluded extension behavior in their existing separately owned scopes. Do not interpret this report as parent completion or a product-scope change.
