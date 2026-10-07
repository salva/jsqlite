# Bounded JSON ownership disposition — [[card:card-r-f]] to root / [[card:card-s-g]]

Inventory only, 2026-10-07. No tests, source edits, staging, reset or commit. This is not skipscan/SELECT acceptance or a broad JSON signoff. HEAD observed `0947820269571354384fc2db20549db08a265576`.

## Exact input qualification

Current integration entrypoint: `docs/research/card-s-g/INTEGRATION.md`, SHA256 `b170978670b692b01cab9c4d98de1464fdb45a0b4fab11366444947a7ccf2ea6`.
Read b224 proposal (`81b74de8e74e16291793dbb35c46f38820d26e28c569d7905f077b9e8b37f129`), vdbe-review (`6533b68a8c6a81eab919c9efbde0e14dff055940d2e4590d81d5923b974fe0a0`), shared-docs-review (`7839cfd7dd778d78f632d8689e50f1723be6c9b307a79116e706243bfd2e6647`) and ownership/current-inventory (`a3cbd473a353d42eb4a09ed27846f780e8864a77dd572fab0baf3c5509241f2b`). The inventory explicitly is a snapshot, not authorship authority; current guide/map hashes differ from its earlier snapshot.

**Important exact-patch mismatch:** the named runtime-complement.patch currently hashes `77adaebb3534523a7f96bb040971889280e0fd128cc1e577d7ee24bfa29d4262`, not requested `26812e9cf56eb4c9375a067302df32f8f7a8a3c02f95ddd8b210c8d40c0269cb`. It consists of the exact requested byte prefix (SHA256 `26812e9c…`) followed by one where-plan `@@ -1432,9 +1432,9 @@` rowid-order hunk. The exact requested prefix ends before `diff --git a/src/internal/where-plan.ts`. Its VDBE section is byte-identical to b224/vdbe-review.patch. This is concrete identification, not permission for the extra suffix; root/s should reconcile the artifact/header before using a hash-bound delivery. No patch file modified here.

## Explicit hunk decisions

1. **EXCLUDE from the joint implementation commit all staged JSON/FunctionContext reversals.** Actual staged VDBE hunks `-1574,11 +1574,6` (deletes runAsyncFunctionContext), the evaluateFunction json_pretty hunk (replaces async-only guard with obsolete synchronous call), and `-7474,10 +7469,7` Function/PureFunc hunk (removes awaited context, private reservations and checkpoint/control plumbing) contradict accepted R1/R2/R2a. Preserve their index bytes until root assembles its scoped commit; exclusion is not authorization to reset the peer index.

2. **INCLUDE unchanged accepted JSON/FunctionContext baseline by inheritance, not as new s-g edits.** Current worktree contains runAsyncFunctionContext at line1579, async-only guard at7031, prettyControl/awaited publication at7534–7535. Exact requested complement/b224 VDBE has **zero changed JSON/jsonPretty/FunctionContext lines**. Its 29 hunks (imports/op types, inner/table SELECT producers/WhereEnd, binary-expression bitwise branch at7072, IndexPrefixNext/seek machinery at7350/7396) therefore need **no r-f correction or JSON ownership veto**. Their positive SELECT/bitwise/skipscan technical inclusion is deferred to root/t and actual owners; r-f does not approve those algorithms from mixed-suite green. No change to accepted JSON tables, shared Table identity, RIGHT/FULL, Mem/BLOB/UTF8 metadata asserted or authorized.

3. **EXCLUDE actual staged shared-document JSON reversals:** TRANSLATION `-489,15 +489,8` strips TEXT/TEXTJ/TEXT5, threshold classification, retained-state reservations and async Function claims; SOURCE_MAP `-209,15 +209,8` deletes producer/consumer/control mapping and correction tests; API `-375,12 +375,6` deletes accepted private/work/cancel/deadline/cleanup contract; audit `-1003,14 +1003,7` deletes R1/R2/R2a correction status. Retain HEAD/current JSON paragraphs and evidence links. These deletions are not part of b224 shared-docs-review and must not enter a blanket mixed-index commit.

4. **EXCLUDE staged json.ts predecessor and deletion/reversion of accepted evidence/tests.** Current json.ts and correction test/README are byte-identical to accepted R2a `f1eb053bf86f36e8de114f9b24d3842aaa97c128`. Index json.ts differs; correction test is absent in index, and correction capture/cases/native have staged deletion despite unchanged restored worktree/HEAD bytes. Preserve accepted files by scoped tree inheritance, not by committing deletion or copying a shared snapshot. No implementation correction needed in current JSON worktree.

5. **All 11 b224 shared-docs-review hunks: INCLUDE only in the sense of no JSON overlap; defer positive non-JSON ownership to root/s/t.** Exact locations: SOURCE_MAP137/551/807, TRANSLATION380/745/957/1308, API445, audit684/4635/4933 (11 actual hunks). They add/adjust WHERE/OR/null-consumer/skipscan contracts and do not change the accepted JSON section or delete r-f evidence. No r-f edits are authorized by those hunks. Root must stage precisely reviewed non-JSON deltas against HEAD, not consume current staged JSON deletions. No blanket shared-doc approval.

## Source and test basis (not a new rerun)

Re-read pinned `json.c:jsonPrettyFunc`4620ff (parse/NULL before indent conversion, render, JsonString result and parse cleanup) and `vdbe.c:OP_Function`8850ff (context invocation, output/error ownership before publication, size/error branches). TS async context is the accepted browser cooperative adaptation of that ownership, not a synchronous callback substitution. Current encoded shared parser/TEXT5 classifier checkpoint behavior remains the accepted R2a source-derived path.

Existing accepted evidence: [status v26](record:///status.md?card=card-r-f&v=26) repair and [research README](README.md); subsequent refactor 53/53 public suites, standalone typecheck and byte checks recorded in current status. Native original14/correction72 companions source-ID pinned; public controls distinguish scanner/classifier from preflight and verify private/work/output/error/reset/finalize. No native or test credit newly earned here; mixed s-g225 green is not the basis of these decisions.

## Current byte identities

| Path | Worktree SHA256 | Index SHA256 |
|---|---|---|
| src/internal/json.ts | 467f183c86d5fda72f33df845e6db6bd04ba17a5e7503a9037054edbe5d1a183 | c7aa8ddf8f05899010219f4a46ee8362151fa230eee1d0d539815d0056f36394 |
| src/internal/vdbe.ts | 8fc7f8769cffe5952f0fe5c0a35d2359131cdb2f0f56e2531da1404e5f00b24b | 6928ad8bd2ebe39cdebf820ffe291dc8ec2b7d64d7d4b5075480da9aeba88c45 |
| docs/TRANSLATION.md | 068ca67ee620933ea2ecb75ed9c7e695f691736dc6ac9c171e1c4b1483ad72f2 | b61b4cb9869c8aeeb16bddf22dbc5aded83d98c0ffe36c625424e72877268a7e |
| docs/SQLITE_SOURCE_MAP.md | f98a062f7443ea87fabe28e84af990d0ac7c79f5c8ace3e78c2bbd9e67b0c64a | 3132a12d58995e850d32576161e429036c865fb398eaf7cf32b852d9b9052328 |
| docs/api.md | b4b564dd690a932962ff560d2b2a8634295258f67ece22bf59deedb2c5d1f741 | 8431dfd7e9163919a04b86c74efa3b05933e5341d88d20988c12939f02853357 |
| audit | fcc074135ce53b37d68dda8db0a478a41899d36448d0f032d18f7aa7d9729b3e | 881e2085a9f19954639706ee7327c842cd45dbf33759a8acc2871f67df9ac234 |
| correction test | 454af1312dc024234a3730a5450e94215ca75254b0a843096375299d7dc09f5e | absent |
| r-f README | cd7f363753986170f6c5854c1da540fd2ce331d2e0a15aa30ff0d5b16a46a852 | d12027d234e386807c0258fe5a5d7306aa6752a19aac063420b48ad21815eeca |

Capture script SHA7353606cac4af8c339d76e81ffd0cc0878986ff908dfedc2ebfcaf620d81053d; cases850cb95bc9a398b2d01d4a344915921f33284ea7691e66ad885b79b783dec7aa; nativebc65e4bb703f4fb480a82710476d00bb5f6c29b3b47a590d8475f3fdc45c60d7. Each current worktree equals HEAD. Index SHA observed `bf51fcccb6ddfb5b12d6d6ed5296c355d64297ca793f4911bf3125836d960e8f`. Read-only commands proc-8b3158dd3304/b2c676647cdd/486ce344e9b3/6e8dbe1d4001/0dd656530aff/85497e802b2b retain input identification and actual staged reversal evidence.

Only this additive r-f evidence document and card status authored. Root/s execute scoped joint reviewed commit and fresh committed MAIN gates after remaining owner decisions; no overlapping source repair requested by r-f.
