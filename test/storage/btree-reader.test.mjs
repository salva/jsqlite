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
  assert.throws(() => openBtreeDatabase(image, { maxBtreeDepth: 1 }).tableCursor(2), /maxBtreeDepth/);

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
