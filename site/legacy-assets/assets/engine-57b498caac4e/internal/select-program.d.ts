import type { ReprepareContext } from './reprepare.js';
import type { MemAffinity } from "./mem.js";
import type { BuiltinCollation } from "./comparison.js";
export type SelectDest = Readonly<{
    kind: "coroutine";
    register: number;
    first: number;
}> | Readonly<{
    kind: "ephemeral";
    cursor: number;
}> | Readonly<{
    kind: "output";
}> | Readonly<{
    kind: "sorter";
    cursor: number;
    keyCount?: number;
}> | Readonly<{
    kind: "mem" | "exists";
    register: number;
    found?: number;
    width?: number;
}> | Readonly<{
    kind: "set";
    cursor: number;
    packedRegister?: number;
    width?: number;
    affinities?: readonly MemAffinity[];
}> | Readonly<{
    kind: "aggregate-expression";
    register: number;
    name: "count" | "sum" | "avg" | "total" | "min" | "max" | "group_concat" | "string_agg";
    collation: BuiltinCollation;
    emitArgument?: (first: number, count: number) => readonly number[];
    emitWhere?: (first: number, count: number) => number;
    emitFilter?: (first: number, count: number) => number;
    distinctCursor?: number;
    order?: Readonly<{
        cursor: number;
        emitKeys: (first: number, count: number) => readonly number[];
        keyStart: number;
        payload: number;
    }>;
}>;
export declare function reachesOwningReturn(ops: readonly {
    readonly code: string;
    readonly p1?: unknown;
}[], target: number, returnRegister: number): boolean;
export declare class SelectProgramBuilder<Op extends {
    readonly code: string;
}> {
    readonly ops: Op[];
    /** where.c shared construction frontier, including selected arm replanning. */
    readonly wherePlanBudget: {
        reprepare?: ReprepareContext;
        remaining: bigint;
        readonly progressCheck?: (() => void) | undefined;
    };
    constructor(progressCheck?: (() => void) | undefined, reprepare?: ReprepareContext);
    registers: number;
    cursors: number;
    private labels;
    private pending;
    private nextLabel;
    private validations;
    validateResolved(validate: (ops: readonly Op[]) => void): void;
    register(): number;
    range(count: number): number;
    cursor(): number;
    reserveCursorsThrough(last: number): void;
    label(): number;
    mark(label: number): void;
    emit(op: Op): number;
    jump(label: number, op: Op, resolve: (op: Op, pc: number) => Op): void;
    resolveLabel(label: number): void;
    finish(): readonly Op[];
}
export declare function emitSelectDestination<Op extends {
    readonly code: string;
}>(ops: Op[], dest: SelectDest, first: number, count: number): void;
