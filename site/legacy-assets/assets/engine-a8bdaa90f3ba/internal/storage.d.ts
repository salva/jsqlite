export declare class StorageLimitError extends RangeError {
    constructor(message: string);
}
export declare class StorageCorruptError extends Error {
    constructor(message: string);
}
export declare class StorageUnsupportedError extends Error {
    readonly classification: "temporary" | "permanent";
    constructor(message: string, classification: "temporary" | "permanent");
}
export declare class StorageClosedError extends Error {
    constructor();
}
export declare const storageOwner: unique symbol;
export interface StorageOwnerCarrier {
    readonly [storageOwner]: ImmutableStorage;
}
/** Connection-owned, immutable, validated format-3 file and page source. */
export declare class ImmutableStorage {
    #private;
    readonly pageSize: number;
    readonly pageCount: number;
    readonly usableSize: number;
    readonly encoding: 1 | 2 | 3;
    readonly schemaAllowance: number;
    get schemaTemporaryBytes(): number;
    /** Checked connection-owned logical allocation, not measured host heap. */
    reserveSchemaTemporary(bytes: number): () => void;
    get schemaBytes(): number;
    publishSchema(bytes: number, cleanup: () => void): void;
    private constructor();
    get generation(): number;
    get closed(): boolean;
    assertOpen(): void;
    read(offset: number, length: number): Uint8Array;
    page(pageNumber: number): Uint8Array;
    close(): void;
    static open(bytes: Uint8Array, maxFileBytes?: number): ImmutableStorage;
}
