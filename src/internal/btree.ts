import { decodeVarint, type DatabaseEncoding } from "./record.ts";
import { ImmutableStorage, StorageClosedError, StorageCorruptError, storageOwner, type StorageOwnerCarrier } from "./storage.ts";

/** Read-only translation of the pinned btree.c page, cell, payload and cursor paths. */
export class BtreeFormatError extends Error {
  constructor(message: string) { super(message); this.name = "BtreeFormatError"; }
}
export class BtreeCursorStateError extends Error {
  constructor(message: string) { super(message); this.name = "BtreeCursorStateError"; }
}
/** A configured traversal ceiling, distinct from programmer RangeError and
 * malformed database input. Public execution maps only this provenance to limit. */
export class BtreeLimitError extends Error {
  readonly limit: "maxBtreeDepth" | "maxOverflowPages";
  constructor(limit: BtreeLimitError["limit"]) {
    super(`${limit} exceeded`); this.name = "BtreeLimitError"; this.limit = limit;
  }
}
export interface BtreeLimits { readonly maxBtreeDepth?: number; readonly maxOverflowPages?: number; }
interface Page { number: number; bytes: Uint8Array; type: number; cells: number[]; rightChild: number | null; }
interface PayloadCell { payloadLength: number; local: Uint8Array; overflowPage: number | null; pageNumber: number; cellOffset: number; }
interface TableEntry extends PayloadCell { rowid: bigint; }
interface IndexEntry extends PayloadCell {}
interface IndexAncestor { pageNumber: number; childIndex: number; }
interface IndexPosition {
  entry: IndexEntry;
  pageNumber: number;
  cellIndex: number;
  ancestors: readonly IndexAncestor[];
}

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

  tableCursor(root: number): TableCursor { this.assertOpen(); return new TableCursor(this, root); }
  /** Forward-only table scan used by the VDBE. Opening does not recursively
   * materialize the whole tree; first/next resume depth-first traversal. */
  tableScanCursor(root: number): TableScanCursor { return new TableScanCursor(this, this.iterateTable(root, 0, new Set())); }
  indexCursor(root: number): IndexCursor { this.assertOpen(); return new IndexCursor(this, root); }

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
    const base = { payloadLength: nPayload, local: page.bytes.subarray(at, at + local), overflowPage: overflow ? be32(page.bytes, at + local) : null, pageNumber: page.number, cellOffset: start };
    if (base.overflowPage !== null && (base.overflowPage < 2 || base.overflowPage > this.pageCount)) corrupt("invalid overflow page");
    return rowid === undefined ? base : { ...base, rowid };
  }
  readTable(root: number): TableEntry[] {
    const output: TableEntry[] = []; const path = new Set<number>();
    const visit = (pgno: number, depth: number): void => {
      if (depth >= this.maxBtreeDepth) throw new BtreeLimitError("maxBtreeDepth");
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
  tableSeek(root: number, key: bigint, bias: "ge" | "le"): { entry: TableEntry | null; exact: boolean } {
    const maximum = (pgno: number, depth: number, path: Set<number>): TableEntry => {
      if (depth >= this.maxBtreeDepth) throw new BtreeLimitError("maxBtreeDepth");
      if (path.has(pgno)) corrupt("b-tree cycle");
      path.add(pgno);
      try {
        const page = this.page(pgno, [0x05, 0x0d]);
        if (page.type === 0x0d) {
          if (page.cells.length === 0) return corrupt("empty table leaf");
          return this.#payloadCell(page, page.cells.at(-1)!, true) as TableEntry;
        }
        return maximum(page.rightChild!, depth + 1, path);
      } finally { path.delete(pgno); }
    };
    const descend = (pgno: number, depth: number, path: Set<number>): { entry: TableEntry | null; exact: boolean } => {
      if (depth >= this.maxBtreeDepth) throw new BtreeLimitError("maxBtreeDepth");
      if (path.has(pgno)) corrupt("b-tree cycle");
      path.add(pgno);
      try {
        const page = this.page(pgno, [0x05, 0x0d]);
        if (page.type === 0x0d) {
          const entries = page.cells.map((offset) => this.#payloadCell(page, offset, true) as TableEntry);
          let lo = 0, hi = entries.length;
          while (lo < hi) { const mid = (lo + hi) >>> 1; if (entries[mid]!.rowid < key) lo = mid + 1; else hi = mid; }
          const exact = lo < entries.length && entries[lo]!.rowid === key;
          const index = bias === "ge" ? lo : exact ? lo : lo - 1;
          return { entry: index >= 0 && index < entries.length ? entries[index]! : null, exact };
        }
        let childIndex = page.cells.length;
        for (let i = 0; i < page.cells.length; i++) {
          const offset = page.cells[i]!;
          if (offset + 4 > this.usableSize) corrupt("truncated table interior cell");
          let separator;
          try { separator = decodeVarint(page.bytes, offset + 4, this.usableSize); }
          catch { return corrupt("truncated table interior key"); }
          if (BigInt.asIntN(64, separator.value) >= key) { childIndex = i; break; }
        }
        const child = childIndex < page.cells.length
          ? be32(page.bytes, page.cells[childIndex]!) : page.rightChild!;
        const nested = descend(child, depth + 1, path);
        if (nested.entry !== null || bias === "ge" || childIndex === 0) return nested;
        const preceding = be32(page.bytes, page.cells[childIndex - 1]!);
        return { entry: maximum(preceding, depth + 1, path), exact: false };
      } finally { path.delete(pgno); }
    };
    return descend(root, 0, new Set());
  }
  indexSeek(root: number, compareCurrentToTarget: (payload: Uint8Array) => number, bias: "ge" | "le"):
    { position: IndexPosition | null; exact: boolean } {
    const descend = (pgno: number, depth: number, path: Set<number>, ancestors: readonly IndexAncestor[]):
      { position: IndexPosition | null; exact: boolean } => {
      if (depth >= this.maxBtreeDepth) throw new BtreeLimitError("maxBtreeDepth");
      if (path.has(pgno)) corrupt("b-tree cycle");
      path.add(pgno);
      try {
        const page = this.page(pgno, [0x02, 0x0a]);
        const cells = page.cells.map((offset) => this.#payloadCell(page, offset, false));
        const at = (cellIndex: number): IndexPosition =>
          ({ entry: cells[cellIndex]!, pageNumber: pgno, cellIndex, ancestors });
        let lo = 0, hi = cells.length;
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (compareCurrentToTarget(this.payload(cells[mid]!)) < 0) lo = mid + 1; else hi = mid; }
        if (lo < cells.length && compareCurrentToTarget(this.payload(cells[lo]!)) === 0) return { position: at(lo), exact: true };
        if (page.type === 0x0a) {
          const index = bias === "ge" ? lo : lo - 1;
          return { position: index >= 0 && index < cells.length ? at(index) : null, exact: false };
        }
        const child = lo < cells.length ? be32(page.bytes, page.cells[lo]!) : page.rightChild!;
        const nested = descend(child, depth + 1, path, [...ancestors, { pageNumber: pgno, childIndex: lo }]);
        if (nested.position !== null) return nested;
        if (bias === "ge" && lo < cells.length) return { position: at(lo), exact: false };
        if (bias === "le" && lo > 0) return { position: at(lo - 1), exact: false };
        return { position: null, exact: false };
      } finally { path.delete(pgno); }
    };
    return descend(root, 0, new Set(), []);
  }
  indexBoundary(root: number, direction: "first" | "last"): IndexPosition | null {
    return this.#indexBoundary(root, direction, [], new Set());
  }
  #indexBoundary(pgno: number, direction: "first" | "last", ancestors: readonly IndexAncestor[], path: Set<number>): IndexPosition | null {
    if (ancestors.length >= this.maxBtreeDepth) throw new BtreeLimitError("maxBtreeDepth");
    if (path.has(pgno)) corrupt("b-tree cycle");
    path.add(pgno);
    try {
      const page = this.page(pgno, [0x02, 0x0a]);
      if (page.type === 0x0a) {
        if (page.cells.length === 0) return null;
        const cellIndex = direction === "first" ? 0 : page.cells.length - 1;
        return { entry: this.#payloadCell(page, page.cells[cellIndex]!, false), pageNumber: pgno, cellIndex, ancestors };
      }
      const childIndex = direction === "first" ? 0 : page.cells.length;
      const child = childIndex < page.cells.length ? be32(page.bytes, page.cells[childIndex]!) : page.rightChild!;
      return this.#indexBoundary(child, direction, [...ancestors, { pageNumber: pgno, childIndex }], path);
    } finally { path.delete(pgno); }
  }
  indexMove(position: IndexPosition, direction: "next" | "previous"): IndexPosition | null {
    const page = this.page(position.pageNumber, [0x02, 0x0a]);
    if (position.cellIndex < 0 || position.cellIndex >= page.cells.length
        || page.cells[position.cellIndex] !== position.entry.cellOffset) corrupt("index cursor position changed");
    const at = (owner: Page, cellIndex: number, ancestors: readonly IndexAncestor[]): IndexPosition => ({
      entry: this.#payloadCell(owner, owner.cells[cellIndex]!, false), pageNumber: owner.number, cellIndex, ancestors,
    });
    if (page.type === 0x02) {
      const childIndex = direction === "next" ? position.cellIndex + 1 : position.cellIndex;
      const child = childIndex < page.cells.length ? be32(page.bytes, page.cells[childIndex]!) : page.rightChild!;
      return this.#indexBoundary(child, direction === "next" ? "first" : "last",
        [...position.ancestors, { pageNumber: page.number, childIndex }],
        new Set([page.number, ...position.ancestors.map((entry) => entry.pageNumber)]));
    }
    const adjacent = direction === "next" ? position.cellIndex + 1 : position.cellIndex - 1;
    if (adjacent >= 0 && adjacent < page.cells.length) return at(page, adjacent, position.ancestors);
    for (let depth = position.ancestors.length - 1; depth >= 0; depth--) {
      const ancestor = position.ancestors[depth]!;
      const parent = this.page(ancestor.pageNumber, [0x02]);
      if (direction === "next" && ancestor.childIndex < parent.cells.length)
        return at(parent, ancestor.childIndex, position.ancestors.slice(0, depth));
      if (direction === "previous" && ancestor.childIndex > 0)
        return at(parent, ancestor.childIndex - 1, position.ancestors.slice(0, depth));
    }
    return null;
  }
  private *iterateTable(pgno: number, depth: number, path: Set<number>): Generator<TableEntry> {
    if (depth >= this.maxBtreeDepth) throw new BtreeLimitError("maxBtreeDepth");
    if (path.has(pgno)) corrupt("b-tree cycle"); path.add(pgno);
    try {
      const page = this.page(pgno, [0x05, 0x0d]);
      if (page.type === 0x0d) {
        for (const offset of page.cells) yield this.#payloadCell(page, offset, true) as TableEntry;
      } else {
        for (const offset of page.cells) {
          if (offset + 4 > this.usableSize) corrupt("truncated table interior cell");
          yield* this.iterateTable(be32(page.bytes, offset), depth + 1, path);
        }
        yield* this.iterateTable(page.rightChild!, depth + 1, path);
      }
    } finally { path.delete(pgno); }
  }
  overflowPages(cell: PayloadCell): number[] {
    const pages: number[] = []; const seen = new Set<number>(); let pgno = cell.overflowPage;
    let remaining = cell.payloadLength - cell.local.byteLength;
    while (remaining > 0) {
      if (pgno === null || pgno < 2 || pgno > this.pageCount || seen.has(pgno)) corrupt("invalid or cyclic overflow chain");
      if (pages.length >= this.maxOverflowPages) throw new BtreeLimitError("maxOverflowPages");
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
  /** Incremental payload reconstruction. Every yielded slice performs at most
   * one page read, allowing the async VM to charge and yield between pages. */
  *payloadChunks(cell: PayloadCell): Generator<Uint8Array> {
    yield cell.local;
    const seen = new Set<number>(); let pgno = cell.overflowPage;
    let remaining = cell.payloadLength - cell.local.byteLength;
    while (remaining > 0) {
      if (pgno === null || pgno < 2 || pgno > this.pageCount || seen.has(pgno)) corrupt("invalid or cyclic overflow chain");
      if (seen.size >= this.maxOverflowPages) throw new BtreeLimitError("maxOverflowPages");
      seen.add(pgno);
      const page = this.pageBytes(pgno), amount = Math.min(remaining, this.usableSize - 4);
      yield page.subarray(4, 4 + amount);
      remaining -= amount;
      const next = be32(page, 0); pgno = next === 0 ? null : next;
    }
    if (pgno !== null) corrupt("overflow chain continues beyond payload");
  }
}

class CursorBase<T extends PayloadCell> {
  protected position = -1; protected generation = 0;
  protected readonly database: BtreeDatabase;
  protected entries: readonly T[] = [];
  #fullyLoaded = false;
  readonly #loadEntries: () => readonly T[];
  constructor(database: BtreeDatabase, loadEntries: () => readonly T[]) { this.database = database; this.#loadEntries = loadEntries; }
  protected ensureEntries(): void {
    if (this.#fullyLoaded) return;
    const current = this.position >= 0 ? this.entries[this.position] : undefined;
    this.entries = this.#loadEntries();
    this.#fullyLoaded = true;
    if (current) this.position = this.entries.findIndex((entry) => entry.pageNumber === current.pageNumber
      && entry.cellOffset === current.cellOffset);
  }
  protected setSeekEntry(entry: T | null): void {
    this.entries = entry === null ? [] : [entry]; this.position = entry === null ? -1 : 0; this.#fullyLoaded = false;
  }
  get valid(): boolean { this.database.assertOpen(); return this.position >= 0 && this.position < this.entries.length; }
  first(): boolean { this.ensureEntries(); return this.move(this.entries.length ? 0 : -1); }
  last(): boolean { this.ensureEntries(); return this.move(this.entries.length ? this.entries.length - 1 : -1); }
  // OP_NullRow clears the underlying Btree cursor as well as its decoded row.
  clearPosition(): void { this.position = -1; this.generation++; }
  next(): boolean { this.ensureEntries(); return this.move(this.valid && this.position + 1 < this.entries.length ? this.position + 1 : -1); }
  previous(): boolean { this.ensureEntries(); return this.move(this.valid && this.position > 0 ? this.position - 1 : -1); }
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
  readonly #root: number;
  constructor(database: BtreeDatabase, root: number) { super(database, () => database.readTable(root)); this.#root = root; }
  get rowid(): bigint { return this.entry().rowid; }
  seek(key: bigint, bias: "ge" | "le"): boolean {
    const result = this.database.tableSeek(this.#root, key, bias);
    this.setSeekEntry(result.entry);
    this.generation++;
    return result.exact;
  }
}
export class TableScanCursor {
  readonly #database: BtreeDatabase;
  readonly #entries: Iterator<TableEntry>;
  #entry: TableEntry | null = null;
  #previousRowid: bigint | null = null;
  #generation = 0;
  constructor(database: BtreeDatabase, entries: Iterator<TableEntry>) { this.#database=database; this.#entries=entries; }
  first(): boolean { if (this.#generation !== 0) throw new BtreeCursorStateError("scan cursor already started"); return this.#advance(); }
  next(): boolean { if (this.#generation === 0) throw new BtreeCursorStateError("scan cursor is not positioned"); return this.#advance(); }
  #advance(): boolean {
    this.#database.assertOpen(); const result=this.#entries.next(); this.#generation++;
    if (result.done) { this.#entry=null; return false; }
    if (this.#previousRowid !== null && this.#previousRowid >= result.value.rowid) corrupt("unordered table b-tree");
    this.#previousRowid=result.value.rowid; this.#entry=result.value; return true;
  }
  get rowid(): bigint { if (!this.#entry) throw new BtreeCursorStateError("cursor is not positioned"); return this.#entry.rowid; }
  payload(): Uint8Array { if (!this.#entry) throw new BtreeCursorStateError("cursor is not positioned"); return this.#database.payload(this.#entry); }
  payloadChunks(): Iterator<Uint8Array> { if (!this.#entry) throw new BtreeCursorStateError("cursor is not positioned"); return this.#database.payloadChunks(this.#entry); }
  borrowPayload(): { bytes(): Uint8Array } {
    if (!this.#entry) throw new BtreeCursorStateError("cursor is not positioned");
    const born=this.#generation, value=this.#database.payload(this.#entry);
    return {bytes:()=>{this.#database.assertOpen();if(born!==this.#generation)throw new BtreeCursorStateError("borrow invalidated by cursor movement");return value;}};
  }
}
export class IndexCursor extends CursorBase<IndexEntry> {
  readonly #root: number;
  #indexPosition: IndexPosition | null = null;
  constructor(database: BtreeDatabase, root: number) { super(database, () => []); this.#root = root; }
  #set(position: IndexPosition | null): boolean {
    this.#indexPosition = position;
    this.setSeekEntry(position?.entry ?? null);
    this.generation++;
    return position !== null;
  }
  override first(): boolean { return this.#set(this.database.indexBoundary(this.#root, "first")); }
  override last(): boolean { return this.#set(this.database.indexBoundary(this.#root, "last")); }
  override next(): boolean {
    return this.#set(this.#indexPosition === null ? null : this.database.indexMove(this.#indexPosition, "next"));
  }
  override previous(): boolean {
    return this.#set(this.#indexPosition === null ? null : this.database.indexMove(this.#indexPosition, "previous"));
  }
  seek(compareCurrentToTarget: (payload: Uint8Array) => number, bias: "ge" | "le"): boolean {
    const result = this.database.indexSeek(this.#root, compareCurrentToTarget, bias);
    this.#set(result.position);
    return result.exact;
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
