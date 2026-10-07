# Bounded STAT4 tests-first research report

For [[card:card-s-h-a]], enabling [[card:card-s-h]]. **Conclusion: supported within the bounded research/design question.** A source-backed shared sample/count and probe/cost ownership proposal, pinned native evidence and executable tests-first discriminators are available before consuming implementation. This is neither runtime acceptance nor parent approval of the interfaces, budget, or whole STAT4 tranche.

## Evidence and provenance

Research/test deliveries: `a5fbcd774bf53dfd9ff90ab1ce087b9463bb01c3` and `f7b1ab68861886083eee5789fb74cdc022f597be`. Temporary-index delivery preserved unrelated peer index/staged/dirty bytes; no runtime source changes or public diagnostics were introduced.

Native development profiles use manifest-pinned SQLite **3.53.4**, source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`. Exact compile option inventories, flags and library digests are in [first-native.json](first-native.json):

- STAT4: `3f334ec0fd5753b7305f071dab6427b9c05d2387714c3c28a5d713d5397bd93e`.
- Paired noSTAT4: `d1ae8eb4b79fed63c3f85b6d1ddf595d93e4bafa84d5bc3023505311f9250340`.

Native deterministic ANALYZE fixtures cover UTF-8, UTF-16le and UTF-16be; raw sample records/count strings, decoded count vectors, SQL setup, fixture hashes, typed query rows, plans and work counters are retained rather than reproduced here. There are **27 skew-query pairs and132 edge-query pairs**, with equal paired typed rows. [edge-native.json](edge-native.json) includes empty/FFFF samples, zero count vectors, count overflow, WR aliases and no-stat/no-stat1/stat1-only/no-sample controls. These malformed optional-stat mutations return successful native queries—not blanket CORRUPT. [public-native.json](public-native.json) retains metadata, prepare error1 and same-prepared-statement reset/rebinding captures; bound EQPs are separately prepared.

The latest executable suite is **99 tests:84 pass,15 fail, zero skips/cancellations**. Six failures are missing proposed sample/probe/count owners; nine are actual hot INTEGER/NOCASE/RTRIM path discrepancies across the encodings: native selects a table scan while TS seeks an index. Public typed rows, metadata, reset/rebinding and tested malformed/control outcomes pass. Passing rare/prefix/range/IN/NULL/REAL qualitative paths is not evidence of sample consumption: stat1 alone currently selects those paths.

[Source/test matrix](MATRIX.md) maps upstream analyze9 assertions, loader/count primitives, KeyStats, equality/IN/range consumers and probe cleanup to executable evidence and obligations. Assessment independently checked **all62 follow-up input hashes, zero changed**, so prior verification remained applicable; it did not claim a new test pass. [first-inputs.json](first-inputs.json) and [followup-inputs.json](followup-inputs.json) preserve revision-bound inputs. Exact commands/process references, the initial guarded-build failure, Python syntax failure, and test-harness fixes are retained in `record:///status.md?card=card-s-h-a&v=10`. A corrected harness is not retrospective success for the earlier failing runs.

## Source-backed inference and proposed decision

[OWNERSHIP.md](OWNERSHIP.md) is the concise technical proposal, **pending parent approval**:

1. Existing schema Index identity owns source-shaped samples/counts and averages. Preserve raw owned records with eight padding bytes, original record length, uint64 BigInt arithmetic and source-required signed casts. Load before freeze/cache publication; publish nothing on failure. No independent histogram, eager full-index materialization, sample cap or fixture-driven tuning.
2. Shared Mem/value extraction and KeyInfo comparison own a builder-local mutable probe, active nField/nRecValid, NOTFOUND fallback versus error, restoration and all-slot free. Connection-lived samples and planning-lived probes have different lifetimes.
3. Translate source virtual-prefix KeyStats search and its equality/IN/ordinary-range callers through existing costing/insertion/solver ownership. Strict general record decoding cannot simply become unconditional malformed-sample rejection; translate the owning comparison/error channel while preserving ordinary callers.
4. First useful consumers are equality/IS/NULL, contiguous known multicolumn literal prefixes, ordinary scalar ranges including DESC/inclusivity, and represented literal-list IN. HIGHTRUTH/HEURTRUTH second-pass rebuilding is inseparable for useful hot equality consumption. Parameter-sensitive planning requires source-shaped binding/reprepare sensitivity, not treating every initial parameter as a literal.

These proposals follow inspected pinned producers/consumers; they are not proof that the proposed test seam names or object shapes are uniquely correct. Technical decisions remain mutable under implementation evidence.

## Limits and unresolved questions

- Internal native WR allocation capacity and overflow estimates were not instrumented. Successful edge rows do not prove exact capacity or estimate parity.
- A native DEBUG profile was not built; full multicolumn virtual-prefix gap/interpolation assertions remain incomplete.
- Proposed probe tests fail before their assertions execute; they do not establish cleanup/restoration correctness in an implementation.
- Parameter/reset row success is not parameter-sensitive reprepare or plan parity.
- No schema sample budget API or sample allocation implementation exists. Resource/cancel/deadline/failure tests are precise consuming obligations, not passed cleanup tests. Which connection/schema-lifetime budget owns samples remains a parent decision; execution-private sorter allowance must not silently be repurposed.
- Wider skipscan sample refinement, vector/subquery/function probes, and complete OR/join/cost integration remain outstanding implementation breadth as enumerated in MATRIX.md. They are not accepted by this report, nor grounds for substituting an independent algorithm.

No public scope or observable guarantee is changed. Existing [STAT4 admission evidence](../card-e-h-stat4-admission.md) remains preserved. Current guide/API/map repair—including the stale rejects-nonempty planner comment—belongs with consuming implementation.

## Actionable handoff

Parent [[card:card-s-h]] should approve or revise shared ownership/interfaces, the first useful slice and schema-lifetime resource owner **before consuming code**. Require the existing red discriminators to pass for source-faithful reasons, plus direct WR capacity, multicolumn virtual-gap, probe-failure/restoration and allocation/cancel/deadline tests specified in OWNERSHIP/MATRIX. Extend OR/join and parameter-sensitive consumers only with their inseparable caller machinery and source-based tests. Preserve no-stat/default/stat1/admission controls.

This report completes bounded research reporting only. Evidence promotion, technical policy approval, parent acceptance and project compatibility remain their respective owners' decisions; no additional exploration or runtime implementation is initiated here.
