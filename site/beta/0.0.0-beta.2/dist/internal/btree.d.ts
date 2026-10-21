import { type DatabaseEncoding } from "./record.js";
import { type KeyInfo } from "./comparison.js";
import type { Mem } from "./mem.js";
import { ImmutableStorage, type StorageOwnerCarrier } from "./storage.js";
/** Read-only translation of the pinned btree.c page, cell, payload and cursor paths. */
export declare class BtreeFormatError extends Error {
    constructor(message: string);
}
export declare class BtreeCursorStateError extends Error {
    constructor(message: string);
}
/** A configured traversal ceiling, distinct from programmer RangeError and
 * malformed database input. Public execution maps only this provenance to limit. */
export declare class BtreeLimitError extends Error {
    readonly limit: "maxBtreeDepth" | "maxOverflowPages";
    constructor(limit: BtreeLimitError["limit"]);
}
export interface BtreeLimits {
    readonly maxBtreeDepth?: number;
    readonly maxOverflowPages?: number;
}
interface Page {
    number: number;
    bytes: Uint8Array;
    type: number;
    cells: number[];
    rightChild: number | null;
}
interface PayloadCell {
    payloadLength: number;
    local: Uint8Array;
    overflowPage: number | null;
    pageNumber: number;
    cellOffset: number;
}
interface TableEntry extends PayloadCell {
    rowid: bigint;
}
interface IndexEntry extends PayloadCell {
}
interface IndexAncestor {
    pageNumber: number;
    childIndex: number;
}
interface IndexPosition {
    entry: IndexEntry;
    pageNumber: number;
    cellIndex: number;
    ancestors: readonly IndexAncestor[];
}
export declare class BtreeDatabase {
    #private;
    reserveSchemaTemporary(bytes: number): () => void;
    readonly pageSize: number;
    readonly pageCount: number;
    readonly usableSize: number;
    readonly encoding: DatabaseEncoding;
    readonly maxBtreeDepth: number;
    readonly maxOverflowPages: number;
    constructor(storage: ImmutableStorage, limits?: BtreeLimits);
    close(): void;
    assertOpen(): void;
    tableCursor(root: number): TableCursor;
    /** Forward-only table scan used by the VDBE. Opening does not recursively
     * materialize the whole tree; first/next resume depth-first traversal. */
    tableScanCursor(root: number): TableScanCursor;
    indexCursor(root: number): IndexCursor;
    pageBytes(pgno: number): Uint8Array;
    page(pgno: number, allowed: readonly number[]): Page;
    readTable(root: number): TableEntry[];
    tableSeek(root: number, key: bigint, bias: "ge" | "le"): {
        entry: TableEntry | null;
        exact: boolean;
    };
    indexSeek(root: number, compareCurrentToTarget: (payload: Uint8Array) => number, bias: "ge" | "le"): {
        position: IndexPosition | null;
        exact: boolean;
    };
    indexBoundary(root: number, direction: "first" | "last"): IndexPosition | null;
    indexMove(position: IndexPosition, direction: "next" | "previous"): IndexPosition | null;
    private iterateTable;
    overflowPages(cell: PayloadCell): number[];
    payload(cell: PayloadCell, check?: (units: number) => void): Uint8Array;
    /** Incremental payload reconstruction. Every yielded slice performs at most
     * one page read, allowing the async VM to charge and yield between pages. */
    payloadChunks(cell: PayloadCell): Generator<Uint8Array>;
}
declare class CursorBase<T extends PayloadCell> {
    #private;
    protected position: number;
    protected generation: number;
    protected readonly database: BtreeDatabase;
    protected entries: readonly T[];
    constructor(database: BtreeDatabase, loadEntries: () => readonly T[]);
    protected ensureEntries(): void;
    protected setSeekEntry(entry: T | null): void;
    get valid(): boolean;
    first(): boolean;
    last(): boolean;
    clearPosition(): void;
    next(): boolean;
    previous(): boolean;
    protected move(position: number): boolean;
    protected entry(): T;
    payload(check?: (units: number) => void): Uint8Array;
    overflowPages(): number[];
    borrowPayload(): {
        bytes(): Uint8Array;
    };
}
export declare class TableCursor extends CursorBase<TableEntry> {
    #private;
    constructor(database: BtreeDatabase, root: number);
    get rowid(): bigint;
    seek(key: bigint, bias: "ge" | "le"): boolean;
}
export declare class TableScanCursor {
    #private;
    constructor(database: BtreeDatabase, entries: Iterator<TableEntry>);
    first(): boolean;
    next(): boolean;
    get rowid(): bigint;
    payload(): Uint8Array;
    payloadChunks(): Iterator<Uint8Array>;
    borrowPayload(): {
        bytes(): Uint8Array;
    };
}
export declare class IndexCursor extends CursorBase<IndexEntry> {
    #private;
    constructor(database: BtreeDatabase, root: number);
    clearPosition(): void;
    first(): boolean;
    last(): boolean;
    next(): boolean;
    previous(): boolean;
    seek(compareCurrentToTarget: (payload: Uint8Array) => number, bias: "ge" | "le"): boolean;
    /** vdbe.c:4935–5025 / btreeIndexMoveto: nField is the supplied prefix.
     * Strict GT/LT bias equal prefixes before descent, without a pre-scan.
     * Input cells transfer to the unpacked key; errors release them too.
     * Return positioning success, not equality as in seek(). */
    /** vdbe.c:OP_SeekScan5093: bounded forward steps before a SeekGE.
     * `found` bypasses seek (range overshoot allowed); `exhausted` takes
     * SeekGE's exit; `seek` falls through. Never changes an invalid cursor.
     * The unpacked prefix has default_rc0, unlike strict seekKey. */
    seekScan(values: readonly Mem[], keyInfo: KeyInfo, steps: number, hasRange: boolean, charge?: () => void, moved?: () => void): "seek" | "found" | "exhausted";
    seekKey(values: readonly Mem[], keyInfo: KeyInfo, direction: "ge" | "gt" | "le" | "lt"): boolean;
}
export declare function openBtreeDatabase(bytes: Uint8Array, limits?: BtreeLimits): BtreeDatabase;
/** Internal/test later-consumer route; not exported by the package public module. */
export declare function btreeFromStorage(storage: ImmutableStorage, limits?: BtreeLimits): BtreeDatabase;
/** Internal bridge proving a public-open connection and b-tree share one owner. */
export declare function btreeFromConnection(connection: StorageOwnerCarrier, limits?: BtreeLimits): BtreeDatabase;
export {};
