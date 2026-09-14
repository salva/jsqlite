import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  btreeFromConnection,
  btreeFromStorage,
  BtreeCursorStateError,
  BtreeFormatError,
  openBtreeDatabase,
} from "../../src/internal/btree.ts";
import { ImmutableStorage, StorageUnsupportedError } from "../../src/internal/storage.ts";
import { JSQLiteError, open } from "../../src/index.ts";
import { decodeRecord } from "../../src/internal/record.ts";

const fixtureRoot = new URL("../fixtures/", import.meta.url);
const current = JSON.parse(await readFile(new URL("CURRENT.json", fixtureRoot), "utf8"));
const generation = new URL(`generations/${current.generationId}/generated/`, fixtureRoot);
const fixtureNames = [
  "storage-p512.db", "storage-p1024.db", "storage-p2048.db", "storage-p4096.db",
  "storage-p8192.db", "storage-p16384.db", "storage-p32768.db", "storage-p65536.db",
  "storage-p4096-utf16le.db", "storage-p4096-utf16be.db",
];

async function bytes(name = "storage-p512.db") {
  return new Uint8Array(await readFile(new URL(name, generation)));
}
function text(value) {
  assert.equal(value.storageClass, "text");
  return new TextDecoder(value.encoding).decode(value.bytes);
}
function indexTuple(payload, encoding) {
  const values = decodeRecord(payload, encoding).values;
  assert.equal(values.length, 3);
  return [text(values[0]), values[1].value, values[2].value];
}
function compareTuple(a, b) {
  for (let i = 0; i < 3; i++) {
    const result = a[i] < b[i] ? -1 : a[i] > b[i] ? 1 : 0;
    if (result) return result;
  }
  return 0;
}
function readU16(image, offset) {
  return image[offset] * 256 + image[offset + 1];
}
function readU32(image, offset) {
  return image[offset] * 0x1000000 + image[offset + 1] * 0x10000 + image[offset + 2] * 256 + image[offset + 3];
}
function writeU32(image, offset, value) {
  image[offset] = value >>> 24;
  image[offset + 1] = value >>> 16;
  image[offset + 2] = value >>> 8;
  image[offset + 3] = value;
}
function corruptPageType(image, pageNumber) {
  const changed = image.slice();
  changed[databasePageOffset(changed, pageNumber)] = 0xff;
  return changed;
}

// Source-derived roots from the immutable fixture recipe: storage_values=2,
// storage_k=3. No sqlite_schema parser or SQL evaluator is involved.
test("multi-level table cursor supports complete movement and boundary seeks", async () => {
  const database = openBtreeDatabase(await bytes(), { maxBtreeDepth: 64, maxOverflowPages: 1024 });
  const cursor = database.tableCursor(2);
  assert.equal(cursor.first(), true);
  assert.equal(cursor.rowid, -9223372036854775808n);
  assert.equal(cursor.previous(), false);
  assert.equal(cursor.valid, false);

  assert.equal(cursor.seek(999n, "ge"), true);
  assert.equal(cursor.rowid, 999n);
  assert.equal(cursor.next(), true);
  assert.equal(cursor.rowid, 1000n);
  assert.equal(cursor.seek(-1n, "ge"), false);
  assert.equal(cursor.rowid, 0n);
  assert.equal(cursor.seek(2001n, "le"), false);
  assert.equal(cursor.rowid, 2000n);

  assert.equal(cursor.last(), true);
  assert.equal(cursor.rowid, 9223372036854775807n);
  assert.equal(cursor.next(), false);
  assert.equal(cursor.valid, false);
  assert.equal(cursor.seek(9223372036854775807n, "le"), true);
  assert.equal(cursor.previous(), true);
  assert.equal(cursor.rowid, 2000n);
});

test("interior and leaf index entries traverse in order in both directions and seek", async () => {
  const database = openBtreeDatabase(await bytes());
  const cursor = database.indexCursor(3);
  const tuples = [];
  assert.equal(cursor.first(), true);
  do tuples.push(indexTuple(cursor.payload(), database.encoding)); while (cursor.next());
  assert.equal(tuples.length, 2003);
  for (let i = 1; i < tuples.length; i++) assert.ok(compareTuple(tuples[i - 1], tuples[i]) < 0);

  const target = ["key-001000", 1000n, 1000n];
  const exact = cursor.seek((payload) => compareTuple(indexTuple(payload, database.encoding), target), "ge");
  assert.equal(exact, true);
  assert.deepEqual(indexTuple(cursor.payload(), database.encoding), target);
  assert.equal(cursor.previous(), true);
  assert.deepEqual(indexTuple(cursor.payload(), database.encoding), ["key-000999", 999n, 999n]);

  const missing = ["key-001000x", 0n, 0n];
  assert.equal(cursor.seek((payload) => compareTuple(indexTuple(payload, database.encoding), missing), "ge"), false);
  assert.deepEqual(indexTuple(cursor.payload(), database.encoding), ["key-001001", 1001n, 1001n]);
  assert.equal(cursor.last(), true);
  const reverse = [];
  do reverse.push(indexTuple(cursor.payload(), database.encoding)); while (cursor.previous());
  assert.deepEqual(reverse, [...tuples].reverse());
});

test("table and index seek descend only through the selected pages", async (t) => {
  // Pinned sqlite3BtreeTableMoveto/sqlite3BtreeIndexMoveto compare within each
  // interior page and descend through one child. A malformed off-path page must
  // not be fault-touched merely to position at the smallest key. The same
  // storage-p512 mutations were independently observed with SQLite 3.53.4.
  const image = await bytes();

  await t.test("table minimum ignores a malformed rightmost subtree", () => {
    const root = databasePageOffset(image, 2);
    const rightmost = readU32(image, root + 8);
    const database = openBtreeDatabase(corruptPageType(image, rightmost));
    const cursor = database.tableCursor(2);
    assert.equal(cursor.seek(-9223372036854775808n, "ge"), true);
    assert.equal(cursor.rowid, -9223372036854775808n);
  });

  await t.test("non-leftmost table seek ignores a malformed unrelated subtree", () => {
    const root = databasePageOffset(image, 2);
    const firstCell = readU16(image, root + 12);
    const leftmost = readU32(image, root + firstCell);
    const database = openBtreeDatabase(corruptPageType(image, leftmost));
    const cursor = database.tableCursor(2);
    assert.equal(cursor.seek(9223372036854775807n, "le"), true);
    assert.equal(cursor.rowid, 9223372036854775807n);
  });

  await t.test("table seek rejects a selected-path cycle", () => {
    const changed = image.slice();
    const root = databasePageOffset(changed, 2);
    const firstCell = readU16(changed, root + 12);
    writeU32(changed, root + firstCell, 2);
    const cursor = openBtreeDatabase(changed).tableCursor(2);
    assert.throws(() => cursor.seek(-9223372036854775808n, "ge"), /b-tree cycle/);
  });

  await t.test("index minimum ignores a malformed rightmost subtree", () => {
    const root = databasePageOffset(image, 3);
    const rightmost = readU32(image, root + 8);
    const database = openBtreeDatabase(corruptPageType(image, rightmost));
    const cursor = database.indexCursor(3);
    const target = ["key-000001", 1n, 1n];
    assert.equal(cursor.seek((payload) => compareTuple(indexTuple(payload, database.encoding), target), "ge"), true);
    assert.deepEqual(indexTuple(cursor.payload(), database.encoding), target);
  });

  await t.test("index exact and inexact LE retain predecessor placement", () => {
    const database = openBtreeDatabase(image);
    const cursor = database.indexCursor(3);
    const seek = (target) => cursor.seek(
      (payload) => compareTuple(indexTuple(payload, database.encoding), target), "le",
    );
    assert.equal(seek(["key-001000", 1000n, 1000n]), true);
    assert.deepEqual(indexTuple(cursor.payload(), database.encoding), ["key-001000", 1000n, 1000n]);
    assert.equal(seek(["key-001000x", 0n, 0n]), false);
    assert.deepEqual(indexTuple(cursor.payload(), database.encoding), ["key-001000", 1000n, 1000n]);
  });

  await t.test("index seek comparison work is path-local and boundary placement is stable", () => {
    const database = openBtreeDatabase(image);
    const cursor = database.indexCursor(3);
    let comparisons = 0;
    const seek = (target, bias) => cursor.seek((payload) => {
      comparisons++;
      return compareTuple(indexTuple(payload, database.encoding), target);
    }, bias);

    assert.equal(seek(["key-001500x", 0n, 0n], "ge"), false);
    assert.deepEqual(indexTuple(cursor.payload(), database.encoding), ["key-001501", 1501n, 1501n]);
    // The fixture has 2003 index entries. Page-local binary searches must not
    // invoke the comparison callback once per entry as full materialization plus
    // a linear seek would; leave ample room for tree/page geometry changes.
    assert.ok(comparisons < 100, `expected path-local comparison work, got ${comparisons}`);

    comparisons = 0;
    assert.equal(seek(["", 0n, 0n], "le"), false);
    assert.equal(cursor.valid, false);
    assert.ok(comparisons < 100, `expected path-local lower-bound work, got ${comparisons}`);

    comparisons = 0;
    assert.equal(seek(["zzzz", 0n, 0n], "ge"), false);
    assert.equal(cursor.valid, false);
    assert.ok(comparisons < 100, `expected path-local upper-bound work, got ${comparisons}`);
  });

  await t.test("non-leftmost index seek ignores a malformed unrelated subtree", () => {
    const root = databasePageOffset(image, 3);
    const firstCell = readU16(image, root + 12);
    const leftmost = readU32(image, root + firstCell);
    const database = openBtreeDatabase(corruptPageType(image, leftmost));
    const cursor = database.indexCursor(3);
    const target = ["key-001900", 1900n, 1900n];
    assert.equal(cursor.seek((payload) => compareTuple(indexTuple(payload, database.encoding), target), "ge"), true);
    assert.deepEqual(indexTuple(cursor.payload(), database.encoding), target);
  });

  await t.test("a malformed selected index child still reports corruption", () => {
    const root = databasePageOffset(image, 3);
    const firstCell = readU16(image, root + 12);
    const selectedChild = readU32(image, root + firstCell);
    const database = openBtreeDatabase(corruptPageType(image, selectedChild));
    const cursor = database.indexCursor(3);
    const target = ["key-000001", 1n, 1n];
    assert.throws(() => cursor.seek(
      (payload) => compareTuple(indexTuple(payload, database.encoding), target), "ge",
    ), BtreeFormatError);
  });

  await t.test("index seek depth is charged on the selected path", () => {
    const database = openBtreeDatabase(image, { maxBtreeDepth: 1 });
    const cursor = database.indexCursor(3);
    const target = ["key-000001", 1n, 1n];
    assert.throws(() => cursor.seek(
      (payload) => compareTuple(indexTuple(payload, database.encoding), target), "ge",
    ), /maxBtreeDepth/);
  });

  await t.test("index seek rejects a selected-path cycle", () => {
    const changed = image.slice();
    const root = databasePageOffset(changed, 3);
    const firstCell = readU16(changed, root + 12);
    writeU32(changed, root + firstCell, 3);
    const database = openBtreeDatabase(changed);
    const cursor = database.indexCursor(3);
    const target = ["key-000001", 1n, 1n];
    assert.throws(() => cursor.seek(
      (payload) => compareTuple(indexTuple(payload, database.encoding), target), "ge",
    ), /b-tree cycle/);
  });

  await t.test("a malformed selected table child still reports corruption", () => {
    const root = databasePageOffset(image, 2);
    const firstCell = readU16(image, root + 12);
    const selectedChild = readU32(image, root + firstCell);
    assert.throws(() => {
      const cursor = openBtreeDatabase(corruptPageType(image, selectedChild)).tableCursor(2);
      cursor.seek(-9223372036854775808n, "ge");
    }, BtreeFormatError);
  });
});

test("real overflow payload is reconstructed and movement invalidates only borrowed views", async () => {
  const database = openBtreeDatabase(await bytes());
  const cursor = database.tableCursor(2);
  assert.equal(cursor.seek(0n, "ge"), true);
  const owned = cursor.payload();
  const borrowed = cursor.borrowPayload();
  assert.deepEqual(borrowed.bytes(), owned);
  const record = decodeRecord(owned, database.encoding);
  assert.equal(record.values[4].bytes.byteLength, 2122);
  assert.equal(record.values[5].bytes.byteLength, 1555);
  assert.equal(cursor.next(), true);
  assert.throws(() => borrowed.bytes(), BtreeCursorStateError);
  assert.equal(decodeRecord(owned, database.encoding).values[4].bytes.byteLength, 2122);

  const limited = openBtreeDatabase(await bytes(), { maxOverflowPages: 1 }).tableCursor(2);
  limited.seek(0n, "ge");
  assert.throws(() => limited.payload(), /maxOverflowPages/);
});

test("overflow cycle is corruption", async () => {
  const image = await bytes();
  const database = openBtreeDatabase(image);
  const cursor = database.tableCursor(2);
  cursor.seek(0n, "ge");
  const chain = cursor.overflowPages();
  assert.ok(chain.length > 1);
  const corrupt = image.slice();
  const pageSize = database.pageSize;
  const last = chain.at(-1);
  const offset = (last - 1) * pageSize;
  corrupt[offset] = last >>> 24; corrupt[offset + 1] = last >>> 16;
  corrupt[offset + 2] = last >>> 8; corrupt[offset + 3] = last;
  const broken = openBtreeDatabase(corrupt).tableCursor(2);
  broken.seek(0n, "ge");
  assert.throws(() => broken.payload(), BtreeFormatError);
});

test("all storage page sizes and database encodings retain table/index boundaries", async () => {
  for (const name of fixtureNames) {
    const database = openBtreeDatabase(await bytes(name));
    const table = database.tableCursor(2);
    assert.equal(table.first(), true, name);
    assert.equal(table.rowid, -9223372036854775808n, name);
    assert.equal(table.last(), true, name);
    assert.equal(table.rowid, 9223372036854775807n, name);
    const index = database.indexCursor(3);
    assert.equal(index.first(), true, name);
    assert.deepEqual(indexTuple(index.payload(), database.encoding), ["key-000001", 1n, 1n], name);
    assert.equal(index.last(), true, name);
    assert.deepEqual(indexTuple(index.payload(), database.encoding), ["overflow", 0n, 0n], name);
  }
});

test("tree depth and malformed cell pointers fail distinctly", async () => {
  const image = await bytes();
  const depthLimited = openBtreeDatabase(image, { maxBtreeDepth: 1 }).tableCursor(2);
  assert.throws(() => depthLimited.seek(-9223372036854775808n, "ge"), /maxBtreeDepth/);

  const corrupt = image.slice();
  const root2 = databasePageOffset(corrupt, 2);
  // First pointer follows the 12-byte interior header.
  corrupt[root2 + 12] = 0; corrupt[root2 + 13] = 1;
  assert.throws(() => openBtreeDatabase(corrupt).tableCursor(2).first(), BtreeFormatError);
});

function databasePageOffset(image, pageNumber) {
  const encoded = image[16] * 256 + image[17];
  const pageSize = encoded === 1 ? 65536 : encoded;
  return (pageNumber - 1) * pageSize;
}

test("shared storage validation has public/internal parity and pristine encoding-zero support", async () => {
  const image = await bytes();
  const cases = [[20, 1, StorageUnsupportedError, "unsupported"], [18, 0, BtreeFormatError, "sqlite"], [21, 63, BtreeFormatError, "sqlite"]];
  for (const [offset, value, internalType, publicKind] of cases) {
    const changed = image.slice(); changed[offset] = value;
    assert.throws(() => openBtreeDatabase(changed), internalType);
    const oldFetch = globalThis.fetch; globalThis.fetch = async () => new Response(changed);
    try { await assert.rejects(open("https://example.test/db"), (error) => error instanceof JSQLiteError && error.kind === publicKind); }
    finally { globalThis.fetch = oldFetch; }
  }
  const pristine = new Uint8Array(4096);
  pristine.set(new TextEncoder().encode("SQLite format 3\0"));
  pristine[16] = 0x10; pristine[17] = 0; pristine[18] = 1; pristine[19] = 1;
  pristine[21] = 64; pristine[22] = 32; pristine[23] = 32;
  pristine[100] = 0x0d; pristine[105] = 0x10;
  const storage = ImmutableStorage.open(pristine);
  assert.equal(storage.encoding, 1);
  assert.equal(btreeFromStorage(storage).tableCursor(1).first(), false);
  const oldFetch = globalThis.fetch; globalThis.fetch = async () => new Response(pristine);
  try { const connection = await open("https://example.test/pristine"); connection.close(); }
  finally { globalThis.fetch = oldFetch; }
});

test("closing the shared owner invalidates cursors, operations, and page/record borrows", async () => {
  const storage = ImmutableStorage.open(await bytes());
  const database = btreeFromStorage(storage);
  const cursor = database.tableCursor(2); cursor.seek(0n, "ge");
  const borrowed = cursor.borrowPayload(); const owned = cursor.payload();
  database.close();
  assert.throws(() => borrowed.bytes(), BtreeCursorStateError);
  assert.throws(() => cursor.next(), BtreeCursorStateError);
  assert.throws(() => cursor.payload(), BtreeCursorStateError);
  assert.throws(() => database.tableCursor(2), BtreeCursorStateError);
  assert.equal(decodeRecord(owned, "utf-8").values[4].bytes.byteLength, 2122);
});

test("public Fetch connection is the b-tree owner and close invalidates its consumer", async () => {
  const image = await bytes();
  const oldFetch = globalThis.fetch; globalThis.fetch = async () => new Response(image);
  try {
    const connection = await open("https://example.test/shared-owner");
    const database = btreeFromConnection(connection);
    const cursor = database.tableCursor(2);
    assert.equal(cursor.first(), true);
    assert.equal(cursor.rowid, -9223372036854775808n);
    const borrow = cursor.borrowPayload();
    database.close();
    assert.throws(() => connection.prepare("select 1"), (error) => error instanceof JSQLiteError && error.kind === "misuse");
    assert.throws(() => connection.close(), (error) => error instanceof JSQLiteError && error.kind === "misuse");
    assert.throws(() => borrow.bytes(), BtreeCursorStateError);
    assert.throws(() => cursor.next(), BtreeCursorStateError);
    assert.throws(() => database.indexCursor(3), BtreeCursorStateError);
    assert.throws(
      () => btreeFromConnection(connection),
      BtreeCursorStateError,
      "a closed connection cannot create a new internal storage consumer",
    );
  } finally { globalThis.fetch = oldFetch; }
});
