import { ImmutableStorage, StorageLimitError, StorageClosedError, StorageCorruptError, StorageUnsupportedError, storageOwner } from "./internal/storage.js";
import { parseSql, SqlParseError, SqlUnsupportedError } from "./internal/parse.js";
import { aggregateShapeSupported, rejectDistinctWindowFunctions, selectHasAggregate, selectHasWindow, VdbeStatement } from "./internal/vdbe.js";
import { compilePragma, pragmaNeedsSchema, setMetadataDatabases } from "./internal/pragma.js";
import { compileSelect } from "./internal/select-compiler.js";
import { rejectBareBuiltinWindowFunctions } from "./internal/resolve.js";
import { SchemaFormatError, loadSchemaGraph, sourceFreeSchemaGraph } from "./internal/schema.js";
import { btreeFromConnection } from "./internal/btree.js";
import { selectGraphContainsWith, selectGraphNeedsSchema } from "./internal/admission.js";
import { lowerOrdinaryCtes, recursiveCteOwner } from "./internal/cte.js";
import { dateTimeEnvironmentOption } from "./internal/date-time.js";
const SQLITE_CORRUPT = 11;
const SQLITE_BUSY = 5;
export class JSQLiteError extends Error {
    kind;
    code;
    extendedCode;
    unsupportedClassification;
    cause;
    constructor(kind, message, options = {}) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = "JSQLiteError";
        this.kind = kind;
        this.code = kind === "sqlite" ? (options.code ?? SQLITE_CORRUPT) : null;
        this.extendedCode = kind === "sqlite" ? (options.extendedCode ?? this.code) : null;
        this.unsupportedClassification = kind === "unsupported" ? (options.unsupportedClassification ?? "temporary") : null;
        if (options.cause !== undefined)
            this.cause = options.cause;
    }
}
function failure(kind, message, options) {
    throw new JSQLiteError(kind, message, options);
}
function finiteNonnegative(value, name) {
    if (value === undefined)
        return undefined;
    if (!Number.isFinite(value) || value < 0)
        failure("misuse", `${name} must be finite and nonnegative`);
    return value;
}
function finiteLimit(value, name, fallback) {
    const result = finiteNonnegative(value, name) ?? fallback;
    if (!Number.isSafeInteger(result))
        failure("misuse", `${name} must be a safe integer`);
    return result;
}
class OpenConnection {
    // Db.pBt residency for the immutable memory snapshot. No filesystem/VFS
    // filename is exposed by Fetch acquisition (pager.c memory filename = '').
    #pragmaTempOpen = false;
    #source;
    #state = "open";
    #limits;
    #maxRows;
    #btreeLimits;
    #statements = new Set();
    #dateTimeEnvironment;
    #activeStatement = null;
    [storageOwner];
    constructor(source, limits, maxRows, btreeLimits, dateTimeEnvironment) {
        this.#source = source;
        this[storageOwner] = source;
        this.#limits = limits;
        this.#maxRows = maxRows;
        this.#btreeLimits = btreeLimits;
        this.#dateTimeEnvironment = dateTimeEnvironment;
    }
    #assertResident() {
        const source = this.#source;
        if (source === null || source.closed)
            failure("misuse", "connection is closed");
        return source;
    }
    #finishClose(source) {
        source.close();
        this.#source = null;
        this.#state = "closed";
    }
    #assertOperationIdle() {
        if (this.#activeStatement !== null)
            failure("misuse", "a statement operation is pending");
    }
    prepare(sql, options) {
        this.#assertOperationIdle();
        this.#assertResident();
        if (this.#state !== "open")
            failure("misuse", "connection is closed");
        try {
            // Minimal browser/VM realms need not expose Performance. Bind one clock
            // for the entire construction interval; no cross-clock subtraction.
            const prepareNow = typeof globalThis.performance?.now === "function" ? () => globalThis.performance.now() : () => Date.now();
            const prepareStarted = prepareNow();
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
            if (parsed.statement.kind !== "select" && parsed.statement.kind !== "pragma") {
                failure("unsupported", "mutating SQL and schema changes are not supported", { unsupportedClassification: "permanent" });
            }
            // sqlite3Pragma resolves schema and opens explicit temp before registry lookup.
            if (parsed.statement.kind === "pragma") {
                const database = parsed.statement.database?.replace(/[A-Z]/g, char => char.toLowerCase());
                if (database !== undefined && database !== "main" && database !== "temp")
                    failure("sqlite", `unknown database ${parsed.statement.database}`, { code: 1 });
                if (database === "temp")
                    this.#pragmaTempOpen = true;
            }
            // Load immutable schema before admission so persisted view SELECTs are
            // reachable, then reject the complete graph before a compiler can create
            // or publish a Program.
            let schemaWork = 0;
            const schema = (parsed.statement.kind === "select" && !selectGraphNeedsSchema(parsed.statement) || parsed.statement.kind === "pragma" && !pragmaNeedsSchema(parsed.statement)) ? sourceFreeSchemaGraph(this) : loadSchemaGraph(this, { check: (_phase, units) => {
                    if (options?.signal?.aborted)
                        failure("cancelled", "statement construction was cancelled", { cause: options.signal.reason });
                    if (options?.timeoutMs !== undefined && prepareNow() - prepareStarted >= options.timeoutMs)
                        failure("timeout", "statement construction deadline exceeded");
                    schemaWork += units;
                    if (schemaWork > parserWork)
                        failure("limit", "schema construction work exceeded");
                } });
            const recursiveEncoding = this.#source.encoding === 1 ? "utf-8" : this.#source.encoding === 2 ? "utf-16le" : "utf-16be";
            let constructionWork = 0;
            const checkConstruction = () => {
                if (options?.signal?.aborted)
                    failure("cancelled", "statement construction was cancelled", { cause: options.signal.reason });
                if (options?.timeoutMs !== undefined && prepareNow() - prepareStarted >= options.timeoutMs)
                    failure("timeout", "statement construction deadline exceeded");
                if (++constructionWork > parserWork)
                    failure("limit", "statement construction work limit exceeded");
            };
            let program;
            let recompile;
            if (parsed.statement.kind === "pragma") {
                checkConstruction();
                program = compilePragma(parsed.statement, schema, this.#maxRows, this.#limits.maxWorkUnits, this.#limits.maxResultBytes, this.#limits.privateStateLimits, checkConstruction, [{ sequence: 0, name: "main", file: "" }, ...(this.#pragmaTempOpen ? [{ sequence: 1, name: "temp", file: "" }] : [])]);
            }
            else {
                const recursiveOwner = recursiveCteOwner(parsed.statement);
                const selected = recursiveOwner === null ? (lowerOrdinaryCtes(parsed.statement) ?? parsed.statement) : parsed.statement;
                try {
                    rejectBareBuiltinWindowFunctions(selected);
                }
                catch (error) {
                    if (error instanceof Error)
                        failure("sqlite", error.message, { code: 1 });
                    throw error;
                }
                if (selectHasWindow(selected))
                    rejectDistinctWindowFunctions(selected);
                if (recursiveOwner === null && selectGraphContainsWith(selected, schema)) {
                    failure("unsupported", "common table expressions are not implemented", { unsupportedClassification: "temporary" });
                }
                const aggregate = recursiveOwner === null && (selectHasAggregate(selected) || selected.hasGroupBy || selected.hasHaving);
                const jsonTableAggregate = aggregate && selected.from.items.length === 1 &&
                    ["json_each", "json_tree", "jsonb_each", "jsonb_tree"].includes(selected.from.items[0].tableName.toLowerCase());
                // window.c:sqlite3WindowRewrite performs its own aggregate analysis and
                // ORDER BY misuse validation before mutating the SELECT. Do not let the
                // ordinary aggregate-shape admission gate bypass that phase.
                const window = recursiveOwner === null && selectHasWindow(selected);
                if (aggregate && !window && !selected.hasCompound && !selected.from.derived && !aggregateShapeSupported(selected))
                    failure("unsupported", "this aggregate form is not implemented", { unsupportedClassification: "temporary" });
                setMetadataDatabases(schema, [{ sequence: 0, name: "main", file: "" }, ...(this.#pragmaTempOpen ? [{ sequence: 1, name: "temp", file: "" }] : [])], () => { this.#pragmaTempOpen = true; });
                program = compileSelect(selected, schema, btreeFromConnection(this, this.#btreeLimits), recursiveEncoding, this.#maxRows, this.#limits.maxWorkUnits, this.#limits.maxResultBytes, this.#limits.privateStateLimits, recursiveOwner !== null, () => {
                    if (options?.signal?.aborted)
                        failure("cancelled", "statement construction was cancelled", { cause: options.signal.reason });
                    if (options?.timeoutMs !== undefined && prepareNow() - prepareStarted >= options.timeoutMs)
                        failure("timeout", "statement construction deadline exceeded");
                    if (++constructionWork > parserWork)
                        failure("limit", "statement construction work limit exceeded");
                });
                recompile = (bindings, check) => {
                    // prepare.c:sqlite3Reprepare: saved SQL is parsed again, with the old
                    // typed bindings visible only to sample-value extraction. No public
                    // handle is registered until the original prepare, or during retry.
                    check();
                    const reparsed = parseSql(sql, { maxWorkUnits: Math.max(1024, this.#limits.maxWorkUnits) });
                    if (reparsed.statement?.kind !== "select")
                        failure("internal", "saved SQL no longer produces SELECT");
                    const reselected = recursiveOwner === null ? (lowerOrdinaryCtes(reparsed.statement) ?? reparsed.statement) : reparsed.statement;
                    const replacement = compileSelect(reselected, schema, btreeFromConnection(this, this.#btreeLimits), recursiveEncoding, this.#maxRows, this.#limits.maxWorkUnits, this.#limits.maxResultBytes, this.#limits.privateStateLimits, recursiveOwner !== null, check, bindings);
                    return this.#dateTimeEnvironment ? { ...replacement, dateTimeEnvironment: this.#dateTimeEnvironment } : replacement;
                };
            }
            let statement;
            const executionProgram = this.#dateTimeEnvironment ? { ...program, dateTimeEnvironment: this.#dateTimeEnvironment } : program;
            statement = new VdbeStatement(executionProgram, () => this.#assertOperationIdle(), () => {
                this.#assertOperationIdle();
                this.#activeStatement = statement;
                let released = false;
                return () => { if (!released) {
                    released = true;
                    this.#activeStatement = null;
                } };
            }, () => {
                this.#statements.delete(statement);
                if (this.#state === "zombie" && this.#statements.size === 0) {
                    const source = this.#source;
                    if (source !== null)
                        this.#finishClose(source);
                }
            }, recompile);
            this.#statements.add(statement);
            return { statement, tailOffset: parsed.tailOffset, tail: sql.slice(parsed.tailCodeUnit) };
        }
        catch (error) {
            if (error instanceof SqlUnsupportedError)
                return failure("unsupported", error.message, { unsupportedClassification: "temporary" });
            if (error instanceof SchemaFormatError)
                return failure("sqlite", error.message, { code: 11, cause: error });
            if (error instanceof SqlParseError)
                return failure("sqlite", error.message, { code: 1 });
            if (error instanceof StorageLimitError)
                return failure("limit", error.message, { cause: error });
            if (error instanceof RangeError)
                return failure("limit", error.message);
            throw error;
        }
    }
    close() {
        this.#assertOperationIdle();
        const source = this.#assertResident();
        if (this.#state !== "open")
            failure("misuse", "connection is closed");
        if (this.#statements.size !== 0)
            failure("sqlite", "unable to close due to unfinalized statements", { code: SQLITE_BUSY });
        this.#finishClose(source);
    }
    closeDeferred() {
        this.#assertOperationIdle();
        const source = this.#assertResident();
        if (this.#state !== "open")
            failure("misuse", "connection is closed");
        this.#state = "zombie";
        if (this.#statements.size === 0)
            this.#finishClose(source);
    }
}
function validateFile(bytes, maxFileBytes) {
    try {
        return ImmutableStorage.open(bytes, maxFileBytes);
    }
    catch (error) {
        if (error instanceof StorageUnsupportedError)
            failure("unsupported", error.message, { unsupportedClassification: error.classification });
        if (error instanceof StorageCorruptError)
            failure("sqlite", error.message);
        if (error instanceof StorageClosedError)
            failure("misuse", error.message);
        throw error;
    }
}
function mapAcquisitionError(error, timedOut, signal) {
    if (error instanceof JSQLiteError)
        throw error;
    if (signal?.aborted)
        failure("cancelled", "database acquisition was cancelled", { cause: error });
    if (timedOut)
        failure("timeout", "database acquisition timed out", { cause: error });
    failure("transport", "database acquisition failed", { cause: error });
}
export async function open(source, options = {}) {
    const timeoutMs = finiteNonnegative(options.timeoutMs, "timeoutMs");
    const maxFileBytes = finiteNonnegative(options.limits?.maxFileBytes, "limits.maxFileBytes") ?? 64 * 1024 * 1024;
    if (!Number.isSafeInteger(maxFileBytes))
        failure("misuse", "limits.maxFileBytes must be a safe integer");
    const parserLimits = {
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
    if (options.signal?.aborted)
        failure("cancelled", "database acquisition was cancelled", { cause: options.signal.reason });
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = timeoutMs === undefined ? undefined : setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    let reader;
    try {
        const suppliedInit = options.fetchOptions;
        // Runtime callers may still supply signal despite the Omit type; it is intentionally ignored.
        const { signal: _ignored, ...explicitInit } = suppliedInit ?? {};
        const init = source instanceof Request
            ? { ...explicitInit, signal: controller.signal }
            : { credentials: "omit", cache: "default", redirect: "follow", ...explicitInit, signal: controller.signal };
        const request = new Request(source, init);
        const response = await fetch(request);
        if (!response.ok)
            failure("transport", `HTTP ${response.status} while acquiring database`);
        if (response.type === "opaque" || response.body === null)
            failure("transport", "Fetch response has no readable body");
        const lengthText = response.headers.get("content-length");
        let declaredLength;
        if (lengthText !== null && /^\d+$/.test(lengthText)) {
            declaredLength = Number(lengthText);
            if (!Number.isSafeInteger(declaredLength))
                failure("transport", "invalid Content-Length");
            if (declaredLength > maxFileBytes)
                failure("limit", "database exceeds maxFileBytes");
        }
        reader = response.body.getReader();
        const chunks = [];
        let total = 0;
        while (true) {
            const result = await reader.read();
            if (result.done)
                break;
            if (result.value.byteLength > maxFileBytes - total)
                failure("limit", "database exceeds maxFileBytes");
            chunks.push(result.value);
            total += result.value.byteLength;
        }
        if (declaredLength !== undefined && total !== declaredLength)
            failure("transport", "response body ended before Content-Length");
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        const internalOptions = options;
        return new OpenConnection(validateFile(bytes, maxFileBytes), parserLimits, finiteLimit(options.limits?.maxRows, "limits.maxRows", 1_000_000), { maxBtreeDepth: finiteLimit(options.limits?.maxBtreeDepth, "limits.maxBtreeDepth", 64), maxOverflowPages: finiteLimit(options.limits?.maxOverflowPages, "limits.maxOverflowPages", 1_000_000) }, internalOptions[dateTimeEnvironmentOption]);
    }
    catch (error) {
        try {
            await reader?.cancel();
        }
        catch { /* preserve the primary failure */ }
        return mapAcquisitionError(error, timedOut, options.signal);
    }
    finally {
        if (timer !== undefined)
            clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
    }
}
