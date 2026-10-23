export interface WhereOrCost {
    prereq: bigint;
    rRun: bigint;
    nOut: bigint;
}
export interface WhereOrSet {
    a: WhereOrCost[];
}
export interface OrConstructionBudget {
    remaining: bigint;
}
export declare function whereOrMove(dest: WhereOrSet, src: WhereOrSet): void;
export declare function whereOrInsert(set: WhereOrSet, prereq: bigint, rRun: bigint, nOut: bigint): boolean;
/** whereLoopInsert pOrSet branch. false is SQLITE_DONE, not discarded cost.
 * The caller owns iterator closure and passes the same budget to copied builders.
 * nLTerm counts actual constrained terms, not the loop's residual expression list.
 */
export declare function whereOrCollect(set: WhereOrSet, budget: OrConstructionBudget, nLTerm: number, cost: WhereOrCost): boolean;
/** whereLoopAddOr: reset sCur per arm in caller, abandon on zero costs;
 * first processed arm moves, subsequent arms multiply stored slots in i/j order.
 * The caller supplies sqlite3LogEstAdd and inserts published parent loops with
 * rRun+1, setup0 and sort0 only after every actual arm succeeds.
 */
export declare function whereOrAccumulate(sum: WhereOrSet, current: WhereOrSet, first: boolean, add: (a: bigint, b: bigint) => bigint): boolean;
