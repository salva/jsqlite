// analyze.c: IndexSample.p is acquired once and borrowed by trusted internal
// scalar/packed readers. Keep the public defensive-copy getter separate from
// that identity; only schema-owned samples enter this module-private registry.
export interface Stat4Record {readonly p:Uint8Array;readonly n:number}
const ownedRecords=new WeakMap<Stat4Record,Uint8Array>();
export function ownStat4Record<T extends Stat4Record>(sample:T,bytes:Uint8Array):T {
 ownedRecords.set(sample,bytes);return sample;
}
/** Internal read-only borrow. Never mutate or retain beyond sample ownership.
 * Hand-built primitive inputs keep their existing structural p contract. */
export function stat4RecordBytes(sample:Stat4Record):Uint8Array {
 return ownedRecords.get(sample)??sample.p;
}
