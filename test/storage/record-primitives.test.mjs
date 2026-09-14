import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeRecord,
  decodeVarint,
  RecordFormatError,
} from "../../src/internal/record.ts";

/*
 * UPSTREAM-DERIVED CASES. Expected byte layouts and values below come directly
 * from pinned SQLite 3.53.4 src/vdbeaux.c sqlite3SmallTypeSizes and
 * sqlite3VdbeSerialGet evidence tags R-24078-09375, R-44885-25196,
 * R-49794-35026, R-37839-54301, R-01849-26079, R-50385-09674,
 * R-29851-52272, R-57343-49114, R-12976-22893, R-18143-12121,
 * R-14606-31564 and R-28401-00140. Varints follow src/util.c
 * sqlite3GetVarint. Tests labelled LOCAL-SAFETY are stricter bounded-reader
 * companions and carry no native/upstream conformance credit.
 */

function record(serialTypes, ...payloads) {
  assert(serialTypes.every((value) => value >= 0 && value < 128));
  const header = Uint8Array.of(serialTypes.length + 1, ...serialTypes);
  const length = payloads.reduce((sum, payload) => sum + payload.length, header.length);
  const bytes = new Uint8Array(length);
  bytes.set(header);
  let offset = header.length;
  for (const payload of payloads) {
    bytes.set(payload, offset);
    offset += payload.length;
  }
  return bytes;
}

function integer(serialType, payload) {
  const value = decodeRecord(record([serialType], payload), "utf-8").values[0];
  assert.equal(value?.storageClass, "integer");
  return value.value;
}

function expectReason(reason, operation) {
  assert.throws(operation, (error) => error instanceof RecordFormatError && error.reason === reason);
}

test("UPSTREAM util.c sqlite3GetVarint: exact lengths and unsigned 64-bit result", () => {
  assert.deepEqual(decodeVarint(Uint8Array.of(0x00), 0, 1), { value: 0n, length: 1 });
  assert.deepEqual(decodeVarint(Uint8Array.of(0x7f), 0, 1), { value: 127n, length: 1 });
  assert.deepEqual(decodeVarint(Uint8Array.of(0x81, 0x00), 0, 2), { value: 128n, length: 2 });
  assert.deepEqual(
    decodeVarint(Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff), 0, 9),
    { value: 0xffffffffffffffffn, length: 9 },
  );
  const surrounded = Uint8Array.of(0xaa, 0x81, 0x01, 0xbb);
  assert.deepEqual(decodeVarint(surrounded, 1, 3), { value: 129n, length: 2 });
});

test("UPSTREAM serial 0-6,8,9: NULL, integer constants, every signed width and exact extrema", () => {
  const nullValue = decodeRecord(record([0]), "utf-8").values[0];
  assert.deepEqual(nullValue, { storageClass: "null" });
  assert.equal(integer(8, []), 0n);
  assert.equal(integer(9, []), 1n);

  const cases = [
    [1, [0x7f], 127n], [1, [0x80], -128n], [1, [0xff], -1n],
    [2, [0x7f, 0xff], 32767n], [2, [0x80, 0x00], -32768n], [2, [0xff, 0xfe], -2n],
    [3, [0x7f, 0xff, 0xff], 8388607n], [3, [0x80, 0, 0], -8388608n], [3, [0xff, 0xff, 0xfd], -3n],
    [4, [0x7f, 0xff, 0xff, 0xff], 2147483647n], [4, [0x80, 0, 0, 0], -2147483648n],
    [5, [0x7f, 0xff, 0xff, 0xff, 0xff, 0xff], 140737488355327n],
    [5, [0x80, 0, 0, 0, 0, 0], -140737488355328n],
    [6, [0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], 9223372036854775807n],
    [6, [0x80, 0, 0, 0, 0, 0, 0, 0], -9223372036854775808n],
    [6, [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfc], -4n],
  ];
  for (const [serialType, bytes, expected] of cases) {
    assert.equal(integer(serialType, bytes), expected, `serial ${serialType}, bytes ${bytes}`);
    assert.equal(typeof integer(serialType, bytes), "bigint");
  }
});

test("UPSTREAM serial 7: raw IEEE-754 bits and finite/infinity/NaN class are retained", () => {
  const cases = [
    [0x3ff0000000000000n, 1, "finite"],
    [0x8000000000000000n, -0, "finite"],
    [0x7ff0000000000000n, Infinity, "infinity"],
    [0xfff0000000000000n, -Infinity, "infinity"],
    [0x7ff8000000000042n, NaN, "nan"],
  ];
  for (const [bits, expected, classification] of cases) {
    const payload = new Uint8Array(8);
    new DataView(payload.buffer).setBigUint64(0, bits, false);
    const value = decodeRecord(record([7], payload), "utf-8").values[0];
    assert.equal(value?.storageClass, "real");
    assert.equal(value.bits, bits);
    assert.equal(value.classification, classification);
    if (Number.isNaN(expected)) assert(Number.isNaN(value.value));
    else assert(Object.is(value.value, expected));
  }
});

test("UPSTREAM serial >=12: empty/nonempty BLOB and TEXT borrow bytes and retain encoding", () => {
  const owner = record([12, 13, 16, 17], [], [], [0xde, 0xad], [0x00, 0x41]);
  const decoded = decodeRecord(owner, "utf-16be");
  assert.equal(decoded.headerLength, 5);
  assert.equal(decoded.payloadLength, 4);
  assert.deepEqual(decoded.values.map((value) => value.storageClass), ["blob", "text", "blob", "text"]);
  assert.deepEqual([...decoded.values[0].bytes], []);
  assert.deepEqual([...decoded.values[1].bytes], []);
  assert.deepEqual([...decoded.values[2].bytes], [0xde, 0xad]);
  assert.deepEqual([...decoded.values[3].bytes], [0x00, 0x41]);
  assert.equal(decoded.values[1].encoding, "utf-16be");
  assert.equal(decoded.values[3].encoding, "utf-16be");
  for (const value of decoded.values) assert.equal(value.bytes.buffer, owner.buffer);

  for (const encoding of ["utf-8", "utf-16le", "utf-16be"]) {
    const value = decodeRecord(record([15], [0x41]), encoding).values[0];
    assert.equal(value?.storageClass, "text");
    assert.equal(value.encoding, encoding);
    assert.deepEqual([...value.bytes], [0x41]);
  }
});

test("LOCAL-SAFETY: reserved serial 10/11 and malformed varint/header/payload bounds reject", () => {
  expectReason("reserved-serial-type", () => decodeRecord(record([10]), "utf-8"));
  expectReason("reserved-serial-type", () => decodeRecord(record([11]), "utf-8"));

  expectReason("invalid-bounds", () => decodeVarint(Uint8Array.of(0), -1, 1));
  expectReason("invalid-bounds", () => decodeVarint(Uint8Array.of(0), 1, 0));
  expectReason("invalid-bounds", () => decodeVarint(Uint8Array.of(0), 0, 2));
  expectReason("truncated-varint", () => decodeVarint(Uint8Array.of(0x81), 0, 1));
  expectReason("truncated-varint", () => decodeVarint(Uint8Array.of(0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80), 0, 8));

  expectReason("invalid-header", () => decodeRecord(new Uint8Array(), "utf-8"));
  expectReason("invalid-header", () => decodeRecord(Uint8Array.of(0), "utf-8"));
  expectReason("invalid-header", () => decodeRecord(Uint8Array.of(2), "utf-8"));
  expectReason("truncated-varint", () => decodeRecord(Uint8Array.of(2, 0x81), "utf-8"));
  expectReason("truncated-payload", () => decodeRecord(Uint8Array.of(2, 6, 0, 0, 0), "utf-8"));
  // Huge serial type (varint 0xff...ff) cannot wrap its derived payload length.
  expectReason("truncated-payload", () => decodeRecord(Uint8Array.of(10, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff), "utf-8"));
});

test("UPSTREAM unpack-compatible trailing bytes are not consumed; borrowed mutation remains visible", () => {
  const owner = Uint8Array.of(2, 14, 0x41, 0x99, 0x98); // one-byte BLOB plus caller-owned trailing bytes
  const decoded = decodeRecord(owner, "utf-8");
  assert.equal(decoded.payloadLength, 1);
  assert.deepEqual([...decoded.values[0].bytes], [0x41]);
  owner[2] = 0x42;
  assert.deepEqual([...decoded.values[0].bytes], [0x42], "internal result is a documented borrow, not a public copy");
  assert.deepEqual([...owner.subarray(decoded.headerLength + decoded.payloadLength)], [0x99, 0x98]);
});
