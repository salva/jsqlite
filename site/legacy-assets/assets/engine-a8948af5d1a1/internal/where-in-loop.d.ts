import type { MemAffinity } from './mem.js';
import type { KeyInfo } from './comparison.js';
export interface InPrefix {
    readonly p1: number;
    readonly keys: readonly number[];
    readonly affinities: readonly MemAffinity[];
    readonly keyInfo: KeyInfo;
}
export type InLoopOp = ({
    readonly code: 'IndexIfNoHope';
    readonly p2: number;
} & InPrefix) | ({
    readonly code: 'IndexSeekHit';
} & InPrefix) | {
    readonly code: 'IndexRewind' | 'IndexLast' | 'IndexNext' | 'IndexPrev';
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: 'Column';
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
    readonly inProbe?: boolean;
} | {
    readonly code: 'Rowid';
    readonly p1: number;
    readonly p2: number;
    readonly inProbe?: boolean;
} | {
    readonly code: 'Rewind' | 'Last' | 'Next' | 'Prev';
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: 'IsNull';
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: 'IfNotOpen';
    readonly p1: number;
    readonly p2: number;
};
export interface InLoopSink {
    readonly length: number;
    [index: number]: unknown;
    push(...ops: Exclude<InLoopOp, {
        readonly code: 'IfNotOpen';
    }>[]): number;
}
export interface InLoopEndSink extends InLoopSink {
    push(...ops: InLoopOp[]): number;
}
export interface WhereInLoop {
    readonly cursor: number;
    readonly reverse: boolean;
    readonly start: number;
    readonly top: number;
    readonly nullGuard: number;
    readonly nullGuards: readonly number[];
}
/** Call after linked SRT_Set production. Re-entering start resets this slot;
 * continuing top never reruns the producer. LHS physical DESC is folded by
 * the caller; RHS physical DESC toggles the requested iteration direction. */
export declare function beginInLoop(ops: InLoopSink, cursor: number, target: number, reverse: boolean, rhsDescending?: boolean, field?: number, earlyout?: InPrefix): WhereInLoop;
/** codeINTerm aiMap fields share one positioned RHS row and one movement.
 * Repeated fields retain distinct output registers, not Cartesian slots. */
export declare function beginInVectorLoop(ops: InLoopSink, cursor: number, fields: readonly {
    readonly target: number;
    readonly field: number;
}[], reverse: boolean, rhsDescending?: boolean, earlyout?: InPrefix): WhereInLoop;
/** Emit after the LHS cursor continuation. NULL skips to this slot's Next,
 * not to its outer loop. Empty or exhausted inner slots advance outer slots
 * inside-out; outermost exhaustion reaches the caller's prefix/break label.
 * Caller patches LHS seek/end failures to the returned innermost advance. */
export declare function finishInLoops(ops: InLoopEndSink, loops: readonly WhereInLoop[], exit: number, leftJoin?: boolean): number;
