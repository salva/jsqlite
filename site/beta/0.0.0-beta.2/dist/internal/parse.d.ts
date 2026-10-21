import { type SqlToken } from "./tokenize.js";
import { type LemonTrace, type LemonValue } from "./lemon-runtime.js";
export type ExprNode = {
    readonly kind: "tokens";
    readonly tokens: readonly SqlToken[];
    readonly reduction?: LemonValue<SqlToken>;
    readonly alias?: string;
    readonly sourceText?: string;
};
export type WindowFrameType = "range" | "rows" | "groups";
export type WindowFrameBoundaryKind = "unbounded" | "preceding" | "current" | "following";
export type WindowFrameExclusion = "no-others" | "current-row" | "group" | "ties" | null;
export type WindowFrameBoundaryNode = Readonly<{
    kind: WindowFrameBoundaryKind;
    expr: ExprNode | null;
}>;
export type WindowFrameNode = Readonly<{
    type: WindowFrameType;
    start: WindowFrameBoundaryNode;
    end: WindowFrameBoundaryNode;
    exclusion: WindowFrameExclusion;
    implicit: boolean;
}>;
export type WindowDefinitionNode = {
    readonly name: string;
    readonly baseName: string | null;
    readonly hasFrame: boolean;
    readonly frame: WindowFrameNode;
    readonly frameError: string | null;
    readonly partitionBy: readonly ExprNode[];
    readonly orderBy: readonly ExprNode[];
    readonly orderTerms: readonly OrderTermNode[];
};
export type OrderTermNode = {
    readonly expr: ExprNode;
    readonly descending: boolean;
    readonly nulls: "first" | "last" | null;
};
export type CompoundOperator = "union-all" | "union" | "intersect" | "except";
export type CteMaterialization = "any" | "materialized" | "not-materialized";
export type CteNode = Readonly<{
    name: string;
    columns: readonly string[] | null;
    select: SelectNode;
    materialization: CteMaterialization;
}>;
export type WithClause = Readonly<{
    recursive: boolean;
    ctes: readonly CteNode[];
}>;
export type JoinFlags = Readonly<{
    inner: boolean;
    cross: boolean;
    natural: boolean;
    left: boolean;
    right: boolean;
    outer: boolean;
    error: boolean;
}>;
export type SourceItem = Readonly<{
    databaseName: string | null;
    tableName: string;
    arguments: readonly ExprNode[] | null;
    alias: string | null;
    indexedBy: string | null;
    notIndexed: boolean;
    on: ExprNode | null;
    using: readonly string[] | null;
    joinFromLeft: JoinFlags;
    leftOfRightJoin: boolean;
    cursorId: null;
    table: null;
}>;
type FlattenedDerived = Readonly<{
    select: SelectNode;
}>;
export type DerivedSource = Readonly<{
    index: number;
    select: SelectNode;
    alias: string | null;
}>;
export type CteUseCarrier = {
    readonly nUse: number;
};
export type CteDerivedSource = Readonly<{
    index: number;
    select: SelectNode;
    alias: string;
    use: CteUseCarrier;
    materialization: CteMaterialization;
}>;
export type SourceList = readonly SqlToken[] & Readonly<{
    items: readonly SourceItem[];
    tokens: readonly SqlToken[];
    flattenedDerived?: FlattenedDerived;
    derived?: DerivedSource;
    derivedSources?: readonly DerivedSource[];
    cteDerived?: readonly CteDerivedSource[];
}>;
export type SelectArm = {
    readonly groupBy?: readonly ExprNode[];
    readonly having?: ExprNode | null;
    readonly result: readonly ExprNode[];
    readonly from: SourceList;
    readonly where: ExprNode | null;
    readonly hasDistinct: boolean;
    readonly hasGroupBy: boolean;
    readonly hasHaving: boolean;
    readonly origin: "select" | "values";
    readonly valuesRows: readonly (readonly ExprNode[])[] | null;
    readonly operatorFromPrior: CompoundOperator | null;
    readonly prior: number | null;
    readonly next: number | null;
};
export type SelectNode = {
    readonly kind: "select";
    readonly result: readonly ExprNode[];
    readonly from: SourceList;
    readonly where: ExprNode | null;
    readonly groupBy: readonly ExprNode[];
    readonly having: ExprNode | null;
    readonly orderBy: readonly OrderTermNode[];
    readonly windowNames: readonly string[];
    readonly windowDefinitions: readonly WindowDefinitionNode[];
    readonly limit: ExprNode | null;
    readonly offset: ExprNode | null;
    readonly hasDistinct: boolean;
    readonly hasGroupBy: boolean;
    readonly hasHaving: boolean;
    readonly hasOrderBy: boolean;
    readonly hasLimit: boolean;
    readonly hasCompound: boolean;
    readonly hasValues: boolean;
    readonly hasSubquery: boolean;
    readonly with: WithClause | null;
    readonly arms: readonly SelectArm[];
    readonly tokens: readonly SqlToken[];
};
export interface SchemaColumnDeclaration {
    readonly name: string;
    readonly declaredType: string | null;
    readonly defaultExpr: ExprNode | null;
    readonly generatedExpr: ExprNode | null;
    readonly notNull: boolean;
    readonly primaryKey: boolean;
    readonly primaryKeyDescending: boolean;
    readonly unique: boolean;
    readonly collation: string | null;
    readonly generatedStorage: "stored" | "virtual" | null;
}
export interface SchemaIndexTermDeclaration {
    readonly expr: ExprNode;
    readonly descending: boolean;
    readonly collation: string | null;
    readonly nulls: "first" | "last" | null;
}
export type ForeignKeyAction = "no-action" | "restrict" | "set-null" | "set-default" | "cascade";
export interface SchemaCheckDeclaration {
    readonly name: string | null;
    readonly columnName: string | null;
    readonly expr: ExprNode;
    readonly tokens: readonly SqlToken[];
}
export interface SchemaForeignKeyDeclaration {
    readonly name: string | null;
    readonly columns: readonly string[];
    readonly referencedTable: string;
    readonly referencedColumns: readonly string[] | null;
    readonly onDelete: ForeignKeyAction;
    readonly onUpdate: ForeignKeyAction;
    readonly deferrable: boolean;
    readonly initiallyDeferred: boolean;
    readonly tokens: readonly SqlToken[];
}
/** parse.y trigger_cmd -> trigger.c TriggerStep semantic ownership.
 * Reduced grammar values retain fields without rescanning SQL tokens. UPDATE
 * FROM is kept separately: trigger.c wraps it as a nested-from Select in pSrc. */
export interface SchemaTriggerUpsert {
    readonly target: LemonValue<SqlToken> | null;
    readonly targetWhere: LemonValue<SqlToken> | null;
    readonly expressions: LemonValue<SqlToken> | null;
    readonly where: LemonValue<SqlToken> | null;
    readonly next: SchemaTriggerUpsert | null;
}
export interface SchemaTriggerStep {
    readonly operation: "select" | "insert" | "update" | "delete";
    readonly select: LemonValue<SqlToken> | null;
    readonly where: LemonValue<SqlToken> | null;
    readonly expressions: LemonValue<SqlToken> | null;
    readonly target: LemonValue<SqlToken> | null;
    readonly from: LemonValue<SqlToken> | null;
    readonly upsert: SchemaTriggerUpsert | null;
    readonly tokens: readonly SqlToken[];
    readonly reduction: LemonValue<SqlToken>;
}
export interface SchemaTriggerDeclaration {
    readonly name: string;
    readonly tableName: string;
    readonly databaseName: string | null;
    readonly temporary: boolean;
    readonly timing: "before" | "after" | "instead";
    readonly event: "insert" | "update" | "delete";
    readonly updateColumns: readonly string[];
    readonly when: ExprNode | null;
    readonly steps: readonly SchemaTriggerStep[];
}
export type SchemaDdlNode = {
    readonly trigger: SchemaTriggerDeclaration | null;
    readonly kind: "create-table" | "create-index" | "create-view" | "create-trigger";
    readonly name: string | null;
    readonly tokens: readonly SqlToken[];
    readonly columns: readonly SchemaColumnDeclaration[];
    readonly checks: readonly SchemaCheckDeclaration[];
    readonly foreignKeys: readonly SchemaForeignKeyDeclaration[];
    readonly viewColumns: readonly string[];
    readonly strict: boolean;
    readonly withoutRowid: boolean;
    readonly indexTerms: readonly SchemaIndexTermDeclaration[];
    readonly implicitConstraints: readonly {
        readonly primary: boolean;
        readonly onError: string;
        readonly terms: readonly SchemaIndexTermDeclaration[];
    }[];
    readonly tableUniqueTerms: readonly (readonly SchemaIndexTermDeclaration[])[];
    readonly tableName: string | null;
    readonly select: SelectNode | null;
    readonly indexWhere: ExprNode | null;
    readonly tableAsSelect: SelectNode | null;
    readonly primaryKey: readonly string[];
    readonly primaryKeyTerms: readonly SchemaIndexTermDeclaration[];
    readonly indexUnique: boolean;
};
export type PragmaNode = Readonly<{
    kind: "pragma";
    name: string;
    database: string | null;
    argument: string | null;
}>;
export type ParsedStatement = SelectNode | SchemaDdlNode | PragmaNode;
export interface ParseResult {
    readonly statement: ParsedStatement | null;
    readonly tailOffset: number;
    readonly tailCodeUnit: number;
    readonly lemon: LemonTrace<SqlToken> | null;
}
export declare class SqlParseError extends Error {
}
export declare class SqlUnsupportedError extends Error {
}
/** Translation of parse.y frame_opt actions and window.c:sqlite3WindowAlloc(). */
export declare function windowFrame(window: LemonValue<SqlToken> | undefined): WindowFrameNode;
/** parse.y sortlist / expr.c sqlite3ExprListSetSortOrder: flags belong to
 * the appended ExprList item, not to an aggregate-function owner subtree. */
export declare function sortTermsForWindow(node: LemonValue<SqlToken>): readonly OrderTermNode[];
export interface ParseLimits {
    readonly maxSqlBytes?: number;
    readonly maxWorkUnits?: number;
    readonly maxParserDepth?: number;
    readonly maxExpressionDepth?: number;
}
export declare function parseSql(sql: string, limits?: number | ParseLimits): ParseResult;
export {};
