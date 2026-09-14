import assert from "node:assert/strict";
import test from "node:test";

import { BorrowLifetime, Mem, MemError, memFromPublic, memFromRawRecord, memToPublicInitial } from "../../src/internal/mem.ts";

function reason(expected, operation) {
  assert.throws(operation, (error) => error instanceof MemError && error.reason === expected);
}

/* UPSTREAM-DERIVED: pinned 3.53.4 vdbemem.c SetDouble/SetInt64/SetStr and
 * ShallowCopy/Copy/Move. LOCAL-SAFETY cases exercise explicit TS lifetime and
 * malformed-state checks; they carry no SQL conformance credit. */
test("UPSTREAM sqlite3VdbeMemSetDouble: NaN becomes NULL while infinity and integral doubles remain REAL", () => {
  const value = new Mem();
  value.setDouble(Number.NaN); assert.equal(memToPublicInitial(value), null);
  value.setDouble(Number.POSITIVE_INFINITY); assert.equal(memToPublicInitial(value), Infinity);
  value.setDouble(Number.NEGATIVE_INFINITY); assert.equal(memToPublicInitial(value), -Infinity);
  value.setDouble(44); assert.equal(memToPublicInitial(value), 44); assert.equal(typeof memToPublicInitial(value), "number");
});

test("UPSTREAM Mem classes preserve NULL versus empty, int64, IntReal and byte metadata", () => {
  const value = new Mem();
  assert.equal(memToPublicInitial(value), null);
  value.setInt64(-9223372036854775808n); assert.equal(memToPublicInitial(value), -9223372036854775808n);
  reason("invalid-int64", () => value.setInt64(9223372036854775808n));
  value.setIntReal(44n); assert.equal(memToPublicInitial(value), 44); assert.equal(value.diagnostic().numeric, "int-real");

  value.setBlob(new Uint8Array(), { zeroTail: 2 });
  assert.deepEqual(memToPublicInitial(value), Uint8Array.of(0, 0));
  assert.deepEqual(value.diagnostic(), { manifest: "blob", numeric: null, bytes: "blob", encoding: null, byteLength: 2, ownership: "owned", terminated: false, zeroTail: 2, subtype: null, fromBind: false, clearedNull: false });
  value.setText(Uint8Array.of(), "utf-8"); assert.equal(memToPublicInitial(value), "");
  assert.notEqual(memToPublicInitial(value), null);
});

test("UPSTREAM explicit lengths retain embedded NUL and all database encodings", () => {
  const cases = [
    ["utf-8", Uint8Array.of(0x41, 0, 0x42)],
    ["utf-16le", Uint8Array.of(0x41, 0, 0, 0, 0x42, 0)],
    ["utf-16be", Uint8Array.of(0, 0x41, 0, 0, 0, 0x42)],
  ];
  for (const [encoding, bytes] of cases) {
    const value = new Mem(); value.setText(bytes, encoding, { terminated: true });
    assert.equal(value.textValue(), "A\0B"); assert.equal(value.diagnostic().byteLength, bytes.length);
    assert.equal(value.diagnostic().encoding, encoding); assert.equal(value.diagnostic().terminated, true);
  }
});

test("UPSTREAM stringify retains canonical numeric caches and lifecycle operations preserve or clear them", () => {
  for (const [install, numeric, text] of [
    [(value) => value.setInt64(42n), "integer", "42"],
    [(value) => value.setDouble(2.5), "real", "2.5"],
    [(value) => value.setIntReal(44n), "int-real", "44.0"],
  ]) {
    const source = new Mem(); install(source); source.setSubtype(9); source.stringify("utf-8");
    assert.deepEqual([source.diagnostic().numeric, source.diagnostic().bytes, source.textValue()], [numeric, "text", text]);
    assert.equal(source.diagnostic().subtype, null);
    const bytes = source.textBytes(); source.stringify("utf-8"); assert.equal(source.textBytes(), bytes, "cached text is reused");
    const full = new Mem(); full.copyFrom(source); assert.deepEqual([full.diagnostic().numeric, full.textValue()], [numeric, text]);
    const shallow = new Mem(); shallow.shallowCopyFrom(source); assert.deepEqual([shallow.diagnostic().numeric, shallow.textValue()], [numeric, text]);
    const moved = new Mem(); moved.moveFrom(source); assert.deepEqual([moved.diagnostic().numeric, moved.textValue()], [numeric, text]); assert.equal(source.initialStorageClass, "null");
    reason("expired-borrow", () => shallow.textValue()); moved.setNull(); assert.deepEqual([moved.diagnostic().numeric, moved.diagnostic().bytes], [null, null]);
  }
  const forced = new Mem(); forced.setInt64(7n); forced.stringify("utf-8", true);
  assert.deepEqual([forced.initialStorageClass, forced.diagnostic().numeric, forced.textValue()], ["text", null, "7"]);
  const textAffinity = new Mem(); textAffinity.setInt64(8n); textAffinity.applyAffinity("text", "utf-8");
  assert.deepEqual([textAffinity.initialStorageClass, textAffinity.diagnostic().numeric, textAffinity.textValue()], ["text", null, "8"]);
  const numericAffinity = new Mem(); numericAffinity.setText(Uint8Array.of(0x30, 0x38), "utf-8"); numericAffinity.applyAffinity("numeric", "utf-8");
  assert.deepEqual([numericAffinity.initialStorageClass, numericAffinity.diagnostic().numeric, numericAffinity.diagnostic().bytes], ["integer", "integer", null]);
});

test("UPSTREAM changeEncoding preserves caches, byte lengths, embedded NUL and source malformed behavior", () => {
  const numeric = new Mem(); numeric.setInt64(12n); numeric.stringify("utf-16le");
  assert.deepEqual([numeric.diagnostic().numeric, numeric.diagnostic().encoding, numeric.diagnostic().byteLength], ["integer", "utf-16le", 4]);
  numeric.changeEncoding("utf-16be"); assert.deepEqual(numeric.textBytes(), Uint8Array.of(0, 0x31, 0, 0x32));
  numeric.changeEncoding("utf-8"); assert.equal(numeric.textValue(), "12"); assert.equal(numeric.diagnostic().numeric, "integer");

  const nul = new Mem(); nul.setText(Uint8Array.of(0x41, 0, 0x42), "utf-8"); nul.changeEncoding("utf-16le");
  assert.equal(nul.textValue(), "A\0B"); assert.equal(nul.diagnostic().byteLength, 6);
  const legacy = new Mem(); legacy.setText(Uint8Array.of(0xc0, 0x80, 0x80), "utf-8"); legacy.changeEncoding("utf-16le");
  assert.equal(legacy.textValue(), "�");
  const odd = new Mem(); odd.setText(Uint8Array.of(0x41, 0, 0xff), "utf-16le"); odd.changeEncoding("utf-8"); assert.equal(odd.textValue(), "A"); assert.equal(odd.diagnostic().byteLength, 1);
  const swapOdd = new Mem(); swapOdd.setText(Uint8Array.of(0x41, 0, 0xee), "utf-16le"); swapOdd.changeEncoding("utf-16be"); assert.deepEqual(swapOdd.textBytes(), Uint8Array.of(0, 0x41, 0xee));
});
test("UPSTREAM full/shallow copy and move have distinct ownership and reset semantics", () => {
  const source = new Mem(); source.setBlob(Uint8Array.of(1, 2)); source.setSubtype(7);
  const shallow = new Mem(); shallow.shallowCopyFrom(source);
  const full = new Mem(); full.copyFrom(source);
  assert.equal(shallow.diagnostic().ownership, "borrowed"); assert.equal(full.diagnostic().ownership, "owned");
  source.setNull();
  reason("expired-borrow", () => shallow.blobValue());
  assert.deepEqual(full.blobValue(), Uint8Array.of(1, 2)); assert.equal(full.diagnostic().subtype, 7);

  const externalOwner = new BorrowLifetime(); const externalBytes = Uint8Array.of(4);
  const externalSource = new Mem(); externalSource.setBlob(externalBytes, { ownership: "borrowed", lifetime: externalOwner });
  const externalShallow = new Mem(); externalShallow.shallowCopyFrom(externalSource);
  externalOwner.invalidate(); reason("expired-borrow", () => externalShallow.blobValue());

  const movedSource = new Mem(); movedSource.setText(Uint8Array.of(0x78), "utf-8");
  const moved = new Mem(); moved.moveFrom(movedSource);
  assert.equal(moved.textValue(), "x"); assert.equal(memToPublicInitial(movedSource), null);
});

test("LOCAL-SAFETY external borrow invalidation, aggregate cleanup, limits and malformed lifecycle are typed", () => {
  const owner = new BorrowLifetime(); const bytes = Uint8Array.of(9);
  const borrowed = new Mem(); borrowed.setBlob(bytes, { ownership: "borrowed", lifetime: owner });
  bytes[0] = 8; assert.deepEqual(borrowed.blobValue(), Uint8Array.of(8)); owner.invalidate();
  reason("expired-borrow", () => borrowed.blobValue());
  reason("invalid-state", () => new Mem().setBlob(bytes, { ownership: "borrowed" }));
  reason("limit", () => new Mem().setBlob(bytes, { maxLength: 0 }));
  let cleaned = 0; const aggregate = new Mem(); aggregate.setAggregate({ definition: {}, context: {}, cleanup: () => cleaned++ }); aggregate.release(); aggregate.release(); assert.equal(cleaned, 1);
});

test("UPSTREAM/raw and public adapters avoid duplicate models and public blobs copy", () => {
  const owner = new BorrowLifetime(); const rawBytes = Uint8Array.of(0x61, 0, 0x62);
  const raw = memFromRawRecord({ storageClass: "text", bytes: rawBytes, encoding: "utf-8" }, owner);
  assert.equal(raw.textValue(), "a\0b"); owner.invalidate(); reason("expired-borrow", () => raw.textValue());
  assert.equal(memToPublicInitial(memFromRawRecord({ storageClass: "real", bits: 0x7ff8000000000000n, value: NaN, classification: "nan" })), null);

  const input = Uint8Array.of(1); const bound = memFromPublic(input, "utf-8"); input[0] = 2;
  const output = memToPublicInitial(bound); assert.deepEqual(output, Uint8Array.of(1)); output[0] = 3; assert.deepEqual(memToPublicInitial(bound), Uint8Array.of(1));
  for (const encoding of ["utf-8", "utf-16le", "utf-16be"]) assert.equal(memToPublicInitial(memFromPublic("😀\0x", encoding)), "😀\0x");
  reason("invalid-text", () => memFromPublic("\ud800", "utf-8"));
  reason("limit", () => memFromPublic("😀", "utf-8", { maxLength: 3 }));
});
