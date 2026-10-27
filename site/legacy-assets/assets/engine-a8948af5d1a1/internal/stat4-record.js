const ownedRecords = new WeakMap();
export function ownStat4Record(sample, bytes) {
    ownedRecords.set(sample, bytes);
    return sample;
}
/** Internal read-only borrow. Never mutate or retain beyond sample ownership.
 * Hand-built primitive inputs keep their existing structural p contract. */
export function stat4RecordBytes(sample) {
    return ownedRecords.get(sample) ?? sample.p;
}
