import assert from "node:assert/strict";
import test from "node:test";

import { decodeSqliteText } from "../../src/internal/utf.ts";

// Expected scalars are from the pinned 3.53.4 utf.c READ_UTF8 and
// sqlite3VdbeMemTranslate control flow. These distinguish SQLite from WHATWG.
test("SQLite legacy UTF-8 accepts continuation bytes and overlong values >= U+0080", () => {
  assert.equal(decodeSqliteText(Uint8Array.of(0x80), "utf-8"), "\u0080");
  assert.equal(decodeSqliteText(Uint8Array.of(0xe0, 0x82, 0x80), "utf-8"), "\u0080");
  assert.equal(decodeSqliteText(Uint8Array.of(0xc0, 0x80), "utf-8"), "\ufffd");
  assert.equal(decodeSqliteText(Uint8Array.of(0xed, 0xa0, 0x80), "utf-8"), "\ufffd");
  assert.equal(decodeSqliteText(Uint8Array.of(0xef, 0xbf, 0xbe), "utf-8"), "\ufffd");
  assert.equal(decodeSqliteText(Uint8Array.of(0xfe, 0x80, 0x80), "utf-8"), "\ufffd");
  assert.equal(decodeSqliteText(Uint8Array.of(0xff, 0x80, 0x80), "utf-8"), "\ufffd");
  assert.equal(decodeSqliteText(Uint8Array.of(0xfd, 0x80, 0x80), "utf-8"), "\u1000");
});

test("SQLite UTF-16 conversion handles endian pairs and its odd-byte rule", () => {
  assert.equal(decodeSqliteText(Uint8Array.of(0x41, 0x00, 0x3d, 0xd8, 0x00, 0xde), "utf-16le"), "A😀");
  assert.equal(decodeSqliteText(Uint8Array.of(0x00, 0x41, 0xd8, 0x3d, 0xde, 0x00), "utf-16be"), "A😀");
  assert.equal(decodeSqliteText(Uint8Array.of(0x41, 0x00, 0xff), "utf-16le"), "A");
});
