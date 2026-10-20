import type { RowSet } from "./rowset.js";
import type { SqliteValue } from "../index.js";
import type { DatabaseEncoding, RawRecordValue } from "./record.js";
export type MemManifest = "null" | "integer" | "real" | "text" | "blob" | "aggregate" | "rowset";
export type MemOwnership = "owned" | "borrowed" | "static";
export type MemFailureReason = "invalid-state" | "expired-borrow" | "limit" | "invalid-int64" | "invalid-text";
export declare class MemError extends Error {
    readonly reason: MemFailureReason;
    constructor(reason: MemFailureReason, message: string);
}
/** Backwards-compatible name from the first SetDouble slice. */
export declare class MemStateError extends MemError {
    constructor(message: string);
}
/** Explicit owner generation used by record/page/cursor borrows. */
export declare class BorrowLifetime {
    #private;
    capture(): BorrowToken;
    invalidate(): void;
    close(): void;
    _valid(generation: number): boolean;
}
export declare class BorrowToken {
    readonly owner: BorrowLifetime;
    readonly generation: number;
    constructor(owner: BorrowLifetime, generation: number);
    assertValid(): void;
}
export interface MemAggregateState {
    readonly definition: unknown;
    readonly context: unknown;
    readonly cleanup?: () => void;
}
export interface MemDiagnostic {
    readonly manifest: MemManifest;
    readonly numeric: "integer" | "real" | "int-real" | null;
    readonly bytes: "text" | "blob" | null;
    readonly encoding: DatabaseEncoding | null;
    readonly byteLength: number;
    readonly ownership: MemOwnership | null;
    readonly terminated: boolean;
    readonly zeroTail: number;
    readonly subtype: number | null;
    readonly fromBind: boolean;
    readonly clearedNull: boolean;
}
export interface MemLimits {
    readonly maxLength?: number;
}
export type MemAffinity = "blob" | "text" | "numeric" | "integer" | "real" | "flexnum";
export interface SetBytesOptions extends MemLimits {
    readonly ownership?: MemOwnership;
    readonly lifetime?: BorrowLifetime | BorrowToken;
    readonly terminated?: boolean;
    readonly zeroTail?: number;
}
export interface SqliteFpDecode {
    digits: string;
    exponent: number;
    negative: boolean;
    special: 0 | 1 | 2;
}
/** Direct util.c:sqlite3FpDecode translation. iRound and mxRound are the
 * printf.c conversion-specific inputs (16 ordinary, 20 for altform2). */
export declare function sqliteFpDecode(value: number, iRound: number, mxRound: number): SqliteFpDecode;
export declare function sqliteRealDigits(value: number): {
    digits: string;
    exponent: number;
};
/** func.c:sqlite3QuoteValue REAL branch.  Share the translated
 * util.c:sqlite3FpDecode/printf.c `%!.17g` path used by Mem stringification;
 * quote's `%!0.17g` zero flag spells infinities as parseable SQL literals. */
export declare function sqliteQuoteReal(value: number): string;
export declare class Mem {
    #private;
    get initialStorageClass(): Exclude<MemManifest, "aggregate" | "rowset">;
    setNull(options?: {
        cleared?: boolean;
    }): void;
    setInt64(value: bigint): void;
    /** Internal exact representation of a manifest REAL held in the integer slot. */
    setIntReal(value: bigint): void;
    setDouble(value: number): void;
    setText(bytes: Uint8Array, encoding: DatabaseEncoding, options?: SetBytesOptions): void;
    setBlob(bytes: Uint8Array, options?: SetBytesOptions): void;
    setRowSet(rowset: RowSet): void;
    rowSet(): RowSet | null;
    setAggregate(state: MemAggregateState): void;
    /** sqlite3_aggregate_context owner. Aggregate opcodes are the only callers. */
    aggregateState(): MemAggregateState | null;
    setSubtype(subtype: number | null): void;
    subtypeValue(): number;
    markFromBind(): void;
    integerValue(): bigint;
    realValue(): number;
    /** vdbeapi.c:sqlite3_value_double via vdbemem.c:sqlite3VdbeRealValue.
     * Unlike numeric_type, this accepts a numeric prefix and treats nonnumeric
     * values as zero. BLOB bytes use the connection/database encoding carried by
     * sqlite3_value rather than an intrinsic text encoding. */
    valueDouble(encoding: DatabaseEncoding): number;
    /** sqlite3VdbeMemStringify: add canonical MEM_Str and optionally force TEXT. */
    stringify(encoding: DatabaseEncoding, force?: boolean, limits?: MemLimits): void;
    /** sqlite3VdbeChangeEncoding/sqlite3VdbeMemTranslate. Numeric flags survive. */
    changeEncoding(encoding: DatabaseEncoding, limits?: MemLimits): void;
    /** MakeRecord's transient conversion admission, predicted without mutation.
     * vdbe.c applies affinity before serialization. JS numeric scanners build a
     * code-unit array; stringify/UTF translation allocate before replacing bytes.
     * No allocation occurs for NULL/BLOB, numeric-to-numeric, or same-encoding
     * TEXT without numeric affinity. This is logical scratch, not native heap.
     */
    recordConversionBytes(affinity: MemAffinity | undefined, encoding: DatabaseEncoding): number;
    applyAffinity(affinity: MemAffinity, encoding: DatabaseEncoding): void;
    /** vdbe.c:sqlite3_value_numeric_type/applyNumericAffinity(bTryForInt=0).
     * Unlike arithmetic numericType, nonnumeric TEXT and BLOB retain their type.
     * Work on a copy so aggregate coercion cannot mutate its producer payload. */
    valueNumericTypeCopy(): Mem;
    /** vdbe.c:numericType/computeNumericType on a private register copy. */
    numericTypeCopy(): Mem;
    cast(affinity: MemAffinity, encoding: DatabaseEncoding): void;
    textBytes(): Uint8Array;
    blobValue(): Uint8Array;
    textValue(): string;
    makeWriteable(): void;
    shallowCopyFrom(source: Mem, ownership?: "borrowed" | "static"): void;
    copyFrom(source: Mem): void;
    /** Private async consumers need a nonyielding owned snapshot. Probe must not
     * mutate either Mem; chunks bound copy work without borrowing across await. */
    copyFromSnapshot(source: Mem, probe: (units: number) => void): void;
    moveFrom(source: Mem): void;
    release(): void;
    diagnostic(): MemDiagnostic;
}
export declare function memFromRawRecord(raw: RawRecordValue, lifetime?: BorrowLifetime | BorrowToken): Mem;
export declare function memFromPublic(value: SqliteValue, encoding: DatabaseEncoding, limits?: MemLimits): Mem;
export declare function memToPublicInitial(value: Mem): SqliteValue;
