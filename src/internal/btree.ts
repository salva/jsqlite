import { decodeVarint, type DatabaseEncoding } from "./record.ts";
import { ImmutableStorage, StorageClosedError, StorageCorruptError, storageOwner, type StorageOwnerCarrier } from "./storage.ts";

/** Read-only translation of the pinned btree.c page, cell, payload and cursor paths. */
export class BtreeFormatError extends Error {
  constructor(message: string) { super(message); this.name = "BtreeFormatError"; }
}
export class BtreeCursorStateError extends Error {
  constructor(message: string) { super(message); this.name = "BtreeCursorStateError"; }
}
export interface BtreeLimits { readonly maxBtreeDepth?: number; readonly maxOverflowPages?: number; }
interface Page { number: number; bytes: Uint8Array; type: number; cells: number[]; rightChild: number | null; }
interface PayloadCell { payloadLength: number; local: Uint8Array; overflowPage: number | null; }
interface TableEntry extends PayloadCell { rowid: bigint; }
interface IndexEntry extends PayloadCell {}

function corrupt(message: string): never { throw new BtreeFormatError(message); }
function be16(bytes: Uint8Array, at: number): number {
  if (at < 0 || at + 2 > bytes.byteLength) corrupt("truncated u16");
  return bytes[at]! * 256 + bytes[at + 1]!;
}
function be32(bytes: Uint8Array, at: number): number {
  if (at < 0 || at + 4 > bytes.byteLength) corrupt("truncated u32");
  return bytes[at]! * 0x1000000 + bytes[at + 1]! * 0x10000 + bytes[at + 2]! * 256 + bytes[at + 3]!;
}
function limit(value: number | undefined, fallback: number, name: string): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1) throw new RangeError(`${name} must be a positive safe integer`);
  return result;
}

export class BtreeDatabase {
  readonly #storage: ImmutableStorage;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly usableSize: number;
  readonly encoding: DatabaseEncoding;
  readonly maxBtreeDepth: number;
  readonly maxOverflowPages: number;

  constructor(storage: ImmutableStorage, limits: BtreeLimits = {}) {
    try { storage.assertOpen(); }
    catch (error) {
      if (error instanceof StorageClosedError) throw new BtreeCursorStateError(error.message);
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
  close(): void { this.#storage.close(); }
  assertOpen(): void {
    try { this.#storage.assertOpen(); }
    catch (error) { if (error instanceof StorageClosedError) throw new BtreeCursorStateError(error.message); throw error; }
  }

  tableCursor(root: number): TableCursor { return new TableCursor(this, this.readTable(root)); }
  indexCursor(root: number): IndexCursor { return new IndexCursor(this, this.readIndex(root)); }

  pageBytes(pgno: number): Uint8Array {
    this.assertOpen();
    if (!Number.isSafeInteger(pgno) || pgno < 1 || pgno > this.pageCount) corrupt("page number outside database");
    const start = (pgno - 1) * this.pageSize;
    try { return this.#storage.read(start, this.pageSize); }
    catch (error) { if (error instanceof StorageCorruptError) corrupt(error.message); throw error; }
  }
  page(pgno: number, allowed: readonly number[]): Page {
    const bytes = this.pageBytes(pgno);
    const h = pgno === 1 ? 100 : 0;
    if (h + 8 > this.usableSize) corrupt("truncated b-tree header");
    const type = bytes[h]!;
    if (!allowed.includes(type)) corrupt("unexpected b-tree page type");
    const interior = type === 0x02 || type === 0x05;
    const hs = interior ? 12 : 8;
    const count = be16(bytes, h + 3);
    const pointerEnd = h + hs + count * 2;
    if (pointerEnd > this.usableSize) corrupt("cell pointer array exceeds page");
    const rawContent = be16(bytes, h + 5);
    const content = rawContent === 0 && this.pageSize === 65536 ? 65536 : rawContent;
    if (content < pointerEnd || content > this.usableSize) corrupt("invalid cell content boundary");
    const cells: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < count; i++) {
      const cell = be16(bytes, h + hs + i * 2);
      if (cell < content || cell >= this.usableSize || seen.has(cell)) corrupt("invalid or duplicate cell pointer");
      seen.add(cell); cells.push(cell);
    }
    const rightChild = interior ? be32(bytes, h + 8) : null;
    if (rightChild !== null && (rightChild < 1 || rightChild > this.pageCount)) corrupt("invalid right child");
    return { number: pgno, bytes, type, cells, rightChild };
  }
  #payloadCell(page: Page, start: number, tableLeaf: boolean): PayloadCell & { rowid?: bigint } {
    let at = start;
    if (page.type === 0x02) at += 4;
    let payload;
    try { payload = decodeVarint(page.bytes, at, this.usableSize); } catch { return corrupt("truncated payload varint"); }
    at += payload.length;
    let rowid: bigint | undefined;
    if (tableLeaf) {
      let key;
      try { key = decodeVarint(page.bytes, at, this.usableSize); } catch { return corrupt("truncated rowid varint"); }
      at += key.length; rowid = BigInt.asIntN(64, key.value);
    }
    if (payload.value > BigInt(Number.MAX_SAFE_INTEGER)) corrupt("payload too large");
    const nPayload = Number(payload.value);
    const minLocal = Math.floor(((this.usableSize - 12) * 32) / 255) - 23;
    const maxLocal = tableLeaf ? this.usableSize - 35 : Math.floor(((this.usableSize - 12) * 64) / 255) - 23;
    let local = nPayload;
    if (local > maxLocal) {
      local = minLocal + ((local - minLocal) % (this.usableSize - 4));
      if (local > maxLocal) local = minLocal;
    }
    const overflow = nPayload > local;
    if (at + local + (overflow ? 4 : 0) > this.usableSize) corrupt("cell exceeds usable page");
    const base = { payloadLength: nPayload, local: page.bytes.subarray(at, at + local), overflowPage: overflow ? be32(page.bytes, at + local) : null };
    if (base.overflowPage !== null && (base.overflowPage < 2 || base.overflowPage > this.pageCount)) corrupt("invalid overflow page");
    return rowid === undefined ? base : { ...base, rowid };
  }
  readTable(root: number): TableEntry[] {
    const output: TableEntry[] = []; const path = new Set<number>();
    const visit = (pgno: number, depth: number): void => {
      if (depth >= this.maxBtreeDepth) throw new RangeError("maxBtreeDepth exceeded");
      if (path.has(pgno)) corrupt("b-tree cycle"); path.add(pgno);
      const page = this.page(pgno, [0x05, 0x0d]);
      if (page.type === 0x0d) {
        for (const offset of page.cells) output.push(this.#payloadCell(page, offset, true) as TableEntry);
      } else {
        for (const offset of page.cells) {
          if (offset + 4 > this.usableSize) corrupt("truncated table interior cell");
          visit(be32(page.bytes, offset), depth + 1);
        }
        visit(page.rightChild!, depth + 1);
      }
      path.delete(pgno);
    };
    visit(root, 0);
    for (let i = 1; i < output.length; i++) if (output[i - 1]!.rowid >= output[i]!.rowid) corrupt("unordered table b-tree");
    return output;
  }
  readIndex(root: number): IndexEntry[] {
    const output: IndexEntry[] = []; const path = new Set<number>();
    const visit = (pgno: number, depth: number): void => {
      if (depth >= this.maxBtreeDepth) throw new RangeError("maxBtreeDepth exceeded");
      if (path.has(pgno)) corrupt("b-tree cycle"); path.add(pgno);
      const page = this.page(pgno, [0x02, 0x0a]);
      if (page.type === 0x0a) {
        for (const offset of page.cells) output.push(this.#payloadCell(page, offset, false));
      } else {
        for (const offset of page.cells) {
          if (offset + 4 > this.usableSize) corrupt("truncated index interior cell");
          visit(be32(page.bytes, offset), depth + 1);
          output.push(this.#payloadCell(page, offset, false));
        }
        visit(page.rightChild!, depth + 1);
      }
      path.delete(pgno);
    };
    visit(root, 0); return output;
  }
  overflowPages(cell: PayloadCell): number[] {
    const pages: number[] = []; const seen = new Set<number>(); let pgno = cell.overflowPage;
    let remaining = cell.payloadLength - cell.local.byteLength;
    while (remaining > 0) {
      if (pgno === null || pgno < 2 || pgno > this.pageCount || seen.has(pgno)) corrupt("invalid or cyclic overflow chain");
      if (pages.length >= this.maxOverflowPages) throw new RangeError("maxOverflowPages exceeded");
      pages.push(pgno); seen.add(pgno);
      const page = this.pageBytes(pgno); remaining -= Math.min(remaining, this.usableSize - 4);
      const next = be32(page, 0); pgno = next === 0 ? null : next;
    }
    if (pgno !== null) corrupt("overflow chain continues beyond payload");
    return pages;
  }
  payload(cell: PayloadCell): Uint8Array {
    const result = new Uint8Array(cell.payloadLength); result.set(cell.local);
    let at = cell.local.byteLength;
    for (const pgno of this.overflowPages(cell)) {
      const page = this.pageBytes(pgno); const amount = Math.min(this.usableSize - 4, result.byteLength - at);
      result.set(page.subarray(4, 4 + amount), at); at += amount;
    }
    return result;
  }
}

class CursorBase<T extends PayloadCell> {
  protected position = -1; protected generation = 0;
  protected readonly database: BtreeDatabase;
  protected readonly entries: readonly T[];
  constructor(database: BtreeDatabase, entries: readonly T[]) { this.database = database; this.entries = entries; }
  get valid(): boolean { this.database.assertOpen(); return this.position >= 0 && this.position < this.entries.length; }
  first(): boolean { return this.move(this.entries.length ? 0 : -1); }
  last(): boolean { return this.move(this.entries.length ? this.entries.length - 1 : -1); }
  next(): boolean { return this.move(this.valid && this.position + 1 < this.entries.length ? this.position + 1 : -1); }
  previous(): boolean { return this.move(this.valid && this.position > 0 ? this.position - 1 : -1); }
  protected move(position: number): boolean { this.position = position; this.generation++; return this.valid; }
  protected entry(): T { if (!this.valid) throw new BtreeCursorStateError("cursor is not positioned"); return this.entries[this.position]!; }
  payload(): Uint8Array { return this.database.payload(this.entry()); }
  overflowPages(): number[] { return this.database.overflowPages(this.entry()); }
  borrowPayload(): { bytes(): Uint8Array } {
    const born = this.generation; const value = this.payload();
    return { bytes: () => { this.database.assertOpen(); if (born !== this.generation) throw new BtreeCursorStateError("borrow invalidated by cursor movement"); return value; } };
  }
}
export class TableCursor extends CursorBase<TableEntry> {
  get rowid(): bigint { return this.entry().rowid; }
  seek(key: bigint, bias: "ge" | "le"): boolean {
    let lo = 0, hi = this.entries.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (this.entries[mid]!.rowid < key) lo = mid + 1; else hi = mid; }
    const exact = lo < this.entries.length && this.entries[lo]!.rowid === key;
    const position = bias === "ge" ? lo : exact ? lo : lo - 1;
    this.move(position >= 0 && position < this.entries.length ? position : -1); return exact;
  }
}
export class IndexCursor extends CursorBase<IndexEntry> {
  seek(compareCurrentToTarget: (payload: Uint8Array) => number, bias: "ge" | "le"): boolean {
    let lo = 0, hi = this.entries.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (compareCurrentToTarget(this.database.payload(this.entries[mid]!)) < 0) lo = mid + 1; else hi = mid; }
    const exact = lo < this.entries.length && compareCurrentToTarget(this.database.payload(this.entries[lo]!)) === 0;
    const position = bias === "ge" ? lo : exact ? lo : lo - 1;
    this.move(position >= 0 && position < this.entries.length ? position : -1); return exact;
  }
}
export function openBtreeDatabase(bytes: Uint8Array, limits: BtreeLimits = {}): BtreeDatabase {
  try { return new BtreeDatabase(ImmutableStorage.open(bytes), limits); }
  catch (error) { if (error instanceof StorageCorruptError) corrupt(error.message); throw error; }
}
/** Internal/test later-consumer route; not exported by the package public module. */
export function btreeFromStorage(storage: ImmutableStorage, limits: BtreeLimits = {}): BtreeDatabase { return new BtreeDatabase(storage, limits); }
/** Internal bridge proving a public-open connection and b-tree share one owner. */
export function btreeFromConnection(connection: StorageOwnerCarrier, limits: BtreeLimits = {}): BtreeDatabase {
  return new BtreeDatabase(connection[storageOwner], limits);
}
