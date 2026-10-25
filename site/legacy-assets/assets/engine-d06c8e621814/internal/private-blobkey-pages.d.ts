import { KeyInfo, UnpackedRecordKey } from "./comparison.js";
import { PrivateStateByteBudget, type PrivateStateLimits, type PrivateStateControl } from "./private-state.js";
/** Physical retained buffer + deterministic arena/MemPage metadata. Not JS heap measurement. */
export declare const PRIVATE_PAGE_CHARGE: number;
/** Arena object/state plus empty page-map/result-registry descriptors.
 * Retained from construction through successful close; not heap measurement. */
export declare const PRIVATE_ARENA_CHARGE = 128;
/** Per-acquisition revocation/view/release metadata, including bounded byte-method
 * table (at most 15 wrappers) and derived-page method table (at most 32
 * wrappers); shared page bytes excluded. Raw descriptor includes pgno/bytes/release
 * and is transferred directly by allocatePage, never spread into another wrapper. */
export declare const PRIVATE_LEASE_CHARGE = 128;
/** Per borrowed subview including its bounded byte-method table, retained until
 * its owning capability is revoked. Not a heap-size estimate. */
export declare const PRIVATE_SUBVIEW_CHARGE = 64;
/** Per stateful borrowed iterator, retained until owner revocation. */
export declare const PRIVATE_ITERATOR_CHARGE = 64;
/** Per retained iterator result, plus the same allowance for an entries tuple.
 * Charged until owning capability revocation; explicit scalar copies are values. */
export declare const PRIVATE_ITERATOR_RESULT_CHARGE = 32;
/** Staged inspection result and copied-buffer descriptors; payload charged too.
 * Page-owned high-water retention until staging teardown, not heap measurement. */
export declare const PRIVATE_STAGED_INSPECTION_CHARGE = 64;
/** Per published auxiliary cell: deterministic 128-byte allowance for the result,
 * revocation token/byte capability, release closure and arena registry entry.
 * Not a JS heap measurement; includes pending construction at peak. */
export declare const PRIVATE_CELL_RESULT_CHARGE = 128;
/** Cursor object/state and empty stack/cache descriptors. Dynamic stack slots,
 * target ownership and overflow buffers are not included. Not heap measurement. */
export declare const PRIVATE_CURSOR_CHARGE = 128;
/** Deterministic retained parent-array slot capacity (record + reference/slot).
 * Charged at depth high-water mark until cursor close, not heap measurement. */
export declare const PRIVATE_PARENT_SLOT_CHARGE = 64;
export declare class PrivateBlobkeyFormatError extends Error {
    constructor(message: string);
}
/** Physical REPLACE accepts no cursor-position authority. Future BtreeInsert must
 * produce authenticated target/cursor/root/KeyInfo/generation/epoch evidence or
 * reseek packed authority; a scalar sign/epoch is never sufficient. */
export interface PrivateReplaceCellOptions {
    readonly preformat?: false;
    readonly seekEvidence?: never;
    readonly seekResult?: never;
    readonly savePosition?: never;
}
export type PrivatePageHook = (event: "allocate" | "acquire" | "init" | "release", pgno: number, bytes?: Uint8Array) => void;
export interface PrivateCellInfo {
    readonly offset: number;
    readonly payloadOffset: number;
    readonly nPayload: number;
    readonly nLocal: number;
    readonly nSize: number;
    readonly overflowOffset: number | null;
}
export declare class PrivateIndexPage {
    #private;
    readonly bytes: Uint8Array;
    get pgno(): number;
    get leaf(): boolean;
    get childPtrSize(): number;
    get cellOffset(): number;
    get nCell(): number;
    readonly minLocal = 489;
    readonly maxLocal = 1002;
    constructor(pgno: number, bytes: Uint8Array, scratch?: {
        reserve(bytes: number): void;
        release(bytes: number): void;
        begin?(): void;
        end?(): void;
        fault?(error: unknown): void;
        admitEntry?(): () => void;
        removeEntries?(count: number): void;
        accountant?: object;
    }, maxKeyBytes?: number);
    /** copyNodeContent8163, private hdrOffset0/autoVacuum=false branch.
     * Staged ownership is transferred separately by the root balance caller. */
    copyNodeContent(source: PrivateIndexPage, control: PrivateStateControl): Promise<void>;
    /** balance_deeper physical owner after caller allocates child. Logical
     * entry reconciliation and arena admission remain caller responsibilities. */
    deepenInto(child: PrivateIndexPage, control: PrivateStateControl): Promise<void>;
    findCell(index: number): number;
    parseCell(index: number): PrivateCellInfo;
    /** xParseCell for an auxiliary fillInCell buffer as well as resident cells. */
    parseCellBytes(bytes: Uint8Array, offset?: number): PrivateCellInfo;
    leftChild(index: number): number;
    rightChild(): number;
    /** btree.c:freeSpace. Foundational page-local mutation only; caller must
     * own the page exclusively. A failing mutation faults the derived page until
     * construction replacement/arena teardown; no operation rollback is promised. */
    freeSpace(start: number, size: number): void;
    assertUsable(): void;
    get operationPending(): boolean;
    /** Native pageInsertArray: no defragmentation. false requests rebuild.
     * Raw edit prerequisite; caller owns safe slot range and ppData/header update. */
    insertCellArray(cells: readonly Uint8Array[], first: number, count: number, begin: number, state: {
        top: number;
    }, slot: number, control: PrivateStateControl): Promise<boolean>;
    /** Native editPage resident branch, one admission across free/insert/fallback.
     * Only staged entries retained here may be consumed without a transit owner. */
    editCells(cells: readonly Uint8Array[], oldFirst: number, newFirst: number, newCount: number, control: PrivateStateControl): Promise<void>;
    /** Native pageFreeArray. Frees only destination-resident CellArray ranges;
     * slots/count and overflow/entry authority remain the edit caller's job. */
    freeCellArray(cells: readonly Uint8Array[], first: number, count: number, control: PrivateStateControl): Promise<number>;
    /** Native rebuildPage fallback, private raw page prerequisite only.
     * Caller owns CellArray and cross-page edit dependency order. Staging disposal
     * requires conserving transit authority and is not admitted by this seam. */
    rebuildCells(cells: readonly Uint8Array[], first: number, count: number, control: PrivateStateControl): Promise<void>;
    /** btree.c:dropCell. Only removes the resident cell/slot; overflow ownership
     * must already have been transferred or cleared by the caller. */
    dropCell(index: number, size: number, control: PrivateStateControl): Promise<void>;
    get nOverflow(): number;
    /** Inspection returns an independent value copy. Published copy capacities
     * remain page-owned until staging teardown; no GC or implicit lease refund. */
    overflowCell(slot: number): {
        index: number;
        bytes: Uint8Array;
    };
    /** External staging teardown obeys the same exclusive admission as edits.
     * Internal reset/disposal uses the private bridge without fresh admission. */
    releaseStagedCells(): void;
    /** insertCellFast when child=0; insertCell for interior divider replacement.
     * Owned copy is the private analogue of pTemp; stage order follows aiOvfl. */
    insertCell(index: number, cell: Uint8Array, control: PrivateStateControl, child?: number): Promise<void>;
    allocateSpace(size: number, control: PrivateStateControl): Promise<number>;
    defragmentPage(maxFragments: number, control: PrivateStateControl): Promise<void>;
    computeFreeSpace(): number;
}
/** Nonroot control capacity: six array headers64 + at most40 reference slots8,
 * five identity records64 + nine terminal cleanup descriptors64 + control128.
 * Bounds: old<=3/new<=5, fresh<=4, entries<=9, cleanup<=9. This conservative
 * deterministic allowance is not JS heap measurement/native sizeof parity.
 * Separate gather/partition/rekey/edit/lease charges overlap this lifetime. */
export declare const PRIVATE_NONROOT_CONTROL_CHARGE = 1792;
/** A lease is one explicit acquisition, not another physical buffer charge. */
export declare class PrivatePageLease {
    #private;
    constructor(page: PrivateIndexPage, release: () => void, admitCapability: (charge: number) => () => void);
    get page(): PrivateIndexPage;
    release(): void;
}
export declare class PrivateBlobkeyPages {
    #private;
    readonly root = 2;
    readonly autoVacuum = false;
    readonly pageSize = 4096;
    private constructor();
    static open(budget: PrivateStateByteBudget, control: PrivateStateControl, hook?: PrivatePageHook, limits?: Pick<PrivateStateLimits, "maxKeyBytes"> & Partial<Pick<PrivateStateLimits, "maxEntries">>): Promise<PrivateBlobkeyPages>;
    get epoch(): number;
    observeKeyDemand(bytes: number): void;
    get pageCount(): number;
    referenceCount(pgno: number): number;
    acquire(pgno: number): PrivatePageLease;
    /** Raw overflow pages bypass index-page initialization, as PagerGet in accessPayload. */
    acquireRaw(pgno: number): {
        pgno: number;
        bytes: Uint8Array;
        release(): void;
    };
    /** Nonroot balance's shallower branch8957: defrag/copy/free single child. */
    shallowRoot(control: PrivateStateControl): Promise<void>;
    /** balance_deeper allocation/copy/stage/zero owner; shared held-token path. */
    deepenRoot(control: PrivateStateControl): Promise<number>;
    /** Raw pager identity prerequisite; not nonroot/parent publication. */
    /** Native BLOBKEY balance loop over an owned, validated cursor path. */
    /** Returns native balance()'s reached depth, not a reusable leaf path.
     * ancestorDepth requests Delete's second pass under the same admission and
     * charged path owner. Only the surviving prefix is ever revisited. */
    balancePath(numbers: readonly number[], indices: readonly number[], bulk: boolean, control: PrivateStateControl, ancestorDepth?: number): Promise<number>;
    /** Held nonroot owner, private hdrOffset0/autoVacuum=false. */
    balanceNonroot(parentNumber: number, index: number, bulk: boolean, control: PrivateStateControl): Promise<void>;
    rekeySiblings(numbers: readonly number[], control: PrivateStateControl): Promise<void>;
    /** autoVacuum=false BTALLOC_ANY branch. Result is readonly uninitialized storage inspection. */
    allocatePage(nearby: number, control: PrivateStateControl): Promise<{
        pgno: number;
        bytes: Uint8Array;
        release(): void;
    }>;
    /** freePage2 without secure-delete/autovacuum/journal; buffers stay charged. */
    freePage(pgno: number, control: PrivateStateControl): Promise<void>;
    /** clearCellOverflow, auxiliary cell seam. No slot deletion or cursor restore. */
    clearCellOverflow(pgno: number, cell: Uint8Array, control: PrivateStateControl): Promise<void>;
    /** Construction-only fillInCell BLOBKEY. Scratch release does not free published
     * overflow pages: subsequent cell publication/clear owner must consume them. */
    fillCell(pgno: number, key: Uint8Array, control: PrivateStateControl): Promise<{
        bytes: Uint8Array;
        release(): void;
    }>;
    clearTable(control: PrivateStateControl): Promise<number>;
    /** Single staged descriptor consumption; no redistribution/parent edits. */
    transferStagedCell(source: number, destination: number, slot: number, control: PrivateStateControl): Promise<void>;
    /** Owning equal-size/local replacement seam (BtreeInsert's overwrite path).
     * Not a seek/Insert wrapper. Different size/overflow needs the future writer. */
    /** Physical same-length BLOBKEY payload owner (btreeOverwriteCell9265ff).
     * No seek authority: the consuming Insert must select the cell under its gate.
     * Fixture wrapper saves all cursors, then rejects foreign leases. */
    overwriteCell(pgno: number, index: number, payload: Uint8Array, control: PrivateStateControl): Promise<void>;
    replaceCell(pgno: number, index: number, cell: Uint8Array, control: PrivateStateControl, options?: PrivateReplaceCellOptions): Promise<void>;
    /** Narrow physical cell-transfer prerequisite, not balance or Insert. Packed
     * cell (including any overflow pointer) is copied before source freeSpace.
     * Only equal page formats are admitted; child remapping belongs to balance. */
    transferCell(source: number, index: number, destination: number, slot: number, control: PrivateStateControl): Promise<void>;
    reserveCursor(maxBytes: number, maxEntries: number): void;
    reserveScratch(bytes: number): void;
    releaseScratch(bytes: number): void;
    reservePayloadScratch(bytes: number): void;
    releasePayloadScratch(bytes: number): void;
    allocationCheckpoint(pgno: number): void;
    installPage(pgno: number, bytes: Uint8Array): void;
    close(): void;
}
export interface PrivateIndexMovetoResult {
    readonly res: -1 | 0 | 1;
    readonly state: "VALID" | "INVALID";
    readonly page: number;
    readonly index: number;
    readonly epoch: number;
}
/** Page-local IndexMoveto foundation. No GE/LE adjustment and no global keys.
 * Full packed overflow keys use charged scratch and raw-page leases; this is
 * the offset0/full-key accessPayload branch, not a general payload API.
 * No seek-result producer reuse/cache is exposed yet. */
export declare class PrivateBlobkeyCursor {
    #private;
    constructor(arena: PrivateBlobkeyPages, info: KeyInfo, limits: PrivateStateLimits, options?: {
        owning?: boolean;
    });
    /** OP_OpenDup/btreeCursor: share root/KeyInfo, never position or saved key.
     * Constructor admits PRIVATE_CURSOR_CHARGE before publishing the handle. */
    duplicate(): PrivateBlobkeyCursor;
    /** Independent diagnostic copies: 64 result/array bytes plus32 per parent,
     * retained at high-water until close, not GC/heap measurement. */
    get position(): {
        page: number;
        index: number;
        state: "VALID" | "INVALID" | "REQUIRESEEK" | "SKIPNEXT" | "FAULT";
        skipNext: number;
        overflowValid: boolean;
        overflowCapacity: number;
        parents: {
            page: number;
            slot: number;
        }[];
    };
    /** Narrow typed equal/same-length writer slice; not NEW insertion/balance.
     * Packed bytes own publication. Always reseek; no scalar authority accepted. */
    replaceIndexEqual(payload: Uint8Array, control: PrivateStateControl): Promise<void>;
    /** Interim nonstaging leaf producer. Not the full BtreeInsert admission. */
    insertIndexLocal(payload: Uint8Array, control: PrivateStateControl): Promise<void>;
    /** Packed seek-owning writer; SAVEPosition only after balance; full error/peak audit pending. */
    insertIndex(payload: Uint8Array, options: {
        savePosition?: boolean;
    }, control: PrivateStateControl): Promise<void>;
    first(control: PrivateStateControl): Promise<boolean>;
    next(control: PrivateStateControl): Promise<boolean>;
    last(control: PrivateStateControl): Promise<boolean>;
    previous(control: PrivateStateControl): Promise<boolean>;
    /** accessPayload snapshot: callback cannot retain a page borrow across moves.
     * Scratch is charged until the consumer returns, including awaited work. */
    withPayload<T>(control: PrivateStateControl, consume: (bytes: Uint8Array) => Promise<T> | T): Promise<T>;
    /** CursorRestore/HandleMovedCursor consumption under one arena admission.
     * A nearby restored cell remains available for directional movement but is
     * not the row requested by Column. Notification runs even on restore error. */
    withRestoredPayload<T>(control: PrivateStateControl, notify: (different: boolean) => void, consume: (bytes: Uint8Array | null) => Promise<T> | T): Promise<T>;
    indexMoveto(key: UnpackedRecordKey, control: PrivateStateControl): Promise<PrivateIndexMovetoResult>;
    setPinned(pinned: boolean): void;
    saveCursorPosition(control: PrivateStateControl): Promise<void>;
    /** btree.c:sqlite3BtreeDelete. One admission owns restore, predecessor,
     * peer saves, overflow destruction, packed transfer and both balance passes. */
    deleteCurrent(options: {
        savePosition?: boolean;
    }, control: PrivateStateControl): Promise<void>;
    restoreCursorPosition(control: PrivateStateControl): Promise<void>;
    clearCursor(): void;
    close(): void;
}
