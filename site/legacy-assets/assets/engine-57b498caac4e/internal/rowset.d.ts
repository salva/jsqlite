import { PrivateStateByteBudget, type PrivateStateControl } from './private-state.js';
export declare class RowSet {
    #private;
    readonly budget: PrivateStateByteBudget;
    readonly maxEntries: number;
    control: PrivateStateControl;
    constructor(budget: PrivateStateByteBudget, maxEntries: number, control: PrivateStateControl);
    insert(value: bigint): Promise<void>;
    test(batch: number, value: bigint): Promise<boolean>;
    next(): Promise<bigint | null>;
    clear(): void;
    delete(): void;
}
