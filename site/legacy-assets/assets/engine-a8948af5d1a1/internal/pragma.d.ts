import type { PragmaNode } from './parse.js';
import { type SchemaGraph } from './schema.js';
import type { Program } from './vdbe.js';
import type { PrivateStateLimits } from './private-state.js';
/** pragma.c sqlite3Pragma/TABLE_INFO: prepare-time schema traversal emits
 * literal register loads and ResultRow, not a host row-returning evaluator.
 * Main is the sole persisted Db. Temp is empty; attached databases are absent.
 */
export interface PragmaDatabase {
    readonly sequence: number;
    readonly name: string;
    readonly file: string;
}
export declare function pragmaNeedsSchema(node: PragmaNode): boolean;
export declare const TABLE_INFO_COLUMNS: readonly string[];
export declare const TABLE_XINFO_COLUMNS: readonly string[];
export type MetadataValue = string | number | null;
/** pragmaVtabFilter uses sqlite3_value_text (NULL stays NULL), then the
 * existing PRAGMA schema lookup. Hidden values are retained independently of
 * produced columns; xColumn returns NULL for absent schema, not default 'main'. */
export declare function metadataTableSource(schema: SchemaGraph, argument: string | null, database: string | null, extended: boolean, check: () => void): Generator<readonly MetadataValue[]>;
export declare const METADATA_MODULE_COLUMNS: Readonly<Record<string, readonly string[]>>;
export declare function metadataHiddenColumns(module: string): readonly string[];
export declare function setMetadataDatabases(schema: SchemaGraph, databases: readonly PragmaDatabase[], openTemp: () => void): void;
export declare function metadataSource(schema: SchemaGraph, argument: string | null, database: string | null, module: string, check: () => void): Generator<readonly MetadataValue[]>;
export declare function compilePragma(node: PragmaNode, schema: SchemaGraph, maxRows: number, maxWorkUnits: number, maxResultBytes: number, privateStateLimits: PrivateStateLimits, check: () => void, databases: readonly PragmaDatabase[]): Program;
/** pragmaVtabConnect declares arg/schema HIDDEN. vtab.c removes HIDDEN from
 * their allocated type string, leaving empty (not absent); visible untyped
 * columns have no type allocation. Preserve that distinction in SELECT metadata. */
export declare function metadataColumnDeclaredType(origin: string | null): string | null;
