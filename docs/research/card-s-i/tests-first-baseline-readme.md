# WR Case5 test-first boundary — [[card:card-s-i-a]]

**Not runtime delivery.** Parent [[card:card-s-i]] must approve/refine contracts before consuming lowering. The active selected-plan/opcode assertions deliberately expose the existing WR admission gap; public results on ordinary fallback do not prove Case5 execution.

## Incremental upstream / TS / assertion mapping

| Pinned owner | Current TS owner / missing seam | Coverage |
|---|---|---|
| `where.c:whereLoopAddOr` | `where-plan.ts:btreeLoops` OR graph, three-slot costs and frontier reused; WR exclusion remains | immutable selected WR handoff (red) |
| `whereexpr.c:exprAnalyzeOrTerm`, dependency masks | existing clause-owned `orInfo`, `orRuntimeArmClause`, `branchConsumedTerms`; retain residual readiness | nested and inner public companions; exhaustive dependencies pending |
| `wherecode.c` Case5 | `vdbe.ts` ordinary and represented-inner selected continuations currently Rowid/RowSetTest only | three-arm Found/IdxInsert first/final bypass assertions (red) |
| `wherecode.c` WR primary extraction, `expr.c:sqlite3ExprCodeGetColumnOfTable`, WhereEnd | `schema.ts` physical fields and `btree.ts` record positioning; primary-key order is not declaration order; common covering must exclude WR primary index | composite `(k DESC,n)` versus declaration `(n,k,...)`, compact `wa(a,k)` suffix, Unicode/NOCASE, REAL and no-rowid public companions |
| `vdbe.c` OpenEphemeral/Found/MakeRecord/IdxInsert → `btree.c` index comparison | `comparison.ts:KeyInfo`, `record.ts`, `private-state.ts:EphemeralIndexCursor`; reusable descriptors/comparison and accounting, but no existing named Case5 opcode integration | pinned native opcode checks pass; TS checks red |
| `vdbeaux.c` cleanup and `vdbeapi.c` reset | VM cursor ownership + private byte budget, reset/finalize owners; no WR union private state yet | public repeated reset passes only on fallback; resource/cancel/deadline collisions remain pending |

This is an incremental map, not a claim that all producer/consumer branches have been exhaustively reviewed. Full balancing, cursor restore and error-path comparison remain required before runtime work; see [owner comparison](owner-comparison.md). Current owning guide/audit correctly defer WR union and are not rewritten to imply success.

## Target contracts for parent decision

Parent [[card:card-s-i]] approved targets 1–4 subject to full pinned branch comparison; these are not implemented-runtime claims. Array algorithm reuse (former contract 5) is not approved.

1. Admit selected WR multi-or for ordinary single-source, represented INNER, and simple persistent scalar producers that already enter shared-builder WHERE lowering. Preserve forced-index and NOT INDEXED routes; retain nullable outer/RIGHT/FULL conservative fallback. No aggregate expansion. Preserve graph/cost ordering, frontier and invocation-local consumed-term/residual owners; physical branches are replanned, not stored in the immutable candidate.
2. Allocate a statement-private ephemeral key cursor at Case5 invocation, using the primary physical descriptor's first **nKeyCol** terms (encoding, collation, direction), not the full stored row width or secondary suffix order. Open/reset it per invocation, including each represented outer row, nested union independently. Extract PK values by primary aiColumn order from the positioned table/covering secondary cursor. Native WR secondary-to-primary positioning uses Column/NotFound, not rowid DeferredSeek; the existing TS DeferredIndexSeek eagerly positions the primary cursor and must be compared for missing-key/error order before reuse. No visible rowid, synthetic integer identity, serialization-string Set, eager union tree or parallel evaluator.
3. Proposed VM operations mirror OpenEphemeral/P4KeyInfo, Found (key-register range), MakeRecord and IdxInsert. First arm omits Found; final omits insert; middle tests then inserts. Arm residual truth precedes dedup; duplicate jump skips Gosub and resumes arm continuation. Return registers/labels remain shared-builder allocated. Existing rowid RowSet path is unchanged. Common index covering excludes WR primary index even if leaves agree.
4. Key storage/copy lifetime is cursor-owned, not borrowed page/column Mem. Found comparison must use typed SQL keys without erasing REAL/INTEGER/NULL/encoding distinctions. Insertion charges entries/key bytes before publication and unwinds on failure; reset/finalize/failure release every owned cursor preserving primary error. Cancellation/deadline checkpoints must include comparison and insertion, not just physical movement.
5. Reuse `EphemeralIndexCursor` typed comparison, cell ownership and budget foundations only after caller comparison, **not its array storage algorithm**. Recommend a statement-private BLOBKEY page/cursor owner translating IndexMoveto, Insert, cell allocation/overflow, balance, clear and close transitions; immutable main storage must remain separate. This is missing implementation machinery, not a TypeScript constraint. No bounded algorithm substitution is approved or claimed. See [precise gap and branch ledger](owner-comparison.md).

## Native provenance and classifications

`capture.py` builds fixtures only in this research directory, uses the dev-only library produced by `tools/oracle/build.sh`, and asserts exact manifest source ID 3.53.4. `native.json` retains library and fixture SHA256, exact SQL, column names, typed rows, errors, EQP and full EXPLAIN. Main database remains immutable in product tests; native writes are fixture creation only.

`whereI-3.0` transcribes pinned `test/whereI.test` schema/data/SELECT and checks upstream expected ordered values `2.1 2.2 1.2`. It is one exact SQL/schema/data case per encoding, not three independent upstream cases and not adapted optimizer credit. Other cases are **supplemental authored probes** (not upstream transcriptions); root and per-case classifications retain that distinction. Native opcode boundary is independently observed, not inferred from TS results.

`or-wr-boundary.test.mjs` checks native Case5 OpenEphemeral key width, no RowSetTest, first/final bypasses; public typed results and repeated reset for every captured SQL/encoding; error for absent rowid; selected immutable owner and opcode contracts. Public row comparisons preserve INTEGER BigInt versus REAL number and NULL. Column names are captured and checked; full origin metadata/BLOB byte fidelity are not yet tested.

## Remaining matrix (not waived)

Parameter rebinding INTEGER/REAL/TEXT/NULL/BLOB and clearBindings; maxWork selected seeks/advances and no offpath movement; all collation/DESC combinations, BLOB PK and non-ASCII equality; duplicate rows within a single arm and empty first/middle/final; shared secondary common-covering and exclusion of primary common-covering; correlated scalar/inner per-outer reset; unready/factored residual terms and consumed commuted children; forced/NOT INDEXED selected-plan prohibitions; nullable and RIGHT/FULL fallback; cancellation/deadline/resource limits during key comparison/insert/cleanup, primary-error cleanup collisions; full metadata, source case expansion and independent upstream test harness. Current public fallback success is not selected WR lifecycle credit.

## Verification artifacts

`coverage.log` is the actual focused run; `hashes.txt` records immutable input/output SHA256. First capture/test run exited1 with selected WR failures (before adding exact whereI-3.0); rerun after that addition is recorded separately in status. Oracle build exited0 and profile authenticates pinned source; build profile/log copies accompany this evidence. No runtime edits, main writes, public diagnostics, eval, dependency/config changes or peer staging changes.
