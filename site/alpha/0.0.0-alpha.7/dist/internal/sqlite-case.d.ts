/**
 * SQLite identifier case handling from src/util.c:sqlite3StrICmp and
 * src/global.c:sqlite3UpperToLower. SQLite folds only ASCII A-Z bytes;
 * non-ASCII UTF-8 bytes remain distinct.
 */
export declare function sqliteAsciiFold(value: string): string;
export declare function sqliteIdentifierEqual(left: string, right: string): boolean;
