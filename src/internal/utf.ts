/**
 * SQLite text decoding subset translated from 3.53.4 src/utf.c:
 * READ_UTF8 and the UTF-16-to-code-point loops in sqlite3VdbeMemTranslate.
 * This intentionally differs from WHATWG decoding for legacy UTF-8.
 */
import type { DatabaseEncoding } from "./record.ts";

function scalar(c: number): string {
  if (c <= 0xffff) return String.fromCharCode(c);
  if (c <= 0x10ffff) return String.fromCodePoint(c);
  return "\ufffd";
}

function decodeUtf8(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++]!;
    let c = first;
    if (first >= 0xc0) {
      // sqlite3Utf8Trans1[c-0xc0] is equivalent to these initial payloads.
      if (first < 0xe0) c = first & 0x1f;
      else if (first < 0xf0) c = first & 0x0f;
      else if (first < 0xf8) c = first & 0x07;
      else if (first < 0xfc) c = first & 0x03;
      else c = first & 0x01;
      while (i < bytes.length && (bytes[i]! & 0xc0) === 0x80) c = c * 64 + (bytes[i++]! & 0x3f);
      if (c < 0x80 || (c & 0xfffff800) === 0xd800 || (c & 0xfffffffe) === 0xfffe) c = 0xfffd;
    }
    result += scalar(c);
  }
  return result;
}

function decodeUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  // sqlite3VdbeMemTranslate ignores an unmatched trailing byte (pMem->n &= ~1).
  let result = "";
  const unit = (offset: number) => littleEndian
    ? bytes[offset]! | (bytes[offset + 1]! << 8)
    : (bytes[offset]! << 8) | bytes[offset + 1]!;
  for (let i = 0; i + 1 < bytes.length;) {
    let c = unit(i); i += 2;
    if (c >= 0xd800 && c < 0xe000 && i + 1 < bytes.length) {
      // Match SQLite's default (without SQLITE_REPLACE_INVALID_UTF) formula,
      // which consumes the following unit for either surrogate half.
      const c2 = unit(i); i += 2;
      c = (c2 & 0x03ff) + ((c & 0x003f) << 10) + (((c & 0x03c0) + 0x0040) << 10);
    }
    result += scalar(c);
  }
  return result;
}

export function decodeSqliteText(bytes: Uint8Array, encoding: DatabaseEncoding): string {
  if (encoding === "utf-8") return decodeUtf8(bytes);
  return decodeUtf16(bytes, encoding === "utf-16le");
}
