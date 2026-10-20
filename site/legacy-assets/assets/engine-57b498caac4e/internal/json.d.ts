import { Mem } from "./mem.js";
/** SQLite 3.53.4 src/json.c foundation. Nodes retain ordered object entries and
 * raw numeric spelling; they are deliberately not host JSON values. */
export type JsonNode = {
    readonly kind: "null" | "true" | "false";
} | {
    readonly kind: "number";
    readonly raw: string;
    readonly json5: boolean;
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
export declare function jsonValid(value: Mem, flags: number, charge?: (n: number) => void): boolean;
export declare function jsonTextResult(node: JsonNode): Mem;
/** JSONB is identified by its validated binary representation, not by the
 * JSON text subtype. In the pinned json.c registration, JSON_BLOB selects a
 * BLOB result while the SQLITE_RESULT_SUBTYPE flag is deliberately absent. */
export declare function jsonbResult(node: JsonNode): Mem;
/** json.c:jsonAppendSqlValue classification used by JSON aggregate steps. */
export declare function jsonNodeFromSqlValue(value: Mem): JsonNode;
/** src/json.c:jsonLookupStep read-only branches. Object scans deliberately
 * return the first matching label, preserving SQLite's duplicate-key rule. */
export declare function jsonLookup(root: JsonNode, path: string): JsonNode | undefined;
export declare const JSON_EACH_COLUMNS: readonly ["key", "value", "type", "atom", "id", "parent", "fullkey", "path"];
export declare const JSON_TABLE_COLUMNS: readonly ["key", "value", "type", "atom", "id", "parent", "fullkey", "path", "json", "root"];
/** Incremental src/json.c JsonEachCursor analogue. Parsing validates and retains
 * one ordered parse image; next() alone advances traversal and constructs the
 * current row. The reserve hook owns retained input plus current stack/path. */
export interface JsonTableCursor {
    next(): readonly Mem[] | null;
    close(): void;
}
export declare function openJsonTableCursor(value: Mem, recursive: boolean, charge?: (n: number) => void, rootPath?: string, binaryContainers?: boolean, reserve?: (oldBytes: number, newBytes: number) => void): JsonTableCursor;
export declare function jsonEachRows(value: Mem, charge?: (n: number) => void, rootPath?: string, binaryContainers?: boolean): readonly (readonly Mem[])[];
export declare function jsonTreeRows(value: Mem, charge?: (n: number) => void, rootPath?: string, binaryContainers?: boolean): readonly (readonly Mem[])[];
/** src/json.c:jsonExtractFunc result shaping. */
export declare function jsonExtract(value: Mem, paths: readonly Mem[], charge?: (n: number) => void): Mem;
export declare function jsonbExtract(value: Mem, paths: readonly Mem[], charge?: (n: number) => void): Mem;
export declare function jsonbMemResult(value: Mem, node: JsonNode): Mem;
export declare function jsonArrow(value: Mem, path: Mem, sql: boolean, charge?: (n: number) => void): Mem;
export declare function jsonQuote(value: Mem): Mem;
export declare function jsonConstruct(kind: "array" | "object", values: readonly Mem[], blob?: boolean): Mem;
export declare function jsonType(value: Mem, path?: Mem, charge?: (n: number) => void): Mem;
export declare function jsonArrayLength(value: Mem, path?: Mem, charge?: (n: number) => void): Mem;
export declare function jsonErrorPosition(value: Mem): Mem;
export declare function jsonEdit(value: Mem, args: readonly Mem[], mode: "set" | "insert" | "replace" | "remove" | "array_insert", charge?: (n: number) => void, blob?: boolean): Mem;
export declare function jsonPatch(target: Mem, patch: Mem, charge?: (n: number) => void, blob?: boolean): Mem;
