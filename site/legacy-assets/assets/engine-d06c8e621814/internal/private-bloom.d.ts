import { Mem } from './mem.js';
import { PrivateStateByteBudget, type PrivateStateControl } from './private-state.js';
/** vdbe.c:filterHash, with C unsigned addition rather than host number sums. */
export declare function filterHash(values: readonly Mem[]): bigint;
/** Execution-owned counterpart of the zero-filled OP_Blob filter register.
 * The existing private-state budget owns bytes and a fixed descriptor charge.
 * Consumers must dispose on every execution exit; no plan owns this state.
 * This primitive is not yet an SQL planner/lowering enrollment. */
export declare class PrivateBloomFilter {
    #private;
    private constructor();
    static open(budget: PrivateStateByteBudget, length: number, control: PrivateStateControl): Promise<PrivateBloomFilter>;
    /** OP_FilterAdd. Call after the VM's work/cancel checkpoint. No await
     * separates the borrowed key from hashing or the bit publication. */
    add(values: readonly Mem[]): void;
    /** OP_Filter jump polarity: true means absent, never authoritative match. */
    absent(values: readonly Mem[]): boolean;
    get ownedBytes(): number;
    close(): void;
}
