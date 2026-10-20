# RIGHT/FULL source identity and unmatched-drain proposal

**Draft for component and system review; no new runtime admission.** This supplements
[multi-source SELECT](multi-source-select.md), not a second evaluator. Scope is the
three remaining families in root status revision190: recursive retained inputs,
WITHOUT ROWID TEXT-PK inputs, and native-legal uncorrelated physical/JSON inputs.
The broad SPEC remains unchanged. Priority is implementation order, not exclusion
or a beta-completion quota.

## Decision and delivery boundary

Implement one small, source-owned *match-key emission contract* at the existing
`compileInnerTableSelect`/per-barrier `rightStates` owner. Keep its typed ephemeral
match set and existing source-order interior subroutine. Do not build a universal
row-store, source runtime, Cartesian buffer, alternate join evaluator, or duplicate
recursive producer. Identity is a property of the positioned source, not its SQL
spelling, projected values, current scan ordinal, or join equality expression.

Recommended order, routed by Planner through [[card:card-k-e]] under
[[card:card-k]] (or one precisely scoped successor if that owner is closed):

1. Retained recursive ordinary joined consumers, cooperating with [[card:card-n]].
   First land physical RHS (the actual lead), then recursive RHS and repeated
   readers only after identity/lifetime discriminators pass. No WR/JSON work is a
   prerequisite for the first increment.
2. WITHOUT ROWID RHS keys, cooperating with [[card:card-s]]. Reuse primary-layout
   column access and KeyInfo; do not invent a TEXT-only identity algorithm.
3. Uncorrelated JSON RHS, cooperating with [[card:card-r]]. This additionally
   needs module loop selection and register binding on drain. Defer this admission
   until those dependencies are implemented; merely relaxing its front gate is
   incorrect. Correlated/reverse-dependent JSON remains an honest separate gate.

All three remain implementation gaps, not browser necessities. None is declared
mandatory before beta here. Planner owns scheduling and beta disposition. No
runtime mutation is part of this architecture delivery.

## Inspected input and source ownership

Pinned source: SQLite **3.53.4**, fossil checkin
`bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`,
from `reference/sqlite/manifest.json`. Paths below are inside
`reference/sqlite/sqlite-src-3530400/`.

| Native owner/branch | Existing TS owner and required delta |
|---|---|
| `src/where.c:sqlite3WhereBegin` around7393–7425 allocates `WhereRightJoin` per level; HasRowid chooses one BINARY key, else `sqlite3PrimaryKeyIndex`/nKeyCol/P4 KeyInfo; disables covering-only and order satisfaction | `vdbe.ts:compileInnerTableSelect` has per-barrier rightStates, but fixed one-field BINARY keys and WR prepare rejection. Allocate key width/KeyInfo from the resolved RHS declaration, retaining conservative sorting. |
| `src/wherecode.c` around2738–2798 records RHS key after ON, before outer WHERE and downstream subroutine; Found only avoids duplicate insertion, **not duplicate joined output** | Current TS normal pass emits Rowid/Found/IdxInsert then BeginSubrtn. Replace only key extraction/width, keep this ordering and shared continuation. |
| `src/wherecode.c:sqlite3WhereRightJoinLoop` around2842–2958 nulls left cursors (and coroutine registers), suppresses stale index reads, selects ready non-ON residuals unless JT_LTORJ, copies RHS SrcItem with jointype0, calls WhereBegin, emits the same rowid/PK key, Found then Gosub | Current TS copies resolved RHS/remaps references and uses `rightJoinResidual`; however drain binds original RHS as a physical cursor and hardcodes Rowid/count1. Preserve source producer/binding/identity in the copied declaration. Null module registers, not nonexistent B-tree cursors. |
| `src/select.c:generateWithRecursiveQuery` around2666ff owns Queue/Current, recursive distinct, body LIMIT/OFFSET, destination; tags0484/0488 around8076ff own retained CteUse/Gosub/OpenDup reuse | `compileRecursiveCteSelect`, `prepareRecursiveSource`, `compileRecursiveJoinedSelect`, and accepted compound `recursiveInput` retain producer ownership. Do not drain Queue/Current or replay recursion. Drain the retained consumer relation. |
| `src/vdbe.c:OP_Rowid`, `OP_OpenDup`, `OP_NullRow`; `src/json.c:jsonEachCursorReset`, `jsonEachNext`, `jsonEachRowid` (iRowid0 reset, increment per row) | VM Rowid already reads private EphemeralIndexCursor identity; OpenDup shares records, not positioning/nullRow. JsonTableRewind/Next already own a separate rowIdentity register starting0. Match keys must use that register, not JSON `id`, `key`, `value`, or a B-tree Rowid. |

The accepted delivery is branch `card-n-b-compound-delivery` at
`6a0a8966224b3ed7fe1e0bcab58305631c9fa257`, tree
`1807eb1bd92b4f2fe56ae8cc0ff58f80fcc3a6be`. Shared master HEAD is
`2bcc02a34566d0c9d526254cf83693f102c006f0` with extensive peer overlays, **not**
that delivery. Relevant gates were checked in both shared source and read-only
`work:///cards/card-n-b/compound-delivery/checkout/src/internal/vdbe.ts`.
Line numbers differ by revision; symbols/branches above identify the contract.
The new proposal does not adopt overlays or inherit their test acceptance.

Current guide admits represented repeated/mixed rowid barriers and rejects WR
tracking. The source-map's “one RIGHT/FULL barrier” paragraph is stale relative to
that guide; it must not become a new singleton requirement. The mutable audit's
historical singleton/provenance assertions are revision-bound; current WR/JSON/
recursive boundaries agree with the retained batch, not universal failures.

## Exact current gates and why one gate removal is insufficient

* `compileRecursiveJoinedSelect` declines any `joinFromLeft.right` before
  resolution/emission. The actual lead is `q RIGHT/FULL JOIN u`: **physical u is
  the tracked RHS**. q needs safe left NullRow/readers, not a fabricated physical
  identity. Reversed `u RIGHT/FULL JOIN q` additionally exercises retained RHS
  identity and drain. Keep compound/window/additional-declaration/producer-term
  boundaries separate. Accepted recursive-compound support is not this support.
* `compileInnerTableSelect` explicitly rejects a WITHOUT ROWID RHS before storage
  initialization. Existing match allocation/insertion/drain remain width1 Rowid.
  Removing the guard alone produces incorrect NULL keys or invalid reads.
* Mixed JSON dispatch rejects `jsonItem.joinFromLeft.right` (“this mixed JSON
  join is not implemented”). Canonical mixed resolution and the ordinary shared
  WHERE producer exist, but RIGHT/FULL `planWhere` uses a statement-wide fallback;
  do not assume it supplies a selected json-module loop. Shared drain also binds
  copied RHS to a physical cursor and emits Rowid. Both producer selection and
  drain location must change before admitting the native-legal constant case.
* Existing ordinary null-left drain emits NullRow for preceding cursor handles;
  a register-backed module on that prefix needs its entire visible/hidden row
  and rowid nulled. This is a source-location contract, not a JSON-value patch.

## Minimal lowering contract

At prepare, derive a small immutable descriptor from each resolved RHS:

* `keyCount`, `keyInfo`, and ordered semantic key columns (or implicit rowid).
* A key emitter taking the **positioned source binding**, cursor mapping, ops and
  register allocator. It emits into one contiguous key register range. The same
  descriptor is used for matched insertion and unmatched membership.
* The existing source binding/producer state used for rewind/next/column access
  and NULL extension must survive the RHS clone/remap. It may use existing owner
  callbacks/maps; do not introduce a new execution abstraction just for this.

Representations:

1. Physical rowid: existing Rowid, one INTEGER/BINARY field.
2. Retained recursive input: existing private Rowid, one INTEGER/BINARY field,
   scoped to that retained relation and execution. It is not an exposed physical
   table rowid and need not numerically equal native's private rowid.
3. WITHOUT ROWID: primary index **nKeyCol**, `aiColumn` order, declared key
   collations/sort flags, encoding. Read semantic columns through existing primary
   layout access; exclude appended payload/covering fields. No string serialization,
   JS Set equality, row-content hash, implicit rowid or unrelated UNIQUE index.
4. JSON: Copy module-owned rowIdentity into one INTEGER/BINARY field after
   Rewind/Next positioned it. The drain reuses identical constant/bound arguments
   and root/recursive mode. Independent reads must reset identity to0 and enumerate
   the same rows. Reject dependencies on nulled/future sources before execution;
   lexical FROM membership alone is not readiness. A JSON node's `id` is not xRowid.

No extra identity field is needed inside a per-barrier match set: its descriptor
is already scoped to one resolved RHS. Never share a match set across barriers or
aliases. Descriptor identity follows resolved SrcItem identity, not alias strings.

### Retained identity proof and boundary

`private-state.ts:EphemeralIndexCursor.insert` stores an Entry.sequence then
increments shared.sequence after successful insertion; `rowid()` returns
sequence+1, not #at+1. Equal-valued inserted records therefore retain different
identities. `duplicate()` shares entries/reference count but creates handle-local
#at/deleted/nullRow state; close releases records/budget only at the last reader.
`first` and `next` position independently and clear nullRow appropriately. VM
Rowid checks private nullRow before asking for identity. This is enough to reuse
rowid-like match semantics **only for a completed retained consumer relation**.

The recursive producer must complete its fill before matching/drain; no clear,
replacement, deletion or further enqueue into that retained relation between
passes. `clear` resets sequence and invalidates positions, so clearing/refilling
between passes is forbidden. Sorting does not change Entry.sequence, but the
consumer should retain its existing insertion order; no new ordering claim.
OpenDup readers can be rewound for drain without replaying the producer. Existing
recursive queue mutations are independent of the sealed consumer relation.
Test last-reader close, nullRow independence and duplicate-value identities;
static inspection is not public behavioral acceptance.

This preserves the accepted bounded retained materialization tradeoff: requested
producer finishes before its consumer rows. It does not promise streaming native
work/allocation parity or claim browser necessity. Do not add blanket
materialization for physical/JSON inputs.

### Control, lifetime and errors

Matched pass: position RHS → test ready ON/USING → record key once → mark LEFT hit
where applicable → enter existing interior → ready WHERE/downstream/projection.
A Found key must still emit all duplicate matching combinations. FULL's unmatched
left pass must not manufacture a matched RHS identity from a NULL-row cursor.

Drain: after normal source-order pass, NULL every preceding source using its
actual storage location (including selected indexes/register payloads), preserve
JT_LTORJ residual rules, rewind original RHS relation with no ON/USING join flags,
position row → compute same key → Found skips matched row → otherwise Gosub same
interior. A subscan's empty/next/return must target its own continue/end labels.
Do not null or reinitialize a different alias reader. Preserve return-register
initialization, repeated barrier ordering and subroutine jump verification.

Reset creates new execution state, producer fills and match sets; rebinding cannot
reuse old identity membership. Work/checkpoints, sticky first error, deadline and
cancel remain VM/private-state owners. Match keys and retained records use **one
execution-wide PrivateStateByteBudget**; repeated readers share records, not a
second byte charge for each payload, while each match set is separately charged.
Abort during insert/fill/drain must unwind all owned handles and preserve the
actual error. No independent retry/replay or cancellation redesign is proposed.

## Tests-first handoff and native discriminator contract

Retained batch evidence, not a fresh run: [[card:card-w]]
[status148](record:///status.md?card=card-w&v=148), primary
`work:///cards/card-w/recursive-compound-integration/leads-retained/{native,public}.json`.
It records15 shapes×3:27match/18truthful unsupported with recovery. Exact remaining
leads (run both RIGHT and FULL variants with their existing ORDER clauses):

```sql
WITH RECURSIVE q(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<3)
SELECT q.x,u.x FROM q RIGHT JOIN u ON q.x=u.x ORDER BY u.x;
SELECT a.k,b.k FROM wr_a a RIGHT JOIN wr_b b ON a.k=b.k ORDER BY b.k,a.k;
SELECT t.x,j.value FROM t RIGHT JOIN json_each('[2,4]') j
ON t.x=j.value ORDER BY j.key;
```

Preserve complete original fixtures (`wr_a`, `wr_b`, `jt` included), pinned binary
identity and independently obtained native results. W148 explicitly reports a
failed incomplete fresh-fixture attempt; do not regenerate against a partial
schema and call its missing-table diagnostics correct gates.

Before runtime edits, consumer must add a bounded machine manifest/native capture
beside the existing relational fixtures, with exact-source-span provenance as in
the 47-case manifest. These are **synthesized branch discriminators**, unless the
upstream test assertion and fixture really match. No new native capture or runtime
pass is claimed by this proposal. Required discriminator rows:

| ID | Required distinction / failure prevented |
|---|---|
| recursive-left-leads | Exact two existing q→physical leads; include empty q/u and all-no-match. Confirms left null extension, not a presumed recursive-RHS problem. |
| recursive-rhs-duplicates | Reverse sources; retained q emits duplicate identical x values. Match one value against multiple left rows and leave another duplicated value unmatched. Distinct retained identities must drain each unmatched row once without suppressing duplicate matched output. |
| recursive-reader-lifetime | Two aliases of one retained q, one on nullable prefix, RHS drain after NullRow; independent positions/null flags; empty/first/next/reset and early close. One producer, no recursion replay. |
| wr-text-pk | Existing wr_a/wr_b leads; nonnumeric TEXT keys, NOCASE and trailing-space/RTRIM declared PK controls across all encodings. ON match rejected by WHERE must still suppress unmatched drain. |
| wr-composite | Composite PK in non-table-column order, mixed INTEGER/REAL/TEXT/BLOB values, DESC key component, payload columns and selected index. Identity is ordered PK, not projected or storage-tail fields. |
| json-rowid | Constant arrays with repeated equal values, duplicate object labels/values and nested tree/root controls; compare j.rowid separately from j.id/j.key. Empty left and empty JSON; stable identity on rescan. |
| json-binding-readiness | Bound constant JSON changes after reset; constant root; preceding module nulled on a later barrier. Native diagnostic for illegal reverse/correlated case retained; do not relabel rejection as support. |
| shared-control | ON TRUE/FALSE/NULL, WHERE rejecting all hits, downstream LEFT and repeated RIGHT/FULL, USING/NATURAL bare/qualified star and metadata; existing DISTINCT/ORDER/LIMIT/OFFSET destinations. |
| resource-lifetime | Bounded cancel/deadline/work/private failures during fill, matching and drain; exact one-budget accounting; reset/rebind recovery, finalize/close, two sessions with independent ownership. |

Compare public typed cells, five column metadata fields and two reset executions
in UTF-8/UTF-16le/UTF-16be, retaining INTEGER/REAL, NULL/empty TEXT/BLOB and error
phase/code/message. Use explicit ORDER for asserted order; do not assert unspecified
planner order. LIMIT0 must still resolve invalid arms/columns without runtime
producer work. Internal tests separately assert Found/IdxInsert key widths,
shared descriptor at both sites, no private-cursor OpenRead/rootPage0, no repeated
producer fill, and no rowid call on a NULL or unpositioned ephemeral cursor.
Rerun existing inner/left/right-full, recursive-reader/compound, WR access and
mixed-module regressions. Selected passes are not compatibility or beta credit.

## Integration, current-document obligations and alternatives

Only this proposal is newly authored here. Shared master guide/source-map/API/audit
and production have overlapping peer staging; do not stage or overwrite them for
this draft. [[card:card-g]] [status2](record:///status.md?card=card-g&v=2) preserves
that ownership conflict and exact delivery/index evidence. Planner must designate
integration ownership; downstream consumer should use the already synchronized
ordinary delivery, not a moved master ref or a duplicate delivery reconstruction.

Required owner-cleared current-document edits with implementation:

* TRANSLATION “WHERE, joins and physical indexes”: keep current repeated/mixed
  rowid guarantee, link this proposal, describe implemented key families and exact
  remaining gates only after public evidence. Retained reader tradeoff stays explicit.
* SQLITE_SOURCE_MAP WHERE mapping: replace stale “one RIGHT/FULL barrier” with
  “represented per-barrier rowid RIGHT/FULL; WR/module/recursive extension gates
  remain input-specific”; map the shared key descriptor and both emission sites
  to where.c/wherecode.c above, linking concrete native/public tests rather than
  a test-count diary. The singleton assertion is not current authority meanwhile.
* api.md and audit: preserve temporary unsupported boundaries until the relevant
  slice is accepted; reconcile the mutable current findings, not historical labels.

Rejected alternatives: swapping RIGHT into LEFT breaks SQL-order barriers and
continuation; value-based dedup loses duplicate RHS rows; fresh scan ordinals fail
under different access paths; replaying recursive producers changes lifetime/work;
materializing JSON solely to fake a rowid adds unnecessary memory and bypasses its
source owner. A giant source abstraction is unnecessary: existing bindings,
producer callbacks and per-level rightStates can carry this small contract.
Bloom remains omitted by the existing bounded implementation; exact typed Found
is authoritative, with possible extra work, not probabilistic membership. This
proposal adds no new algorithm substitution or public optimizer/work guarantee.

## Review gates

Component review must check key descriptor ownership at **both** consumers,
recursive lifetime proof versus actual VM branches, WR KeyInfo/layout order,
JSON dependency/loop/binding prerequisites and the native fixture plan. System
review must check preservation of accepted delivery and existing compound,
metadata/resource/error guarantees plus coherent current-document integration.
Both are required again for this draft. Neither the old provenance reviews nor
W148's bounded acceptance approves this new design or any runtime admission.
