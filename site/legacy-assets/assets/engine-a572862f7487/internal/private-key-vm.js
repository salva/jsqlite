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
        const positioned = await this.cursor.first(control);
        this.nullRow = !positioned;
        this.cacheStale = true;
        this.deferredMoveto = false;
        return positioned;
    }
    async next(control) {
        const positioned = await this.cursor.next(control);
        this.nullRow = !positioned;
        this.cacheStale = true;
        return positioned;
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
