export class StorageLimitError extends RangeError {
    constructor(message) { super(message); this.name = "StorageLimitError"; }
}
export class StorageCorruptError extends Error {
    constructor(message) { super(message); this.name = "StorageCorruptError"; }
}
export class StorageUnsupportedError extends Error {
    classification;
    constructor(message, classification) { super(message); this.name = "StorageUnsupportedError"; this.classification = classification; }
}
export class StorageClosedError extends Error {
    constructor() { super("storage owner is closed"); this.name = "StorageClosedError"; }
}
function corrupt(message) { throw new StorageCorruptError(message); }
function u32(view, offset) { return view.getUint32(offset, false); }
export const storageOwner = Symbol("jsqlite.internal.storageOwner");
/** Connection-owned, immutable, validated format-3 file and page source. */
export class ImmutableStorage {
    #bytes;
    pageSize;
    pageCount;
    usableSize;
    encoding;
    #generation = 0;
    schemaAllowance;
    #schemaBytes = 0;
    #schemaTemporaryBytes = 0;
    get schemaTemporaryBytes() { return this.#schemaTemporaryBytes; }
    /** Checked connection-owned logical allocation, not measured host heap. */
    reserveSchemaTemporary(bytes) {
        this.assertOpen();
        if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.schemaAllowance - this.#schemaBytes - this.#schemaTemporaryBytes)
            throw new StorageLimitError("statistics allocation envelope exceeded");
        this.#schemaTemporaryBytes += bytes;
        let live = true;
        return () => { if (live) {
            live = false;
            this.#schemaTemporaryBytes -= bytes;
        } };
    }
    #schemaCleanup = null;
    get schemaBytes() { return this.#schemaBytes; }
    publishSchema(bytes, cleanup) {
        this.assertOpen();
        if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.schemaAllowance - this.#schemaTemporaryBytes)
            throw new StorageLimitError("statistics allocation envelope exceeded");
        this.#schemaBytes = bytes;
        this.#schemaCleanup = cleanup;
    }
    constructor(bytes, pageSize, encoding, maxFileBytes) {
        this.#bytes = bytes;
        // INTERNAL logical schema envelope: 2^21 times acquisition allowance.
        // For each file-backed stat row (at least one byte), conservatively allow
        // 40 slot + 24*32767 counts + 8*32767 average + 8 padding bytes, plus
        // grouped metadata/name and raw record ownership. Shared averages and
        // grouped aliases are overcounted by this scale. Not measured JS heap or
        // an additional public/execution-private budget.
        const allowance = BigInt(maxFileBytes) * 2097152n;
        this.schemaAllowance = Number(allowance > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : allowance);
        this.pageSize = pageSize;
        this.pageCount = bytes.byteLength / pageSize;
        this.usableSize = pageSize; // Product baseline requires reserved=0.
        this.encoding = encoding;
    }
    get generation() { return this.#generation; }
    get closed() { return this.#bytes === null; }
    assertOpen() { if (this.#bytes === null)
        throw new StorageClosedError(); }
    read(offset, length) {
        const bytes = this.#bytes;
        if (bytes === null)
            throw new StorageClosedError();
        if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > bytes.byteLength)
            corrupt("read outside database file");
        return bytes.subarray(offset, offset + length);
    }
    page(pageNumber) {
        this.assertOpen();
        if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > this.pageCount)
            corrupt("page number outside database file");
        return this.read((pageNumber - 1) * this.pageSize, this.pageSize);
    }
    close() {
        if (this.#bytes === null)
            throw new StorageClosedError();
        this.#schemaCleanup?.();
        this.#schemaCleanup = null;
        this.#schemaBytes = 0;
        this.#bytes = null;
        this.#generation++;
    }
    static open(bytes, maxFileBytes = 64 * 1024 * 1024) {
        if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < bytes.byteLength)
            throw new RangeError("invalid acquisition allowance");
        if (bytes.byteLength < 100)
            corrupt("database header is truncated");
        const magic = [83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0];
        for (let i = 0; i < magic.length; i++)
            if (bytes[i] !== magic[i])
                corrupt("not a format-3 SQLite database");
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const encoded = view.getUint16(16, false);
        const pageSize = encoded === 1 ? 65536 : encoded;
        if (pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) !== 0)
            corrupt("invalid database page size");
        if (bytes[18] !== 1 || bytes[19] !== 1) {
            if (bytes[18] === 2 || bytes[19] === 2)
                throw new StorageUnsupportedError("WAL/recovery snapshot is not supported", "permanent");
            corrupt("invalid database format version");
        }
        if (bytes[20] !== 0)
            throw new StorageUnsupportedError("reserved page bytes are not supported", "temporary");
        if (bytes[21] !== 64 || bytes[22] !== 32 || bytes[23] !== 32)
            corrupt("invalid payload fractions");
        if (bytes.byteLength === 0 || bytes.byteLength % pageSize !== 0)
            corrupt("database file/page geometry is inconsistent");
        const actualPages = bytes.byteLength / pageSize;
        const headerPages = u32(view, 28);
        if (u32(view, 24) === u32(view, 92) && headerPages !== 0 && headerPages !== actualPages)
            corrupt("database page count does not match file length");
        const headerEncoding = u32(view, 56);
        const encoding = headerEncoding === 0 && actualPages === 1 ? 1 : headerEncoding;
        if (encoding !== 1 && encoding !== 2 && encoding !== 3)
            corrupt("unsupported database text encoding");
        // Copy at owner boundary so caller mutation cannot alter immutable residency.
        return new ImmutableStorage(bytes.slice(), pageSize, encoding, maxFileBytes);
    }
}
