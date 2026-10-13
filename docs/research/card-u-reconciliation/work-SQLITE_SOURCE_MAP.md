# SQLite source map


## Reviewed private BLOBKEY primitive mapping

- `balance_nonroot`8546–8652 BLOBKEY packing/right redistribution →
  `private-blobkey-balance.ts:partitionBlobkeyCells`, source-traced counter tests
  in private-blobkey-balance.test.mjs (unequal sizes, two/three siblings, bulk,
  empty right repair, cancellation/refund). Nonroot8410–8524 resident gathering →
  `gatherBlobkeyCells` / raw private-blobkey-cellarray.test.mjs leaf divider padding,
  interior child rewrite/overflow pointer conservation, overlapping partition
  lifetime and checkpoint refund. `private-blobkey-staging.ts` borrows staged
  descriptors for native adjacent splicing without consuming entry ownership
  (raw681-resident/two-staged fixture). Arena/page edit/rekey/dispatcher
  integration absent; charged prerequisites only, not reachable balance.
- `rebuildPage`7643–7720 → `PrivateIndexPage.rebuildCells`: pager-temp content
  snapshot for aliased cells, descending physical copy/header reset; raw interior
  alias/child and scratch cancellation/partial-fault tests in CellArray file.
  Unstaged raw seam only, not incremental editPage or balance-only substitution.
- `pageFreeArray`7795–7856 → `PrivateIndexPage.freeCellArray`: resident range
  membership, adjacent coalescing/ten-range flush, unchanged slots/count; raw
  foreign-cell and flush cancellation/refund/FAULT tests in CellArray file.
  Test-consumed prerequisite; also consumed by raw resident editCells.
- `pageInsertArray`7739–7791 / `pageFindSlot`1747ff →
  `PrivateIndexPage.insertCellArray`: freeblock-first allocation, fragments,
  gap fallback/no defrag, ppData success-only publication; raw freeblock/partial
  no-fit tests. Consumed by raw resident `editCells`, not arena balancing.
- `editPage`7860–7980 → `PrivateIndexPage.editCells`: resident prefix/tail
  removal, prefix/suffix insertion, header publication and rebuild fallback in
  one admission. Raw resident shifts and exhausted-gap fallback/4224 scratch
  peak tests. Retained staged insertion/fallback refunds scratch without entry
  refund/NEW admission; raw adjacent-stage and displaced rejection tests.
  Publication-aware pre-free retry versus post-slot-shift FAULT tests preserve
  primary error and charged staging/scratch lifetimes.
  Arena transit/count reconciliation remains absent. Module-private scheduler
  lifetime retains displaced staged bytes through all consumers, consuming
  scratch only on success; raw copy and post-recipient failure/disposal tests.
- `balance_nonroot` sibling two-pass update loop8890ff →
  `editBlobkeySiblings`: descending safe-boundary pass then ascending deferred
  pages, divider-excluding ranges; raw two/three-sibling movement and pre-edit
  cancellation/refund tests. Caller still owes parent/rekey/global admission and
  counts; this is test-consumed scheduling, not reachable balance.
- `balance_nonroot`8670–8748 page-number selection/rekey →
  `rekeyBlobkeySiblings`: retain old numbers and three-step temporary identity
  swaps without object/data ordering changes. Shuffled-number callback trace and
  each-step failure/refund tests. Raw arena `rekeySiblings` owns gate, peer save,
  map/private derived identity and post-swap FAULT; allocation/foreign lease and
  between-swaps cancellation cleanup tests. Nonroot parent integration absent.

- `copyNodeContent`8163–8211 → `PrivateIndexPage.copyNodeContent`: header/slots
  and suffix copy, metadata/free-space reinit (private hdrOffset0/no autoVacuum).
  Raw interior/right-child/gap and staged-source retry/refund tests.
- `balance_deeper`9049–9096 → raw `PrivateIndexPage.deepenInto`: copy, owned
  stage move, zero root/interior right-child; shared-accountant staged and
  pre-copy cancellation/retry fixtures. `PrivateBlobkeyPages.deepenRoot` owns
  gate/allocate/acquire/count move and primary-error cleanup; exact-capacity682
  entry conservation and allocate-vs-release failure tests. Nonroot/dispatcher
  integration remains absent.
- `balance_nonroot`8312–8340 → `selectBlobkeySiblingWindow`: logical child
  window/descending producer order including bulk edge; source-derived edge,
  middle, cancellation/duplicate/refund tests. Parent acquire/drop integration absent.
- Nonroot resident divider drop8345–8388 → module-private `balanceDivider.take`
  consuming `PrivateIndexPage` conserving drop primitive; charged full-cell copy,
  retained logical count, conservation/cancellation refund fixtures. Sole pending
  divider8335–8355 transfers charged descriptor at matching logical index;
  mismatch/cancellation/retry tests. Arena `balanceNonroot` reconciles counts.
- Nonroot8310–8388 → raw `acquireBlobkeySiblings` descending acquire/drop
  chain and right-pointer offset; unstaged parent/drop/scratch/ref and later-acquire
  primary-vs-release fixtures. Explicit staged/resident selection covers both
  pending traversal orders and non-header right pointer. Token-held arena caller owns cleanup/FAULT.
- Nonroot8830–8889 → `promoteBlobkeyDivider` representation producer; minimum
  leaf padding reparse/interior child88/overflow55/cancellation scratch fixtures.
  `publishBlobkeyDividers` consumes parent insert and sibling right-child publication.
- Nonroot8755–8770/8845 → module-private `balanceChildPointer.publish` physical
  child pointer owner; retained cell/header offset, payload preservation and
  stale-offset/prewrite cancellation/retry fixtures; consumed by arena nonroot.
- Nonroot8886 insertCell → module-private `balanceDividerInsert` consumes native
  insertCell snapshot/physical-or-staged branches without NEW admission; ordinary
  NEW policy unchanged. Raw full-parent staging/prewrite refund fixtures; arena
  logical count reconciliation is owned by `balanceNonroot`.
- Nonroot8755–8770/8830–8889 → raw `publishBlobkeyDividers` joins pointer,
  changed-count right-child transfer, promotion/conserving insert in source order;
  raw interior transfer and post-pRight leaf cancellation/refund tests. Arena
  global FAULT/count caller is `balanceNonroot` (below).
- Nonroot8245–9028 → manual arena `balanceNonroot` token-held raw-phase
  integration, synchronous count reconciliation and excess-page free; exact682
  expanded-child split and allocate-vs-release FAULT/ref cleanup fixtures.
  Two-leaf/three-interior merge fixtures exercise native nonroot8957–8983
  automatic shallow defrag/copy/count/free order; encoded child identities, not
  complete reachable interior trees in that raw fixture. The Insert suite also
  contracts three interior siblings with five6003-byte overflow separators and
  six actual leaf children, seeks all11 at capacity before/after shallow, and
  covers partial-defrag/pre-copy/post-copy-free rejection plus paired release failures (FAULT,
  primary/zero refs/disposal refund), and actual reserve admission with residual
  capacity at the measured shallow-defrag peak and one byte below. Phase-only
  budget evidence and source-derived tree, not native allocation parity; details:
  `record:///status.md?card=card-s-i-c-a-g&v=309` (historical buffer-only peak).
  Current full-defrag1613ff → `PrivateIndexPage.#defrag` admits buffer4096 +
  transient derived/capability/parse metadata1536 before copy/construction;
  pages tests cover standalone exact5632/below5631 and preconstruction/postcopy
  cancellation/refund. Shallow contraction rerun measures101040, exact/below
  and paired cleanup branches; [current accounting evidence](record:///status.md?card=card-s-i-c-a-g).
  Selected evidence, not native heap parity or complete matrix.
  Packed180 overflow growth explicitly observes initialized fresh interior sibling
  allocation and the subsequent changed-count right-child publication after parent
  pRight; all180 packed seeks pass. Complementary independently encoded interior
  1→2 expansion fixtures use six actual leaf children, local900 or overflow4992
  payloads (native local900 plus4092 tail), preserve numerical oldRight9 and each
  divider overflow pointer exactly once, and seek all11 entries at exact capacity.
  Pre-child-publication failure after allocation/rekey preserves primary over
  release errors, faults registered cursors and refunds at disposal; no rollback.
  Direct-error and elapsed-deadline callback variants assert no cleanup checkpoints;
  elapsed timing is tested at the private control seam, not VM/public timeout integration.
  Minimum-four-byte leaf dividers are reparsed to true interior extent (8859ff):
  raw promotion and independently ordered reachable trees cover manual nonroot
  redistribution and packed Insert root expansion, full-KeyInfo seeks and capacity
  conservation. Insert additionally covers owned SAVEPosition/restore after minimum
  promotion and promotion admission/post-reserve checkpoint failure: primary error,
  refund-before-release, noncancellable cleanup and terminal cursor invalidation
  (`private-blobkey-insert.test.mjs`; [bounded evidence](record:///status.md?card=card-s-i-c-a-g&v=387)).
  Parent-acquire rejection before admission retains pending bytes and permits ordinary
  retry; sibling-acquire rejection after parent admission faults the arena. Independent
  expansion budget replay covers exact/one-below residual capacity at divider snapshot
  peak, with charged producer/lease/CellArray overlap authenticated in linked evidence.
  These are source-derived private trees, not complete native INTERNAL captures.
  [Selected current evidence](record:///status.md?card=card-s-i-c-a-g&v=363).
  Unequal three-old logical5/3/4 identity
  rekey→3/5, ordered payload conservation; gather8540–8564 counter derives from
  usableSpace−nFree plus pending extents, allocated-remainder fixture. Lower
  freelist stage-source rekey and native bulk nearby1 allocation selection covered.
  Ordered reachable bulk fixtures additionally cover two-sibling left bias,
  low shuffled-freelist allocation with identity rekey, and right-edge two-of-three
  selection preserving the prior divider/page. Selected second-acquire failure
  authenticates right-to-left acquisition, primary-error cleanup and FAULT.
  [Bounded bulk evidence](record:///status.md?card=card-s-i-c-a-g&v=402).
  These manual nonroot fixtures do not admit an Insert bulk option or native
  INTERNAL parity. The overflow/peak/cursor matrix remains bounded: selected interior equal overwrite
  and unequal build/copy/clear failures,830/829 copy overlap, upward peak replay,
  and divider rejection/ref/cache retirement live in
  `test/value/private-blobkey-insert.test.mjs` (source9395–9690,9265–9380).
  [Revision-bound evidence](record:///status.md?card=card-s-i-c-a-g&v=285);
  not complete matrix acceptance. Dispatcher9130–9261 → arena `balancePath`,
  validated owned relationships + held-token deeper/nonroot loop, threshold and
  upward parent progression; expanded root/underfull child/stale path fixtures.
  Raw full parent-stage→deeper→interior nonroot fixture and empty-child shallower
  covered; partition/edit native zero-cell transitions admitted. Cursor
  `insertIndex` calls this dispatcher after staging, relinquishing its path
  leases before entry; ordered1806000-byte and unequal-size150-entry Insert
  fixtures exercise multilevel BLOBKEY propagation. Quick-balance is intKeyLeaf
  only and unreachable here. Native pFree scratch retention is represented by
  page-owned copied pending bytes across upward iterations, charged until
  consumption/disposal rather than borrowed native scratch aliases. Selected
  upward failure/peak fixtures cover this caller, not the full error matrix.
- BtreeInsert index9395ff → cursor `insertIndex` owned packed/full-KeyInfo reseek,
  signed local insert/equal overwrite plus held-token dispatcher on staging;
  original exact2 capacity and ordered850 integer root-expansion seeks pass.
  Post-balance9690ff SAVEPosition owns packed supplied key through restore;
  caller-mutation and saved-allocation-failure/INVALID/seek fixtures;576-byte
  postpublication path admission failure FAULT/refund fixture. moveToRoot5554ff
  clears stale REQUIRESEEK key before new acquisition; saved→Insert→save/restore
  regression prevents competing saved-key owners.
  No PREFORMAT/TransferRow/unknown-options admission. NEW leaf overflow uses
  held fillCell after capacity rejection;6000-byte BLOB equal overwrite and NEW
  rejection without extra pages covered. Unequal replacement builds→clear6979ff
  →local same-size or drop/insert9600ff preserving child; RTRIM6000→3→6000 exact1
  count covered, pre-clear seek acquire failure retryable; post-free first-chain
  release failure primary/FAULT/zero refs covered by Insert test. Ordered interior
  0/a/z fixture preserves actual children3/4 and seeks all entries over repeated
  long/short replacement at exact3. Ordered180 BLOB6000 coprime-permuted Insert
  reaches multi-level overflow-divider balance, seeks every key; equal overwrite
  at exact180/NEW181 rejection; unequal10/500/990/1003/4595/6000/9000-byte BLOB
  permutation seeks150 entries after multilevel balance. RTRIM6000→490 shares
  physical495 extent but old overflow requires clear/drop/insert. Overflow NEW
  reservation/cancellation boundary sweeps and held overflow replacement/root
  expansion cancellation plus reservation/acquire/allocate/release sweeps cover
  primary and disposal refunds (detailed boundaries in card status);
  page mutation pending reset precedes FAULT cursor unref. Pending cells own64
  descriptor bytes through move/transfer/consume/disposal; take overlaps old/new
  result descriptors. Full peak/error matrices owed.
- Nonroot shallower branch8957–8983 → arena `shallowRoot`: exclusive
  save/gate, balanced-child defrag/copy/count move/free and primary cleanup.
  Capacity conservation, freelist reuse, foreign lease and cancellation/FAULT
  tests; automatic nonroot selection/upward dispatch absent.

- `fillInCell`7074/local BLOBKEY branch + `insertCellFast`7428 → token-bound
  `#insertLocal`/existing `PrivateIndexPage.insertCell`, consumed by
  `insertIndexLocal` packed typed reseek owner. Nonstaging local leaf NEW and
  differing-length local equal REPLACE (Insert9618 fast same-size or drop/insert);
  conserving capacity and terminal post-drop failure tested. Interior local
  REPLACE preserves both child owners (raw divider test); overflow replacement
  and balance remain gaps.
  insufficient free space rejects before publication, not balance compatibility.
  Signed placement/empty and exact-capacity tests in private-blobkey-overwrite;
  full Insert/staging/balance remains missing ([[card:card-s-i-c-a-g]] status.md).

- `btree.c:btreeOverwriteCell/btreeOverwriteOverflowCell/btreeOverwriteContent`
  (9265–9380) → token-taking `#overwritePayload`, physical fixture wrapper
  `PrivateBlobkeyPages.overwriteCell` and narrow typed equal writer
  `PrivateBlobkeyCursor.replaceIndexEqual` (Insert's save-peers/reseek/equal
  overwrite branch): full KeyInfo packed unpack, one arena gate, temporary
  internal seek result/byte inspection (public result accounting unchanged), bounds,
  local-first changed-byte writes,
  raw sole-ref guard, nonfinal next read and release-before-advance. BLOBKEY has
  nZero0; native zero-tail/intkey branches are unadmitted. Tests:
  `test/value/private-blobkey-overwrite.test.mjs`; evidence and remaining writer/
  balance gaps: [[card:card-s-i-c-a-g]] status.md.

- Pinned `btree.c` init/find/parse/cell-size/local payload, free-space/defrag,
  ANY allocation/free/fill/clear and page-local insert/drop →
  `src/internal/private-blobkey-pages.ts`; root traced from `vdbe.c:OpenEphemeral`.
- `moveToRoot/IndexMoveto/indexCellCompare/cursorOnLastPage/accessPayload` → typed
  signed cursor, parent/child leases, raw shortcuts and rebuilt overflow cache.
- `vdbeaux.c:serialGet7` → owned scalar REAL decode in `record.ts`; Mem snapshot
  and optional private control probe preserve target ownership across suspension.
- Independent raw-format tests: `test/value/private-blobkey-{pages,cursor,seam}.test.mjs`;
  adjacent4086–4089 divider/actual-overrun coverage distinguishes minimum from
  actual-size checks. [Bounded coverage inventory](research/card-s-i/private-blobkey-owner-matrix.md),
  independent [[card:card-s-i-c-a-c]] status19. Accepted construction/page-local
  foundation only; readonly revocable inspection coverage additionally lives in
  `test/value/private-blobkey-mutation-authority.test.mjs` (including captured
  mutators, observers and fill results, whole-page descriptors/revocation and
  denied metadata/prototype/extensibility writes). btreeOverwriteContent9265ff
  requires PagerWrite before changed-byte writes; inspection reflection must not
  bypass the private mutation owner. `private-blobkey-admission.test.mjs`
  additionally maps arena-exclusive admission and btree.c708–923 packed save,
  restore and ClearCursor (signed SKIPNEXT, failure retention/no retry), implemented
  by PrivateBlobkeyCursor; btree.c5180ff ValidOvfl versus allocation capacity and
  save778/root5616 resets map explicit validity separate from retained doubled cache.
  IndexMoveto6190 clears ValidOvfl after accessPayload; comparison success must not
  revalidate retained capacity (`private-blobkey-cursor.test.mjs` post-read success
  and comparator-checkpoint failure regression; [[card:card-s-i-c-a-g]] status).
  Full-key reconstruction has no offset-skip API; diagnostics expose validity,
  capacity and signed skipNext, not byte authority. Admission fixtures cover saved
  overflow acquire retry, final next pointer ignored, exact2081-byte key charge and
  SKIPNEXT exact restoration (both signs), allocation/admission before payload read,
  failed SKIPNEXT save→VALID/sign retention then ordinary save reset, and isolated
  exact84-byte ClearCursor refund. Malformed-record comparison during restore
  retains the saved key with INVALID/no implicit retry; ClearCursor refunds key
  separately from the retained path and owning close completes despite release
  observer failure; revision evidence [[card:card-s-i-c-a-e]] status.md.
  clearTable additionally maps btree.c10211–10305 depth-first child/overflow clear,
  including6979–7060 final overflow resident lookup/ref guard. Interior-overflow
  fixture rejects a final-page acquire hook and ignores terminal-next99 while
  clearing both child entries and divider. Ancestor-cycle fixtures assert
  pre-write rejection, deepest-first exhaustive release preserving corruption
  over observer collisions and retry after fixture repair; twenty-first frame
  rejection releases all twenty admitted frames deepest-first without mutation
  or retained charge. Root clear peak is
  128 frame +128 lease, including failed admission refund.
  Owning cursor close maps4830ff registry unlink/last-single disposal. Fixtures
  cover interior counts/retained freelist, foreign-lease rejection and close-error
  refund, first peer-save failure retaining earlier saved peers, root pre-write
  cancellation retry versus post-write release FAULT and earlier-child mutation
  with paired cleanup errors (ClearTable/saveCursorsOnList808ff order). TripAllCursors (btree.c4450ff) maps registered terminal mutation FAULT,
  saved-key clearing and exhaustive path release with primary-error priority;
  admission tests cover unpublished retry versus partial error and suspended NEW
  rejection. Narrow resident transferCell maps dropCell→insertCell physical ownership
  prerequisites (copy before freeSpace, packed overflow pointer retained); tests cover
  exact capacity/pending transit, pre-write retry and terminal target failure. No
  balance scheduler credit. balance_nonroot8440ff staged descriptor ownership and
  Insert9680ff reset map to single staged transfer consumption separate from scratch
  destruction; private bridges cannot be invoked by external aliases. External
  staged teardown shares edit admission/epoch; suspended seek, exclusive refs,
  acquire/release hook reentry and exhausted-budget internal disposal regressions
  distinguish external authority from noncancellable internal overflow reset
  (Insert9680ff). Shared index/raw cleanup exclusion also covers allocator-result
  unref observers; regressions retain refs/refund/revocation/primary observer error
  and gate-release ordering. Exact-capacity
  and target-failure/cleanup-collision tests assert retained entry authority and
  terminal release. Resident and staged transfer post-publication paired release
  collisions assert both refcounts zero, first-error FAULT and owning disposal.
  Shared insert snapshot probes cover NEW prewrite refund and target TRANSFER
  cancellation after source consumption at exact capacity: primary beats paired
  release collisions, both leases unwind and last owning close disposes FAULT.
  Multiple staged descriptors/CellArray scheduling remain absent.
  BtreeInsert9615ff equal-size local
  overwrite maps replaceCell: packed full-cell overwrite preserving child, unchanged
  entry count, snapshot and pre-write retry; rejects PREFORMAT/structural cases.
  Async input ownership adaptation probes bounded snapshot work/cancellation
  under admission before peer saves; failure refunds peak cell-size+64 without
  changing cursor position. It is not native malloc timing parity.
  Insert9395–9552 caller seek ownership maps only to the explicit exclusion at
  physical REPLACE: typed/runtime seek and savePosition rejection before peer
  save/admission; no trusted seek token or full packed Insert implemented.
  Admission tests cover exact-capacity replacement, caller mutation, independently
  fixtured interior child preservation and post-publication release failure trip/
  owning disposal. Full failure matrix,
  full mutable Btree, native INTERNAL
  capture and VM/WR admission remain outstanding.

WITHOUT ROWID Case5 consuming mapping: pinned `where.c:whereLoopAddOr`,
`wherecode.c2170–2585`, `expr.c:sqlite3ExprCodeGetColumnOfTable`, WhereEnd →
`where-plan.ts` persistent OR gate; `vdbe.ts:emitCase5Identity/case5KeyInfo`,
shared ordinary/INNER/scalar Gosub consumers, `emitWrPrimaryPosition` and persistent
NotFound; primary arms share the positioned table cursor and skip secondary
lookup (`wherecode.c:iCur!=iIdxCur`). `schema.ts` physical PK descriptors preserve aiColumn order and compact
secondary suffix; private packed VM owns dedup storage. WR primary is excluded
from common covering. Native `where.c4835` excludes JT_RIGHT, not LEFT;
`wherecode.c2355ff` excludes nullable ON/USING factoring, not admission.
The joined Case5 caller retains LEFT null extension; boundary64 asserts selected
WR union plus public per-outer null extension/reset (evidence in consumer record).
`or-wr-boundary.test.mjs` covers selected handoff,
first/middle/final op shape and typed public/reset companions in three encodings.
`expr.c4426–4482` logical WR column→primary aiColumn and ColumnDefault maps to
`vdbe.ts:physicalScalarBinding`→`bindResolvedExpression`→Column/RealAffinity;
child local access remains `compileInnerTableSelect:columnAccess`. Boundary76
covers selected outer/child WR union correlation with declaration/PK order
mismatch and alias/expression/scalar metadata; companion77 checks TEXT/REAL
correlations and REAL results twice/reset. This is represented caller evidence,
not full scalar/source fidelity closure (revision evidence in consumer record).
[Consumer decisions](research/card-s-i/consumer-decisions.md),
[evidence](record:///status.md?card=card-s-i-c-b-c), and
[remaining matrix/provenance](research/card-s-i/acceptance-matrix.md).
Independent exact source cases and dev-only harness are indexed in
[WR evidence](research/card-s-i/README.md); filtered actual-browser and exact
original225 residual gates remain distinct. No full matrix or
optimizer/whole-suite parity claim.

Current upstream → TypeScript → test/evidence navigation. The source root is
`reference/sqlite/sqlite-src-3530400/`, pinned by
[manifest](../reference/sqlite/manifest.json). [Translation guide](TRANSLATION.md)
owns current design; [API](api.md) owns the public contract. This map does not
claim complete upstream coverage or reproduce execution inventories.

The [complete prior map](research/card-u-history/SQLITE_SOURCE_MAP.md) preserves
original line/section pointers and run provenance; [history manifest](research/card-u-history/manifest.json)
records exact capture identity. [Oracle](oracle.md) owns reproducible development
setup. Baseline findings in the [mutable audit](reviews/translation-fidelity-2026-09-14.md)
require current producer/consumer verification, not automatic acceptance.

## Isolated private BLOBKEY foundation (not VM admission)

- `vdbe.c:OpenEphemeral`, `btree.c:newDatabase/btreeCreateTable/zeroPage` →
  `private-blobkey-pages.ts:open` metadata page1/root2, private4096/reserved0.
- `btree.c:decodeFlags/btreeInitPage/getAndInitPage/findCell/parseCellPtrIndex`,
  `btreeParseCellAdjustSizeForOverflow/btreeComputeFreeSpace` → derived
  `PrivateIndexPage`, acquired `PrivatePageLease`, raw-byte construction arena.
- `btree.c:moveToRoot/IndexMoveto/indexCellCompare/cursorOnLastPage` →
  `PrivateBlobkeyCursor` resident-key signed seek, interior position, ancestry,
  last-page shortcuts and child-failure restoration. Raw indexCellCompare
  one/two-byte prefix bounds/overflow guards precede full parsing; unknown99
  rewinds (one/two-byte out-of-page and longer-prefix fixtures). Comparator corruption
  → unknown probe/root fallback, translating errCode disqualification/reset without
  swallowing ordinary-search corruption or checkpoint failures; independent malformed
  first-cell/valid remaining-search fixtures in cursor tests; serialGet7
  → record.ts raw REAL assembly/reinterpretation without borrowed buffer export,
  IEEE bit/classification fixtures and numeric/encoding/KeyInfo seeks in cursor
  tests, detailed evidence in
  [[card:card-s-i-c-a-b]] status. Full-key `accessPayload`
  read branch maps to charged padded scratch/local+raw overflow lease copy;
  doubled retained overflow cache capacity is charged and released on close.
  `freeSpace` maps to page-local block/fragment coalescing and boundary extension.
  `pageFindSlot/allocateSpace/defragmentPage` map to conditional page allocation,
  native fragment threshold, one/two-block memmove and charged scratch fallback;
  sole-lease suspended mutations reject alias acquisition/release and fault on error.
  Cursor/page tests use independent source-format pages, not native internal captures.
- Tests: `test/value/private-blobkey-pages.test.mjs` source-derived cells,
  interior records, local distribution, malformed freeblocks and lease/budget
  failure boundaries. `private-blobkey-seam.test.mjs` retains the original seek
  presence gate, now passing but not primitive completeness proof;
  `private-blobkey-cursor.test.mjs` covers full-key overflow comparison/cleanup;
  page tests cover allocator/defrag branch fixtures and scratch/fault/lease failure.
  No native internal fixture or complete mutation/seek credit.
- `btree.c:allocateBtreePage/freePage2` autoVacuum=false ANY branch →
  `PrivateBlobkeyPages.allocatePage/freePage`, native trunk/nearest-leaf and legacy
  capacity structure, retained physical charging, exclusive construction operation
  and terminal fault/cleanup. Internal allocator composes under exclusive operation
  admission with `btree.c:fillInCell` → construction-only `fillCell`, native local
  distribution/varint/padding and prior-link/unref/retain/zero-next order. Tests use
  independent raw2000/6000 payload assertions and stale-next publication observer;
  input/local-cell scratch charged separately. `btree.c:clearCellOverflow` /
  `getOverflowPage` / `freePage2` → auxiliary `clearCellOverflow`, shared raw-cell
  parser and composable free owner: expected count, nonfinal next fetch, final
  lookup, supplied retain, ref guard and primary-preserving cleanup. Independent
  tests cover final garbage pointer ignored, premature chain, truncated cell,
  retained capacity/reuse and acquisition ordering. No slot/entry publication
  credit. Detailed evidence: [[card:card-s-i-c-a-b]].
- `btree.c:dropCell` → `PrivateIndexPage.dropCell`: private mutable nCell,
  freeSpace-before-publication, last-cell header/free reset and nonlast logical
  slot memmove/+2 free; sole-lease async admission and terminal page fault.
  Independent leaf/interior raw fixtures, malformed bound/overlap and suspension
  cancellation tests in `private-blobkey-pages.test.mjs`. Overflow clearing is
  a caller precondition, not performed by dropCell. Evidence: [[card:card-s-i-c-a-b]].
- `btree.c:insertCell/insertCellFast` → `PrivateIndexPage.insertCell` and shared
  internal allocateSpace: sz+2 debit, native slot/count/header publication,
  interior child replacement and adjacent ordered three-slot overflow staging.
  Private pTemp-like copies are charged until resident copy or metadata teardown;
  tests cover raw leaf/interior publication, staged ownership/order, cancellation
  and peak bytes. No balancing/overflow-chain disposal credit. Evidence:
  [[card:card-s-i-c-a-b]].
- `btree.c:btreeGetPage/getAndInitPage/releasePageNotNull` → acquisition refs,
  init-failure cleanup and `PrivatePageLease` per-acquisition revocable page view.
  Shared derived metadata is not invalidated by one alias release; that alias's
  view is permanently revoked even after reacquire, including captured methods.
  Borrowed page/raw/fill-result bytes revoke with their owner, propagating through
  subviews/methods/iterators; no buffer/callback receiver export. Internal endian
  helpers use indexed bytes; tests use explicit owned copies for DataView assertions.
  Release-hook observer view is synchronously revoked. Published auxiliary
  fill results register before publication and deregister on explicit release;
  arena terminal close disposes remaining results (also in FAULT), after rejecting
  live leases. This does not clear overflow chains. Capability/registry metadata
  Auxiliary fill results charge cell bytes+128 deterministic metadata bytes at
  pending peak and retain that charge through publication until release/disposal;
  unwind releases pending charge once. Cursor construction reserves128 bytes for
  object/state/empty descriptors; explicit close releases once including lease-error
  cleanup. Unpositioned cursors retain charge after arena close until cursor close.
  moveToChild aiIdx/apPage depth storage → parent lease/slot records with64-byte
  deterministic high-water capacity charge per depth until close. Reserve before
  publication; failed push unwinds pending charge, child failure restores parent
  but retains charged capacity. Rewind/error/admission fixtures in cursor tests.
  BtreeOpen Btree/BtShared allocations → arena128 deterministic descriptor
  allowance before suspension, unwound on pending-open failure, retained on rejected
  close and disposed once on successful close. Not heap/native allocation parity.
  getAndInitPage/btreeGetPage/releasePage → index/raw per-acquisition capability
  charge128 before ref/publication, refund before release observer; pending init/view
  creation unwinds preserving primary. Alias bytes remain charged once; capability
  budget rejection/raw release collisions/index init cleanup fixtures in page tests.
  Borrowed-byte subarrays →64 deterministic bytes per nested view before
  publication, disposed by lease/result revocation or observer finally. Native
  pointer aliases motivate lifetime, not TS proxy allocation parity. Budget rejection,
  nested revocation and observer collision fixtures in page tests; evidence above.
  Borrowed iterator factories →64 deterministic bytes before stateful iterator
  publication, pending unwind and existing owner revocation/finally refund. All four
  factory/identity/exact-budget/revocation fixtures in page tests; native lifetime
  informs adaptation, not malloc parity.
  Borrowed-byte method lookups → per-view fixed table≤15 wrappers, included
  in view-owner metadata allowance; repeated lookup reuses identity, invocation
  rechecks native-inspired lease lifetime. All whitelist/revocation/bounded lookup
  fixtures in page tests; no native closure-allocation parity claim.
  Arena open/fillInCell producer → copied, validated maxKeyBytes configuration;
  pre-mutation oversized packed-payload rejection is retryable, no snapshot/work or
  ownership publication. Page-test inclusive/zero/invalid/mutable-config fixtures.
  Project resource policy, not upstream allocation parity; entries/unified limits
  remain consuming-owner obligations.
  Derived-page methods → per-acquisition table≤32, included lease allowance;
  captured sync/async permanent revocation and alias-independent cache fixtures in
  page tests. Deterministic bounded representation, not native heap parity.
  Cursor configuration → owned frozen scalar limits within cursor allowance,
  all scalars validated as nonnegative safe integers before admission;
  mutation-relax/tighten/invalid/zero/safe-boundary fixtures in cursor tests.
  Execution budget retains aggregate byte authority: cursor maxBytes must match
  that budget at reserveCursor before admission (zero/lower/higher/safe-boundary
  mismatch and matching retry fixtures). Cursor maxEntries must likewise match
  the arena publication limit before reservation; matching zero/safe-boundary
  and mismatch fixtures preserve the single page-counter authority. Detailed
  policy evidence in [[card:card-s-i-c-a-b]] status; no balance transfer API implied.
  Insert key admission → derived-page arena scalar, parse before mutation;
  caller-built oversized/no-publication/no-work and inclusive retry fixtures in
  page tests. Native resident/staged insertion algorithm unchanged.
  Entry admission → arena per-page resident/staged/pending counters; optional
  copied maxEntries, pre-mutation reserve/unpublished refund, drop/disposal debit,
  construction total validation and free/reallocation reset. Raw-source full-page
  staging, cross-page/drop, construction replacement and failed-publication fixtures
  in page tests. No balance/transfer acceptance; future caller must transfer counts.
  Borrowed iterator next →32 result bytes plus32 non-done entries tuple before
  allocation/index advance, including repeated done results; parent disposal owns
  published charge, pending failure refunds. Independent retained-result/tuple,
  exact-limit/done/release fixtures in page tests; cursor lease lifetime expectations
  include result capacity. Explicit indexed copies in raw-byte fixtures avoid
  irrelevant iteration capacity. Staged inspection copies → payload+64 descriptor
  bytes before construction, pending unwind, page-owned retention through staging
  teardown/replacement/free/close; independent copies survive. Raw full-page
  repeated-copy and exact-admission/disposal assertions in page tests. Remaining
  arena capabilities need audit.
  Cursor position diagnostics →64 result/array bytes plus32 per parent before
  copying, pending refund, cursor-owned high-water until close; closed getter
  rejects. Independent raw-tree repeated-result/exact-limit/disposal fixtures in
  cursor tests; separate from internal ancestor capacity, not native heap parity.
  IndexMoveto result export →64 metadata bytes before construction, pending
  unwind and cursor-owned retention until close; target finally remains complete.
  Native *pRes caller scalar versus TS result-object adaptation. Empty repeated
  export and exact admission-failure/retry/disposal fixtures in cursor tests.
  IndexMoveto synchronous pIdxKey borrowing → operation-owned UnpackedRecordKey
  before await; vdbemem.c:sqlite3VdbeMemCopy → Mem.copyFromSnapshot nonyielding
  chunk copy preserving scalar/byte forms. Target allowance128+128/field+diagnostic
  bytes/scalars releases on all exits; optional synchronous probe precedes chunks.
  Absent probe defers cancellation until snapshot completion; production probe
  integration remains open. Caller eqSeen/errCode transferred back. Seek target
  release/large-BLOB/probe-failure fixtures in private-blobkey-cursor.test.mjs.
  Fill snapshot uses an
  optional synchronous nonmutating work/cancel probe and <=4096-byte copies before
  async suspension. Legacy small input has one bounded synchronous owned copy;
  larger inputs without probe reject after zero-unit admission. No VM probe wiring.
  Source-derived lifetime evidence:
  [[card:card-s-i-c-a-b]].
- Remaining owners: enforceable buffer/result capability and admission,
  overflow publication/release, general accessPayload and complete IndexMoveto
  failure/cache matrix; later balance/save/restore/clear/close.
  [Evidence](record:///status.md?card=card-s-i-c-a-b),
  [research](research/card-s-i/private-blobkey-first-slice.md).

## Distributable integration

The existing translated API/runtime closure is emitted unchanged by
[tsconfig.build.json](../tsconfig.build.json) and [build tooling](../tools/package/build.mjs).
[Package regression](../test/package-distributable.test.mjs) validates the actual
local tarball, named ESM/public declarations and browser-global execution;
[evidence](research/card-v-a-package-evidence.md) records inventory and limitations.
This integration has no new C algorithm mapping or SQL coverage credit.
[Static demo consumer](../examples/browser/query.js) uses those public lifecycle
and column APIs; [browser regression](../test/demo/browser.test.mjs) and
[evidence](research/card-v-c-demo-evidence.md) check local Fetch, positional types,
failed-open and operation/finalize/close ordering without a query backend.

## API and immutable database

| Pinned implementing owners | Current TS owners | Tests/evidence navigation |
|---|---|---|
| `sqlite.h.in`; `main.c:sqlite3Close`; `prepare.c:sqlite3Prepare`; `vdbeapi.c:sqlite3_step`, `sqlite3_reset`, `sqlite3_finalize`, bind/column APIs | [src/index.ts](../src/index.ts), statement VM lifecycle in [vdbe.ts](../src/internal/vdbe.ts) | [test/select](../test/select/), [API lifecycle](api.md#lifecycle-and-cleanup); [[card:card-b]], [[card:card-t]] |
| `pager.c` read acquisition; `btree.c:sqlite3BtreeOpen`, page initialization/traversal/overflow routines | [storage.ts](../src/internal/storage.ts), [btree.ts](../src/internal/btree.ts): `BtreeDatabase`, `openBtreeDatabase` | [test/storage](../test/storage/), [test/storage](../test/storage/); prior map “Pinned source and usable development cache”, “Stage 3” storage sections |
| `vdbeaux.c:sqlite3VdbeSerialGet`, record comparison; `vdbemem.c`; `utf.c` | [record.ts](../src/internal/record.ts), [mem.ts](../src/internal/mem.ts), [utf.ts](../src/internal/utf.ts), [comparison.ts](../src/internal/comparison.ts) | [test/conformance](../test/conformance/), prior map “Stage 3 comparison/collation/record-key mapping”, “Internal Mem/value slice” |
| `build.c`, `pragma.c` schema metadata, `prepare.c` initialization and `select.c` view/result descriptors | [schema.ts](../src/internal/schema.ts), parser and resolver | [API metadata](api.md#stepping-bounded-work-and-rows); [[card:card-e]], [[card:card-r]] metadata evidence |

Immutable whole-file residency and browser async Fetch replace pager write/locking
machinery, not record/page semantics. UTF-8/UTF-16le/UTF-16be and overflow/bounds
remain required. WITHOUT ROWID primary layouts are not ordinary rowid roots.

Public catalog consumer: `prepare.c:sqlite3InitOne` synthetic schema Table,
`build.c:sqlite3StartTable/sqlite3EndTable/sqlite3FindTable`,
`resolve.c:isValidSchemaTableName` and `select.c:selectExpander` →
`schema.ts:loadSchemaGraph/findSchemaTable/SchemaGraph.findTable`,
`resolve.ts:sourceNameMatches` (columns) and canonical star matching,
ordinary `vdbe.ts` physical/aggregate/compound lookup callers, including
`compileAggregateSubquery` IN/scalar. `expr.c:sqlite3CodeSubselect`/TK_AGG_COLUMN
and `resolve.c:resolveExprStep/resolveSelectStep` map to aggregate argument
subquery callbacks, cached bare IN operands and SELECT-local aggregate checks.
Root 1 feeds existing
OpenRead/Column/Rowid operations; no metadata row producer or parallel evaluator.
Tests: `test/schema/public-catalog{,-lifecycle}.test.mjs`; pinned typed captures,
source comparisons and remaining consumers: [card-e-m evidence](research/card-e-m-public-catalog.md).

## SELECT resolution and construction

| Pinned owners | Current TS path | Tests/evidence |
|---|---|---|
| `tokenize.c:sqlite3GetToken`, `parse.y`, generated Lemon parser, `prepare.c` tail/error flow | [tokenize.ts](../src/internal/tokenize.ts), [parse.ts](../src/internal/parse.ts), [lemon-runtime.ts](../src/internal/lemon-runtime.ts), [admission.ts](../src/internal/admission.ts) | [test/parser](../test/parser/); prior guide “Stage 3 parser and schema representation decision”; [[card:card-e]] |
| `resolve.c:lookupName`, `resolveExprStep`, `resolveSelectStep`; `expr.c` collation/affinity/subquery lowering | [resolve.ts](../src/internal/resolve.ts): `expandAndResolveSelect`, linked NameContext/aggregate owners; shared expression codegen in [vdbe.ts](../src/internal/vdbe.ts) | [[card:card-t-c]]; [linked scalar census](record:///status.md?card=card-t-c); prior guide/source map aggregate/subquery ownership sections |
| `select.c:sqlite3Select`, `sqlite3SelectDestInit`, `selectInnerLoop` | [select-compiler.ts](../src/internal/select-compiler.ts): `compileSelect`; [select-program.ts](../src/internal/select-program.ts): `SelectProgramBuilder`, `emitSelectDestination`; selected generators in [vdbe.ts](../src/internal/vdbe.ts) | [[card:card-t-b]], [[card:card-t-d]]; [fallthrough census](record:///status.md?card=card-t-b), [current integration evidence](record:///status.md?card=card-t-d) |
| `vdbe.c:sqlite3VdbeExec`, coroutine/branch/column/value operations | [vdbe.ts](../src/internal/vdbe.ts), [vdbe-primitives.ts](../src/internal/vdbe-primitives.ts) | [relational lifecycle](../test/conformance/relational-private-lifecycle.test.mjs), [aggregate lifecycle](../test/conformance/aggregate-group-lifecycle.test.mjs); [[card:card-t]] changed-export records |

Shared builder/parameters/destinations own selected compilation and publication;
branch decline precedes emission and selected errors propagate. Linked identities
and phase select physical/sorter/saved/coroutine registers. Accepted bounded
migrations do not establish full AggInfo/analyzer or arbitrary composition.

## WHERE and joins

Partial prelowering OR mapping (current contracts: [WHERE guide](TRANSLATION.md#where-joins-and-physical-indexes)):

| Pinned owner | TypeScript producer/consumer | Focused evidence |
| --- | --- | --- |
| `whereexpr.c:exprAnalyzeOrTerm/whereCombineDisjuncts`, `whereInt.h` OR/AND info | `where-plan.ts` clause-owned analysis, masks, commutations, necessary combines, virtual IN retaining residual | `where-plan-analysis.test.mjs`; comparison/affinity/parser flags remain bounded |
| `where.c:whereScanInit/Next` | `scanWhereTerms`, local/outer lookup, stable RHS/seek provenance, 11-slot equivalence | analysis tests; ordinary transitive lowering and full outer-join proof outstanding |
| `where.c:whereOrInsert/Move`, `whereInt.h:WhereOrSet` | `where-or-cost.ts` exact ordered three-slot insertion/move/products | `where-or-cost.test.mjs`, including smallest-run full-slot behavior |
| `where.c:whereLoopInsert` pOrSet, `whereLoopAddBtreeIndex`3284/3580ff, `whereLoopAddOr`4837/4880/4912ff | `btreeLoops` lazy proposals, shared budget, frame-local ignored recursive rc, per-call completion and immutable parent publication | production budget/completion tests in `where-plan-analysis.test.mjs`; status134–149 |
| `where.c:whereLoopAddAll`4966/5025ff | `planWhere` source continuation/budget | ordinary budget/index controls; no exhaustive cleanup claim |
| `vdbe.c` SeekGE/SeekLE `default_rc`, `btree.c` IndexMoveto | `btree.ts:indexSeek` biased prefix boundary descent, including equal interior separators and leaf/parent fallback | `or-rowid-red.test.mjs` native three-encoding multi-page typed rows/reset/page-read bound; [repair evidence](research/card-s-f-or/verification.md#multi-page-prefix-seek-boundary-repair) |
| `rowset.c`, `vdbemem.c:sqlite3VdbeMemSetRowSet`, `vdbe.c:RowSetTest` | `rowset.ts` chunks/list/merge-sort/tree/forest batches; `Mem` destructor ownership; VM first/final batch bypass | `rowset.test.mjs` pinned C driver comparisons; `rowset-opcodes.test.mjs` continuation/NULL/reset/limits/Mem ownership; [[card:card-s-f-c]] status (internal only) |
| `expr.c:sqlite3CodeSubselect`, `select.c:selectInnerLoop`, Case5 | prepared scalar/simple rowid child routes through shared `compileInnerTableSelect`; owned-expression binding precedes RHS extraction | `or-rowid-red.test.mjs` scalar first/empty/sorted/correlated reset cases; [native capture/evidence](research/card-s-f-or/verification.md#prepared-scalar-selected-or-caller-repair) |
| `wherecode.c` Case5 and `disableTerm`419–444, `sqlite3WhereEnd`, VM Gosub/Return | `where-plan.ts:orArmClause/orRuntimeArmClause` retain owned original/commuted-child identities (cost versus Case5 factored scopes); ordinary driveable commuted-child omission eligibility remains conservative for nullable LEFT ON. Invocation-local `branchConsumedTerms` maps exact selected admissions to ready CODED identities and zero-child parent propagation without mutating published terms. Both `vdbe.ts:emitJoinedOr` and single-table `emitOr` consume that carrier before residual tests/RowSetTest/Gosub, retaining unready/nonadmitted/independent truth and untested enclosing parent residuals; shared builder owns NULL RowSet/safe return, nested continuations, per-outer-row initialization and IN restart. WhereEnd common-index Column/Rowid rewrite invalidates nested/different/nonindex arms; broader coded/factored omission fidelity remains incomplete | `or-branch-consumption.test.mjs` direct/AND/nested/ready/unready operand and public reset/error controls; `or-commuted-child.test.mjs` actual selected child, readiness/parent propagation, LEFT conservatism and repeated public branch roots; `or-rowid-red.test.mjs` three-encoding handoffs/continuations; [branch ownership](research/card-s-f-or/branch-consumption.md), [commuted ownership](research/card-s-f-or/commuted-child.md), [consumer evidence](research/card-s-f-or/verification.md) |

Immutable multi-or loops retain original OR info, prerequisites, capability:null,
setup0/sort0 and run+1/output; physical choice belongs to lowering. WR/unsafe joins
remain fallback. [Native proposal](research/card-s-f-or.md),
[revision-bound source detail](research/card-s-f-b-prelowering-detail.md) and
[[card:card-s-f-b]] status retain commands/failures/provenance. This map grants no
runtime OR selection or exhaustive compatibility credit.

`whereLoopAddBtreeIndex` list-IN nIn (where.c3361–3363) maps to
`indexLoopEstimate` immediate exprlist cardinality; all-encoding nested-function
list-cost controls in `where-plan-analysis.test.mjs` (evidence [[card:card-s-f-b]],
status attempt130). SELECT-IN multiplicity remains outside this proof.
`whereLoopAddBtreeIndex` exploration (where.c3284,3580ff) maps to suspended
`capabilities` proposals and immediate `whereLoopInsert` in `btreeLoops`;
early stops close suspended exploration, not just admissions. `whereLoopAddAll`4966/5025ff
maps to `planWhere` shared budget/per-source continuation. Private production
budget tests observe stopped composite leaf construction and later-index access.

Ordered `whereLoopFindLesser/whereLoopInsert` (where.c2744–2939) and bounded
`wherePathSolver` (5835ff) map to `whereLoopInsertCandidates/wherePathSolver`
in `where-plan.ts`; `where-plan-ordered-red.test.mjs` discriminates replacement,
drop/tail deletion, sort/prerequisite identity, setup/budget and vector ties.
`indexMightHelpWithOrderBy` (where.c3664ff) → `btreeLoops` sort-identity
production: reject unordered indexes, retain same-cursor rowid/IPK usefulness
before key-column matching, separately from complete order proof.
`in-range-stat-choice-red.test.mjs` covers competing unforced/forced persistent
indexes before/after ANALYZE in all encodings; `where-plan-analysis.test.mjs`
checks identity retention with unsatisfied physical ORDER.
[Decisions and bounded evidence](research/card-s-d-a-ordered-where.md); indexed
row-size metadata and OR-set/automatic-index/STAT4/star branches remain gaps.
Preimplementation map: build.c sqlite3AddColumn/sqlite3AffinityType,
estimateTableWidth2222/estimateIndexWidth2236/WR conversion2340ff → proposed
immutable schema/physical-field estimates; analyze.c decodeIntArray1520 and
analysisLoader1605ff → proposed callback-text/stat1 handoff; where.c3552/4050/
4239/5818 → proposed real cost/width consumers. See
[row-width decision and native-first artifacts](research/card-s-e-row-width.md).
No runtime translation credit yet; production acceptance deliberately remains red.

`whereexpr.c:sqlite3WhereExprAnalyze` → [where-plan.ts](../src/internal/where-plan.ts)
terms/dependencies. `where.c:whereLoopAddBtree`, `wherePathSolver`,
`sqlite3WhereBegin`, `sqlite3WhereEnd` → candidate/path/level state and SELECT
caller in [vdbe.ts](../src/internal/vdbe.ts). `wherecode.c` → seek/range/deferred
positioning and residual checks; `resolve.c` → resolved ORDER/alias/column identity.

Tests: [multisource-inner-order](../test/conformance/multisource-inner-order.test.mjs),
[multisource-left](../test/conformance/multisource-left.test.mjs),
[multisource-right-full](../test/conformance/multisource-right-full.test.mjs),
[advanced-index runner](../test/conformance/run-advanced-index-ts.test.mjs).
Evidence: [[card:card-k]], [[card:card-s]],
[card-s status](record:///status.md?card=card-s), prior map advanced-index/selected
WHERE sections, [mutable audit tail](reviews/translation-fidelity-2026-09-14.md).

Current boundaries: represented repeated RIGHT/FULL execution (single-barrier
milestone superseded; independent goal acceptance pending), with temporary
WITHOUT ROWID RIGHT/FULL composite keys and ordered physical-derived boundaries;
selected expression/partial/covering/
WITHOUT ROWID paths, not optimizer completeness. parse.y1388–1444 canonical null-test
production, expr.c5319 unary operand coding and6847 NOTNULL implication map to
where-plan.ts `notNullTarget`/structural identity and vdbe.ts resolved operand
binders. Exact schema/analyzed predicate identity preserves covered partial
residual omission; analysis and advanced-index regressions cover this seam
([repair evidence](research/card-s-f-or/verification.md#canonical-null-consumer-repair)). Genuine IPK/rowid proof and
complete resolved ORDER/NULL flags precede plan consumption. Conservative typed
sorting handles unproved BIGNULL ordering. Ordinary continuation must revisit
`scan.loopStart` including DeferredSeek before projecting a new row. WR NOT INDEXED
uses the primary layout. Prior baseline seek/scan predictions are historical,
not universal current failures.

## Sort, compound and aggregates

| Pinned owners | TS consumers | Tests/evidence |
|---|---|---|
| `select.c:pushOntoSorter`, `generateSortTail`, `computeLimitRegisters`, `DistinctCtx`, `SortCtx`; `vdbe.c` sorter/ephemeral ops | [vdbe.ts](../src/internal/vdbe.ts), [private-state.ts](../src/internal/private-state.ts), [comparison.ts](../src/internal/comparison.ts) | [relational lifecycle](../test/conformance/relational-private-lifecycle.test.mjs); prior guide ORDER/DISTINCT/LIMIT sections |
| `select.c:multiSelect`, `multiSelectByMerge`, `multiSelectCollSeq` | `emitScalarCompoundMerge` and compound/table/CTE/derived producers in [vdbe.ts](../src/internal/vdbe.ts); shared destinations | [compound collation](../test/conformance/compound-collation.test.mjs), [UNION ALL](../test/conformance/compound-union-all.test.mjs), [VALUES unsupported](../test/conformance/compound-values-unsupported.test.mjs); [[card:card-j]], [[card:card-t]] |
| `select.c:updateAccumulator`, grouped/non-grouped codegen; `resolve.c` aggregate analysis; `func.c` callbacks | linked aggregate phases in [resolve.ts](../src/internal/resolve.ts), lowering/VM in [vdbe.ts](../src/internal/vdbe.ts), [functions.ts](../src/internal/functions.ts) | [aggregate lifecycle](../test/conformance/aggregate-group-lifecycle.test.mjs), [JSON numeric groups](../test/conformance/json-group-numeric-types.test.mjs); [[card:card-l]], [[card:card-t-c]] |
| `expr.c:sqlite3CodeSubselect`, `sqlite3ExprCodeIN`, RHS construction | linked scalar/EXISTS/IN destinations and correlated rebuild/Once control in [vdbe.ts](../src/internal/vdbe.ts) | [[card:card-m]], [[card:card-t-c]]; prior map expression-subquery sections |

[Surviving finite adaptations](TRANSLATION.md#surviving-finite-materialization-adaptation)
are not the same-VM coroutine merge algorithm. [Finite disposition](record:///status.md?card=card-t&v=96)
and [[card:card-t]] retain bounded evidence and limitations; lack of a native
resumable stack is not a current platform rationale. IN borrowed arrays preserve
finite gates and charged cleanup but do not claim general storage/complexity parity.

## Derived sources, CTE and windows

- `select.c:flattenSubquery`, SrcItem coroutine/materialized branches,
  `resolve.c` transient descriptors → [cte.ts](../src/internal/cte.ts),
  [resolve.ts](../src/internal/resolve.ts), same-builder producers in
  [vdbe.ts](../src/internal/vdbe.ts). Evidence [[card:card-m]], [[card:card-n]],
  [[card:card-t]]; prior map subquery/view and ordinary WITH sections.
- `select.c:generateWithRecursiveQuery` Queue/Current/setup/recursive/destination
  control → `recursiveCteOwner`, `CtePrepareContext`, recursive generators in
  [vdbe.ts](../src/internal/vdbe.ts). Body versus consumer LIMIT ownership and
  duplicate/queue order remain separate. Evidence [[card:card-n]], [[card:card-t-d]].
- `window.c:sqlite3WindowRewrite`, `sqlite3WindowCodeInit`,
  `sqlite3WindowCodeStep`, `windowCacheFrame` →
  [window-rewrite.ts](../src/internal/window-rewrite.ts): `sqlite3WindowRewrite`,
  shared lowering in [vdbe.ts](../src/internal/vdbe.ts). Ordinary no-EXCLUDE registered
  RANGE preceding/current/unbounded..following maps windowCodeOp/CodeStep
  to `emitRangePendingStep`/`emitRangeFollowingReturn`: pending peer step,
  end-position gate, return peer then independent inverse; `nextData` borrows
  the budgeted before-next row, `EphemeralPeekNextData` relocates with grouped PCs.
  Native EXPLAIN and focused lifecycle/typed controls are linked in
  [correction evidence](research/card-s-i/window-owner-correction.md). Ordinary aggregate ROWS
  PRECEDING/FOLLOWING without EXCLUDE maps end-step/lookahead/current-return/
  start-inverse to `emitBoundedReturn`/`emitBoundedFlush` (first input initializes,
  subsequent input steps pending end; flush final step/current-EOF-before-inverse); `windowCodeOp`'s selected
  Delete-before-Next maps to `EphemeralDelete` and
  [private-state.ts](../src/internal/private-state.ts): `deleteCurrent` shared
  saved-position mutation/committed rowid sequence. Cache-required compatible
  values and EXCLUDE retain rows. Cumulative ordinary ROWS unbounded/current
  shares pending-end initialization/step/partition-flush with bounded ROWS,
  consumes return-row policy after producer Yield before EOF; compatible
  aggregates delete once including final output, and have no start inverse. Sliding
  ordinary ROWS preceding/current..current shares pending-end initialization,
  next-input step, post-Yield inverse/delete and final pending-end flush/EOF
  with preceding/following; CURRENT uses zero countdown. Tests assert two
  admissions before first output, four retirements for six rows at preceding1,
  three encodings/reset/partition flush. Ordinary CURRENT..FOLLOWING shares
  this pending-end schedule (zero start countdown); tests assert first output
  after three admissions for following1, five shared retirements for six rows,
  parameter0/1/2 across encodings/partition FILTER/reset/post-output error.
  PRECEDING..PRECEDING maps conditional end-step, unconditional next-input
  return, countdown inverse/Delete and single final return/no inverse;
  reversed bounds empty-frame/reset path maps first-row source branch. Tests
  assert two admissions before output, three retirements for six rows2/1,
  zero/long/reversed bounds across encodings and partition FILTER/reset.
  FOLLOWING..FOLLOWING maps start=end-start initialization, independently
  guarded return/inverse and dual flush tails; positive constant start
  selects return deletion (parameter/zero retains). Tests assert four admissions
  before output for1/2, six deletions, parameter/reversed/long/zero tails
  across encodings and partition FILTER/reset. UNBOUNDED..PRECEDING maps
  conditional pending end step/return with AGGSTEP Delete on end duplicate
  for positive constant end (parameters retain), single flush return/no inverse.
  RANGE/GROUPS UNBOUNDED..CURRENT: input peer/end-step/return, no inverse;
  deletes at return including final; single partition/flush owner. Typed/key
  controls in lookahead tests. parse.y sortlist/expr.c:SetSortOrder ->
  parse.sortTermsForWindow -> resolved window.orderTerms (WindowChain inheritance)
  -> rewrite producer terms/sorter/peer KeyInfo. WindowCompare/ExprListCompare
  normalized DESC/BIGNULL sharing; named multi-term DESC and inherited topology
  in lookahead/rewrite tests (correction receipt).
  RANGE/GROUPS CURRENT..CURRENT represented ORDER terms/partitions shares the
  input peer owner; resolved KeyInfo, pending-end step/return/inverse-delete,
  final peer skips inverse. Typed3-encoding/key/cache/fault tests in lookahead.
  RANGE CURRENT..CURRENT represented ORDER terms (offset RANGE still one term): windowIfNewPeer/CodeStep and
  CodeOp end-step/return/start-inverse now uses resolved KeyInfo input peers
  and shared independent cursor loops, no broad partition fill; final peer
  skips inverse. See correction receipt and lookahead peer/key/error tests.
  ROWS all-starts..UNBOUNDED uses pending-end step/final
  step and cached return-loop/inverse. FOLLOWING guards return countdown
  independently of inverse and flushes empty tail after start EOF; literal start
  selects return deletion (parameter/zero retain). Partition/parameter/encoding/error controls
  are linked in the correction receipt.
  Tests assert first-output two admissions/five step retirements, typed bound
  reset/partition cases and saved deletion error. Literal-zero boundary production now maps WindowAlloc preservation of
  kind/offset expression and boundary-type ordering errors (`parse.ts:windowFrame`);
  topology/public tests assert retention and atomic invalid-zero rejection. Tests
  [lookahead/frontier/lifecycle](../test/conformance/window-bounded-lookahead.test.mjs),
  [shared cursor transitions](../test/value/window-shared-delete.test.mjs),
  [phase topology](../test/conformance/window-delete-phase.test.py).
  [Scoped source/resource evidence and remaining gates](research/card-s-i/window-owner-correction.md).
  Tests [retained endpoint integration](../test/conformance/select-window-retained-endpoint-integration.test.mjs),
  [first/nth endpoint](../test/conformance/window-first-nth-endpoint-owner.test.mjs).
  Evidence [[card:card-o]], [[card:card-t]] and prior map window sections.
- `btree.c:sqlite3BtreeTableMoveto`, `vdbe.c:OP_SeekRowid` → finite private
  `seekRowid` in [private-state.ts](../src/internal/private-state.ts), awaited VM
  caller. Controlled async linear adaptation is not native Btree complexity.
  [Primitive tests](../test/conformance/private-endpoint-seek-control.test.mjs),
  [public tests](../test/conformance/window-endpoint-seek-control-public.test.mjs),
  [repair evidence](record:///status.md?card=card-t-d&v=456).

Windows and multi-source/CTE consumers are no longer blanket preimplementation
gates; actual bounded semantic branches govern admission. Cached EXCLUDE/frame
schedules retain endpoint ownership; arbitrary cross-feature composition is not
promised.

## Functions and encoding

`func.c`, `printf.c:sqlite3_str_vappendf`, `date.c`, `json.c`, `utf.c`,
`vdbemem.c` → [functions.ts](../src/internal/functions.ts),
[ordinary-scalars.ts](../src/internal/ordinary-scalars.ts),
[pattern.ts](../src/internal/pattern.ts), [printf.ts](../src/internal/printf.ts),
[date-time.ts](../src/internal/date-time.ts), [math.ts](../src/internal/math.ts),
[json.ts](../src/internal/json.ts), [utf.ts](../src/internal/utf.ts),
[mem.ts](../src/internal/mem.ts).

JSON parser/path/mutation/JSONB and aggregate/table callbacks are translated
internals, not host JSON.parse semantics. Tests
[JSON full scalar](../test/conformance/json-scalar-full.test.mjs),
[table functions](../test/conformance/json-table-functions.test.mjs),
[aggregate paths](../test/conformance/json-aggregate-paths.test.mjs),
[BLOB document](../test/conformance/json-blob-document.test.mjs),
[pattern/window](../test/conformance/ordinary-scalars-pattern-window.test.mjs).
Evidence [[card:card-p]], [[card:card-q]], [[card:card-r]] and
[card-r metadata status](record:///status.md?card=card-r).
`json.c:jsonPrettyFunc`, `JsonPretty`, `jsonPrettyIndent`,
`jsonTranslateBlobToPrettyText` and `jsonTranslateBlobToText` TEXT/TEXTJ/TEXT5 →
`json.ts:jsonPretty`, `translateStringSteps`, shared Parser/decode generators and
encoded lexical metadata; `vdbe.ts` async FunctionContext and statement byte budget.
[Correction regressions](../test/conformance/json-pretty-corrections.test.mjs) map
scalar/label/JSONB TEXT5, strict admission, three encodings, retained-state limits,
append work/yield/cancel/deadline and cleanup. `jsonTranslateTextToBlob`
parse_string and TEXT5 cursor advances map to consumed-position checkpoints in
`Parser.str`/`stringEncoding` and `translateStringSteps`; escape-dense scalar/label
TEXT/JSONB probes cover classification interruption and saved-error/reset reuse. [Public pretty regression](../test/conformance/json-pretty.test.mjs)
and [source-pinned typed companions](research/card-r-f/README.md) cover both
arities; subtype-0 output does not inherit canonical JSON subtype.
Built-in JSON is not a blanket gap.
Exact function tranche runs/IDs remain in existing oracle/conformance research,
not duplicated here.

### Retained FROM hidden ORDER key correction (2026-10-03)

`resolve.c:resolveOrderGroupBy` EList alias/ordinal then NameContext column
ownership -> `vdbe.ts:compileDerivedProducer` orderIndex now denotes producer
register index, not parent projected register index. `select.c:flattenSubquery`
(11), `fromClauseTermCanBeCoroutine` (1a), 0482 / SRT_Coroutine -> existing
InitCoroutine/Yield/EndCoroutine and separate child/parent sorters. Tests:
`subquery-view-foundation.test.mjs` retained hidden ORDER key / route cases.
Original browser gap lane now executes both original probes successfully;
no general retained expression ORDER or full FROM compatibility claim.

Nullable selected equality keys: `wherecode.c:codeAllEqualityTerms`976–980 →
ordinary/joined `vdbe.ts` equalityNullGuards, separate from range addrNxt guards.
Equality NULL breaks the level (including all IN iterations); LEFT unmatched
continuation is preserved; IS/ISNULL keys remain searchable. Frozen pinned
controls: `candidate-lifecycle-public.test.mjs`, `cases/candidate-lifecycle-native.json`;
development capture `capture-candidate-lifecycle.py` (post-implementation,
pre-consuming-test). No public diagnostic API or runtime oracle dependency.

Row-width proposal revision [[card:card-s-e-a]] (2026-10-04, not implementation):
analysisLoader assigns nonpartial globally matched index count to argv[0] named
table, not index.table; post-load defaults may floor table-only count to99.
GetInt32 unsigned hex remains admitted at sz boundary. Revised native-first
120 snapshots and237 production/public assertions are recorded in the decision
note; TS baseline9/237 passes is not fidelity credit. Planner assessment pending.

Row-width proposal acceptance maps where.c5961–5965/5993–5995/6109 per-round
unsorted state separately from total. Real joined path-bias control discriminates
prior-unsorted versus prior-total recurrence; not runtime implementation credit.

Row-width runtime checkpoint [[card:card-s-e-b]] (2026-10-04, not acceptance):
`schema.ts` owns immutable szEst/szTabRow/szIdxRow/default row estimates and
stat1 flags; build.c AffinityType/estimateTableWidth/estimateIndexWidth/default
row estimates and analyze.c1520–1649/1988 map to local construction/load/freeze.
Fifth checkpoint maps analyze.c equal-name lookup to build.c1069 PrimaryKeyIndex
on rowid as well as WR tables; UNIQUE persistent origin is distinct. Encoded
BLOB/NUL callback fixtures bound this ownership claim; complex constraint merge
and autoindex ordinal fidelity remain uncertified. build.c2417/isDupColumn WR
primary compaction now precedes physical layout and estimates; duplicate
column+collation keeps first direction, with progressive native-first tests.
build.c1834–1890 AddPrimaryKey now publishes shared alias identity (inline DESC
versus table-list DESC); table width, autoindex, resolve, WHERE and VDBE consume
it; transient constructors publish null. Native-first IPK fixtures bound evidence.
expr.c4462/sqlite3ExprCodeGetColumnOfTable maps ordinary WR table reads through
physical primary-index fields after noncovering secondary seek; distinct-collation
native snapshots assert widths/ordinals and typed payload, residual and scan reads.
`parse.ts` preserves original type spans needed by the AffinityType BLOB pointer,
and translates build.c1584/util.c299 dequoting before metadata/AffinityType.
Native-first quoted CHAR/BLOB hex/overflow fixtures cover complete direct-column
origin metadata and typed reset rows in3 encodings; broader metadata unclaimed.
`where-plan.ts` consumes numeric estimates as explicit BigInt costs and exact
physical-field width, including synthetic IPK3 separate from persistent indexes.
where.c3552/4050/4239/5818 are partial mapped cost/width consumers, not complete
routine-port credit. where.c5273 WHERE_ONEROW ordering prefix and5961–5995 prior
unsorted recurrence map to bounded joined singleton proof and path bias.
Real candidate insertion does not consult width; whereLoopIsNoBetter does.
Runtime117/240 remains red. Third checkpoint maps where.c3533/3552/4050 range
estimate/clamp order and4239/4258–4278 full-scan usefulness/covered-prefix lookup
reduction; truthProb and full expression coverage are not claimed. Supplemental
cost/order native captures and tests pass; affected169/170 remains red due to
preserved peer sorter assertion (independent native sort0). Existing public join
failure and unchanged vdbe.c5495 SeekRowid missing numeric-copy coercion remain
separate semantic-owner work: ordinary diagnostic11/120, BigInt-only rowid
is120/120, neither replaces acceptance. No STAT4/skipscan/OR/count/universal
optimizer credit; outstanding constructor/invalid-byte/metadata gaps in status.
Ninth checkpoint legacy.c/sqlite3_exec→vdbemem.c/sqlite3ValueText→analyze.c
passes UTF8 bytes, not Unicode; schema retains Mem-converted bytes through
hash.c ASCII-only lookup/decodeIntArray. Overlong UTF8 names cannot alias valid
non-ASCII names. Native callback hex plus canonical UTF16 controls are bounded
evidence, not malformed UTF16 parity.
Tenth checkpoint grammar PRIMARY/UNIQUE action ordering maps to explicit
implicitConstraints; schema build.c4330–4380 equivalence merge preserves first
direction, PK promotion and ordinal reuse for rowid implicit indexes. Physical
fields still own widths. Native UNIQUE-before-PK/duplicate DESC regression is
bounded. Eleventh checkpoint build.c convertToWithoutRowidTable aliases primary
root while preserving implicit name ordinal; shared definitions now publish WR
primary ordinal2 and automatic UNIQUE secondaries/PK suffix fields. Native-first
three-encoding noncovering fixture validates widths/typed reset. Equivalent
UNIQUE→WR-PK direction now consumes retained merged owner before compaction
and storage layout (twelfth checkpoint build.c4330–4380→2417); native-first
covering typed/reset fixture passes, supplemental index_xinfo DESC confirms.
Conflict policy/full census remain open.
Thirteenth checkpoint utf.c sqlite3VdbeMemTranslate UTF16→UTF8 default build
maps to utf.ts direct read/write codepoint bytes through Mem.changeEncoding;
final unpaired surrogate is preserved as three bytes, paired/next-unit formula
and odd trailing byte use source branches. Twelve pinned column_text oracle
cases pass. Fourteenth checkpoint two encoded stat1 snapshots exercise invalid
surrogate-name lookup and surrogate-consuming-space unknown token boundaries:
sz=8 ignored inside token, unordered retained, default physical width24. Native
callbackHex/EQP and public typed/reset pass; full invalid callback matrix open.
Fifteenth checkpoint rowid merged-PK fixture independently captures first DESC
via index_xinfo and typed noncovering rows all encodings; existing constructor
passes. Census records resolve derived table and VDBE transient table defaults;
Sixteenth checkpoint parse retains onError; schema merges explicit/default
before PK promotion and linkIndex translates first-REPLACE bubble to tail at
build.c exit_create_index. Native-first index_list all encodings matches3/1/2
and typed reset. Seventeenth checkpoint default→REPLACE PK promotion executes list cleanup at
merge actions too; final policies alone had reordered native1/2 into2/1.
Retained producer list positions feed publication before stat load/freeze,
not WHERE re-ranking. Native three-encoding list/typed reset passes; explicit
Eighteenth checkpoint explicit conflicting policy rejection preserves object
name via prepare.c corruptSchema, caller prepare maps SchemaFormatError to
sqlite11/cause before publication. Native writable-schema three-encoding error
and repeated prepare coverage pass; WR+APPDEF list fixture passes existing path.
Nineteenth constructor publication moves automatic schema identity materialization
and retained grammar linkage before APPDEF insertion (build.c init-busy linkage/
exit_create_index); removes post-estimate implicit-slot sorting and permits real
APPDEF cleanup on correct list.13/13 conflict tests/typecheck pass.
Twentieth isolated original-native ordinary public cases1080/1080 pass, typed
rows/column names/rebind/clear/reset retained. Production cost/access9/9 covers
where.c3552/4239 seek-width ratio/truncation/noncover lookup and actual tc roots
with explicit BigInt handoff; full metadata/native internal costs unclaimed.
Twenty-first pinned public column-name/decltype/database/table/origin capture
plus REAL noncover lifecycle3/3 passes on three encoded snapshots49,152 bytes;
bounded direct-column metadata only (vdbeapi column metadata contract).
Twenty-second build.c2385–2411 delayed WR IPK persistent-index creation now
feeds implicit ordinal/linkage/physical/default/stat ownership, not undefined
stats recovery. Native first three-encoding WR IPK fixture reproduces rowLogEst
crash and passes corrected primary3/secondary1,2 list/root/public behavior.
Twenty-third sqlite3AddPrimaryKey identity shared by rowid publication/WR delay;
independent inline DESC/table DESC/UNIQUE merge controls nine encoded snapshots
184,320 bytes pass immediate/delayed/retained-direction paths.15/15,typecheck0.
Twenty-fourth select.c2246/2376/2432 transient columns remain zero-estimate,
table nonzero1; resolve453/455 and VDBE synthetic constructors match these
placeholders, not persistent AddColumn widths. Source-derived nested check3/3.
Checkpoint25 `docs/research/card-s-e-estimate-census.md` enumerates actual
persistent/transient producers, publication/error boundary and WHERE/lowering
consumers; mixed peer VDBE hunks require isolation. Complement94/94 is bounded.
Checkpoint26 selected-resource80:74 pass6 two-slot joined IN crashes; isolated
HEAD with identical test inputs6/6 pass. InListValue iteration register exact-
integer invariant divergence must be traced through chosen path/lowering, not
credited as old joined failure. Advanced selected resource checks8/8.
Checkpoint27 where.c7627 IfNotOpen guards unopened LEFT inner IN; VDBE
register-set lowering now fences synthetic null continuation past restart/
physical advance, reset per outer row. First-RHS-empty trace fixed45/45.
Checkpoint28 row-width-left-in-reset native JSON independently captures
retained reset/clear/rebind NULL/nonempty sets on six existing snapshots;
public6/6 vs pre-guard0/6, with TS retained replay checks.
Checkpoint29 ownership census records isolated VDBE11 owned/2 peer hunks;
reverse-check does not replace independent review. Fresh width1293/123 and
resource/affected228/1 retain original residuals; typecheck0.
Checkpoint30 build.c1651/util.c1303 declared control matrix20 columns ×3:
hex boundary/long zeros/invalid suffix/CHAR scan/BLOB pointer/INT precedence,
native direct metadata/rows3/3; widths source-derived only.
Checkpoint31 raw schema-byte controls ff/c183 UTF8 accepted quoted prefix;
UTF16 byte-encoding mismatch native/TS CORRUPT11 twice,3/3. No actual
malformed UTF16 declared-type or full raw-byte metadata credit.
Checkpoint32 utf.c UTF16 consume-next schema control encoded correctly in
both byte orders: raw native UTF8 metadata hex5 fields/public TEXT/reset2/2,
width5 source-derived; declared suites8/8,not full malformed-byte closure.
Checkpoint33 independent-review handoff links paths/owned-hunk boundaries;
fresh width1301/123,resource228/1 preserve original residuals,no acceptance.
Checkpoint34 vdbe.c5495 lossless SeekRowid input copy/NUMERIC affinity absent
in TS6902; original-bound isolated join/rowid/path-bias11/349 vs HEAD0/360,
INTEGER diagnostic360/360. Root semantic owner,no binding expectation waiver.
Checkpoint35 where.c2744 equal-loop insertion precedes5818 path width tie;
exact no-ORDER native EQP tb9 controls/TS plan+OpenIndex+public reset9/9,
original3 differing ta assertions retained pending review.
Checkpoint36 where.c7627 unopened IN cursor guard adaptation reverse outer
transition/native reset8 binding sets×6 controls6/6; broader joins unclaimed.
Checkpoint37 joined WR path stops at compileInnerTableSelect3376 storage
fence current/HEAD0/3,native nonempty. Ordinary mapping is not joined
execution proof; coherent SELECT extension remains separate/unwaived.
Checkpoint38 schema final post-load/freezing/cache publication invariant120/120:
single index statistics owner,physical backlink,readonly mutation/cache identity;
not full cleanup/transient constructor proof.
Checkpoint39 malformed stat1 repeated load fresh errors/public CORRUPT12/12
combined new/existing controls; no graph publication,not native permissive
corruption equivalence or full error-cleanup proof.
Checkpoint41 where.c5273 ONEROW skips singleton x order checking; exact
joined reverse SQL native SORT0 forced/SORT1 scan all encodings,TS rows/
retained reset/sorter parity6/6. Original sorter assertion retained.
Checkpoint43 whereLoopOutputAdjust3037 actual insertion cardinality separate
from physical run costs; prerequisites/virtual/used-parent branches and
heuristic eq/IS clamp translated. truthProb/HIGHTRUTH/LIKE/self-cull flags
remain absent; source8/8,native cost branch3/3.


Checkpoint44 expr.c2899–2927/util.c1303 EP_IntValue positive signed32
leaf plus unary recursion/transparent parentheses;source19/19 including
used virtual parent and negative singleton residual output.

Checkpoint45 trace: TERM_HEURTRUTH only consumed by STAT4 HIGHTRUTH
where.c3519/7086 second-pass; STAT4 sample estimates remain unimplemented, without blocking admission.
No missing admitted shared-state consumer; no mutable clause workaround.
SELFCULL consumer6606 Bloom generation unsupported,not width cost.
Fresh selected55/55,WR/residual complement43/43,stat/STAT4 boundary36/36;
44 changed-runtime width1951:1476/475 and resources178:177/1 reused.

Checkpoint46 current constructor census: transient result tables column0/table1/
rows200 (select.c2376/2432/2464) now consistently freeze completed metadata at
publication via schema freezeTransientTable; not persistent default/stat1 pass.
See refreshed estimate census and implementation handoff; independent review pending.

Checkpoint47 transient publication regression targets real withTransientTable:
3/3 current versus isolated freeze-call removal0/3; broad publication200/200,
typecheck0,width1956:1481/475,resources49/49,affected170:168/2 (sorter assertion,
missing r2-native artifact). No new runtime edits; independent review pending.

Checkpoint48 transient guard-before-freeze/repeated-identity controls pass;
publication/WR/STAT4/corruption159/159. Persistent PhysicalIndex-null fallback
width1 flagged as open source ownership branch (build.c2236 versus schema574);
unsupported access does not automatically justify fabricated width estimates.

Checkpoint49 real unknown-collation index reproduces fabricated width (3/3 red).
Pinned native ordinary q scan succeeds with A in all encodings; forced qi returns
SQLITE_ERROR/no query solution. Tried whole-schema rejection,then reverted:
that blocks legitimate table scan and is not a coherent source-faithful policy.
Need structural field ownership separate from executable built-in KeyInfo;
no width1 fallback or global rejection credit. Final tests retain expected
structural width LogEst(108) (CHAR100=26 plus rowid1),still0/3. No runtime change
retained this checkpoint; missing four Chinook tests remain unwaived.

Checkpoint50 replaces fabricated nullable-physical width with shared immutable
PhysicalIndexLayout owner; executable built-in KeyInfo uses same fields/PK
mapping only when collations available (build.c2236,5653–5700). Unknown collation
preserves structural width and ordinary table read,declines index access;
no competing statistics or host callback support. Review pending.

Checkpoint51 native WR unknown-CollSeq exact index_xinfo records agree with
shared layout fields: PK a custom DESC,b,c; same-collation suffix dedups a;
different-collation suffix repeats a custom DESC and maps PK [1,2]. Three
encodings frozen metadata/source widths pass3/3; independent native ordinary
WR read and forced secondary reads fail prepare1,TS rejects too (not exact
code/message parity). New36,864 fixture bytes; no WR executable access credit.
Fresh complement156:153/3 includes existing joined-WR storage fence failures,
not new owner regressions. Checkpoint50 width/affected evidence reused runtime
unchanged; independent review/root/parent/native-input gaps remain unwaived.

Checkpoint52 unknown-CollSeq caller now preserves native SQLite error1 rather
than temporary unsupported: forced unavailable index => no query solution;
unforced WR unavailable primary storage => no such collation sequence.
Owning btreeLoops uses retained layout names; existing capability gating/cost
ordering unchanged. build.c5653–5700/where.c6169 branches; six encoding controls
assert exact public kind/code/extendedCode/message/null classification across
repeated prepares,stable graph and immediate close. First harness syntax error
corrected;final6/6. Fresh affected173:170/3 existing joined-WR fence only.

Post-runtime row-width acceptance: where.c2744–2808 dominance has no width;
5800–5821 width comparison is a later solver tie branch. Exact no-ORDER versus
ORDER BY a native controls distinguish reachability; no candidate algorithm edit.


### Revision 2026-10-04 — bounded numeric seek / LEFT continuation supersession

This revision supersedes **only** the earlier absent NUMERIC-copy claims in the
row-width checkpoints (including checkpoint34 and audit2026-10-04d), not their
historical reds or pending e/root qualifications. See
[causal repair/evidence note](research/seek-rowid-numeric-repair.md).
Commits `4fa06e2441b978406cbd285b34ff4e6a25868ebc` and
`5713c0f68bfb733ecb4e527fc74841394066ceac` correct these bounded owners:

- Pinned `vdbe.c:5495 OP_SeekRowid` copies the input Mem and applies NUMERIC
  affinity before integer gating/cursor access, preserving original binding
  payload/type. `vdbemem.c:sqlite3VdbeIntegerAffinity` uses the **exact bigint
  slot for IntReal**, including both signed64 endpoints and values above2^53.
  Existing REAL instead uses double-to-integer roundtrip equality and **strict
  signed64 endpoint exclusion**. This is distinct from the narrower
  `sqlite3RealSameAsInt` text-numericization rule; it is not a text shortcut.
- `where.c:sqlite3WhereEnd` distinguishes continuation, advancement and LEFT
  synthetic-null re-entry. TS `nextAt` enters LEFT null-pass / RIGHT Return
  guards; `advanceAt` identifies the actual singleton Goto or movement opcode.
  Singleton target patching now uses advanceAt, not an offset into nextAt.
  ON matching remains before null extension; WHERE remains after positioning.
- `where.c:wherePathSatisfiesOrderBy` /5273 WHERE_ONEROW and complete
  obSat==obDone satisfaction support two bounded represented proofs: the prior
  accepted **final ordered producer after exact rowid-equality singleton
  predecessors**, and the exact **complete outer IPK order followed by an inner
  rowid singleton / LEFT NullRow** witness. The latter keeps the outer key fixed
  through the matched or NULL-extended body before advancing the outer cursor;
  production consumes the selected full order count, not a VM-recomputed proof.
  This supersedes the prior FINAL-only current assertion, whose revision-bound
  provenance remains in [independent review24](record:///review.md?card=card-s-b-a-a-b-a-a&v=24)
  and executor [status144](record:///status.md?card=card-s-b-a-a-b-a-a-a&v=144)/[147](record:///status.md?card=card-s-b-a-a-b-a-a-a&v=147).
  Exact payload: tree `75a4bbe8a5a4c77306082a692946f6751bfee4b6`, base
  `f45c01285911045ed1152a36227dc8d5242f8a01`, LEFT on-provenance spec blob
  `c2aeb09fa513fe37a421927d870e2660a5ed0a4b`, SHA256
  `ba41afa398e7a0a8f972ed9f83cc892bb7e014c5563a9f0de4414c3de3b7b0f3`.
  Source/caller, native EXPLAIN and exact typed public/private-counter evidence
  are retained there and in [the attribution evidence](research/card-s-i/original225-residual-attribution.md).
  Statistical nOut0 is not uniqueness. Incomplete/partial proofs, arbitrary
  fanout and the solver's broader positive-order domain remain unreviewed and
  not certified; this is not a claim that current code rejects every such path.
  Neither window proposal delta nor fresh225/FULLbrowser integration is approved
  by this bounded witness; historical integration reds remain unwaived.

Fresh strict singular-public ordinary execution on the disclosed peer-dirty
runtime completed **69/69** cases across UTF8/UTF16LE/UTF16BE, exact rows/errors
and every exact/min/max private bound, with no prepare waiver or increased limit.
Earlier63/69 with six LEFT limits and66/69 with three sorter minima remain
historical failures, causally repaired rather than waived. Primitive IntReal
coverage is not a claim of a public IntReal producer. No public API change.
Runtime commit/tree and fresh five-fix delivery evidence are in current executor
status for [[card:card-s-b-a-a-b-a-a-a]]. Native fixtures/pin evidence are not TS
execution credit. Shared dirty work is NOT a clean export; e aggregate1962/1490/472,
cFAILED, joined-WR and broader historical reds remain unwaived/separately owned.

### 2026-10-04 joined WR caller follow-through

`vdbe.ts:compileInnerTableSelect` consumes existing schema primary/secondary
PhysicalIndex identity for OpenIndex, IndexRewind/Next, PK payload remapping and
required-primary lookup. `build.c:convertToWithoutRowidTable`,
`expr.c:sqlite3ExprCodeGetColumnOfTable` 4462,
`wherecode.c` 2170–2186 (covering/rowid/WR lookup), and `where.c` 4055/6369
(index hints) own the relevant branches. `compileExpressionTree` consumes the
payloadIndex carrier without changing semantic affinity. LEFT continuation nulls
both source and selected cursor; no WR RIGHT/FULL match-key credit.
`without-rowid-joined.test.mjs` + pinned `without-rowid-joined-native.json` add
three-encoding caller evidence. Historical checkpoint37 0/3 fence is superseded
only for this bounded producer; broader grouped/specialized fences remain.


### Joined column-location correction (2026-10-04)
The semantic location contract now distinguishes `physicalColumnIndex` (table
primary/secondary storage ordinal) from aggregate `payloadIndex`/iAgg bookkeeping.
Joined columnAccess produces the former; binding replaces any prior physical
location when rebinding, and expression emission consumes only that location.
Logical transient indices and aggregate registers retain their own owners.
Pinned expr.c:sqlite3ExprCodeGetColumnOfTable4462 maps table storage;
TK_AGG_COLUMN4995–5015 uses accumulator/sorter locations first, and select.c
AggInfo production owns those locations. vdbe.c OP_Column reads the already
chosen cursor record ordinal, not a universal semantic-to-physical conversion.
This repairs the source-only45/68 cross-layer regression without reverting real
WR collation-aware mapping. Exact corrected candidate tests: discriminator68/68,
broad910/910,joined/shared184/184. Historical24/30 credit, wider fences and
post-runtime/native-FIRST shortfall remain unchanged; no B4-cause claim.

### Current bounded width evidence closure — 2026-10-04

Actual integrated source is `644cbcd827a2fbdf3a14407210941e38ac945a01`
(tree `7669377f99ead8c9bed67c52695cfa549863fa2d`), not the historical
mixed ACK candidate. Joined owner correction uses dedicated `physicalColumnIndex`
for storage; `payloadIndex`/iAgg remains logical aggregate state. Old checkpoints
and their failures remain chronological evidence, not current acceptance claims.
Independent [[card:card-s-e-c]] / [[card:card-s-e-d]] support bounded original
width and tested lifecycle on exact source plus inventoried297 evidence paths.
The coherent generator→case JSON→fixture/test corpus is promoted by
[[card:card-s-e-b]]; scope, hashes, fresh export checks and reuse are in
[width evidence delivery](research/card-s-e-b-evidence-delivery.md). Fresh exact
export original240/240, closure2034/2034 and read-only pinned120 snapshot equality
are bounded evidence, not whole-product approval. B4 now returns INTEGER1984 with
reset/admission on reviewed source; sole causation is not proved and cancelled
baselines supply no causal credit. Native-FIRST chronology is unchanged.
### Positional stat1 skip-scan

where.c3238–3650 → `where-plan.ts` positional `equalitySlots/nEq/nSkip`, insert-before-recursion feedback, raw nIter output reduction and nIter+5 cost multiplier; where.c2667ff/5300ff → subset/dominance and order contribution. Skipped null slots do not earn global equality-order credit. Shared BigInt construction budgets retain enclosing insertion versus child-DONE ownership. Producer controls: `skipscan-planner-producer`, `skipscan-stat1-producer`, `where-plan-analysis` and subset/dominance tests. analyze.c1520–1589 → schema stat1 decoding and noSkipScan admission controls. STAT4 sample estimates remain unimplemented.

wherecode.c925–960/1997–2099 and where.c7664ff → `where-prefix.ts` two-phase first/restart positioning and ordinary/joined/recursive-OR consumers in `vdbe.ts`: copy physical prefix before RHS/IN evaluation, strict GT/LT restart, physical keys without affinity conversion, IN exhaustion before prefix/final exit, equality NULL final versus bound NULL next, LEFT extension only after full exhaustion. `btree.ts` owns page-local seek and comparison-error conversion; VDBE owns registers/cache/control and operand cleanup. Tests: `skipscan-prefix-code`, `skipscan-position-owner`, `skipscan-prefix-seek`, `skipscan-seekscan-state`, `skipscan-seekscan-vdbe` and public default compiled companions.

Current bounded admission, typed WR/REAL/reset/rebind, selected DESC recursive-OR, NULL/LEFT and resource/corruption witnesses are indexed in [COVERAGE](research/card-s-g/COVERAGE.md#current-bounded-contract-and-review). Detailed native-FIRST chronology, historical admission-copy versus default-production results and remaining limits are in [IMPLEMENTATION](research/card-s-g/IMPLEMENTATION.md). This mapping does not certify universal optimizer, work/error-order or native OOM parity. Transformed EXISTS producer, vectors/subquery-IN and general joined ORDER remain unimplemented or unproved.

Historical checkpoint: disabled lowering/internal-opt-in, advanced24/30 and analyzeC0/24 accounts describe earlier revisions, not current production. The superseded map text is retained verbatim in [F4 repair evidence](research/card-s-g/review-docs-repair.json); original tests/captures and chronology remain in IMPLEMENTATION. Current coherence guard: `skipscan-docs.test.mjs` ([independent review](research/card-s-g/REVIEW.md)).

### Current bounded infix caller repair — card-p-b-c (2026-10-04)

Pinned `parse.y:1363–1383` creates LIKE/GLOB function lists as RHS pattern,
LHS candidate, optional ESCAPE. Syntax reduction children remain LHS/RHS/ESCAPE.
`vdbe.ts:bindResolvedExpression` and joined `resolveTree` now use the same
infix child permutation in every applicable caller policy, not only windows;
infix NOT binds its synthesized unary child against the same infix carrier.
Explicit function-call children remain unchanged. No patternCompare algorithm,
function breadth, fixture, or expected-count change was needed.

Fresh source-ID-pinned C API on actual UTF-8/UTF-16LE/UTF-16BE users files
confirms Alice/Bob/Cara LIKE results 1/0/1 and filtered count 2. Public infix
aggregate/join/NOT/ESCAPE and explicit-call controls now agree. Executable evidence:
`ordinary-scalars-pattern-native.test.py` (36 INTEGER checks),
`run-ordinary-scalars-pattern-ts.mjs` (5 observations, 24 boundaries,
90 discriminators, 33 compositions, 9 lifecycle cases). Detailed chronology and
commands: `docs/research/card-p-b-c-pattern-count-diagnosis.md`.
The 50 active ordinary non-pattern registry rows / 0 absent count is unchanged;
this caller repair is not new aggregate/window or excluded-family support.
Original broad exit1 1539/1543 four reds are not universally dispositioned by
this focused repair. C4 and direct REAL/expression-subquery regressions remain
retained; no global cleanliness or universal acceptance claim.

### Expression work-budget boundary repair (2026-10-04)

Pinned `src/func.c:hexFunc` and `src/vdbe.c` dispatch counter / `OP_Goto`
→ shared scalar SELECT setup/body routing in `vdbe.ts` and its input/function/copy
checkpoints → `test/conformance/run-expression-bounded-ts.mjs` (22 rejects,
23 reaches ROW with exact TEXT payload, saved error/reset/rebind). The old
`f1a5b3b` 19/20 boundary predates three executed routing jumps from `48bf18c8`.
The [living guide](TRANSLATION.md#expression-safety-budget-fixture-repair-2026-10-04)
records the inventory and independent pinned-native semantic/control comparison.
No runtime change, native/TS unit equivalence, new product coverage or default
budget increase is claimed.

### LIMIT-zero OFFSET phase adjudication (2026-10-04)

Pinned `select.c:2517 computeLimitRegisters` → LIMIT MustBeInt then zero branch,
then OFFSET expression/MustBeInt; `vdbe.c:2105/2747` → current shared
`computeLimitRegisters` in `vdbe.ts` (already correct at `1010b15`). Literal
integer zero uses upstream Goto; evaluated/coerced zero uses IfNot. Both skip
OFFSET at execution, not prepare-time name resolution. Native source-ID-checked
`limit-offset-adjudication-native.py` and public
`limit-offset-adjudication.test.mjs` consume identical 16 cases across three
encodings (48 preparations/96 executions per lane including reset/finalize).
The old ORDER runner zero-OFFSET error expectation was stale; no runtime edit.
See mutable audit adjudication for errors, exploratory gates and remaining reds.

- Generic scalar table-child LIMIT destination (revision 2026-10-04,
  [[card:card-m-f-j]]): pinned `expr.c:sqlite3CodeSubselect` 3933–3958 X<>0
  numeric normalization → `computeScalarLimitRegisters`, selected by
  `compileScalarSelect`'s table-child handoff to `computeLimitRegisters`;
  pinned `select.c:computeLimitRegisters` zero-before-OFFSET and combined
  sorter capacity → the remaining shared LIMIT register setup. Mem/Exists
  normalize; Set/IN and retained post-predicate producers keep row-count LIMIT.
  `order-limit-subquery-native.py` source-ID-verifies 51 exact typed native
  captures; `run-order-limit-contract-ts.mjs` compares full metadata and
  all-encoding rows/errors/reset/finalize, including text/NULL/zero/OFFSET and
  IN/outer-limit distinction. Bare derived outer ORDER admission is unchanged.

### Routed alias / membership ownership (2026-10-05, card-t-d)

- `resolve.c:642–702 resolveAlias` → `resolve.ts aliasUses/carrier` →
  `whereexpr.c:1827–1863 ExprUsage` → `where-plan.ts columnUse/prereq`:
  substituted identity owns direct-column admission and all-source readiness;
  joined `vdbe.ts resolveTree/compilePredicate` consumes masks before execution.
- `vdbe.c:5368–5438 Found` → `btree.c IndexMoveto` interval comparisons →
  `private-state.ts EphemeralIndexCursor.found` for sorted keys. Aggregate
  equality-EXISTS compiler emits `EphemeralSort` after once-only join/correlation
  key construction; VM executes sorting/probing through existing private control.
  Shared append invalidation/OpenDup, independent positions, KeyInfo/Mem and
  unsorted linear branch retained. Flat-array/merge-sort adaptation and exact
  regression/gaps: [report](research/card-t-d-routed-alias-b4-repair.md).

#### Working-tree repeated joins / original window input ([[card:card-k-h-b]])

`compileInnerTableSelect.rightStates`: whereInt.h WhereRightJoin/WhereLevel,
wherecode.c2740ff match insertion before interior, where.c WhereEnd reverse closure
and forward RightJoinLoop. Each cursor/key/return/body is independent. Window's
original input edge uses this shared producer with Yield, not raw nested scans.
`resolve.direct` FULL merged provenance and joined USING equality correspond to
resolve.c402ff/select.c583ff. Implementation is in progress, not accepted API
expansion: aggregate and adapted-upstream residuals and nonzero shared budget
measurement remain. WR composite match keys remain unsupported.

Working-tree follow-up: grouped aggregate input calls the same WHERE destination
(select.c updateAccumulator/WhereEnd); no local rewind patch owns these loops.
parse.ts identity-only SrcList splice preserves expression EList substitution
(select.c:substExpr3797–3898); join8-3030 UTF8 passes after this repair.
where-plan.ts binding/prereq treats FULL merged names as coalesce functions,
not the first physical column (resolve.c775; whereexpr.c:exprMightBeIndexed1085).
Full schedule/budget review remains open; this note does not change accepted API.

Latest all-encoding run is 87/90, with join8-3040 temporary unsupported in all
encodings after expression projection retention. `flattenOrdinaryDerived` still
requires one inner source and does not expand outer star from transient EList;
aggregate-parent substitution accepts multiple sources. Follow-up belongs to
select.c flattenSubquery/substExpr and result expansion, not parser expression
splicing. Keep this residual separate from the nine passing adapted assertions.

Follow-up: `flattenOrdinaryDerived` permits nonempty multi-source explicit EList
and expands parent star from its transient EList before substitution/splicing,
following selectExpander → flattenSubquery → substExpr. Inner producer stars remain
retained. All12 adapted assertion instances now pass, alongside60 supplemental
and18 controls (90/90 selected). Additional shared-budget boundary test passes3/3;
logical high-water225 UTF8/224 UTF16LE/BE, not a native allocation metric. Complete
nested-return review and final admission synchronization remain open.

Working resolved validation: vdbeaux.c995–1068 checked after builder finish label
resolution, traversing Return chains to owning register; explicit stop identities
permit source SELECT producer termination without treating arbitrary halt jumps
as continuation. New builder tests2/2, adjacent suite14/14. Broad229-file run:
220 successes/9 failures, including retained window-star affinity metadata and
obsolete structural assertions; see card-k-h-b status. Aggregate producer flatten
is excluded via semantic selectHasAggregate; transient collation guard alone does
not repair absent expression carriers for star-expanded source metadata.


### card-k-h-b follow-up: metadata owner repair (working tree, not final acceptance)
Expanded-star transient results have resolved source-column identity but may lack
a parser Expr reduction. Metadata now takes affinity/datatype masks from that
identity, retaining the Expr path and compound conflict/CAST branches. CTE star
names use expanded result metadata; CTE and ordinary derived descriptors retain
the resolved producer for declared-type provenance. This follows pinned
select.c:2340–2416 sqlite3SubqueryColumnTypes, not a token reconstruction.
The prior collation-only hypothesis was insufficient: affinity still crashed,
then CTE naming crashed, then declared type INT differed from native INTEGER.
Those observed failures motivated fixing the owning descriptor and its callers.

Fresh unconditional repeated-right-full is 99/99 (190978ms), including native
ordered typed rows/all five metadata fields across three encodings, adapted
upstream assertions and shared live-budget/yield controls. The inherited native
corpus was reused, not newly captured. The earlier integration result220/229
and its30s repeated-suite watchdog remain failures, not waived by this separate
run. Adjacent combined run122/123: sole obsolete aggregate scan structural
assertion; corrected to test actual RIGHT exclusion, then owner suite21/21.
Endpoint compile fixture now supplies table nRowLogEst required by the shared
WHERE planner; it is not a substitute runtime database. Source predicate
assertion tests shared resolved input producer, not the superseded raw walker.
Final source schedule audit, full regression/browser snapshot, public admission
synchronization and reviewed explicit-path commits remain outstanding.


### card-k-h-b scheduling and mixed merged-name follow-up (not final acceptance)
Test teardown now uses existing closeTestServer after connection cleanup. This
alone was insufficient: twelve adapted256-row upstream queries still take
approximately150s sequentially. Parallel twelve-query group passed100/100 but
took35s (above unchanged30s watchdog). Split by encoding into three discoverable
test files, four concurrent independent connections each; shared prototype and
timer probes stay sequential in repeated-right-full. No SQL/expected rows removed.
Focused integration four components completed within watchdog; combined102/102
then111/111 with nine new native-FIRST mixed USING cases.

Pinned resolve.c449–464 resets pFJMatch on a RIGHT USING successor. TS retained
the earlier FULL coalesce graph, causing FULL-RIGHT metadata mismatch in all
three encodings (six of nine new cases passed). Clear mergedSources on that
RIGHT branch; nine of nine now pass ordered typed rows and all metadata fields.
New frozen corpus repeated-merged-using.json SHA256
3eff93ea3700f866dfd319ffc4148de5e227a06a88ea435cb3513b642ee0c89b;
captured independently with pinned shared library before new TS assertions.
RIGHT-FULL and FULL-LEFT retain their appropriate graph.
Fresh built browser current38/38 and gap2/2 pass before this last resolver change;
therefore they are intermediate snapshot evidence, not final latest-tree credit.
Full integration reruns and final source review/contract/commit work remain open.

### card-k-h-b fresh working-tree checkpoint (not final acceptance)
Current per-WhereLevel match/return/body maps translate whereInt.h45–145,
WhereBegin7394ff, wherecode2740–end and WhereEnd7500ff into shared builder
ordinary scans, reverse closures and forward drains. Original window input
uses resolved SELECT/WHERE coroutine destination, retaining rewrite/framing.
Mixed USING RIGHT clears previous FULL graph (resolve.c449–464). Source and
fixture hashes plus current232/232 integration and focused6/6+9/9 evidence:
[card-k-h-b progress](research/card-k-h-b-runtime/progress.md). Complete owning
Return/stop and register/index payload review remains a delivery gate; historical
one-barrier baseline findings are not current runtime facts. WR composite keys
remain unsupported; no native allocator parity or universal composition claim.


### card-k-h-b continuation checkpoint (working tree, review pending)
Native-FIRST continuation corpus adds21 discriminators (seven x three encodings):
LIMIT0, unmatched-drain OFFSET, scalar/EXISTS stops, compound LIMIT, downstream
LEFT selected-index IN, and RHS selected-index unmatched drain. Public consumers
compare ordered typed duplicate rows and all five metadata fields, repeat after
reset/clearBindings, and reuse the connection. Independent pinned recapture
compares byte-identically; no expected values were revised to fit TypeScript.

The settled-target verifier now shares `reachesOwningReturn`: consecutive Return
opcodes must reach the owning register, with invalid/unsettled targets rejected.
Pinned vdbeaux.c995–1068 is debug verification, not runtime jump rewriting; TS
has no Noop/Explain opcodes. Producer-stop identities and coroutine/Gosub
boundaries remain distinct. Source reread confirms wherecode.c2740–end records
ON matches before interior/downstream WHERE, where.c WhereEnd closes reverse
and drains forward, and selected RHS indexes must be invalidated before drain.
Original window input uses physical cursor bindings across Yield; retained
register producers are not claimed covered by this input-edge change.

Fresh helper-tree evidence: focused122/122 plus typecheck; original gap6/6;
integration232/232 components, all three prerequisites exit0, input_drift=[];
build and Chromium current38+gap2=40/40. Exact commands/artifacts/hashes are in
`docs/research/card-k-h-b-runtime/{progress.md,hashes.json}`. These are internal
checks, not parent independent acceptance or complete owning-path fidelity
approval. Explicit-path/hunk commit review remains pending; inherited bitwise
changes in vdbe.ts/run-advanced-index must not be staged as this card's work.


### card-k-h-b continuation caller checkpoint — 2026-10-05 (post-v24)
Bounded caller review found an admitted ordinary-derived projection metadata
error: native-FIRST `derived-filter-admitted` returned column names k/v while
TS returned qualified j.k/j.v in all three encodings (0/3 public contracts).
`flattenOrdinaryDerived` now preserves the resolved transient column name before
producer substitution, as select.c sqlite3GenerateColumnNames/substExpr do;
explicit AS names remain authoritative. Aggregate lowerResult now distinguishes
only the generated FULL USING coalesce column leaf from parsed function calls,
instead of skipping recursion for arbitrary calls with carrier children.

Continuation corpus now has 33 native captures (11 x3), independently recaptured
byte-identically. Public checks are 30 admitted typed-row/all-five-metadata/reset
contracts plus three honest temporary-unsupported checks: ordered physical-derived
filter remains an existing declined route, not native-success TS credit. The
new un-ordered filter is admitted and passes. Do not infer universal derived ORDER
or aggregate/correlation admission. This extends, not replaces, the 21-case history.
Focused five-file run passes165/165; original FULL/FULL/window gap6/6 and typecheck
pass. Complete delivery review/explicit own-hunk commits remain pending; internal
checks are not independent parent acceptance. Exact evidence is in
`docs/research/card-k-h-b-runtime/progress.md` and hashes.json.

### card-k-h-b R4 residual owner
`wherecode.c:sqlite3WhereRightJoinLoop`2842–end → `rightJoinResidual` in where-plan.ts and forward drains in vdbe.ts: readiness/origin/LTORJ extraction, null previous/index state, copied jointype0 source, shared one-source SELECT/WHERE scan, exact membership and owning subroutine. `whereexpr.c:sqlite3WhereExprAnalyze`1885 → base-before-virtual publication with parent/child IDs remapped. `expr.c:sqlite3ExprCodeIN` / TK_IN5505 → scalar resolved IN operands consume column cursor identity before compilation. Public right-residual tests cover native30 across encodings, early downstream positioning/reset and sticky first-error/reuse; they do not claim full WHERE/vector optimization or native work counts.

### card-k-h-b R5 SELECT usage owner
whereexpr.c997–1023 /1827–1863 -> where-plan.ts prereq: relevant resolved SELECT graph, owning clauses and compound arms, same enclosing source identity mask, alias/merged substitution. wherecode.c rightJoinLoop readiness caller unchanged. expr.c sqlite3CodeSubselect scalar LIMIT1 -> vdbe.ts resolvedScalarSubqueryEmitter closes synthesized as well as explicit ifZero; settled RIGHT verifier remains verification, not rewriting. Tests right-nested/where-plan-analysis: native24, public21 success+3 typed IN boundary, downstream3 starts per execution, saved-error/reset/reuse across encodings. Transitive no-FROM scalar admitted; no global correlation admission. See research/card-k-h-b-runtime/r5.md.

### Outer-constraint owner
`wherecode.c`2740–2833 match/hit/BeginSubrtn/code_outer_join_constraints and `where.c:sqlite3WhereEnd`7525–7712 → `compileInnerTableSelect` invocation-local WHERE coded state, ready/LTORJ checks, post-hit shared body and owning continuation. Immutable `analyzeWhere(...,true)` publishes base identities; ON/virtual terms are excluded. LEFT NullRow re-enters constraint body; unmatched Gosub shares it, while drain extraction remains independently owned. `outer-constraints.test.mjs` native FIRST24 typed/all5/reset plus physical-position/error/work contracts; [R6 evidence](research/card-k-h-b-runtime/r6.md). No general optimizer or native work parity claim. `run-index-planner-ts.mjs` checks the LEFT matched/NullRow term count (five: one ON plus two WHERE checks per body entry); `select-scalar-child.test.mjs` retains enclosing-builder ownership with the zero-width range guard. Repair evidence: [[card:card-k-f]] `status.md` (diagnosis v24).

## Optional STAT4 loading and selectivity consumers

`analyze.c:sqlite3AnalysisLoad/loadStatTbl/initAvgEq/decodeIntArray` →
`schema.ts` physical Index-owned raw padded samples, NOCASE grouped capacity
and alias skip, original-order load and average initialization. Temporary stat1
raw counts are discarded after loading; no-stat1 files can still load samples.
Samples now feed the bounded literal equality/IN/scalar-range consumers;
not a general STAT4 cost/plan parity claim.
`sqliteInt.h:IndexSample` ownership maps to privately copied bytes (inspection
returns copies), frozen count arrays, and connection/storage cache lifetime.
`storage.ts` owns an internal checked logical schema envelope derived from the
configured acquisition allowance; it is not maxPrivateBytes or a new public
budget. Prepare checks work/cancellation/deadline in passes and bounded copies;
synchronous prepare does not promise event-loop preemption. Packed sample comparison now shares KeyInfo/Mem with an active RHS nField
and errCode/eqSeen channel (`comparison.ts:compareStat4RecordKey`, pinned
`vdbeaux.c:sqlite3VdbeRecordCompareWithSkip`, skip=0). Numeric padded reads and
matching text/blob bounds preserve branch-specific malformed handling; normal
record/seek callers retain strict decoding. `stat4-probe.ts` translates builder-local literal/unary/CAST/COLLATE/NULL
extraction from existing Lemon semantic productions and all-slot Mem cleanup.
NOTFOUND is not SQL NULL; parameters mark sensitivity and explicitly fall back
(no initial binding plan-parity claim). Unsupported expressions/functions remain
unavailable, not a parallel evaluator. Prefix scopes restore nField/nRecValid;
KeyStats/selectivity consumers map below.

Tests: `stat4-count-primitive`, `stat4-average-primitive`,
`stat4-loader-primitive`, `stat4-schema-lifecycle`, `stat4-comparison-primitive`, `stat4-probe-primitive` under `test/conformance`,
and `docs/research/card-s-h/first-owner.test.mjs`. Detailed current delivery
and resource accounting: [[card:card-s-h-b]] status. Original admission provenance
is unchanged: [admission evidence](research/card-e-h-stat4-admission.md),
`private-alpha-stat4-admission.test.mjs`, `stat4-enabled-boundary.test.mjs`,
`stat-record-boundary.test.mjs` and paired non-STAT4 oracle capture
`private-alpha-stat4-portability-native.py`.

`wherecode.c`2500–2505/2618–2630 OR_SUBCLAUSE notReady/untested terms →
`emitJoinedOr` per-term prereqAll readiness checks and ordinary level-aware
`codeOuterConstraints` full untested parent residual. Fully tested OR parents
are omitted invocation-locally; selected exact constraints and eligible commuted
parents use `branchConsumedTerms` as mapped above, without mutating shared terms.
Tests/evidence: [not-ready residual repair](research/card-s-f-or/verification.md#not-ready-arm-residual-ownership-repair).

Represented-inner Case5 common iCovCur/pCov → `emitJoinedOr` level continuation
and WhereEnd covered Column/Rowid rewrite; Case4 end-bound producer precedes
patched IndexRangeEnd branch PC. Mixed-index invalidation/full residual/three-encoding
public trace tests: [inner covering evidence](research/card-s-f-or/verification.md#represented-inner-common-covering-relationship-repair).

| `resolve.c:resolveSelectStep` NC_AllowAgg classification; `expr.c` TK_AGG_FUNCTION | `resolve.ts` WHERE admission retains result/GROUP aggregate state; existing codegen owns missing aggregate context error. Unchanged scalar no-FROM preparation regression; [evidence](research/card-s-f-or/verification.md#aggregate-where-error-phase-ownership). |

Low-multiplier literal-IN: where.c3396 flag → positional admission/capability `inSeekScan` (default enabled; explicit-disabled control); wherecode.c2043 → shared `emitPrefixSeek` GE-only descriptor, `(rowLogEst[0]+9)/10` steps/range marker; joined1965 → `IndexNullRow`/clearPosition; vdbe.c5093–5200 → `IndexCursor.seekScan` and VDBE register/cache/destination/control/accounting wrapper. `skipscan-lowmul-producer`, `skipscan-prefix-code`, `skipscan-seekscan-state`, `skipscan-seekscan-vdbe` tests and disposable compiled native-first lowmul proof cover represented branches. Default no-skip low-multiplier SQL production now enabled and native-tested; skipped-prefix gate remains fenced; normal IN earlyout/SeekHit/SeekEq broader owner fidelity still open (flagged source path suppresses them). Source5337 IN order handling retained. [Chronology and gaps](research/card-s-g/IMPLEMENTATION.md); no default/whole optimizer credit.

where.c3588 secondary nColumn/primary nKeyCol recursion limit → capabilities physical fieldCount independent of skipScan; default lowmul producer and public proof assert ordinal3 rowid bound and GT4 (GE3 without range). [Evidence](research/card-s-g/IMPLEMENTATION.md). Full cost/order traversal closure remains separately open.

where.c3284/3580–3613 insertion/recursive-return order → shared proposal feedback for default ordinary as well as skip/OR index frames; zero debit OK, next insertion DONE, child return ignored. where-plan-analysis source state tests distinguish construction/IteratorClose/frontier; ordinary scalar transitive whereScanNext now shares original term/RHS physical-target admission and ready/commuted/residual lowering; borrowed IN unadmitted. [Evidence](research/card-s-g/IMPLEMENTATION.md).

whereScanNext equivalence slots → default capabilities borrowed scalar admissions (original term/orientation/RHS affinity and physical field); existing joined bound extraction and ready masks/residual evaluation consume them. Native-first transitive-native.json/script and default public proof exercise equality, commuted join/LEFT and empty ISNULL. [Evidence](research/card-s-g/IMPLEMENTATION.md). No borrowed-IN/vector or whole equivalence machinery claim.

wherecode979 EQ NULL addrBrk vs2000/2102 bound NULL addrNxt → existing equality/final vs prefix guards; null-in-native.json public private-seek tests assert distinct exits, nested IN and NOTNULL residuals. Default corruption/recovery/memory test modes validate existing source-based error/reset/cleanup owners without admission-copy edits; evidence in IMPLEMENTATION.md.

Historical checkpoint: missing linked NOTNULL/VNULL producer/consumer predictions are superseded by the current linked NOTNULL owner mapping below; retain primitive captures and chronology in [IMPLEMENTATION](research/card-s-g/IMPLEMENTATION.md).

### Linked NOTNULL range owner
whereexpr.c1331–1360 → where-plan.ts analyzeClause linked virtualNull GT child; where.c1921/2229/3292 → rangeRows and proposal admission; wherecode.c1997/2099 → ordinary/joined/OR VNULL guard exemption and normal end-NULL exit in vdbe.ts; aStartOp1852/2041 → where-prefix.ts zero-key Rewind/Last positioning. Column-only, excludes rowid/IPK/outer-ON; no additional expression/join admission. Producer regression and native-first NULL/caller public evidence: [implementation evidence](research/card-s-g/IMPLEMENTATION.md). Direction/end controls are covered by notnull-directions-native.json and skipscan-position-owner.test.mjs; complete matrix closure remains a review obligation.

- wherecode.c2026 (nConstraint==nSkip) → `where-prefix.ts` positioned fall-through with carried keys/affinities; ordinary/joined/joined-OR consumers in `vdbe.ts` preserve restart/final/OR-return ownership. Source state tests: `skipscan-position-owner.test.mjs`; public/native mapping: [prefix continuation evidence](research/card-s-g/IMPLEMENTATION.md), `prefix-position-native.json`. Native OR companion exercises strict restart/cleanup but not reversed OR no-reseek selection.

- wherecode.c2431 recursive OR `sqlite3WhereBegin(...,0,...)` → where-plan.ts OR-arm `orderBy:[]`; outer ASC/DESC does not reverse arm positioning. Tests: `or-order-position-native.json` through `skipscan-compiled-copy.test.mjs` strict GE/GT private bounds and typed/reset comparisons; [evidence](research/card-s-g/IMPLEMENTATION.md). where.c3618/5289 boundary Cartesian state tests: `skipscan-planner-producer.test.mjs`64 combinations (native threshold proof remains separate).

- Physical DESC suffix endpoint comparison (wherecode.c range-start/end lowering) → `vdbe.ts` rangeReverse + shared prefix positioning; `desc-or-end-native.json` through public `skipscan-compiled-copy.test.mjs` verifies strict GT/2 versus inclusive GE/2 and strict GT/1 restarts. Other captured OR/IN/NOTNULL shapes are SCAN controls, not selected consumer credit; [evidence](research/card-s-g/IMPLEMENTATION.md).

- where.c2749/5353–5364 XN_ROWID order and separate iSortIdx → `resolvedWhereOrder`/OrderRequirement null rowid carrier, ordinary scan and physical-tail consumers in `where-plan.ts`; producer rowid-sort-owner regression and desc-selected native/public evidence in [IMPLEMENTATION](research/card-s-g/IMPLEMENTATION.md). Shared ordinary/joined resolver ORDER handoff preserves XN_ROWID; bounded controls close the former exhaustion/selection discrepancy.

- wherecode.c2090ff RHS/NULL-before-end branch → joined `emitJoinedOr` records actual IndexRangeEnd opcode after bound emission, not pre-expression position. Final-op zero-reset assertion and native SCAN selection regression: [IMPLEMENTATION](research/card-s-g/IMPLEMENTATION.md).

- wherecode.c2431 recursive OR passes no ORDER BY → physical-forward shared restart. Native-selected DESC ordinary/joined OR18 shapes36 reset executions (GT/1 and suffix GT/2/GE/3): [coverage ledger](research/card-s-g/COVERAGE.md), desc-recursive-native/capture-desc-recursive.

- where.c3060/3595 sqlite3ProgressCheck → WherePlanBudget.progressCheck, outputAdjust unused-term branch and capabilities deep equality recursion; SelectProgramBuilder/compileSelect shares prepare control with recursive OR. [Construction evidence](research/card-s-g/COVERAGE.md#construction-progress-repair); skipscan-construction-progress structural reproducer and producer/public behavioral tests.

- where.c2662–2697/2740ff → properSubset/whereLoopAdjustCost/whereLoopInsert: skipscan-dominance-matrix2304+5184 bounded branch cases; build.c convertToWithoutRowid/isDupColumn → physical declared count/PK suffix: skipscan-wr-layout plus wr-layout-native18 selected shapes. [Remaining matrix evidence](research/card-s-g/IMPLEMENTATION.md#remaining-matrix-increment-after-focused172), [ownership handoff](research/card-s-g/HANDOFF.md).

- where.c4835 LEFT-allowed OR admission /7694–7703 covering NullRow → where-plan btreeLoops and vdbe joined WhereEnd orCovering cursor: mixed-native30 shapes60 resets/private strict-prefix bounds, matched/exhausted/composite LEFT ON-OR. [Repair evidence](research/card-s-g/IMPLEMENTATION.md#left-on-or-accepted-red-repair).


WHERE full-index admission/order: where.c4233–4295 → `where-plan.ts:indexProposals` before recursive `capabilities`; where.c4290/2838–2866 owning full-index DONE → explicit insertion-result carrier and three-encoding completion regression in `where-plan-analysis.test.mjs`. where.c3238–3650 empty recursive scan → no phantom proposal; three-encoding production empty-cost/debit control. Shared internal `whereLoopAddBtreeIndex`/`btreeIndexLoops` use the same runtime capability, cost and insertion owners; direct recursive parent/child DONE budget controls isolate already-admitted templates, not AddBtree full scans. [Open d9 preservation investigation](research/card-s-g/IMPLEMENTATION.md#d9-analysis-preservation-investigation-b-2026-10-08); unchanged joined-WR movement native companions/public probes and source budget controls. Partial-key GE default_rc: vdbe4943–4952 → `IndexCursor.seekKey`; advanced-index production probes assert biased nonzero comparisons with live KeyInfo/values and physical positions, not unbiased exact equality. [Integration repair evidence](research/card-s-g/IMPLEMENTATION.md#integration-preservation-repair-b-2026-10-07). No new cursor substitution or general optimizer acceptance.

| Upstream owner | Current translation and tests |
| --- | --- |
| `select.c:8531,8884 sqlite3WhereBegin/End` joined aggregate input | `vdbe.ts:compileAggregateSelect` → existing `compileInnerTableSelect.consumeRow` / `planWhere`; group sorter capture and implicit update use positioned physical cursors. `aggregate-where-chinook.test.mjs`, outer/phase/derived aggregate suites. [Bounded evidence](research/card-l-c/aggregate-where-consumer.md). |

### Execution host-task adaptation

`vdbe.c:sqlite3VdbeExec`, `check_for_interrupt`, progress `nProgressLimit`;
`vdbeapi.c:sqlite3_step/reset/finalize`, `vdbeaux.c:sqlite3VdbeHalt/Reset` →
Vdbe checkpoint/control/error/lifecycle owners in `src/internal/vdbe.ts`; shared
browser wait policy in `src/internal/task-scheduler.ts`. Host-task delivery is a
bounded browser adaptation, not native VM-step/timing parity. Source rationale
and evidence: [card-h-e](research/card-h-e/green.md). Tests:
`test/select/task-scheduler.test.mjs`, `test/browser/scheduler-controls.mjs`,
`test/browser/scheduler-latency-green.mjs` (unchanged red-program comparison),
`test/select/first-select.test.mjs` (overflow/lifecycle).

STAT4 primitive verification: `vdbemem.c:valueFromExpr` token affinity/encoding
maps to `stat4-probe.ts` and `stat4-value-oracle.c`/`stat4-probe-primitive.test.mjs`;
`vdbeaux.c:sqlite3VdbeRecordCompareWithSkip` padded malformed controls map to
`stat4-padded-record-oracle.c`/`stat4-padded-oracle.test.mjs`. Schema copy/count
checks and prepare retry map to `stat4-prepare-controls.test.mjs` and lifecycle
regressions. Detailed commands, identities and limits: [[card:card-s-h-b]] status.
Consumers/selectivity estimates remain pending.

### STAT4 selectivity callers

- `where.c:whereLoopAddBtreeIndex` sPk exploration and `wherePathSatisfiesOrderBy`
  complete obSat → ordinary rowid streaming proposals (shared with OR costing)
  and full outer ORDER retention in `where-plan.ts`; independent public caller
  typed rows/metadata/reset/qualitative work: `research/card-s-h/caller-first.test.mjs`,
  [evidence](research/card-s-h/c-red/callers-progress.md). Partial joined ordering
  remains conservative; not exact selected-index or VM-count parity.
- `where.c:whereKeyStats` 1718ff → `stat4-estimate.ts`: virtual-prefix binary
  search, comparison metadata extent, exact counts, unsigned gap interpolation.
  `stat4-keystats-oracle.c` independently invokes the pinned internal routine;
  `stat4-keystats.test.mjs` checks three encodings, DESC multicolumn virtual gaps,
  overflow/zero counts, malformed comparator error channel and extent restoration.
- `whereEqualScanEst/whereInScanEst/whereRangeScanEst`, AddBtreeIndex 3490ff →
  `where-plan.ts:sampleFrames/sampleEquality/sampleRange/indexLoopEstimate`:
  recursive proposal-owned extraction/restoration through insertion and children,
  represented literals/IS/NULL/list IN, known contiguous prefixes, ordinary scalar ranges.
  Frame-close/error and unavailable-member sibling controls are in
  `stat4-keystats.test.mjs`.
- `whereLoopOutputAdjust` 3088ff, second pass 7090ff and
  `whereInterstageHeuristic` → builder truth sets, complete construction rebuild,
  ordered solver search-preservation. Completed selections copy mutable flags
  into frozen clause-owned arrays, including empty fallback publication;
  `whereBegin`6865 initialization precedes fallback as well as AddAll: fresh
  mutable carrier and matching empty publication ([fallback evidence](research/card-s-h/c-red/fallback-progress.md));
  [publication evidence](research/card-s-h/c-red/publication-progress.md).
  `public-first.test.mjs` tests actual public
  rows/metadata/reset/errors and private selected cursor work; second-pass controls
  are in `stat4-keystats.test.mjs`. `wherePathSolver`6168 empty-frontier
  cleanup/error → `SqlParseError` (`SQLITE_ERROR`1 / `no query solution`), not
  unsupported-construct fallback. Finite AddAll native controls:
  [frontier evidence](research/card-s-h/c-red/frontier-progress.md).
  `whereBeginError/whereInfoFree`7482 → `planWhere` failed invocation restores
  prior owner carrier/frontier; [work/reservation unwind evidence](research/card-s-h/c-red/unwind-progress.md).

- `vdbemem.c:valueNew/sqlite3Stat4ProbeFree` → `stat4-probe.ts` all-field
  metadata/Mem reservation, per-slot lexical/value high-water reservation and
  all-slot release; `storage.ts:reserveSchemaTemporary` checks the shared logical
  schema envelope. `btree.ts` forwards connection ownership and `vdbe.ts` supplies
  it to ordinary and selected OR-arm builders. Reservation/second-pass/work-error
  controls are in `stat4-keystats.test.mjs`.

Current bounded consumer limits: vector/function/subquery probes and skipscan
sample range refinement remain untranslated; parameter sensitivity retains fallback,
not sample costing or reprepare parity. AddAll limit initialization, nested carrier/
frontier restoration and finite OR/join failure controls are delivered, not open
primitive omissions. Exact selected schema/physical owner and whole-rebuild cleanup
map to `research/card-s-h/d-diagnosis/selected-owner.test.mjs` and
`rebuild-checkpoints.test.mjs`; schema failure/accounting and input identity map to
`schema-checkpoints.test.mjs`, `schema-envelope.test.mjs`, `input-closure.test.mjs`.
[Consuming source review and evidence](research/card-s-h/d-diagnosis/MAPPED_REVIEW.md)
supersedes provisional integration status; historical
[c consumer evidence](research/card-s-h/c-red/consumer-progress.md) retains provenance.
Consumer owner [[card:card-s-h-c]]; loader/comparison owner [[card:card-s-h-b]].

### Sequential overflow payload ownership

`btree.c:accessPayload` current-page fetch/copy before successor progression maps
to `BtreeDatabase.payload` consuming `payloadChunks` (no eager discovery pass).
Existing cycle/range/maxOverflowPages and strict terminal-link validation remain;
the terminal check is project admission, not malformed-byte parity. Owning real
loader/progress/primary-error and primitive controls:
`docs/research/card-s-h/c-red/overflow-owner-red.test.mjs` and
`overflow-order-owner.test.mjs`; storage coverage: `test/storage/btree-reader.test.mjs`.
Adoption hashes/commands/results: [[card:card-s-h-b]] status; original consumer
provenance: [request](research/card-s-h/c-red/overflow-adoption-request.md).

### Parameter-sensitive STAT4 reprepare

`vdbemem.c:sqlite3Stat4ProbeSetValue` TK_VARIABLE and
`vdbeaux.c:sqlite3VdbeSetVarmask` → `reprepare.ts:ReprepareContext`,
`stat4-probe.ts` and `where-plan.ts` existing equality/IN/range sample extraction.
The enclosing `select-compiler.ts`/`SelectProgramBuilder` owns the context and
publishes the mask. Initial preparation records slots with unavailable values;
reprepare copies retained bound Mem and applies affinity in sample extraction.
`vdbeapi.c:unbind/clear_bindings` → `VdbeStatement.bind/clearBindings` expiration;
`prepare.c:sqlite3Reprepare`, `vdbeapi.c:sqlite3_step` retry/error ownership and
`vdbeaux.c:sqlite3VdbeSwap/ResetStepResult`, binding transfer → saved preparation
closure in `index.ts`, replacement before VM execution in `vdbe.ts`. Off-handle
compile precedes replacement; public handle/binding owner survives. Immutable
read-only schema means one expiration replacement, with no schema-change retry
loop or configurable native prep flags. No new public handles are registered.
Tests: `test/conformance/stat4-parameter-reprepare.test.mjs`; native/baseline/current
and verification limits: [evidence](research/card-h-b-reprepare/README.md).

### Internal packed private-key VM seam

`vdbe.c` OP_MakeRecord serial-header/payload → `record-pack.ts`; OP_OpenEphemeral,
Found/NotFound (register and packed probes) and IdxInsert → explicit `private-key-vm.ts` state owner in `vdbe.ts` → accepted
`PrivateBlobkeyPages`/`PrivateBlobkeyCursor`. MakeRecord snapshot regression and
reset/new-open work/cancel probes: `test/value/private-key-vm.test.mjs`;
revision-bound evidence [[card:card-s-i-c-b-a]]. Packed publication reseeks through
primitive Insert; scalar USESEEKRESULT authority is deliberately unavailable.
Legacy ephemeral iterators and WR lowerers are unchanged. This mapping does not
claim complete NotFound/unpacked/P5/lifecycle matrix or public WR admission.

GROUPS UNBOUNDED..offset PRECEDING ordinary registered aggregates:
windowCodeOp IfPos(regEnd), peer Next/Delete -> pendingPriorPeerLayer,
shared emitCurrentPeerFlush regEnd countdown/independent end-peer KeyInfo loop;
lookahead singleton/duplicate/partition/reset/literal2/parameter0,1,2,9 regressions;
three-encoding typed NOCASE/DESC/NULL retention counters and saved step-delete
error/cleanup controls. Evidence window-owner-correction.md.

GROUPS PRECEDING..CURRENT ordinary aggregates: CodeStep3007-3036 /
CodeOp IfPos regStart peer inverse -> pendingCurrentPeerLayer sourceSlidingPeer,
start countdown/lookahead and shared flush. Singleton/duplicate/partition/reset
lookahead tests; typed three-encoding0/1/2/parameter retirement, parameter0/1/2/9
reset/rebind, saved post-output inverse-delete error/cleanup; correction receipt.

GROUPS PRECEDING..FOLLOWING ordinary aggregates: CodeStep3025-3034/3090-3098
regEnd skip return+inverse / flush return EOF before inverse -> sourceFollowingPeer
outputCountdown and independent current/start peer lookahead. Singleton/duplicate/
partition/reset tests; typed three-encoding FOLLOWING0/1/2/parameter,
parameter0/1/2/9 independent singleton/duplicate peers, flush inverse-delete
saved error and budget cleanup; correction receipt.

GROUPS UNBOUNDED..FOLLOWING: windowCodeOp2250 inverse no-op and CodeStep
3025/3090 current-return owner -> pendingCurrentPeerLayer/sourceFollowingPeer,
return-row Delete-before-Next including final EOF; singleton/duplicate/partition
reset controls; typed three-encoding end0/1/2/parameter, parameter0/1/2/9
reset/rebind and first/final post-return Delete saved-error cleanup; correction receipt.

GROUPS CURRENT..FOLLOWING: CodeStep3025/3090 and CodeOp2250-2282 -> same
current/start peer owners with zero start countdown; singleton/duplicate/partition
reset tests; typed three-encoding end0/1/2/parameter, parameter0/1/2/9
reset/rebind and flush inverse-delete error cleanup; correction receipt; final
current EOF skips inverse.

GROUPS FOLLOWING..FOLLOWING: window.c2962/2996/3075-3088 ->
sourceFollowingStartPeer start=end-start, independent return/inverse countdowns,
flush end-=start/start=0, start EOF return-only tail and output EOF termination;
return deletion, singleton/duplicate/partition/reset/end2/9 tests. Zero/parameter starts retain without Delete (window.c2843); parameter
start/end0/1/2/9 reset/rebind singleton/duplicate plus typed literal0 all three
encodings exercise the same countdown owner. Reversed same-kind frame window.c2948-2960
-> pre-peer IfRegisterGt, empty AggValue/Yield/shared clear; start2/end2,9/9,
2/1 empty/partition/reset tests.

GROUPS FOLLOWING lifecycle evidence: typed three-encoding positive1/2/parameter1
start/end9/reset twice (literal return-deletes, parameter retains), flush
post-return Delete failure and retained inverse callback fault preserve first
error/reset identity/refund; correction receipt. Injected method/state faults
are not actual deadlines/partial-delete/native certification.

GROUPS PRECEDING..PRECEDING: window.c3002-3008/3050-3055 ->
pendingPriorPeerLayer plus sourceSlidingPeer independent countdowns, unconditional
current return; singleton/duplicate/partition/reset tests. window.c2948-2959 reversed end>start returns empty/reset shared eph.
Parameter start/end0/1/2/9 singleton/duplicate/reset/rebind and typed equal1/2/
parameter1 three encodings test the independent peers. Correction receipt.

GROUPS UNBOUNDED/CURRENT/PRECEDING..UNBOUNDED: window.c3010-3040/3090-3099 ->
sourceUnboundedEndPeer pending admission end-step only, flush final end-peer
then independent current-return/start-inverse loop. Six admissions before output,
preceding4/current5/cumulative6 retires; partition/reset and bound0/1/2/9 tests.
FOLLOWING start: window.c3065-3088 return regStart countdown, inverse0,
start EOF return-only tail; no absent-end arithmetic/reversed guard. Parameter
0/1/2/9 singleton/duplicate/reset/rebind and literal1 partition/all6 retirements
exercise owner. Cached FOLLOWING typed equal1/2/parameter1 starts UTF8/16LE/16BE
NULL/REAL/BLOB/NOCASE DESC/reset twice plus first/final return Delete and
retained inverse-count fault tests preserve first-error/reset identity/refund0.
Injected faults are not natural SQL/deadline/partial-delete/native certification;
correction receipt.

window.c2101-2217 windowCodeRangeTest -> vdbe-primitives.windowRangeTest ->
VDBE WindowRangeTest; emitters carry KeyInfo nullsLarge. Internal int64/mixed
storage/collation/BIGNULL tests: test/value/window-range-test.test.mjs.
window.c rewrite sort duplication / expr.c exprDup/sqlite3ExprListDup ->
WindowRewriteSortTerm.sourceExpression retains resolver identity alongside
copied producer expression; emitProducerBinding binds original carrier. Public
int64 scalar ORDER and scalar partition/ORDER DESC/reset in UTF8/16LE/16BE:
window-bounded-lookahead. RANGE pending schedule remains a failing TODO;
no source-selected scheduling certificate.


### Functional schema admission checkpoint

Trigger admission checkpoint maps parse.y trigger_decl/trigger_cmd_list and cmdx, tokenize.c sqlite3RunParser, trigger.c sqlite3BeginTrigger/FinishTrigger and prepare.c corruption context to parse.ts, lemon-runtime.ts and schema.ts. Single-source generated dependency identifiers map resolve.c TK_ID/TK_DOT component ownership to vdbe.ts expressionFromReduction/assignTableExpression retained terminals, tested by [all-encoding quoted identifier native capture](research/card-e-h-functional-schema/capture-identifiers.py) and [typed public callers/reset](research/card-e-h-functional-schema/identifiers.test.mjs). Retained step trees are not write execution; bounded database fixation/variable initialization is implemented; attach.c fixSelectCb/fixExprCb and walker.c SELECT/source/subquery/window ordering now have competing-error controls; initialized named-source/DML-target fixedSchema/fromDDL/notCte/hadSchema flags and expression fromDDL are retained separately from originals; full semantic Select/CTE and window linkage plus untested generated placements still require closure. See [source/evidence and four-category readiness](research/card-e-h-functional-schema/README.md).

- `build.c:sqlite3TableColumnToStorage` → `schema.ts:tableColumnToStorage`;
  `build.c:sqlite3EndTable`2763 / `resolve.c:sqlite3ResolveSelfReference`
  → `schema.ts` all generated-definition validation before Table publication;
  `prepare.c:sqlite3InitCallback` schema error → CORRUPT schema-name diagnostic.
  `select.c:selectExpander`6036 source lookup → existing admission graph traversal
  `selectGraphNeedsSchema`, public entry uncached source-free schema carrier.
  Tests: `generated-consumer-diagnostics.test.mjs` / digested native18 capture,
  repeated prepare/cycle BUSY cleanup and same-connection SELECT1 recovery.
  `resolve.c:sqlite3ResolveSelfReference` → `resolve.ts:resolvedGeneratedExpressionCarrier`
  over immutable reductions and the consuming ResolvedSource;
  `expr.c:sqlite3ExprCodeGetColumnOfTable/sqlite3ExprCodeGeneratedColumn/TK_COLUMN`
  → `vdbe.ts:bindResolvedExpression/compileExpressionTree`, joined direct result
  lowering and grouped logical payload capture. Aggregate/sorter locations precede
  VIRTUAL cursor expansion; NullRow precedes dependencies/affinity. Tests:
  `generated-consumer-binding.test.mjs` and digested native fixture/typed capture;
  [caller/branch map and limits](research/card-t-c-generated-consumers/README.md).
  `where.c:whereAddIndexedExpr` / `expr.c:sqlite3IndexedExprLookup` direct
  generated-column portion → single-source `assignTableExpression` selected
  covering logical field reads; noncovering dependency expansion remains.
  Native INDEXED BY composite VIRTUAL/STORED covering/noncovering and outer
  controls plus full metadata in the same differential test. Generic expression
  matching/subtype/null-fallback machinery and STRICT remain pending.

- `parse.y:filter_over`, `walker.c:walkWindowList`, `attach.c` fixation →
  `schema.ts:fixTriggerTree` combined Window field order and initialization
  caches; `walker-order.test.mjs` all-encoding native competing-error/retry
  assertions ([evidence](research/card-e-h-functional-schema/README.md#combined-window-field-order-repair)).

- `window.c:sqlite3WindowOffsetExpr`, `expr.c:exprNodeIsConstant` unresolved
  branches → `schema.ts:constantWindowOffset`, semantic-owned frame_bound NULL
  normalization; `walker-order.test.mjs` native39 including syntax and retained
  originals ([evidence](research/card-e-h-functional-schema/README.md#window-bound-semantic-normalization)).


## Assembled bounded functional-schema admission

The exact patch against b0206817ce8781f937e8fe793b1e964db0ba0c65 in
`docs/research/card-e-h-delivery/scoped.patch` admits retained immutable triggers
without write execution and the tested single-source STORED/VIRTUAL/quoted
identifier consumers. Original SQL/reductions survive initialized source fixation
and nonconstant frame NULL normalization. Combined Window field order and failed
construction retries are source/native-controlled. Full Select/CTE/UPDATE-FROM
semantic walker, interruption/depth parity, STRICT and alternate generated
producers remain temporary backlog, not permanent exclusions. This is bounded
admission, not whole compatibility or optimizer acceptance. Assembly evidence:
`docs/research/card-e-h-delivery/README.md`.

### Generated dependency lifetime correction (review24)

The prior isolated3957684 delivery remains review-withheld, not MAIN. Its binary
cycle diagnostics did not establish scalar BUSY lifetime. The shared binder now
forwards the same per-source map through CASE/BETWEEN/IN-list and aggregate
argument/filter/order edges, matching expr.c4449–4464 whole-generation BUSY;
finally, source identity, aggregate/register precedence and NullRow are preserved.
Native-first boundary81 evidence and precise revised isolated export/review status:
[generated consumers](research/card-t-c-generated-consumers/README.md).
No full NC_GenCol/lazy-schema/STRICT/generic indexed-expression claim follows.

### STRICT ordinary persisted reads

Generated table-option semantics publish immutable `strict` metadata. Schema
initialization follows build.c sqlite3EndTable's column-order type validation:
INT/INTEGER/REAL/TEXT/BLOB/ANY only, missing/custom type is corruption for stored
SQL, ANY has BLOB affinity and non-rowid primary keys gain implicit NOT NULL.
Ordinary ANY remains NUMERIC. Read lowering consumes catalog affinity rather
than re-inferring from decltype, including generated values; this is not CAST or
write enforcement. STRICT VIRTUAL reads use the expr.c/vdbe.c single-column
TypeCheck branch (including REAL type and datatype errors); PK declaration errors
precede STRICT type validation. See [boundary evidence](research/card-e-h-strict/boundaries-README.md).
Existing shared generated admission/consumers remain bounded:
full NC_GenCol/lazy/error/dependency and generic index-expression parity is not
implied. Evidence/limits: [STRICT receipt](research/card-e-h-strict/README.md).

## Bounded vector field consumer

- `parse.y:1333` TK_VECTOR → `vdbe.ts:expressionFromReduction` ordered fields.
- `expr.c:697–785 codeVectorCompare`, `vdbe.c:OP_ElseEq` → scalar-field
  comparison lowering/explicit equality continuation in `vdbe.ts`.
- `expr.c:sqlite3ExprCodeIN` step 6 Rewind/Ne/Next → literal vector RHS shared
  EphemeralIndexCursor/KeyInfo insertion and InSet field fallback scan;
  statement encoding and Mem affinity/collation, no host comparator/Set.
- Tests: `test/conformance/row-vector/public.mjs`, `lifecycle.test.mjs`;
  [partial evidence and remaining expected-width producer gap](research/card-i-b-row-vector-repair.md).
- `select.c:SRT_Set/SRT_Mem`, `expr.c:sqlite3CodeSubselect` → explicit width
  shared destination emission (`select-program.ts`) and `compileWideSubquery`;
- `resolve.c:resolveSelectStep` LIMIT/OFFSET empty NameContext →
  `resolve.ts:expandAndResolveSelect` pre-source clause validation;
  `row-vector/subquery-consumers.test.mjs` exact name errors/repeated prepare.
  Destination atomic validation → `select-destination-atomic.test.mjs`;
  [current bounded owner decision](research/card-t-shared-subquery-owner-decision.md).
  `resolve.ts` checks IN width after star expansion and preserves linked child
  NameContext; scalar consumer still rejects naked multi-column SELECT.
  Represented SELECT/VALUES vector IN passes focused corpus; vector index
  optimization and broader compositions remain backlog.


## Bounded linked subquery owner/caller mapping

- `resolve.c:resolveSelectStep/resolveExprStep` → `resolve.ts` context-specific
  scalar1/grouped comparison/IN-left/EXISTS consumer width, expanded
  star/compound/VALUES validation and recursively empty
  clause context (1909–1917 before ordinary pOuterNC1977);
  `resolvedExpressionCarrier` → original linked nested plans/field ownership.
- `expr.c:sqlite3CodeSubselect`, vector/IN field consumers → `vdbe.ts`
  linked scalar/vector/EXISTS/IN binding and `compileWideSubquery`; resolver
  SELECT source stays paired with its transient columns; retained derived
  substitution clears superseded plans before recursive lowering.
  `select.c:selectExpander` view/subquery transient Tables stay on retained
  producer routes; simple fast wide dispatch requires physical positive roots
  for nonempty source lists; linked zero-source children preserve outer binding
  through nested scalar compilation (select-window-cross-layer-integration).
  `expr.c:sqlite3CodeSubselect` normalized LIMIT registers are handed to
  zero-source scalar producers without re-admitting original X; reset/rebind
  and scalar-vs-IN admission regressions in select-linked-scalar-preparation-owner.
  [Independent repair evidence](research/card-i-c-row-vector-review.md). Shared Mem NULL/
  first-row, Boolean Exists, correlation/Once and original affinities/collations.
- `select.c:selectInnerLoop` SRT_Mem/Set/Exists → `select-program.ts` atomic
  destination validation and `compileScalarSelect`/`compileInnerTableSelect`
  projection-independent EXISTS (1202/1412); table/join/correlated/UNION callers.
  `computeLimitRegisters2535–2566` → separate mutable clause registers and nested
  emitter forwarding at table-expression IN caller;
  `multiSelect TK_ALL` → shared owner forwarding in source-free recursion and
  linked unordered nonaggregate table-arm composition.
- Tests: row-vector/subquery-consumers, carrier-handoff, lifecycle, public.mjs;
  select-destination-atomic and row-width-real-metadata. Retained specialized
  branches, exclusions and exact assembly evidence:
  [current owner map](research/card-t-shared-subquery-owner-decision.md).
  These mappings certify the bounded carrier, not general derived/CTE/window/
  ordered-AggInfo composition or vector index optimization.

Review33 R1/R2 native-first matrix: `row-vector/review33-owners.test.mjs`,
`review33-cases.json`; exact errors/recovery, presence vs Mem/Set/predicate overflow,
valid independent nested clauses, metadata/reset/close. Evidence and refreshed
dirty-baseline-relative artifacts: current owner decision/card status.


### INNER destination stabilization

`select.c:selectInnerLoop` / `expr.c:sqlite3ExprCodeExprList`, `sqlite3ExprCodeTarget` → `compileInnerTableSelect.emitResultColumn` and direct result caller: destination-targeted plain Column/Rowid with REAL affinity, fallback shared generated/aggregate emission. Tests: multisource-inner-order native metadata/zero/offset/reset and cumulative boundary; [evidence](research/card-k-c-inner-limit/README.md).
