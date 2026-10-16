import { type OrderTermNode, type ExprNode, type SelectNode, type SourceItem, type WindowFrameNode } from './parse.js';
import type { ColumnNode, TableNode, ViewNode } from './schema.js';
import type { LemonValue } from './lemon-runtime.js';
import type { SqlToken } from './tokenize.js';
export declare class NameResolutionError extends Error {
    readonly extendedCode: number;
    constructor(message: string, extendedCode?: number);
}
export declare function transientColumnNames(names: readonly string[]): readonly string[];
export interface ResolutionSchema {
    readonly tables: ReadonlyMap<string, TableNode>;
    readonly views?: ReadonlyMap<string, ViewNode>;
    readonly viewMetadata?: boolean;
    readonly check?: () => void;
}
export interface ResolvedSource extends Omit<SourceItem, 'cursorId' | 'table'> {
    readonly cursorId: number;
    readonly table: TableNode;
}
export interface ResultColumnDescriptor {
    readonly name: string;
    readonly declaredType: string | null;
    readonly database: string | null;
    readonly table: string | null;
    readonly origin: string | null;
    readonly affinity: ColumnNode['affinity'] | null;
    readonly collation: string;
}
export interface ResolvedColumnRef {
    readonly source: ResolvedSource;
    readonly columnIndex: number;
    readonly name: string;
}
export interface ResolvedResult {
    readonly name: string;
    readonly expression: ExprNode;
    readonly source: ResolvedSource | null;
    readonly columnIndex: number | null;
    readonly mergedSources: readonly ResolvedColumnRef[] | null;
    readonly resolution: 'direct' | 'coalesce' | 'expression';
    readonly descriptor: ResultColumnDescriptor;
}
export interface ResolvedWindow {
    readonly functionName: string;
    readonly argumentCount: number;
    readonly owner: ExprNode;
    readonly filter: ExprNode | null;
    readonly definitionName: string | null;
    readonly partitionBy: readonly ExprNode[];
    readonly orderBy: readonly ExprNode[];
    readonly orderTerms: readonly OrderTermNode[];
    readonly frame: WindowFrameNode;
    readonly compatibleGroup: number;
}
export interface ResolvedWindowDefinition {
    readonly name: string;
    readonly partitionBy: readonly ExprNode[];
    readonly orderBy: readonly ExprNode[];
    readonly orderTerms: readonly OrderTermNode[];
    readonly frame: WindowFrameNode;
}
export interface ResolvedColumnUse {
    readonly expression: ExprReduction;
    readonly source: ResolvedSource;
    readonly columnIndex: number;
    readonly selectDepth: number;
    readonly mergedSources?: readonly ResolvedColumnRef[] | null;
}
export interface ResolvedSelect {
    readonly compoundArms?: readonly ResolvedSelect[];
    readonly aggregateUses?: ReadonlyMap<ExprReduction, number>;
    readonly aliasUses?: ReadonlyMap<ExprReduction, ExprReduction>;
    readonly orderResultColumns: readonly (number | null)[];
    readonly source: SelectNode;
    readonly sources: readonly ResolvedSource[];
    readonly result: readonly ResolvedResult[];
    readonly correlated: boolean;
    readonly nested: readonly ResolvedSelect[];
    readonly columnUses: readonly ResolvedColumnUse[];
    readonly windowDefinitions: readonly ResolvedWindowDefinition[];
    readonly windows: readonly ResolvedWindow[];
    readonly multipleWindowPartitions: boolean;
}
/** Transient resolve.c NameContext frame; never attached to immutable schema AST. */
interface NameContext {
    readonly aggregateUses?: Map<ExprReduction, number>;
    readonly aliasUses?: Map<ExprReduction, ExprReduction>;
    readonly sources: readonly ResolvedSource[];
    readonly pNext: NameContext | null;
    readonly columnUses: ResolvedColumnUse[];
    nRef: number;
}
type ExprReduction = LemonValue<SqlToken> & {
    readonly kind: 'reduction';
};
export declare function expressionStructurallyEqual(left: ExprNode, right: ExprNode, sources: SelectNode['arms'][number]['from']['items'], ignoreTopLevelCollate?: boolean): boolean;
export declare function resolvedProducerProjection(plan: ResolvedSelect, select: SelectNode): ResolvedSelect;
export declare function rejectBareBuiltinWindowFunctions(select: SelectNode): void;
export declare function resolvedViewTable(view: ViewNode, schema: ResolutionSchema): TableNode;
export declare function expandAndResolveSelect(select: SelectNode, schema: ResolutionSchema, outer?: NameContext | null, cursorBase?: number, transientTables?: ReadonlyMap<number, TableNode>): ResolvedSelect;
/** expr.c:sqlite3ExprCollSeq implicit column path. CAST and UPLUS preserve
 * column collation; other operators do not inherit it without EP_Collate.
 * Explicit COLLATE is handled by the expression generator's flagged walk. */
export declare function resolvedImplicitCollation(expression: LemonValue<SqlToken>, plan: ResolvedSelect): string | undefined;
export declare function resolvedExpressionAffinity(expression: LemonValue<SqlToken>, plan: ResolvedSelect): ColumnNode['affinity'] | undefined;
export declare function resolvedExpressionDataType(expression: LemonValue<SqlToken>, plan: ResolvedSelect): number;
export declare function resolvedResultColumn(result: ResolvedResult): ColumnNode | undefined;
export declare function resolvedCompoundAffinity(plans: readonly ResolvedSelect[], index: number): ColumnNode['affinity'];
/** expr.c sqlite3ExprCollSeq: implicit column/CAST/UPLUS ownership precedes
 * EP_Collate child selection. SELECT contents do not propagate Expr flags. */
export declare function resolvedExpressionCollation(expression: LemonValue<SqlToken>, plan: ResolvedSelect): string | undefined;
export declare function resolvedCompoundCollation(plans: readonly ResolvedSelect[], index: number): string | undefined;
export declare function transientDeclaredType(original: string | null, affinity: ColumnNode['affinity']): string;
export declare function resolvedExpressionMetadata(expression: LemonValue<SqlToken>, plan: ResolvedSelect): Pick<ResolvedResult['descriptor'], 'declaredType' | 'database' | 'table' | 'origin'>;
export declare function resolvedExpressionDeclaredType(expression: LemonValue<SqlToken>, plan: ResolvedSelect): string | null;
export declare function bindSchemaSourceProvenance(table: TableNode, database: string, name: string): void;
export declare function bindTransientProducer(table: TableNode, producer: ResolvedSelect): void;
/** resolve.c linked lookup results retained through expression code generation.
 * Reduction identity, not SQL spelling, owns the lexical source and depth.
 * Unsupported productions remain present so consumers reject before execution.
 */
export interface ResolvedExpressionCarrier {
    readonly reduction: ExprReduction;
    /** Original lexical edge before resolveAlias/parenthesis substitution. */
    readonly sourceReduction?: ExprReduction;
    readonly column: ResolvedColumnUse | null;
    readonly select?: ResolvedSelect;
    readonly children: readonly ResolvedExpressionCarrier[];
}
/** Synthetic TK_COLUMN retains logical identity without fabricating SQL text. */
export declare function resolvedColumnCarrier(source: ResolvedSource, columnIndex: number): ResolvedExpressionCarrier;
/** resolve.c sqlite3ResolveSelfReference: transient SELF TABLE context.
 * Keep the caller's source identity (including alias) for physical binding. */
export declare function resolvedGeneratedExpressionCarrier(source: ResolvedSource, columnIndex: number): ResolvedExpressionCarrier;
export declare function resolvedExpressionCarrier(plan: Pick<ResolvedSelect, 'columnUses' | 'aliasUses'> & Partial<Pick<ResolvedSelect, 'nested'>>, reduction: ExprReduction): ResolvedExpressionCarrier;
/** Physical location is selected after linked resolution, never by name lookup.
 * Producer-row registers are distinct from aggregate finalized-row registers.
 * The latter phase has no consumer here and must not be inferred from a number.
 */
/** expr.c TK_AGG_COLUMN: shared compile-time state, consumed during emission. */
export interface AggregateColumnOwner {
    directMode: boolean;
    useSortingIdx: boolean;
    sortingIndexRegister: number;
    sourceRegisters?: number;
    readonly columns: Map<number, {
        iSorterColumn: number;
        accumulatorRegister: number;
    }>;
}
export type ResolvedExpressionLocation = {
    readonly kind: 'cursor';
    readonly cursor: number;
    readonly payloadIndex?: number;
    readonly physicalColumnIndex?: number;
    readonly aggregateColumn?: {
        owner: AggregateColumnOwner;
        iAgg: number;
    };
} | {
    readonly kind: 'register';
    readonly register: number;
    readonly phase: 'producer-row' | 'source-row';
};
export interface ResolvedExpressionBinding {
    /** Already-enrolled AggInfo output; absent for source argument binding. */
    readonly aggregateOutput?: (reduction: ExprReduction) => number | undefined;
    readonly location: (reference: ResolvedColumnRef, selectDepth: number) => ResolvedExpressionLocation;
    readonly policy: 'joined-aggregate' | 'scalar' | 'derived-predicate' | 'window-filter' | 'window-source' | 'aggregate-source' | 'ordinary-aggregate';
}
/** select.c AggInfo functions own one accumulator until AggFinal publishes it.
 * Argument and ORDER expressions retain their resolved source-row identities;
 * output location is only consumed after the owning finalization operation.
 */
export interface ResolvedAggregatePhaseCarrier {
    readonly expression: ResolvedExpressionCarrier;
    readonly arguments: readonly ResolvedExpressionCarrier[];
    readonly orderBy: readonly ResolvedExpressionCarrier[];
    readonly accumulator: Readonly<{
        phase: 'accumulator';
        register: number;
    }>;
    readonly output: Readonly<{
        phase: 'finalized-output';
        register: number;
    }>;
}
export {};
