# Historical red and repair provenance — not current decision authority

# m shared expected-width decision (red; integration correction required)

Bounded decision for [[card:card-m-f-k]], upward routing to root and [[card:card-i]]. No staging, index reset, runtime edits, integration commit, or shared-path ownership claim. Root t retains builder review. This is not a whole-goal redo.

## Exact inspected inputs

HEAD `ca4fd96c2ab4675d6a2ebd231b80770eef79899c`; actual **HEAD→working** counts: resolve 13/3, select-program 4/3, vdbe 144/11. Index contains 3081 staged paths; index→working is not the runtime candidate. Diff SHA256 (git diff HEAD -- src/internal/resolve.ts src/internal/select-program.ts src/internal/vdbe.ts): `ab6258bd6665ac1356ddcc74a678c0fa83692d11de2ef404daeb71ba8caa13cc`, unchanged after verification.

Working SHA256:
- resolve.ts `3a21890cacd94c5a20e697745ace7635feae0122ebeaf4c5393accabd9195219`
- select-program.ts `0204cf305c6435c930639bd8d795871b319a9f68663aef1c701af352b7e53a5a`
- vdbe.ts `d5e0d97e8e92dc7c991ad76e9855ff0e89a8e09df1bf545ce0dfe93f0e4cae87`

Read actual diff, i-c review, i-a README, current guide row/vector section, searched mutable audit (no dedicated current row-vector decision found), and pinned expr.c/select.c. i evidence is shared-worktree evidence, not a committed runtime milestone.

## Contract decision and hunk recommendation

**Approve contract, not exact whole patch.** Consumer determines N; ordinary scalar caller remains width 1. A vector SELECT uses one contiguous NULL-initialized N-register result range, empty yields N NULLs, multiple rows use FIRST qualifying row after ORDER/LIMIT/OFFSET; one evaluation per expression invocation, correlated rerun, uncorrelated Once. EXISTS is a separate one-register INTEGER 0/1 destination regardless of child projection width. No blanket width relaxation or parallel evaluator.

- **INCLUDE in scoped candidate** select-program hunks `@@ -1,9 +1,10` and `@@ -76,7 +77,7`: width defaults 1, Mem copies count contiguous cells, Set inserts count fields with per-field affinity. This matches select.c selectInnerLoop SRT_Mem nSdst/Copy and SRT_Set MakeRecord-affinity/IdxInsert. Width/affinity consistency should be verified before emitting any operations; no public RangeError leakage should be admitted. Root t reviews builder integration.
- **CORRECT before INCLUDE** resolve hunks `@@ -268,7 +268,16`, `@@ -283,7 +292,7`, `@@ -470,7 +479,7`, `@@ -498,6 +507,7`: post-expansion validation is right; however reductionWidth uses syntactic result.length for SELECT, not expanded width. Context must distinguish scalar/vector/EXISTS, rather than accepting a child's own syntactic width everywhere then relying on scattered lowering guards. EXISTS has no N-column consumption check. IN must recognize SELECT-vector LHS as well as literal vectors.
- **CORRECT before INCLUDE** vdbe `@@ -2308,7 +2331,47`: current dispatch only enters vector comparison if at least one operand is a literal vector. expr.c codeVectorCompare recognizes TK_SELECT on either/both sides, checks widths first, codes both children once, then exprVectorRegister returns regSelect+i plus original resolved field expression. `(SELECT 1,2)=(SELECT 1,2)` is currently rejected. Use resolved field descriptors/semantic expressions: reparsing unbound child result expressions does not establish column affinity/collation; semantic provenance cannot be inferred from bare register values.
- **CORRECT before INCLUDE** vdbe `@@ -3742,11 +3813,52` (compileWideSubquery and join caller), `@@ -2709,6 +2773,13`, `@@ -6313,6 +6425,7`: routing on result.length>1 sends wide EXISTS to Mem, yielding NULL on empty and selected field on nonempty instead of Boolean. Separate EXISTS destination/init/limit. Determine scalar-vector width from expanded plan, not expression.select.result.length; vector IN currently computes 1 for SELECT-vector LHS. Carry one consumer width through all callers.
- **INCLUDE conceptually within corrected helper** builder.range, full NULL initialization on rerun, linked local/outer binding, Once enclosing producer but excluding IN LHS probe, scalar LIMIT 1 and first-row exit. These track expr.c sqlite3CodeSubselect EP_VarSelect, nReg, SRT_Mem NULL range and selectInnerLoop limit exit. No claim of full lifetime proof: monotonic builder allocation keeps child result registers alive through field consumption, but nested/correlated/offset/sorter/aggregate consumers need executable control and lifetime checks. Missing linked plan must reject atomically rather than misclassify correlated work as Once.
- Remaining vdbe vector production/binding/equality/traversal/ElseEq/InSet hunks are **outside this m subquery approval** (i/root review), not an instruction to discard them. exprVectorRegister retains field affinity/collation; lazy field evaluation and comparison state remain i responsibility. Preserve STRICT/STAT4/bitwise and all peer index content.

Public result remains scalar comparison/IN Boolean metadata, not a public vector storage class. Naked multi-column projection must error `row value misused`, SQLITE_ERROR 1. IN width errors use expanded widths and expected consumer N. Full metadata/origin, exact extended codes and phase/error precedence remain unproven; names-only matches do not waive them.

## Fresh evidence / red distinctions

Commands executed in project, disposable probes/build/logs under `$SAIVAGE_CARD_WORK_ROOT/shared-width-review` and permitted oracle-build:

- `node --experimental-strip-types test/conformance/row-vector/public.mjs`: 123/123, zero credit, exit 0 (proc-33419ce68d2b; public.log). This finite corpus misses the following boundaries.
- Public Request/HTTP Fetch probes on each UTF-8/UTF-16LE/UTF-16BE fixture (proc-483630e4882d): wide EXISTS nonempty gives 1, **empty gives NULL**; two SELECT-vector equality errors `row value misused` code1; SELECT-vector IN errors `sub-select returns 2 columns - expected 1` code1. Literal-vector/SELECT equality yields 1; empty SELECT vector yields NULL; naked multi-column scalar errors code1. Initial probe mistakenly used prepare return as statement and failed TypeError (proc-63642a995311), corrected to `.statement`; not product evidence.
- `sh tools/oracle/build.sh`: exit0 (proc-449be92d3a1e; build.log). Independent ctypes probe asserts exact pinned 3.53.4 source ID before preparing same SQL, proc-aae71f0dd9dd: native wide EXISTS empty INTEGER0, both SELECT-vector equality INTEGER1, SELECT-vector IN INTEGER1; controls match (empty comparison NULL, naked projection prepare code1). This oracle was obtained after public reproduction; source comparison independently explains the divergences.
- `npm run typecheck`: exit0 (proc-a92fa554c164; typecheck.log). This does not resolve runtime reds.

Pinned source: expr.c exprCodeSubselect/exprVectorRegister/codeVectorCompare (~623–780), sqlite3CodeSubselect (~3841–3988); select.c selectInnerLoop SRT_Set/SRT_Mem (~1384–1443). EXISTS initializes INTEGER0 and uses SRT_Exists; SELECT allocates nExpr NULL range. Width mismatch precedes field evaluation, SELECT children are generated once before per-field comparison, original field expressions determine comparison semantics.

**Disposition: EXCLUDE exact whole three-file patch from unconditional integration acceptance until bounded corrections above.** Retain working edits and peer index untouched; original i executor assembles corrected scoped HEAD-relative runtime. No waiver of i full metadata/extended-code/lifetime/resource/committed archive/Chinook or compound obligations. These are named deficiencies, not authorship ACK or a new feature-breadth mandate.

## Bounded repair follow-up

The original decision above is revision-bound red evidence, not current runtime
failure authority. m repaired only vdbe.ts and added the permanent public Fetch
regression `test/conformance/row-vector/subquery-consumers.test.mjs`.
SELECT-vector comparison recognizes either/both SELECT operands and checks widths
before generating children. IN evaluates its SELECT LHS through the same linked
emitter after the RHS Once region (not cached with RHS). Wide EXISTS uses its own
single INTEGER0-initialized SRT_Exists destination, not a NULL Mem vector.
No-FROM child result/WHERE lowering now accepts linked plan/expression binding.
The latter was required by a new correlated EXISTS neighbor: the constant-only
repair passed, but correlated empty/nonempty transitions failed 0 versus 1 in
all encodings (proc-ec483c454637); correcting the caller binding resolved it.

Permanent tests cover the three original gaps, non-Boolean first field in EXISTS,
empty/LIMIT0/first-row NULL vector, SELECT LHS IN/NOT IN, scalar misuse and width
error, names/storage types, reset/finalize and correlated EXISTS transitions in
all encodings. Final chained typecheck, vector lifecycle/structure/consumers and
prior aggregate composition pass16/16, existing corpus123/123 zero credit, diff
hygiene passes (proc-491923508919). Initial test command proc-06bb07e476e1 ended
exit1 only because a trailing grep found no `not ok`; its tests passed10/10.
Original native comparison remains applicable to unchanged reproducer SQL and
pinned identity. Initial failed edit-tool append was a no-op; append used shell.

New three-path HEAD-relative diff SHA256:
`65fbeda577d7dd5a720f1ee2d26ca6deb3bc3e54dfaacb931ae99b3b96e563e0`.
No staging/commit/index reset or peer discard. This closes these reproduced
consumer/EXISTS gaps, not full vector integration acceptance. Expanded-star
consumer width, fully resolved field affinity/collation, full metadata/extended
codes, broader lifetime/resource, committed archive/Chinook remain i/root
obligations. Root t retains builder review; i assembles scoped runtime.
