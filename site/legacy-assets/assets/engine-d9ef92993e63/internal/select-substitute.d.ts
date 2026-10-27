import type { ExprNode, SelectNode } from './parse.js';
import type { ResolvedSelect, ResolvedSource } from './resolve.js';
/** select.c:substExpr/substSelect. The caller supplies expressions already
 * qualified to their producer owners. Never infer ownership from token names.
 * This pass substitutes columns only; eligibility, SrcList splicing, expanded
 * stars and LEFT null-row guards belong to the flattening caller. */
export declare function substituteResolvedColumns(plan: ResolvedSelect, source: ResolvedSource, replacements: readonly ExprNode[]): SelectNode;
/** select.c flattenSubquery SrcItem transfer/substSelect for a resolved,
 * eligible first-source producer with one physical SrcItem. Eligibility is
 * deliberately a caller decision; this primitive rejects retained producer
 * destinations and outer-join null-row ownership it cannot transfer. */
export declare function spliceResolvedFirstSource(plan: ResolvedSelect, producer: ResolvedSelect): SelectNode;
/** Render an already-resolved column under the splice owner's fresh alias.
 * This is not another lookup by spelling. The caller renames the SrcItem and
 * chooses an alias absent from every child NameContext before re-resolution. */
export declare function qualifyResolvedSource(plan: ResolvedSelect, source: ResolvedSource, alias: string): SelectNode;
