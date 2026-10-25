import { type DatabaseEncoding } from "./record.js";
import { type ExprNode, type SchemaDdlNode, type SchemaTriggerStep, type SelectNode } from "./parse.js";
import { type StorageOwnerCarrier } from "./storage.js";
import { type SqlToken } from "./tokenize.js";
import { KeyInfo, type BuiltinCollation } from "./comparison.js";
/** A malformed sqlite_schema row or declaration. */
export declare class SchemaFormatError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
/** A recognized schema construct whose construction is staged for a later slice. */
export declare class SchemaUnsupportedError extends Error {
    readonly classification: "temporary";
    constructor(message: string);
}
export declare class SchemaStateError extends Error {
    constructor(message: string);
}
export interface ColumnNode {
    readonly name: string;
    /** build.c COLFLAG_HIDDEN: explicit lookup retains this declaration. */
    readonly hidden?: boolean;
    readonly szEst: number;
    readonly declaredType: string | null;
    readonly affinity: "blob" | "text" | "numeric" | "integer" | "real" | "flexnum";
    readonly defaultExpr: ExprNode | null;
    readonly generatedExpr: ExprNode | null;
    readonly defaultIndex: number | null;
    readonly notNull: boolean;
    readonly primaryKeyPosition: number | null;
    readonly unique: boolean;
    readonly collation: string | null;
    readonly generatedStorage: "stored" | "virtual" | null;
    readonly checks: readonly CheckConstraintNode[];
}
export interface CheckConstraintNode {
    readonly name: string | null;
    readonly column: ColumnNode | null;
    readonly expr: ExprNode;
    readonly sql: string;
}
export interface ForeignKeyColumnNode {
    readonly column: ColumnNode;
    readonly referencedColumn: string | null;
}
export interface ForeignKeyNode {
    readonly name: string | null;
    readonly columns: readonly ForeignKeyColumnNode[];
    readonly referencedTableName: string;
    readonly referencedTable: TableNode | null;
    readonly onDelete: import("./parse.js").ForeignKeyAction;
    readonly onUpdate: import("./parse.js").ForeignKeyAction;
    readonly deferrable: boolean;
    readonly initiallyDeferred: boolean;
    readonly sql: string;
}
export interface IndexTerm {
    readonly column: ColumnNode | null;
    readonly expression: ExprNode | null;
    readonly expressionSql: string | null;
    readonly descending: boolean;
    readonly collation: string | null;
    readonly nulls: "first" | "last" | null;
}
export interface TableNode {
    readonly szTabRow: number;
    /** build.c sqlite3AddPrimaryKey identity; null means no rowid alias. */
    readonly integerPrimaryKey?: ColumnNode | null;
    readonly nRowLogEst: number;
    readonly hasStat1: boolean;
    readonly kind: "table";
    readonly name: string;
    readonly tableName: string;
    readonly rootPage: number;
    readonly sql: string;
    readonly columns: readonly ColumnNode[];
    readonly indexes: IndexNode[];
    readonly strict?: boolean;
    readonly withoutRowid: boolean;
    /** select.c TF_NoVisibleRowid; independent of physical WITHOUT ROWID storage. */
    readonly noVisibleRowid?: boolean;
    readonly primaryKey: readonly ColumnNode[];
    readonly primaryKeyTerms: readonly IndexTerm[];
    readonly storageKey: readonly ColumnNode[];
    readonly checks: readonly CheckConstraintNode[];
    readonly foreignKeys: readonly ForeignKeyNode[];
    readonly referencedBy: readonly ForeignKeyNode[];
}
export interface IndexNode {
    readonly szIdxRow: number;
    readonly rowLogEst: readonly number[];
    readonly stat4?: IndexStat4 | null;
    readonly hasStat1: boolean;
    readonly unordered: boolean;
    readonly noSkipScan: boolean;
    readonly kind: "index";
    readonly name: string;
    readonly tableName: string;
    readonly rootPage: number;
    readonly sql: string | null;
    readonly table: TableNode;
    readonly terms: readonly IndexTerm[];
    readonly unique: boolean;
    readonly onError: string;
    readonly origin: "create" | "primary-key" | "unique";
    readonly partialWhere: ExprNode | null;
    /** Immutable packed-key identity, built exactly once with the schema. */
    readonly physical: PhysicalIndex | null;
    readonly layout: PhysicalIndexLayout;
}
/** Single immutable estimate owner: accessor retained for existing consumers. */
export interface IndexStatistics {
    readonly rowLogEst: readonly number[];
    readonly unordered: boolean;
}
export declare function statisticsForIndex(index: IndexNode): IndexStatistics;
/** util.c:sqlite3LogEst, including its small integer rounding table. */
export declare function sqliteLogEst(value: bigint): number;
export interface PhysicalIndexField {
    readonly role: "declared" | "primary-key-suffix" | "stored-column" | "rowid-tail";
    readonly column: ColumnNode | null;
    readonly expression: ExprNode | null;
    readonly collation: BuiltinCollation;
    readonly descending: boolean;
    readonly nullsLarge: false;
}
/** Source record ownership independent of executable CollSeq/KeyInfo. */
export interface PhysicalIndexLayout {
    readonly fields: readonly (Omit<PhysicalIndexField, "collation"> & {
        readonly collation: string;
        readonly collationName?: string;
    })[];
    readonly declaredFieldCount: number;
    readonly rowidField: number;
    readonly primaryKeyFields: readonly number[];
}
export interface PhysicalIndex {
    readonly index: IndexNode;
    readonly fields: readonly PhysicalIndexField[];
    readonly declaredFieldCount: number;
    readonly rowidField: number; /** Exact secondary-record field ordinal for each primary KeyInfo term, in PK order. */
    readonly primaryKeyFields: readonly number[];
    readonly keyInfo: KeyInfo;
}
/** build.c sqlite3TableColumnToStorage. VIRTUAL columns are absent from
 * records but occupy the register-cache tail after all nonvirtual columns. */
export declare function tableColumnToStorage(table: Pick<TableNode, "columns">, column: number): number;
/** Historical name retained for internal consumers that construct synthetic
 * rowid schemas. The represented physical descriptor now also covers WITHOUT
 * ROWID indexes. */
export type PhysicalRowidIndex = PhysicalIndex;
export interface ViewNode {
    readonly kind: "view";
    readonly name: string;
    readonly tableName: string;
    readonly rootPage: 0;
    readonly sql: string;
    readonly selectSql: string;
    readonly select: SelectNode;
    readonly columns: readonly string[];
}
export interface TriggerNode {
    readonly kind: "trigger";
    readonly name: string;
    readonly tableName: string;
    readonly rootPage: 0;
    readonly sql: string;
    readonly target: TableNode | ViewNode;
    readonly declaration: NonNullable<SchemaDdlNode["trigger"]>;
    /** attach.c init-busy fixed expression/step trees (variables become NULL). */
    readonly initializedWhen: import("./lemon-runtime.js").LemonValue<SqlToken> | null;
    readonly initializedSteps: readonly SchemaTriggerStep[];
}
export type SchemaObject = TableNode | IndexNode | ViewNode | TriggerNode;
/** util.c sqlite3GetInt32/sqlite3Atoi: failure leaves the initialized zero. */
export declare function sqliteAtoi(z: string): number;
/** build.c sqlite3AddColumn/ sqlite3AffinityType, including retained CHAR pointer. */
export declare function columnTypeEstimate(declaredType: string | null): {
    affinity: ColumnNode["affinity"];
    szEst: number;
};
/** Count-bearing sample prefix shared by schema loading and its consumers. */
export interface Stat4SampleCounts {
    readonly anEq: readonly bigint[];
    readonly anLt: readonly bigint[];
    readonly anDLt: readonly bigint[];
}
export interface Stat4AverageState {
    readonly samples: readonly Stat4SampleCounts[];
    readonly nSample: number;
    readonly nSampleCol: number;
    nRowEst0: bigint;
    readonly aAvgEq: bigint[];
}
/** analyze.c:initAvgEq. tRowcnt is u64, not signed i64: usual C arithmetic
 * conversions make products/division unsigned where a row count participates.
 * Only assignment to nDist100 reinterprets the resulting bits as signed. */
export declare function initStat4AvgEq(state: Stat4AverageState, nKeyCol: number, aiRowEst: readonly bigint[] | null): void;
export interface Stat4InputRow {
    readonly name: string | null;
    readonly neq: string | null;
    readonly nlt: string | null;
    readonly ndlt: string | null;
    readonly bytes: Uint8Array;
}
export interface Stat4Sample extends Stat4SampleCounts {
    readonly p: Uint8Array;
    readonly n: number;
}
export interface IndexStat4 {
    readonly mxSample: number;
    readonly nSample: number;
    readonly nSampleCol: number;
    readonly samples: readonly Stat4Sample[];
    readonly nRowEst0: bigint;
    readonly aAvgEq: readonly bigint[];
}
export interface Stat4LoadOptions {
    /** INTERNAL logical schema envelope, never execution-private accounting. */
    readonly maxBytes: number;
    readonly check?: (phase: "count" | "capacity" | "load" | "copy" | "finalize", units: number) => void;
}
/** analyze.c:loadStatTbl. Iterator factory is reopened for the load pass;
 * no retained decoded table/index or sample cap. Grouped count state alone is
 * retained between passes. Native sample metadata costs 40 logical bytes per
 * slot, each rowcnt costs 8, and each owned record costs n+8. This is logical
 * accounting, not a claim about host object heap sizes. */
export declare function loadStat4Samples<T extends object>(rows: () => Iterable<Stat4InputRow>, find: (name: string) => T | null, layout: (index: T) => {
    nSampleCol: number;
    nKeyCol: number;
    aiRowEst: readonly bigint[] | null;
}, options: Stat4LoadOptions): Map<T, IndexStat4>;
/** analyze.c decodeIntArray: zero allocated counts, uint64 accumulation.
 * Reused aiRowEst destinations preserve untouched trailing slots. */
export declare function decodeStat4Counts(z: string | null, nOut: number, out?: bigint[], check?: (units: number) => void): bigint[];
/** attach.c sqlite3FixTriggerStep/FixExpr/FixSelect. Retain the original parse
 * tree separately; initialization owns variable-to-NULL and main fixation. */
/** Initialized DDL semantic flags belong to the fixed tree, never the original
 * generated declaration. A schema name is the immutable single-db carrier. */
export interface InitializedDdlSource {
    readonly schema: "main";
    readonly fixedSchema: true;
    readonly fromDDL: true;
    readonly notCte: boolean;
    readonly hadSchema: boolean;
}
export interface InitializedDdlExpr {
    readonly fromDDL: true;
}
/** Production uses build.c-owned identity, never inference from index sort flags.
 * Fallback supports older private mock tables; real and transient producers
 * explicitly publish a column or null. */
export declare function integerPrimaryKeyColumn(table: TableNode): ColumnNode | null;
/** build.c:sqlite3KeyInfoOfIndex and convertToWithoutRowidTable for admitted
 * rowid and WITHOUT ROWID layouts. Unsupported layouts return null atomically. */
export declare function physicalIndexLayout(index: IndexNode): PhysicalIndexLayout;
export declare function physicalIndex(index: IndexNode, encoding: DatabaseEncoding): PhysicalIndex | null;
/** Compatibility entrypoint for rowid-only callers. New lowering should use
 * physicalIndex so WITHOUT ROWID layouts are not accidentally excluded. */
export declare function physicalRowidIndex(index: IndexNode, encoding: DatabaseEncoding): PhysicalIndex | null;
/** build.c:sqlite3FindTable; usable by linked transient resolution schemas. */
export declare function findSchemaTable(schema: {
    readonly tables: ReadonlyMap<string, TableNode>;
}, name: string): TableNode | undefined;
export declare class SchemaGraph {
    #private;
    readonly encoding: DatabaseEncoding;
    readonly objects: readonly SchemaObject[];
    readonly tables: ReadonlyMap<string, TableNode>;
    readonly indexes: ReadonlyMap<string, IndexNode>;
    readonly views: ReadonlyMap<string, ViewNode>;
    readonly triggers: ReadonlyMap<string, TriggerNode>;
    constructor(owner: StorageOwnerCarrier, encoding: DatabaseEncoding, objects: SchemaObject[], tables: Map<string, TableNode>, indexes: Map<string, IndexNode>, views: Map<string, ViewNode>, triggers?: Map<string, TriggerNode>);
    /** build.c:sqlite3FindTable — aliases share a single synthetic Table. */
    findTable(name: string): TableNode | undefined;
    assertOpen(): void;
    /** Resolution-only table used by select.c-style coroutine consumers. It is
     * never opened as a b-tree; the owning compiler supplies its rows. */
    withTransientTable(table: TableNode): SchemaGraph;
}
/** Publish completed SELECT-result metadata (select.c:2376/2432/2464).
 * Persistent defaults/ANALYZE must never run on a rootPage=0 result table. */
export declare function freezeTransientTable(table: TableNode): TableNode;
/**
 * Translate prepare.c sqlite3InitOne/sqlite3InitCallback for the supported
 * table, index, view and retained trigger construction tranche. Root page 1 is read via the
 * existing connection storage owner; every graph value is detached from cursor borrows.
 */
export declare function canonicalSchemaCatalog(connection: StorageOwnerCarrier): string;
export interface SchemaLoadContext {
    readonly maxStat4Bytes?: number;
    readonly check?: Stat4LoadOptions["check"];
}
/** Source-free SELECTs do not invoke sqlite3LocateTable/schema initialization.
 * This uncached empty carrier supplies compiler contracts without publishing a
 * failed catalog initialization as successfully loaded. */
export declare function sourceFreeSchemaGraph(connection: StorageOwnerCarrier): SchemaGraph;
export declare function loadSchemaGraph(connection: StorageOwnerCarrier, context?: SchemaLoadContext): SchemaGraph;
