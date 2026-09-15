import { btreeFromConnection, BtreeCursorStateError, BtreeFormatError } from "./btree.ts";
import { decodeRecord, RecordFormatError, type DatabaseEncoding, type RawRecordValue } from "./record.ts";
import { parseSql, SqlParseError, type ExprNode, type SchemaDdlNode, type SelectNode } from "./parse.ts";
import { storageOwner, type StorageOwnerCarrier } from "./storage.ts";
import { type SqlToken } from "./tokenize.ts";
import { decodeSqliteText } from "./utf.ts";
import { sqliteAsciiFold, sqliteIdentifierEqual } from "./sqlite-case.ts";

/** A malformed sqlite_schema row or declaration. */
export class SchemaFormatError extends Error {
  constructor(message: string, options: ErrorOptions = {}) { super(message, options); this.name = "SchemaFormatError"; }
}
/** A recognized schema construct whose construction is staged for a later slice. */
export class SchemaUnsupportedError extends Error {
  readonly classification = "temporary" as const;
  constructor(message: string) { super(message); this.name = "SchemaUnsupportedError"; }
}
export class SchemaStateError extends Error {
  constructor(message: string) { super(message); this.name = "SchemaStateError"; }
}

export interface ColumnNode {
  readonly name: string;
  readonly declaredType: string | null;
  readonly affinity: "blob" | "text" | "numeric" | "integer" | "real";
  readonly defaultExpr: ExprNode | null;
  readonly generatedExpr: ExprNode | null;
  readonly defaultIndex: number | null;
  readonly notNull: boolean;
  readonly primaryKeyPosition: number | null;
  readonly unique: boolean;
  readonly collation: string | null;
  readonly generatedStorage: "stored" | "virtual" | null;
}
export interface IndexTerm { readonly column: ColumnNode | null; readonly expression: ExprNode | null; readonly expressionSql: string | null; readonly descending: boolean; readonly collation: string | null; readonly nulls: "first" | "last" | null; }
export interface TableNode {
  readonly kind: "table";
  readonly name: string;
  readonly tableName: string;
  readonly rootPage: number;
  readonly sql: string;
  readonly columns: readonly ColumnNode[];
  readonly indexes: IndexNode[];
  readonly withoutRowid: boolean;
  readonly primaryKey: readonly ColumnNode[];
  readonly storageKey: readonly ColumnNode[];
}
export interface IndexNode {
  readonly kind: "index";
  readonly name: string;
  readonly tableName: string;
  readonly rootPage: number;
  readonly sql: string | null;
  readonly table: TableNode;
  readonly terms: readonly IndexTerm[];
  readonly unique: boolean;
  readonly origin: "create";
}
export interface ViewNode {
  readonly kind: "view";
  readonly name: string;
  readonly tableName: string;
  readonly rootPage: 0;
  readonly sql: string;
  readonly selectSql: string;
  readonly select: SelectNode;
}
export type SchemaObject = TableNode | IndexNode | ViewNode;

interface SchemaRow { type: string; name: string; tableName: string; rootPage: number; sql: string | null; }

function malformed(message: string, cause?: unknown): never {
  throw new SchemaFormatError(`malformed database schema: ${message}`, cause === undefined ? {} : { cause });
}
function text(value: RawRecordValue, encoding: DatabaseEncoding, field: string): string {
  if (value.storageClass !== "text") malformed(`${field} is not text`);
  return decodeSqliteText(value.bytes, encoding);
}
function rootPage(value: RawRecordValue): number {
  if (value.storageClass !== "integer" || value.value < 0n || value.value > BigInt(Number.MAX_SAFE_INTEGER)) {
    malformed("rootpage is not a nonnegative integer");
  }
  return Number(value.value);
}
function row(payload: Uint8Array, encoding: DatabaseEncoding): SchemaRow {
  try {
    const values = decodeRecord(payload, encoding);
    if (values.values.length !== 5) malformed("sqlite_schema row does not have five columns");
    const [typeValue, nameValue, tableValue, rootValue, sqlValue] = values.values;
    const type = text(typeValue!, encoding, "type").toLowerCase();
    const name = text(nameValue!, encoding, "name");
    const tableName = text(tableValue!, encoding, "tbl_name");
    const root = rootPage(rootValue!);
    const sql = sqlValue!.storageClass === "null" ? null : text(sqlValue!, encoding, "sql");
    return { type, name, tableName, rootPage: root, sql };
  } catch (error) {
    if (error instanceof SchemaFormatError) throw error;
    if (error instanceof RecordFormatError) malformed(error.message, error);
    throw error;
  }
}

function identifier(token: SqlToken | undefined): string {
  if (!token || (token.kind !== "id" && token.kind !== "keyword")) malformed("expected identifier");
  const value = token.text;
  if (value[0] === "[" && value.at(-1) === "]") return value.slice(1, -1);
  if ((value[0] === '"' || value[0] === "`") && value.at(-1) === value[0]) return value.slice(1, -1).replaceAll(value[0] + value[0], value[0]);
  return value;
}
function affinity(declaredType: string | null): ColumnNode["affinity"] {
  if (declaredType === null) return "blob";
  const type = declaredType.toUpperCase();
  if (type.includes("INT")) return "integer";
  if (type.includes("CHAR") || type.includes("CLOB") || type.includes("TEXT")) return "text";
  if (type.includes("BLOB") || type.length === 0) return "blob";
  if (type.includes("REAL") || type.includes("FLOA") || type.includes("DOUB")) return "real";
  return "numeric";
}
function parseDdl(sql: string, expected: SchemaDdlNode["kind"], name: string): SchemaDdlNode {
  try {
    const parsed = parseSql(sql);
    if (parsed.statement?.kind !== expected) malformed(`SQL for ${name} has the wrong object type`);
    return parsed.statement;
  } catch (error) {
    if (error instanceof SchemaFormatError) throw error;
    if (error instanceof SqlParseError) malformed(`${name} - ${error.message}`, error);
    throw error;
  }
}

function readonlyMap<K, V>(source: Map<K, V>): ReadonlyMap<K, V> {
  // Do not publish a mutable Map behind a ReadonlyMap type annotation.
  let view: ReadonlyMap<K, V>;
  view = Object.freeze({
    get size() { return source.size; },
    get: (key: K) => source.get(key),
    has: (key: K) => source.has(key),
    entries: () => source.entries(),
    keys: () => source.keys(),
    values: () => source.values(),
    forEach: (callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown) => {
      source.forEach((value, key) => callback.call(thisArg, value, key, view));
    },
    [Symbol.iterator]: () => source[Symbol.iterator](),
  });
  return view;
}

export class SchemaGraph {
  readonly encoding: DatabaseEncoding;
  readonly objects: readonly SchemaObject[];
  readonly tables: ReadonlyMap<string, TableNode>;
  readonly indexes: ReadonlyMap<string, IndexNode>;
  readonly views: ReadonlyMap<string, ViewNode>;
  readonly #owner: StorageOwnerCarrier;
  constructor(owner: StorageOwnerCarrier, encoding: DatabaseEncoding, objects: SchemaObject[], tables: Map<string, TableNode>, indexes: Map<string, IndexNode>, views: Map<string, ViewNode>) {
    this.#owner = owner; this.encoding = encoding; this.objects = Object.freeze(objects);
    this.tables = readonlyMap(tables); this.indexes = readonlyMap(indexes); this.views = readonlyMap(views);
    Object.freeze(this);
  }
  assertOpen(): void {
    try { this.#owner[storageOwner].assertOpen(); }
    catch (error) { throw new SchemaStateError("schema owner is closed"); }
  }
}

const graphs = new WeakMap<object, SchemaGraph>();

/**
 * Translate prepare.c sqlite3InitOne/sqlite3InitCallback for the supported
 * table, simple-index and view construction tranche. Root page 1 is read via the
 * existing connection storage owner; every graph value is detached from cursor borrows.
 */
export function loadSchemaGraph(connection: StorageOwnerCarrier): SchemaGraph {
  const key = connection as object;
  const prior = graphs.get(key);
  if (prior) { prior.assertOpen(); return prior; }
  let database;
  try { database = btreeFromConnection(connection); }
  catch (error) { if (error instanceof BtreeCursorStateError) throw new SchemaStateError(error.message); throw error; }
  const rows: SchemaRow[] = [];
  try {
    const cursor = database.tableCursor(1);
    if (cursor.first()) do rows.push(row(cursor.payload(), database.encoding)); while (cursor.next());
  } catch (error) {
    if (error instanceof SchemaFormatError || error instanceof SchemaUnsupportedError) throw error;
    if (error instanceof BtreeFormatError || error instanceof RecordFormatError) malformed((error as Error).message, error);
    throw error;
  }

  const objects: SchemaObject[] = [];
  const tables = new Map<string, TableNode>();
  const indexes = new Map<string, IndexNode>();
  const views = new Map<string, ViewNode>();
  const names = new Set<string>();
  for (const item of rows) {
    const folded = sqliteAsciiFold(item.name);
    if (names.has(folded)) malformed(`duplicate object name ${item.name}`);
    names.add(folded);
    if (item.type === "table") {
      if (item.sql === null) malformed(`table ${item.name} has null SQL`);
      const ddl = parseDdl(item.sql, "create-table", item.name);
      if (ddl.tableAsSelect) throw new SchemaUnsupportedError(`CREATE TABLE AS construction is not implemented: ${item.name}`);
      if (ddl.hasUnsupportedConstraints) throw new SchemaUnsupportedError(`CHECK/REFERENCES constraint construction is not implemented: ${item.name}`);
      if (item.rootPage < 1 || item.rootPage > database.pageCount) malformed(`invalid root page for ${item.name}`);
      let defaultIndex = 0;
      const declaredPrimary = ddl.primaryKey.length ? ddl.primaryKey : ddl.columns.filter(column => column.primaryKey).map(column => column.name);
      const columns = Object.freeze(ddl.columns.map(column => Object.freeze({ name: column.name, declaredType: column.declaredType, affinity: affinity(column.declaredType), defaultExpr: column.defaultExpr, generatedExpr: column.generatedExpr, defaultIndex: column.defaultExpr ? defaultIndex++ : null, notNull: column.notNull || (ddl.withoutRowid && declaredPrimary.some(name => sqliteIdentifierEqual(name, column.name))), primaryKeyPosition: (()=>{const at=declaredPrimary.findIndex(name=>sqliteIdentifierEqual(name, column.name));return at<0?null:at+1;})(), unique: column.unique, collation: column.collation, generatedStorage: column.generatedStorage })));
      const primaryKey = Object.freeze(declaredPrimary.map(name => { const column=columns.find(candidate=>sqliteIdentifierEqual(candidate.name, name));if(!column)malformed(`primary key refers to unknown column ${name}`);return column; }));
      // For WITHOUT ROWID, the declared PK is the b-tree storage key. Rowid
      // tables retain their implicit rowid key, represented by an empty list.
      const storageKey = ddl.withoutRowid ? primaryKey : Object.freeze([] as ColumnNode[]);
      const table: TableNode = { kind: "table", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: item.sql, columns, indexes: [], withoutRowid: ddl.withoutRowid, primaryKey, storageKey };
      tables.set(folded, table);
    }
  }
  for (const item of rows) {
    const folded = sqliteAsciiFold(item.name);
    if (item.type === "table") continue;
    if (item.type === "index") {
      const table = tables.get(sqliteAsciiFold(item.tableName));
      if (!table) malformed(`index ${item.name} refers to unknown table ${item.tableName}`);
      if (item.rootPage < 1 || item.rootPage > database.pageCount) malformed(`invalid root page for ${item.name}`);
      if (item.sql === null) throw new SchemaUnsupportedError(`automatic index construction is not implemented: ${item.name}`);
      const ddl = parseDdl(item.sql, "create-index", item.name);
      if (ddl.indexWhere) throw new SchemaUnsupportedError(`partial index construction is not implemented: ${item.name}`);
      if (ddl.tableName === null || !sqliteIdentifierEqual(ddl.tableName, item.tableName)) malformed(`index ${item.name} has mismatched table name`);
      const terms = Object.freeze(ddl.indexTerms.map(term => {
        const tokens = term.expr.tokens;
        const simple = tokens.length === 1 ? identifier(tokens[0]) : null;
        const column = simple === null ? null : table.columns.find(candidate => sqliteIdentifierEqual(candidate.name, simple)) ?? null;
        if (simple !== null && !column) malformed(`index refers to unknown column ${simple}`);
        return Object.freeze({ column, expression: column ? null : term.expr, expressionSql: column ? null : tokens.map(token => token.text).join(" "), descending: term.descending, collation: term.collation, nulls: term.nulls });
      }));
      const index: IndexNode = { kind: "index", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: item.sql, table, terms, unique: ddl.indexUnique, origin: "create" };
      table.indexes.push(index); indexes.set(folded, Object.freeze(index));
    } else if (item.type === "view") {
      if (item.rootPage !== 0 || item.sql === null) malformed(`invalid view ${item.name}`);
      const ddl = parseDdl(item.sql, "create-view", item.name);
      if (!ddl.select) malformed(`view ${item.name} has no SELECT`);
      const selectSql = ddl.select.tokens.map(token => token.text).join(" ");
      const view: ViewNode = { kind: "view", name: item.name, tableName: item.tableName, rootPage: 0, sql: item.sql, selectSql, select: ddl.select };
      views.set(folded, Object.freeze(view));
    } else if (item.type === "trigger") {
      throw new SchemaUnsupportedError(`trigger construction is not implemented: ${item.name}`);
    } else malformed(`unknown object type ${item.type}`);
  }
  // Restore physical sqlite_schema declaration order after cross-linking tables.
  const byName = new Map<string, SchemaObject>([...tables, ...indexes, ...views]);
  for (const item of rows) {
    const object = byName.get(sqliteAsciiFold(item.name));
    if (object) objects.push(object);
  }
  for (const table of tables.values()) { Object.freeze(table.indexes); Object.freeze(table); }
  const graph = new SchemaGraph(connection, database.encoding, objects, tables, indexes, views);
  graphs.set(key, graph);
  return graph;
}
