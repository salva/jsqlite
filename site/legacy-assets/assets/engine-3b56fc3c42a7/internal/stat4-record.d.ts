export interface Stat4Record {
    readonly p: Uint8Array;
    readonly n: number;
}
export declare function ownStat4Record<T extends Stat4Record>(sample: T, bytes: Uint8Array): T;
/** Internal read-only borrow. Never mutate or retain beyond sample ownership.
 * Hand-built primitive inputs keep their existing structural p contract. */
export declare function stat4RecordBytes(sample: Stat4Record): Uint8Array;
