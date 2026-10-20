var _a;
import { rekeyBlobkeySiblings, acquireBlobkeySiblings, gatherBlobkeyCells, partitionBlobkeyCells, publishBlobkeyDividers, editBlobkeySiblings } from "./private-blobkey-balance.js";
import { balanceStaging, balanceEditLifetime, balanceDivider, balanceChildPointer, balanceDividerInsert } from "./private-blobkey-staging.js";
import { Mem, BorrowLifetime } from "./mem.js";
import { decodeVarint } from "./record.js";
import { ComparisonError, UnpackedRecordKey, compareRecordKey, unpackRecordKey } from "./comparison.js";
import { PrivateStateLimitError } from "./private-state.js";
/** Physical retained buffer + deterministic arena/MemPage metadata. Not JS heap measurement. */
export const PRIVATE_PAGE_CHARGE = 4096 + 128;
/** Arena object/state plus empty page-map/result-registry descriptors.
 * Retained from construction through successful close; not heap measurement. */
export const PRIVATE_ARENA_CHARGE = 128;
/** Per-acquisition revocation/view/release metadata, including bounded byte-method
 * table (at most 15 wrappers) and derived-page method table (at most 32
 * wrappers); shared page bytes excluded. Raw descriptor includes pgno/bytes/release
 * and is transferred directly by allocatePage, never spread into another wrapper. */
export const PRIVATE_LEASE_CHARGE = 128;
/** Per borrowed subview including its bounded byte-method table, retained until
 * its owning capability is revoked. Not a heap-size estimate. */
export const PRIVATE_SUBVIEW_CHARGE = 64;
/** Per stateful borrowed iterator, retained until owner revocation. */
export const PRIVATE_ITERATOR_CHARGE = 64;
/** Per retained iterator result, plus the same allowance for an entries tuple.
 * Charged until owning capability revocation; explicit scalar copies are values. */
export const PRIVATE_ITERATOR_RESULT_CHARGE = 32;
/** Staged inspection result and copied-buffer descriptors; payload charged too.
 * Page-owned high-water retention until staging teardown, not heap measurement. */
export const PRIVATE_STAGED_INSPECTION_CHARGE = 64;
/** Per published auxiliary cell: deterministic 128-byte allowance for the result,
 * revocation token/byte capability, release closure and arena registry entry.
 * Not a JS heap measurement; includes pending construction at peak. */
export const PRIVATE_CELL_RESULT_CHARGE = 128;
/** Cursor object/state and empty stack/cache descriptors. Dynamic stack slots,
 * target ownership and overflow buffers are not included. Not heap measurement. */
export const PRIVATE_CURSOR_CHARGE = 128;
/** Deterministic retained parent-array slot capacity (record + reference/slot).
 * Charged at depth high-water mark until cursor close, not heap measurement. */
export const PRIVATE_PARENT_SLOT_CHARGE = 64;
export class PrivateBlobkeyFormatError extends Error {
    constructor(message) { super(message); this.name = "PrivateBlobkeyFormatError"; }
}
const corrupt = (message) => { throw new PrivateBlobkeyFormatError(message); };
function get2(b, p) { return (b[p] << 8) | b[p + 1]; }
function get4(b, p) { return ((b[p] * 0x1000000) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3]) >>> 0; }
function put2(b, p, n) { b[p] = (n >>> 8) & 255; b[p + 1] = n & 255; }
function put4(b, p, n) { b[p] = (n >>> 24) & 255; b[p + 1] = (n >>> 16) & 255; b[p + 2] = (n >>> 8) & 255; b[p + 3] = n & 255; }
/** Borrowed bytes, not a native TypedArray export. Only explicitly bounded
 * read operations are exposed: no writes, ArrayBuffer, callback receiver or implicit copies.
 * Derived subviews and iterators share the acquisition's revocation token. */
// Module-private copy authority, never an exported raw-buffer capability. The
// closure shares the exact view's revocation check and performs no await or
// user callback between validation and bounded copy. Subview admission remains
// owned by borrowedBytes; this descriptor is part of that capability's charge.
const nativeByteSet = Uint8Array.prototype.set;
const borrowedCopies = new WeakMap();
function copyBorrowedBytes(target, source, offset = 0) {
    const copy = borrowedCopies.get(source);
    if (!copy)
        throw new Error("private copy requires a borrowed byte capability");
    copy(target, offset);
}
function borrowedBytes(bytes, live, admitCapability) {
    let view;
    // Fixed whitelist below bounds this table: repeated property reads must not
    // manufacture indefinitely many independently retained revocation wrappers.
    const methods = new Map();
    const method = (key, create) => {
        const old = methods.get(key);
        if (old)
            return old;
        const value = create();
        methods.set(key, value);
        return value;
    };
    const iterator = (kind) => {
        const undo = admitCapability(PRIVATE_ITERATOR_CHARGE);
        try {
            let i = 0;
            return { next() {
                    live();
                    const done = i >= bytes.length;
                    const undoResult = admitCapability(PRIVATE_ITERATOR_RESULT_CHARGE * (!done && kind === "entries" ? 2 : 1));
                    try {
                        const n = i, result = done ? { done: true, value: undefined } : { done: false, value: kind === "keys" ? n : kind === "entries" ? [n, bytes[n]] : bytes[n] };
                        if (!done)
                            i++;
                        return result;
                    }
                    catch (error) {
                        undoResult();
                        throw error;
                    }
                }, [Symbol.iterator]() { live(); return this; } };
        }
        catch (error) {
            undo();
            throw error;
        }
    };
    view = new Proxy(bytes, {
        get(target, key) {
            live();
            if (key === "buffer" || key === "constructor" || key === "slice")
                throw new Error("borrowed byte buffer export prohibited");
            if (key === Symbol.iterator || key === "values" || key === "keys" || key === "entries")
                return method(key, () => () => { live(); return iterator(typeof key === "string" ? key : "values"); });
            if (key === "subarray")
                return method(key, () => (start, end) => { live(); const undo = admitCapability(PRIVATE_SUBVIEW_CHARGE); try {
                    return borrowedBytes(target.subarray(start, end), live, admitCapability);
                }
                catch (error) {
                    undo();
                    throw error;
                } });
            if (key === "valueOf")
                return method(key, () => () => { live(); return view; });
            const value = Reflect.get(target, key, target);
            if (typeof value !== "function")
                return value;
            if (["set", "fill", "copyWithin", "reverse", "sort"].includes(String(key)))
                return method(key, () => () => { live(); throw new Error("borrowed bytes are readonly"); });
            if (!["at", "indexOf", "lastIndexOf", "includes", "join", "toString"].includes(String(key)))
                throw new Error("borrowed byte callback/export operation prohibited");
            return method(key, () => (...args) => { live(); const result = Reflect.apply(value, target, args); return result === target ? view : result; });
        }, set() { live(); throw new Error("borrowed bytes are readonly"); },
        deleteProperty() { live(); throw new Error("borrowed byte deletion prohibited"); },
        setPrototypeOf() { live(); throw new Error("borrowed byte prototype mutation prohibited"); },
        preventExtensions() { live(); throw new Error("borrowed byte extensibility mutation prohibited"); },
        defineProperty() { live(); throw new Error("borrowed byte definition prohibited"); },
        getOwnPropertyDescriptor(target, key) { live(); const d = Reflect.getOwnPropertyDescriptor(target, key); if (d && "value" in d && typeof d.value !== "number")
            throw new Error("borrowed byte descriptor export prohibited"); return d; },
        ownKeys(target) { live(); return Reflect.ownKeys(target); }
    });
    borrowedCopies.set(view, (target, offset) => { live(); nativeByteSet.call(target, bytes, offset); });
    return view;
}
/** Derived MemPage metadata. Bytes are authoritative; arena replacement invalidates this object.
 * btree.c:decodeFlags/btreeInitPage/computeFreeSpace/findCell/parseCellPtrIndex.
 * Init deliberately is not complete cell or freeblock validation. */
const pageIdentity = new WeakMap();
const stagedDisposal = new WeakMap();
const stagedCells = new WeakMap();
/** Full defrag transient allowance: copied bytes4096 + page/state/empty
 * collections256 + eight map capability records/closures128 each (including
 * identity) + default scratch128 + transient cell parse/view128. Admission
 * precedes construction; deterministic metadata policy, not native sizeof. */
const PRIVATE_DEFRAG_SCRATCH_CHARGE = 4096 + 1536;
export class PrivateIndexPage {
    bytes;
    #pgno;
    get pgno() { return this.#pgno; }
    #leaf;
    get leaf() { return this.#leaf; }
    get childPtrSize() { return this.#leaf ? 0 : 4; }
    get cellOffset() { return 8 + this.childPtrSize; }
    #nCell;
    get nCell() { return this.#nCell; }
    minLocal = 489;
    maxLocal = 1002;
    #nFree = -1;
    #scratch;
    #maxKeyBytes;
    #mutating = false;
    #written = false;
    #fault;
    constructor(pgno, bytes, scratch = { reserve(_bytes) { }, release(_bytes) { } }, maxKeyBytes = 0x7fffffff) {
        this.#scratch = scratch;
        this.#maxKeyBytes = maxKeyBytes;
        balanceDividerInsert.set(this, { insert: (index, cell, child, control) => { if (this.leaf)
                throw new Error("interior divider required"); return this.#insertCell(index, cell, control, child, true); } });
        balanceChildPointer.set(this, { publish: (offset, pgno, control) => this.#publishChild(offset, pgno, control) });
        balanceDivider.set(this, { take: (index, control, resident) => this.#takeDivider(index, control, resident) });
        balanceEditLifetime.set(this, { begin: () => { this.assertUsable(); if (this.#balanceLifetime)
                throw new Error("balance lifetime already held"); this.#balanceLifetime = true; }, finish: success => { this.#balanceLifetime = false; if (success)
                this.#consumeRetainedStaging(); } });
        balanceStaging.set(this, { count: () => this.#overflow.length, at: (slot) => { this.assertUsable(); const c = this.#overflow[slot]; if (!c)
                corrupt("invalid balance staged slot"); return c; } });
        stagedDisposal.set(this, () => this.#disposeStagedCells());
        stagedCells.set(this, { peek: () => { if (this.#overflow.length !== 1)
                throw new Error("single staged cell required"); return this.#overflow[0].bytes; }, take: () => {
                if (this.#overflow.length !== 1)
                    throw new Error("single staged cell required");
                const bytes = this.#overflow.pop().bytes;
                this.#scratch.removeEntries?.(1);
                this.#scratch.release(bytes.length + 64);
                this.#scratch.release(this.#inspectionBytes);
                this.#inspectionBytes = 0;
                return bytes;
            } });
        this.#pgno = pgno;
        pageIdentity.set(this, number => { this.#pgno = number; });
        this.bytes = bytes;
        if (bytes.length !== 4096)
            corrupt("private index page size");
        if (pgno < 2)
            corrupt("metadata page is not a private index root");
        const flags = bytes[0];
        if (flags !== 2 && flags !== 10)
            corrupt("unexpected private index page type");
        this.#leaf = flags === 10;
        this.#nCell = get2(bytes, 3);
        if (this.nCell > Math.floor((4096 - 8) / 6))
            corrupt("too many cells");
    }
    /** copyNodeContent8163, private hdrOffset0/autoVacuum=false branch.
     * Staged ownership is transferred separately by the root balance caller. */
    async copyNodeContent(source, control) { return this.#copyNodeContent(source, control); }
    async #copyNodeContent(source, control, heldSource = false) {
        this.assertUsable();
        source.assertUsable();
        if (source === this || (!heldSource && source.operationPending) || this.nOverflow)
            throw new Error("invalid node copy ownership");
        source.computeFreeSpace();
        const top = get2(source.bytes, 5), header = source.cellOffset + 2 * source.nCell;
        if (top < header || top > 4096)
            corrupt("invalid node copy range");
        this.#scratch.reserve(64);
        try {
            await this.#mutation(async () => {
                this.#written = false;
                await control.checkpoint(4096 - top + header);
                this.#written = true;
                this.bytes.set(source.bytes.subarray(top), top);
                this.bytes.set(source.bytes.subarray(0, header), 0);
                // Native btreeInitPage followed by btreeComputeFreeSpace. Do not copy
                // source cached nFree or its staged descriptors into destination.
                const flags = this.bytes[0];
                if (flags !== 2 && flags !== 10)
                    corrupt("unexpected copied page type");
                this.#leaf = flags === 10;
                this.#nCell = get2(this.bytes, 3);
                this.#nFree = -1;
                if (this.nCell > Math.floor((4096 - 8) / 6))
                    corrupt("too many copied cells");
                this.computeFreeSpace();
            });
        }
        finally {
            this.#scratch.release(64);
        }
    }
    /** balance_deeper physical owner after caller allocates child. Logical
     * entry reconciliation and arena admission remain caller responsibilities. */
    async deepenInto(child, control) {
        this.assertUsable();
        child.assertUsable();
        if (this.pgno !== 2 || child.pgno <= 2 || !this.nOverflow || child.nCell || child.nOverflow || child === this)
            throw new Error("invalid deeper ownership");
        // Stage charges must migrate within the same scratch accountant. Native
        // apOvfl buffers likewise belong to the shared BtShared operation.
        if (this.#scratch !== child.#scratch && (!this.#scratch.accountant || this.#scratch.accountant !== child.#scratch.accountant))
            throw new Error("deeper requires shared scratch ownership");
        this.#scratch.reserve(64);
        try {
            await this.#mutation(async () => {
                this.#written = false;
                await child.#copyNodeContent(this, control, true);
                // After copy, no await/cancellation until descriptor move and zeroPage
                // complete. Existing inspection copies stay with source for revocation.
                this.#written = true;
                child.#overflow = this.#overflow;
                this.#overflow = [];
                this.#scratch.release(this.#inspectionBytes);
                this.#inspectionBytes = 0;
                this.bytes.fill(0);
                this.bytes[0] = 2;
                put2(this.bytes, 5, 4096);
                put4(this.bytes, 8, child.pgno);
                this.#leaf = false;
                this.#nCell = 0;
                this.#nFree = 4084;
            });
        }
        finally {
            this.#scratch.release(64);
        }
    }
    findCell(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.nCell)
            corrupt("invalid cell index");
        const slot = this.cellOffset + 2 * index;
        if (slot + 2 > 4096)
            corrupt("cell slot outside page");
        return get2(this.bytes, slot) & 4095;
    }
    parseCell(index) {
        const offset = this.findCell(index);
        // btreeCellSizeCheck decrements the minimum four-byte bound once for
        // interior pages, not by the child-pointer width. Actual size is checked below.
        if (offset < this.cellOffset + 2 * this.nCell || offset > 4096 - 4 - (this.leaf ? 0 : 1))
            corrupt("cell outside content area");
        return this.parseCellBytes(this.bytes, offset);
    }
    /** xParseCell for an auxiliary fillInCell buffer as well as resident cells. */
    parseCellBytes(bytes, offset = 0) {
        const start = offset + this.childPtrSize;
        const v = decodeVarint(bytes, start);
        const nPayload = Number(v.value & 0xffffffffn), payloadOffset = start + v.length;
        let nLocal = nPayload;
        if (nPayload > this.maxLocal) {
            const surplus = this.minLocal + (nPayload - this.minLocal) % 4092;
            nLocal = surplus <= this.maxLocal ? surplus : this.minLocal;
        }
        const overflowOffset = nPayload > this.maxLocal ? payloadOffset + nLocal : null;
        const nSize = overflowOffset === null ? Math.max(4, payloadOffset - offset + nLocal) : payloadOffset - offset + nLocal + 4;
        if (offset + nSize > bytes.length)
            corrupt("cell extends beyond page");
        return { offset, payloadOffset, nPayload, nLocal, nSize, overflowOffset };
    }
    leftChild(index) { if (this.leaf)
        corrupt("leaf has no child"); return get4(this.bytes, this.findCell(index)); }
    rightChild() { if (this.leaf)
        corrupt("leaf has no right child"); return get4(this.bytes, 8); }
    /** btree.c:freeSpace. Foundational page-local mutation only; caller must
     * own the page exclusively. A failing mutation faults the derived page until
     * construction replacement/arena teardown; no operation rollback is promised. */
    freeSpace(start, size) {
        if (this.#mutating)
            throw new Error("private page operation in progress");
        if (this.#fault !== undefined)
            throw this.#fault;
        this.#scratch.begin?.();
        this.#mutating = true;
        try {
            this.#freeSpace(start, size);
        }
        catch (error) {
            this.#fault = error;
            this.#scratch.fault?.(error);
            throw error;
        }
        finally {
            this.#mutating = false;
            this.#scratch.end?.();
        }
    }
    #freeSpace(start, size) {
        if (!Number.isInteger(start) || !Number.isInteger(size) || size < 4 || start < this.cellOffset || start + size > 4096)
            corrupt("invalid freeSpace range");
        this.computeFreeSpace();
        const b = this.bytes, original = size;
        let ptr = 1, block = 0, fragments = 0, end = start + size;
        if (get2(b, 1) !== 0) {
            while ((block = get2(b, ptr)) < start) {
                if (block <= ptr) {
                    if (block === 0)
                        break;
                    corrupt("freeSpace nonascending blocks");
                }
                if (block > 4092)
                    corrupt("freeSpace block outside page");
                ptr = block;
            }
            if (block > 4092)
                corrupt("freeSpace block outside page");
            if (block && end + 3 >= block) {
                fragments = block - end;
                if (end > block)
                    corrupt("freeSpace overlaps next block");
                end = block + get2(b, block + 2);
                if (end > 4096)
                    corrupt("freeSpace block end outside page");
                size = end - start;
                block = get2(b, block);
            }
            if (ptr > 1) {
                const ptrEnd = ptr + get2(b, ptr + 2);
                if (ptrEnd + 3 >= start) {
                    if (ptrEnd > start)
                        corrupt("freeSpace overlaps prior block");
                    fragments += start - ptrEnd;
                    size = end - ptr;
                    start = ptr;
                }
            }
            if (fragments > b[7])
                corrupt("freeSpace fragments underflow");
            b[7] = b[7] - fragments;
        }
        const top = get2(b, 5);
        if (start <= top) {
            if (start < top || ptr !== 1)
                corrupt("freeSpace content boundary");
            put2(b, 1, block);
            put2(b, 5, end);
        }
        else {
            put2(b, ptr, start);
            put2(b, start, block);
            put2(b, start + 2, size);
        }
        this.#nFree += original;
    }
    assertUsable() { if (this.#fault !== undefined)
        throw this.#fault; }
    get operationPending() { return this.#mutating; }
    async #mutation(operation) {
        if (this.#mutating)
            throw new Error("private page operation in progress");
        if (this.#fault !== undefined)
            throw this.#fault;
        this.#scratch.begin?.();
        this.#mutating = true;
        this.#written = true;
        try {
            return await operation();
        }
        catch (error) {
            if (this.#written) {
                this.#fault = error; /* The operation has unwound: terminal cursor cleanup must be able to unref this page. */
                this.#mutating = false;
                this.#scratch.fault?.(error);
            }
            throw error;
        }
        finally {
            this.#mutating = false;
            this.#scratch.end?.();
        }
    }
    /** Native pageInsertArray: no defragmentation. false requests rebuild.
     * Raw edit prerequisite; caller owns safe slot range and ppData/header update. */
    async insertCellArray(cells, first, count, begin, state, slot, control) { return this.#insertCellArray(cells, first, count, begin, state, slot, control); }
    async #insertCellArray(cells, first, count, begin, state, slot, control, held = false) {
        if (!Number.isInteger(first) || !Number.isInteger(count) || first < 0 || count < 0 || first + count > cells.length || slot < this.cellOffset || slot + count * 2 > begin || begin > state.top || state.top > 4096)
            corrupt("invalid insert array range");
        return (held ? async (op) => op() : this.#mutation.bind(this))(async () => {
            if (!held)
                this.#written = false;
            let top = state.top;
            for (let i = first; i < first + count; i++) {
                await control.checkpoint(1);
                const c = cells[i], size = c.length;
                if (this.parseCellBytes(c).nSize !== size)
                    corrupt("invalid insert array cell extent");
                let offset = 0, address = 1, pc = get2(this.bytes, 1);
                // Native pageFindSlot: corruption/no slot requests rebuild at this
                // caller, unlike allocateSpace which defragments or raises corruption.
                while (pc && pc <= 4096 - size) {
                    await control.checkpoint(1);
                    if (pc > 4092)
                        break;
                    const excess = get2(this.bytes, pc + 2) - size;
                    if (excess >= 0) {
                        if (excess < 4) {
                            if (this.bytes[7] > 57)
                                break;
                            this.#written = true;
                            put2(this.bytes, address, get2(this.bytes, pc));
                            this.bytes[7] += excess;
                            offset = pc;
                        }
                        else {
                            if (pc + excess > 4096 - size)
                                break;
                            this.#written = true;
                            put2(this.bytes, pc + 2, excess);
                            offset = pc + excess;
                        }
                        break;
                    }
                    address = pc;
                    pc = get2(this.bytes, pc);
                    if (pc <= address)
                        break;
                }
                if (!offset) {
                    if (top - begin < size)
                        return false;
                    top -= size;
                    offset = top;
                }
                this.#written = true;
                this.bytes.set(c, offset);
                put2(this.bytes, slot, offset);
                slot += 2;
            }
            state.top = top;
            this.#nFree = -1;
            return true;
        });
    }
    /** Native editPage resident branch, one admission across free/insert/fallback.
     * Only staged entries retained here may be consumed without a transit owner. */
    async editCells(cells, oldFirst, newFirst, newCount, control) {
        // Without a cross-page transit owner this raw seam can consume only
        // staged entries retained here. Never silently destroy displaced ownership.
        for (const c of this.#overflow) {
            if (!this.#balanceLifetime && (oldFirst + c.index < newFirst || oldFirst + c.index >= newFirst + newCount))
                throw new Error("displaced staging requires conserving balance owner");
            if (cells[oldFirst + c.index] !== c.bytes)
                throw new Error("edit requires owned staged CellArray descriptor");
        }
        if (!Number.isInteger(oldFirst) || !Number.isInteger(newFirst) || !Number.isInteger(newCount) || oldFirst < 0 || newFirst < 0 || newCount < 0 || newFirst + newCount > cells.length || oldFirst + this.nCell > cells.length)
            corrupt("invalid edit range");
        // State descriptor charge survives helper scratch/fallback allocation peaks.
        this.#scratch.reserve(64);
        try {
            await this.#mutation(async () => {
                this.#written = false;
                let count = this.nCell;
                const oldEnd = oldFirst + count + this.nOverflow, newEnd = newFirst + newCount, b = this.bytes;
                if (oldFirst < newFirst) {
                    const shift = await this.#freeCellArray(cells, oldFirst, newFirst - oldFirst, control, true);
                    if (shift > count)
                        corrupt("edit prefix exceeds resident count");
                    if (shift)
                        this.#written = true;
                    b.copyWithin(this.cellOffset, this.cellOffset + shift * 2, this.cellOffset + shift * 2 + count * 2);
                    count -= shift;
                }
                if (newEnd < oldEnd) {
                    count -= await this.#freeCellArray(cells, newEnd, oldEnd - newEnd, control, true);
                    if (count < 0)
                        corrupt("edit tail exceeds resident count");
                }
                const state = { top: get2(b, 5) }, begin = this.cellOffset + newCount * 2;
                let fit = state.top >= begin && state.top <= 4096;
                if (fit && newFirst < oldFirst) {
                    const add = Math.min(newCount, oldFirst - newFirst);
                    if (add && count)
                        this.#written = true;
                    b.copyWithin(this.cellOffset + add * 2, this.cellOffset, this.cellOffset + count * 2);
                    fit = await this.#insertCellArray(cells, newFirst, add, begin, state, this.cellOffset, control, true);
                    count += add;
                }
                for (let i = 0; fit && i < this.nOverflow; i++) {
                    const index = oldFirst + this.#overflow[i].index - newFirst, slot = this.cellOffset + index * 2;
                    if (index < 0 || index >= newCount)
                        continue;
                    await control.checkpoint(1);
                    if (count > index) {
                        this.#written = true;
                        b.copyWithin(slot + 2, slot, slot + (count - index) * 2);
                    }
                    count++;
                    fit = await this.#insertCellArray(cells, index + newFirst, 1, begin, state, slot, control, true);
                }
                if (fit)
                    fit = await this.#insertCellArray(cells, newFirst + count, newCount - count, begin, state, this.cellOffset + count * 2, control, true);
                if (!fit) {
                    await this.#rebuildCells(cells, newFirst, newCount, control, true);
                    this.#consumeRetainedStaging();
                    return;
                }
                this.#written = true;
                this.#nCell = newCount;
                put2(b, 3, newCount);
                put2(b, 5, state.top);
                this.#nFree = -1;
                this.#consumeRetainedStaging();
            });
        }
        finally {
            this.#scratch.release(64);
        }
    }
    /** Native pageFreeArray. Frees only destination-resident CellArray ranges;
     * slots/count and overflow/entry authority remain the edit caller's job. */
    async freeCellArray(cells, first, count, control) { return this.#freeCellArray(cells, first, count, control); }
    async #freeCellArray(cells, first, count, control, held = false) {
        this.assertUsable();
        if (!Number.isInteger(first) || !Number.isInteger(count) || first < 0 || count < 0 || first + count > cells.length)
            corrupt("invalid free array range");
        this.#scratch.reserve(256);
        try {
            return await (held ? async (op) => op() : this.#mutation.bind(this))(async () => {
                if (!held)
                    this.#written = false;
                const offsets = new Array(10), ends = new Array(10);
                let nFree = 0, nRet = 0;
                this.computeFreeSpace();
                for (let i = first; i < first + count; i++) {
                    await control.checkpoint(1);
                    const c = cells[i];
                    if (c.buffer !== this.bytes.buffer)
                        continue;
                    const offset = c.byteOffset - this.bytes.byteOffset;
                    if (offset < this.cellOffset || offset >= 4096)
                        continue;
                    const after = offset + c.length;
                    let j = 0;
                    for (; j < nFree; j++) {
                        if (offsets[j] === after) {
                            offsets[j] = offset;
                            break;
                        }
                        if (ends[j] === offset) {
                            ends[j] = after;
                            break;
                        }
                    }
                    if (j >= nFree) {
                        if (nFree >= 10) {
                            for (let k = 0; k < nFree; k++) {
                                this.#written = true;
                                this.#freeSpace(offsets[k], ends[k] - offsets[k]);
                            }
                            nFree = 0;
                        }
                        offsets[nFree] = offset;
                        ends[nFree] = after;
                        if (after > 4096)
                            return 0;
                        nFree++;
                    }
                    nRet++;
                }
                for (let j = 0; j < nFree; j++) {
                    this.#written = true;
                    this.#freeSpace(offsets[j], ends[j] - offsets[j]);
                }
                return nRet;
            });
        }
        finally {
            this.#scratch.release(256);
        }
    }
    /** Native rebuildPage fallback, private raw page prerequisite only.
     * Caller owns CellArray and cross-page edit dependency order. Staging disposal
     * requires conserving transit authority and is not admitted by this seam. */
    async rebuildCells(cells, first, count, control) { return this.#rebuildCells(cells, first, count, control); }
    async #rebuildCells(cells, first, count, control, held = false) {
        this.assertUsable();
        if (this.#mutating && !held)
            throw new Error("private page operation in progress");
        if (this.nOverflow && !held)
            throw new Error("rebuild staging requires balance transit owner");
        if (!Number.isInteger(first) || !Number.isInteger(count) || first < 0 || count < 1 || first + count > cells.length)
            corrupt("invalid rebuild range");
        this.#scratch.reserve(4096 + 64);
        try {
            // Native pager temp-space preserves the original content suffix, not a
            // separately sorted/copied list of logical keys.
            let start = get2(this.bytes, 5);
            if (start > 4096)
                start = 0;
            await control.checkpoint(4096 - start);
            const temp = new Uint8Array(4096);
            temp.set(this.bytes.subarray(start), start);
            let top = 4096;
            // Validate capacity before publication; each view carries its own source
            // extent in this browser representation rather than native apEnd pointers.
            for (let i = first; i < first + count; i++) {
                await control.checkpoint(1);
                const c = cells[i];
                if (c.length !== this.parseCellBytes(c).nSize)
                    corrupt("invalid rebuild cell extent");
                top -= c.length;
                if (top < this.cellOffset + count * 2)
                    corrupt("rebuild cells exceed page");
            }
            await (held ? async (op) => op() : this.#mutation.bind(this))(async () => {
                if (!held)
                    this.#written = false;
                top = 4096;
                for (let i = first; i < first + count; i++) {
                    await control.checkpoint(1);
                    let c = cells[i];
                    if (c.buffer === this.bytes.buffer) {
                        const offset = c.byteOffset - this.bytes.byteOffset;
                        if (offset < start || offset + c.length > 4096)
                            corrupt("rebuild resident source outside content");
                        c = temp.subarray(offset, offset + c.length);
                    }
                    this.#written = true;
                    top -= c.length;
                    put2(this.bytes, this.cellOffset + 2 * (i - first), top);
                    this.bytes.set(c, top);
                }
                this.#nCell = count;
                put2(this.bytes, 1, 0);
                put2(this.bytes, 3, count);
                put2(this.bytes, 5, top);
                this.bytes[7] = 0;
                this.#nFree = -1;
            });
        }
        finally {
            this.#scratch.release(4096 + 64);
        }
    }
    /** btree.c:dropCell. Only removes the resident cell/slot; overflow ownership
     * must already have been transferred or cleared by the caller. */
    async dropCell(index, size, control) {
        return this.#dropCell(index, size, control);
    }
    async #dropCell(index, size, control, conserving = false) {
        return this.#mutation(async () => {
            this.computeFreeSpace();
            if (!Number.isInteger(index) || index < 0 || index >= this.nCell || !Number.isInteger(size) || size < 4)
                corrupt("invalid drop cell");
            const b = this.bytes, slot = this.cellOffset + 2 * index, pc = get2(b, slot);
            if (pc + size > 4096)
                corrupt("drop cell extends beyond page");
            // Checkpoint before native atomic freeSpace/slot mutation; the bounded
            // pointer memmove is at most one page. No suspension inside publication.
            await control.checkpoint(size + 2 * (this.nCell - 1 - index));
            this.#written = true;
            this.#freeSpace(pc, size);
            this.#nCell--;
            if (!conserving)
                this.#scratch.removeEntries?.(1);
            if (this.nCell === 0) {
                b.fill(0, 1, 5);
                b[7] = 0;
                put2(b, 5, 4096);
                this.#nFree = 4096 - this.childPtrSize - 8;
            }
            else {
                b.copyWithin(slot, slot + 2, slot + 2 + 2 * (this.nCell - index));
                put2(b, 3, this.nCell);
                this.#nFree += 2;
            }
        });
    }
    async #publishChild(offset, pgno, control) {
        this.assertUsable();
        if (this.leaf || !Number.isInteger(pgno) || pgno < 3 || pgno > 0xffffffff || pgno === 262145)
            corrupt("invalid balance child pointer");
        let valid = offset === 8;
        if (!valid)
            for (let i = 0; i < this.nCell; i++)
                if (this.findCell(i) === offset) {
                    valid = true;
                    break;
                }
        if (!valid)
            corrupt("balance pointer does not address resident child");
        await this.#mutation(async () => {
            this.#written = false;
            await control.checkpoint(4);
            this.#written = true;
            put4(this.bytes, offset, pgno);
        });
    }
    async #takeDivider(index, control, resident = false) {
        this.assertUsable();
        if (this.leaf)
            throw new Error("interior divider required");
        if (this.nOverflow && !resident) {
            // Native parent has at most one pending divider at iParentIdx. Transfer
            // descriptor and already charged bytes; do not destroy logical admission.
            if (this.nOverflow !== 1 || this.#overflow[0].index !== index)
                throw new Error("pending divider must match logical index");
            this.#scratch.reserve(64);
            let retained = false;
            try {
                const bytes = this.#overflow[0].bytes;
                await this.#mutation(async () => {
                    this.#written = false;
                    await control.checkpoint(1);
                    this.#written = true;
                    this.#overflow = [];
                    this.#scratch.release(64);
                    this.#scratch.release(this.#inspectionBytes);
                    this.#inspectionBytes = 0;
                });
                let released = false;
                const result = { bytes, release: () => { if (!released) {
                        released = true;
                        this.#scratch.release(64 + bytes.length);
                    } } };
                retained = true;
                return result;
            }
            finally {
                if (!retained)
                    this.#scratch.release(64);
            }
        }
        const info = this.parseCell(index), charge = 64 + info.nSize;
        this.#scratch.reserve(charge);
        let retained = false;
        try {
            const bytes = this.bytes.slice(info.offset, info.offset + info.nSize);
            await this.#dropCell(index, info.nSize, control, true);
            let released = false;
            const result = { bytes, release: () => { if (!released) {
                    released = true;
                    this.#scratch.release(charge);
                } } };
            retained = true;
            return result;
        }
        finally {
            if (!retained)
                this.#scratch.release(charge);
        }
    }
    #overflow = [];
    get nOverflow() { return this.#overflow.length; }
    #inspectionBytes = 0;
    /** Inspection returns an independent value copy. Published copy capacities
     * remain page-owned until staging teardown; no GC or implicit lease refund. */
    overflowCell(slot) {
        this.assertUsable();
        const cell = this.#overflow[slot];
        if (!cell)
            corrupt("invalid overflow slot");
        const charge = cell.bytes.length + PRIVATE_STAGED_INSPECTION_CHARGE;
        this.#scratch.reserve(charge);
        try {
            const result = { index: cell.index, bytes: cell.bytes.slice() };
            this.#inspectionBytes += charge;
            return result;
        }
        catch (error) {
            this.#scratch.release(charge);
            throw error;
        }
    }
    /** External staging teardown obeys the same exclusive admission as edits.
     * Internal reset/disposal uses the private bridge without fresh admission. */
    releaseStagedCells() {
        if (this.#mutating)
            throw new Error("private page operation in progress");
        this.assertUsable();
        this.#scratch.begin?.();
        this.#mutating = true;
        try {
            this.#disposeStagedCells();
        }
        finally {
            this.#mutating = false;
            this.#scratch.end?.();
        }
    }
    #balanceLifetime = false;
    #consumeRetainedStaging() {
        if (this.#balanceLifetime)
            return;
        // Each staged entry now resides in this page. Refund physical scratch,
        // not logical entries (unlike abandonment/destruction).
        for (const c of this.#overflow)
            this.#scratch.release(c.bytes.length + 64);
        this.#scratch.release(this.#inspectionBytes);
        this.#inspectionBytes = 0;
        this.#overflow = [];
    }
    #disposeStagedCells() {
        this.#scratch.release(this.#inspectionBytes);
        this.#inspectionBytes = 0;
        for (const cell of this.#overflow)
            this.#scratch.release(cell.bytes.length + 64);
        this.#scratch.removeEntries?.(this.#overflow.length);
        this.#overflow = [];
    }
    /** insertCellFast when child=0; insertCell for interior divider replacement.
     * Owned copy is the private analogue of pTemp; stage order follows aiOvfl. */
    async insertCell(index, cell, control, child = 0) { return this.#insertCell(index, cell, control, child); }
    async #insertCell(index, cell, control, child = 0, conserving = false) {
        if (this.#mutating)
            throw new Error("private page operation in progress");
        this.assertUsable();
        // Project admission covers caller-built cells too, before native mutation.
        // Rejecting an oversized payload has published nothing and is retryable.
        if (this.parseCellBytes(cell).nPayload > this.#maxKeyBytes)
            throw new PrivateStateLimitError("private index key exceeds byte limit");
        const cancelEntry = conserving ? undefined : this.#scratch.admitEntry?.();
        let published = false;
        try {
            return await this.#mutation(async () => {
                this.#written = false;
                const size = cell.length, free = this.computeFreeSpace();
                if (!Number.isInteger(index) || index < 0 || index > this.nCell + this.nOverflow)
                    corrupt("invalid insert cell index");
                if (this.parseCellBytes(cell).nSize !== size)
                    corrupt("invalid insert cell size");
                if (!Number.isInteger(child) || child < 0 || child > 0xffffffff || (child !== 0 && this.leaf))
                    corrupt("invalid insert child");
                const staged = this.nOverflow > 0 || size + 2 > free;
                if (staged) {
                    const prior = this.#overflow[this.nOverflow - 1];
                    if (this.nOverflow >= 3 || (prior && index !== prior.index + 1))
                        corrupt("invalid ordered overflow staging");
                }
                // Pending descriptor survives publication independently of page metadata.
                const copyCharge = size + (staged ? 64 : 0);
                this.#scratch.reserve(copyCharge);
                let keep = false;
                try {
                    // A local cell is <=page-size. Snapshot before the first suspension,
                    // charging its peak capacity; no borrowed input survives a checkpoint.
                    control.snapshotCheckpoint?.(0);
                    const copy = cell.slice();
                    if (child)
                        put4(copy, 0, child);
                    control.snapshotCheckpoint?.(size);
                    await control.checkpoint(size);
                    if (staged) {
                        this.#overflow.push({ index, bytes: copy });
                        keep = true;
                        published = true;
                        return;
                    }
                    this.#written = true;
                    const offset = await this.#allocateSpace(size, control), b = this.bytes;
                    await control.checkpoint(size + 2 * (this.nCell - index));
                    this.#nFree -= size + 2;
                    if (child) {
                        b.set(copy.subarray(4), offset + 4);
                        put4(b, offset, child);
                    }
                    else
                        b.set(copy, offset);
                    const slot = this.cellOffset + 2 * index;
                    b.copyWithin(slot + 2, slot, this.cellOffset + 2 * this.nCell);
                    put2(b, slot, offset);
                    this.#nCell++;
                    b[4] = (b[4] + 1) & 255;
                    if (b[4] === 0)
                        b[3] = b[3] + 1;
                    published = true;
                }
                finally {
                    if (!keep)
                        this.#scratch.release(copyCharge);
                }
            });
        }
        finally {
            if (!published)
                cancelEntry?.();
        }
    }
    async allocateSpace(size, control) {
        return this.#mutation(() => this.#allocateSpace(size, control));
    }
    async #allocateSpace(size, control) {
        const free = this.computeFreeSpace(), b = this.bytes, gap = this.cellOffset + 2 * this.nCell;
        if (!Number.isInteger(size) || size < 0 || size >= 4088 || free < size)
            corrupt("invalid page allocation size");
        let top = get2(b, 5);
        if (gap > top || top > 4096)
            corrupt("invalid allocation content boundary");
        await control.checkpoint(0);
        if (get2(b, 1) && gap + 2 <= top) {
            let address = 1, pc = get2(b, 1);
            const maximum = 4096 - size;
            while (pc <= maximum) {
                await control.checkpoint(1);
                const excess = get2(b, pc + 2) - size;
                if (excess >= 0) {
                    if (excess < 4) {
                        if (b[7] > 57)
                            break;
                        put2(b, address, get2(b, pc));
                        b[7] = b[7] + excess;
                        return pc;
                    }
                    if (excess + pc > maximum)
                        corrupt("allocation freeblock extends past page");
                    put2(b, pc + 2, excess);
                    if (pc + excess <= gap)
                        corrupt("allocation within slots");
                    return pc + excess;
                }
                address = pc;
                pc = get2(b, pc);
                if (pc <= address) {
                    if (pc)
                        corrupt("allocation nonascending freeblocks");
                    break;
                }
            }
            if (pc > 4092)
                corrupt("allocation freeblock outside page");
        }
        if (gap + 2 + size > top) {
            await this.#defrag(Math.min(4, free - (2 + size)), control);
            top = get2(b, 5);
            if (gap + 2 + size > top)
                corrupt("allocation insufficient space after defrag");
        }
        top -= size;
        put2(b, 5, top);
        return top;
        // Native caller, not allocateSpace, debits nFree and publishes cell slot.
    }
    async defragmentPage(maxFragments, control) { return this.#mutation(() => this.#defrag(maxFragments, control)); }
    async #defrag(maxFragments, control) {
        const free = this.computeFreeSpace(), b = this.bytes, first = this.cellOffset + 2 * this.nCell;
        let boundary = 4096, fast = false;
        if (b[7] <= maxFragments) {
            const block = get2(b, 1);
            if (block > 4092)
                corrupt("defrag block outside page");
            if (block) {
                const second = get2(b, block);
                if (second > 4092)
                    corrupt("defrag second block outside page");
                if (second === 0 || get2(b, second) === 0) {
                    let size = get2(b, block + 2), size2 = 0;
                    const top = get2(b, 5);
                    if (top >= block)
                        corrupt("defrag top overlaps block");
                    if (second) {
                        if (block + size > second)
                            corrupt("defrag blocks overlap");
                        size2 = get2(b, second + 2);
                        if (second + size2 > 4096)
                            corrupt("defrag second block end");
                        await control.checkpoint(second - (block + size));
                        b.copyWithin(block + size + size2, block + size, second);
                        size += size2;
                    }
                    else if (block + size > 4096)
                        corrupt("defrag block end");
                    boundary = top + size;
                    await control.checkpoint(block - top);
                    b.copyWithin(boundary, top, block);
                    for (let slot = this.cellOffset; slot < first; slot += 2) {
                        await control.checkpoint(1);
                        const pc = get2(b, slot);
                        if (pc < block)
                            put2(b, slot, pc + size);
                        else if (pc < second)
                            put2(b, slot, pc + size2);
                    }
                    fast = true;
                }
            }
        }
        if (!fast) {
            if (this.nCell) {
                this.#scratch.reserve(PRIVATE_DEFRAG_SCRATCH_CHARGE);
                try {
                    await control.checkpoint(4096);
                    const temp = b.slice(), source = new _a(this.pgno, temp);
                    const start = get2(b, 5);
                    for (let i = 0; i < this.nCell; i++) {
                        const pc = get2(b, this.cellOffset + 2 * i);
                        if (pc > 4092)
                            corrupt("defrag cell outside page");
                        const size = source.parseCell(i).nSize;
                        boundary -= size;
                        if (boundary < start || pc + size > 4096)
                            corrupt("defrag content overrun");
                        await control.checkpoint(size);
                        put2(b, this.cellOffset + 2 * i, boundary);
                        b.set(temp.subarray(pc, pc + size), boundary);
                    }
                }
                finally {
                    this.#scratch.release(PRIVATE_DEFRAG_SCRATCH_CHARGE);
                }
            }
            b[7] = 0;
        }
        if (b[7] + boundary - first !== free)
            corrupt("defrag free-space mismatch");
        put2(b, 5, boundary);
        put2(b, 1, 0);
        await control.checkpoint(boundary - first);
        b.fill(0, first, boundary);
    }
    computeFreeSpace() {
        if (this.#nFree >= 0)
            return this.#nFree;
        const b = this.bytes, top = get2(b, 5) || 65536, first = this.cellOffset + 2 * this.nCell;
        let pc = get2(b, 1), nFree = b[7] + top;
        if (pc > 0) {
            if (pc < top)
                corrupt("freeblock before content area");
            for (;;) {
                if (pc > 4092)
                    corrupt("freeblock beyond page");
                const next = get2(b, pc), size = get2(b, pc + 2);
                if (size < 4)
                    corrupt("small freeblock");
                nFree += size;
                if (next < pc + size + 4) {
                    if (next > 0)
                        corrupt("freeblocks not ascending");
                    if (pc + size > 4096)
                        corrupt("freeblock extends beyond page");
                    break;
                }
                pc = next;
            }
        }
        if (nFree > 4096 || nFree < first)
            corrupt("invalid free space");
        this.#nFree = nFree - first;
        return this.#nFree;
    }
}
_a = PrivateIndexPage;
/** Nonroot control capacity: six array headers64 + at most40 reference slots8,
 * five identity records64 + nine terminal cleanup descriptors64 + control128.
 * Bounds: old<=3/new<=5, fresh<=4, entries<=9, cleanup<=9. This conservative
 * deterministic allowance is not JS heap measurement/native sizeof parity.
 * Separate gather/partition/rekey/edit/lease charges overlap this lifetime. */
export const PRIVATE_NONROOT_CONTROL_CHARGE = 1792;
/** A lease is one explicit acquisition, not another physical buffer charge. */
export class PrivatePageLease {
    #released = false;
    #page;
    #view;
    #release;
    constructor(page, release, admitCapability) {
        this.#page = page;
        this.#release = release;
        // MemPage remains shared derived metadata. The acquisition capability does
        // not: each view is permanently revoked by its corresponding PagerUnref.
        // Recheck at invocation as well as lookup so captured methods cannot escape.
        const live = () => { if (this.#released)
            throw new Error("private page lease released"); };
        const bytes = borrowedBytes(page.bytes, live, admitCapability);
        // Included in the acquisition allowance. Bound even nonstandard prototype
        // properties so repeated lookups cannot grow retained closures indefinitely.
        const methods = new Map();
        const readonly = () => { live(); throw new Error("private page capability is readonly"); };
        this.#view = new Proxy(page, { get: (target, key) => {
                live();
                if (key === "bytes")
                    return bytes;
                // Do not bind Object.prototype.valueOf (which would export target), or
                // expose mutable prototype/constructor authority through inspection.
                if (key === "__proto__" || key === "constructor")
                    return undefined;
                if (!Object.hasOwn(target, key) && !Object.hasOwn(PrivateIndexPage.prototype, key))
                    return undefined;
                const value = Reflect.get(target, key, target);
                if (typeof value !== "function")
                    return value;
                const old = methods.get(key);
                if (old)
                    return old;
                if (methods.size >= 32)
                    throw new PrivateStateLimitError("private page method capability limit");
                const method = (...args) => {
                    try {
                        live();
                    }
                    catch (error) {
                        if (value.constructor.name === "AsyncFunction")
                            return Promise.reject(error);
                        throw error;
                    }
                    return Reflect.apply(value, target, args);
                };
                methods.set(key, method);
                return method;
            }, set: readonly, defineProperty: readonly, deleteProperty: readonly,
            setPrototypeOf: readonly, preventExtensions: readonly,
            has: (target, key) => { live(); return Reflect.has(target, key); },
            ownKeys: target => { live(); return Reflect.ownKeys(target); },
            isExtensible: target => { live(); return Reflect.isExtensible(target); },
            getPrototypeOf: () => { live(); return null; },
            getOwnPropertyDescriptor: (target, key) => {
                live();
                const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
                // The underlying configurable fields are inspection scalars, except
                // bytes: reflection must return the same revocable readonly alias.
                if (descriptor && key === "bytes")
                    return { ...descriptor, value: bytes, writable: false };
                return descriptor ? { ...descriptor, writable: false } : undefined;
            } });
    }
    get page() { if (this.#released)
        throw new Error("private page lease released"); return this.#view; }
    release() { if (this.#released)
        return; if (this.#page.operationPending)
        throw new Error("private page operation in progress"); this.#released = true; this.#release(); }
}
// This bridge and its identity tokens are never exported.
const operations = new WeakMap();
const cursors = new WeakMap();
export class PrivateBlobkeyPages {
    root = 2;
    autoVacuum = false;
    pageSize = 4096;
    #budget;
    #hook;
    #maxKeyBytes;
    #transit = 0;
    #registry = new Set();
    #single = false;
    #results = new Set();
    #maxEntries;
    #pages = new Map();
    #closed = false;
    #epoch = 0;
    #busy = false;
    #operation = null;
    #fault;
    constructor(budget, hook, maxKeyBytes, maxEntries) {
        if (!Number.isSafeInteger(maxKeyBytes) || maxKeyBytes < 0)
            throw new PrivateStateLimitError("invalid private key byte limit");
        if (!Number.isSafeInteger(maxEntries) || maxEntries < 0)
            throw new PrivateStateLimitError("invalid private entry limit");
        operations.set(this, { begin: cleanup => this.#begin(cleanup), end: t => this.#end(t), acquire: (t, p) => { this.#check(t); return this.#acquire(p); }, raw: (t, p) => { this.#check(t); return this.#raw(p, false); }, register: (c, o) => this.#registerCursor(c, o), unlink: c => this.#unregisterCursor(c), checkClose: () => this.#assertCursorClose(), insertLocal: (t, p, i, k, c, r, b) => { this.#check(t); return this.#insertLocal(t, p, i, k, c, r, b); }, fault: (t, e) => { this.#check(t); this.#trip(e); }, balance: (t, p, i, c) => this.#balancePath(p, i, false, c, t), bytes: (t, p) => { this.#check(t); const entry = this.#pages.get(p); if (!entry)
                throw new PrivateBlobkeyFormatError("cursor page outside arena"); return entry.bytes; }, savePeers: async (t, w, c) => { this.#check(t); for (const peer of this.#registry)
                if (peer !== w)
                    await cursors.get(peer).save(t, c); this.#assertCursorClose(); }, overwrite: (t, p, i, k, c) => { this.#check(t); return this.#overwritePayload(p, i, k, c); } });
        this.#maxEntries = maxEntries;
        budget.reserve(PRIVATE_ARENA_CHARGE);
        this.#budget = budget;
        this.#hook = hook;
        this.#maxKeyBytes = maxKeyBytes;
    }
    static async open(budget, control, hook = () => { }, limits = { maxKeyBytes: 0x7fffffff }) {
        const arena = new PrivateBlobkeyPages(budget, hook, limits.maxKeyBytes, limits.maxEntries ?? Number.MAX_SAFE_INTEGER);
        try {
            await control.checkpoint(0);
            arena.#append(1);
            const p1 = arena.#pages.get(1).bytes;
            p1.set(new TextEncoder().encode("SQLite format 3\0"));
            p1[16] = 16;
            p1[18] = 1;
            p1[19] = 1;
            p1[21] = 64;
            p1[22] = 32;
            p1[23] = 32;
            p1[100] = 13;
            put2(p1, 105, 4096);
            put4(p1, 28, 1);
            await control.checkpoint(4096);
            await control.checkpoint(0);
            // Native append writes count before getUnused/write. On failure this private
            // prepublication arena is discarded; no per-operation rollback parity claim.
            put4(p1, 28, 2);
            arena.#append(2);
            const root = arena.#pages.get(2).bytes;
            root[0] = 10;
            put2(root, 5, 4096);
            await control.checkpoint(4096);
            return arena;
        }
        catch (error) {
            arena.close();
            throw error;
        }
    }
    #append(pgno) {
        this.#hook("allocate", pgno);
        this.#budget.reserve(PRIVATE_PAGE_CHARGE);
        try {
            this.#pages.set(pgno, { bytes: new Uint8Array(4096), refs: 0, derived: null, entries: 0 });
        }
        catch (error) {
            this.#budget.release(PRIVATE_PAGE_CHARGE);
            throw error;
        }
    }
    #begin(cleanup = false) { if (!cleanup)
        this.#live(); if (this.#busy)
        throw new Error("private arena operation in progress"); this.#busy = true; return this.#operation = {}; }
    #check(t) { if (t !== this.#operation || !this.#busy)
        throw new Error("invalid arena operation token"); }
    #end(t) { this.#check(t); this.#operation = null; this.#busy = false; }
    get epoch() { return this.#epoch; }
    get pageCount() { return this.#pages.size; }
    referenceCount(pgno) { return this.#pages.get(pgno)?.refs ?? 0; }
    #live() { if (this.#closed)
        throw new Error("private page arena closed"); if (this.#fault !== undefined)
        throw this.#fault; }
    acquire(pgno) {
        const t = this.#begin();
        try {
            return this.#acquire(pgno);
        }
        finally {
            this.#end(t);
        }
    }
    #acquire(pgno) {
        this.#hook("acquire", pgno);
        const entry = this.#pages.get(pgno);
        if (!entry)
            throw new PrivateBlobkeyFormatError("private page number outside arena");
        if (entry.derived?.operationPending)
            throw new Error("private page operation in progress");
        this.#budget.reserve(PRIVATE_LEASE_CHARGE);
        entry.refs++;
        let capabilityBytes = 0;
        const admitCapability = (charge) => { this.#budget.reserve(charge); capabilityBytes += charge; return () => { capabilityBytes -= charge; this.#budget.release(charge); }; };
        const release = () => this.#cleanupRelease(() => {
            entry.refs--;
            this.#budget.release(PRIVATE_LEASE_CHARGE + capabilityBytes);
            capabilityBytes = 0;
            this.#hook("release", pgno);
        });
        try {
            this.#hook("init", pgno);
            if (!entry.derived)
                entry.derived = new PrivateIndexPage(pgno, entry.bytes, { accountant: this.#budget, reserve: bytes => this.#budget.reserve(bytes), release: bytes => this.#budget.release(bytes), begin: () => { if (entry.refs !== 1)
                        throw new Error("private mutation requires exclusive lease"); if (entry.editToken)
                        this.#check(entry.editToken);
                    else
                        this.#begin(); }, end: () => { this.#epoch++; if (!entry.editToken)
                        this.#end(this.#operation); }, fault: error => this.#trip(error), admitEntry: () => this.#newEntry(entry), removeEntries: count => { entry.entries -= count; } }, this.#maxKeyBytes);
            entry.derived.assertUsable();
            return new PrivatePageLease(entry.derived, release, admitCapability);
        }
        catch (error) {
            try {
                release();
            }
            catch { /* primary init failure wins */ }
            throw error;
        }
    }
    /** Raw overflow pages bypass index-page initialization, as PagerGet in accessPayload. */
    acquireRaw(pgno) {
        const t = this.#begin();
        try {
            return this.#raw(pgno, false);
        }
        finally {
            this.#end(t);
        }
    }
    // Private helpers alone may request raw write storage. External acquisitions
    // explicitly request readonly inspection; observer views always stay readonly.
    #raw(pgno, writable = true) {
        this.#hook("acquire", pgno);
        return this.#retainRaw(pgno, writable);
    }
    #retainRaw(pgno, writable = true) {
        const entry = this.#pages.get(pgno);
        if (!entry || pgno < 2)
            throw new PrivateBlobkeyFormatError("raw page number outside arena");
        this.#budget.reserve(PRIVATE_LEASE_CHARGE);
        entry.refs++;
        let released = false;
        let capabilityBytes = 0;
        const admitCapability = (charge) => { this.#budget.reserve(charge); capabilityBytes += charge; return () => { capabilityBytes -= charge; this.#budget.release(charge); }; };
        const release = () => {
            if (released)
                return;
            this.#cleanupRelease(() => {
                released = true;
                entry.refs--;
                this.#budget.release(PRIVATE_LEASE_CHARGE + capabilityBytes);
                capabilityBytes = 0;
                this.#observeRelease(pgno, entry.bytes);
            });
        };
        try {
            const bytes = writable ? entry.bytes : borrowedBytes(entry.bytes, () => { if (released)
                throw new Error("private raw lease released"); }, admitCapability);
            return { pgno, bytes, release };
        }
        catch (error) {
            try {
                release();
            }
            catch { /* primary capability creation failure wins */ }
            throw error;
        }
    }
    /** Mandatory unref cleanup is nonallocating and noncancellable. Internal
     * unrefs nest under the held token; external observers hold exclusion through
     * revocation/refund and hook cleanup, including when the arena is FAULT. */
    #cleanupRelease(operation) {
        const t = this.#busy ? null : this.#begin(true);
        try {
            operation();
        }
        finally {
            if (t)
                this.#end(t);
        }
    }
    #observeRelease(pgno, bytes) {
        let active = true, capabilityBytes = 0;
        const admitCapability = (charge) => { this.#budget.reserve(charge); capabilityBytes += charge; return () => { capabilityBytes -= charge; this.#budget.release(charge); }; };
        try {
            this.#hook("release", pgno, borrowedBytes(bytes, () => { if (!active)
                throw new Error("private observer released"); }, admitCapability));
        }
        finally {
            active = false;
            this.#budget.release(capabilityBytes);
        }
    }
    async #arenaMutation(operation) {
        this.#live();
        if (this.#busy)
            throw new Error("private arena operation in progress");
        for (const p of this.#pages.values())
            if (p.refs)
                throw new Error("private arena mutation requires no leases");
        const t = this.#begin();
        try {
            return await operation();
        }
        catch (error) {
            this.#trip(error);
            throw error;
        }
        finally {
            this.#end(t);
            this.#epoch++;
        }
    }
    /** Nonroot balance's shallower branch8957: defrag/copy/free single child. */
    async shallowRoot(control) {
        const t = this.#begin();
        let root = null, child = null, primary, started = false;
        try {
            for (const c of this.#registry)
                await cursors.get(c).save(t, control);
            for (const p of this.#pages.values())
                if (p.refs)
                    throw new Error("private shallower requires no foreign leases");
            root = this.#acquire(2);
            const source = this.#pages.get(2), page = source.derived;
            if (page.leaf || page.nCell || page.nOverflow)
                throw new Error("shallower requires empty interior root");
            const number = page.rightChild();
            if (number <= 2)
                corrupt("invalid shallower child");
            child = this.#acquire(number);
            const entry = this.#pages.get(number);
            if (entry.derived.nOverflow)
                throw new Error("shallower requires balanced child");
            source.editToken = t;
            entry.editToken = t;
            started = true;
            try {
                await entry.derived.defragmentPage(-1, control);
                await page.copyNodeContent(entry.derived, control);
                source.entries = entry.entries;
                entry.entries = 0;
                // FreePage accepts the existing child reference; release order stays
                // noncancellable and count ownership is already moved to root.
                await this.#freePage(number, control, true);
            }
            finally {
                delete source.editToken;
                delete entry.editToken;
            }
        }
        catch (error) {
            primary = error;
            if (started)
                this.#trip(error);
        }
        finally {
            for (const lease of [child, root])
                if (lease)
                    try {
                        lease.release();
                    }
                    catch (error) {
                        primary ??= error;
                    }
            if (started && primary !== undefined)
                this.#trip(primary);
            this.#end(t);
        }
        if (primary !== undefined)
            throw primary;
    }
    /** balance_deeper allocation/copy/stage/zero owner; shared held-token path. */
    async deepenRoot(control) {
        return this.#deepenRoot(control);
    }
    async #deepenRoot(control, held) {
        const t = held ?? this.#begin();
        this.#check(t);
        let root = null, raw = null, child = null, primary, started = false, number = 0;
        try {
            if (!held)
                for (const c of this.#registry)
                    await cursors.get(c).save(t, control);
            for (const p of this.#pages.values())
                if (p.refs)
                    throw new Error("private deeper requires no foreign leases");
            root = this.#acquire(2);
            const source = this.#pages.get(2);
            if (!source.derived.nOverflow)
                throw new Error("deeper requires root staging");
            // Allocation can mutate the freelist before failing; no rollback claim.
            started = true;
            raw = await this.#allocatePage(2, control);
            number = raw.pgno;
            const entry = this.#pages.get(number);
            entry.bytes.fill(0);
            entry.bytes[0] = 10;
            put2(entry.bytes, 5, 4096);
            raw.release();
            raw = null;
            child = this.#acquire(number);
            source.editToken = t;
            entry.editToken = t;
            try {
                await source.derived.deepenInto(entry.derived, control);
            }
            finally {
                delete source.editToken;
                delete entry.editToken;
            }
            entry.entries = source.entries;
            source.entries = 0;
        }
        catch (error) {
            primary = error;
            if (started)
                this.#trip(error);
        }
        finally {
            for (const lease of [child, raw, root])
                if (lease)
                    try {
                        lease.release();
                    }
                    catch (error) {
                        primary ??= error;
                    }
            if (started && primary !== undefined)
                this.#trip(primary);
            if (!held)
                this.#end(t);
        }
        if (primary !== undefined)
            throw primary;
        return number;
    }
    /** Raw pager identity prerequisite; not nonroot/parent publication. */
    /** Native BLOBKEY balance loop over an owned, validated cursor path. */
    async balancePath(numbers, indices, bulk, control) {
        return this.#balancePath(numbers, indices, bulk, control);
    }
    async #balancePath(numbers, indices, bulk, control, held) {
        const t = held ?? this.#begin();
        this.#check(t);
        let charge = 0, started = false;
        try {
            if (numbers.length < 1 || numbers.length > 20 || numbers[0] !== 2 || indices.length !== numbers.length - 1)
                corrupt("invalid balance path");
            this.#budget.reserve(256 + 20 * 16);
            charge = 256 + 20 * 16;
            const path = numbers.slice(), slots = indices.slice();
            if (!held)
                for (const c of this.#registry)
                    await cursors.get(c).save(t, control);
            for (const p of this.#pages.values())
                if (p.refs)
                    throw new Error("private balance requires no foreign leases");
            // Validate actual child relationships before modifying any ancestor.
            for (let i = 0; i < path.length; i++) {
                if (path.indexOf(path[i]) !== i)
                    corrupt("cyclic balance path");
                const p = this.#acquire(path[i]);
                try {
                    if (i < slots.length) {
                        const slot = slots[i];
                        if (!Number.isInteger(slot) || slot < 0 || slot > p.page.nCell || p.page.leaf)
                            corrupt("invalid balance child index");
                        const child = slot === p.page.nCell ? p.page.rightChild() : get4(this.#pages.get(path[i]).bytes, p.page.findCell(slot));
                        if (child !== path[i + 1])
                            corrupt("stale balance path");
                    }
                }
                finally {
                    p.release();
                }
            }
            started = true;
            while (path.length) {
                await control.checkpoint(1);
                const p = this.#acquire(path[path.length - 1]);
                let pending = 0, free = 0;
                try {
                    pending = p.page.nOverflow;
                    free = p.page.computeFreeSpace();
                }
                finally {
                    p.release();
                }
                if (!pending && free * 3 <= 8192)
                    break;
                if (path.length === 1) {
                    if (!pending)
                        break;
                    if (path.length >= 20)
                        corrupt("balance depth limit");
                    path.push(await this.#deepenRoot(control, t));
                    slots.push(0);
                }
                else {
                    await this.#balanceNonroot(path[path.length - 2], slots[slots.length - 1], bulk, control, t);
                    path.pop();
                    slots.pop();
                }
            }
        }
        catch (error) {
            if (started)
                this.#trip(error);
            throw error;
        }
        finally {
            if (charge)
                this.#budget.release(charge);
            if (!held)
                this.#end(t);
        }
    }
    /** Held nonroot owner, private hdrOffset0/autoVacuum=false. */
    async balanceNonroot(parentNumber, index, bulk, control) {
        return this.#balanceNonroot(parentNumber, index, bulk, control);
    }
    async #balanceNonroot(parentNumber, index, bulk, control, held) {
        const t = held ?? this.#begin();
        this.#check(t);
        let primary, started = false, charge = 0;
        let parent = null, old = null, gather = null, partition = null;
        let fresh, entries;
        try {
            this.#budget.reserve(PRIVATE_NONROOT_CONTROL_CHARGE);
            charge = PRIVATE_NONROOT_CONTROL_CHARGE;
            fresh = [];
            entries = [];
            if (!held)
                for (const c of this.#registry)
                    await cursors.get(c).save(t, control);
            for (const p of this.#pages.values())
                if (p.refs)
                    throw new Error("private balance requires no foreign leases");
            parent = this.#acquire(parentNumber);
            const parentEntry = this.#pages.get(parentNumber);
            parentEntry.editToken = t;
            entries.push(parentEntry);
            started = true;
            old = await acquireBlobkeySiblings(parentEntry.derived, index, bulk, async (number) => {
                const lease = this.#acquire(number), entry = this.#pages.get(number);
                entry.editToken = t;
                entries.push(entry);
                return { page: entry.derived, release: () => lease.release() };
            }, this.#budget, control);
            const oldRight = old.pages[old.pages.length - 1].leaf ? 0 : old.pages[old.pages.length - 1].rightChild();
            gather = await gatherBlobkeyCells(old.pages, old.dividers, this.#budget, control);
            partition = await partitionBlobkeyCells(gather.cells.length, i => gather.cells[i].length, gather.oldCounts, gather.oldBytes, 4088 - old.pages[0].childPtrSize, bulk, this.#budget, control);
            const pages = old.pages.slice(0, partition.counts.length);
            while (pages.length < partition.counts.length) {
                const raw = await this.#allocatePage(bulk ? 1 : old.pages[0].pgno, control);
                let error;
                try {
                    raw.bytes.fill(0);
                    raw.bytes[0] = old.pages[0].leaf ? 10 : 2;
                    put2(raw.bytes, 5, 4096);
                }
                catch (e) {
                    error = e;
                }
                finally {
                    try {
                        raw.release();
                    }
                    catch (e) {
                        error ??= e;
                    }
                }
                if (error !== undefined)
                    throw error;
                const lease = this.#acquire(raw.pgno);
                fresh.push(lease);
                const entry = this.#pages.get(raw.pgno);
                entry.editToken = t;
                entries.push(entry);
                pages.push(entry.derived);
            }
            const identities = pages.map(page => ({ pgno: page.pgno, page, entry: this.#pages.get(page.pgno) }));
            const rekey = await rekeyBlobkeySiblings(identities, async (item, number) => {
                if (this.#pages.has(number))
                    corrupt("rekey destination occupied");
                this.#pages.delete(item.pgno);
                this.#pages.set(number, item.entry);
                item.pgno = number;
                pageIdentity.get(item.page)(number);
            }, this.#budget, control);
            rekey.release();
            await publishBlobkeyDividers(parentEntry.derived, old.first, old.rightOffset, pages, partition.counts, gather.cells, oldRight, old.pages.length, this.#budget, control);
            await editBlobkeySiblings(pages, gather.cells, gather.oldCounts, partition.counts, this.#budget, control);
            // Conserving raw producers retain old logical ownership until every
            // physical consumer succeeds. Reconcile synchronously without admission.
            parentEntry.entries = parent.page.nCell + parent.page.nOverflow;
            for (const page of old.pages)
                this.#pages.get(page.pgno).entries = 0;
            for (const page of pages)
                this.#pages.get(page.pgno).entries = page.nCell + page.nOverflow;
            if (parentNumber === 2 && parentEntry.derived.nCell === 0) {
                if (pages.length !== 1)
                    corrupt("empty balanced root has multiple children");
                const child = pages[0];
                await child.defragmentPage(-1, control);
                await parentEntry.derived.copyNodeContent(child, control);
                parentEntry.entries = this.#pages.get(child.pgno).entries;
                this.#pages.get(child.pgno).entries = 0;
                await this.#freePage(child.pgno, control, true);
            }
            for (let i = pages.length; i < old.pages.length; i++)
                await this.#freePage(old.pages[i].pgno, control, true);
            this.#epoch++;
        }
        catch (error) {
            primary = error;
            if (started)
                this.#trip(error);
        }
        finally {
            for (const entry of entries ?? [])
                delete entry.editToken;
            for (const release of [() => partition?.release(), () => gather?.release(), () => old?.release(), ...(fresh ?? []).map(p => () => p.release()), () => parent?.release()])
                try {
                    release();
                }
                catch (error) {
                    primary ??= error;
                }
            if (charge)
                this.#budget.release(charge);
            if (started && primary !== undefined)
                this.#trip(primary);
            if (!held)
                this.#end(t);
        }
        if (primary !== undefined)
            throw primary;
    }
    async rekeySiblings(numbers, control) {
        const t = this.#begin();
        let charge = 0, changed = false;
        try {
            if (numbers.length < 1 || numbers.length > 5)
                throw new Error("invalid rekey siblings");
            this.#budget.reserve(128);
            charge = 128;
            const owned = numbers.slice();
            for (const c of this.#registry)
                await cursors.get(c).save(t, control);
            for (const p of this.#pages.values())
                if (p.refs)
                    throw new Error("private rekey requires no foreign leases");
            const pages = owned.map(number => {
                const entry = this.#pages.get(number);
                if (number < 3 || number > get4(this.#pages.get(1).bytes, 28) || !entry)
                    corrupt("rekey page outside arena");
                return { pgno: number, entry: entry };
            });
            const result = await rekeyBlobkeySiblings(pages, async (page, number) => {
                if (this.#pages.has(number))
                    corrupt("rekey destination occupied");
                changed = true;
                this.#pages.delete(page.pgno);
                this.#pages.set(number, page.entry);
                page.pgno = number;
                if (page.entry.derived)
                    pageIdentity.get(page.entry.derived)(number);
            }, this.#budget, control);
            result.release();
            if (changed)
                this.#epoch++;
        }
        catch (error) {
            if (changed)
                this.#trip(error);
            throw error;
        }
        finally {
            if (charge)
                this.#budget.release(charge);
            this.#end(t);
        }
    }
    /** autoVacuum=false BTALLOC_ANY branch. Result is readonly uninitialized storage inspection. */
    async allocatePage(nearby, control) {
        return this.#arenaMutation(() => this.#allocatePage(nearby, control, false));
    }
    async #allocatePage(nearby, control, writable = true) {
        const p1 = this.#pages.get(1).bytes, mx = get4(p1, 28), count = get4(p1, 36);
        let trunk = null, result = null;
        let primary;
        try {
            if (count >= mx)
                corrupt("freelist count outside arena");
            await control.checkpoint(0);
            if (count) {
                put4(p1, 36, count - 1);
                const pgno = get4(p1, 32);
                if (pgno < 2 || pgno > mx)
                    corrupt("freelist trunk outside arena");
                trunk = this.#raw(pgno, writable);
                const b = this.#pages.get(pgno).bytes, k = get4(b, 4);
                if (k > 1022)
                    corrupt("freelist trunk leaf count");
                if (k === 0) {
                    put4(p1, 32, get4(b, 0));
                    this.#disposeStaging(this.#pages.get(pgno).derived);
                    this.#pages.get(pgno).derived = null;
                    this.#pages.get(pgno).entries = 0;
                    result = trunk;
                    trunk = null;
                }
                else {
                    let closest = 0;
                    if (nearby > 0) {
                        let distance = Math.abs((get4(b, 8) - nearby) | 0);
                        for (let i = 1; i < k; i++) {
                            await control.checkpoint(1);
                            const d = Math.abs((get4(b, 8 + 4 * i) - nearby) | 0);
                            if (d < distance) {
                                closest = i;
                                distance = d;
                            }
                        }
                    }
                    const leaf = get4(b, 8 + 4 * closest);
                    if (leaf < 2 || leaf > mx)
                        corrupt("freelist leaf outside arena");
                    if (closest < k - 1)
                        put4(b, 8 + 4 * closest, get4(b, 4 + 4 * k));
                    put4(b, 4, k - 1);
                    const entry = this.#pages.get(leaf);
                    if (entry.refs)
                        corrupt("freelist leaf still referenced");
                    this.#disposeStaging(entry.derived);
                    entry.derived = null;
                    entry.entries = 0;
                    result = this.#raw(leaf, writable);
                }
            }
            else {
                let pgno = mx + 1;
                if (pgno === 262145)
                    pgno++; // PENDING_BYTE_PAGE at4096.
                put4(p1, 28, pgno);
                this.#append(pgno);
                result = this.#raw(pgno, writable);
            }
        }
        catch (error) {
            primary = error;
        }
        // Noncancellable cleanup; both pending acquisitions attempted, primary wins.
        if (trunk)
            try {
                trunk.release();
            }
            catch (error) {
                primary ??= error;
            }
        if (primary !== undefined) {
            if (result)
                try {
                    result.release();
                }
                catch { }
            throw primary;
        }
        return result;
    }
    /** freePage2 without secure-delete/autovacuum/journal; buffers stay charged. */
    async freePage(pgno, control) {
        return this.#arenaMutation(() => this.#freePage(pgno, control));
    }
    async #freePage(pgno, control, supplied = false) {
        const p1 = this.#pages.get(1).bytes;
        if (pgno < 2 || pgno > get4(p1, 28))
            corrupt("free page outside arena");
        let page = null, trunk = null, primary;
        try {
            page = supplied ? this.#retainRaw(pgno) : this.#raw(pgno);
            await control.checkpoint(0);
            const count = get4(p1, 36);
            put4(p1, 36, count + 1);
            let head = 0, leaf = false;
            if (count) {
                head = get4(p1, 32);
                if (head > get4(p1, 28) || head < 2)
                    corrupt("free page trunk outside arena");
                trunk = this.#raw(head);
                const k = get4(trunk.bytes, 4);
                if (k > 1022)
                    corrupt("free page trunk count");
                if (k < 1016) {
                    put4(trunk.bytes, 4, k + 1);
                    put4(trunk.bytes, 8 + 4 * k, pgno);
                    leaf = true;
                }
            }
            if (!leaf) {
                put4(page.bytes, 0, head);
                put4(page.bytes, 4, 0);
                put4(p1, 32, pgno);
            }
        }
        catch (error) {
            primary = error;
        }
        this.#disposeStaging(this.#pages.get(pgno).derived);
        this.#pages.get(pgno).derived = null;
        this.#pages.get(pgno).entries = 0;
        for (const lease of [page, trunk])
            if (lease)
                try {
                    lease.release();
                }
                catch (error) {
                    primary ??= error;
                }
        if (primary !== undefined)
            throw primary;
    }
    /** clearCellOverflow, auxiliary cell seam. No slot deletion or cursor restore. */
    async clearCellOverflow(pgno, cell, control) {
        return this.#arenaMutation(async () => {
            const entry = this.#pages.get(pgno);
            if (!entry)
                corrupt("clear cell page outside arena");
            const page = new PrivateIndexPage(pgno, entry.bytes), info = page.parseCellBytes(cell);
            if (info.nLocal === info.nPayload)
                return;
            let overflow = get4(cell, info.nSize - 4), remaining = Math.ceil((info.nPayload - info.nLocal) / 4092);
            while (remaining--) {
                if (overflow < 2 || overflow > get4(this.#pages.get(1).bytes, 28))
                    corrupt("overflow page outside arena");
                let lease = null, next = 0, primary;
                try {
                    // In-memory lookup retains even the final page, but only read its
                    // next pointer when another page is expected (native PagerLookup).
                    lease = remaining ? this.#raw(overflow) : this.#retainRaw(overflow);
                    if (remaining)
                        next = get4(lease.bytes, 0);
                    if (this.referenceCount(overflow) !== 1)
                        corrupt("overflow page still referenced");
                    await this.#freePage(overflow, control, true);
                }
                catch (error) {
                    primary = error;
                }
                if (lease)
                    try {
                        lease.release();
                    }
                    catch (error) {
                        primary ??= error;
                    }
                if (primary !== undefined)
                    throw primary;
                overflow = next;
            }
        });
    }
    /** Construction-only fillInCell BLOBKEY. Scratch release does not free published
     * overflow pages: subsequent cell publication/clear owner must consume them. */
    async fillCell(pgno, key, control) {
        // Resource-policy rejection precedes mutation admission: no owned bytes or
        // page state have changed, so it must not terminally FAULT the arena.
        this.#live();
        if (key.length > this.#maxKeyBytes)
            throw new PrivateStateLimitError("private index key exceeds byte limit");
        return this.#arenaMutation(() => this.#fillCell(pgno, key, control));
    }
    async #fillCell(pgno, key, control) {
        const entry = this.#pages.get(pgno);
        if (!entry)
            corrupt("fill cell page outside arena");
        const page = new PrivateIndexPage(pgno, entry.bytes);
        const length = key.length;
        if (length > 0x7fffffff)
            throw new PrivateStateLimitError("private key too large");
        let value = length, count = 1;
        while (value >= 128) {
            count++;
            value = Math.floor(value / 128);
        }
        const header = page.childPtrSize + count;
        let local = length;
        if (length > page.maxLocal) {
            const surplus = page.minLocal + (length - page.minLocal) % 4092;
            local = surplus <= page.maxLocal ? surplus : page.minLocal;
        }
        const size = Math.max(4, header + local + (local < length ? 4 : 0));
        // Own input plus pending result metadata before any allocation/publication.
        const resultCharge = size + PRIVATE_CELL_RESULT_CHARGE;
        this.#budget.reserve(length + resultCharge);
        let retained = false;
        let previous = null, pending = null;
        try {
            // The nonyielding probe permits cancellation/work accounting without
            // borrowing mutable caller bytes across an await. Legacy small inputs
            // have one bounded synchronous copy; large inputs require the probe.
            const probe = control.snapshotCheckpoint;
            if (!probe && length > 4096) {
                await control.checkpoint(0);
                throw new Error("large private input requires synchronous snapshot checkpoint");
            }
            probe?.call(control, 0);
            const owned = new Uint8Array(length), cell = new Uint8Array(size);
            for (let copied = 0; copied < length;) {
                const n = Math.min(4096, length - copied);
                probe?.call(control, n);
                owned.set(key.subarray(copied, copied + n), copied);
                copied += n;
            }
            // Legacy bounded input copy work is charged after ownership, before use.
            if (!probe)
                await control.checkpoint(length);
            value = length;
            for (let i = header - 1; i >= page.childPtrSize; i--) {
                cell[i] = (value % 128) | (i === header - 1 ? 0 : 128);
                value = Math.floor(value / 128);
            }
            let destination = cell, prior = cell;
            let offset = header, link = header + local, space = local, source = 0, nearby = 0;
            while (source < length) {
                const n = Math.min(length - source, space);
                await control.checkpoint(n);
                destination.set(owned.subarray(source, source + n), offset);
                source += n;
                offset += n;
                space -= n;
                if (source === length)
                    break;
                if (space === 0) {
                    pending = await this.#allocatePage(nearby, control);
                    nearby = pending.pgno;
                    put4(prior, link, pending.pgno); // publish previous link FIRST
                    if (previous)
                        previous.release(); // unref previous before retaining new
                    previous = pending;
                    pending = null;
                    prior = previous.bytes;
                    link = 0;
                    put4(prior, 0, 0);
                    destination = prior;
                    offset = 4;
                    space = 4092;
                }
            }
            if (previous) {
                previous.release();
                previous = null;
            }
            let released = false, capabilityBytes = 0;
            const admitCapability = (charge) => { this.#budget.reserve(charge); capabilityBytes += charge; return () => { capabilityBytes -= charge; this.#budget.release(charge); }; };
            const bytes = borrowedBytes(cell, () => { if (released)
                throw new Error("private cell result released"); }, admitCapability);
            const release = () => { if (released)
                return; released = true; this.#results.delete(release); this.#budget.release(resultCharge + capabilityBytes); capabilityBytes = 0; };
            // Register before publication; a failing registry allocation leaves the
            // pending input/cell charge to the existing primary-error unwind.
            const result = { bytes, release };
            this.#results.add(release);
            this.#budget.release(length);
            retained = true;
            return result;
        }
        catch (error) {
            for (const lease of [pending, previous])
                if (lease)
                    try {
                        lease.release();
                    }
                    catch { /* primary wins */ }
            throw error;
        }
        finally {
            if (!retained)
                this.#budget.release(length + resultCharge);
        }
    }
    #registerCursor(cursor, owning) { this.#registry.add(cursor); this.#single ||= owning; }
    #unregisterCursor(cursor) { this.#registry.delete(cursor); return this.#single && this.#registry.size === 0; }
    #assertCursorClose() { let owned = 0; for (const c of this.#registry)
        owned += cursors.get(c).refs(); let actual = 0; for (const p of this.#pages.values())
        actual += p.refs; if (actual !== owned)
        throw new Error("private arena has foreign leases"); }
    #trip(error) { this.#fault = error; for (const c of this.#registry)
        cursors.get(c).fault(error); }
    async clearTable(control) {
        const t = this.#begin();
        let changed = false;
        // Depth bounded by native Btree depth19; each frame owns128 metadata bytes.
        const frames = [];
        let count = 0;
        const push = async (pgno) => {
            await control.checkpoint(0);
            if (frames.length >= 20 || frames.some(f => f.lease.page.pgno === pgno))
                corrupt("clear tree cycle/depth");
            this.#budget.reserve(128);
            let lease = null;
            try {
                lease = this.#acquire(pgno);
                frames.push({ lease, index: 0, right: false });
            }
            catch (error) {
                if (lease)
                    try {
                        lease.release();
                    }
                    catch { }
                this.#budget.release(128);
                throw error;
            }
        };
        try {
            for (const c of this.#registry)
                await cursors.get(c).save(t, control);
            for (const p of this.#pages.values())
                if (p.refs)
                    throw new Error("private clear requires no foreign leases");
            await push(this.root);
            while (frames.length) {
                const frame = frames.at(-1), page = frame.lease.page;
                if (frame.index < page.nCell) {
                    if (!page.leaf && !frame.right) {
                        frame.right = true;
                        await push(page.leftChild(frame.index));
                        continue;
                    }
                    const cell = page.parseCell(frame.index);
                    if (cell.overflowOffset !== null) {
                        let next = get4(page.bytes, cell.overflowOffset), remaining = Math.ceil((cell.nPayload - cell.nLocal) / 4092);
                        while (remaining--) {
                            await control.checkpoint(0);
                            if (next < 2 || next > get4(this.#pages.get(1).bytes, 28))
                                corrupt("overflow page outside arena");
                            const raw = remaining ? this.#raw(next) : this.#retainRaw(next);
                            let primary;
                            try {
                                const following = remaining ? get4(raw.bytes, 0) : 0;
                                if (this.referenceCount(next) !== 1)
                                    corrupt("clear overflow still referenced");
                                changed = true;
                                await this.#freePage(next, control, true);
                                next = following;
                            }
                            catch (error) {
                                primary = error;
                                throw error;
                            }
                            finally {
                                try {
                                    raw.release();
                                }
                                catch (error) {
                                    if (primary === undefined)
                                        throw error;
                                }
                            }
                        }
                    }
                    frame.index++;
                    frame.right = false;
                    continue;
                }
                if (!page.leaf && !frame.right) {
                    frame.right = true;
                    await push(page.rightChild());
                    continue;
                }
                count += page.nCell;
                if (page.pgno === this.root) {
                    await control.checkpoint(4096);
                    changed = true;
                    const entry = this.#pages.get(this.root);
                    entry.bytes.fill(0);
                    entry.bytes[0] = 10;
                    put2(entry.bytes, 5, 4096);
                    entry.derived = null;
                    entry.entries = 0;
                }
                else {
                    changed = true;
                    await this.#freePage(page.pgno, control, true);
                }
                frames.pop();
                this.#budget.release(128);
                frame.lease.release();
            }
            this.#epoch++;
            return count;
        }
        catch (error) {
            if (changed)
                this.#trip(error);
            throw error;
        }
        finally {
            while (frames.length) {
                const frame = frames.pop();
                this.#budget.release(128);
                try {
                    frame.lease.release();
                }
                catch { /* primary wins */ }
            }
            this.#end(t);
        }
    }
    /** Single staged descriptor consumption; no redistribution/parent edits. */
    async transferStagedCell(source, destination, slot, control) {
        const t = this.#begin();
        let a = null, b = null, charge = 0, removed = false, primary;
        try {
            if (source === destination)
                throw new Error("staged transfer requires distinct pages");
            for (const c of this.#registry)
                await cursors.get(c).save(t, control);
            for (const p of this.#pages.values())
                if (p.refs)
                    throw new Error("private staged transfer requires no foreign leases");
            await control.checkpoint(0);
            a = this.#acquire(source);
            b = this.#acquire(destination);
            const src = this.#pages.get(source), dst = this.#pages.get(destination), from = src.derived, to = dst.derived;
            if (from.leaf !== to.leaf || to.nOverflow)
                throw new Error("unsupported staged transfer format");
            if (!Number.isInteger(slot) || slot < 0 || slot > to.nCell)
                corrupt("invalid staged transfer slot");
            const authority = stagedCells.get(from), bytes = authority.peek();
            if (to.computeFreeSpace() < bytes.length + 2)
                throw new Error("staged transfer requiring balance is unsupported");
            this.#budget.reserve(bytes.length + 64);
            charge = bytes.length + 64;
            const copy = bytes.slice();
            await control.checkpoint(bytes.length);
            authority.take();
            this.#transit++;
            removed = true;
            const target = new PrivateIndexPage(destination, dst.bytes, { reserve: n => this.#budget.reserve(n), release: n => this.#budget.release(n), admitEntry: () => this.#consumeTransit(dst) }, this.#maxKeyBytes);
            await target.insertCell(slot, copy, control);
            dst.derived = null;
            this.#epoch++;
        }
        catch (error) {
            primary = error;
            if (removed)
                this.#trip(error);
        }
        finally {
            for (const lease of [a, b])
                if (lease)
                    try {
                        lease.release();
                    }
                    catch (error) {
                        primary ??= error;
                    }
            if (removed && primary !== undefined)
                this.#trip(primary);
            if (charge)
                this.#budget.release(charge);
            this.#end(t);
        }
        if (primary !== undefined)
            throw primary;
    }
    #disposeStaging(page) { if (page)
        stagedDisposal.get(page)(); }
    #entryCount() { let total = this.#transit; for (const p of this.#pages.values())
        total += p.entries; return total; }
    #newEntry(entry) {
        if (this.#entryCount() >= this.#maxEntries)
            throw new PrivateStateLimitError("private index entry limit");
        entry.entries++;
        let undone = false;
        return () => { if (!undone) {
            undone = true;
            entry.entries--;
        } };
    }
    #consumeTransit(entry) {
        if (this.#transit !== 1)
            throw new Error("invalid linear transfer ownership");
        this.#transit--;
        entry.entries++;
        let undone = false;
        return () => { if (!undone) {
            undone = true;
            entry.entries--;
            this.#transit++;
        } };
    }
    /** Owning equal-size/local replacement seam (BtreeInsert's overwrite path).
     * Not a seek/Insert wrapper. Different size/overflow needs the future writer. */
    /** Physical same-length BLOBKEY payload owner (btreeOverwriteCell9265ff).
     * No seek authority: the consuming Insert must select the cell under its gate.
     * Fixture wrapper saves all cursors, then rejects foreign leases. */
    async overwriteCell(pgno, index, payload, control) {
        if (payload.length > this.#maxKeyBytes)
            throw new PrivateStateLimitError("private overwrite key exceeds byte limit");
        const t = this.#begin();
        let charge = 0, lease = null, primary, written = false;
        try {
            this.#budget.reserve(payload.length + 64);
            charge = payload.length + 64;
            if (!control.snapshotCheckpoint && payload.length > 4096) {
                await control.checkpoint(0);
                throw new Error("large private input requires synchronous snapshot checkpoint");
            }
            control.snapshotCheckpoint?.(0);
            const owned = new Uint8Array(payload.length);
            for (let offset = 0; offset < payload.length; offset += 4096) {
                const n = Math.min(4096, payload.length - offset);
                control.snapshotCheckpoint?.(n);
                owned.set(payload.subarray(offset, offset + n), offset);
            }
            for (const c of this.#registry)
                await cursors.get(c).save(t, control);
            for (const p of this.#pages.values())
                if (p.refs)
                    throw new Error("private overwrite requires no foreign leases");
            await control.checkpoint(0);
            lease = this.#acquire(pgno);
            await this.#overwritePayload(pgno, index, owned, control);
            written = true;
        }
        catch (error) {
            primary = error;
            if (written)
                this.#trip(error);
        }
        finally {
            if (lease)
                try {
                    lease.release();
                }
                catch (error) {
                    primary ??= error;
                }
            if (written && primary !== undefined)
                this.#trip(primary);
            if (charge)
                this.#budget.release(charge);
            this.#end(t);
        }
        if (primary !== undefined)
            throw primary;
    }
    /** Held clearCellOverflow for replacement; final unused next pointer is not read. */
    async #clearCellOverflow(page, index, control) {
        const cell = page.parseCell(index);
        if (cell.overflowOffset === null)
            return;
        let next = get4(page.bytes, cell.overflowOffset), remaining = Math.ceil((cell.nPayload - cell.nLocal) / 4092);
        while (remaining--) {
            await control.checkpoint(0);
            if (next < 2 || next > get4(this.#pages.get(1).bytes, 28))
                corrupt("overflow page outside arena");
            const raw = remaining ? this.#raw(next) : this.#retainRaw(next);
            let primary;
            try {
                const following = remaining ? get4(raw.bytes, 0) : 0;
                if (this.referenceCount(next) !== 1)
                    corrupt("clear overflow still referenced");
                await this.#freePage(next, control, true);
                next = following;
            }
            catch (error) {
                primary = error;
                throw error;
            }
            finally {
                try {
                    raw.release();
                }
                catch (error) {
                    if (primary === undefined)
                        throw error;
                }
            }
        }
    }
    async #insertLocal(t, pgno, index, key, control, replace = false, balance = false) {
        const entry = this.#pages.get(pgno), page = entry.derived;
        if (balance && replace && !page.nOverflow && (key.length > page.maxLocal || page.parseCell(index).nLocal !== page.parseCell(index).nPayload)) {
            let result = null, charge = 0;
            try {
                // Native construction precedes old overflow destruction and drop.
                result = await this.#fillCell(pgno, key, control);
                this.#budget.reserve(result.bytes.length);
                charge = result.bytes.length;
                const cell = new Uint8Array(charge);
                for (let i = 0; i < charge; i++)
                    cell[i] = result.bytes[i];
                const old = page.parseCell(index);
                if (!page.leaf)
                    cell.set(entry.bytes.subarray(old.offset, old.offset + 4));
                entry.editToken = t;
                await this.#clearCellOverflow(page, index, control);
                if (old.nLocal === old.nPayload && old.nSize === charge) {
                    await control.checkpoint(charge);
                    entry.bytes.set(cell, old.offset);
                    this.#epoch++;
                }
                else {
                    await page.dropCell(index, old.nSize, control);
                    await page.insertCell(index, cell, control);
                }
            }
            catch (error) {
                this.#trip(error);
                throw error;
            }
            finally {
                delete entry.editToken;
                if (charge)
                    this.#budget.release(charge);
                result?.release();
            }
            return;
        }
        if (balance && !replace && page.leaf && !page.nOverflow && key.length > page.maxLocal) {
            // NEW policy must reject before fill allocates/publishes overflow pages.
            if (this.#entryCount() >= this.#maxEntries)
                throw new PrivateStateLimitError("private index entry limit");
            let cell = null;
            try {
                cell = await this.#fillCell(pgno, key, control);
                entry.editToken = t;
                const size = cell.bytes.length;
                this.#budget.reserve(size);
                try {
                    const owned = new Uint8Array(size);
                    for (let i = 0; i < size; i++)
                        owned[i] = cell.bytes[i];
                    await page.insertCell(index, owned, control);
                }
                finally {
                    this.#budget.release(size);
                }
            }
            catch (error) {
                this.#trip(error);
                throw error;
            }
            finally {
                delete entry.editToken;
                cell?.release();
            }
            return;
        }
        if ((!page.leaf && !replace) || page.nOverflow || key.length > page.maxLocal)
            throw new Error("local NEW requires leaf; replacement requires unstaged local cell");
        let count = 1, value = key.length;
        while (value >= 128) {
            count++;
            value = Math.floor(value / 128);
        }
        const size = Math.max(4, page.childPtrSize + count + key.length);
        const old = replace ? page.parseCell(index) : null;
        if (old && old.nLocal !== old.nPayload)
            throw new Error("local replacement requires overflow clear (unimplemented)");
        if (!balance && size + 2 > page.computeFreeSpace() + (old ? old.nSize + 2 : 0))
            throw new Error("local writer requires balance (unimplemented)");
        this.#budget.reserve(size);
        try {
            const cell = new Uint8Array(size);
            value = key.length;
            for (let i = count - 1; i >= 0; i--) {
                cell[page.childPtrSize + i] = (value % 128) | (i === count - 1 ? 0 : 128);
                value = Math.floor(value / 128);
            }
            cell.set(key, page.childPtrSize + count);
            if (old && !page.leaf)
                cell.set(entry.bytes.subarray(old.offset, old.offset + 4), 0);
            entry.editToken = t;
            let dropped = false;
            try {
                if (old) {
                    // Native preserves the old left child before local clear and
                    // same-size fast path or resident drop/insert.
                    if (old.nSize === size) {
                        await control.checkpoint(size);
                        entry.bytes.set(cell, old.offset);
                        this.#epoch++;
                        return;
                    }
                    await page.dropCell(index, old.nSize, control);
                    dropped = true;
                }
                await page.insertCell(index, cell, control);
            }
            catch (error) {
                if (dropped)
                    this.#trip(error);
                throw error;
            }
            finally {
                delete entry.editToken;
            }
        }
        finally {
            this.#budget.release(size);
        }
    }
    async #overwritePayload(pgno, index, owned, control) {
        let written = false;
        try {
            const page = this.#pages.get(pgno)?.derived;
            if (!page)
                throw new PrivateBlobkeyFormatError("overwrite requires initialized page");
            const cell = page.parseCell(index), bytes = this.#pages.get(pgno).bytes;
            if (cell.nPayload !== owned.length)
                throw new Error("overwrite requires same payload length");
            if (cell.payloadOffset < page.cellOffset || cell.payloadOffset + cell.nLocal > 4096)
                corrupt("overwrite payload outside page");
            // BLOBKEY nZero=0: only the native data branch is reachable. Own input
            // before suspension; memmove equivalence follows from disjoint snapshot.
            const content = async (destination, offset, source, n) => {
                await control.checkpoint(n);
                let different = false;
                for (let i = 0; i < n; i++)
                    if (destination[offset + i] !== owned[source + i]) {
                        different = true;
                        break;
                    }
                if (different) {
                    written = true;
                    destination.set(owned.subarray(source, source + n), offset);
                }
            };
            await content(bytes, cell.payloadOffset, 0, cell.nLocal);
            if (cell.nLocal < owned.length) {
                let pg = get4(bytes, cell.overflowOffset), source = cell.nLocal;
                do {
                    await control.checkpoint(0);
                    const raw = this.#raw(pg, true);
                    let error;
                    try {
                        const entry = this.#pages.get(pg);
                        if (entry.refs !== 1 || entry.derived)
                            corrupt("overwrite overflow page referenced or initialized");
                        const n = Math.min(4092, owned.length - source);
                        if (source + n < owned.length)
                            pg = get4(raw.bytes, 0);
                        await content(raw.bytes, 4, source, n);
                        source += n;
                    }
                    catch (e) {
                        error = e;
                    }
                    finally {
                        try {
                            raw.release();
                        }
                        catch (e) {
                            error ??= e;
                        }
                    }
                    if (error !== undefined)
                        throw error;
                } while (source < owned.length);
            }
            this.#epoch++;
        }
        catch (error) {
            if (written)
                this.#trip(error);
            throw error;
        }
    }
    async replaceCell(pgno, index, cell, control, options = {}) {
        if (options.preformat)
            throw new Error("PREFORMAT ownership is unsupported");
        if ("seekEvidence" in options || "seekResult" in options)
            throw new Error("unsupported seek authority on physical REPLACE");
        if ("savePosition" in options)
            throw new Error("unsupported position authority on physical REPLACE");
        if (cell.length > 4096)
            throw new PrivateStateLimitError("private replacement cell too large");
        const t = this.#begin();
        let lease = null, charge = 0, primary, written = false;
        try {
            this.#budget.reserve(cell.length + 64);
            charge = cell.length + 64;
            // Own packed physical input before the first await; bounded to one page.
            // Native borrows synchronously. Async adaptation probes under the gate
            // after peak admission and before copy/peer saves; failure is unpublished.
            control.snapshotCheckpoint?.(0);
            const copy = cell.slice();
            control.snapshotCheckpoint?.(copy.length);
            for (const c of this.#registry)
                await cursors.get(c).save(t, control);
            for (const p of this.#pages.values())
                if (p.refs)
                    throw new Error("private replacement requires no foreign leases");
            await control.checkpoint(0);
            lease = this.#acquire(pgno);
            const page = lease.page, old = page.parseCell(index), replacement = page.parseCellBytes(copy);
            if (replacement.nPayload > this.#maxKeyBytes)
                throw new PrivateStateLimitError("private replacement key exceeds byte limit");
            if (old.nPayload !== replacement.nPayload || old.nLocal !== old.nPayload || replacement.nSize !== copy.length || old.nSize !== copy.length || page.nOverflow)
                throw new Error("replacement requiring overflow or structural writer is unsupported");
            // Packed payload is authoritative, interior child remains owned by old cell.
            const entry = this.#pages.get(pgno), offset = old.offset;
            if (!page.leaf)
                copy.set(entry.bytes.subarray(offset, offset + 4), 0);
            await control.checkpoint(old.nPayload);
            let different = false;
            for (let i = 0; i < copy.length; i++)
                if (entry.bytes[offset + i] !== copy[i]) {
                    different = true;
                    break;
                }
            if (different) {
                written = true;
                entry.bytes.set(copy, offset);
            }
            this.#epoch++; // entry count unchanged: REPLACE, never NEW.
        }
        catch (error) {
            primary = error;
            if (written)
                this.#trip(error);
        }
        finally {
            if (lease)
                try {
                    lease.release();
                }
                catch (error) {
                    primary ??= error;
                }
            if (written && primary !== undefined)
                this.#trip(primary);
            if (charge)
                this.#budget.release(charge);
            this.#end(t);
        }
        if (primary !== undefined)
            throw primary;
    }
    /** Narrow physical cell-transfer prerequisite, not balance or Insert. Packed
     * cell (including any overflow pointer) is copied before source freeSpace.
     * Only equal page formats are admitted; child remapping belongs to balance. */
    async transferCell(source, index, destination, slot, control) {
        const t = this.#begin();
        let scratch = 0, removed = false, writing = false, primary;
        let fromLease = null, toLease = null;
        try {
            if (source === destination)
                throw new Error("transfer requires distinct pages");
            for (const c of this.#registry)
                await cursors.get(c).save(t, control);
            for (const p of this.#pages.values())
                if (p.refs)
                    throw new Error("private transfer requires no foreign leases");
            await control.checkpoint(0);
            fromLease = this.#acquire(source);
            toLease = this.#acquire(destination);
            const from = fromLease.page, to = toLease.page;
            if (from.leaf !== to.leaf || from.nOverflow || to.nOverflow)
                throw new Error("unsupported transfer format/staging");
            if (!Number.isInteger(slot) || slot < 0 || slot > to.nCell)
                corrupt("invalid transfer destination slot");
            const cell = from.parseCell(index), offset = from.findCell(index);
            if (to.computeFreeSpace() < cell.nSize + 2)
                throw new Error("transfer requiring balance is unsupported");
            // Linear ownership: resident source -> pending transit -> resident target.
            // Transit remains in aggregate count; it is not NEW admission at capacity.
            this.#budget.reserve(cell.nSize + 64);
            scratch = cell.nSize + 64;
            const copy = this.#pages.get(source).bytes.slice(offset, offset + cell.nSize);
            const src = this.#pages.get(source), dst = this.#pages.get(destination);
            const make = (pgno, entry, remove, admit) => new PrivateIndexPage(pgno, entry.bytes, {
                reserve: n => this.#budget.reserve(n), release: n => this.#budget.release(n), removeEntries: remove, admitEntry: admit
            }, this.#maxKeyBytes);
            const drop = make(source, src, n => { src.entries -= n; this.#transit += n; removed = true; }, () => { throw new Error("transfer source cannot admit"); });
            const insert = make(destination, dst, () => { throw new Error("transfer target cannot remove"); }, () => this.#consumeTransit(dst));
            await drop.dropCell(index, cell.nSize, { checkpoint: async (units) => { await control.checkpoint(units); writing = true; } });
            await insert.insertCell(slot, copy, control);
            if (this.#transit !== 0)
                throw new Error("unconsumed transfer ownership");
            src.derived = null;
            dst.derived = null;
            this.#epoch++;
        }
        catch (error) {
            primary = error;
            if (removed || writing)
                this.#trip(error);
        }
        finally {
            for (const lease of [fromLease, toLease])
                if (lease)
                    try {
                        lease.release();
                    }
                    catch (error) {
                        primary ??= error;
                    }
            if ((removed || writing) && primary !== undefined)
                this.#trip(primary);
            if (scratch)
                this.#budget.release(scratch);
            this.#end(t);
        }
        if (primary !== undefined)
            throw primary;
    }
    reserveCursor(maxBytes, maxEntries) { this.#live(); if (this.#busy)
        throw new Error("private arena operation in progress"); if (maxBytes !== this.#budget.maxBytes)
        throw new PrivateStateLimitError("private byte limit mismatch with aggregate budget"); if (maxEntries !== this.#maxEntries)
        throw new PrivateStateLimitError("private entry limit mismatch with arena publication limit"); this.#budget.reserve(PRIVATE_CURSOR_CHARGE); }
    reserveScratch(bytes) { this.#budget.reserve(bytes); }
    releaseScratch(bytes) { this.#budget.release(bytes); }
    allocationCheckpoint(pgno) { this.#hook("allocate", pgno); }
    installPage(pgno, bytes) {
        this.#live();
        if (this.#busy)
            throw new Error("private arena operation in progress");
        if (bytes.length !== 4096 || pgno < 2 || !Number.isInteger(pgno))
            corrupt("invalid construction page");
        const old = this.#pages.get(pgno);
        for (const page of this.#pages.values())
            if (page.refs)
                throw new Error("construction arena is leased");
        if (!old && pgno !== this.#pages.size + 1)
            corrupt("noncontiguous construction page");
        const entries = (bytes[0] === 2 || bytes[0] === 10) ? get2(bytes, 3) : 0;
        let total = entries;
        for (const [number, p] of this.#pages)
            if (number !== pgno)
                total += p.entries;
        if (total > this.#maxEntries)
            throw new PrivateStateLimitError("private index entry limit");
        // Replacement scratch is charged at peak, even though old/new buffers have
        // the same capacity. No alias or net accounting hides the allocation.
        this.#budget.reserve(old ? 4096 : PRIVATE_PAGE_CHARGE);
        try {
            const copy = bytes.slice();
            this.#pages.set(pgno, { bytes: copy, refs: 0, derived: null, entries });
        }
        catch (error) {
            this.#budget.release(old ? 4096 : PRIVATE_PAGE_CHARGE);
            throw error;
        }
        if (old) {
            this.#disposeStaging(old.derived);
            this.#budget.release(4096);
        }
        this.#epoch++;
        put4(this.#pages.get(1).bytes, 28, this.#pages.size);
    }
    close() {
        if (this.#closed)
            return;
        if (this.#busy)
            throw new Error("private arena operation in progress");
        for (const page of this.#pages.values())
            if (page.refs)
                throw new Error("private arena has outstanding leases");
        let primary;
        for (const release of this.#results)
            try {
                release();
            }
            catch (error) {
                primary ??= error;
            }
        for (const page of this.#pages.values())
            try {
                this.#disposeStaging(page.derived);
            }
            catch (error) {
                primary ??= error;
            }
        this.#budget.release(this.#pages.size * PRIVATE_PAGE_CHARGE + PRIVATE_ARENA_CHARGE);
        this.#pages.clear();
        this.#closed = true;
        if (primary !== undefined)
            throw primary;
    }
}
/** Page-local IndexMoveto foundation. No GE/LE adjustment and no global keys.
 * Full packed overflow keys use charged scratch and raw-page leases; this is
 * the offset0/full-key accessPayload branch, not a general payload API.
 * No seek-result producer reuse/cache is exposed yet. */
export class PrivateBlobkeyCursor {
    #arena;
    #info;
    #limits;
    #current = null;
    #parents = [];
    #overflow = new Uint32Array(0);
    #overflowValid = false;
    #parentCapacity = 0;
    #positionBytes = 0;
    #resultBytes = 0;
    #token = null;
    #saved = null;
    #savedCharge = 0;
    #skipNext = 0;
    #pinned = false;
    #error;
    #index = 0;
    #state = "INVALID";
    #busy = false;
    #closed = false;
    constructor(arena, info, limits, options = {}) {
        // Read caller configuration once, before admission. This fixed-size snapshot
        // is included in PRIVATE_CURSOR_CHARGE; never consult caller limits on seek.
        const owned = { maxEntries: limits.maxEntries, maxKeyBytes: limits.maxKeyBytes, maxBytes: limits.maxBytes };
        if (!Number.isSafeInteger(owned.maxKeyBytes) || owned.maxKeyBytes < 0)
            throw new PrivateStateLimitError("invalid private key byte limit");
        if (!Number.isSafeInteger(owned.maxEntries) || owned.maxEntries < 0)
            throw new PrivateStateLimitError("invalid private entry limit");
        if (!Number.isSafeInteger(owned.maxBytes) || owned.maxBytes < 0)
            throw new PrivateStateLimitError("invalid private byte limit");
        Object.freeze(owned);
        arena.reserveCursor(owned.maxBytes, owned.maxEntries);
        this.#arena = arena;
        this.#info = info;
        this.#limits = owned;
        cursors.set(this, { save: async (t, control) => {
                this.#token = t;
                try {
                    if (this.#state === "VALID" || this.#state === "SKIPNEXT")
                        await this.#save(control);
                    else
                        this.#releasePath();
                }
                finally {
                    this.#token = null;
                }
            }, fault: error => { this.#discardSaved(); this.#state = "FAULT"; this.#error = error; try {
                this.#releasePath();
            }
            catch { /* terminal primary error remains authoritative */ } }, refs: () => this.#parents.length + (this.#current ? 1 : 0) });
        operations.get(arena).register(this, options.owning === true);
    }
    /** Independent diagnostic copies: 64 result/array bytes plus32 per parent,
     * retained at high-water until close, not GC/heap measurement. */
    get position() {
        if (this.#closed)
            throw new Error("private index cursor closed");
        const charge = 64 + 32 * this.#parents.length;
        this.#arena.reserveScratch(charge);
        try {
            const result = { page: this.#current?.page.pgno ?? 0, index: this.#index, state: this.#state, skipNext: this.#skipNext, overflowValid: this.#overflowValid, overflowCapacity: this.#overflow.length, parents: this.#parents.map(p => ({ page: p.lease.page.pgno, slot: p.slot })) };
            this.#positionBytes += charge;
            return result;
        }
        catch (error) {
            this.#arena.releaseScratch(charge);
            throw error;
        }
    }
    async #compare(index, key, control, shortcut = false, internal = false) {
        this.#overflowValid = false;
        const page = this.#current.page, bytes = internal ? operations.get(this.#arena).bytes(this.#token, page.pgno) : page.bytes;
        if (shortcut) {
            // indexCellCompare reads the raw payload prefix, not xParseCell. Unknown
            // probes rewind; full search retains complete cell validation below.
            const start = page.findCell(index) + page.childPtrSize;
            if (start >= 4096)
                return 99;
            let size = bytes[start], prefix = 1;
            if (size > 127) {
                if (start + 1 >= 4096 || bytes[start + 1] & 0x80)
                    return 99;
                size = ((size & 0x7f) << 7) + bytes[start + 1];
                prefix = 2;
                if (size > page.maxLocal)
                    return 99;
            }
            if (start + size >= 4096)
                return 99;
            if (size > this.#limits.maxKeyBytes)
                throw new PrivateStateLimitError("private index key exceeds byte limit");
            await control.checkpoint(size + key.nField);
            try {
                return compareRecordKey(bytes.subarray(start + prefix, start + prefix + size), key, this.#info, { maxBytes: this.#limits.maxKeyBytes });
            }
            catch (error) {
                // Native errCode disqualifies the probe and is reset before root search.
                // Only comparator corruption is adapted, never control/resource errors.
                if (error instanceof ComparisonError && error.reason === "corrupt")
                    return 99;
                throw error;
            }
        }
        const cell = page.parseCell(index);
        if (cell.nPayload > this.#limits.maxKeyBytes)
            throw new PrivateStateLimitError("private index key exceeds byte limit");
        if (cell.overflowOffset !== null) {
            if (cell.nPayload < 2 || Math.floor(cell.nPayload / 4096) > this.#arena.pageCount)
                throw new PrivateBlobkeyFormatError("invalid overflow key size");
            const capacity = cell.nPayload + 18;
            this.#arena.allocationCheckpoint(page.pgno);
            this.#arena.reserveScratch(capacity);
            try {
                const scratch = new Uint8Array(capacity);
                this.#index = index;
                await control.checkpoint(cell.nLocal);
                scratch.set(bytes.subarray(cell.payloadOffset, cell.payloadOffset + cell.nLocal));
                const count = Math.ceil((cell.nPayload - cell.nLocal) / 4092);
                if (this.#overflow.length < count) {
                    const bytes = count * 8;
                    this.#arena.allocationCheckpoint(page.pgno);
                    this.#arena.reserveScratch(bytes);
                    let cache;
                    try {
                        cache = new Uint32Array(count * 2);
                    }
                    catch (error) {
                        this.#arena.releaseScratch(bytes);
                        throw error;
                    }
                    this.#arena.releaseScratch(this.#overflow.byteLength);
                    this.#overflow = cache;
                }
                this.#overflow.fill(0, 0, count);
                let next = get4(bytes, cell.overflowOffset), written = cell.nLocal, i = 0;
                while (next && written < cell.nPayload) {
                    if (next > this.#arena.pageCount)
                        throw new PrivateBlobkeyFormatError("overflow page number outside arena");
                    this.#overflow[i++] = next;
                    const lease = operations.get(this.#arena).raw(this.#token, next);
                    let primary;
                    try {
                        next = get4(lease.bytes, 0);
                        const amount = Math.min(4092, cell.nPayload - written);
                        await control.checkpoint(amount);
                        copyBorrowedBytes(scratch, lease.bytes.subarray(4, 4 + amount), written);
                        written += amount;
                    }
                    catch (error) {
                        primary = error;
                        throw error;
                    }
                    finally {
                        try {
                            lease.release();
                        }
                        catch (error) {
                            if (primary === undefined)
                                throw error;
                        }
                    }
                }
                if (written < cell.nPayload)
                    throw new PrivateBlobkeyFormatError("overflow chain ends prematurely");
                await control.checkpoint(cell.nPayload + key.nField);
                const result = compareRecordKey(scratch.subarray(0, cell.nPayload), key, this.#info, { maxBytes: this.#limits.maxKeyBytes });
                // IndexMoveto clears BTCF_ValidOvfl after accessPayload even on
                // success; allocated overflow slots remain capacity, not valid cache.
                this.#overflowValid = false;
                return result;
            }
            finally {
                this.#arena.releaseScratch(capacity);
            }
        }
        await control.checkpoint(cell.nPayload + key.nField);
        return compareRecordKey(bytes.subarray(cell.payloadOffset, cell.payloadOffset + cell.nPayload), key, this.#info, { maxBytes: this.#limits.maxKeyBytes });
    }
    /** Native publishes caller-owned *pRes. Our independent result object admits
     * 64 deterministic metadata bytes, retained until close (not heap parity). */
    #result(res, publish = true) {
        this.#arena.reserveScratch(64);
        try {
            const result = { res, state: this.#state, page: this.#current.page.pgno, index: this.#index, epoch: this.#arena.epoch };
            if (publish)
                this.#resultBytes += 64;
            else
                this.#arena.releaseScratch(64);
            return result;
        }
        catch (error) {
            this.#arena.releaseScratch(64);
            throw error;
        }
    }
    #root() {
        this.#overflowValid = false;
        if (this.#parents.length) {
            // Release leaf and deeper ancestors, retaining the original root lease.
            let primary;
            const release = (lease) => { try {
                lease.release();
            }
            catch (error) {
                primary ??= error;
            } };
            release(this.#current);
            while (this.#parents.length > 1)
                release(this.#parents.pop().lease);
            this.#current = this.#parents.pop().lease;
            if (primary !== undefined) {
                this.#state = "INVALID";
                throw primary;
            }
        }
        else if (!this.#current) {
            // moveToRoot clears a REQUIRESEEK cursor before root acquisition;
            // a fresh seek must not retain the previous saved-position owner.
            if (this.#state === "FAULT")
                throw this.#error;
            if (this.#state === "REQUIRESEEK") {
                this.#discardSaved();
                this.#state = "INVALID";
                this.#skipNext = 0;
            }
            try {
                this.#current = operations.get(this.#arena).acquire(this.#token, this.#arena.root);
            }
            catch (error) {
                this.#state = "INVALID";
                throw error;
            }
        }
        this.#index = 0;
        const root = this.#current.page;
        if (root.nCell === 0) {
            this.#state = "INVALID";
            if (!root.leaf)
                throw new PrivateBlobkeyFormatError("empty interior private root");
            return;
        }
        this.#state = "VALID";
    }
    /** Narrow typed equal/same-length writer slice; not NEW insertion/balance.
     * Packed bytes own publication. Always reseek; no scalar authority accepted. */
    async replaceIndexEqual(payload, control) { return this.#writeIndex(payload, control, false); }
    /** Interim nonstaging leaf producer. Not the full BtreeInsert admission. */
    async insertIndexLocal(payload, control) { return this.#writeIndex(payload, control, true); }
    /** Packed seek-owning writer; SAVEPosition only after balance; full error/peak audit pending. */
    async insertIndex(payload, options, control) {
        if (Reflect.ownKeys(options).some(k => k !== "savePosition") || (options.savePosition !== undefined && typeof options.savePosition !== "boolean"))
            throw new Error("private Insert options unadmitted");
        return this.#writeIndex(payload, control, true, true, options.savePosition === true);
    }
    async #writeIndex(payload, control, allowNew, balance = false, savePosition = false) {
        if (this.#closed)
            throw new Error("private index cursor closed");
        const ops = operations.get(this.#arena), t = ops.begin();
        this.#token = t;
        let charge = 0, key = null;
        const life = new BorrowLifetime();
        try {
            if (payload.length > this.#limits.maxKeyBytes)
                throw new PrivateStateLimitError("private key exceeds byte limit");
            // Packed snapshot plus bounded decoder/Mem descriptors and text/blob
            // decode capacity remain charged while moveto owns its second snapshot.
            const peak = 128 + this.#info.totalFieldCount * 128 + payload.length * 3;
            this.#arena.reserveScratch(peak);
            charge = peak;
            if (!control.snapshotCheckpoint && payload.length > 4096) {
                await control.checkpoint(0);
                throw new Error("large private input requires synchronous snapshot checkpoint");
            }
            control.snapshotCheckpoint?.(0);
            const owned = new Uint8Array(payload.length);
            for (let offset = 0; offset < payload.length; offset += 4096) {
                const n = Math.min(4096, payload.length - offset);
                control.snapshotCheckpoint?.(n);
                owned.set(payload.subarray(offset, offset + n), offset);
            }
            await ops.savePeers(t, this, control);
            await control.checkpoint(owned.length);
            key = unpackRecordKey(owned, this.#info, life, { defaultRc: 0, caller: "record" });
            if (key.nField !== this.#info.totalFieldCount)
                throw new Error("equal writer requires full KeyInfo key");
            const result = await this.#moveto(key, control, false);
            this.#overflowValid = false;
            if (result.res === 0 && result.state === "VALID") {
                const page = this.#current.page;
                if (allowNew && page.parseCell(this.#index).nPayload !== owned.length)
                    await ops.insertLocal(t, page.pgno, this.#index, owned, control, true, balance);
                else
                    await ops.overwrite(t, page.pgno, this.#index, owned, control);
            }
            else {
                if (!allowNew)
                    throw new Error("equal writer requires existing equal key");
                const index = result.index + (result.res < 0 && result.state === "VALID" ? 1 : 0);
                await ops.insertLocal(t, result.page, index, owned, control, false, balance);
                this.#index = index;
                this.#state = "VALID";
            }
            if (balance && this.#current.page.nOverflow) {
                let pathCharge = 0, balanced = false;
                // Publication already happened. Even descriptor admission failure
                // must not leave a VALID cursor exposing unresolved overflow staging.
                this.#state = "INVALID";
                try {
                    this.#arena.reserveScratch(576);
                    pathCharge = 576;
                    const path = this.#parents.map(p => p.lease.page.pgno), indices = this.#parents.map(p => p.slot);
                    path.push(this.#current.page.pgno);
                    this.#state = "INVALID";
                    this.#releasePath();
                    await ops.balance(t, path, indices, control);
                    balanced = true;
                    if (savePosition) {
                        // Native post-balance save owns the supplied packed key, not a
                        // cursor-position read (the old path is no longer meaningful).
                        const savedCharge = owned.length + 17 + 64;
                        this.#arena.allocationCheckpoint(path[0]);
                        this.#arena.reserveScratch(savedCharge);
                        let retained = false;
                        try {
                            const packed = new Uint8Array(owned.length + 17);
                            packed.set(owned);
                            this.#discardSaved();
                            this.#saved = packed;
                            this.#savedCharge = savedCharge;
                            this.#skipNext = 0;
                            this.#state = "REQUIRESEEK";
                            retained = true;
                        }
                        finally {
                            if (!retained)
                                this.#arena.releaseScratch(savedCharge);
                        }
                    }
                }
                catch (error) {
                    if (!balanced)
                        ops.fault(t, error);
                    throw error;
                }
                finally {
                    if (pathCharge)
                        this.#arena.releaseScratch(pathCharge);
                }
            }
        }
        finally {
            key?.release();
            life.invalidate();
            if (charge)
                this.#arena.releaseScratch(charge);
            this.#token = null;
            ops.end(t);
        }
    }
    // btree.c sqlite3BtreeFirst/moveToLeftmost/btreeNext. Index interior
    // cells are records, not merely separators: ascend to the parent slot.
    async #scanChild(slot, control) {
        const parent = this.#current, page = parent.page;
        if (this.#parents.length >= 19)
            throw new PrivateBlobkeyFormatError("private index depth exceeded");
        await control.checkpoint(1);
        const child = slot === page.nCell ? page.rightChild() : page.leftChild(slot);
        const grow = this.#parents.length === this.#parentCapacity;
        if (grow)
            this.#arena.reserveScratch(PRIVATE_PARENT_SLOT_CHARGE);
        try {
            this.#parents.push({ lease: parent, slot });
        }
        catch (error) {
            if (grow)
                this.#arena.releaseScratch(PRIVATE_PARENT_SLOT_CHARGE);
            throw error;
        }
        if (grow)
            this.#parentCapacity++;
        let acquired = null;
        try {
            acquired = operations.get(this.#arena).acquire(this.#token, child);
            if (acquired.page.nCell < 1)
                throw new PrivateBlobkeyFormatError("empty child private page");
            this.#current = acquired;
            this.#index = 0;
        }
        catch (error) {
            if (acquired)
                acquired.release();
            this.#current = this.#parents.pop().lease;
            throw error;
        }
    }
    async #leftmost(control) {
        while (!this.#current.page.leaf)
            await this.#scanChild(0, control);
    }
    async first(control) {
        if (this.#closed)
            throw new Error("private index cursor closed");
        const ops = operations.get(this.#arena), t = ops.begin();
        this.#token = t;
        try {
            await control.checkpoint(1);
            this.#root();
            if (this.#state === "INVALID")
                return false;
            await this.#leftmost(control);
            return true;
        }
        catch (error) {
            this.#state = "INVALID";
            this.#releasePath();
            throw error;
        }
        finally {
            this.#token = null;
            ops.end(t);
        }
    }
    async next(control) {
        if (this.#closed)
            throw new Error("private index cursor closed");
        if (this.#state === "FAULT")
            throw this.#error;
        if (this.#state === "REQUIRESEEK")
            await this.restoreCursorPosition(control);
        const ops = operations.get(this.#arena), t = ops.begin();
        this.#token = t;
        try {
            await control.checkpoint(1);
            this.#overflowValid = false;
            if (this.#state === "INVALID")
                return false;
            if (this.#state === "SKIPNEXT") {
                this.#state = "VALID";
                if (this.#skipNext > 0)
                    return true;
            }
            this.#index++;
            const page = this.#current.page;
            if (!page.leaf) {
                await this.#scanChild(this.#index, control);
                await this.#leftmost(control);
                return true;
            }
            while (this.#index >= this.#current.page.nCell) {
                if (!this.#parents.length) {
                    this.#state = "INVALID";
                    return false;
                }
                this.#current.release();
                const parent = this.#parents.pop();
                this.#current = parent.lease;
                this.#index = parent.slot;
            }
            return true;
        }
        catch (error) {
            this.#state = "INVALID";
            this.#releasePath();
            throw error;
        }
        finally {
            this.#token = null;
            ops.end(t);
        }
    }
    /** accessPayload snapshot: callback cannot retain a page borrow across moves.
     * Scratch is charged until the consumer returns, including awaited work. */
    async withPayload(control, consume) {
        if (this.#closed)
            throw new Error("private index cursor closed");
        if (this.#state === "FAULT")
            throw this.#error;
        const ops = operations.get(this.#arena), t = ops.begin();
        this.#token = t;
        let charge = 0;
        try {
            if (this.#state !== "VALID" && this.#state !== "SKIPNEXT")
                throw new Error("private payload on unpositioned cursor");
            const page = this.#current.page, cell = page.parseCell(this.#index);
            if (cell.nPayload > this.#limits.maxKeyBytes)
                throw new PrivateStateLimitError("private payload exceeds byte limit");
            this.#arena.allocationCheckpoint(page.pgno);
            this.#arena.reserveScratch(cell.nPayload + 64);
            charge = cell.nPayload + 64;
            const bytes = new Uint8Array(cell.nPayload);
            await control.checkpoint(cell.nLocal);
            bytes.set(page.bytes.subarray(cell.payloadOffset, cell.payloadOffset + cell.nLocal));
            let written = cell.nLocal, next = cell.overflowOffset === null ? 0 : get4(page.bytes, cell.overflowOffset);
            while (written < cell.nPayload) {
                await control.checkpoint(0);
                const lease = ops.raw(t, next);
                let primary;
                try {
                    const amount = Math.min(4092, cell.nPayload - written);
                    await control.checkpoint(amount);
                    copyBorrowedBytes(bytes, lease.bytes.subarray(4, 4 + amount), written);
                    written += amount;
                    if (written < cell.nPayload)
                        next = get4(lease.bytes, 0);
                }
                catch (error) {
                    primary = error;
                    throw error;
                }
                finally {
                    try {
                        lease.release();
                    }
                    catch (error) {
                        if (primary === undefined)
                            throw error;
                    }
                }
            }
            return await consume(bytes);
        }
        finally {
            if (charge)
                this.#arena.releaseScratch(charge);
            this.#token = null;
            ops.end(t);
        }
    }
    async indexMoveto(key, control) {
        if (this.#closed)
            throw new Error("private index cursor closed");
        const t = operations.get(this.#arena).begin();
        this.#token = t;
        try {
            return await this.#moveto(key, control);
        }
        finally {
            this.#token = null;
            operations.get(this.#arena).end(t);
        }
    }
    async #moveto(key, control, publish = true, restoring = false) {
        if (this.#closed)
            throw new Error("private index cursor closed");
        if (this.#busy)
            throw new Error("private index operation in progress");
        key.assertLive();
        if (key.keyInfo !== this.#info)
            throw new Error("private cursor KeyInfo mismatch");
        this.#overflowValid = false;
        this.#busy = true;
        key.errCode = 0;
        // Failed native restore retains pKey in INVALID. An explicit new seek
        // supersedes that owner; restore itself retains it through failure.
        if (!restoring && this.#state === "INVALID" && this.#saved)
            this.#discardSaved();
        const caller = key, copies = [];
        let targetCharge = 0;
        try {
            // Native borrows pIdxKey for a synchronous call. Own it before our first
            // await; a bounded snapshot preserves call-time identity and Mem forms.
            let bytes = 0;
            for (const value of caller.values) {
                const d = value.diagnostic();
                if (d.manifest === "aggregate" || d.manifest === "rowset")
                    throw new Error("invalid private seek target");
                bytes += d.byteLength + (d.numeric ? 8 : 0);
            }
            if (bytes > this.#limits.maxKeyBytes)
                throw new PrivateStateLimitError("private seek target exceeds byte limit");
            control.snapshotCheckpoint?.(0);
            const charge = 128 + caller.values.length * 128 + bytes;
            this.#arena.reserveScratch(charge);
            targetCharge = charge;
            for (const value of caller.values) {
                const copy = new Mem();
                copies.push(copy);
                copy.copyFromSnapshot(value, units => control.snapshotCheckpoint?.(units));
            }
            key = new UnpackedRecordKey(copies, caller.defaultRc, caller.caller, caller.keyInfo);
            key.nField = caller.nField;
            key.eqSeen = caller.eqSeen;
            await control.checkpoint(bytes + copies.length);
            let bypass = false;
            if (this.#state === "VALID" && this.#current.page.leaf && this.#parents.every(p => p.slot === p.lease.page.nCell)) {
                const page = this.#current.page;
                if (this.#index === page.nCell - 1) {
                    const c = await this.#compare(this.#index, key, control, true, !publish);
                    if (c <= 0)
                        return this.#result(c, publish);
                }
                if (this.#parents.length && await this.#compare(0, key, control, true, !publish) <= 0)
                    bypass = true;
            }
            if (!bypass) {
                this.#root();
                if (this.#state === "INVALID")
                    return this.#result(-1, publish);
            }
            for (;;) {
                const page = this.#current.page;
                let lower = 0, upper = page.nCell - 1, index = upper >> 1, c = 0;
                for (;;) {
                    c = await this.#compare(index, key, control, false, !publish);
                    if (c < 0)
                        lower = index + 1;
                    else if (c > 0)
                        upper = index - 1;
                    else {
                        this.#index = index;
                        return this.#result(0, publish);
                    }
                    if (lower > upper)
                        break;
                    index = (lower + upper) >> 1;
                }
                if (page.leaf) {
                    this.#index = index;
                    return this.#result(c, publish);
                }
                if (this.#parents.length >= 19)
                    throw new PrivateBlobkeyFormatError("private index depth exceeded");
                const child = lower >= page.nCell ? page.rightChild() : page.leftChild(lower);
                const parent = this.#current;
                const grow = this.#parents.length === this.#parentCapacity;
                if (grow)
                    this.#arena.reserveScratch(PRIVATE_PARENT_SLOT_CHARGE);
                try {
                    this.#parents.push({ lease: parent, slot: lower });
                }
                catch (error) {
                    if (grow)
                        this.#arena.releaseScratch(PRIVATE_PARENT_SLOT_CHARGE);
                    throw error;
                }
                if (grow)
                    this.#parentCapacity++;
                this.#index = 0;
                let acquired = null;
                try {
                    acquired = operations.get(this.#arena).acquire(this.#token, child);
                    if (acquired.page.nCell < 1)
                        throw new PrivateBlobkeyFormatError("empty child private page");
                    this.#current = acquired;
                }
                catch (error) {
                    if (acquired)
                        try {
                            acquired.release();
                        }
                        catch { /* preserve acquisition/validation error */ }
                    this.#current = this.#parents.pop().lease;
                    throw error;
                }
            }
        }
        finally {
            caller.eqSeen = key.eqSeen;
            caller.errCode = key.errCode;
            for (const copy of copies)
                copy.release();
            this.#arena.releaseScratch(targetCharge);
            this.#busy = false;
        }
    }
    #releasePath() {
        this.#overflowValid = false;
        let primary;
        const current = this.#current;
        this.#current = null;
        if (current)
            try {
                current.release();
            }
            catch (error) {
                primary = error;
            }
        while (this.#parents.length)
            try {
                this.#parents.pop().lease.release();
            }
            catch (error) {
                primary ??= error;
            }
        if (primary !== undefined)
            throw primary;
    }
    #discardSaved() { this.#saved = null; this.#arena.releaseScratch(this.#savedCharge); this.#savedCharge = 0; }
    setPinned(pinned) {
        if (this.#closed)
            throw new Error("private index cursor closed");
        const t = operations.get(this.#arena).begin();
        try {
            this.#pinned = pinned;
        }
        finally {
            operations.get(this.#arena).end(t);
        }
    }
    async saveCursorPosition(control) {
        if (this.#closed)
            throw new Error("private index cursor closed");
        const t = operations.get(this.#arena).begin();
        this.#token = t;
        this.#busy = true;
        try {
            await this.#save(control);
        }
        finally {
            this.#busy = false;
            this.#token = null;
            operations.get(this.#arena).end(t);
        }
    }
    async #save(control) {
        const t = this.#token;
        let pending = 0;
        try {
            if (this.#state !== "VALID" && this.#state !== "SKIPNEXT")
                return;
            if (this.#pinned)
                throw new Error("private cursor pinned");
            if (this.#saved)
                throw new Error("private cursor already has saved key");
            if (this.#state === "SKIPNEXT")
                this.#state = "VALID";
            else
                this.#skipNext = 0;
            const page = this.#current.page, cell = page.parseCell(this.#index);
            if (cell.nPayload > this.#limits.maxKeyBytes)
                throw new PrivateStateLimitError("private saved key exceeds byte limit");
            const charge = cell.nPayload + 17 + 64;
            this.#arena.allocationCheckpoint(page.pgno);
            this.#arena.reserveScratch(charge);
            pending = charge;
            const packed = new Uint8Array(cell.nPayload + 17);
            await control.checkpoint(cell.nLocal);
            packed.set(page.bytes.subarray(cell.payloadOffset, cell.payloadOffset + cell.nLocal));
            let written = cell.nLocal, next = cell.overflowOffset === null ? 0 : get4(page.bytes, cell.overflowOffset);
            while (written < cell.nPayload) {
                await control.checkpoint(0);
                const lease = operations.get(this.#arena).raw(t, next);
                let primary;
                try {
                    const amount = Math.min(4092, cell.nPayload - written);
                    await control.checkpoint(amount);
                    copyBorrowedBytes(packed, lease.bytes.subarray(4, 4 + amount), written);
                    written += amount;
                    if (written < cell.nPayload)
                        next = get4(lease.bytes, 0);
                }
                catch (error) {
                    primary = error;
                    throw error;
                }
                finally {
                    try {
                        lease.release();
                    }
                    catch (error) {
                        if (primary === undefined)
                            throw error;
                    }
                }
            }
            this.#saved = packed;
            this.#savedCharge = charge;
            pending = 0;
            this.#state = "REQUIRESEEK";
            this.#releasePath();
        }
        finally {
            this.#overflowValid = false;
            if (pending)
                this.#arena.releaseScratch(pending);
        }
    }
    async restoreCursorPosition(control) {
        if (this.#closed)
            throw new Error("private index cursor closed");
        const t = operations.get(this.#arena).begin();
        this.#token = t;
        try {
            if (this.#state !== "REQUIRESEEK")
                return;
            this.#state = "INVALID";
            const life = new BorrowLifetime();
            const key = unpackRecordKey(this.#saved.subarray(0, this.#saved.length - 17), this.#info, life, { caller: "record" });
            try {
                const result = await this.#moveto(key, control, true, true);
                this.#discardSaved();
                if (result.res)
                    this.#skipNext = result.res;
                if (this.#skipNext && result.state === "VALID")
                    this.#state = "SKIPNEXT";
            }
            catch (error) {
                this.#state = "INVALID";
                throw error;
            }
            finally {
                key.release();
                life.invalidate();
            }
        }
        finally {
            this.#token = null;
            operations.get(this.#arena).end(t);
        }
    }
    clearCursor() {
        if (this.#closed)
            throw new Error("private index cursor closed");
        const t = operations.get(this.#arena).begin();
        try {
            this.#overflowValid = false;
            this.#discardSaved();
            this.#state = "INVALID";
        }
        finally {
            operations.get(this.#arena).end(t);
        }
    }
    close() {
        if (this.#closed)
            return;
        if (this.#busy)
            throw new Error("private index operation in progress");
        const t = operations.get(this.#arena).begin(true);
        try {
            operations.get(this.#arena).checkClose();
        }
        catch (error) {
            operations.get(this.#arena).end(t);
            throw error;
        }
        const dispose = operations.get(this.#arena).unlink(this);
        let primary;
        const release = (lease) => { try {
            lease.release();
        }
        catch (error) {
            primary ??= error;
        } };
        if (this.#current)
            release(this.#current);
        while (this.#parents.length)
            release(this.#parents.pop().lease);
        this.#discardSaved();
        this.#arena.releaseScratch(this.#overflow.byteLength + PRIVATE_CURSOR_CHARGE + this.#parentCapacity * PRIVATE_PARENT_SLOT_CHARGE + this.#positionBytes + this.#resultBytes);
        this.#positionBytes = 0;
        this.#resultBytes = 0;
        this.#overflow = new Uint32Array(0);
        this.#parentCapacity = 0;
        this.#current = null;
        this.#state = "INVALID";
        this.#closed = true;
        operations.get(this.#arena).end(t);
        if (dispose)
            try {
                this.#arena.close();
            }
            catch (error) {
                primary ??= error;
            }
        if (primary !== undefined)
            throw primary;
    }
}
