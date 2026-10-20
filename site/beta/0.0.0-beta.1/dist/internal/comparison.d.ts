import { BorrowLifetime, type BorrowToken, Mem } from "./mem.js";
import { type DatabaseEncoding } from "./record.js";
export type BuiltinCollation = "binary" | "nocase" | "rtrim";
export interface BuiltinCollationSpec {
    readonly kind: BuiltinCollation;
    /** Encoding in which the collation callback consumes bytes. */
    readonly encoding: DatabaseEncoding;
}
export interface KeyTerm {
    readonly collation?: BuiltinCollation | BuiltinCollationSpec;
    readonly desc?: boolean;
    /** SQLite KEYINFO_ORDER_BIGNULL, before the independent DESC inversion. */
    readonly nullsLarge?: boolean;
}
export interface KeyInfoInput {
    readonly encoding: DatabaseEncoding;
    readonly totalFieldCount: number;
    readonly keyFieldCount: number;
    readonly terms: readonly KeyTerm[];
}
/** Immutable, identity-bearing counterpart of SQLite KeyInfo. */
export declare class KeyInfo {
    readonly encoding: DatabaseEncoding;
    readonly totalFieldCount: number;
    readonly keyFieldCount: number;
    readonly terms: readonly Readonly<KeyTerm>[];
    constructor(input: KeyInfoInput);
}
export interface RecordKeyLimits {
    readonly maxFields?: number;
    readonly maxBytes?: number;
    readonly maxWorkUnits?: number;
}
export type ComparisonFailureReason = "corrupt" | "limit" | "internal";
export declare class ComparisonError extends Error {
    readonly reason: ComparisonFailureReason;
    constructor(reason: ComparisonFailureReason, message: string, options?: ErrorOptions);
}
export interface UnpackedRecordKeyOptions {
    /** SQLite UnpackedRecord.default_rc for exhausted equal fields. */
    readonly defaultRc?: -1 | 0 | 1;
    /** Current-pin construction class. Seek keys are non-empty prefixes whose
     * nField does not exceed KeyInfo.nKeyField; record unpack may also represent
     * a generic complete record, but a short one is not comparison-ready. */
    readonly caller?: "record" | "seek";
    readonly limits?: RecordKeyLimits;
}
export declare class UnpackedRecordKey {
    #private;
    readonly keyInfo: KeyInfo;
    readonly values: readonly Mem[];
    readonly defaultRc: -1 | 0 | 1;
    readonly caller: "record" | "seek" | "stat4";
    nField: number;
    errCode: number;
    eqSeen: boolean;
    constructor(values: readonly Mem[], defaultRc: -1 | 0 | 1, caller: "record" | "seek" | "stat4", keyInfo: KeyInfo);
    assertLive(): void;
    release(): void;
}
/** Compare byte-counted TEXT. Embedded NUL is data. NOCASE and RTRIM are the
 * UTF-8-only built-ins and therefore source-translate UTF-16 before comparing. */
export declare function compareBuiltinText(kind: BuiltinCollation, left: Uint8Array, right: Uint8Array, encoding: DatabaseEncoding): -1 | 0 | 1;
/** SQLite storage-class comparison. Inputs are never converted or cache-mutated. */
export declare function compareMem(left: Mem, right: Mem, collation?: BuiltinCollation | BuiltinCollationSpec): -1 | 0 | 1;
/** Decode a complete packed index record. TEXT/BLOB Mem cells borrow `packed`
 * under the caller-owned generation. No partial object escapes on failure. */
export declare function unpackRecordKey(packed: Uint8Array, keyInfo: KeyInfo, borrowLifetime: BorrowLifetime | BorrowToken, options?: UnpackedRecordKeyOptions): UnpackedRecordKey;
/** Compare a packed left key with an unpacked right key, matching
 * sqlite3VdbeRecordCompare. The packed temporary borrow is scoped to this call;
 * serial fields are decoded one at a time and equal compared prefixes return
 * the unpacked RHS defaultRc. */
export declare function compareRecordKey(packed: Uint8Array, unpacked: UnpackedRecordKey, keyInfo: KeyInfo, limits?: RecordKeyLimits): -1 | 0 | 1;
/** vdbeaux.c:sqlite3VdbeRecordCompareWithSkip (skip=0), STAT4 raw
 * buffer contract. n excludes eight readable zero padding bytes. Strict
 * ordinary cursors keep RawRecordReader; malformed sample error ownership
 * belongs to RHS errCode, not record decoding exceptions. */
export declare function compareStat4RecordKey(p: Uint8Array, n: number, rhs: UnpackedRecordKey, info: KeyInfo, check?: () => void): -1 | 0 | 1;
