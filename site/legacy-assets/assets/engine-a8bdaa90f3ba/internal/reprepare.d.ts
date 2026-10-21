import type { SelectNode } from './parse.js';
import type { SqlToken } from './tokenize.js';
import { Mem, type MemAffinity } from './mem.js';
import type { DatabaseEncoding } from './record.js';
/** Parse.pReprepare and Vdbe.expmask. Slots are numbered at parse order,
 * independent of expression code emission order. Bit31 represents all slots32+. */
export declare class ReprepareContext {
    mask: number;
    readonly slots: Map<number, number>;
    readonly bindings: readonly Mem[] | undefined;
    constructor(select: SelectNode, bindings?: readonly Mem[]);
    bindingBytes(token: SqlToken): number;
    value(token: SqlToken, affinity: MemAffinity, encoding: DatabaseEncoding): Mem | null;
}
