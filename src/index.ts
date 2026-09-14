import { ImmutableStorage, StorageClosedError, StorageCorruptError, StorageUnsupportedError, storageOwner, type StorageOwnerCarrier } from "./internal/storage.ts";
const SQLITE_CORRUPT = 11;

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
export interface OperationOptions { readonly signal?: AbortSignal; readonly timeoutMs?: number; readonly maxWorkUnits?: number; }
export interface OpenOptions extends OperationOptions { readonly fetchOptions?: Omit<RequestInit, "signal">; readonly limits?: WorkLimits; }
export interface ColumnMetadata { readonly name: string; readonly declaredType: string | null; readonly database: string | null; readonly table: string | null; readonly origin: string | null; }
export interface PrepareResult { readonly statement: Statement | null; readonly tailOffset: number; readonly tail: string; }
export interface Statement {
  readonly columnCount: number; readonly parameterCount: number;
  parameterName(index: number): string | null; parameterIndex(name: string): number;
  bind(indexOrName: number | string, value: SqliteValue): void; clearBindings(): void;
  step(options?: OperationOptions): Promise<StepResult>; reset(): void; finalize(): void;
  columnMetadata(index: number): ColumnMetadata; columnType(index: number): SqliteStorageClass;
  column(index: number): SqliteValue; columnInteger(index: number): bigint | null;
  columnReal(index: number): number | null; columnText(index: number): string | null;
  columnBlob(index: number): Uint8Array | null;
}
export interface Connection { prepare(sql: string, options?: OperationOptions): PrepareResult; close(): void; closeDeferred(): void; }
export type ErrorKind = "sqlite" | "transport" | "cancelled" | "timeout" | "limit" | "misuse" | "unsupported" | "internal";
export type UnsupportedClassification = "temporary" | "permanent";

export class JSQLiteError extends Error {
  readonly kind: ErrorKind;
  readonly code: number | null;
  readonly extendedCode: number | null;
  readonly unsupportedClassification: UnsupportedClassification | null;
  override readonly cause?: unknown;

  constructor(kind: ErrorKind, message: string, options: { code?: number; extendedCode?: number; unsupportedClassification?: UnsupportedClassification; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "JSQLiteError";
    this.kind = kind;
    this.code = kind === "sqlite" ? (options.code ?? SQLITE_CORRUPT) : null;
    this.extendedCode = kind === "sqlite" ? (options.extendedCode ?? this.code) : null;
    this.unsupportedClassification = kind === "unsupported" ? (options.unsupportedClassification ?? "temporary") : null;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

function failure(kind: ErrorKind, message: string, options?: ConstructorParameters<typeof JSQLiteError>[2]): never {
  throw new JSQLiteError(kind, message, options);
}
function finiteNonnegative(value: number | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) failure("misuse", `${name} must be finite and nonnegative`);
  return value;
}
class OpenConnection implements Connection, StorageOwnerCarrier {
  #source: ImmutableStorage | null;
  readonly [storageOwner]: ImmutableStorage;
  constructor(source: ImmutableStorage) { this.#source = source; this[storageOwner] = source; }
  #assertOpen(): ImmutableStorage {
    const source = this.#source;
    if (source === null || source.closed) failure("misuse", "connection is closed");
    return source;
  }
  prepare(_sql: string, _options?: OperationOptions): PrepareResult {
    this.#assertOpen();
    return failure("unsupported", "SQL preparation is not implemented", { unsupportedClassification: "temporary" });
  }
  close(): void {
    const source = this.#assertOpen();
    source.close(); this.#source = null;
  }
  closeDeferred(): void { this.close(); }
}

function validateFile(bytes: Uint8Array): ImmutableStorage {
  try { return ImmutableStorage.open(bytes); }
  catch (error) {
    if (error instanceof StorageUnsupportedError) failure("unsupported", error.message, { unsupportedClassification: error.classification });
    if (error instanceof StorageCorruptError) failure("sqlite", error.message);
    if (error instanceof StorageClosedError) failure("misuse", error.message);
    throw error;
  }
}

function mapAcquisitionError(error: unknown, timedOut: boolean, signal?: AbortSignal): never {
  if (error instanceof JSQLiteError) throw error;
  if (signal?.aborted) failure("cancelled", "database acquisition was cancelled", { cause: error });
  if (timedOut) failure("timeout", "database acquisition timed out", { cause: error });
  failure("transport", "database acquisition failed", { cause: error });
}

export async function open(source: string | URL | Request, options: OpenOptions = {}): Promise<Connection> {
  const timeoutMs = finiteNonnegative(options.timeoutMs, "timeoutMs");
  const maxFileBytes = finiteNonnegative(options.limits?.maxFileBytes, "limits.maxFileBytes") ?? 64 * 1024 * 1024;
  if (!Number.isSafeInteger(maxFileBytes)) failure("misuse", "limits.maxFileBytes must be a safe integer");
  if (options.signal?.aborted) failure("cancelled", "database acquisition was cancelled", { cause: options.signal.reason });

  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = timeoutMs === undefined ? undefined : setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const suppliedInit = options.fetchOptions as RequestInit | undefined;
    // Runtime callers may still supply signal despite the Omit type; it is intentionally ignored.
    const { signal: _ignored, ...explicitInit } = suppliedInit ?? {};
    const init: RequestInit = source instanceof Request
      ? { ...explicitInit, signal: controller.signal }
      : { credentials: "omit", cache: "default", redirect: "follow", ...explicitInit, signal: controller.signal };
    const request = new Request(source, init);
    const response = await fetch(request);
    if (!response.ok) failure("transport", `HTTP ${response.status} while acquiring database`);
    if (response.type === "opaque" || response.body === null) failure("transport", "Fetch response has no readable body");
    const lengthText = response.headers.get("content-length");
    let declaredLength: number | undefined;
    if (lengthText !== null && /^\d+$/.test(lengthText)) {
      declaredLength = Number(lengthText);
      if (!Number.isSafeInteger(declaredLength)) failure("transport", "invalid Content-Length");
      if (declaredLength > maxFileBytes) failure("limit", "database exceeds maxFileBytes");
    }
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (result.value.byteLength > maxFileBytes - total) failure("limit", "database exceeds maxFileBytes");
      chunks.push(result.value); total += result.value.byteLength;
    }
    if (declaredLength !== undefined && total !== declaredLength) failure("transport", "response body ended before Content-Length");
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new OpenConnection(validateFile(bytes));
  } catch (error) {
    try { await reader?.cancel(); } catch { /* preserve the primary failure */ }
    return mapAcquisitionError(error, timedOut, options.signal);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
