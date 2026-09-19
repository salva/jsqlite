import { ImmutableStorage, StorageClosedError, StorageCorruptError, StorageUnsupportedError, storageOwner, type StorageOwnerCarrier } from "./internal/storage.ts";
import { parseSql, SqlParseError, SqlUnsupportedError } from "./internal/parse.ts";
import { aggregateShapeSupported, compileAggregateSelect, compileMultipleRecursiveCtes, compileRecursiveCteSelect, compileRecursiveWindowSelect, compileScalarSelect, compileTableSelect, rejectDistinctWindowFunctions, selectHasAggregate, selectHasWindow, VdbeStatement } from "./internal/vdbe.ts";
import { loadSchemaGraph } from "./internal/schema.ts";
import { btreeFromConnection } from "./internal/btree.ts";
import { selectGraphContainsWith } from "./internal/admission.ts";
import { lowerOrdinaryCtes, recursiveCteOwner } from "./internal/cte.ts";

const SQLITE_CORRUPT = 11;
const SQLITE_BUSY = 5;

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
function finiteLimit(value: number | undefined, name: string, fallback: number): number {
  const result = finiteNonnegative(value, name) ?? fallback;
  if (!Number.isSafeInteger(result)) failure("misuse", `${name} must be a safe integer`);
  return result;
}

interface PrepareLimits {
  readonly maxSqlBytes: number;
  readonly maxParserDepth: number;
  readonly maxExpressionDepth: number;
  readonly maxWorkUnits: number;
  readonly maxResultBytes: number;
  readonly privateStateLimits: Readonly<{ maxEntries: number; maxKeyBytes: number; maxBytes: number }>;
}

class OpenConnection implements Connection, StorageOwnerCarrier {
  #source: ImmutableStorage | null;
  #state: "open" | "zombie" | "closed" = "open";
  readonly #limits: PrepareLimits;
  readonly #maxRows: number;
  readonly #btreeLimits: { readonly maxBtreeDepth: number; readonly maxOverflowPages: number };
  readonly #statements = new Set<VdbeStatement>();
  #activeStatement: VdbeStatement | null = null;
  readonly [storageOwner]: ImmutableStorage;

  constructor(
    source: ImmutableStorage,
    limits: PrepareLimits,
    maxRows: number,
    btreeLimits: { readonly maxBtreeDepth: number; readonly maxOverflowPages: number },
  ) {
    this.#source = source;
    this[storageOwner] = source;
    this.#limits = limits;
    this.#maxRows = maxRows;
    this.#btreeLimits = btreeLimits;
  }

  #assertResident(): ImmutableStorage {
    const source = this.#source;
    if (source === null || source.closed) failure("misuse", "connection is closed");
    return source;
  }

  #finishClose(source: ImmutableStorage): void {
    source.close();
    this.#source = null;
    this.#state = "closed";
  }

  #assertOperationIdle(): void {
    if (this.#activeStatement !== null) failure("misuse", "a statement operation is pending");
  }

  prepare(sql: string, options?: OperationOptions): PrepareResult {
    this.#assertOperationIdle();
    this.#assertResident();
    if (this.#state !== "open") failure("misuse", "connection is closed");
    try {
      const operationWork = finiteLimit(options?.maxWorkUnits, "maxWorkUnits", this.#limits.maxWorkUnits);
      // Connection maxWorkUnits is the statement execution budget. Keep parse
      // admission independently bounded when that execution budget is tiny;
      // an explicit prepare-operation budget still controls parser work.
      const parserWork = options?.maxWorkUnits === undefined
        ? Math.max(1_024, this.#limits.maxWorkUnits)
        : Math.min(operationWork, this.#limits.maxWorkUnits);
      const parsed = parseSql(sql, {
        ...this.#limits,
        maxWorkUnits: parserWork,
      });
      if (parsed.statement === null) {
        return { statement: null, tailOffset: parsed.tailOffset, tail: sql.slice(parsed.tailCodeUnit) };
      }
      if (parsed.statement.kind !== "select") {
        failure("unsupported", "mutating SQL and schema changes are not supported", { unsupportedClassification: "permanent" });
      }
      // Load immutable schema before admission so persisted view SELECTs are
      // reachable, then reject the complete graph before a compiler can create
      // or publish a Program.
      const schema = loadSchemaGraph(this);
      const recursiveOwner = recursiveCteOwner(parsed.statement);
      const selected = recursiveOwner===null ? (lowerOrdinaryCtes(parsed.statement) ?? parsed.statement) : parsed.statement;
      if(selectHasWindow(selected)) rejectDistinctWindowFunctions(selected);
      if (recursiveOwner===null && selectGraphContainsWith(selected, schema)) {
        failure("unsupported", "common table expressions are not implemented", { unsupportedClassification: "temporary" });
      }
      const aggregate = recursiveOwner===null&&(selectHasAggregate(selected)||selected.hasGroupBy||selected.hasHaving);
      // window.c:sqlite3WindowRewrite performs its own aggregate analysis and
      // ORDER BY misuse validation before mutating the SELECT. Do not let the
      // ordinary aggregate-shape admission gate bypass that phase.
      const window = recursiveOwner===null&&selectHasWindow(selected);
      if(aggregate&&!window&&!selected.hasCompound&&!selected.from.derived&&!aggregateShapeSupported(selected)) failure("unsupported","this aggregate form is not implemented",{unsupportedClassification:"temporary"});
      const recursiveEncoding = this.#source!.encoding === 1 ? "utf-8" : this.#source!.encoding === 2 ? "utf-16le" : "utf-16be";
      const program = recursiveOwner!==null
        ? (compileRecursiveWindowSelect(selected, schema, btreeFromConnection(this, this.#btreeLimits), this.#maxRows, this.#limits.maxWorkUnits, this.#limits.maxResultBytes, this.#limits.privateStateLimits) ?? compileMultipleRecursiveCtes(selected, recursiveEncoding, this.#limits.maxWorkUnits, this.#limits.maxResultBytes, this.#limits.privateStateLimits, this.#maxRows) ?? compileRecursiveCteSelect(selected, recursiveEncoding, this.#limits.maxWorkUnits, this.#limits.maxResultBytes, this.#limits.privateStateLimits, this.#maxRows))
        : aggregate&&!window
        ? compileAggregateSelect(selected, schema, btreeFromConnection(this, this.#btreeLimits), this.#maxRows, this.#limits.maxWorkUnits, this.#limits.maxResultBytes, this.#limits.privateStateLimits)
        : selected.from.items.length || selected.where
        ? compileTableSelect(
            selected,
            schema,
            btreeFromConnection(this, this.#btreeLimits),
            this.#maxRows,
            this.#limits.maxWorkUnits,
            this.#limits.maxResultBytes,
            this.#limits.privateStateLimits,
          )
        : compileScalarSelect(selected, this.#source!.encoding === 1 ? "utf-8" : this.#source!.encoding === 2 ? "utf-16le" : "utf-16be", this.#limits.maxWorkUnits, this.#limits.maxResultBytes, this.#limits.privateStateLimits, schema, btreeFromConnection(this, this.#btreeLimits), this.#maxRows);
      let statement!: VdbeStatement;
      statement = new VdbeStatement(program,
        () => this.#assertOperationIdle(),
        () => {
          this.#assertOperationIdle();
          this.#activeStatement = statement;
          let released = false;
          return () => { if (!released) { released = true; this.#activeStatement = null; } };
        },
        () => {
        this.#statements.delete(statement);
        if (this.#state === "zombie" && this.#statements.size === 0) {
          const source = this.#source;
          if (source !== null) this.#finishClose(source);
        }
      });
      this.#statements.add(statement);
      return { statement, tailOffset: parsed.tailOffset, tail: sql.slice(parsed.tailCodeUnit) };
    } catch (error) {
      if (error instanceof SqlUnsupportedError) return failure("unsupported", error.message, { unsupportedClassification: "temporary" });
      if (error instanceof SqlParseError) return failure("sqlite", error.message, { code: 1 });
      if (error instanceof RangeError) return failure("limit", error.message);
      throw error;
    }
  }

  close(): void {
    this.#assertOperationIdle();
    const source = this.#assertResident();
    if (this.#state !== "open") failure("misuse", "connection is closed");
    if (this.#statements.size !== 0) failure("sqlite", "unable to close due to unfinalized statements", { code: SQLITE_BUSY });
    this.#finishClose(source);
  }

  closeDeferred(): void {
    this.#assertOperationIdle();
    const source = this.#assertResident();
    if (this.#state !== "open") failure("misuse", "connection is closed");
    this.#state = "zombie";
    if (this.#statements.size === 0) this.#finishClose(source);
  }
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
  const parserLimits: PrepareLimits = {
    maxSqlBytes: finiteLimit(options.limits?.maxSqlBytes, "limits.maxSqlBytes", 16 * 1024 * 1024),
    maxParserDepth: finiteLimit(options.limits?.maxParserDepth, "limits.maxParserDepth", 2500),
    maxExpressionDepth: finiteLimit(options.limits?.maxExpressionDepth, "limits.maxExpressionDepth", 1000),
    maxWorkUnits: finiteLimit(options.limits?.maxWorkUnits, "limits.maxWorkUnits", 10_000_000),
    maxResultBytes: finiteLimit(options.limits?.maxResultBytes, "limits.maxResultBytes", 1_000_000_000),
    privateStateLimits: Object.freeze({
      maxEntries: finiteLimit(options.limits?.maxPrivateEntries, "limits.maxPrivateEntries", 100_000),
      maxKeyBytes: finiteLimit(options.limits?.maxPrivateKeyBytes, "limits.maxPrivateKeyBytes", 16 * 1024 * 1024),
      maxBytes: finiteLimit(options.limits?.maxPrivateBytes, "limits.maxPrivateBytes", 256 * 1024 * 1024),
    }),
  };
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
    return new OpenConnection(validateFile(bytes), parserLimits, finiteLimit(options.limits?.maxRows, "limits.maxRows", 1_000_000), { maxBtreeDepth: finiteLimit(options.limits?.maxBtreeDepth, "limits.maxBtreeDepth", 64), maxOverflowPages: finiteLimit(options.limits?.maxOverflowPages, "limits.maxOverflowPages", 1_000_000) });
  } catch (error) {
    try { await reader?.cancel(); } catch { /* preserve the primary failure */ }
    return mapAcquisitionError(error, timedOut, options.signal);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
