import { type ResolvedSelect, type ResolvedSource } from './resolve.js';
export interface JsonTableConstraint {
    readonly column: number;
    readonly usable: boolean;
    readonly equality: boolean;
}
export interface JsonTableIndex {
    readonly idxNum: 0 | 1 | 3;
    /** Constraint indexes in xFilter argument order (JSON, then ROOT). */
    readonly arguments: readonly number[];
}
/** json.c:jsonEachBestIndex. Callers own dependency/readiness classification;
 * resolving a column name does not establish that its value is usable here.
 * Visible constraints remain residual predicates, as do unselected hidden EQs.
 * This does not enroll a module or manufacture a physical schema table. */
export declare function chooseJsonTableIndex(constraints: readonly JsonTableConstraint[], jsonColumn?: number): JsonTableIndex;
/** where.c:whereLoopAddVirtualOne's prereqRight subset test, over linked
 * source identities instead of native Bitmask bits. Nested SELECT locals are
 * produced inside the argument; their external references remain prerequisites.
 * Availability is supplied by the loop planner, never inferred from scope or
 * selectDepth. This does not decide aggregate-phase or operator eligibility. */
export declare function jsonTableInputReady(expression: import('./resolve.js').ResolvedExpressionCarrier, available: ReadonlySet<import('./resolve.js').ResolvedSource>): boolean;
export interface LinkedJsonTableConstraint {
    readonly column: number;
    readonly equality: boolean;
    readonly rhs: import('./resolve.js').ResolvedExpressionCarrier;
    /** whereLoopAddVirtualOne mExclude, determined by the enclosing loop. */
    readonly excluded?: boolean;
    readonly limit?: boolean;
}
/** Join whereLoopAddVirtualOne's usable classification to jsonEachBestIndex.
 * Callers still own constraint production (including pFuncArg's unary-plus
 * affinity barrier), available loop positions, and aggregate-phase legality.
 * The initial call permits LIMIT terms (non-NULL pbRetryLimit); a retry
 * without LIMIT passes NULL and excludes them, not the reverse.
 * Returning argument indexes does not consume any residual predicate. */
export declare function planJsonTableConstraints(constraints: readonly LinkedJsonTableConstraint[], available: ReadonlySet<import('./resolve.js').ResolvedSource>, retryWithoutLimit?: boolean): JsonTableIndex;
export interface JsonTableArgumentConstraint extends LinkedJsonTableConstraint {
    readonly source: ResolvedSource;
    /** TK_UPLUS strips the argument's affinity; it does not coerce its value. */
    readonly rhsAffinity: 'none';
    readonly joinOrigin: 'inner' | 'outer';
    readonly joinOwner: ResolvedSource;
}
/** whereexpr.c:sqlite3WhereTabFuncArgs for JSON's two hidden columns.
 * Retain the linked RHS rather than reconstructing it from tokens. The explicit
 * affinity barrier and ON owner must be consumed by the eventual loop emitter;
 * these terms are not ordinary WHERE equalities and do not remove residuals.
 * This produces constraints only, not module enrollment or loop admission. */
export declare function jsonTableArgumentConstraints(plan: ResolvedSelect, source: ResolvedSource): readonly JsonTableArgumentConstraint[];
export interface JsonTableEqualityConstraint extends LinkedJsonTableConstraint {
    readonly source: ResolvedSource;
    /** Ordinary WHERE RHS retains its expression affinity (unlike pFuncArg). */
    readonly rhsAffinity: 'expression';
    readonly residual: import('./resolve.js').ResolvedExpressionCarrier;
    readonly joinOrigin?: 'inner' | 'outer';
    readonly joinOwner?: ResolvedSource;
}
/** whereexpr.c:sqlite3WhereSplit/exprAnalyze's ordinary hidden EQ slice.
 * Split AND only; compare linked column ownership, never SQL spelling.
 * Reverse EQ exposes the other operand without discarding its affinity.
 * WHERE/ON (including duplicates) remains residual. This neither enrolls nor
 * schedules a module; join scheduling and non-EQ stay with the enclosing planner.
 */
export declare function jsonTableEqualityConstraints(plan: ResolvedSelect, source: ResolvedSource): readonly JsonTableEqualityConstraint[];
export interface JsonTableComparisonConstraint extends LinkedJsonTableConstraint {
    readonly source: ResolvedSource;
    readonly operator: '<' | '<=' | '>' | '>=' | 'IS';
    readonly equality: false;
    readonly rhsAffinity: 'expression';
    readonly residual: import('./resolve.js').ResolvedExpressionCarrier;
    readonly joinOrigin?: 'inner' | 'outer';
    readonly joinOwner?: ResolvedSource;
}
/** where.c:allocateIndexInfo passes ranges and IS through to xBestIndex.
 * jsonEachBestIndex ignores usable non-EQ terms but still records their
 * unusable hidden-column masks. Keep them residual, never filter arguments.
 * This bounded producer does not synthesize BETWEEN/IN/ISNULL virtual terms. */
export declare function jsonTableComparisonConstraints(plan: ResolvedSelect, source: ResolvedSource): readonly JsonTableComparisonConstraint[];
export type JsonTableSourceConstraint = JsonTableEqualityConstraint | JsonTableComparisonConstraint | JsonTableArgumentConstraint;
/** where.c:sqlite3WhereBegin splits WHERE before adding pFuncArg terms via
 * sqlite3WhereTabFuncArgs. jsonEachBestIndex selects the last usable EQ for
 * each hidden column, so producer order is semantic, not just bookkeeping.
 * Keep ordinary terms as residuals, including those not selected by BestIndex.
 * Enrollment and actual loop availability remain caller-owned. */
export declare function jsonTableConstraints(plan: ResolvedSelect, source: ResolvedSource): readonly JsonTableSourceConstraint[];
export interface JsonTableDeclaration {
    readonly name: 'json_each' | 'json_tree' | 'jsonb_each' | 'jsonb_tree';
    readonly binary: boolean;
    readonly recursive: boolean;
    readonly columns: readonly {
        readonly name: string;
        readonly hidden: boolean;
        readonly declaredType: '' | null;
        readonly affinity: 'blob';
    }[];
}
export declare function jsonTableDeclaration(name: string): JsonTableDeclaration | undefined;
