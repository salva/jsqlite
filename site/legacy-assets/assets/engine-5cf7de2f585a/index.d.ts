export type SqliteValue = null | bigint | number | string | Uint8Array;
export type SqliteStorageClass = "null" | "integer" | "real" | "text" | "blob";
export type StepResult = "row" | "done";
export interface WorkLimits {
    readonly maxFileBytes?: number;
    readonly maxRows?: number;
    readonly maxWorkUnits?: number;
    readonly maxSqlBytes?: number;
    readonly maxParserDepth?: number;
    readonly maxExpressionDepth?: number;
    readonly maxBtreeDepth?: number;
    readonly maxOverflowPages?: number;
    /** Maximum bytes in one scalar result (SQLite SQLITE_LIMIT_LENGTH-shaped). */
    readonly maxResultBytes?: number;
    /** Maximum records retained by one private sorter or ephemeral set. */
    readonly maxPrivateEntries?: number;
    /** Maximum logical bytes in one private key. */
    readonly maxPrivateKeyBytes?: number;
    /** Maximum aggregate logical bytes retained by one private cursor. */
    readonly maxPrivateBytes?: number;
}
export interface OperationOptions {
    readonly signal?: AbortSignal;
    readonly timeoutMs?: number;
    readonly maxWorkUnits?: number;
}
export interface OpenOptions extends OperationOptions {
    readonly fetchOptions?: Omit<RequestInit, "signal">;
    readonly limits?: WorkLimits;
}
export interface ColumnMetadata {
    readonly name: string;
    readonly declaredType: string | null;
    readonly database: string | null;
    readonly table: string | null;
    readonly origin: string | null;
}
export interface PrepareResult {
    readonly statement: Statement | null;
    readonly tailOffset: number;
    readonly tail: string;
}
export interface Statement {
    readonly columnCount: number;
    readonly parameterCount: number;
    parameterName(index: number): string | null;
    parameterIndex(name: string): number;
    bind(indexOrName: number | string, value: SqliteValue): void;
    clearBindings(): void;
    step(options?: OperationOptions): Promise<StepResult>;
    reset(): void;
    finalize(): void;
    columnMetadata(index: number): ColumnMetadata;
    columnType(index: number): SqliteStorageClass;
    column(index: number): SqliteValue;
    columnInteger(index: number): bigint | null;
    columnReal(index: number): number | null;
    columnText(index: number): string | null;
    columnBlob(index: number): Uint8Array | null;
}
export interface Connection {
    prepare(sql: string, options?: OperationOptions): PrepareResult;
    close(): void;
    closeDeferred(): void;
}
export type ErrorKind = "sqlite" | "transport" | "cancelled" | "timeout" | "limit" | "misuse" | "unsupported" | "internal";
export type UnsupportedClassification = "temporary" | "permanent";
export declare class JSQLiteError extends Error {
    readonly kind: ErrorKind;
    readonly code: number | null;
    readonly extendedCode: number | null;
    readonly unsupportedClassification: UnsupportedClassification | null;
    readonly cause?: unknown;
    constructor(kind: ErrorKind, message: string, options?: {
        code?: number;
        extendedCode?: number;
        unsupportedClassification?: UnsupportedClassification;
        cause?: unknown;
    });
}
export declare function open(source: string | URL | Request, options?: OpenOptions): Promise<Connection>;
