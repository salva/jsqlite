import type { ResolvedSelect, ResolvedSource } from './resolve.js';
import { type JsonTableSourceConstraint, type JsonTableIndex } from './json-table-plan.js';
export interface JsonWhereLoop {
    readonly kind: 'json-module';
    readonly capability?: never;
    readonly terms: readonly [];
    readonly sortIdentity: 0;
    readonly indexRowSize?: never;
    readonly orInfo?: never;
    readonly source: ResolvedSource;
    readonly sourceOrdinal: number;
    readonly prereq: bigint;
    readonly setupCost: bigint;
    readonly runCost: bigint;
    readonly outputRows: bigint;
    readonly index: JsonTableIndex;
    readonly arguments: readonly JsonTableSourceConstraint[];
}
/** Bounded translation of whereLoopAddVirtual/One for JSON's EQ-only
 * BestIndex. External sources must be positioned by the caller; lexical scope
 * does not make them usable. Constraint rejection drops a candidate, not the
 * whole query. No runtime admission or physical capability is manufactured.
 * IN/LIMIT virtual terms and orderByConsumed are not represented here yet. */
export declare function jsonWhereLoops(plan: ResolvedSelect, source: ResolvedSource, externalAvailable: ReadonlySet<ResolvedSource>, sourcePrereq?: bigint, unusable?: bigint): readonly JsonWhereLoop[];
