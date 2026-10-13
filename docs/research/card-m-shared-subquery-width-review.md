# CURRENT m shared-subquery technical decision

For root / [[card:card-i]] integration, from [[card:card-m-f-k]]. This is a
**bounded working-source recommendation, not integrated acceptance**. No runtime
expansion, staging, commit, index reset or shared ownership transfer in this update.
Root t retains builder review; original i executor assembles the scoped runtime.
[Historical red and repair provenance](card-m-shared-subquery-width-review-provenance.md)
is retained separately and is not the current INCLUDE/EXCLUDE authority.

## Exact current candidate

HEAD `ca4fd96c2ab4675d6a2ebd231b80770eef79899c`.
`git diff HEAD -- src/internal/resolve.ts src/internal/select-program.ts src/internal/vdbe.ts`
SHA256 **`65fbeda577d7dd5a720f1ee2d26ca6deb3bc3e54dfaacb931ae99b3b96e563e0`**.
Current HEAD→work additions/deletions: **resolve13/3, select-program4/3,
vdbe162/15**. Runtime diff unchanged since the final green/refactor checks;
vdbe144/11 was the historical red candidate, not current. Index count remains
**3081 staged paths**; do not assemble index→working as the runtime patch.

| File | HEAD SHA256 | Working SHA256 |
|---|---|---|
| src/internal/resolve.ts | 52717ba415f8be2a4bdd50b728b57fb2b8394b5ebd31fac0b36e77458d92d709 | 3a21890cacd94c5a20e697745ace7635feae0122ebeaf4c5393accabd9195219 |
| src/internal/select-program.ts | 7bcae5ec3e924d9b8bcf968314711511a70dc32f5aa9d67b2bf660d89b372219 | 0204cf305c6435c930639bd8d795871b319a9f68663aef1c701af352b7e53a5a |
| src/internal/vdbe.ts | f4c20f20e95bff46b1fb516d3142e9b03a9be730c3230d047497e77b057b37aa | 78c5c2518b61a9767976ef5e4d1674cecfd7f5d9f77a6cdaa7ee4feddf11c738 |

## Current INCLUDE/EXCLUDE recommendation

Hunk ranges below are **current `git diff HEAD` headers**, not the historical red
headers. Mixed hunks require scoped assembly: INCLUDE does not authorize staging
an entire shared file or imply excluded lines can simply be deleted independently.

### INCLUDE — approved bounded subquery corrections

- vdbe `@@ -59,9 +60,14`: INCLUDE `expressionVectorWidth` scalar-default1 / SELECT
  or literal-vector width helper. Register affinity/collation carrier additions
  remain conditional on resolved semantic provenance (below).
- vdbe `@@ -2308,7 +2336,50`: INCLUDE recognition of SELECT-vector operands on
  either/both sides, width equality guard **before child emission**, and one child
  emission producing contiguous registers. EXCLUDE unconditional approval of the
  same hunk's reparsed field-affinity/collation carrier and independent vector
  comparison/ElseEq machinery; i owns the latter review.
- vdbe `@@ -2569,7 +2640,7`, `@@ -2666,7 +2737,7`,
  `@@ -3704,14 +3783,18`: INCLUDE scalar compiler owner `linkedPlan` /
  `expressionBinding` handoff, linked scalar resolution, and binding of result
  and WHERE expressions at their lowering owner. This repairs correlated
  no-FROM wide EXISTS rather than special-casing SQL text.
- vdbe `@@ -3742,11 +3825,54`: INCLUDE destination/control portions of
  `compileWideSubquery`: one-register INTEGER0/SRT_Exists regardless of selected
  width; N-register NULL-initialized SRT_Mem; linked local/outer binding and
  no-FROM child handoff; scalar first-row/LIMIT1 exit; `plan.correlated` suppresses
  Once, and IN LHS SELECT uses `compileLeft` outside RHS producer Once.
  Current working lines3838–3846 and3847–3869 contain these approved portions.
  **Do not approve the whole helper**: width/semantic derivation and generic
  fallback limitations below remain live.
- vdbe `@@ -2709,6 +2781,13` and `@@ -6313,6 +6439,7`, plus join-emitter entry
  within `@@ -3742,11 +3825,54`: INCLUDE corrected SELECT-vector-IN dispatch and
  passing the enclosing linked emitter as `compileLeft`. Existing reliance on
  syntactic child result length remains excluded from general width acceptance.
- INCLUDE permanent bounded public regressions
  `test/conformance/row-vector/subquery-consumers.test.mjs` with corrected runtime.

These recommendations match pinned expr.c `codeVectorCompare` /
`exprVectorRegister` (~623–780): width check precedes child generation; SELECT
children execute once, field consumption uses regSelect+i and the original field
semantic expression. `sqlite3CodeSubselect` (~3841–3988) uses nExpr NULL Mem
versus one INTEGER0 Exists, EP_VarSelect/Once, and first-row LIMIT. select.c
`selectInnerLoop` SRT_Mem/SRT_Set (~1384–1443) copies/inserts contiguous fields.
Monotonic builder allocation keeps results available for immediate field consumers;
this is not complete lifetime/resource proof for every composition.

### CONDITIONAL INCLUDE — Mem/Set builder, pending t

select-program `@@ -1,9 +1,10` and `@@ -76,7 +77,7`: m approves the **contract**
(width defaults1, Mem contiguous field copies, Set per-field affinity then count
field insertion). Recommendation remains **conditional on root t builder review**,
not final whole-hunk integration approval. Validate width and affinity-vector
consistency before publishing/emitting invalid destinations; public prepare must
not leak RangeError. No fresh builder implementation added by m.

### EXCLUDE from unconditional approval — current unresolved semantic owners

**Yes, the original resolve expected-width hunks still need correction.** They
are unchanged since red:
`@@ -268,7 +268,16`, `@@ -283,7 +292,7`, `@@ -470,7 +479,7`,
`@@ -498,6 +507,7`. INCLUDE their intent to validate expanded RHS results;
EXCLUDE these hunks as a complete context-sensitive width solution. `reductionWidth`
still reads SELECT syntactic result.length (star may expand wider); scalar child
walking uses the child's own syntactic width instead of its consumer; EXISTS is
checked against syntactic projection count though it consumes no projection
width. Expanded/star width, scalar default1, vector-N and EXISTS contexts must
be distinguished at the semantic owner, not globally relaxed.

Current vdbe exclusions:
- `@@ -59,9 +60,14`, `@@ -2308,7 +2336,50`,
  `@@ -3742,11 +3825,54`, `@@ -7377,7 +7505,7`,
  `@@ -7397,7 +7525,7`: EXCLUDE general semantic-affinity/collation acceptance.
  Comparison vectorOperand reparses child fields; helper lines3835–3837 derive
  fields/affinities from unbound reductions. Original resolved field descriptors
  must drive comparison semantics; value registers cannot supply missing column
  provenance. Register carrier support alone does not prove correct production.
- Dispatch/helper portions of `@@ -2709,6 +2781,13`,
  `@@ -3742,11 +3825,54`, `@@ -6313,6 +6439,7`: EXCLUDE expanded-star/general
  consumer-width acceptance. Syntactic `result.length` still chooses routes and
  SELECT-vector LHS N. Helper RHS uses expanded results when plan exists, but
  LHS/pre-dispatch width is not generally expanded. `compileLeft` handoff is
  approved; plan-less recursive fallback is not full correlated/nested admission
  proof. Missing linkage must not silently authorize Once on correlated work.
- OFFSET lowering within helper line3853 still uses an unbound reduction; linked
  no-FROM result/WHERE repair is not a blanket binding fix for every child clause.
  Compound/aggregate/sorter/limit lifetime/control breadth remains i/root work.

### OUTSIDE m approval — preserve for i/t review, not discard

All remaining vdbe hunks: `@@ -51,6 +51,7`, `@@ -70,6 +76,7`,
`@@ -102,6 +109,7`, `@@ -133,12 +141,12`, `@@ -1985,6 +1993,7`,
`@@ -2055,6 +2064,7`, `@@ -2222,6 +2232,7`, `@@ -2262,6 +2273,23`,
`@@ -2460,7 +2531,7`, `@@ -2696,6 +2767,7`, `@@ -3040,7 +3119,7`,
`@@ -5834,7 +5960,7`, `@@ -5849,7 +5975,7`, `@@ -6055,7 +6181,7`,
`@@ -6487,6 +6614,7`, `@@ -7511,6 +7639,7`, `@@ -7785,7 +7914,7`,
`@@ -7864,6 +7993,23`, `@@ -8074,6 +8220,7`.
These cover vector production/traversal/binding, row misuse, comparisons/runtime
ElseEq and IN scan/encoding machinery. EXCLUDE from **m's approval**, not from
the workspace or a correctly reviewed i integration. Mixed comparison/carrier
hunks above likewise need i's semantic review. Preserve peer STRICT/STAT4/bitwise
and all staged content.

## Evidence and final disposition

Fresh accepted refactor gate proc-894f4a44ced1: typecheck;16/16 vector
consumer/lifecycle/structure and aggregate composition tests; public123/123 matches,
zero credit; diff hygiene. Runtime hash unchanged on this update, so no redundant
rerun. Pinned source-ID-asserted oracle independently returned INTEGER0 for empty
wide EXISTS and INTEGER1 for two SELECT-vector equality and IN. Permanent public
Fetch tests pass across all encodings with reset/finalize, typed outputs/names,
empty/FIRST-row/LIMIT0 and correlated EXISTS transitions. This is working evidence,
not committed archive/release acceptance or full metadata/error/lifetime proof.

**Final: INCLUDE the bounded destination/control/caller repairs above in i's
scoped candidate; CONDITIONAL Mem/Set on t; EXCLUDE unchanged resolve width and
unresolved semantic provenance from unconditional acceptance. Whole three-file
patch is NOT approved for integration as-is.** Remaining i metadata/extended-code,
resource/lifetime, committed archive and Chinook obligations are not waived.
