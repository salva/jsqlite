/**
 * SQLite text decoding subset translated from 3.53.4 src/utf.c:
 * READ_UTF8 and the UTF-16-to-code-point loops in sqlite3VdbeMemTranslate.
 * This intentionally differs from WHATWG decoding for legacy UTF-8.
 */
import type { DatabaseEncoding } from "./record.js";
export declare function decodeSqliteText(bytes: Uint8Array, encoding: DatabaseEncoding): string;
/** utf.c sqlite3VdbeMemTranslate UTF16→UTF8, default build without
 * SQLITE_REPLACE_INVALID_UTF. Write code points directly: an unpaired final
 * surrogate is three bytes, not a WHATWG replacement character. */
export declare function sqliteUtf16ToUtf8(bytes: Uint8Array, encoding: DatabaseEncoding): Uint8Array;
