import { type ResolvedSelect, type ResolvedSource, type ResolvedExpressionCarrier } from './resolve.js';
export interface MetadataWhereLoop {
    readonly kind: 'metadata-module';
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
    readonly arguments: readonly {
        column: number;
        rhs: ResolvedExpressionCarrier;
        constraint?: ResolvedExpressionCarrier;
    }[];
}
/** pragmaVtabBestIndex + whereLoopAddVirtualOne. Selected hidden EQ
 * constraints carry their exact reduction to invocation-owned omit handling;
 * other constraints remain residual. argv use linked source identities. */
export declare function metadataWhereLoops(plan: ResolvedSelect, source: ResolvedSource, external: ReadonlySet<ResolvedSource>, sourcePrereq?: bigint): readonly MetadataWhereLoop[];
