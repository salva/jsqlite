import type { ReprepareContext } from './reprepare.js';
import type { LemonValue } from './lemon-runtime.js';
import type { SqlToken } from './tokenize.js';
import { Mem, type MemAffinity } from './mem.js';
import { KeyInfo, UnpackedRecordKey } from './comparison.js';
import type { DatabaseEncoding } from './record.js';
export declare function stat4ValueFromExpr(n: LemonValue<SqlToken> | undefined, affinity: MemAffinity, encoding: DatabaseEncoding, parameterSensitive?: () => void, check?: (units: number) => void, reprepare?: ReprepareContext): Mem | null;
export declare class Stat4Probe extends UnpackedRecordKey {
    nRecValid: number;
    parameterSensitive: boolean;
    readonly check: (units: number) => void;
    readonly reprepare: ReprepareContext | undefined;
    readonly reserve: ((bytes: number) => () => void) | undefined;
    private reservations;
    private slotCapacity;
    private releasedReservation;
    private reserveSlot;
    release(): void;
    constructor(info: KeyInfo, check?: (units: number) => void, reserve?: ((bytes: number) => () => void), reprepare?: ReprepareContext);
    setLiteral(slot: number, value: null | bigint | number | string | Uint8Array): void;
    setExpression(slot: number, n: LemonValue<SqlToken> | undefined, affinity: MemAffinity): boolean;
    withPrefix<T>(n: number, body: () => T): T;
    compare(sample: {
        readonly p: Uint8Array;
        readonly n: number;
    }): -1 | 0 | 1;
}
export declare function createStat4Probe(info: KeyInfo, check?: (units: number) => void): Stat4Probe;
