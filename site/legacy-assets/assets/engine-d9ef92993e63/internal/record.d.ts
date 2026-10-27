export type DatabaseEncoding = "utf-8" | "utf-16le" | "utf-16be";
export declare class RecordFormatError extends Error {
    readonly reason: "invalid-bounds" | "truncated-varint" | "invalid-header" | "reserved-serial-type" | "truncated-payload";
    constructor(reason: RecordFormatError["reason"], message: string);
}
export interface DecodedVarint {
    readonly value: bigint;
    readonly length: number;
}
/** Decode one SQLite varint without reading beyond `end` (an exclusive offset). */
export declare function decodeVarint(bytes: Uint8Array, offset: number, end?: number): DecodedVarint;
export interface RawNull {
    readonly storageClass: "null";
}
export interface RawInteger {
    readonly storageClass: "integer";
    readonly value: bigint;
}
export interface RawReal {
    readonly storageClass: "real";
    /** Exact source bits, retained even when JS canonicalizes a NaN payload. */
    readonly bits: bigint;
    readonly value: number;
    readonly classification: "finite" | "infinity" | "nan";
}
export interface RawText {
    readonly storageClass: "text";
    /** Borrowed from the record argument; its owner must outlive this value. */
    readonly bytes: Uint8Array;
    readonly encoding: DatabaseEncoding;
}
export interface RawBlob {
    readonly storageClass: "blob";
    /** OP_Column source encoding metadata, not a conversion of the BLOB. */
    readonly encoding?: DatabaseEncoding;
    /** Borrowed from the record argument; its owner must outlive this value. */
    readonly bytes: Uint8Array;
}
export type RawRecordValue = RawNull | RawInteger | RawReal | RawText | RawBlob;
export interface DecodedRecord {
    readonly headerLength: number;
    readonly payloadLength: number;
    readonly values: readonly RawRecordValue[];
}
/** vdbe.c OP_Column's movement-invalidated cursor record cache.
 * Its owner discards the cache before moving/reusing its cursor. */
export declare class CursorRecord {
    #private;
    readonly payload: () => Uint8Array;
    readonly encoding: DatabaseEncoding;
    constructor(payload: () => Uint8Array, encoding: DatabaseEncoding);
    field(index: number): RawRecordValue | undefined;
    last(): RawRecordValue | undefined;
}
/** Incremental view of a packed record. Consumers such as index-key comparison
 * can stop after a decisive field without reading unrelated serial values. */
export declare class RawRecordReader {
    #private;
    readonly record: Uint8Array;
    readonly encoding: DatabaseEncoding;
    readonly headerLength: number;
    constructor(record: Uint8Array, encoding: DatabaseEncoding);
    get payloadLength(): number;
    serialNumber: number;
    get serialType(): bigint;
    fieldOffset: number;
    fieldLength: number;
    /** RecordCompareWithSkip's idx1/d1 transition, without materializing a value. */
    advance(): boolean;
    /** vdbeRecordDecodeInt: valid only for serial1–6,8,9. */
    integer(): bigint;
    value(): RawRecordValue;
    /** Decode the next field, borrowing TEXT/BLOB bytes from `record`. */
    next(): RawRecordValue | null;
}
/**
 * Decode one complete record payload. The returned TEXT/BLOB subarrays borrow
 * `record`; callers needing a public value must copy at that later boundary.
 */
export declare function decodeRecord(record: Uint8Array, encoding: DatabaseEncoding): DecodedRecord;
