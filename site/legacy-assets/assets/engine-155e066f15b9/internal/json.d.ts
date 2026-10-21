import { Mem } from "./mem.js";
/** SQLite 3.53.4 src/json.c foundation. Nodes retain ordered object entries and
 * raw numeric spelling; they are deliberately not host JSON values. */
export type JsonNode = {
    readonly kind: "null" | "true" | "false";
} | {
    readonly kind: "number";
    readonly raw: string;
    readonly json5: boolean;
    readonly numericType?: 3 | 4 | 5 | 6;
} | {
    readonly kind: "string";
    readonly value: string;
} | {
    readonly kind: "array";
    readonly values: readonly JsonNode[];
} | {
    readonly kind: "object";
    readonly entries: readonly (readonly [string, JsonNode])[];
};
export declare function renderJson(n: JsonNode): string;
export interface JsonPrettyControl {
    reserve(bytes: number): void;
    release(bytes: number): void;
    checkpoint(units: number): Promise<void>;
    check(): void;
    charge(units: number): void;
    checkSize(bytes: number): void;
}
/** Ordered nodes replace JSONB offsets. Temporary retention is reserved before
 * conversion, and released in finally; chunks bound encoding and yielded work. */
export declare function jsonPretty(value: Mem, indent: Mem | undefined, control: JsonPrettyControl): Promise<Mem>;
export declare function encodeJsonb(n: JsonNode): Uint8Array;
export declare function parseJsonMem(value: Mem, json5?: boolean, charge?: (n: number) => void): JsonNode;
export declare function jsonValid(value: Mem, flags: number, charge?: (n: number) => void): boolean | null;
export declare function jsonValidAsync(value: Mem, flags: number, checkpoint: (n: number) => void | Promise<void>): Promise<boolean | null>;
export declare function appendJsonStringBytes(bytes: Uint8Array, scratch: Uint8Array, append: (part: Uint8Array) => Promise<void>, checkpoint: () => void | Promise<void>): Promise<void>;
export declare function quoteJsonBytes(bytes: Uint8Array): Uint8Array;
export declare function jsonTextResult(node: JsonNode): Mem;
/** JSONB is identified by its validated binary representation, not by the
 * JSON text subtype. In the pinned json.c registration, JSON_BLOB selects a
 * BLOB result while the SQLITE_RESULT_SUBTYPE flag is deliberately absent. */
export declare function jsonbResult(node: JsonNode): Mem;
/** json.c:jsonAppendSqlValue. TEXT subtype is copied verbatim, not parsed;
 * ordinary TEXT is quoted by bytes. BLOB translation uses the shared JSONB
 * byte walker. All coercions are private owning copies. */
export declare function jsonAggregateValueBytes(value: Mem): Uint8Array;
/** jsonReturnStringAsBlob: completed bytes feed the direct aBlob producer. */
export declare function jsonAggregateBlob(bytes: Uint8Array, control: Pick<JsonPrettyControl, "reserve" | "release" | "checkpoint" | "charge" | "check">): Promise<Mem>;
/** json.c:jsonAppendSqlValue classification used by scalar constructors. */
export declare function jsonNodeFromSqlValue(value: Mem): JsonNode;
/** src/json.c:jsonLookupStep read-only branches. Object scans deliberately
 * return the first matching label, preserving SQLite's duplicate-key rule. */
export declare function jsonLookup(root: JsonNode, path: string, charge?: (n: number) => void): JsonNode | undefined;
export declare const JSON_EACH_COLUMNS: readonly ["key", "value", "type", "atom", "id", "parent", "fullkey", "path"];
export declare const JSON_TABLE_COLUMNS: readonly ["key", "value", "type", "atom", "id", "parent", "fullkey", "path", "json", "root"];
/** Incremental src/json.c JsonEachCursor analogue. Parsing validates and retains
 * one ordered parse image; next() advances traversal, while column() produces
 * requested VM values. Direct row callers retain eager production by default. The reserve hook owns retained input plus current stack/path. */
export interface JsonTableCursor {
    next(): readonly Mem[] | null;
    column?(index: number): Mem;
    close(): void;
}
export declare function openJsonTableCursor(value: Mem, recursive: boolean, charge?: (n: number) => void, rootArgument?: string | Mem, binaryContainers?: boolean, reserve?: (oldBytes: number, newBytes: number) => void, columns?: ReadonlySet<number>, deferred?: boolean): JsonTableCursor;
export declare function jsonEachRows(value: Mem, charge?: (n: number) => void, rootPath?: string, binaryContainers?: boolean): readonly (readonly Mem[])[];
export declare function jsonTreeRows(value: Mem, charge?: (n: number) => void, rootPath?: string, binaryContainers?: boolean): readonly (readonly Mem[])[];
export declare function jsonExtractAsync(value: Mem, paths: readonly Mem[], mode: "text" | "blob" | "json" | "sql", checkpoint: (n: number) => void | Promise<void>, charge: (n: number) => void): Promise<Mem>;
export declare function jsonExtract(value: Mem, paths: readonly Mem[], charge?: (n: number) => void): Mem;
export declare function jsonbExtract(value: Mem, paths: readonly Mem[], charge?: (n: number) => void): Mem;
export declare function jsonbMemResult(value: Mem, node: JsonNode): Mem;
export declare function jsonArrow(value: Mem, path: Mem, sql: boolean, charge?: (n: number) => void): Mem;
export declare function jsonQuote(value: Mem): Mem;
export declare function jsonConstruct(kind: "array" | "object", values: readonly Mem[], blob?: boolean): Mem;
export declare function jsonAggregateLabel(value: Mem): Uint8Array | null;
export declare function withJsonAggregateLabel(value: Mem, control: Pick<JsonPrettyControl, "reserve" | "release" | "checkpoint">, use: (bytes: Uint8Array | null) => Promise<void>): Promise<void>;
export declare function jsonInspectAsync(value: Mem, path: Mem | undefined, length: boolean, charge: (n: number) => void, checkpoint: (n: number) => void | Promise<void>): Promise<Mem>;
export declare function jsonType(value: Mem, path?: Mem, charge?: (n: number) => void): Mem;
export declare function jsonArrayLength(value: Mem, path?: Mem, charge?: (n: number) => void): Mem;
export declare function jsonErrorPosition(value: Mem, charge?: (n: number) => void): Mem;
export declare function jsonErrorPositionAsync(value: Mem, checkpoint: (n: number) => void | Promise<void>): Promise<Mem>;
export declare function jsonEditAsync(value: Mem, args: readonly Mem[], mode: "set" | "insert" | "replace" | "remove" | "array_insert", charge: (n: number) => void, blob: boolean, checkpoint: (n: number) => void | Promise<void>): Promise<Mem>;
export declare function jsonEdit(value: Mem, args: readonly Mem[], mode: "set" | "insert" | "replace" | "remove" | "array_insert", charge?: (n: number) => void, blob?: boolean): Mem;
/** Feed the same translated producer directly into the aggregate JsonString.
 * No complete temporary TEXT, part inventory or joined/copy result is retained. */
export declare function appendJsonAggregateBlob(value: Mem, append: (bytes: Uint8Array) => Promise<void>, checkpoint: () => Promise<void>, trim: () => void, storage?: {
    reserve: (n: number) => void;
    release: (n: number) => void;
}): Promise<void>;
export declare function jsonPatch(target: Mem, patch: Mem, charge?: (n: number) => void, blob?: boolean): Mem;
