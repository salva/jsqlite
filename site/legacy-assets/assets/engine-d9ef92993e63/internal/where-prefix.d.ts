import type { MemAffinity } from './mem.js';
import type { KeyInfo } from './comparison.js';
export type PrefixOp = {
    readonly code: 'IndexNullRow';
    readonly p1: number;
} | {
    readonly code: 'Null';
    readonly p2: number;
} | {
    readonly code: 'Goto';
    readonly p2: number;
} | {
    readonly code: 'IndexRewind' | 'IndexLast';
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: 'Column';
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
} | {
    readonly code: 'IndexSeekPrefix';
    readonly p1: number;
    readonly keys: readonly number[];
    readonly affinities: readonly MemAffinity[];
    readonly keyInfo: KeyInfo;
    readonly reverse: boolean;
    readonly strict?: boolean;
    readonly seekScan?: Readonly<{
        steps: number;
        hasRange: boolean;
    }>;
    readonly p2: number;
};
export interface PrefixSink {
    readonly length: number;
    [index: number]: unknown;
    push(...ops: PrefixOp[]): number;
}
export interface PrefixEntry {
    readonly nSkip?: number;
    readonly restart: number | null;
    readonly empty: number | null;
}
export interface PrefixLoop extends PrefixEntry {
    readonly seek: number;
    readonly keys: readonly number[];
    readonly affinities: readonly MemAffinity[];
}
/** wherecode.c:codeAllEqualityTerms, 925–946. The caller owns equality
 * evaluation/IN setup and exit labels; this owner emits physical positioning.
 * Keys retain ordinal slots, including leading skipped fields (not SQL NULL
 * predicates). Column copies overwrite the initialization NULLs on first entry.
 */
export declare function beginPrefixLoop(ops: PrefixSink, cursor: number, keys: readonly number[], affinities: readonly MemAffinity[], keyInfo: KeyInfo, reverse: boolean, nSkip?: number): PrefixEntry;
/** Emit only after codeEqualityTerm/IN initialization and NULL guards. Keeping
 * this separate ensures strict restart flows through Column and then RHS code,
 * not directly to a seek with stale RHS iterator state (wherecode.c950ff).
 */
export declare function emitPrefixSeek(ops: PrefixSink, entry: PrefixEntry, cursor: number, keys: readonly number[], affinities: readonly MemAffinity[], keyInfo: KeyInfo, reverse: boolean, strict: boolean, scan?: Readonly<{
    enabled: boolean;
    rowLogEst: number;
    hasRange: boolean;
}>): PrefixLoop;
/** where.c:sqlite3WhereEnd, 7664–7668: suffix/IN exhaustion reaches
 * strict restart; restart/initial empty reach the final level exit.
 * Caller patches its suffix/IN exits separately; never redirects EQ NULL here.
 */
export declare function finishPrefixLoop(ops: PrefixSink, loop: PrefixLoop, exit: number): void;
