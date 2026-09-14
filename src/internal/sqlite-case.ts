/**
 * SQLite identifier case handling from src/util.c:sqlite3StrICmp and
 * src/global.c:sqlite3UpperToLower. SQLite folds only ASCII A-Z bytes;
 * non-ASCII UTF-8 bytes remain distinct.
 */
export function sqliteAsciiFold(value: string): string {
  return value.replace(/[A-Z]/g, character => String.fromCharCode(character.charCodeAt(0) + 0x20));
}

export function sqliteIdentifierEqual(left: string, right: string): boolean {
  return sqliteAsciiFold(left) === sqliteAsciiFold(right);
}
