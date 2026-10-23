import type { Mem } from './mem.js';
import type { PrivateKeyVmCursor } from './private-key-vm.js';
import type { PrivateStateControl } from './private-state.js';
import type { InLoopOp } from './where-in-loop.js';
type CursorOp = Exclude<InLoopOp, {
    readonly code: 'IsNull' | 'IndexSeekHit' | 'IndexIfNoHope';
}>;
export interface PrivateInDispatchResult {
    readonly handled: boolean;
    readonly jump: number | null;
}
/** Private-index branch of the existing Index opcode family, not another
 * interpreter. Persistent cursors are deliberately
 * unhandled. Publication follows the wrapper's native error/state ordering;
 * no jump or register value is reported before its awaited operation succeeds.
 * Column's cursor operand is p3 in this TS opcode representation. IfNotOpen
 * is scoped to a private RHS cursor: missing OR nullRow branches, as native
 * vdbe.c does (not merely presence in the cursor map). */
export declare function dispatchPrivateInCursor(op: CursorOp, cursors: ReadonlyMap<number, PrivateKeyVmCursor>, registers: readonly Mem[], control: PrivateStateControl): Promise<PrivateInDispatchResult>;
export {};
