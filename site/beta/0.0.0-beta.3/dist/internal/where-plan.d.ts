import { type MetadataWhereLoop } from './where-metadata-loops.js';
import { type JsonWhereLoop } from './where-json-loops.js';
import type { ReprepareContext } from './reprepare.js';
import { type WhereOrSet } from "./where-or-cost.js";
import { type ExprNode } from "./parse.js";
import { type ResolvedSelect, type ResolvedSource } from "./resolve.js";
import type { ColumnNode, IndexNode, PhysicalIndexField, PhysicalIndex } from "./schema.js";
import { Stat4Probe } from "./stat4-probe.js";
import type { BuiltinCollation, KeyTerm } from "./comparison.js";
export type SourceMask = bigint;
export type LogicalEstimate = bigint;
export type WhereOperator = "eq" | "is" | "is-null" | "in" | "lt" | "le" | "gt" | "ge";
export type TermOrigin = {
    readonly kind: "where";
} | {
    readonly kind: "join-on";
    readonly rightSource: number;
    readonly join: "inner" | "left" | "right" | "full";
} | {
    readonly kind: "using";
    readonly rightSource: number;
    readonly name: string;
} | {
    readonly kind: "derived";
    readonly parentTerm: number;
    readonly reason: "commuted" | "transitive" | "range";
};
export interface ColumnBinding {
    readonly source: ResolvedSource;
    readonly sourceOrdinal: number;
    readonly column: ColumnNode | null;
    readonly columnIndex: number;
    readonly rowid: boolean;
}
export interface WhereTerm {
    readonly id: number;
    readonly expression: ExprNode;
    readonly origin: TermOrigin;
    readonly operator: WhereOperator | null;
    readonly equivalence?: boolean;
    readonly virtualNull?: boolean;
    readonly outerOn?: boolean;
    readonly joinOwner?: number | null;
    readonly info?: WhereTermInfo;
    readonly left: ColumnBinding | null;
    readonly rightAffinity: ColumnNode["affinity"] | null;
    readonly effectiveCollation: BuiltinCollation | null;
    readonly originalIndexedOperand: "left" | "right";
    readonly prereqRight: SourceMask;
    readonly prereqAll: SourceMask;
    readonly parentId: number | null;
    readonly childIds: readonly number[];
    readonly virtual: boolean;
    readonly outerJoinSafe: {
        readonly mayDrive: boolean;
        readonly mayOmitResidual: boolean;
    };
}
export type WhereTermInfo = {
    readonly kind: "or";
    readonly parentTerm: WhereTerm;
    readonly clause: WhereClause;
    readonly indexable: SourceMask;
} | {
    readonly kind: "and";
    readonly clause: WhereClause;
};
export interface WhereClause {
    readonly split: "and" | "or";
    readonly terms: readonly WhereTerm[];
    readonly outer: WhereClause | null;
}
export type SeekComparisonMode = {
    readonly kind: "comparison";
    readonly affinity: ColumnNode["affinity"];
    readonly collation: BuiltinCollation;
} | {
    readonly kind: "is-null";
};
export interface IndexConstraintAdmission {
    readonly inSeekScan?: boolean;
    readonly term: WhereTerm;
    readonly physicalIndex: PhysicalIndex;
    readonly fieldOrdinal: number;
    readonly field: PhysicalIndexField;
    readonly keyInfoTerm: Readonly<KeyTerm>;
    readonly operator: WhereOperator;
    readonly originalIndexedOperand: "left" | "right";
    readonly comparison: SeekComparisonMode;
    readonly bound: "equality" | "lower-inclusive" | "lower-exclusive" | "upper-inclusive" | "upper-exclusive";
}
export interface RowidConstraint {
    readonly term: WhereTerm;
    readonly operator: WhereOperator;
    readonly originalIndexedOperand: "left" | "right";
    readonly bound: IndexConstraintAdmission["bound"];
}
export interface BtreeCapability {
    readonly inSeekScan?: boolean;
    readonly index: IndexNode | null;
    readonly physicalIndex: PhysicalIndex | null;
    readonly nEq: number;
    readonly nSkip: number;
    readonly equalitySlots: readonly (IndexConstraintAdmission | null)[];
    readonly lower: IndexConstraintAdmission | null;
    readonly upper: IndexConstraintAdmission | null;
    readonly constrainedFields: number;
    readonly orderTermsSatisfied: number;
    readonly reverse: boolean;
    readonly covering: boolean;
    readonly needsTableLookup: boolean;
    readonly rowidEquality: RowidConstraint | null;
    readonly rowidLower: RowidConstraint | null;
    readonly rowidUpper: RowidConstraint | null;
}
export type WhereLoop = BtreeWhereLoop | JsonWhereLoop | MetadataWhereLoop;
export interface BtreeWhereLoop {
    readonly source: ResolvedSource;
    readonly sourceOrdinal: number;
    readonly prereq: SourceMask;
    readonly capability: BtreeCapability | null;
    readonly kind: "table-scan" | "rowid" | "index" | "multi-or";
    readonly orInfo?: Extract<WhereTermInfo, {
        kind: "or";
    }>;
    readonly sortIdentity?: number;
    readonly indexRowSize?: LogicalEstimate;
    readonly setupCost: LogicalEstimate;
    readonly runCost: LogicalEstimate;
    readonly outputRows: LogicalEstimate;
    readonly terms: readonly WhereTerm[];
}
export interface WherePath {
    readonly loops: readonly WhereLoop[];
    readonly ready: SourceMask;
    readonly reverse: SourceMask;
    readonly rows: LogicalEstimate;
    readonly cost: LogicalEstimate;
    readonly unsortedCost: LogicalEstimate;
    readonly orderTermsSatisfied: number | null;
}
export interface OrderRequirement {
    readonly sourceOrdinal: number;
    readonly column: ColumnNode | null;
    readonly descending: boolean;
    readonly collation: BuiltinCollation;
    readonly nulls?: "first" | "last" | null;
}
export declare const ROWID_NEEDED: Readonly<{
    kind: "rowid";
}>;
export type NeededColumn = ColumnNode | typeof ROWID_NEEDED;
export interface CandidateOptions {
    readonly sampleProbe?: Stat4Probe | undefined;
    readonly sampleCounts?: readonly (bigint | null)[] | undefined;
    readonly forcedIndex: IndexNode | null;
    readonly notIndexed?: boolean;
    readonly sourcePrereq?: SourceMask;
    readonly neededColumns: ReadonlySet<NeededColumn>;
    readonly orderBy: readonly OrderRequirement[];
    readonly resolved?: ResolvedSelect;
    readonly planBudget?: WherePlanBudget;
    readonly orSet?: WhereOrSet;
    readonly ordinaryLoops?: readonly WhereLoop[];
    readonly completion?: {
        done: boolean;
    }; /** Internal optimization control; source default enabled. */
    readonly skipScan?: boolean; /** Internal optimization control; source default enabled. */
    readonly inSeekScan?: boolean;
}
export declare class WherePlanningUnsupportedError extends Error {
    readonly classification: "temporary";
    constructor(message: string);
}
export interface WhereTruthState {
    readonly high: Set<WhereTerm>;
    readonly heuristic: Set<WhereTerm>;
    secondPass: boolean;
}
export interface WherePlanBudget {
    reprepare?: ReprepareContext;
    remaining: bigint; /** Internal source planner-limit control, independent of prior invocation consumption. */
    constructionLimit?: bigint;
    reserveProbe?: ((bytes: number) => () => void) | undefined;
    truth?: WhereTruthState; /** where.c sqlite3ProgressCheck: throws control errors, never insertion DONE. */
    readonly progressCheck?: (() => void) | undefined;
}
export declare function sourceBit(ordinal: number): SourceMask;
export declare function whereClause(terms: readonly WhereTerm[], outer?: WhereClause | null): WhereClause;
/** whereScanNext's compatibility gate. Original operand orientation and the
 * already-resolved original-order collation are retained rather than rebuilt. */
export declare function admitIndexConstraint(term: WhereTerm, physical: PhysicalIndex, fieldOrdinal: number): IndexConstraintAdmission | null;
declare function capabilities(index: IndexNode, terms: readonly WhereTerm[], ordinal: number, needed: ReadonlySet<NeededColumn>, order: readonly OrderRequirement[], targetSource: ResolvedSource, skipScan: boolean, inSeekScan: boolean, proposalScan?: {
    clause: WhereClause;
    resolved: ResolvedSelect;
    source: ResolvedSource;
    result: {
        ok: boolean;
    };
    progressCheck?: (() => void) | undefined;
    sampleEnter?: ((admission: IndexConstraintAdmission, equality: readonly (IndexConstraintAdmission | null)[]) => () => void) | undefined;
}): Generator<BtreeCapability>;
/** expr.c:sqlite3ExprCompare identity for the represented expression-index
 * grammar. Compare the generated parse structure, not reconstructed SQL text.
 * Parentheses are transparent; source/join provenance remains on WhereTerm. */
export declare function expressionStructuralIdentity(expression: ExprNode, skipTopCollate?: boolean): string;
/** Direct invocation of the same AddBtreeIndex production/insertion owners.
 * Unlike AddBtree, this starts at the recursive template, not its full scan. */
export declare function btreeIndexLoops(source: ResolvedSource, sourceOrdinal: number, index: IndexNode, clause: WhereClause, options: CandidateOptions): readonly WhereLoop[];
/** whereLoopAddBtree's deterministic no-stat candidate subset. */
export declare function btreeLoops(source: ResolvedSource, sourceOrdinal: number, clause: WhereClause, options: CandidateOptions): readonly WhereLoop[];
/** where.c:whereLoopAddOr arm dispatch. Native tempWC carries one matching
 * stored orientation. This bounded immutable representation groups an original
 * direct term with its immediate commuted children: only the orientation for
 * the target drives access, while original identity survives child consumption.
 * AND info owns its clause; the OR clause is not an outer constraint scope.
 * Grouping is not a claim of general proposal-count or cost parity. */
export declare function orArmClause(arm: WhereTerm, sourceOrdinal: number, outer: WhereClause, owned?: WhereClause): WhereClause | null;
/** wherecode.c Case 5 constructs xN AND w, distinct from whereLoopAddOr's
 * cost exploration. Only original indexable enclosing terms enter w. The
 * original parent predicate remains owned by the common body. Represented
 * terms have no TERM_CODED/TERM_SLICE state (row vectors are not admitted).
 * Do not borrow pOuter unfiltered: EP_Subquery must never be an arm key. */
export declare function orRuntimeArmClause(arm: WhereTerm, sourceOrdinal: number, outer: WhereClause, owned?: WhereClause): WhereClause | null;
/** Internal source owner, shared by AddBtree and direct recursion controls.
 * Yields insertion templates; callers return insertion status through result. */
export declare const whereLoopAddBtreeIndex: typeof capabilities;
export declare function whereLoopInsertCandidates(loops: readonly WhereLoop[], budget?: WherePlanBudget): WhereLoop[];
/** Exact port of util.c:sqlite3LogEstAdd for bigint LogEst units. */
export declare function logEstAdd(a: LogicalEstimate, b: LogicalEstimate): LogicalEstimate;
/** where.c:computeMxChoice default, without the unrepresented star heuristic. */
export declare function wherePathChoiceWidth(sourceCount: number): 1 | 5 | 12;
/** where.c:5835ff. Ordered traversal, unsorted accumulators and bounded slots. */
export declare function wherePathSolver(candidates: readonly (readonly WhereLoop[])[], sourceCount: number, maxChoices?: 1 | 5 | 12, orderTerms?: number, resultColumns?: number, sortRows?: bigint | null, initialReady?: bigint): WherePath;
/** where.c:whereScanNext column equivalence visitation. Acceptance callback
 * owns opMask/index affinity/collation admission; yielded terms retain their
 * original RHS and binding provenance. Not a rewritten index constraint. */
export declare function scanWhereTerms(clause: WhereClause, target: ColumnBinding, resolved: ResolvedSelect, accept: (term: WhereTerm) => boolean): Generator<WhereTerm>;
export interface WhereAnalysis {
    readonly clause: WhereClause;
    readonly plannerEligible: boolean;
    readonly fallback: "right-full" | null;
}
/** whereexpr.c sqlite3WhereSplit/exprAnalyze subset. It consumes resolved
 * expression identity and is the only production constructor for WhereTerm. */
export declare function analyzeWhere(resolved: ResolvedSelect, includeRightTerms?: boolean): WhereAnalysis;
/** wherecode.c:sqlite3WhereRightJoinLoop pSubWhere. Our analyzer represents
 * virtual commutations but no TERM_SLICE/WO_ROWVAL terms (row values are not
 * admitted). Stop at the first virtual term, not merely skip it. ON/USING
 * ownership never becomes an unmatched residual. */
export declare function rightJoinResidual(resolved: ResolvedSelect, ordinal: number): readonly WhereTerm[];
export interface WherePlanRequest {
    readonly neededColumns: readonly ReadonlySet<NeededColumn>[];
    readonly orderBy: readonly OrderRequirement[];
    readonly excludedIndexSources?: ReadonlySet<number>;
    readonly planBudget?: WherePlanBudget;
    readonly externalAvailable?: ReadonlySet<ResolvedSource>;
}
/** Internal lowering publication: source term flags are mutable while AddAll
 * explores/rebuilds, then copied without retaining the reusable builder sets. */
export interface WhereTruthPublication {
    readonly high: readonly WhereTerm[];
    readonly heuristic: readonly WhereTerm[];
    readonly secondPass: boolean;
}
export interface WherePlanSelection {
    readonly truth: WhereTruthPublication;
    readonly analysis: WhereAnalysis;
    readonly path: WherePath | null;
    readonly plannerCandidates: number;
    readonly plannerPaths: number;
}
export declare function planWhere(resolved: ResolvedSelect, request: WherePlanRequest): WherePlanSelection;
/** SELECT resolver owns alias/ordinal precedence. Only a complete resolved
 * direct-column ORDER list may authorize this bounded physical-order proof.
 * Expression aliases retain the sorter; no token-spelling reconstruction. */
export declare function resolvedWhereOrder(resolved: ResolvedSelect): readonly OrderRequirement[];
export declare function branchConsumedTerms(loop: WhereLoop, clause: WhereClause, ready: SourceMask): ReadonlySet<WhereTerm>;
export {};
