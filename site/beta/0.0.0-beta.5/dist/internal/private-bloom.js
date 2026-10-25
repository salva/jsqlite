/** vdbe.c:filterHash, with C unsigned addition rather than host number sums. */
export function filterHash(values) {
    let h = 0n;
    for (const value of values)
        h = BigInt.asUintN(64, h + value.filterHashContribution());
    return h;
}
/** Execution-owned counterpart of the zero-filled OP_Blob filter register.
 * The existing private-state budget owns bytes and a fixed descriptor charge.
 * Consumers must dispose on every execution exit; no plan owns this state.
 * This primitive is not yet an SQL planner/lowering enrollment. */
export class PrivateBloomFilter {
    #budget;
    #charge;
    #bytes;
    constructor(budget, bytes, charge) { this.#budget = budget; this.#bytes = bytes; this.#charge = charge; }
    static async open(budget, length, control) {
        if (!Number.isSafeInteger(length) || length < 1 || length > 0x7fffffff)
            throw new Error('invalid filter byte length');
        const charge = 128 + length;
        budget.reserve(charge);
        try {
            // Charge and check before allocation/publication. Native Blob's memset
            // is represented by zeroed typed-array storage, not a lazy host set.
            await control.checkpoint(length);
            const filter = new PrivateBloomFilter(budget, new Uint8Array(length), charge);
            await control.checkpoint(0);
            return filter;
        }
        catch (error) {
            budget.release(charge);
            throw error;
        }
    }
    #storage() { if (!this.#bytes)
        throw new Error('filter closed'); return this.#bytes; }
    /** OP_FilterAdd. Call after the VM's work/cancel checkpoint. No await
     * separates the borrowed key from hashing or the bit publication. */
    add(values) {
        const bytes = this.#storage(), h = Number(filterHash(values) % BigInt(bytes.length * 8));
        bytes[Math.floor(h / 8)] = bytes[Math.floor(h / 8)] | (1 << (h & 7));
    }
    /** OP_Filter jump polarity: true means absent, never authoritative match. */
    absent(values) {
        const bytes = this.#storage(), h = Number(filterHash(values) % BigInt(bytes.length * 8));
        return (bytes[Math.floor(h / 8)] & (1 << (h & 7))) === 0;
    }
    get ownedBytes() { return this.#bytes?.length ?? 0; }
    close() { if (this.#bytes) {
        this.#bytes = null;
        this.#budget.release(this.#charge);
    } }
}
