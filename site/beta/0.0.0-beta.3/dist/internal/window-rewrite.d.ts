import type { ExprNode, OrderTermNode, SelectNode } from "./parse.js";
import { type ResolvedExpressionCarrier, type ResolvedResult, type ResolvedSelect, type ResolvedSource, type ResolvedWindow } from "./resolve.js";
export interface WindowExpressionBinding {
    readonly source: ResolvedSource;
    readonly columnIndex: number;
}
export interface WindowRewriteFunction {
    readonly window: ResolvedWindow;
    readonly regAccum: number;
    readonly regResult: number;
    readonly argumentColumn: number;
    readonly filterColumn: number | null;
    readonly filterCarrier: ResolvedExpressionCarrier | null;
}
export interface WindowRewriteSortTerm {
    readonly expression: ExprNode;
    readonly sourceExpression: ExprNode;
    readonly binding: WindowExpressionBinding | null;
    readonly source: "partition" | "order";
    readonly copiedIntegerToNull: boolean;
    readonly descending: boolean;
    readonly nulls: "first" | "last" | null;
}
export interface WindowLiftedExpression {
    readonly expression: ExprNode;
    readonly kind: "column" | "aggregate" | "window";
    readonly bufferColumn: number;
    readonly selectDepth: number;
    readonly aggregateDepthBefore: number | null;
    readonly aggregateDepthAfter: number | null;
    readonly correlatedFromScalarSubquery: boolean;
}
export interface WindowAggregateDepthRepair {
    readonly expression: ExprNode;
    readonly selectDepth: number;
    readonly aggregateDepthBefore: number;
    readonly aggregateDepthAfter: number;
}
export interface WindowRewriteOriginalProducer {
    readonly kind: "original";
    readonly nonFlattenable: true;
    readonly correlated: true;
    readonly sourcePredicates: readonly ResolvedExpressionCarrier[];
    readonly from: SelectNode["from"];
    readonly where: ExprNode | null;
    readonly groupBy: readonly ExprNode[];
    readonly having: ExprNode | null;
}
export interface WindowRewriteNestedProducer {
    readonly kind: "rewritten-select";
    readonly nonFlattenable: true;
    readonly correlated: true;
    readonly parentCompatibleGroup: number;
    readonly select: WindowRewrittenSelect;
}
export type WindowRewriteProducer = WindowRewriteOriginalProducer | WindowRewriteNestedProducer;
export interface WindowRewrittenSelect {
    readonly compatibleGroup: number;
    readonly subquery: WindowRewriteProducer;
}
export interface WindowRewriteLayer {
    readonly compatibleGroup: number;
    readonly windows: readonly WindowRewriteFunction[];
    readonly producerOrderBy: readonly WindowRewriteSortTerm[];
    readonly bufferExpressions: readonly ExprNode[];
    readonly bufferBindings: readonly (WindowExpressionBinding | null)[];
    readonly lifted: readonly WindowLiftedExpression[];
    readonly aggregateDepthRepairs: readonly WindowAggregateDepthRepair[];
    readonly iEphCsr: number;
    readonly duplicateCursors: readonly [number, number, number];
    readonly regGosub: number;
    readonly addrGosub: number;
    readonly handoff: readonly [{
        readonly code: "Gosub";
        readonly register: number;
        readonly address: number;
    }, {
        readonly code: "Return";
        readonly register: number;
    }];
    readonly producer: WindowRewriteProducer;
}
export interface WindowRewriteGraph {
    readonly source: ResolvedSelect;
    readonly layers: readonly WindowRewriteLayer[];
    readonly root: WindowRewrittenSelect | null;
    readonly outer: Readonly<{
        orderBy: readonly OrderTermNode[];
        originalOrderBy: readonly OrderTermNode[];
        orderPrefixElided: boolean;
        limit: ExprNode | null;
        offset: ExprNode | null;
        result: readonly ResolvedResult[];
    }>;
    readonly movedClauses: readonly ["from", "where", "groupBy", "having"];
    readonly retainedClauses: readonly ["orderBy", "limit", "offset"];
    readonly multipleWindowPartitions: boolean;
    readonly frameExecution: "unsupported";
}
/** Immutable port of window.c:sqlite3WindowRewrite/sqlite3WindowCodeInit. */
export declare function sqlite3WindowRewrite(resolved: ResolvedSelect, allocation?: {
    registers: number;
    cursors: number;
}): WindowRewriteGraph;
