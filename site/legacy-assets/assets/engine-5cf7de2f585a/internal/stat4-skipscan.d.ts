import { type DatabaseEncoding } from './record.js';
import { Mem, type MemAffinity } from './mem.js';
import { Stat4Probe } from './stat4-probe.js';
import type { LemonValue } from './lemon-runtime.js';
import type { SqlToken } from './tokenize.js';
export interface Stat4ScalarSample {
    readonly p: Uint8Array;
    readonly n: number;
}
/** Decode only iCol (native requires iCol>0). Padding is readable for varints,
 * but header and cumulative payload endpoints must fit the original n.
 * A supplied destination is unchanged on structural corruption. Ordinary record
 * readers remain strict, including their rejection of reserved serial types.
 * reserve covers the copied field until the caller releases the scratch Mem. */
export declare function stat4Column(sample: Stat4ScalarSample, iCol: number, encoding: DatabaseEncoding, destination: Mem, check?: (units: number) => void, reserve?: (bytes: number) => () => void): () => void;
export interface Stat4SkipScanInput {
    readonly probe: Stat4Probe;
    readonly samples: readonly Stat4ScalarSample[];
    readonly column: number;
    readonly affinity: MemAffinity;
    readonly lower?: LemonValue<SqlToken>;
    readonly upper?: LemonValue<SqlToken>;
}
export interface Stat4SkipScanResult {
    readonly nLower: number;
    readonly nUpper: number;
    readonly nDiff: number;
    readonly done: boolean;
    readonly adjust: number;
}
/** Builder-local native count loop. Consumer subtracts adjust from nOut only
 * when done. No prefix slots/metadata are mutated and DESC does not invert the
 * scalar MemCompare. Errors propagate (no apparent successful fallback). */
export declare function stat4SkipScanRange(input: Stat4SkipScanInput): Stat4SkipScanResult;
