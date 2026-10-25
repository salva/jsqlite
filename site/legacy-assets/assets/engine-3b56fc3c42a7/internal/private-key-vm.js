import { BorrowLifetime, Mem, memFromRawRecord } from "./mem.js";
import { RawRecordReader } from "./record.js";
/** vdbe.c OpenEphemeral/Found/IdxInsert VM state owner. The Btree owns page
 * positioning; signed seekResult is diagnostic, never trusted Insert authority. */
export class PrivateKeyVmCursor {
    arena;
    cursor;
    info;
    nullRow = true;
    cacheStale = true;
    deferredMoveto = false;
    seekResult = 0;
    constructor(arena, cursor, info) { this.arena = arena; this.cursor = cursor; this.info = info; }
    async reuse(control) {
        this.cacheStale = true;
        await this.arena.clearTable(control);
        // Native reuse changes nullRow only after ClearTable succeeds. Existing
        // seekResult/deferredMoveto are not reset by this opcode.
        this.nullRow = true;
    }
    async seek(key, control) {
        const result = await this.cursor.indexMoveto(key, control);
        this.seekResult = result.res;
        const exists = result.res === 0;
        this.nullRow = !exists;
        this.deferredMoveto = false;
        this.cacheStale = true;
        return exists;
    }
    async first(control) {
        // vdbe.c OP_Rewind publishes cache/deferred before checking rc;
        // nullRow changes only after success.
        let positioned;
        try {
            positioned = await this.cursor.first(control);
        }
        finally {
            this.cacheStale = true;
            this.deferredMoveto = false;
        }
        this.nullRow = !positioned;
        return positioned;
    }
    async last(control) {
        // OP_Last initializes res=0 and publishes all three fields before rc.
        let positioned = true;
        try {
            positioned = await this.cursor.last(control);
            return positioned;
        }
        finally {
            this.nullRow = !positioned;
            this.cacheStale = true;
            this.deferredMoveto = false;
        }
    }
    async next(control) {
        let positioned;
        try {
            positioned = await this.cursor.next(control);
        }
        finally {
            this.cacheStale = true;
        }
        this.nullRow = !positioned;
        return positioned;
    }
    async previous(control) {
        // OP_Prev shares next_tail: stale cache on error, but retain nullRow.
        let positioned;
        try {
            positioned = await this.cursor.previous(control);
        }
        finally {
            this.cacheStale = true;
        }
        this.nullRow = !positioned;
        return positioned;
    }
    /** OP_Column register publication/deephemeralization (vdbe.c:3195ff).
     * Copy inside withPayload: its temporary Mem is not a lasting register. */
    async column(field, output, control) {
        await this.withColumn(field, control, value => output.copyFrom(value));
    }
    /** OP_Column over the page-owned private index. TEXT/BLOB borrow the
     * charged payload snapshot only until consume returns. A register consumer
     * must copy while that borrow is live; no cached record/page view escapes.
     * This branch has no P4 default: absent trailing columns produce SQL NULL. */
    async withColumn(field, control, consume) {
        if (!Number.isInteger(field) || field < 0)
            throw new Error('invalid private column ordinal');
        if (this.nullRow) {
            const value = new Mem();
            try {
                return await consume(value);
            }
            finally {
                value.release();
            }
        }
        return this.cursor.withPayload(control, async (bytes) => {
            const lifetime = new BorrowLifetime();
            let value;
            try {
                const reader = new RawRecordReader(bytes, this.info.encoding);
                for (let i = 0; i <= field; i++) {
                    await control.checkpoint(1);
                    const raw = reader.next();
                    if (raw === null) {
                        value = new Mem();
                        break;
                    }
                    if (i === field)
                        value = memFromRawRecord(raw, lifetime);
                }
                return await consume(value);
            }
            finally {
                lifetime.invalidate();
                value?.release();
            }
        });
    }
    async insert(packed, control) {
        // Primitive packed reseek is the accepted bounded USESEEKRESULT fallback.
        // Cache invalidation follows BtreeInsert return even when rc is an error.
        try {
            await this.cursor.insertIndex(packed, {}, control);
        }
        finally {
            this.cacheStale = true;
        }
    }
    close() { this.cursor.close(); }
}
