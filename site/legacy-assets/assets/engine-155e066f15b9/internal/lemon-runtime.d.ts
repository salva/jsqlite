export type LemonValue<T = unknown> = {
    readonly kind: "terminal";
    readonly tokenId: number;
    readonly value: T;
} | {
    readonly kind: "reduction";
    readonly rule: number;
    readonly signature: string;
    readonly children: readonly LemonValue<T>[];
    /** Value authored by a production-specific action at reduction time. */
    readonly semantic?: unknown;
};
export interface LemonTrace<T = unknown> {
    readonly accepted: boolean;
    readonly reductions: readonly number[];
    readonly value?: LemonValue<T>;
    readonly terminalAction?: number;
    /** Zero-based input terminal that selected the terminal error action. */
    readonly errorInput?: number;
    /** sqlite3RunParser stops after cmdx completion, before subsequent SQL. */
    readonly statementEndInput?: number;
}
export interface LemonLimits {
    readonly maxWorkUnits: number;
    readonly maxParserDepth: number;
    readonly maxExpressionDepth: number;
}
export type LemonReductionAction<T> = (signature: string, children: readonly LemonValue<T>[]) => unknown;
/** Pinned lempar.c state/action encoding with source-rule-keyed immutable values. */
export declare function lemonParse<T = unknown>(terminals: readonly number[], values?: readonly T[], limits?: LemonLimits, reductionAction?: LemonReductionAction<T>, stopAfterStatement?: boolean): LemonTrace<T>;
export declare const lemonAccepts: (terminals: readonly number[]) => boolean;
