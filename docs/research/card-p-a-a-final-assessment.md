# Final assessment — ordinary scalar tests-first contract

> **Current disposition after assessment of correction commit `9e399f4`: supported for the bounded research contract.** The report retains the earlier refutation of `9fc8c20` as audit history. The final section records the superseding correction: exact-routine ownership remains supported, and persisted-column expectations are now captured from and independently validated against the exact hashed physical fixtures. This does not grant TypeScript runtime credit or establish broader SQLite compatibility.

Card: [[card:card-p-a-a]]

Current assessed delivery: `9e399f4` (`research: capture scalar columns from physical fixtures`)

Historical assessed deliveries: `61c5071` and `9fc8c20`; their conclusions below are retained to preserve the evidence trail.

Historical conclusion for assessed delivery `61c5071`: **supported for the bounded research and implementation-contract question; superseded for the current artifact generation by the final refuted assessment below**

This historical conclusion accepted the then-assessed source-pinned inventory, provenance model, machine contract, and tests-first corpus as an implementation-ready handoff. The final assessment below shows why that conclusion cannot be carried forward to the current persisted-column artifact generation. Neither conclusion claims that absent TypeScript scalar behavior is implemented, promotes native results to TypeScript credit, completes parent [[card:card-p-a]], or establishes repository-wide SQLite compatibility.

## Evidence

### Pinned identity and scope

The contract pins SQLite only through `reference/sqlite/manifest.json`:

- SQLite version: `3.53.4`
- source ID: `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`
- captured profile includes `MAX_FUNCTION_ARG=1000`

The machine denominator contains 50 active, in-scope ordinary-scalar registration rows. It classifies 12 as currently TypeScript-dispatched and 38 as absent. The denominator includes active `sqlite_compileoption_used/1` and `sqlite_compileoption_get/1`. Conditional registrations, the existing external-extension exclusion, and separately owned date/time, math, JSON, aggregate, and window roots remain visible rather than silently disappearing from the inventory.

The current-HEAD inspection still supports the mutable fidelity audit correction: `upper()` and `lower()` are absent. The earlier repaired scalar tranche did not establish broad registry support.

### Source and case ownership

The final machine contract contains 37 cases and 59 encoding-expanded native observations. All 37 cases have nonempty pinned branch ownership. Every declared source-owned implementation slice has both nonempty source branches and one or more owned cases.

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

- spec: `e0cba75903b74f5c93f5eb5505ceedf0342acbf85e82f8dfc7a804fc33266ae0`
- native capture: `84ac9ef390884479d4dc3d315690f9205bb3e2ce64ff7cdc1c440107e80d977a`

The final coherence-repair rerun passed:

```text
LIB=/work/jsqlite2/.saivage/work/cards/card-p-a-a/oracle-build/build/libsqlite3-oracle.so
python3 test/conformance/capture-ordinary-scalars.py --library "$LIB"
# {"cases": 37, "observations": 59, "registrations": 50}
python3 test/conformance/ordinary-scalars-manifest.test.py --library "$LIB"
# ordinary scalar contract: 50 active in-scope rows, 37 cases/59 native observations, 12 implemented/38 absent; profile-specific catalog, overload ownership, source/test/setup provenance verified
node test/conformance/run-ordinary-scalars-unsupported-ts.mjs
# {"publicFetchFixtures":3,"absentRegistrations":38,"generatedUnsupportedObservations":114,"fixtureColumnObservations":6,"fixtureColumnOutcomes":["sqlite"],"outcome":"honest-unsupported-no-ts-credit"}
python3 -m py_compile test/conformance/capture-ordinary-scalars.py test/conformance/ordinary-scalars-manifest.test.py
npm run typecheck
sha256sum test/conformance/cases/stage3-ordinary-scalars.spec.json \
  test/conformance/cases/stage3-ordinary-scalars.native.json \
  test/fixtures/expression-cursor/users-utf8.db \
  test/fixtures/expression-cursor/users-utf16le.db \
  test/fixtures/expression-cursor/users-utf16be.db
git diff --check
```

The successful validator command loaded that exact library, verified the manifest source ID, opened all three exact hashed fixtures read-only, and compared both persisted-column cases' typed rows. The previously published argument-less validator line was invalid because `--library` is required; it is superseded and must not be read as a successful gate execution.

Observed focused counts were:

- 50 registrations;
- 37 cases;
- 59 typed native observations;
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

1. Historical recommendation for `61c5071` (now superseded for the current artifact generation): accept it as the bounded ordinary-scalar research contract for parent [[card:card-p-a]]. The final section requires correction before current persisted-column artifacts can be promoted.
2. Have future executors consume `test/conformance/cases/stage3-ordinary-scalars.spec.json` and the linked pinned source/test ranges rather than reconstructing the registry from summaries.
3. Preserve raw FuncDef arity separately from resolver-selected effective scalar ownership, especially for one-argument versus multi-argument `min`/`max`.
4. Implement source-owned slices through the shared Mem, UTF, FunctionContext, collation, lifecycle, and bounded-work primitives. Do not substitute JS regex/eval, host formatting, callbacks, or a native runtime fallback.
5. Earn TypeScript compatibility credit only with independent public-path tests that preserve INTEGER/REAL/TEXT/BLOB/NULL, encoding, embedded-NUL, parameter, returned-column, and error phase/code/message distinctions.
6. Keep date/time, math, JSON, aggregate/window, and excluded extension behavior in their existing separately owned scopes. Do not interpret this report as parent completion or a product-scope change.

## Post-assessment correction from independent parent review

Independent review `record:///review.md?card=card-p-a&v=3` found two valid defects in the preceding supported evidence: there were no persisted-column scalar cases despite the column-coverage wording, and slice provenance did not require each row's actual routine. Both are repaired in the current artifacts. Two source-owned persisted `scalar_values` cases now run through equivalent native setup and every physical encoding Fetch fixture with exact per-encoding typed expectations for TEXT, embedded-NUL TEXT, BLOB, and NULL inputs. Current public executions produce six honest unsupported SQLite outcomes and no TS credit. The validator requires this coverage and physical fixture hashes.

All 50 rows now carry an exact `implementationOwner`, which must occur in their slice and every case covering that row. Non-inline rows must equal the registry's recorded `src/func.c` routine; inline rows use an explicit compiler owner and preserve the inline registration operand. CHAR and UNISTR now own `charFunc` and `unistrFunc` respectively, with UNISTR's `isNHex` and `sqlite3AppendOneUtf8Character` helpers; they are not attributed to `unicodeFunc`. The three formerly case-uncovered implemented rows have a discriminator case. Current totals and hashes above supersede the pre-review values.

## Final assessment of the `9fc8c20` repair: refuted

This section reports the accepted assessment evidence following the exploration repair. It supersedes the earlier supported disposition where the new evidence conflicts with it, without retracting separately supported catalog and routine-owner evidence.

### Evidence

The assessment inspected accepted parent review `record:///review.md?card=card-p-a&v=3`, commit `9fc8c20`, the current machine specification and native capture, capture and validator code, and the three hashed physical fixtures. It also executed the persisted-column SQL directly against those fixtures with the manifest-pinned SQLite oracle, source ID:

```text
2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc
```

Supported parts of the repair are:

- two manifest-defined persisted `scalar_values` cases exist;
- all three physical Fetch fixtures contain ordinary TEXT, embedded-NUL TEXT, BLOB `410042`, and NULL rows;
- the public harness attempts six fixture-column executions, which currently reject on absent functions and correctly earn zero TypeScript credit;
- all 50 rows carry an `implementationOwner`; direct inspection found no non-inline mismatch against `src/func.c:<recorded implementation>`;
- the Unicode slice separately names `unicodeFunc`, `charFunc`, `unistrFunc`, `isNHex`, and `sqlite3AppendOneUtf8Character`.

The conclusive contradictory evidence concerns fixture equivalence. The manifest setup creates embedded-NUL TEXT with:

```sql
CAST(X'410042' AS TEXT)
```

That byte sequence represents `A`-NUL-`B` when interpreted as UTF-8. It does not reproduce a TEXT value physically encoded in UTF-16LE or UTF-16BE. Direct pinned-oracle execution against the physical fixtures disagrees with the stored expectations:

- for UTF-16LE embedded-NUL TEXT, the stored capture expects `instr(v,char(0)) = 0` and `upper(v) = 'A'`; the physical fixture produces `instr = 2` and result UTF-8 bytes `410042` (`A`-NUL-`B`);
- for UTF-16BE embedded-NUL TEXT, the stored capture expects `instr = 0` and U+4100-shaped `quote`/`upper` results; the physical fixture produces `instr = 2`, `quote = 'A'`, and `upper` result UTF-8 bytes `410042`.

The mismatch was also observed through host SQLite, but the pinned-oracle run is controlling evidence and removes host-version ambiguity.

### Inference

The implementation-owner correction is supported within the validator's documented lexical/profile-specific limits. The combined claim that `9fc8c20` repairs both review defects is nevertheless **refuted**. The first defect required exact typed expectations for the actual physical Fetch fixtures, but the current UTF-16 expectations were generated from a non-equivalent setup.

The passing validator does not contradict that finding. It requires a `410042` setup marker, equality between authored expectations and the in-memory capture, and hashes of the fixture files. It does not execute the pinned oracle against each physical fixture or otherwise establish semantic equivalence between the setup database and those fixtures. Current TS function absence masks the mismatch because public execution fails before returning typed rows.

### Limitations and uncertainty

- This assessment establishes the identified UTF-16 mismatch; it is not an exhaustive re-audit of every scalar expectation.
- It does not refute the 50-row denominator, 12/38 current-status snapshot, or exact-routine mappings except where a claim depends on the invalid persisted-fixture capture.
- It grants no TypeScript runtime credit and makes no broad compatibility claim. The six public errors establish only current unsupported outcomes.
- Symbol and owner checks remain profile-specific and partly lexical, not a semantic C call-graph proof.
- Date/time, math, JSON, aggregate/window behavior, and extension policy remain separately owned scopes.

### Recommendation and actionable handoff

Do not promote this artifact generation as an implementation-ready persisted-column reference contract. Either capture each hashed physical fixture directly with the pinned oracle, or build reference databases through a demonstrably identical fixture-creation path using encoding-correct TEXT binding rather than casting UTF-8-shaped bytes as database-encoded text. Regenerate per-encoding typed expectations and the native artifact.

Strengthen validation to compare pinned-oracle results from the physical fixtures (or cryptographically identical construction output), rather than only checking fixture hashes and a textual `410042` marker. Then rerun native capture, validator, public unsupported harness, Python compilation, `npm run typecheck`, hash checks, and `git diff --check`. Unsupported results remain zero credit. This correction requires no scalar runtime implementation or scope expansion.

## Bounded correction after refutation: supported

The refuted UTF-16 equivalence mechanism above has been removed, while its diagnosis remains as audit history. Persisted-column native capture no longer executes `CAST(X'410042' AS TEXT)` or any synthetic setup. It opens each exact hashed UTF-8, UTF-16LE, and UTF-16BE physical fixture with the manifest-pinned oracle and runs each declared scalar query against the database's stored values. Regenerated UTF-16 expectations now match direct physical evidence: embedded-NUL TEXT yields `instr(v,char(0)) = 2` and `upper(v)` UTF-8 bytes `410042` in both UTF-16 fixtures (with `quote(v) = 'A'`). BLOB behavior remains encoding-sensitive as directly observed.

The validator now requires `--library`, verifies its exact source ID, opens every physical fixture read-only through that library, executes both persisted cases in all three encodings, preserves typed INTEGER/REAL/TEXT/BLOB/NULL results, and compares rows to manifest expectations. Fixture hashes and native observation `physicalFixture` path/hash linkage are also required. This is a semantic physical-fixture gate rather than a hash-only or authored-setup equality check.

The accepted all-50 implementation-owner repair is unchanged. Counts remain 50 registrations, 37 cases, and 59 native observations; the public harness still records 114 generated unsupported probes and six persisted-column unsupported executions with zero TypeScript credit. Current artifact hashes are listed above. This correction supports the bounded research contract again; it does not implement scalar runtime behavior, grant TS credit, prove repository-wide compatibility, or close separately owned scopes.

## Accepted assessment report for `9e399f4`

### Evidence

The accepted assessment examined the independent review, the prior refutation, the correction commit, the current machine artifacts and tools, and the manifest-pinned oracle. The two persisted-column cases no longer contain `fixtureSetupSql`; capture opens each path from `publicFetchFixtures` and executes SQL against stored `scalar_values`. The unrelated UTF-8-only owner-discriminator case still contains `CAST(X'410042' AS TEXT)`, but it does not construct or stand in for a persisted fixture.

A fresh capture to disposable storage reported 50 registrations, 37 cases, and 59 observations and was byte-identical to the checked-in native artifact. Fixture hashes were unchanged before and after capture. Every persisted native observation records its physical path and matching SHA-256. The corrected embedded-NUL TEXT observations in UTF-16LE and UTF-16BE are `instr(v,char(0)) = 2`, `quote(v) = 'A'`, and `upper(v)` with UTF-8 bytes `410042`.

The strengthened validator requires the native library, checks the exact pinned source ID, verifies fixture and observation hashes, opens every fixture read-only, executes both persisted cases in all three encodings, preserves typed INTEGER/REAL/TEXT/BLOB/NULL values, and compares every row with the manifest. That validator passed. The all-50 implementation-owner checks remain present and passing. The still-applicable public-harness evidence remains 114 generated absent-function probes and six persisted-column attempts, with unsupported SQLite errors and zero TypeScript credit.

Current immutable hashes are:

- spec: `e0cba75903b74f5c93f5eb5505ceedf0342acbf85e82f8dfc7a804fc33266ae0`;
- native capture: `84ac9ef390884479d4dc3d315690f9205bb3e2ce64ff7cdc1c440107e80d977a`;
- UTF-8 fixture: `3e3464fe16235ea9805c6a14304e1dda5649b30df28defd7f71c29e1e773d1c5`;
- UTF-16LE fixture: `cf4c67e9d3e6f7a0ab865d1384d5996d464bdb79768fc7e37e8a195fc8c313d7`;
- UTF-16BE fixture: `5d8a834d2d8c4e9d742af57004779befa7201b07b4465033c1dbe30320115963`.

### Inference and conclusion

This evidence supports the bounded conclusion that `9e399f4` corrects the identified persisted-column UTF-16 equivalence defect. Typed expectations are now derived from, linked to, and independently checked against the exact hashed physical fixtures using the pinned oracle. Together with the preserved all-50 semantic-owner mapping, the two defects identified by independent review are repaired sufficiently for the ordinary-scalar tests-first implementation handoff.

“Supported” describes this bounded research contract only. It is not evidence promotion to TypeScript parity, parent-card completion, policy approval, or acceptance of repository-wide SQLite compatibility.

### Limitations and uncertainty

- The assessment did not exhaustively re-audit every scalar expectation or every upstream semantic branch.
- Native observations establish reference behavior only and grant no TypeScript runtime credit.
- Current unsupported public outcomes do not prove future parity or the exact rejection layer after implementation work changes.
- Catalog parsing and source/owner validation remain profile-specific and partly lexical; they are not a general C preprocessor or semantic call-graph proof.
- The 12-dispatched/38-absent classification is a current-HEAD snapshot and must be revised when runtime behavior lands.
- Date/time, math, JSON, aggregates/windows, extension policy, parent [[card:card-p-a]], and repository-wide runtime compatibility remain separately owned or incomplete.

### Recommendations and handoff

Future scalar implementation slices should consume the checked-in spec and native corpus without rebuilding source ownership. They must preserve typed storage classes, database encodings, embedded NULs, bound-parameter and returned-column behavior, error phase/code/message, raw/effective arities, and shared Mem/UTF/FunctionContext/collation/lifecycle/bounded-work behavior. Keep unsupported outcomes at zero credit until public TypeScript executions match the corresponding typed expectations. Continue to run physical-fixture validation with the exact pinned library; do not restore synthetic UTF-16 TEXT construction, native runtime fallback, host callbacks, JS regex/eval, or host-formatting substitutions.
