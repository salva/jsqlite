/**
 * Stage 1 public declarations. NONFUNCTIONAL: this module deliberately contains
 * no SQLite engine. See docs/api.md.
 */

export type SqliteValue = null | bigint | number | string | Uint8Array;
export type SqliteStorageClass = "null" | "integer" | "real" | "text" | "blob";
export type StepResult = "row" | "done";

export interface WorkLimits {
  readonly maxFileBytes?: number;
  readonly maxRows?: number;
  readonly maxWorkUnits?: number;
  readonly maxSqlBytes?: number;
  readonly maxExpressionDepth?: number;
  readonly maxBtreeDepth?: number;
  readonly maxOverflowPages?: number;
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
  /** UTF-8 byte offset immediately after the consumed first statement. */
  readonly tailOffset: number;
  /** Exact JS-string suffix corresponding to tailOffset. */
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

export declare function open(source: string | URL | Request, options?: OpenOptions): Promise<Connection>;

export type ErrorKind =
  | "sqlite"
  | "transport"
  | "cancelled"
  | "timeout"
  | "limit"
  | "misuse"
  | "unsupported"
  | "internal";

export type UnsupportedClassification = "temporary" | "permanent";

export declare class JSQLiteError extends Error {
  readonly kind: ErrorKind;
  /** SQLite primary code when kind is sqlite; otherwise null. */
  readonly code: number | null;
  /** SQLite extended code when kind is sqlite; otherwise null. */
  readonly extendedCode: number | null;
  /** Present exactly when kind is unsupported; null for every other kind. */
  readonly unsupportedClassification: UnsupportedClassification | null;
  readonly cause?: unknown;
}
