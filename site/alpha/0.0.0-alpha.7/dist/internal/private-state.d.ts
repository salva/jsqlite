import { KeyInfo } from "./comparison.js";
import { Mem } from "./mem.js";
export interface PrivateStateLimits {
    readonly maxEntries: number;
    readonly maxKeyBytes: number;
    readonly maxBytes: number;
}
/** Units are deterministic: one per inserted record, copied logical byte,
 * compared KeyInfo term, and merge move. A zero-unit checkpoint surrounds
 * bounded growth without adding work. */
export interface PrivateStateControl {
    checkpoint(units?: number): Promise<void>;
    /** Optional nonyielding work/cancel/deadline probe for mutable input ownership.
     * Must return synchronously without mutating the admitted caller input. */
    snapshotCheckpoint?(units: number): void;
}
export declare class PrivateStateLimitError extends Error {
    constructor(message: string);
}
/** One execution-owned aggregate budget shared by every private cursor. */
export declare class PrivateStateByteBudget {
    #private;
    readonly maxBytes: number;
    constructor(maxBytes: number);
    reserve(bytes: number, message?: string): void;
    replace(oldBytes: number, newBytes: number, message?: string): void;
    release(bytes: number): void;
    get usedBytes(): number;
}
/** Browser-memory counterpart of a VDBE sorter cursor. Equal keys retain insertion
 * order; no synthetic sequence participates in key equality. */
export declare class SorterCursor {
    #private;
    readonly kind: "sorter";
    readonly keyInfo: KeyInfo;
    readonly limits: PrivateStateLimits;
    constructor(keyInfo: KeyInfo, limits: PrivateStateLimits, budget?: PrivateStateByteBudget);
    insert(key: readonly Mem[], payload: readonly Mem[], control: PrivateStateControl): Promise<void>;
    insertBounded(key: readonly Mem[], payload: readonly Mem[], capacity: bigint, control: PrivateStateControl): Promise<void>;
    sort(control: PrivateStateControl): Promise<void>;
    first(): boolean;
    next(): boolean;
    data(): readonly Mem[];
    clear(): void;
    close(): void;
}
export declare class FifoCursor {
    #private;
    readonly kind: "fifo";
    readonly limits: PrivateStateLimits;
    constructor(limits: PrivateStateLimits, budget?: PrivateStateByteBudget);
    get size(): number;
    insert(values: readonly Mem[], control: PrivateStateControl): Promise<void>;
    shift(): readonly Mem[] | null;
    clear(): void;
    close(): void;
}
/** Mutable ORDER BY queue for select.c's recursive SRT_Queue destination. */
export declare class PriorityQueueCursor {
    #private;
    readonly kind: "priority-queue";
    readonly keyInfo: KeyInfo;
    readonly limits: PrivateStateLimits;
    constructor(keyInfo: KeyInfo, limits: PrivateStateLimits, budget?: PrivateStateByteBudget);
    insert(key: readonly Mem[], payload: readonly Mem[], control: PrivateStateControl): Promise<void>;
    shift(): readonly Mem[] | null;
    clear(): void;
    close(): void;
}
/** Memory-only ephemeral index. It owns complete keys and uses SQLite Mem/KeyInfo
 * equality; NULLs compare equal for DISTINCT. */
export declare class EphemeralIndexCursor {
    #private;
    readonly kind: "ephemeral-index";
    readonly keyInfo: KeyInfo;
    readonly limits: PrivateStateLimits;
    readonly insertionOrder: boolean;
    constructor(keyInfo: KeyInfo, limits: PrivateStateLimits, budget?: PrivateStateByteBudget, insertionOrder?: boolean);
    get size(): number;
    /** sqlite3ExprCodeIN distinguishes empty RHS from RHS NULL on the Mem-owned index. */
    hasNullKey(): boolean;
    found(key: readonly Mem[], control: PrivateStateControl): Promise<boolean>;
    remove(key: readonly Mem[], control: PrivateStateControl): Promise<void>;
    /** Retain this cursor's records whose complete keys occur in `other`.
     * The cells deliberately remain those owned by this (left) cursor: SQLite
     * INTERSECT uses the right records only for membership, preserving the left
     * representative when INTEGER/REAL or collation equality matches. */
    retainFoundIn(other: EphemeralIndexCursor, control: PrivateStateControl): Promise<void>;
    clear(): void;
    insert(key: readonly Mem[], control: PrivateStateControl, ordered?: boolean): Promise<void>;
    /** Replace an equal complete record, preserving SQLite UNION's right-side representative. */
    replace(key: readonly Mem[], control: PrivateStateControl): Promise<void>;
    sort(control: PrivateStateControl): Promise<void>;
    first(): boolean;
    /** window.c1948ff / vdbe.c OP_SeekRowid: publish positioning only after
     * lookup succeeds. Browser linear lookup charges every visited shared record;
     * the VM control supplies bounded yielding, cancellation and deadline checks. */
    seekRowid(rowid: bigint, control: PrivateStateControl): Promise<boolean>;
    /** Monotonic insertion identity, independent of the live entry count.
     * Clear starts a new ephemeral table; deletion never reuses an identity. */
    newRowid(): bigint;
    /** btree.c sqlite3BtreeDelete(SAVEPOSITION): publish removal only after the
     * interruptible checkpoint. Every OpenDup position is adjusted together.
     * A handle on the removed record rests immediately before its successor,
     * so the following Next returns that successor rather than skipping it. */
    deleteCurrent(control: PrivateStateControl): Promise<void>;
    rowid(): bigint;
    next(): boolean;
    rewindBeforeFirst(): void;
    nextData(): readonly Mem[] | null;
    hasNext(): boolean;
    data(): readonly Mem[];
    /** vdbe.c OP_OpenDup creates an independently positioned cursor over the
     * same ephemeral b-tree. The duplicate borrows records; its position is not
     * shared with the owner. */
    duplicate(): EphemeralIndexCursor;
    close(): void;
}
