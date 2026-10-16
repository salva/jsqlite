import { compareMem } from "./comparison.js";
import { Mem } from "./mem.js";
export class PrivateStateLimitError extends Error {
    constructor(message) { super(message); this.name = "PrivateStateLimitError"; }
}
/** One execution-owned aggregate budget shared by every private cursor. */
export class PrivateStateByteBudget {
    maxBytes;
    #used = 0;
    constructor(maxBytes) { this.maxBytes = maxBytes; }
    reserve(bytes, message = "private state exceeds total byte limit") { if (!Number.isSafeInteger(bytes) || bytes < 0)
        throw new Error("invalid private-state byte reservation"); if (this.#used + bytes > this.maxBytes)
        throw new PrivateStateLimitError(message); this.#used += bytes; }
    replace(oldBytes, newBytes, message = "private state exceeds total byte limit") { if (!Number.isSafeInteger(oldBytes) || !Number.isSafeInteger(newBytes) || oldBytes < 0 || newBytes < 0 || oldBytes > this.#used)
        throw new Error("invalid private-state byte replacement"); if (this.#used - oldBytes + newBytes > this.maxBytes)
        throw new PrivateStateLimitError(message); this.#used += newBytes - oldBytes; }
    release(bytes) { if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.#used)
        throw new Error("invalid private-state byte release"); this.#used -= bytes; }
    get usedBytes() { return this.#used; }
}
function cellBytes(value) { const kind = value.initialStorageClass; return kind === "text" ? value.textBytes().byteLength : kind === "blob" ? value.blobValue().byteLength : kind === "integer" || kind === "real" ? 8 : 0; }
function logicalBytes(values) { return values.reduce((n, value) => n + cellBytes(value), 0); }
function copyCells(values) { return values.map(value => { const copy = new Mem(); copy.copyFrom(value); return copy; }); }
function releaseEntry(entry) { entry.key.forEach(x => x.release()); entry.payload.forEach(x => x.release()); }
async function compareEntry(a, b, keyInfo, control) {
    for (let i = 0; i < keyInfo.keyFieldCount; i++) {
        await control.checkpoint(1);
        const term = keyInfo.terms[i], left = a.key[i], right = b.key[i];
        let c = compareMem(left, right, term.collation);
        if (c !== 0) {
            if (term.nullsLarge && (left.initialStorageClass === "null" || right.initialStorageClass === "null"))
                c = -c;
            if (term.desc)
                c = -c;
            return c;
        }
    }
    return 0;
}
/** Browser-memory counterpart of a VDBE sorter cursor. Equal keys retain insertion
 * order; no synthetic sequence participates in key equality. */
export class SorterCursor {
    kind = "sorter";
    keyInfo;
    limits;
    #entries = [];
    #sequence = 0;
    #at = -1;
    #closed = false;
    #budget;
    constructor(keyInfo, limits, budget = new PrivateStateByteBudget(limits.maxBytes)) { this.keyInfo = keyInfo; this.limits = limits; this.#budget = budget; }
    async insert(key, payload, control) {
        this.#live();
        const keyBytes = logicalBytes(key), bytes = keyBytes + logicalBytes(payload);
        if (key.length !== this.keyInfo.keyFieldCount)
            throw new Error("sorter key width does not match KeyInfo");
        if (keyBytes > this.limits.maxKeyBytes)
            throw new PrivateStateLimitError("sorter key exceeds byte limit");
        if (this.#entries.length >= this.limits.maxEntries)
            throw new PrivateStateLimitError("sorter exceeds entry limit");
        this.#budget.reserve(bytes, "sorter exceeds total byte limit");
        try {
            await control.checkpoint(1 + bytes); // admitted record plus every logical byte copied
            await control.checkpoint(0); // immediately before bounded growth
        }
        catch (error) {
            this.#budget.release(bytes);
            throw error;
        }
        let entry;
        try {
            entry = { key: copyCells(key), payload: copyCells(payload), sequence: this.#sequence++, bytes };
        }
        catch (error) {
            this.#budget.release(bytes);
            throw error;
        }
        this.#entries.push(entry);
        try {
            await control.checkpoint(0);
        } // cancellation/deadline immediately after growth
        catch (error) {
            // The opcode has not completed. Undo ownership/accounting so reset or a
            // direct caller never observes a partially admitted record.
            this.#entries.pop();
            this.#sequence--;
            releaseEntry(entry);
            this.#budget.release(bytes);
            throw error;
        }
    }
    async insertBounded(key, payload, capacity, control) {
        this.#live();
        if (capacity < 0n)
            return this.insert(key, payload, control);
        if (capacity === 0n)
            return;
        if (BigInt(this.#entries.length) < capacity)
            return this.insert(key, payload, control);
        let worst = 0;
        for (let i = 1; i < this.#entries.length; i++)
            if (await compareEntry(this.#entries[worst], this.#entries[i], this.keyInfo, control) < 0)
                worst = i;
        const candidate = { key: key, payload: payload, sequence: this.#sequence, bytes: 0 };
        if (await compareEntry(candidate, this.#entries[worst], this.keyInfo, control) >= 0) {
            await control.checkpoint(1);
            return;
        }
        const keyBytes = logicalBytes(key), bytes = keyBytes + logicalBytes(payload), old = this.#entries[worst];
        if (keyBytes > this.limits.maxKeyBytes)
            throw new PrivateStateLimitError("sorter key exceeds byte limit");
        this.#budget.replace(old.bytes, bytes, "sorter exceeds total byte limit");
        try {
            await control.checkpoint(1 + bytes);
            await control.checkpoint(0);
        }
        catch (error) {
            this.#budget.replace(bytes, old.bytes);
            throw error;
        }
        let replacement;
        try {
            replacement = { key: copyCells(key), payload: copyCells(payload), sequence: this.#sequence++, bytes };
        }
        catch (error) {
            this.#budget.replace(bytes, old.bytes);
            throw error;
        }
        this.#entries[worst] = replacement;
        try {
            await control.checkpoint(0);
        }
        catch (error) {
            this.#entries[worst] = old;
            this.#sequence--;
            releaseEntry(replacement);
            this.#budget.replace(bytes, old.bytes);
            throw error;
        }
        releaseEntry(old);
    }
    async sort(control) {
        this.#live();
        let source = this.#entries.slice(), target = new Array(source.length);
        for (let width = 1; width < source.length; width *= 2)
            for (let lo = 0; lo < source.length; lo += width * 2) {
                let a = lo, b = Math.min(lo + width, source.length), ae = b, be = Math.min(lo + width * 2, source.length), out = lo;
                while (a < ae || b < be) {
                    let chosen;
                    if (b >= be)
                        chosen = source[a++];
                    else if (a >= ae)
                        chosen = source[b++];
                    else {
                        const comparison = await compareEntry(source[a], source[b], this.keyInfo, control);
                        chosen = comparison < 0 || (comparison === 0 && source[a].sequence < source[b].sequence) ? source[a++] : source[b++];
                    }
                    await control.checkpoint(1); // one merge move
                    target[out++] = chosen;
                }
                if (lo + width * 2 >= source.length)
                    [source, target] = [target, source];
            }
        this.#entries = source;
        this.#at = -1;
    }
    first() { this.#live(); this.#at = 0; return this.#entries.length > 0; }
    next() { this.#live(); return ++this.#at < this.#entries.length; }
    data() { this.#live(); if (this.#at < 0 || this.#at >= this.#entries.length)
        throw new Error("sorter cursor is not positioned"); return this.#entries[this.#at].payload; }
    clear() { this.#live(); this.#entries.forEach(entry => { releaseEntry(entry); this.#budget.release(entry.bytes); }); this.#entries = []; this.#at = -1; }
    close() { if (this.#closed)
        return; this.clear(); this.#closed = true; }
    #live() { if (this.#closed)
        throw new Error("sorter cursor is closed"); }
}
export class FifoCursor {
    kind = "fifo";
    limits;
    #entries = [];
    #closed = false;
    #budget;
    constructor(limits, budget = new PrivateStateByteBudget(limits.maxBytes)) { this.limits = limits; this.#budget = budget; }
    get size() { this.#live(); return this.#entries.length; }
    async insert(values, control) {
        this.#live();
        const bytes = logicalBytes(values);
        if (bytes > this.limits.maxKeyBytes)
            throw new PrivateStateLimitError("recursive queue row exceeds byte limit");
        if (this.#entries.length >= this.limits.maxEntries)
            throw new PrivateStateLimitError("recursive queue exceeds entry limit");
        this.#budget.reserve(bytes, "recursive queue exceeds total byte limit");
        try {
            await control.checkpoint(1 + bytes);
            await control.checkpoint(0);
        }
        catch (error) {
            this.#budget.release(bytes);
            throw error;
        }
        let entry;
        try {
            entry = { key: copyCells(values), payload: [], sequence: 0, bytes };
        }
        catch (error) {
            this.#budget.release(bytes);
            throw error;
        }
        this.#entries.push(entry);
        try {
            await control.checkpoint(0);
        }
        catch (error) {
            this.#entries.pop();
            releaseEntry(entry);
            this.#budget.release(bytes);
            throw error;
        }
    }
    shift() { this.#live(); const entry = this.#entries.shift(); if (!entry)
        return null; const values = entry.key.map(value => { const copy = new Mem(); copy.copyFrom(value); return copy; }); releaseEntry(entry); this.#budget.release(entry.bytes); return values; }
    clear() { this.#live(); for (const entry of this.#entries) {
        releaseEntry(entry);
        this.#budget.release(entry.bytes);
    } this.#entries = []; }
    close() { if (this.#closed)
        return; this.clear(); this.#closed = true; }
    #live() { if (this.#closed)
        throw new Error("recursive queue cursor is closed"); }
}
/** Mutable ORDER BY queue for select.c's recursive SRT_Queue destination. */
export class PriorityQueueCursor {
    kind = "priority-queue";
    keyInfo;
    limits;
    #entries = [];
    #sequence = 0;
    #closed = false;
    #budget;
    constructor(keyInfo, limits, budget = new PrivateStateByteBudget(limits.maxBytes)) { this.keyInfo = keyInfo; this.limits = limits; this.#budget = budget; }
    async insert(key, payload, control) {
        this.#live();
        const keyBytes = logicalBytes(key), bytes = keyBytes + logicalBytes(payload);
        if (key.length !== this.keyInfo.keyFieldCount)
            throw new Error("priority queue key width does not match KeyInfo");
        if (keyBytes > this.limits.maxKeyBytes)
            throw new PrivateStateLimitError("recursive queue key exceeds byte limit");
        if (this.#entries.length >= this.limits.maxEntries)
            throw new PrivateStateLimitError("recursive queue exceeds entry limit");
        this.#budget.reserve(bytes, "recursive queue exceeds total byte limit");
        try {
            await control.checkpoint(1 + bytes);
            await control.checkpoint(0);
        }
        catch (error) {
            this.#budget.release(bytes);
            throw error;
        }
        let entry;
        try {
            entry = { key: copyCells(key), payload: copyCells(payload), sequence: this.#sequence++, bytes };
        }
        catch (error) {
            this.#budget.release(bytes);
            throw error;
        }
        let at = 0;
        try {
            for (; at < this.#entries.length; at++) {
                const c = await compareEntry(entry, this.#entries[at], this.keyInfo, control);
                if (c < 0 || (c === 0 && entry.sequence < this.#entries[at].sequence))
                    break;
            }
            await control.checkpoint(0);
        }
        catch (error) {
            this.#sequence--;
            releaseEntry(entry);
            this.#budget.release(bytes);
            throw error;
        }
        this.#entries.splice(at, 0, entry);
        try {
            await control.checkpoint(0);
        }
        catch (error) {
            this.#entries.splice(at, 1);
            this.#sequence--;
            releaseEntry(entry);
            this.#budget.release(bytes);
            throw error;
        }
    }
    shift() { this.#live(); const entry = this.#entries.shift(); if (!entry)
        return null; const values = copyCells(entry.payload); releaseEntry(entry); this.#budget.release(entry.bytes); return values; }
    clear() { this.#live(); for (const entry of this.#entries) {
        releaseEntry(entry);
        this.#budget.release(entry.bytes);
    } this.#entries = []; }
    close() { if (this.#closed)
        return; this.clear(); this.#closed = true; }
    #live() { if (this.#closed)
        throw new Error("recursive priority queue cursor is closed"); }
}
/** Memory-only ephemeral index. It owns complete keys and uses SQLite Mem/KeyInfo
 * equality; NULLs compare equal for DISTINCT. */
export class EphemeralIndexCursor {
    kind = "ephemeral-index";
    keyInfo;
    limits;
    insertionOrder;
    #shared = { entries: [], references: 1, sorted: true, sequence: 0, cursors: new Set() };
    #closed = false;
    #at = -1;
    #deleted = false;
    #budget;
    constructor(keyInfo, limits, budget = new PrivateStateByteBudget(limits.maxBytes), insertionOrder = false) { this.keyInfo = keyInfo; this.limits = limits; this.#budget = budget; this.insertionOrder = insertionOrder; this.#shared.cursors.add(this); }
    get size() { this.#live(); return this.#shared.entries.length; }
    /** sqlite3ExprCodeIN distinguishes empty RHS from RHS NULL on the Mem-owned index. */
    hasNullKey() { this.#live(); return this.#shared.entries.some(entry => entry.key[0]?.initialStorageClass === "null"); }
    async found(key, control) {
        this.#live();
        await control.checkpoint(0);
        const probe = { key: key, payload: [], sequence: 0, bytes: 0 };
        // vdbe.c Found -> btree.c IndexMoveto: compare ordered keys, then narrow
        // the interval. Unsorted insertion-order/window cursors retain linear lookup.
        if (this.#shared.sorted) {
            let lo = 0, hi = this.#shared.entries.length - 1;
            while (lo <= hi) {
                const mid = lo + Math.floor((hi - lo) / 2), c = await compareEntry(this.#shared.entries[mid], probe, this.keyInfo, control);
                this.#live();
                if (c === 0) {
                    await control.checkpoint(0);
                    return true;
                }
                if (c < 0)
                    lo = mid + 1;
                else
                    hi = mid - 1;
            }
        }
        else
            for (const entry of this.#shared.entries)
                if (await compareEntry(entry, probe, this.keyInfo, control) === 0) {
                    await control.checkpoint(0);
                    return true;
                }
        await control.checkpoint(0);
        return false;
    }
    async remove(key, control) {
        this.#live();
        for (let i = 0; i < this.#shared.entries.length; i++)
            if (await compareEntry(this.#shared.entries[i], { key: key, payload: [], sequence: 0, bytes: 0 }, this.keyInfo, control) === 0) {
                await control.checkpoint(1);
                this.#deleteAt(i);
                return;
            }
    }
    /** Retain this cursor's records whose complete keys occur in `other`.
     * The cells deliberately remain those owned by this (left) cursor: SQLite
     * INTERSECT uses the right records only for membership, preserving the left
     * representative when INTEGER/REAL or collation equality matches. */
    async retainFoundIn(other, control) {
        this.#live();
        for (let i = 0; i < this.#shared.entries.length;) {
            const entry = this.#shared.entries[i];
            if (await other.found(entry.key, control)) {
                i++;
                continue;
            }
            await control.checkpoint(1);
            this.#deleteAt(i);
        }
    }
    clear() { this.#live(); this.#shared.entries.forEach(entry => { releaseEntry(entry); this.#budget.release(entry.bytes); }); this.#shared.entries = []; this.#shared.sequence = 0; for (const cursor of this.#shared.cursors) {
        cursor.#at = -1;
        cursor.#deleted = false;
    } }
    /** btree.c IndexMoveto-shaped lower bound for ordinary ordered key cursors.
     * Insertion-order/window cursors deliberately keep their existing sequence. */
    async #keyPosition(key, control) {
        let lo = 0, hi = this.#shared.entries.length;
        const probe = { key: key, payload: [], sequence: 0, bytes: 0 };
        while (lo < hi) {
            const mid = lo + Math.floor((hi - lo) / 2);
            if (await compareEntry(this.#shared.entries[mid], probe, this.keyInfo, control) < 0)
                lo = mid + 1;
            else
                hi = mid;
        }
        return lo;
    }
    async insert(key, control, ordered = false) {
        this.#live();
        const at = ordered ? await this.#keyPosition(key, control) : this.#shared.entries.length;
        const owned = copyCells(key), bytes = logicalBytes(owned);
        if (bytes > this.limits.maxKeyBytes) {
            owned.forEach(value => value.release());
            throw new PrivateStateLimitError("ephemeral key exceeds byte limit");
        }
        if (this.#shared.entries.length >= this.limits.maxEntries) {
            owned.forEach(value => value.release());
            throw new PrivateStateLimitError("ephemeral index exceeds entry limit");
        }
        try {
            this.#budget.reserve(bytes, "ephemeral index exceeds total byte limit");
        }
        catch (error) {
            owned.forEach(value => value.release());
            throw error;
        }
        try {
            await control.checkpoint(1 + bytes);
            await control.checkpoint(0);
        }
        catch (error) {
            owned.forEach(value => value.release());
            this.#budget.release(bytes);
            throw error;
        }
        const entry = { key: owned, payload: [], sequence: this.#shared.sequence, bytes };
        this.#shared.entries.splice(at, 0, entry);
        const wasSorted = this.#shared.sorted;
        this.#shared.sorted = ordered;
        try {
            await control.checkpoint(0);
        }
        catch (error) {
            this.#shared.entries.splice(at, 1);
            this.#shared.sorted = wasSorted;
            releaseEntry(entry);
            this.#budget.release(bytes);
            throw error;
        }
        this.#shared.sequence++;
        for (const cursor of this.#shared.cursors)
            if (cursor.#at >= at)
                cursor.#at++;
    }
    /** Replace an equal complete record, preserving SQLite UNION's right-side representative. */
    async replace(key, control) {
        this.#live();
        if (!this.insertionOrder && !this.#shared.sorted)
            await this.sort(control);
        const start = this.insertionOrder ? 0 : await this.#keyPosition(key, control), end = this.insertionOrder ? this.#shared.entries.length : Math.min(start + 1, this.#shared.entries.length);
        for (let i = start; i < end; i++)
            if (await compareEntry(this.#shared.entries[i], { key: key, payload: [], sequence: 0, bytes: 0 }, this.keyInfo, control) === 0) {
                const bytes = logicalBytes(key), old = this.#shared.entries[i];
                if (bytes > this.limits.maxKeyBytes)
                    throw new PrivateStateLimitError("ephemeral index exceeds byte limit");
                this.#budget.replace(old.bytes, bytes, "ephemeral index exceeds byte limit");
                try {
                    await control.checkpoint(1 + bytes);
                    await control.checkpoint(0);
                }
                catch (error) {
                    this.#budget.replace(bytes, old.bytes);
                    throw error;
                }
                let replacement;
                try {
                    replacement = { key: copyCells(key), payload: [], sequence: old.sequence, bytes };
                }
                catch (error) {
                    this.#budget.replace(bytes, old.bytes);
                    throw error;
                }
                this.#shared.entries[i] = replacement;
                try {
                    await control.checkpoint(0);
                }
                catch (error) {
                    this.#shared.entries[i] = old;
                    releaseEntry(replacement);
                    this.#budget.replace(bytes, old.bytes);
                    throw error;
                }
                releaseEntry(old);
                return;
            }
        return this.insert(key, control, !this.insertionOrder);
    }
    async sort(control) {
        this.#live();
        if (this.insertionOrder)
            return;
        let source = this.#shared.entries.slice(), target = new Array(source.length);
        for (let width = 1; width < source.length; width *= 2) {
            for (let lo = 0; lo < source.length; lo += width * 2) {
                let a = lo, b = Math.min(lo + width, source.length), ae = b, be = Math.min(lo + width * 2, source.length), out = lo;
                while (a < ae || b < be) {
                    const take = b >= be || (a < ae && await compareEntry(source[a], source[b], this.keyInfo, control) <= 0);
                    target[out++] = take ? source[a++] : source[b++];
                    await control.checkpoint(1);
                }
            }
            [source, target] = [target, source];
        }
        this.#shared.entries = source;
        this.#shared.sorted = true;
        for (const cursor of this.#shared.cursors) {
            cursor.#at = -1;
            cursor.#deleted = false;
        }
    }
    first() { this.#live(); this.#deleted = false; this.#at = 0; return this.#shared.entries.length > 0; }
    /** window.c1948ff / vdbe.c OP_SeekRowid: publish positioning only after
     * lookup succeeds. Browser linear lookup charges every visited shared record;
     * the VM control supplies bounded yielding, cancellation and deadline checks. */
    async seekRowid(rowid, control) {
        this.#live();
        await control.checkpoint(0);
        let at = -1;
        for (let i = 0; i < this.#shared.entries.length; i++) {
            await control.checkpoint(1);
            this.#live();
            if (BigInt(this.#shared.entries[i].sequence + 1) === rowid) {
                at = i;
                break;
            }
        }
        await control.checkpoint(0);
        this.#live();
        this.#deleted = false;
        this.#at = at;
        return at >= 0;
    }
    /** Monotonic insertion identity, independent of the live entry count.
     * Clear starts a new ephemeral table; deletion never reuses an identity. */
    newRowid() { this.#live(); return BigInt(this.#shared.sequence + 1); }
    /** btree.c sqlite3BtreeDelete(SAVEPOSITION): publish removal only after the
     * interruptible checkpoint. Every OpenDup position is adjusted together.
     * A handle on the removed record rests immediately before its successor,
     * so the following Next returns that successor rather than skipping it. */
    async deleteCurrent(control) {
        this.#live();
        if (this.#deleted || this.#at < 0 || this.#at >= this.#shared.entries.length)
            throw new Error("ephemeral cursor is not positioned");
        const entry = this.#shared.entries[this.#at];
        await control.checkpoint(1);
        this.#live();
        const at = this.#shared.entries.indexOf(entry);
        if (at < 0)
            throw new Error("ephemeral deletion position changed during checkpoint");
        this.#deleteAt(at);
    }
    #deleteAt(at) {
        const [entry] = this.#shared.entries.splice(at, 1);
        for (const cursor of this.#shared.cursors) {
            if (cursor.#at === at)
                cursor.#deleted = true;
            if (cursor.#at >= at)
                cursor.#at--;
        }
        this.#budget.release(entry.bytes);
        releaseEntry(entry);
    }
    rowid() { this.#live(); if (this.#deleted || this.#at < 0 || this.#at >= this.#shared.entries.length)
        throw new Error("ephemeral cursor is not positioned"); return BigInt(this.#shared.entries[this.#at].sequence + 1); }
    next() { this.#live(); this.#deleted = false; return ++this.#at < this.#shared.entries.length; }
    rewindBeforeFirst() { this.#live(); this.#deleted = false; this.#at = -1; }
    nextData() { this.#live(); return this.#shared.entries[this.#at + 1]?.key ?? null; }
    hasNext() { this.#live(); return this.#at + 1 < this.#shared.entries.length; }
    data() { this.#live(); if (this.#deleted || this.#at < 0 || this.#at >= this.#shared.entries.length)
        throw new Error("ephemeral cursor is not positioned"); return this.#shared.entries[this.#at].key; }
    /** vdbe.c OP_OpenDup creates an independently positioned cursor over the
     * same ephemeral b-tree. The duplicate borrows records; its position is not
     * shared with the owner. */
    duplicate() { this.#live(); const copy = new EphemeralIndexCursor(this.keyInfo, this.limits, this.#budget, this.insertionOrder); copy.#shared = this.#shared; copy.#shared.cursors.add(copy); copy.#shared.references++; return copy; }
    close() { if (this.#closed)
        return; this.#closed = true; this.#shared.cursors.delete(this); if (--this.#shared.references === 0) {
        this.#shared.entries.forEach(entry => { releaseEntry(entry); this.#budget.release(entry.bytes); });
        this.#shared.entries = [];
    } this.#at = -1; }
    #live() { if (this.#closed)
        throw new Error("ephemeral index cursor is closed"); }
}
