export class StorageCorruptError extends Error {
  constructor(message: string) { super(message); this.name = "StorageCorruptError"; }
}
export class StorageUnsupportedError extends Error {
  readonly classification: "temporary" | "permanent";
  constructor(message: string, classification: "temporary" | "permanent") { super(message); this.name = "StorageUnsupportedError"; this.classification = classification; }
}
export class StorageClosedError extends Error {
  constructor() { super("storage owner is closed"); this.name = "StorageClosedError"; }
}

function corrupt(message: string): never { throw new StorageCorruptError(message); }
function u32(view: DataView, offset: number): number { return view.getUint32(offset, false); }

export const storageOwner = Symbol("jsqlite.internal.storageOwner");
export interface StorageOwnerCarrier { readonly [storageOwner]: ImmutableStorage; }

/** Connection-owned, immutable, validated format-3 file and page source. */
export class ImmutableStorage {
  #bytes: Uint8Array | null;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly usableSize: number;
  readonly encoding: 1 | 2 | 3;
  #generation = 0;

  private constructor(bytes: Uint8Array, pageSize: number, encoding: 1 | 2 | 3) {
    this.#bytes = bytes;
    this.pageSize = pageSize;
    this.pageCount = bytes.byteLength / pageSize;
    this.usableSize = pageSize; // Product baseline requires reserved=0.
    this.encoding = encoding;
  }
  get generation(): number { return this.#generation; }
  get closed(): boolean { return this.#bytes === null; }
  assertOpen(): void { if (this.#bytes === null) throw new StorageClosedError(); }
  read(offset: number, length: number): Uint8Array {
    const bytes = this.#bytes;
    if (bytes === null) throw new StorageClosedError();
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > bytes.byteLength)
      corrupt("read outside database file");
    return bytes.subarray(offset, offset + length);
  }
  page(pageNumber: number): Uint8Array {
    this.assertOpen();
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > this.pageCount) corrupt("page number outside database file");
    return this.read((pageNumber - 1) * this.pageSize, this.pageSize);
  }
  close(): void {
    if (this.#bytes === null) throw new StorageClosedError();
    this.#bytes = null; this.#generation++;
  }

  static open(bytes: Uint8Array): ImmutableStorage {
    if (bytes.byteLength < 100) corrupt("database header is truncated");
    const magic = [83,81,76,105,116,101,32,102,111,114,109,97,116,32,51,0];
    for (let i = 0; i < magic.length; i++) if (bytes[i] !== magic[i]) corrupt("not a format-3 SQLite database");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const encoded = view.getUint16(16, false);
    const pageSize = encoded === 1 ? 65536 : encoded;
    if (pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) !== 0) corrupt("invalid database page size");
    if (bytes[18] !== 1 || bytes[19] !== 1) {
      if (bytes[18] === 2 || bytes[19] === 2) throw new StorageUnsupportedError("WAL/recovery snapshot is not supported", "permanent");
      corrupt("invalid database format version");
    }
    if (bytes[20] !== 0) throw new StorageUnsupportedError("reserved page bytes are not supported", "temporary");
    if (bytes[21] !== 64 || bytes[22] !== 32 || bytes[23] !== 32) corrupt("invalid payload fractions");
    if (bytes.byteLength === 0 || bytes.byteLength % pageSize !== 0) corrupt("database file/page geometry is inconsistent");
    const actualPages = bytes.byteLength / pageSize;
    const headerPages = u32(view, 28);
    if (u32(view, 24) === u32(view, 92) && headerPages !== 0 && headerPages !== actualPages) corrupt("database page count does not match file length");
    const headerEncoding = u32(view, 56);
    const encoding = headerEncoding === 0 && actualPages === 1 ? 1 : headerEncoding;
    if (encoding !== 1 && encoding !== 2 && encoding !== 3) corrupt("unsupported database text encoding");
    // Copy at owner boundary so caller mutation cannot alter immutable residency.
    return new ImmutableStorage(bytes.slice(), pageSize, encoding);
  }
}
