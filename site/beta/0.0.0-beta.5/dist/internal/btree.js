import { decodeVarint } from "./record.js";
import { ComparisonError, compareRecordKey, UnpackedRecordKey } from "./comparison.js";
import { ImmutableStorage, StorageClosedError, StorageCorruptError, storageOwner } from "./storage.js";
/** Read-only translation of the pinned btree.c page, cell, payload and cursor paths. */
export class BtreeFormatError extends Error {
    constructor(message) { super(message); this.name = "BtreeFormatError"; }
}
export class BtreeCursorStateError extends Error {
    constructor(message) { super(message); this.name = "BtreeCursorStateError"; }
}
/** A configured traversal ceiling, distinct from programmer RangeError and
 * malformed database input. Public execution maps only this provenance to limit. */
export class BtreeLimitError extends Error {
    limit;
    constructor(limit) {
        super(`${limit} exceeded`);
        this.name = "BtreeLimitError";
        this.limit = limit;
    }
}
function corrupt(message) { throw new BtreeFormatError(message); }
function be16(bytes, at) {
    if (at < 0 || at + 2 > bytes.byteLength)
        corrupt("truncated u16");
    return bytes[at] * 256 + bytes[at + 1];
}
function be32(bytes, at) {
    if (at < 0 || at + 4 > bytes.byteLength)
        corrupt("truncated u32");
    return bytes[at] * 0x1000000 + bytes[at + 1] * 0x10000 + bytes[at + 2] * 256 + bytes[at + 3];
}
function limit(value, fallback, name) {
    const result = value ?? fallback;
    if (!Number.isSafeInteger(result) || result < 1)
        throw new RangeError(`${name} must be a positive safe integer`);
    return result;
}
export class BtreeDatabase {
    #storage;
    reserveSchemaTemporary(bytes) { return this.#storage.reserveSchemaTemporary(bytes); }
    pageSize;
    pageCount;
    usableSize;
    encoding;
    maxBtreeDepth;
    maxOverflowPages;
    constructor(storage, limits = {}) {
        try {
            storage.assertOpen();
        }
        catch (error) {
            if (error instanceof StorageClosedError)
                throw new BtreeCursorStateError(error.message);
            throw error;
        }
        this.#storage = storage;
        this.pageSize = storage.pageSize;
        this.usableSize = storage.usableSize;
        this.pageCount = storage.pageCount;
        this.encoding = storage.encoding === 2 ? "utf-16le" : storage.encoding === 3 ? "utf-16be" : "utf-8";
        this.maxBtreeDepth = limit(limits.maxBtreeDepth, 64, "maxBtreeDepth");
        this.maxOverflowPages = limit(limits.maxOverflowPages, this.pageCount, "maxOverflowPages");
    }
    close() { this.#storage.close(); }
    assertOpen() {
        try {
            this.#storage.assertOpen();
        }
        catch (error) {
            if (error instanceof StorageClosedError)
                throw new BtreeCursorStateError(error.message);
            throw error;
        }
    }
    tableCursor(root) { this.assertOpen(); return new TableCursor(this, root); }
    /** Forward-only table scan used by the VDBE. Opening does not recursively
     * materialize the whole tree; first/next resume depth-first traversal. */
    tableScanCursor(root) { return new TableScanCursor(this, this.iterateTable(root, 0, new Set())); }
    indexCursor(root) { this.assertOpen(); return new IndexCursor(this, root); }
    pageBytes(pgno) {
        this.assertOpen();
        if (!Number.isSafeInteger(pgno) || pgno < 1 || pgno > this.pageCount)
            corrupt("page number outside database");
        const start = (pgno - 1) * this.pageSize;
        try {
            return this.#storage.read(start, this.pageSize);
        }
        catch (error) {
            if (error instanceof StorageCorruptError)
                corrupt(error.message);
            throw error;
        }
    }
    page(pgno, allowed) {
        const bytes = this.pageBytes(pgno);
        const h = pgno === 1 ? 100 : 0;
        if (h + 8 > this.usableSize)
            corrupt("truncated b-tree header");
        const type = bytes[h];
        if (!allowed.includes(type))
            corrupt("unexpected b-tree page type");
        const interior = type === 0x02 || type === 0x05;
        const hs = interior ? 12 : 8;
        const count = be16(bytes, h + 3);
        const pointerEnd = h + hs + count * 2;
        if (pointerEnd > this.usableSize)
            corrupt("cell pointer array exceeds page");
        const rawContent = be16(bytes, h + 5);
        const content = rawContent === 0 && this.pageSize === 65536 ? 65536 : rawContent;
        if (content < pointerEnd || content > this.usableSize)
            corrupt("invalid cell content boundary");
        const cells = [];
        const seen = new Set();
        for (let i = 0; i < count; i++) {
            const cell = be16(bytes, h + hs + i * 2);
            if (cell < content || cell >= this.usableSize || seen.has(cell))
                corrupt("invalid or duplicate cell pointer");
            seen.add(cell);
            cells.push(cell);
        }
        const rightChild = interior ? be32(bytes, h + 8) : null;
        if (rightChild !== null && (rightChild < 1 || rightChild > this.pageCount))
            corrupt("invalid right child");
        return { number: pgno, bytes, type, cells, rightChild };
    }
    #payloadCell(page, start, tableLeaf) {
        let at = start;
        if (page.type === 0x02)
            at += 4;
        let payload;
        try {
            payload = decodeVarint(page.bytes, at, this.usableSize);
        }
        catch {
            return corrupt("truncated payload varint");
        }
        at += payload.length;
        let rowid;
        if (tableLeaf) {
            let key;
            try {
                key = decodeVarint(page.bytes, at, this.usableSize);
            }
            catch {
                return corrupt("truncated rowid varint");
            }
            at += key.length;
            rowid = BigInt.asIntN(64, key.value);
        }
        if (payload.value > BigInt(Number.MAX_SAFE_INTEGER))
            corrupt("payload too large");
        const nPayload = Number(payload.value);
        const minLocal = Math.floor(((this.usableSize - 12) * 32) / 255) - 23;
        const maxLocal = tableLeaf ? this.usableSize - 35 : Math.floor(((this.usableSize - 12) * 64) / 255) - 23;
        let local = nPayload;
        if (local > maxLocal) {
            local = minLocal + ((local - minLocal) % (this.usableSize - 4));
            if (local > maxLocal)
                local = minLocal;
        }
        const overflow = nPayload > local;
        if (at + local + (overflow ? 4 : 0) > this.usableSize)
            corrupt("cell exceeds usable page");
        const base = { payloadLength: nPayload, local: page.bytes.subarray(at, at + local), overflowPage: overflow ? be32(page.bytes, at + local) : null, pageNumber: page.number, cellOffset: start };
        if (base.overflowPage !== null && (base.overflowPage < 2 || base.overflowPage > this.pageCount))
            corrupt("invalid overflow page");
        return rowid === undefined ? base : { ...base, rowid };
    }
    readTable(root) {
        const output = [];
        const path = new Set();
        const visit = (pgno, depth) => {
            if (depth >= this.maxBtreeDepth)
                throw new BtreeLimitError("maxBtreeDepth");
            if (path.has(pgno))
                corrupt("b-tree cycle");
            path.add(pgno);
            const page = this.page(pgno, [0x05, 0x0d]);
            if (page.type === 0x0d) {
                for (const offset of page.cells)
                    output.push(this.#payloadCell(page, offset, true));
            }
            else {
                for (const offset of page.cells) {
                    if (offset + 4 > this.usableSize)
                        corrupt("truncated table interior cell");
                    visit(be32(page.bytes, offset), depth + 1);
                }
                visit(page.rightChild, depth + 1);
            }
            path.delete(pgno);
        };
        visit(root, 0);
        for (let i = 1; i < output.length; i++)
            if (output[i - 1].rowid >= output[i].rowid)
                corrupt("unordered table b-tree");
        return output;
    }
    tableSeek(root, key, bias) {
        const maximum = (pgno, depth, path) => {
            if (depth >= this.maxBtreeDepth)
                throw new BtreeLimitError("maxBtreeDepth");
            if (path.has(pgno))
                corrupt("b-tree cycle");
            path.add(pgno);
            try {
                const page = this.page(pgno, [0x05, 0x0d]);
                if (page.type === 0x0d) {
                    if (page.cells.length === 0)
                        return corrupt("empty table leaf");
                    return this.#payloadCell(page, page.cells.at(-1), true);
                }
                return maximum(page.rightChild, depth + 1, path);
            }
            finally {
                path.delete(pgno);
            }
        };
        const descend = (pgno, depth, path) => {
            if (depth >= this.maxBtreeDepth)
                throw new BtreeLimitError("maxBtreeDepth");
            if (path.has(pgno))
                corrupt("b-tree cycle");
            path.add(pgno);
            try {
                const page = this.page(pgno, [0x05, 0x0d]);
                if (page.type === 0x0d) {
                    const entries = page.cells.map((offset) => this.#payloadCell(page, offset, true));
                    let lo = 0, hi = entries.length;
                    while (lo < hi) {
                        const mid = (lo + hi) >>> 1;
                        if (entries[mid].rowid < key)
                            lo = mid + 1;
                        else
                            hi = mid;
                    }
                    const exact = lo < entries.length && entries[lo].rowid === key;
                    const index = bias === "ge" ? lo : exact ? lo : lo - 1;
                    return { entry: index >= 0 && index < entries.length ? entries[index] : null, exact };
                }
                let childIndex = page.cells.length;
                for (let i = 0; i < page.cells.length; i++) {
                    const offset = page.cells[i];
                    if (offset + 4 > this.usableSize)
                        corrupt("truncated table interior cell");
                    let separator;
                    try {
                        separator = decodeVarint(page.bytes, offset + 4, this.usableSize);
                    }
                    catch {
                        return corrupt("truncated table interior key");
                    }
                    if (BigInt.asIntN(64, separator.value) >= key) {
                        childIndex = i;
                        break;
                    }
                }
                const child = childIndex < page.cells.length
                    ? be32(page.bytes, page.cells[childIndex]) : page.rightChild;
                const nested = descend(child, depth + 1, path);
                if (nested.entry !== null || bias === "ge" || childIndex === 0)
                    return nested;
                const preceding = be32(page.bytes, page.cells[childIndex - 1]);
                return { entry: maximum(preceding, depth + 1, path), exact: false };
            }
            finally {
                path.delete(pgno);
            }
        };
        return descend(root, 0, new Set());
    }
    indexSeek(root, compareCurrentToTarget, bias, current = null, exactMatch = false) {
        this.assertOpen();
        // BtCursor.apPage/pPage: retain initialized pages only on this cursor path.
        const retained = new Map(current?.ancestors.map(a => [a.pageNumber, a.page]));
        if (current)
            retained.set(current.pageNumber, current.page);
        const descend = (pgno, depth, path, ancestors) => {
            if (depth >= this.maxBtreeDepth)
                throw new BtreeLimitError("maxBtreeDepth");
            if (path.has(pgno))
                corrupt("b-tree cycle");
            path.add(pgno);
            try {
                const page = retained.get(pgno) ?? this.page(pgno, [0x02, 0x0a]);
                // btree.c sqlite3BtreeIndexMoveto parses the probed cell, not
                // every payload on the page. Retain pointer validation in page(),
                // but decode payload headers only for binary-search probes/results.
                const cells = page.cells;
                const at = (cellIndex) => ({ entry: this.#payloadCell(page, cells[cellIndex], false), page, pageNumber: pgno, cellIndex, ancestors });
                let lo = 0, hi = cells.length;
                // Seek opcodes compare an unpacked prefix, not necessarily a unique
                // full key. An equal interior separator is a real index entry but is
                // not the boundary: equal prefixes may also live in its child. Match
                // vdbe.c SeekGE/SeekLE default_rc bias through IndexMoveto descent.
                while (lo < hi) {
                    const mid = (lo + hi) >>> 1, comparison = compareCurrentToTarget(this.payload(this.#payloadCell(page, cells[mid], false)));
                    // IndexMoveto default_rc0 returns the matched interior/leaf cell
                    // immediately. Boundary seeks must still descend equal prefixes.
                    if (exactMatch && comparison === 0)
                        return { position: at(mid), exact: true };
                    if (comparison < 0 || (comparison === 0 && bias === "le"))
                        lo = mid + 1;
                    else
                        hi = mid;
                }
                const result = (cellIndex) => {
                    const position = at(cellIndex);
                    return { position, exact: compareCurrentToTarget(this.payload(position.entry)) === 0 };
                };
                if (page.type === 0x0a) {
                    const index = bias === "ge" ? lo : lo - 1;
                    return index >= 0 && index < cells.length ? result(index) : { position: null, exact: false };
                }
                const child = lo < cells.length ? be32(page.bytes, page.cells[lo]) : page.rightChild;
                const nested = descend(child, depth + 1, path, [...ancestors, { pageNumber: pgno, childIndex: lo, page }]);
                if (nested.position !== null)
                    return nested;
                if (bias === "ge" && lo < cells.length)
                    return result(lo);
                if (bias === "le" && lo > 0)
                    return result(lo - 1);
                return { position: null, exact: false };
            }
            finally {
                path.delete(pgno);
            }
        };
        // btree.c:cursorOnLastPage / sqlite3BtreeIndexMoveto. Only the
        // rightmost leaf can bypass the root, and prefix boundary semantics
        // require a strictly smaller first key (an equal prefix may precede it).
        if (current && current.ancestors.every(ancestor => ancestor.childIndex === ancestor.page.cells.length)) {
            const page = current.page;
            if (page.type === 0x0a && page.cells.length > 0 && current.ancestors.length > 0 &&
                compareCurrentToTarget(this.payload(this.#payloadCell(page, page.cells[0], false))) < 0) {
                return descend(current.pageNumber, current.ancestors.length, new Set(current.ancestors.map(ancestor => ancestor.pageNumber)), current.ancestors);
            }
        }
        return descend(root, 0, new Set(), []);
    }
    indexBoundary(root, direction) {
        return this.#indexBoundary(root, direction, [], new Set());
    }
    #indexBoundary(pgno, direction, ancestors, path) {
        if (ancestors.length >= this.maxBtreeDepth)
            throw new BtreeLimitError("maxBtreeDepth");
        if (path.has(pgno))
            corrupt("b-tree cycle");
        path.add(pgno);
        try {
            const page = this.page(pgno, [0x02, 0x0a]);
            if (page.type === 0x0a) {
                if (page.cells.length === 0)
                    return null;
                const cellIndex = direction === "first" ? 0 : page.cells.length - 1;
                return { entry: this.#payloadCell(page, page.cells[cellIndex], false), page, pageNumber: pgno, cellIndex, ancestors };
            }
            const childIndex = direction === "first" ? 0 : page.cells.length;
            const child = childIndex < page.cells.length ? be32(page.bytes, page.cells[childIndex]) : page.rightChild;
            return this.#indexBoundary(child, direction, [...ancestors, { pageNumber: pgno, childIndex, page }], path);
        }
        finally {
            path.delete(pgno);
        }
    }
    indexMove(position, direction) {
        this.assertOpen();
        const page = position.page;
        if (position.cellIndex < 0 || position.cellIndex >= page.cells.length
            || page.cells[position.cellIndex] !== position.entry.cellOffset)
            corrupt("index cursor position changed");
        const at = (owner, cellIndex, ancestors) => ({
            entry: this.#payloadCell(owner, owner.cells[cellIndex], false), page: owner, pageNumber: owner.number, cellIndex, ancestors,
        });
        if (page.type === 0x02) {
            const childIndex = direction === "next" ? position.cellIndex + 1 : position.cellIndex;
            const child = childIndex < page.cells.length ? be32(page.bytes, page.cells[childIndex]) : page.rightChild;
            return this.#indexBoundary(child, direction === "next" ? "first" : "last", [...position.ancestors, { pageNumber: page.number, childIndex, page }], new Set([page.number, ...position.ancestors.map((entry) => entry.pageNumber)]));
        }
        const adjacent = direction === "next" ? position.cellIndex + 1 : position.cellIndex - 1;
        if (adjacent >= 0 && adjacent < page.cells.length)
            return at(page, adjacent, position.ancestors);
        for (let depth = position.ancestors.length - 1; depth >= 0; depth--) {
            const ancestor = position.ancestors[depth];
            const parent = ancestor.page;
            if (direction === "next" && ancestor.childIndex < parent.cells.length)
                return at(parent, ancestor.childIndex, position.ancestors.slice(0, depth));
            if (direction === "previous" && ancestor.childIndex > 0)
                return at(parent, ancestor.childIndex - 1, position.ancestors.slice(0, depth));
        }
        return null;
    }
    *iterateTable(pgno, depth, path) {
        if (depth >= this.maxBtreeDepth)
            throw new BtreeLimitError("maxBtreeDepth");
        if (path.has(pgno))
            corrupt("b-tree cycle");
        path.add(pgno);
        try {
            const page = this.page(pgno, [0x05, 0x0d]);
            if (page.type === 0x0d) {
                for (const offset of page.cells)
                    yield this.#payloadCell(page, offset, true);
            }
            else {
                for (const offset of page.cells) {
                    if (offset + 4 > this.usableSize)
                        corrupt("truncated table interior cell");
                    yield* this.iterateTable(be32(page.bytes, offset), depth + 1, path);
                }
                yield* this.iterateTable(page.rightChild, depth + 1, path);
            }
        }
        finally {
            path.delete(pgno);
        }
    }
    overflowPages(cell) {
        const pages = [];
        const seen = new Set();
        let pgno = cell.overflowPage;
        let remaining = cell.payloadLength - cell.local.byteLength;
        while (remaining > 0) {
            if (pgno === null || pgno < 2 || pgno > this.pageCount || seen.has(pgno))
                corrupt("invalid or cyclic overflow chain");
            if (pages.length >= this.maxOverflowPages)
                throw new BtreeLimitError("maxOverflowPages");
            pages.push(pgno);
            seen.add(pgno);
            const page = this.pageBytes(pgno);
            remaining -= Math.min(remaining, this.usableSize - 4);
            const next = be32(page, 0);
            pgno = next === 0 ? null : next;
        }
        if (pgno !== null)
            corrupt("overflow chain continues beyond payload");
        return pages;
    }
    payload(cell, check) {
        check?.(1);
        const result = new Uint8Array(cell.payloadLength);
        for (let offset = 0; offset < cell.local.length; offset += 4096) {
            const end = Math.min(offset + 4096, cell.local.length);
            check?.(end - offset);
            result.set(cell.local.subarray(offset, end), offset);
        }
        let at = cell.local.byteLength;
        const chunks = this.payloadChunks(cell);
        chunks.next(); // local bytes already copied above
        try {
            while (at < result.byteLength) {
                check?.(1);
                const chunk = chunks.next();
                if (chunk.done)
                    corrupt("truncated overflow chain");
                for (let offset = 0; offset < chunk.value.length; offset += 4096) {
                    const end = Math.min(offset + 4096, chunk.value.length);
                    check?.(end - offset);
                    result.set(chunk.value.subarray(offset, end), at + offset);
                }
                at += chunk.value.length;
            }
            chunks.next(); // validate the final next pointer, including local-only cells
        }
        finally {
            chunks.return(undefined);
        }
        return result;
    }
    /** Incremental payload reconstruction. Every yielded slice performs at most
     * one page read, allowing the async VM to charge and yield between pages. */
    *payloadChunks(cell) {
        yield cell.local;
        const seen = new Set();
        let pgno = cell.overflowPage;
        let remaining = cell.payloadLength - cell.local.byteLength;
        while (remaining > 0) {
            if (pgno === null || pgno < 2 || pgno > this.pageCount || seen.has(pgno))
                corrupt("invalid or cyclic overflow chain");
            if (seen.size >= this.maxOverflowPages)
                throw new BtreeLimitError("maxOverflowPages");
            seen.add(pgno);
            const page = this.pageBytes(pgno), amount = Math.min(remaining, this.usableSize - 4);
            yield page.subarray(4, 4 + amount);
            remaining -= amount;
            const next = be32(page, 0);
            pgno = next === 0 ? null : next;
        }
        if (pgno !== null)
            corrupt("overflow chain continues beyond payload");
    }
}
class CursorBase {
    position = -1;
    generation = 0;
    database;
    entries = [];
    #fullyLoaded = false;
    #loadEntries;
    constructor(database, loadEntries) { this.database = database; this.#loadEntries = loadEntries; }
    ensureEntries() {
        if (this.#fullyLoaded)
            return;
        const current = this.position >= 0 ? this.entries[this.position] : undefined;
        this.entries = this.#loadEntries();
        this.#fullyLoaded = true;
        if (current)
            this.position = this.entries.findIndex((entry) => entry.pageNumber === current.pageNumber
                && entry.cellOffset === current.cellOffset);
    }
    setSeekEntry(entry) {
        this.entries = entry === null ? [] : [entry];
        this.position = entry === null ? -1 : 0;
        this.#fullyLoaded = false;
    }
    get valid() { this.database.assertOpen(); return this.position >= 0 && this.position < this.entries.length; }
    first() { this.ensureEntries(); return this.move(this.entries.length ? 0 : -1); }
    last() { this.ensureEntries(); return this.move(this.entries.length ? this.entries.length - 1 : -1); }
    // OP_NullRow clears the underlying Btree cursor as well as its decoded row.
    clearPosition() { this.position = -1; this.generation++; }
    next() { this.ensureEntries(); return this.move(this.valid && this.position + 1 < this.entries.length ? this.position + 1 : -1); }
    previous() { this.ensureEntries(); return this.move(this.valid && this.position > 0 ? this.position - 1 : -1); }
    move(position) { this.position = position; this.generation++; return this.valid; }
    entry() { if (!this.valid)
        throw new BtreeCursorStateError("cursor is not positioned"); return this.entries[this.position]; }
    payload(check) { return this.database.payload(this.entry(), check); }
    overflowPages() { return this.database.overflowPages(this.entry()); }
    borrowPayload() {
        const born = this.generation;
        const value = this.payload();
        return { bytes: () => { this.database.assertOpen(); if (born !== this.generation)
                throw new BtreeCursorStateError("borrow invalidated by cursor movement"); return value; } };
    }
}
export class TableCursor extends CursorBase {
    #root;
    constructor(database, root) { super(database, () => database.readTable(root)); this.#root = root; }
    get rowid() { return this.entry().rowid; }
    seek(key, bias) {
        const result = this.database.tableSeek(this.#root, key, bias);
        this.setSeekEntry(result.entry);
        this.generation++;
        return result.exact;
    }
}
export class TableScanCursor {
    #database;
    #entries;
    #entry = null;
    #previousRowid = null;
    #generation = 0;
    constructor(database, entries) { this.#database = database; this.#entries = entries; }
    first() { if (this.#generation !== 0)
        throw new BtreeCursorStateError("scan cursor already started"); return this.#advance(); }
    next() { if (this.#generation === 0)
        throw new BtreeCursorStateError("scan cursor is not positioned"); return this.#advance(); }
    #advance() {
        this.#database.assertOpen();
        const result = this.#entries.next();
        this.#generation++;
        if (result.done) {
            this.#entry = null;
            return false;
        }
        if (this.#previousRowid !== null && this.#previousRowid >= result.value.rowid)
            corrupt("unordered table b-tree");
        this.#previousRowid = result.value.rowid;
        this.#entry = result.value;
        return true;
    }
    get rowid() { if (!this.#entry)
        throw new BtreeCursorStateError("cursor is not positioned"); return this.#entry.rowid; }
    payload() { if (!this.#entry)
        throw new BtreeCursorStateError("cursor is not positioned"); return this.#database.payload(this.#entry); }
    payloadChunks() { if (!this.#entry)
        throw new BtreeCursorStateError("cursor is not positioned"); return this.#database.payloadChunks(this.#entry); }
    borrowPayload() {
        if (!this.#entry)
            throw new BtreeCursorStateError("cursor is not positioned");
        const born = this.#generation, value = this.#database.payload(this.#entry);
        return { bytes: () => { this.#database.assertOpen(); if (born !== this.#generation)
                throw new BtreeCursorStateError("borrow invalidated by cursor movement"); return value; } };
    }
}
export class IndexCursor extends CursorBase {
    // vdbe.c OP_SeekHit / OP_IfNoHope: physical cursor-owned state.
    seekHit = 0;
    prefixExists(values, keyInfo) {
        const key = new UnpackedRecordKey(values, 0, "seek", keyInfo);
        try {
            return this.seek(payload => compareRecordKey(payload, key, keyInfo), "ge");
        }
        catch (error) {
            if (error instanceof ComparisonError && error.reason === "corrupt")
                corrupt(error.message);
            throw error;
        }
        finally {
            key.release();
            this.clearPosition();
        }
    }
    #root;
    #indexPosition = null;
    constructor(database, root) { super(database, () => []); this.#root = root; }
    #set(position) {
        this.#indexPosition = position;
        this.setSeekEntry(position?.entry ?? null);
        this.generation++;
        return position !== null;
    }
    // btree.c:sqlite3BtreeClearCursor sets CURSOR_INVALID. Invalidate the
    // physical path as well as decoded position and payload borrow generation.
    clearPosition() { this.#set(null); }
    first() { return this.#set(this.database.indexBoundary(this.#root, "first")); }
    last() { return this.#set(this.database.indexBoundary(this.#root, "last")); }
    next() {
        return this.#set(this.#indexPosition === null ? null : this.database.indexMove(this.#indexPosition, "next"));
    }
    previous() {
        return this.#set(this.#indexPosition === null ? null : this.database.indexMove(this.#indexPosition, "previous"));
    }
    /** OP_Found/NotFound default_rc0: any exact matching entry suffices.
     * Misses retain the existing GE boundary; callers must test the result. */
    seekExact(compareCurrentToTarget) {
        const result = this.database.indexSeek(this.#root, compareCurrentToTarget, "ge", this.#indexPosition, true);
        this.#set(result.position);
        return result.exact;
    }
    seek(compareCurrentToTarget, bias) {
        const result = this.database.indexSeek(this.#root, compareCurrentToTarget, bias, this.#indexPosition);
        this.#set(result.position);
        return result.exact;
    }
    /** vdbe.c:4935–5025 / btreeIndexMoveto: nField is the supplied prefix.
     * Strict GT/LT bias equal prefixes before descent, without a pre-scan.
     * Input cells transfer to the unpacked key; errors release them too.
     * Return positioning success, not equality as in seek(). */
    /** vdbe.c:OP_SeekScan5093: bounded forward steps before a SeekGE.
     * `found` bypasses seek (range overshoot allowed); `exhausted` takes
     * SeekGE's exit; `seek` falls through. Never changes an invalid cursor.
     * The unpacked prefix has default_rc0, unlike strict seekKey. */
    seekScan(values, keyInfo, steps, hasRange, charge, moved) {
        const key = new UnpackedRecordKey(values, 0, "seek", keyInfo);
        try {
            if (!this.valid)
                return "seek";
            let remaining = steps;
            while (true) {
                charge?.();
                const result = compareRecordKey(this.payload(), key, keyInfo);
                if (result > 0 && !hasRange)
                    return "exhausted";
                if (result >= 0)
                    return "found";
                if (remaining <= 0)
                    return "seek";
                remaining--;
                moved?.();
                if (!this.next())
                    return "exhausted";
            }
        }
        catch (error) {
            if (error instanceof ComparisonError && error.reason === "corrupt")
                corrupt(error.message);
            throw error;
        }
        finally {
            key.release();
        }
    }
    seekKey(values, keyInfo, direction) {
        const reverse = direction === "le" || direction === "lt";
        const key = new UnpackedRecordKey(values, direction === "gt" || direction === "le" ? -1 : 1, "seek", keyInfo);
        try {
            this.seek(payload => compareRecordKey(payload, key, keyInfo), reverse ? "le" : "ge");
            return this.valid;
        }
        catch (error) {
            // btreeIndexMoveto owns unpacked-key errCode: malformed record
            // comparison returns SQLITE_CORRUPT through the b-tree boundary.
            if (error instanceof ComparisonError && error.reason === "corrupt")
                corrupt(error.message);
            throw error;
        }
        finally {
            key.release();
        }
    }
}
export function openBtreeDatabase(bytes, limits = {}) {
    try {
        return new BtreeDatabase(ImmutableStorage.open(bytes), limits);
    }
    catch (error) {
        if (error instanceof StorageCorruptError)
            corrupt(error.message);
        throw error;
    }
}
/** Internal/test later-consumer route; not exported by the package public module. */
export function btreeFromStorage(storage, limits = {}) { return new BtreeDatabase(storage, limits); }
/** Internal bridge proving a public-open connection and b-tree share one owner. */
export function btreeFromConnection(connection, limits = {}) {
    return new BtreeDatabase(connection[storageOwner], limits);
}
